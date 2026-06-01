// ========== LEDGER DATABASE TESTS ==========

describe('LedgerDatabase', () => {
    let ledgerDB;

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Import and create instance
        const { LedgerDatabase } = require('./js/bio-ledger-db.js');
        ledgerDB = new LedgerDatabase('TestLedger', 1);
        await ledgerDB.init();
    });

    afterEach(() => {
        if (ledgerDB) {
            ledgerDB.db = null;
            ledgerDB.ready = false;
        }
    });

    describe('Initialization', () => {
        test('should initialize database successfully', async () => {
            expect(ledgerDB.isReady()).toBe(true);
            expect(ledgerDB.db).not.toBeNull();
        });

        test('should have correct database name', () => {
            expect(ledgerDB.dbName).toBe('TestLedger');
        });

        test('should have correct version', () => {
            expect(ledgerDB.version).toBe(1);
        });
    });

    describe('Transaction Management', () => {
        test('should add transaction successfully', async () => {
            const tx = testHelpers.createMockTransaction();
            const txId = await ledgerDB.addTransaction(tx);

            expect(txId).toBeDefined();
            expect(txId).toContain('tx_');
        });

        test('should generate unique IDs', async () => {
            const tx1 = testHelpers.createMockTransaction();
            const tx2 = testHelpers.createMockTransaction();

            const id1 = await ledgerDB.addTransaction(tx1);
            const id2 = await ledgerDB.addTransaction(tx2);

            expect(id1).not.toBe(id2);
        });

        test('should include all required fields', async () => {
            const tx = testHelpers.createMockTransaction();
            await ledgerDB.addTransaction(tx);

            const stored = await ledgerDB.getTransaction(tx.id);
            expect(stored).toHaveProperty('from');
            expect(stored).toHaveProperty('to');
            expect(stored).toHaveProperty('type');
            expect(stored).toHaveProperty('amount');
            expect(stored).toHaveProperty('status');
        });

        test('should update transaction status', async () => {
            const tx = testHelpers.createMockTransaction({ status: 'pending' });
            const txId = await ledgerDB.addTransaction(tx);

            const updated = await ledgerDB.updateTransaction(txId, {
                status: 'confirmed',
                hash: '0xabcd'
            });

            expect(updated.status).toBe('confirmed');
            expect(updated.hash).toBe('0xabcd');
        });

        test('should retrieve transaction by ID', async () => {
            const tx = testHelpers.createMockTransaction();
            await ledgerDB.addTransaction(tx);

            const retrieved = await ledgerDB.getTransaction(tx.id);
            expect(retrieved).toBeDefined();
            expect(retrieved.from).toBe(tx.from);
        });

        test('should get transactions by account', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const tx1 = testHelpers.createMockTransaction({ from: account });
            const tx2 = testHelpers.createMockTransaction({ from: account });
            const tx3 = testHelpers.createMockTransaction({ from: '0xOtherAccount' });

            await ledgerDB.addTransaction(tx1);
            await ledgerDB.addTransaction(tx2);
            await ledgerDB.addTransaction(tx3);

            const results = await ledgerDB.getTransactionsByAccount(account);
            expect(results.length).toBeGreaterThanOrEqual(2);
        });

        test('should filter by status', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const tx1 = testHelpers.createMockTransaction({ from: account, status: 'confirmed' });
            const tx2 = testHelpers.createMockTransaction({ from: account, status: 'pending' });

            await ledgerDB.addTransaction(tx1);
            await ledgerDB.addTransaction(tx2);

            const confirmed = await ledgerDB.getTransactionsByAccount(account, { status: 'confirmed' });
            expect(confirmed.length).toBeGreaterThanOrEqual(1);
        });

        test('should filter by chain', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const tx1 = testHelpers.createMockTransaction({ from: account, chain: 'ethereum' });
            const tx2 = testHelpers.createMockTransaction({ from: account, chain: 'polygon' });

            await ledgerDB.addTransaction(tx1);
            await ledgerDB.addTransaction(tx2);

            const ethTxs = await ledgerDB.getTransactionsByAccount(account, { chain: 'ethereum' });
            expect(ethTxs.length).toBeGreaterThanOrEqual(1);
        });

        test('should apply pagination', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            for (let i = 0; i < 15; i++) {
                await ledgerDB.addTransaction(testHelpers.createMockTransaction({ from: account }));
            }

            const page1 = await ledgerDB.getTransactionsByAccount(account, { limit: 5, offset: 0 });
            const page2 = await ledgerDB.getTransactionsByAccount(account, { limit: 5, offset: 5 });

            expect(page1.length).toBeLessThanOrEqual(5);
            expect(page2.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Ledger Entries', () => {
        test('should add ledger entry', async () => {
            const entry = {
                account: '0x1234567890123456789012345678901234567890',
                action: 'stake',
                details: { amount: '100' }
            };

            const entryId = await ledgerDB.addLedgerEntry(entry);
            expect(entryId).toBeDefined();
        });

        test('should retrieve ledger entries by account', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const entry = {
                account: account,
                action: 'reward',
                details: { amount: '50' }
            };

            await ledgerDB.addLedgerEntry(entry);
            const results = await ledgerDB.getLedgerEntries(account);

            expect(Array.isArray(results)).toBe(true);
        });

        test('should filter ledger by action', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const entry1 = { account, action: 'stake', details: {} };
            const entry2 = { account, action: 'reward', details: {} };

            await ledgerDB.addLedgerEntry(entry1);
            await ledgerDB.addLedgerEntry(entry2);

            const stakes = await ledgerDB.getLedgerEntries(account, { action: 'stake' });
            expect(stakes.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Pending Transactions', () => {
        test('should queue pending transaction', async () => {
            const tx = testHelpers.createMockTransaction();
            const pendingId = await ledgerDB.addPendingTransaction(tx);

            expect(pendingId).toBeDefined();
        });

        test('should retrieve all pending transactions', async () => {
            const tx1 = testHelpers.createMockTransaction();
            const tx2 = testHelpers.createMockTransaction();

            await ledgerDB.addPendingTransaction(tx1);
            await ledgerDB.addPendingTransaction(tx2);

            const pending = await ledgerDB.getPendingTransactions();
            expect(Array.isArray(pending)).toBe(true);
            expect(pending.length).toBeGreaterThanOrEqual(2);
        });

        test('should remove pending transaction', async () => {
            const tx = testHelpers.createMockTransaction();
            const pendingId = await ledgerDB.addPendingTransaction(tx);

            await ledgerDB.removePendingTransaction(pendingId);

            const pending = await ledgerDB.getPendingTransactions();
            const found = pending.find(p => p.id === pendingId);
            expect(found).toBeUndefined();
        });
    });

    describe('Statistics', () => {
        test('should get database statistics', async () => {
            const tx = testHelpers.createMockTransaction();
            await ledgerDB.addTransaction(tx);

            const stats = await ledgerDB.getStats();
            expect(stats).toHaveProperty('transactions');
            expect(stats).toHaveProperty('ledgerEntries');
            expect(stats).toHaveProperty('pendingTransactions');
        });

        test('should include timestamp in stats', async () => {
            const stats = await ledgerDB.getStats();
            expect(stats.timestamp).toBeDefined();
            expect(stats.timestamp).toBeGreaterThan(0);
        });
    });

    describe('Utilities', () => {
        test('should generate unique IDs', () => {
            const id1 = ledgerDB.generateId();
            const id2 = ledgerDB.generateId();

            expect(id1).not.toBe(id2);
            expect(id1).toContain('tx_');
            expect(id2).toContain('tx_');
        });

        test('should check readiness status', () => {
            expect(ledgerDB.isReady()).toBe(true);
        });

        test('should clear all data', async () => {
            const tx = testHelpers.createMockTransaction();
            await ledgerDB.addTransaction(tx);

            await ledgerDB.clearAll();

            const stats = await ledgerDB.getStats();
            expect(stats.transactions).toBe(0);
        });
    });
});
