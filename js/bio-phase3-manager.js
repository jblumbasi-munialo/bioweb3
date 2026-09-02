// ========== PHASE 3 INTEGRATION MANAGER ==========
// Orchestrates all blockchain components for unified operations

class Phase3Manager {
    /**
     * Initialize Phase 3 System
     * @param {object} options - Configuration options
     */
    constructor(options = {}) {
        this.options = {
            supabaseUrl: options.supabaseUrl || 'https://your-project.supabase.co',
            supabaseKey: options.supabaseKey || 'YOUR_ANON_KEY',
            userId: options.userId || 'guest',
            autoSync: options.autoSync !== false,
            syncInterval: options.syncInterval || 30000,
            ...options
        };

        this.components = new Map();
        this.initialized = false;
        this.loading = false;
    }

    /**
     * Initialize all Phase 3 components
     */
    async init() {
        if (this.initialized || this.loading) {
            return;
        }

        this.loading = true;
        console.log('Initializing Phase 3 components...');

        try {
            // Initialize database layer
            const { LedgerDatabase, initLedgerDatabase } = await this.loadModule('bio-ledger-db.js');
            const ledgerDB = await initLedgerDatabase('BioWeb3Ledger');
            this.components.set('ledgerDB', ledgerDB);

            // Initialize network manager
            const { NetworkManager } = await this.loadModule('bio-network-manager.js');
            const networkManager = new NetworkManager();
            this.components.set('networkManager', networkManager);

            // Initialize token manager
            const { TokenManager } = await this.loadModule('bio-token-manager.js');
            const tokenManager = new TokenManager(null); // null for ContractManager (will be loaded)
            this.components.set('tokenManager', tokenManager);

            // Initialize sync layer
            const { LedgerSync } = await this.loadModule('bio-ledger-sync.js');
            const ledgerSync = new LedgerSync(
                ledgerDB,
                this.options.supabaseUrl,
                this.options.supabaseKey,
                this.options.userId
            );
            
            if (this.options.autoSync) {
                ledgerSync.startSync();
            }
            
            this.components.set('ledgerSync', ledgerSync);

            // Initialize analytics
            const { TransactionAnalytics } = await this.loadModule('bio-tx-analytics.js');
            const analytics = new TransactionAnalytics(ledgerDB);
            this.components.set('analytics', analytics);

            // Initialize wallet manager
            const { AdvancedWalletManager } = await this.loadModule('bio-wallet-advanced.js');
            const walletManager = new AdvancedWalletManager(networkManager);
            this.components.set('walletManager', walletManager);

            // Load existing managers
            if (window.contractManager) {
                this.components.set('contractManager', window.contractManager);
            }

            this.initialized = true;
            this.loading = false;

            console.log('Phase 3 initialization complete');
            this.emit('phase3:ready');

            return this;
        } catch (error) {
            this.loading = false;
            console.error('Phase 3 initialization failed:', error);
            this.emit('phase3:error', error);
            throw error;
        }
    }

    /**
     * Load module dynamically
     */
    async loadModule(moduleName) {
        try {
            const browserExports = {
                'bio-ledger-db.js': ['LedgerDatabase', 'initLedgerDatabase'],
                'bio-network-manager.js': ['NetworkManager'],
                'bio-token-manager.js': ['TokenManager'],
                'bio-ledger-sync.js': ['LedgerSync'],
                'bio-tx-analytics.js': ['TransactionAnalytics'],
                'bio-wallet-advanced.js': ['AdvancedWalletManager']
            };
            const exportedNames = browserExports[moduleName] || [];
            if (exportedNames.every(name => typeof window[name] === 'function')) {
                return Object.fromEntries(exportedNames.map(name => [name, window[name]]));
            }

            // Check if already loaded in window
            const componentName = moduleName.replace(/\.js$/, '');
            if (window[componentName]) {
                return window[componentName];
            }

            // Try to load via dynamic import
            const module = await import(`./${moduleName}`);
            return module;
        } catch (error) {
            console.warn(`Failed to dynamically load ${moduleName}:`, error);
            
            // Fallback: check if script was already loaded
            const componentKey = moduleName.replace(/bio-/, '').replace(/\.js$/, '');
            if (window[componentKey]) {
                return window[componentKey];
            }

            throw error;
        }
    }

    /**
     * Connect wallet and initialize user session
     */
    async connectWallet(walletType = 'metamask') {
        try {
            const walletManager = this.components.get('walletManager');
            
            if (!walletManager) {
                throw new Error('Wallet manager not initialized');
            }

            let wallet;
            switch (walletType) {
                case 'metamask':
                    wallet = await walletManager.connectMetaMask();
                    break;
                case 'walletconnect':
                    wallet = await walletManager.connectWalletConnect(this.options.projectId);
                    break;
                case 'ledger':
                    wallet = await walletManager.connectLedger();
                    break;
                case 'trezor':
                    wallet = await walletManager.connectTrezor();
                    break;
                default:
                    throw new Error(`Unknown wallet type: ${walletType}`);
            }

            if (wallet) {
                this.options.userId = wallet.address;
                console.log(`Connected: ${wallet.type} - ${wallet.address}`);
            }

            return wallet;
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.emit('phase3:walletError', error);
            return null;
        }
    }

