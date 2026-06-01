// ========== ADVANCED WALLET MANAGER TESTS ==========

describe('AdvancedWalletManager', () => {
    let walletManager;
    let mockNetworkManager;

    beforeEach(() => {
        jest.clearAllMocks();

        mockNetworkManager = {
            switchNetwork: jest.fn(),
            getProvider: jest.fn(),
            getGasPrice: jest.fn(async () => '50')
        };

        const { AdvancedWalletManager } = require('./js/bio-wallet-advanced.js');
        walletManager = new AdvancedWalletManager(mockNetworkManager);
    });

    describe('MetaMask Connection', () => {
        test('should connect MetaMask wallet', async () => {
            const wallet = await walletManager.connectMetaMask();

            expect(wallet).toBeDefined();
            expect(wallet.type).toBe('metamask');
            expect(wallet.address).toBeDefined();
            expect(wallet.connected).toBe(true);
        });

        test('should set as active wallet', async () => {
            const wallet = await walletManager.connectMetaMask();

            expect(walletManager.activeWallet).toBe(wallet.id);
        });

        test('should add to wallet history', async () => {
            await walletManager.connectMetaMask();

            expect(walletManager.walletHistory.length).toBeGreaterThan(0);
        });

        test('should emit wallet:connected event', async () => {
            const emitSpy = jest.spyOn(walletManager, 'emit');
            
            await walletManager.connectMetaMask();

            expect(emitSpy).toHaveBeenCalledWith('wallet:connected', expect.any(Object));
        });

        test('should handle MetaMask not installed', async () => {
            window.ethereum = undefined;
            
            const wallet = await walletManager.connectMetaMask();

            expect(wallet).toBeNull();
        });
    });

    describe('Wallet Connection Management', () => {
        test('should list connected wallets', async () => {
            await walletManager.connectMetaMask();

            const wallets = walletManager.listConnectedWallets();

            expect(Array.isArray(wallets)).toBe(true);
            expect(wallets.length).toBeGreaterThan(0);
        });

        test('should mark active wallet', async () => {
            await walletManager.connectMetaMask();

            const wallets = walletManager.listConnectedWallets();
            const activeWallet = wallets.find(w => w.isActive);

            expect(activeWallet).toBeDefined();
        });

        test('should switch active wallet', async () => {
            const wallet1 = await walletManager.connectMetaMask();
            const wallet2 = testHelpers.createMockWallet({ id: 'test_wallet_2' });
            walletManager.connectedWallets.set(wallet2.id, wallet2);

            walletManager.setActiveWallet(wallet2.id);

            expect(walletManager.activeWallet).toBe(wallet2.id);
        });

        test('should get active wallet', async () => {
            const wallet = await walletManager.connectMetaMask();

            const active = walletManager.getActiveWallet();

            expect(active).toBeDefined();
            expect(active.id).toBe(wallet.id);
        });

        test('should disconnect wallet', async () => {
            const wallet = await walletManager.connectMetaMask();

            const result = await walletManager.disconnectWallet(wallet.id);

            expect(result).toBe(true);
            expect(walletManager.connectedWallets.has(wallet.id)).toBe(false);
        });

        test('should clear active wallet on disconnect', async () => {
            const wallet = await walletManager.connectMetaMask();

            await walletManager.disconnectWallet(wallet.id);

            expect(walletManager.activeWallet).toBeNull();
        });
    });

    describe('Multi-Sig Wallet', () => {
        test('should create multi-sig wallet', async () => {
            const signatories = [
                '0x1111111111111111111111111111111111111111',
                '0x2222222222222222222222222222222222222222',
                '0x3333333333333333333333333333333333333333'
            ];

            const wallet = await walletManager.createMultiSigWallet(signatories, 2);

            expect(wallet).toBeDefined();
            expect(wallet.type).toBe('multisig');
            expect(wallet.threshold).toBe('2/3');
        });

        test('should require minimum 2 signatories', async () => {
            const wallet = await walletManager.createMultiSigWallet(['0x1111'], 1);

            expect(wallet).toBeNull();
        });

        test('should validate required signatures', async () => {
            const signatories = ['0x1111', '0x2222'];

            const wallet1 = await walletManager.createMultiSigWallet(signatories, 3);
            const wallet2 = await walletManager.createMultiSigWallet(signatories, 0);

            expect(wallet1).toBeNull();
            expect(wallet2).toBeNull();
        });

        test('should propose multi-sig transaction', async () => {
            const signatories = ['0x1111', '0x2222'];
            const multiSig = await walletManager.createMultiSigWallet(signatories, 2);
            walletManager.activeWallet = 'test_wallet';

            const tx = { to: '0x3333', amount: '100' };
            const proposal = await walletManager.proposeMultiSigTransaction(multiSig.id, tx);

            expect(proposal).toBeDefined();
            expect(proposal.tx).toEqual(tx);
            expect(proposal.executed).toBe(false);
        });

        test('should approve multi-sig transaction', async () => {
            const signatories = ['0x1111', '0x2222'];
            const multiSig = await walletManager.createMultiSigWallet(signatories, 2);
            walletManager.activeWallet = 'test_wallet';

            const tx = { to: '0x3333', amount: '100' };
            const proposal = await walletManager.proposeMultiSigTransaction(multiSig.id, tx);

            const approval = await walletManager.approveMultiSigTransaction(multiSig.id, proposal.id, '0x1111');

            expect(approval.approvals.has('0x1111')).toBe(true);
        });

        test('should require valid signatory for approval', async () => {
            const signatories = ['0x1111', '0x2222'];
            const multiSig = await walletManager.createMultiSigWallet(signatories, 2);
            walletManager.activeWallet = 'test_wallet';

            const tx = { to: '0x3333', amount: '100' };
            const proposal = await walletManager.proposeMultiSigTransaction(multiSig.id, tx);

            const approval = await walletManager.approveMultiSigTransaction(multiSig.id, proposal.id, '0x9999');

            expect(approval).toBeNull();
        });

        test('should execute when threshold reached', async () => {
            const signatories = ['0x1111', '0x2222'];
            const multiSig = await walletManager.createMultiSigWallet(signatories, 2);
            walletManager.activeWallet = 'test_wallet';

            const tx = { to: '0x3333', amount: '100' };
            const proposal = await walletManager.proposeMultiSigTransaction(multiSig.id, tx);

            await walletManager.approveMultiSigTransaction(multiSig.id, proposal.id, '0x1111');
            const finalApproval = await walletManager.approveMultiSigTransaction(multiSig.id, proposal.id, '0x2222');

            expect(finalApproval.executed).toBe(true);
        });
    });

    describe('Wallet History', () => {
        test('should track wallet history', async () => {
            await walletManager.connectMetaMask();

            expect(walletManager.walletHistory.length).toBeGreaterThan(0);
        });

        test('should limit history size', async () => {
            for (let i = 0; i < 60; i++) {
                const wallet = testHelpers.createMockWallet({ id: `wallet_${i}` });
                walletManager.connectedWallets.set(wallet.id, wallet);
                walletManager.addToHistory(wallet);
            }

            expect(walletManager.walletHistory.length).toBeLessThanOrEqual(50);
        });

        test('should get wallet history', () => {
            const history = walletManager.getWalletHistory();

            expect(Array.isArray(history)).toBe(true);
        });
    });

    describe('Event Emitter', () => {
        test('should emit events', () => {
            const emitSpy = jest.spyOn(window, 'dispatchEvent');

            walletManager.emit('test:event', { data: 'test' });

            expect(emitSpy).toHaveBeenCalled();
        });

        test('should listen for events', (done) => {
            walletManager.on('test:event', (data) => {
                expect(data).toEqual({ message: 'test' });
                done();
            });

            const event = new CustomEvent('test:event', { detail: { message: 'test' } });
            window.dispatchEvent(event);
        });
    });

    describe('Error Handling', () => {
        test('should emit error event on failed connection', async () => {
            const emitSpy = jest.spyOn(walletManager, 'emit');
            window.ethereum.request.mockRejectedValueOnce(new Error('User rejected'));

            await walletManager.connectMetaMask();

            expect(emitSpy).toHaveBeenCalledWith('wallet:error', expect.any(Error));
        });

        test('should handle disconnection errors', async () => {
            const wallet = testHelpers.createMockWallet();
            walletManager.connectedWallets.set(wallet.id, wallet);

            const result = await walletManager.disconnectWallet('nonexistent');

            expect(result).toBe(false);
        });
    });
});
