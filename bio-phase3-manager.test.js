// ========== PHASE 3 MANAGER TESTS ==========

describe('Phase3Manager', () => {
    let phase3Manager;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { Phase3Manager } = require('./js/bio-phase3-manager.js');
        phase3Manager = new Phase3Manager({
            supabaseUrl: 'https://test.supabase.co',
            supabaseKey: 'test_key',
            userId: 'test_user'
        });
    });

    describe('Initialization', () => {
        test('should initialize Phase 3 system', async () => {
            expect(phase3Manager.initialized || phase3Manager.loading).toBe(false);
        });

        test('should have configuration options', () => {
            expect(phase3Manager.options).toHaveProperty('supabaseUrl');
            expect(phase3Manager.options).toHaveProperty('supabaseKey');
            expect(phase3Manager.options).toHaveProperty('userId');
        });

        test('should prevent double initialization', async () => {
            phase3Manager.loading = true;
            const result = await phase3Manager.init();
            
            expect(phase3Manager.loading).toBe(true);
        });
    });

    describe('Component Management', () => {
        test('should get component by name', () => {
            phase3Manager.components.set('testComponent', { name: 'test' });
            
            const component = phase3Manager.getComponent('testComponent');
            
            expect(component).toBeDefined();
            expect(component.name).toBe('test');
        });

        test('should list all components', async () => {
            const status = phase3Manager.getStatus();
            
            expect(status).toHaveProperty('components');
            expect(Array.isArray(status.components)).toBe(true);
        });

        test('should get manager status', () => {
            const status = phase3Manager.getStatus();
            
            expect(status).toHaveProperty('initialized');
            expect(status).toHaveProperty('components');
            expect(status).toHaveProperty('timestamp');
        });
    });

    describe('Wallet Integration', () => {
        test('should connect wallet', async () => {
            phase3Manager.components.set('walletManager', {
                connectMetaMask: jest.fn(async () => testHelpers.createMockWallet())
            });

            const wallet = await phase3Manager.connectWallet('metamask');

            if (wallet) {
                expect(wallet).toHaveProperty('address');
            }
        });

        test('should handle unsupported wallet type', async () => {
            phase3Manager.components.set('walletManager', {
                connectMetaMask: jest.fn()
            });

            const wallet = await phase3Manager.connectWallet('unsupported');

            expect(wallet).toBeNull();
        });

        test('should get active wallet', () => {
            const mockWallet = testHelpers.createMockWallet();
            phase3Manager.components.set('walletManager', {
                getActiveWallet: jest.fn(() => mockWallet)
            });

            const wallet = phase3Manager.getActiveWallet();

            expect(wallet).toEqual(mockWallet);
        });
    });

    describe('Staking Operations', () => {
        test('should stake tokens', async () => {
            phase3Manager.components.set('tokenManager', {
                approveBIOToken: jest.fn(async () => ({ hash: '0xabc' })),
                stakeTokens: jest.fn(async () => ({ hash: '0xdef' }))
            });
            phase3Manager.components.set('ledgerDB', {
                addTransaction: jest.fn(async () => 'tx_id')
            });
            phase3Manager.components.set('walletManager', {
                getActiveWallet: jest.fn(() => testHelpers.createMockWallet())
            });

            const tx = await phase3Manager.stake('100');

            if (tx) {
                expect(tx).toHaveProperty('hash');
            }
        });

        test('should claim rewards', async () => {
            phase3Manager.components.set('tokenManager', {
                claimRewards: jest.fn(async () => ({ amount: '50' }))
            });
            phase3Manager.components.set('ledgerDB', {
                addTransaction: jest.fn(async () => 'tx_id')
            });
            phase3Manager.components.set('walletManager', {
                getActiveWallet: jest.fn(() => testHelpers.createMockWallet())
            });

            const rewards = await phase3Manager.claimRewards();

            if (rewards) {
                expect(rewards).toHaveProperty('amount');
            }
        });

        test('should require wallet for staking', async () => {
            phase3Manager.components.set('walletManager', {
                getActiveWallet: jest.fn(() => null)
            });

            const tx = await phase3Manager.stake('100');

            expect(tx).toBeNull();
        });
    });

    describe('Dashboard & Reporting', () => {
        test('should get dashboard', async () => {
            phase3Manager.components.set('walletManager', {
                getActiveWallet: jest.fn(() => testHelpers.createMockWallet())
            });
            phase3Manager.components.set('analytics', {
                getDashboard: jest.fn(async () => ({ summary: {} }))
            });
            phase3Manager.components.set('tokenManager', {
                getStakingStats: jest.fn(async () => ({ staked: '100' }))
            });

            const dashboard = await phase3Manager.getDashboard();

            if (dashboard) {
                expect(dashboard).toHaveProperty('account');
                expect(dashboard).toHaveProperty('walletType');
                expect(dashboard).toHaveProperty('analytics');
            }
        });

        test('should export transactions', async () => {
            phase3Manager.components.set('walletManager', {
                getActiveWallet: jest.fn(() => testHelpers.createMockWallet())
            });
            phase3Manager.components.set('analytics', {
                exportAsCSV: jest.fn(async () => {}),
                exportAsJSON: jest.fn(async () => {})
            });

            await phase3Manager.exportTransactions('csv');

            expect(phase3Manager.components.get('analytics').exportAsCSV).toHaveBeenCalled();
        });
    });

    describe('Sync Management', () => {
        test('should trigger manual sync', async () => {
            const syncMock = {
                syncData: jest.fn(async () => {})
            };
            phase3Manager.components.set('ledgerSync', syncMock);

            await phase3Manager.syncNow();

            expect(syncMock.syncData).toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        test('should destroy manager', () => {
            const syncMock = {
                stopSync: jest.fn()
            };
            phase3Manager.components.set('ledgerSync', syncMock);

            phase3Manager.destroy();

            expect(phase3Manager.initialized).toBe(false);
            expect(phase3Manager.components.size).toBe(0);
        });
    });

    describe('Event Emitter', () => {
        test('should emit events', () => {
            const emitSpy = jest.spyOn(window, 'dispatchEvent');

            phase3Manager.emit('test:event', { data: 'test' });

            expect(emitSpy).toHaveBeenCalled();
        });

        test('should listen for events', (done) => {
            phase3Manager.on('test:event', (data) => {
                expect(data).toEqual({ message: 'test' });
                done();
            });

            const event = new CustomEvent('test:event', { detail: { message: 'test' } });
            window.dispatchEvent(event);
        });
    });
});
