// ========== NETWORK MANAGER TESTS ==========

describe('NetworkManager', () => {
    let networkManager;

    beforeEach(() => {
        jest.clearAllMocks();
        const { NetworkManager } = require('./js/bio-network-manager.js');
        networkManager = new NetworkManager();
    });

    describe('Network Detection', () => {
        test('should detect current network', async () => {
            const network = await networkManager.detectNetwork();
            
            expect(network).toBeDefined();
            expect(network).toHaveProperty('chainId');
            expect(network).toHaveProperty('name');
        });

        test('should return network info', () => {
            const network = networkManager.getNetworkInfo(1);
            
            expect(network).toBeDefined();
            expect(network.chainId).toBe(1);
        });

        test('should support multiple chains', () => {
            const chains = [1, 137, 56, 42161];
            
            chains.forEach(chainId => {
                const network = networkManager.getNetworkInfo(chainId);
                expect(network).toBeDefined();
            });
        });
    });

    describe('Network Switching', () => {
        test('should switch network', async () => {
            const emitSpy = jest.spyOn(networkManager, 'emit');
            
            const result = await networkManager.switchNetwork(137);
            
            expect(emitSpy).toHaveBeenCalledWith('network:switched', expect.any(Object));
        });

        test('should handle invalid chain ID', async () => {
            const result = await networkManager.switchNetwork(999);
            
            expect(result).toBeNull();
        });

        test('should emit network:error on failure', async () => {
            const emitSpy = jest.spyOn(networkManager, 'emit');
            
            await networkManager.switchNetwork(999);
            
            expect(emitSpy).toHaveBeenCalledWith('network:error', expect.any(Error));
        });
    });

    describe('Provider Management', () => {
        test('should get provider for chain', () => {
            const provider = networkManager.getProvider(1);
            
            expect(provider).toBeDefined();
        });

        test('should cache providers', () => {
            const provider1 = networkManager.getProvider(1);
            const provider2 = networkManager.getProvider(1);
            
            expect(provider1).toBe(provider2);
        });

        test('should get MetaMask provider', () => {
            const provider = networkManager.getMetaMaskProvider();
            
            if (provider) {
                expect(provider).toHaveProperty('request');
            }
        });
    });

    describe('Gas Price Estimation', () => {
        test('should estimate gas price', async () => {
            const gasPrice = await networkManager.getGasPrice(1);
            
            expect(gasPrice).toBeDefined();
            expect(parseFloat(gasPrice)).toBeGreaterThan(0);
        });

        test('should get gas price for current network', async () => {
            const gasPrice = await networkManager.getCurrentGasPrice();
            
            expect(gasPrice).toBeDefined();
        });
    });

    describe('Event Emitter', () => {
        test('should emit events', () => {
            const emitSpy = jest.spyOn(window, 'dispatchEvent');
            
            networkManager.emit('test:event', { data: 'test' });
            
            expect(emitSpy).toHaveBeenCalled();
        });

        test('should listen for events', (done) => {
            networkManager.on('test:event', (data) => {
                expect(data).toEqual({ message: 'test' });
                done();
            });

            const event = new CustomEvent('test:event', { detail: { message: 'test' } });
            window.dispatchEvent(event);
        });
    });

    describe('Network Info', () => {
        test('should list all supported networks', () => {
            const networks = networkManager.listNetworks();
            
            expect(Array.isArray(networks)).toBe(true);
            expect(networks.length).toBeGreaterThan(0);
        });

        test('should have correct RPC endpoints', () => {
            const network = networkManager.getNetworkInfo(1);
            
            expect(network.rpc).toBeDefined();
            expect(network.rpc.length).toBeGreaterThan(0);
        });
    });
});
