// ========== PERSISTENT LEDGER DATABASE (IndexedDB) ==========
// Local-first storage for blockchain transactions with offline support

class LedgerDatabase {
    /**
     * Initialize Ledger Database
     * @param {string} dbName - Database name
     * @param {number} version - Database version
     */
    constructor(dbName = 'BioWeb3Ledger', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.ready = false;
    }

    /**
     * Initialize database connection
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                this.ready = true;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Transactions object store
                if (!db.objectStoreNames.contains('transactions')) {
                    const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    txStore.createIndex('hash', 'hash', { unique: true });
                    txStore.createIndex('account', 'from', { unique: false });
                    txStore.createIndex('timestamp', 'timestamp', { unique: false });
                    txStore.createIndex('status', 'status', { unique: false });
                    txStore.createIndex('chain', 'chain', { unique: false });
                    console.log('Transactions store created');
                }

                // Ledger entries object store
                if (!db.objectStoreNames.contains('ledger')) {
                    const ledgerStore = db.createObjectStore('ledger', { keyPath: 'id' });
                    ledgerStore.createIndex('account', 'account', { unique: false });
                    ledgerStore.createIndex('action', 'action', { unique: false });
                    ledgerStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Ledger store created');
                }

                // Sync log object store
                if (!db.objectStoreNames.contains('syncLog')) {
                    const syncStore = db.createObjectStore('syncLog', { keyPath: 'id' });
                    syncStore.createIndex('txId', 'txId', { unique: false });
                    syncStore.createIndex('synced', 'synced', { unique: false });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Sync log store created');
                }

                // Pending transactions queue
                if (!db.objectStoreNames.contains('pending')) {
                    const pendingStore = db.createObjectStore('pending', { keyPath: 'id' });
                    pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
                    pendingStore.createIndex('attempt', 'attempt', { unique: false });
                    console.log('Pending transactions store created');
                }
            };
        });
    }

    /**
     * Add transaction to ledger
     * @param {object} tx - Transaction object
     * @returns {string} Transaction ID
     */
    async addTransaction(tx) {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');

            const txRecord = {
                id: tx.id || this.generateId(),
                hash: tx.hash || null,
                from: tx.from,
                to: tx.to,
                type: tx.type, // transfer, stake, unstake, claim
                amount: tx.amount,
                amountBIO: tx.amountBIO || 0,
                usdValue: tx.usdValue || 0,
                chain: tx.chain,
                chainId: tx.chainId,
                status: tx.status || 'pending',
                gas: tx.gas || { gasUsed: 0, gasPrice: '0', gasCost: '0' },
                timestamp: tx.timestamp || Date.now(),
                createdAt: Date.now(),
                syncedAt: null,
                metadata: tx.metadata || {}
            };

            const request = store.add(txRecord);

            request.onerror = () => {
                console.error('Error adding transaction:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log(`Transaction added: ${txRecord.id}`);
                resolve(txRecord.id);
            };
        });
    }

    /**
     * Update transaction status
     * @param {string} txId - Transaction ID
     * @param {object} updates - Fields to update
     */
    async updateTransaction(txId, updates) {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const getRequest = store.get(txId);

            getRequest.onsuccess = () => {
                const tx = getRequest.result;
                if (!tx) {
                    reject(new Error(`Transaction ${txId} not found`));
                    return;
                }

                const updated = { ...tx, ...updates, syncedAt: Date.now() };
                const putRequest = store.put(updated);

                putRequest.onerror = () => {
                    reject(putRequest.error);
                };

                putRequest.onsuccess = () => {
                    console.log(`Transaction updated: ${txId}`);
                    resolve(updated);
                };
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    /**
     * Get transaction by ID
     * @param {string} txId - Transaction ID
     */
    async getTransaction(txId) {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.get(txId);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    }

    /**
     * Get all transactions for account
     * @param {string} account - Account address
     * @param {object} options - Query options
     */
    async getTransactionsByAccount(account, options = {}) {
        const { limit = 100, offset = 0, status = null, chain = null } = options;

        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('account');
            const range = IDBKeyRange.only(account);
            const request = index.getAll(range);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                let results = request.result;

                // Filter by status if provided
                if (status) {
                    results = results.filter(tx => tx.status === status);
                }

                // Filter by chain if provided
                if (chain) {
                    results = results.filter(tx => tx.chain === chain);
                }

                // Sort by timestamp descending
                results.sort((a, b) => b.timestamp - a.timestamp);

                // Apply pagination
                const paginated = results.slice(offset, offset + limit);
                resolve(paginated);
            };
        });
    }

    /**
     * Add ledger entry
     * @param {object} entry - Ledger entry
     */
    async addLedgerEntry(entry) {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['ledger'], 'readwrite');
            const store = transaction.objectStore('ledger');

            const record = {
                id: entry.id || this.generateId(),
                account: entry.account,
                action: entry.action, // analysis, reward, stake, withdrawal
                details: entry.details || {},
                timestamp: entry.timestamp || Date.now()
            };

            const request = store.add(record);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log(`Ledger entry added: ${record.id}`);
                resolve(record.id);
            };
        });
    }

    /**
     * Get ledger entries for account
     * @param {string} account - Account address
     * @param {object} options - Query options
     */
    async getLedgerEntries(account, options = {}) {
        const { limit = 100, offset = 0, action = null } = options;

        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['ledger'], 'readonly');
            const store = transaction.objectStore('ledger');
            const index = store.index('account');
            const range = IDBKeyRange.only(account);
            const request = index.getAll(range);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                let results = request.result;

                // Filter by action if provided
                if (action) {
                    results = results.filter(entry => entry.action === action);
                }

                // Sort by timestamp descending
                results.sort((a, b) => b.timestamp - a.timestamp);

                // Apply pagination
                const paginated = results.slice(offset, offset + limit);
                resolve(paginated);
            };
        });
    }

    /**
     * Add pending transaction (offline queue)
     * @param {object} tx - Transaction to queue
     */
    async addPendingTransaction(tx) {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');

            const record = {
                id: this.generateId(),
                txData: tx,
                timestamp: Date.now(),
                attempt: 0,
                lastError: null
            };

            const request = store.add(record);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log(`Pending transaction queued: ${record.id}`);
                resolve(record.id);
            };
        });
    }

    /**
     * Get all pending transactions
     */
    async getPendingTransactions() {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['pending'], 'readonly');
            const store = transaction.objectStore('pending');
            const request = store.getAll();

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    }

    /**
     * Remove pending transaction
     * @param {string} pendingId - Pending transaction ID
     */
    async removePendingTransaction(pendingId) {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['pending'], 'readwrite');
            const store = transaction.objectStore('pending');
            const request = store.delete(pendingId);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log(`Pending transaction removed: ${pendingId}`);
                resolve();
            };
        });
    }

    /**
     * Get database statistics
     */
    async getStats() {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['transactions', 'ledger', 'pending'], 'readonly');
            
            const txStore = transaction.objectStore('transactions');
            const ledgerStore = transaction.objectStore('ledger');
            const pendingStore = transaction.objectStore('pending');

            const txCount = txStore.count();
            const ledgerCount = ledgerStore.count();
            const pendingCount = pendingStore.count();

            Promise.all([
                new Promise((res) => {
                    txCount.onsuccess = () => res(txCount.result);
                }),
                new Promise((res) => {
                    ledgerCount.onsuccess = () => res(ledgerCount.result);
                }),
                new Promise((res) => {
                    pendingCount.onsuccess = () => res(pendingCount.result);
                })
            ]).then(([txs, ledger, pending]) => {
                resolve({
                    transactions: txs,
                    ledgerEntries: ledger,
                    pendingTransactions: pending,
                    timestamp: Date.now()
                });
            }).catch(reject);
        });
    }

    /**
     * Clear all data (use carefully!)
     */
    async clearAll() {
        return new Promise((resolve, reject) => {
            if (!this.ready) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(
                ['transactions', 'ledger', 'syncLog', 'pending'],
                'readwrite'
            );

            const stores = [
                transaction.objectStore('transactions'),
                transaction.objectStore('ledger'),
                transaction.objectStore('syncLog'),
                transaction.objectStore('pending')
            ];

            stores.forEach(store => store.clear());

            transaction.onerror = () => {
                reject(transaction.error);
            };

            transaction.oncomplete = () => {
                console.log('Database cleared');
                resolve();
            };
        });
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if database is ready
     */
    isReady() {
        return this.ready && this.db !== null;
    }
}

// Create global instance
let ledgerDB = null;

async function initLedgerDatabase(dbName = 'BioWeb3Ledger') {
    ledgerDB = new LedgerDatabase(dbName);
    await ledgerDB.init();
    return ledgerDB;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LedgerDatabase, initLedgerDatabase };
}
