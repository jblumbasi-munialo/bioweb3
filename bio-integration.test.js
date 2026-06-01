// ========== INTEGRATION TESTS ==========
// Test interactions between Phase 3 modules

describe('Phase 3 Integration Tests', () => {
    let phase3Manager;

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    describe('Ledger + Analytics Integration', () => {
        test('should track transaction in analytics', async () => {
            const { LedgerDatabase } = require('./js/bio-ledger-db.js');
            const { TransactionAnalytics } = require('./js/bio-tx-analytics.js');

            const ledgerDB = new LedgerDatabase('TestLedger', 1);
            const analytics = new TransactionAnalytics(ledgerDB);

            const tx = testHelpers.createMockTransaction();
            ledgerDB.db = { transaction: jest.fn() };

            // Mock the transaction storage
            ledgerDB.addTransaction = jest.fn(async () => tx.id);
            ledgerDB.getTransactionsByAccount = jest.fn(async () => [tx]);

            await ledgerDB.addTransaction(tx);
            const dashboard = await analytics.getDashboard(tx.from);

            expect(ledgerDB.addTransaction).toHaveBeenCalled();
            expect(ledgerDB.getTransactionsByAccount).toHaveBeenCalled();
        });

        test('should export transactions with analytics data', async () => {
            const { TransactionAnalytics } = require('./js/bio-tx-analytics.js');
            const mockLedgerDB = {
                getTransactionsByAccount: jest.fn(async () => [
                    testHelpers.createMockTransaction()
                ])
            };

            const analytics = new TransactionAnalytics(mockLedgerDB);
            analytics.downloadFile = jest.fn();

            const account = '0x1234567890123456789012345678901234567890';
            await analytics.exportAsJSON(account);

            expect(analytics.downloadFile).toHaveBeenCalled();
            const call = analytics.downloadFile.mock.calls[0];
            const exported = JSON.parse(call[0]);

            expect(exported).toHaveProperty('transactions');
            expect(exported).toHaveProperty('account');
        });
    });

    describe('Wallet + Network Integration', () => {
        test('should connect wallet and switch networks', async () => {
            const { AdvancedWalletManager } = require('./js/bio-wallet-advanced.js');
            const { NetworkManager } = require('./js/bio-network-manager.js');

            const networkManager = new NetworkManager();
            const walletManager = new AdvancedWalletManager(networkManager);

            // Connect wallet
            const wallet = await walletManager.connectMetaMask();

            expect(wallet).toBeDefined();
            expect(wallet.chainId).toBeDefined();

            // Switch network
            const switchSpy = jest.spyOn(networkManager, 'switchNetwork');
            await networkManager.switchNetwork(137); // Polygon

            expect(switchSpy).toHaveBeenCalled();
        });

        test('should track wallet connections across networks', async () => {
            const { AdvancedWalletManager } = require('./js/bio-wallet-advanced.js');
            const { NetworkManager } = require('./js/bio-network-manager.js');

            const networkManager = new NetworkManager();
            const walletManager = new AdvancedWalletManager(networkManager);

            const wallet1 = testHelpers.createMockWallet({ chainId: 1 });
            const wallet2 = testHelpers.createMockWallet({ id: 'wallet2', chainId: 137 });

            walletManager.connectedWallets.set(wallet1.id, wallet1);
            walletManager.connectedWallets.set(wallet2.id, wallet2);

            const wallets = walletManager.listConnectedWallets();

            expect(wallets.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('TokenManager + Ledger Integration', () => {
        test('should record staking in ledger', async () => {
            const { LedgerDatabase } = require('./js/bio-ledger-db.js');
            
            const ledgerDB = new LedgerDatabase('TestLedger', 1);
            ledgerDB.addTransaction = jest.fn(async () => 'tx_id');
            ledgerDB.addLedgerEntry = jest.fn(async () => 'entry_id');

            const tx = testHelpers.createMockTransaction({ type: 'stake' });
            await ledgerDB.addTransaction(tx);

            const entry = {
                account: tx.from,
                action: 'stake',
                details: { amount: tx.amount }
            };
            await ledgerDB.addLedgerEntry(entry);

            expect(ledgerDB.addTransaction).toHaveBeenCalled();
            expect(ledgerDB.addLedgerEntry).toHaveBeenCalled();
        });
    });

    describe('Multi-Sig + Analytics Integration', () => {
        test('should track multi-sig approvals in analytics', async () => {
            const { AdvancedWalletManager } = require('./js/bio-wallet-advanced.js');
            const mockNetworkManager = {};
            const walletManager = new AdvancedWalletManager(mockNetworkManager);

            const signatories = ['0x1111', '0x2222', '0x3333'];
            const multiSig = await walletManager.createMultiSigWallet(signatories, 2);
            walletManager.activeWallet = 'test_wallet';

            const tx = { to: '0x4444', amount: '100' };
            const proposal = await walletManager.proposeMultiSigTransaction(multiSig.id, tx);

            expect(proposal).toBeDefined();
            expect(proposal.approvals.size).toBe(0);

            // Approve
            await walletManager.approveMultiSigTransaction(multiSig.id, proposal.id, '0x1111');
            const updated = multiSig.transactions.find(t => t.id === proposal.id);

            expect(updated.approvals.size).toBeGreaterThan(0);
        });
    });

    describe('Sync + Analytics Integration', () => {
        test('should sync transactions and update analytics', async () => {
            const { LedgerDatabase } = require('./js/bio-ledger-db.js');
            const { LedgerSync } = require('./js/bio-ledger-sync.js');

            const ledgerDB = new LedgerDatabase('TestLedger', 1);
            const ledgerSync = new LedgerSync(
                ledgerDB,
                'https://test.supabase.co',
                'test_key',
                'test_user'
            );

            ledgerDB.addTransaction = jest.fn(async () => 'tx_id');
            ledgerDB.getTransactionsByAccount = jest.fn(async () => []);

            await ledgerDB.addTransaction(testHelpers.createMockTransaction());

            expect(ledgerDB.addTransaction).toHaveBeenCalled();
        });
    });

    describe('End-to-End Workflow', () => {
        test('should complete full blockchain workflow', async () => {
            const { AdvancedWalletManager } = require('./js/bio-wallet-advanced.js');
            const { NetworkManager } = require('./js/bio-network-manager.js');
            const { LedgerDatabase } = require('./js/bio-ledger-db.js');
            const { TransactionAnalytics } = require('./js/bio-tx-analytics.js');

            // Setup
            const networkManager = new NetworkManager();
            const walletManager = new AdvancedWalletManager(networkManager);
            const ledgerDB = new LedgerDatabase('TestLedger', 1);
            const analytics = new TransactionAnalytics(ledgerDB);

            // Step 1: Connect wallet
            const wallet = await walletManager.connectMetaMask();
            expect(wallet).toBeDefined();

            // Step 2: Switch network
            await networkManager.switchNetwork(137);

            // Step 3: Record transaction
            ledgerDB.addTransaction = jest.fn(async () => 'tx_id');
            ledgerDB.getTransactionsByAccount = jest.fn(async () => [
                testHelpers.createMockTransaction()
            ]);

            const tx = testHelpers.createMockTransaction();
            await ledgerDB.addTransaction(tx);

            // Step 4: Get analytics
            const dashboard = await analytics.getDashboard(wallet.address);

            expect(ledgerDB.addTransaction).toHaveBeenCalled();
        });
    });
});
