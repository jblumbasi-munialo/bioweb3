// ========== PERSISTENT LEDGER SYNC (Cloud Sync with Supabase) ==========
// Sync IndexedDB data to cloud with conflict resolution and offline support

class LedgerSync {
    /**
     * Initialize Ledger Sync
     * @param {object} ledgerDB - LedgerDatabase instance
     * @param {string} supabaseUrl - Supabase project URL
     * @param {string} supabaseKey - Supabase public anon key
     * @param {string} userId - Current user ID
     */
    constructor(ledgerDB, supabaseUrl, supabaseKey, userId) {
        this.ledgerDB = ledgerDB;
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.userId = userId;
        this.syncInProgress = false;
        this.lastSyncTime = 0;
        this.syncInterval = 30000; // 30 seconds
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Start continuous sync
     */
    startSync() {
        if (this.syncTimer) clearInterval(this.syncTimer);
        
        this.syncTimer = setInterval(() => {
            this.syncData().catch(err => {
                console.warn('Sync error:', err);
            });
        }, this.syncInterval);

        console.log('Ledger sync started');
    }

    /**
     * Stop continuous sync
     */
    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        console.log('Ledger sync stopped');
    }

    /**
     * Perform sync operation
     */
    async syncData() {
        if (this.syncInProgress || !navigator.onLine) {
            return;
        }

        this.syncInProgress = true;

        try {
            // Get pending transactions
            const pending = await this.ledgerDB.getPendingTransactions();
            
            if (pending.length > 0) {
                await this.syncPendingTransactions(pending);
            }

            // Get unsynced transactions
            const unsynced = await this.getUnsyncedTransactions();
            
            if (unsynced.length > 0) {
                await this.uploadTransactions(unsynced);
            }

            this.lastSyncTime = Date.now();
            this.emit('sync:success');
            console.log('Ledger sync completed');
        } catch (error) {
            console.error('Sync failed:', error);
            this.emit('sync:error', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync pending transactions (retry logic)
     */
    async syncPendingTransactions(pending) {
        for (const item of pending) {
            for (let attempt = 0; attempt < this.maxRetries; attempt++) {
                try {
                    const result = await this.submitTransaction(item.txData);
                    
                    if (result.success) {
                        // Add to ledger and remove from pending
                        const txRecord = await this.ledgerDB.addTransaction({
                            ...item.txData,
                            hash: result.hash,
                            status: 'confirmed'
                        });

                        await this.ledgerDB.removePendingTransaction(item.id);
                        console.log(`Pending transaction synced: ${item.id}`);
                        break;
                    }
                } catch (error) {
                    console.warn(`Transaction attempt ${attempt + 1} failed:`, error);
                    
                    if (attempt < this.maxRetries - 1) {
                        await this.delay(this.retryDelay * (attempt + 1));
                    }
                }
            }
        }
    }

    /**
     * Get unsynced transactions from IndexedDB
     */
    async getUnsyncedTransactions() {
        return new Promise((resolve, reject) => {
            if (!this.ledgerDB.isReady()) {
                reject(new Error('Database not ready'));
                return;
            }

            const transaction = this.ledgerDB.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                const unsynced = request.result.filter(tx => !tx.syncedAt);
                resolve(unsynced);
            };
        });
    }

    /**
     * Upload transactions to Supabase
     */
    async uploadTransactions(transactions) {
        const chunks = this.chunkArray(transactions, 10);

        for (const chunk of chunks) {
            try {
                const payload = chunk.map(tx => ({
                    user_id: this.userId,
                    tx_id: tx.id,
                    tx_hash: tx.hash,
                    from_address: tx.from,
                    to_address: tx.to,
                    type: tx.type,
                    amount: tx.amount,
                    amount_bio: tx.amountBIO,
                    usd_value: tx.usdValue,
                    chain: tx.chain,
                    chain_id: tx.chainId,
                    status: tx.status,
                    gas_used: tx.gas?.gasUsed || 0,
                    gas_price: tx.gas?.gasPrice || '0',
                    gas_cost: tx.gas?.gasCost || '0',
                    timestamp: new Date(tx.timestamp).toISOString(),
                    created_at: new Date(tx.createdAt).toISOString(),
                    metadata: tx.metadata
                }));

                await this.insertToSupabase('transactions', payload);

                // Mark as synced in local DB
                for (const tx of chunk) {
                    await this.ledgerDB.updateTransaction(tx.id, { syncedAt: Date.now() });
                }

                console.log(`Uploaded ${chunk.length} transactions`);
            } catch (error) {
                console.error('Upload failed:', error);
                throw error;
            }
        }
    }

    /**
     * Submit single transaction
     */
    async submitTransaction(txData) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/submit_transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({
                    p_user_id: this.userId,
                    p_tx_data: txData
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`RPC call failed: ${error}`);
            }

            const result = await response.json();
            return {
                success: result.success,
                hash: result.tx_hash
            };
        } catch (error) {
            console.error('Transaction submission error:', error);
            throw error;
        }
    }

