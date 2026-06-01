// ========== BLOCKCHAIN NETWORK MANAGER ==========
// Handles multi-chain support: network detection, switching, RPC management

class NetworkManager {
    /**
     * Initialize NetworkManager
     */
    constructor() {
        this.currentChainId = null;
        this.currentNetworkName = null;
        this.supportedNetworks = getSupportedNetworks();
        this.rpcProviders = new Map();
        this.ethersProviders = new Map();
    }

    /**
     * Initialize and detect current network from MetaMask
     */
    async detectNetwork() {
        try {
            if (typeof window.ethereum === 'undefined') {
                console.warn('MetaMask not available');
                return null;
            }

            // Get current chain ID
            const chainIdHex = await window.ethereum.request({
                method: 'eth_chainId'
            });
            const chainId = parseInt(chainIdHex, 16);
            
            this.currentChainId = chainId;
            this.currentNetworkName = this.getNetworkName(chainId);
            
            console.log(`Detected network: ${this.currentNetworkName} (${chainId})`);
            return {
                chainId,
                name: this.currentNetworkName
            };
        } catch (err) {
            console.error('Error detecting network:', err);
            return null;
        }
    }

    /**
     * Get network name from chain ID
     * @param {number} chainId - Chain ID
     * @returns {string} Network name
     */
    getNetworkName(chainId) {
        const network = this.supportedNetworks.find(n => n.chainId === chainId);
        return network ? network.name : `Unknown (${chainId})`;
    }

    /**
     * Get network info
     * @param {number} chainId - Chain ID
     * @returns {object} Network information
     */
    getNetworkInfo(chainId) {
        return getNetworkInfo(chainId);
    }

    /**
     * Check if network is supported
     * @param {number} chainId - Chain ID
     * @returns {boolean} True if supported
     */
    isNetworkSupported(chainId) {
        return this.supportedNetworks.some(n => n.chainId === chainId);
    }

    /**
     * Get all supported networks
     * @returns {array} Supported networks
     */
    getAllNetworks() {
        return this.supportedNetworks;
    }

    /**
     * Get mainnet networks
     * @returns {array} Mainnet networks
     */
    getMainnetworks() {
        return this.supportedNetworks.filter(n => n.mainnet);
    }

    /**
     * Get testnet networks
     * @returns {array} Testnet networks
     */
    getTestnetworks() {
        return this.supportedNetworks.filter(n => n.testnet);
    }

    /**
     * Request network switch from MetaMask
     * @param {number} chainId - Target chain ID
     * @returns {boolean} Success
     */
    async switchNetwork(chainId) {
        try {
            if (typeof window.ethereum === 'undefined') {
                throw new Error('MetaMask not available');
            }

            if (!this.isNetworkSupported(chainId)) {
                throw new Error(`Network ${chainId} is not supported`);
            }

            const chainIdHex = `0x${chainId.toString(16)}`;

            try {
                // Try to switch
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chainIdHex }]
                });
            } catch (err) {
                // If network not added, add it
                if (err.code === 4902) {
                    await this.addNetwork(chainId);
                } else {
                    throw err;
                }
            }

            this.currentChainId = chainId;
            this.currentNetworkName = this.getNetworkName(chainId);
            console.log(`Switched to network: ${this.currentNetworkName}`);
            return true;
        } catch (err) {
            console.error(`Error switching network to ${chainId}:`, err);
            return false;
        }
    }

    /**
     * Add network to MetaMask
     * @param {number} chainId - Chain ID to add
     * @returns {boolean} Success
     */
    async addNetwork(chainId) {
        try {
            if (typeof window.ethereum === 'undefined') {
                throw new Error('MetaMask not available');
            }

            const networkInfo = this.getNetworkInfo(chainId);
            if (!networkInfo) {
                throw new Error(`Network info not found for ${chainId}`);
            }

            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                    {
                        chainId: `0x${chainId.toString(16)}`,
                        chainName: networkInfo.name,
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        rpcUrls: [networkInfo.rpcUrl],
                        blockExplorerUrls: [networkInfo.explorer]
                    }
                ]
            });

            console.log(`Network ${networkInfo.name} added to MetaMask`);
            return true;
        } catch (err) {
            console.error(`Error adding network:`, err);
            return false;
        }
    }

    /**
     * Get ethers.js provider for network
     * @param {number} chainId - Chain ID
     * @returns {object} ethers.js provider
     */
    async getProvider(chainId) {
        try {
            // Return cached provider if available
            if (this.ethersProviders.has(chainId)) {
                return this.ethersProviders.get(chainId);
            }

            const networkInfo = this.getNetworkInfo(chainId);
            if (!networkInfo) {
                throw new Error(`Network info not found for ${chainId}`);
            }

            // Create ethers provider
            if (typeof ethers === 'undefined') {
                throw new Error('ethers.js not loaded');
            }

            const provider = new ethers.providers.JsonRpcProvider(networkInfo.rpcUrl);
            this.ethersProviders.set(chainId, provider);
            
            return provider;
        } catch (err) {
            console.error(`Error getting provider for chain ${chainId}:`, err);
            return null;
        }
    }

    /**
     * Get gas price for network
     * @param {number} chainId - Chain ID
     * @returns {object} Gas price information
     */
    async getGasPrice(chainId) {
        try {
            const provider = await this.getProvider(chainId);
            if (!provider) {
                throw new Error('Provider not available');
            }

            const gasPrice = await provider.getGasPrice();
            const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');

            return {
                wei: gasPrice.toString(),
                gwei: parseFloat(gasPriceGwei).toFixed(2)
            };
        } catch (err) {
            console.error(`Error getting gas price:`, err);
            return null;
        }
    }

    /**
     * Get network statistics
     * @param {number} chainId - Chain ID
     * @returns {object} Network stats
     */
    async getNetworkStats(chainId) {
        try {
            const provider = await this.getProvider(chainId);
            if (!provider) {
                throw new Error('Provider not available');
            }

            const blockNumber = await provider.getBlockNumber();
            const gasPrice = await this.getGasPrice(chainId);
            const balance = await provider.getBalance(window.ethereum?.selectedAddress || '0x0');

            return {
                chainId,
                blockNumber,
                gasPrice,
                balance: ethers.utils.formatEther(balance)
            };
        } catch (err) {
            console.error(`Error getting network stats:`, err);
            return null;
        }
    }

    /**
     * Listen to network change events
     * @param {function} callback - Callback function
     */
    onNetworkChange(callback) {
        if (typeof window.ethereum === 'undefined') {
            console.warn('MetaMask not available for network change listener');
            return;
        }

        window.ethereum.on('chainChanged', (chainIdHex) => {
            const chainId = parseInt(chainIdHex, 16);
            this.currentChainId = chainId;
            this.currentNetworkName = this.getNetworkName(chainId);
            callback({
                chainId,
                name: this.currentNetworkName
            });
        });
    }

    /**
     * Get current network
     * @returns {object} Current network info
     */
    getCurrentNetwork() {
        return {
            chainId: this.currentChainId,
            name: this.currentNetworkName
        };
    }

    /**
     * Clear cached providers
     */
    clearCache() {
        this.ethersProviders.clear();
        console.log('Network cache cleared');
    }
}

// Create global instance
let networkManager = new NetworkManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NetworkManager };
}
