// ========== ADVANCED WALLET MANAGEMENT ==========
// Multi-wallet support: MetaMask, WalletConnect, Hardware wallets

class AdvancedWalletManager {
    /**
     * Initialize Advanced Wallet Manager
     * @param {object} networkManager - NetworkManager instance
     */
    constructor(networkManager) {
        this.networkManager = networkManager;
        this.connectedWallets = new Map();
        this.activeWallet = null;
        this.walletHistory = [];
    }

    /**
     * Connect MetaMask wallet
     */
    async connectMetaMask() {
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask not installed');
            }

            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            const account = accounts[0];
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });

            const wallet = {
                id: `metamask_${account}`,
                type: 'metamask',
                address: account,
                chainId: parseInt(chainId, 16),
                connected: true,
                connectedAt: Date.now(),
                balance: '0'
            };

            this.connectedWallets.set(wallet.id, wallet);
            this.setActiveWallet(wallet.id);
            this.addToHistory(wallet);

            console.log(`MetaMask connected: ${account}`);
            this.emit('wallet:connected', wallet);

            return wallet;
        } catch (error) {
            console.error('MetaMask connection failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Connect WalletConnect
     */
    async connectWalletConnect(projectId = 'YOUR_PROJECT_ID') {
        try {
            // WalletConnect v2 implementation
            if (!window.WalletConnect) {
                throw new Error('WalletConnect library not loaded. Add to index.html: <script src="https://cdn.jsdelivr.net/npm/@walletconnect/web3@0.0.0-alpha.1/dist/web3.min.js"></script>');
            }

            const connector = new window.WalletConnect({ projectId });

            // Create session
            const session = await connector.connect();

            if (!session) {
                throw new Error('WalletConnect session creation failed');
            }

            const account = session.namespaces.eip155.accounts[0].split(':')[2];
            const chainId = parseInt(session.namespaces.eip155.accounts[0].split(':')[1]);

            const wallet = {
                id: `walletconnect_${account}`,
                type: 'walletconnect',
                address: account,
                chainId: chainId,
                connected: true,
                connectedAt: Date.now(),
                sessionId: session.topic,
                connector: connector,
                balance: '0'
            };

            this.connectedWallets.set(wallet.id, wallet);
            this.setActiveWallet(wallet.id);
            this.addToHistory(wallet);

            console.log(`WalletConnect connected: ${account}`);
            this.emit('wallet:connected', wallet);

            return wallet;
        } catch (error) {
            console.error('WalletConnect connection failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Connect Hardware Wallet (Ledger)
     */
    async connectLedger(derivationPath = "m/44'/60'/0'/0") {
        try {
            if (!window.LedgerEthereumProvider) {
                throw new Error('Ledger provider not loaded. Add: <script src="https://cdn.jsdelivr.net/npm/@ledgerhq/web3-subprovider@5.0.2/dist/index.min.js"></script>');
            }

            const ledgerProvider = new window.LedgerEthereumProvider({
                derivationPath: derivationPath,
                accountsLength: 5
            });

            const accounts = await ledgerProvider.getAccounts();
            
            if (!accounts || accounts.length === 0) {
                throw new Error('No Ledger accounts found');
            }

            const account = accounts[0];
            const chainId = await ledgerProvider.request({ method: 'eth_chainId' });

            const wallet = {
                id: `ledger_${account}`,
                type: 'ledger',
                address: account,
                chainId: parseInt(chainId, 16),
                derivationPath: derivationPath,
                accounts: accounts,
                connected: true,
                connectedAt: Date.now(),
                provider: ledgerProvider,
                balance: '0'
            };

            this.connectedWallets.set(wallet.id, wallet);
            this.setActiveWallet(wallet.id);
            this.addToHistory(wallet);

            console.log(`Ledger connected: ${account}`);
            this.emit('wallet:connected', wallet);

            return wallet;
        } catch (error) {
            console.error('Ledger connection failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Connect Hardware Wallet (Trezor)
     */
    async connectTrezor(derivationPath = "m/44'/60'/0'/0") {
        try {
            if (!window.TrezorConnect) {
                throw new Error('TrezorConnect library not loaded. Add: <script src="https://connect.trezor.io/8/trezor-connect.js"></script>');
            }

            // Initialize TrezorConnect
            window.TrezorConnect.init({
                lazyLoad: true,
                manifest: {
                    email: 'info@bioweb3.io',
                    appUrl: window.location.origin
                }
            });

            // Get public key
            const response = await window.TrezorConnect.ethereumGetPublicKey({
                path: derivationPath
            });

            if (!response.success) {
                throw new Error(`Trezor error: ${response.payload.error}`);
            }

            // Get address
            const addressResponse = await window.TrezorConnect.ethereumGetAddress({
                path: derivationPath
            });

            if (!addressResponse.success) {
                throw new Error('Failed to get Trezor address');
            }

            const account = addressResponse.payload.address;
            const chainId = 1; // Default to Ethereum mainnet

            const wallet = {
                id: `trezor_${account}`,
                type: 'trezor',
                address: account,
                chainId: chainId,
                derivationPath: derivationPath,
                publicKey: response.payload.publicKey,
                connected: true,
                connectedAt: Date.now(),
                balance: '0'
            };

            this.connectedWallets.set(wallet.id, wallet);
            this.setActiveWallet(wallet.id);
            this.addToHistory(wallet);

            console.log(`Trezor connected: ${account}`);
            this.emit('wallet:connected', wallet);

            return wallet;
        } catch (error) {
            console.error('Trezor connection failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Create Multi-Sig Wallet
     */
    async createMultiSigWallet(signatories, requiredSignatures) {
        try {
            if (signatories.length < 2) {
                throw new Error('Multi-sig requires at least 2 signatories');
            }

            if (requiredSignatures < 1 || requiredSignatures > signatories.length) {
                throw new Error('Invalid required signatures count');
            }

            const wallet = {
                id: `multisig_${Date.now()}`,
                type: 'multisig',
                signatories: signatories,
                requiredSignatures: requiredSignatures,
                threshold: `${requiredSignatures}/${signatories.length}`,
                connectedAt: Date.now(),
                transactions: [],
                approvals: new Map(),
                balance: '0'
            };

            this.connectedWallets.set(wallet.id, wallet);
            console.log(`Multi-sig wallet created: ${wallet.id}`);
            this.emit('multisig:created', wallet);

            return wallet;
        } catch (error) {
            console.error('Multi-sig creation failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Propose multi-sig transaction
     */
    async proposeMultiSigTransaction(multiSigId, tx) {
        try {
            const wallet = this.connectedWallets.get(multiSigId);
            
            if (!wallet || wallet.type !== 'multisig') {
                throw new Error('Invalid multi-sig wallet');
            }

            const proposal = {
                id: `proposal_${Date.now()}`,
                tx: tx,
                proposedAt: Date.now(),
                proposedBy: this.activeWallet,
                approvals: new Map(),
                executed: false
            };

            wallet.transactions.push(proposal);
            console.log(`Transaction proposed: ${proposal.id}`);
            this.emit('multisig:proposed', proposal);

            return proposal;
        } catch (error) {
            console.error('Proposal failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Approve multi-sig transaction
     */
    async approveMultiSigTransaction(multiSigId, proposalId, approver) {
        try {
            const wallet = this.connectedWallets.get(multiSigId);
            
            if (!wallet || wallet.type !== 'multisig') {
                throw new Error('Invalid multi-sig wallet');
            }

            const proposal = wallet.transactions.find(t => t.id === proposalId);
            
            if (!proposal) {
                throw new Error('Proposal not found');
            }

            if (proposal.executed) {
                throw new Error('Transaction already executed');
            }

            if (!wallet.signatories.includes(approver)) {
                throw new Error('Not a valid signatory');
            }

            proposal.approvals.set(approver, {
                approvedAt: Date.now(),
                signature: this.generateSignature()
            });

            console.log(`Approval added: ${approver}`);
            this.emit('multisig:approved', { proposalId, approver });

            // Check if threshold reached
            if (proposal.approvals.size >= wallet.requiredSignatures) {
                await this.executeMultiSigTransaction(multiSigId, proposalId);
            }

            return proposal;
        } catch (error) {
            console.error('Approval failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Execute multi-sig transaction
     */
    async executeMultiSigTransaction(multiSigId, proposalId) {
        try {
            const wallet = this.connectedWallets.get(multiSigId);
            const proposal = wallet.transactions.find(t => t.id === proposalId);

            if (!proposal || proposal.executed) {
                throw new Error('Cannot execute transaction');
            }

            // Simulate execution
            proposal.executed = true;
            proposal.executedAt = Date.now();

            console.log(`Multi-sig transaction executed: ${proposalId}`);
            this.emit('multisig:executed', proposal);

            return proposal;
        } catch (error) {
            console.error('Execution failed:', error);
            this.emit('wallet:error', error);
            return null;
        }
    }

    /**
     * Set active wallet
     */
    setActiveWallet(walletId) {
        const wallet = this.connectedWallets.get(walletId);
        
        if (!wallet) {
            console.error('Wallet not found');
            return false;
        }

        this.activeWallet = walletId;
        console.log(`Active wallet switched to: ${walletId}`);
        this.emit('wallet:switched', wallet);

        return true;
    }

    /**
     * Get active wallet
     */
    getActiveWallet() {
        if (!this.activeWallet) {
            return null;
        }
        return this.connectedWallets.get(this.activeWallet);
    }

    /**
     * List connected wallets
     */
    listConnectedWallets() {
        return Array.from(this.connectedWallets.values()).map(w => ({
            id: w.id,
            type: w.type,
            address: w.address,
            chainId: w.chainId,
            connected: w.connected,
            isActive: w.id === this.activeWallet
        }));
    }

    /**
     * Disconnect wallet
     */
    async disconnectWallet(walletId) {
        try {
            const wallet = this.connectedWallets.get(walletId);
            
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            // Cleanup
            if (wallet.type === 'walletconnect' && wallet.connector) {
                await wallet.connector.disconnect();
            }

            this.connectedWallets.delete(walletId);

            if (this.activeWallet === walletId) {
                this.activeWallet = null;
            }

            console.log(`Wallet disconnected: ${walletId}`);
            this.emit('wallet:disconnected', wallet);

            return true;
        } catch (error) {
            console.error('Disconnect failed:', error);
            this.emit('wallet:error', error);
            return false;
        }
    }

    /**
     * Add to wallet history
     */
    addToHistory(wallet) {
        this.walletHistory.push({
            wallet: wallet.id,
            address: wallet.address,
            type: wallet.type,
            timestamp: Date.now()
        });

        // Keep last 50 entries
        if (this.walletHistory.length > 50) {
            this.walletHistory.shift();
        }
    }

    /**
     * Get wallet history
     */
    getWalletHistory() {
        return this.walletHistory;
    }

    /**
     * Generate signature (placeholder)
     */
    generateSignature() {
        return `0x${Math.random().toString(16).slice(2)}`;
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
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedWalletManager };
}