    /**
     * Execute stake transaction
     */
    async stake(amount) {
        try {
            const tokenManager = this.components.get('tokenManager');
            const ledgerDB = this.components.get('ledgerDB');
            const wallet = this.getActiveWallet();

            if (!wallet) {
                throw new Error('No wallet connected');
            }

            // Approve tokens
            const approveTx = await tokenManager.approveBIOToken(amount);
            
            if (!approveTx) {
                throw new Error('Approval failed');
            }

            // Record in ledger
            await ledgerDB.addTransaction({
                from: wallet.address,
                to: 'STAKING',
                type: 'stake',
                amount: amount,
                amountBIO: amount,
                chain: 'ethereum',
                chainId: 1,
                status: 'pending',
                timestamp: Date.now()
            });

            // Stake tokens
            const stakeTx = await tokenManager.stakeTokens(amount);
            
            this.emit('phase3:staked', { amount, tx: stakeTx });
            return stakeTx;
        } catch (error) {
            console.error('Staking failed:', error);
            this.emit('phase3:error', error);
            return null;
        }
    }

    /**
     * Claim rewards
     */
    async claimRewards() {
        try {
            const tokenManager = this.components.get('tokenManager');
            const ledgerDB = this.components.get('ledgerDB');
            const wallet = this.getActiveWallet();

            if (!wallet) {
                throw new Error('No wallet connected');
            }

            const rewards = await tokenManager.claimRewards();

            // Record in ledger
            await ledgerDB.addTransaction({
                from: 'STAKING',
                to: wallet.address,
                type: 'claim',
                amount: rewards.amount,
                amountBIO: rewards.amount,
                chain: 'ethereum',
                chainId: 1,
                status: 'confirmed',
                timestamp: Date.now()
            });

            this.emit('phase3:claimed', { rewards });
            return rewards;
        } catch (error) {
            console.error('Claim failed:', error);
            this.emit('phase3:error', error);
            return null;
        }
    }

    /**
     * Get user dashboard
     */
    async getDashboard() {
        try {
            const wallet = this.getActiveWallet();
            
            if (!wallet) {
                return null;
            }

            const [analytics, stats] = await Promise.all([
                this.components.get('analytics')?.getDashboard(wallet.address),
                this.components.get('tokenManager')?.getStakingStats(wallet.address)
            ]);

            return {
                account: wallet.address,
                walletType: wallet.type,
                analytics: analytics,
                staking: stats,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Dashboard generation failed:', error);
            return null;
        }
    }

    /**
     * Get active wallet
     */
    getActiveWallet() {
        const walletManager = this.components.get('walletManager');
        return walletManager?.getActiveWallet();
    }

    /**
     * Export transactions
     */
    async exportTransactions(format = 'csv') {
        try {
            const wallet = this.getActiveWallet();
            
            if (!wallet) {
                throw new Error('No wallet connected');
            }

            const analytics = this.components.get('analytics');
            const filename = `bioweb3_${wallet.address.slice(0, 8)}_${Date.now()}.${format === 'csv' ? 'csv' : 'json'}`;

            if (format === 'csv') {
                await analytics.exportAsCSV(wallet.address, filename);
            } else {
                await analytics.exportAsJSON(wallet.address, filename);
            }

            console.log(`Exported to ${filename}`);
        } catch (error) {
            console.error('Export failed:', error);
        }
    }

    /**
     * Sync data now
     */
    async syncNow() {
        try {
            const ledgerSync = this.components.get('ledgerSync');
            await ledgerSync.syncData();
            console.log('Manual sync completed');
        } catch (error) {
            console.error('Manual sync failed:', error);
        }
    }

    /**
     * Get component
     */
    getComponent(name) {
        return this.components.get(name);
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            components: Array.from(this.components.keys()),
            activeWallet: this.getActiveWallet(),
            syncStatus: this.components.get('ledgerSync')?.getStatus(),
            timestamp: Date.now()
        };
    }

    /**
     * Event emitter
     */
    emit(event, data) {
        const eventObj = new CustomEvent(event, { detail: data });
        window.dispatchEvent(eventObj);
    }

    /**
     * Listen for events
     */
    on(event, callback) {
        window.addEventListener(event, (e) => callback(e.detail));
    }

    /**
     * Cleanup
     */
    destroy() {
        const ledgerSync = this.components.get('ledgerSync');
        if (ledgerSync) {
            ledgerSync.stopSync();
        }

        this.components.clear();
        this.initialized = false;
        console.log('Phase 3 manager destroyed');
    }
}

// Create global instance and auto-initialize
let phase3Manager = null;

async function initPhase3(options = {}) {
    if (!phase3Manager) {
        phase3Manager = new Phase3Manager(options);
        await phase3Manager.init();
    }
    return phase3Manager;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Phase3Manager, initPhase3 };
}

// Auto-initialize on window load if enabled
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        if (!window.phase3Manager) {
            initPhase3().catch(err => {
                console.warn('Auto-initialization skipped:', err.message);
            });
        }
    });
}