    /**
     * Insert data to Supabase
     */
    async insertToSupabase(table, data) {
        try {
            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/${table}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal',
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    },
                    body: JSON.stringify(data)
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Insert failed: ${error}`);
            }

            console.log(`Inserted to ${table}`);
            return true;
        } catch (error) {
            console.error(`Insert to ${table} failed:`, error);
            throw error;
        }
    }

    /**
     * Fetch transactions from Supabase
     */
    async fetchTransactionsFromCloud(account, limit = 100) {
        try {
            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/transactions?user_id=eq.${this.userId}&from_address=eq.${account}&limit=${limit}&order=created_at.desc`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Fetch failed');
            }

            const transactions = await response.json();
            return transactions;
        } catch (error) {
            console.error('Fetch from cloud failed:', error);
            return [];
        }
    }

    /**
     * Fetch ledger entries from cloud
     */
    async fetchLedgerFromCloud(account) {
        try {
            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/ledger?user_id=eq.${this.userId}&account=eq.${account}&order=created_at.desc`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Fetch failed');
            }

            const entries = await response.json();
            return entries;
        } catch (error) {
            console.error('Fetch ledger failed:', error);
            return [];
        }
    }

    /**
     * Merge cloud data with local data (conflict resolution)
     */
    async mergeWithCloud(account) {
        try {
            const cloudTxs = await this.fetchTransactionsFromCloud(account);
            const localTxs = await this.ledgerDB.getTransactionsByAccount(account, {
                limit: 1000
            });

            // Last-write-wins strategy
            const merged = new Map();

            // Add cloud transactions
            cloudTxs.forEach(tx => {
                merged.set(tx.tx_id, {
                    ...tx,
                    timestamp: new Date(tx.timestamp).getTime(),
                    source: 'cloud'
                });
            });

            // Merge local transactions
            localTxs.forEach(tx => {
                if (!merged.has(tx.id) || tx.syncedAt > merged.get(tx.id).syncedAt) {
                    merged.set(tx.id, tx);
                }
            });

            return Array.from(merged.values());
        } catch (error) {
            console.error('Merge failed:', error);
            return [];
        }
    }

    /**
     * Event emitter
     */
    emit(event, data) {
        const event_obj = new CustomEvent(event, { detail: data });
        window.dispatchEvent(event_obj);
    }

    /**
     * Listen for events
     */
    on(event, callback) {
        window.addEventListener(event, (e) => callback(e.detail));
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Chunk array helper
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Get sync status
     */
    getStatus() {
        return {
            syncing: this.syncInProgress,
            online: navigator.onLine,
            lastSyncTime: this.lastSyncTime,
            syncInterval: this.syncInterval
        };
    }
}

window.LedgerSync = LedgerSync;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LedgerSync };
}
