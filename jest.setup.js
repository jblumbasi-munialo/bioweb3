// ========== TEST SETUP & MOCKS ==========
// Global test configuration and mock implementations

// Mock IndexedDB
class MockIndexedDB {
    constructor() {
        this.databases = new Map();
    }

    open(dbName, version) {
        const db = {
            name: dbName,
            version: version,
            objectStoreNames: [],
            stores: new Map(),
            transaction: (storeNames, mode) => {
                return new MockTransaction(storeNames, mode, this.stores);
            },
            createObjectStore: (name, options) => {
                const store = new MockObjectStore(name, options);
                this.stores.set(name, store);
                this.objectStoreNames.push(name);
                return store;
            }
        };

        this.databases.set(dbName, db);

        const request = {
            result: db,
            error: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null
        };

        setTimeout(() => {
            if (request.onupgradeneeded) {
                request.onupgradeneeded({ target: request });
            }
            if (request.onsuccess) {
                request.onsuccess();
            }
        }, 0);

        return request;
    }
}

class MockObjectStore {
    constructor(name, options) {
        this.name = name;
        this.keyPath = options?.keyPath || 'id';
        this.data = new Map();
        this.indexes = new Map();
    }

    add(value) {
        const key = value[this.keyPath];
        this.data.set(key, value);
        return { result: key, onsuccess: null };
    }

    put(value) {
        const key = value[this.keyPath];
        this.data.set(key, value);
        return { result: key, onsuccess: null };
    }

    get(key) {
        return { result: this.data.get(key), onsuccess: null };
    }

    getAll() {
        return { result: Array.from(this.data.values()), onsuccess: null };
    }

    delete(key) {
        this.data.delete(key);
        return { onsuccess: null };
    }

    clear() {
        this.data.clear();
        return { onsuccess: null };
    }

    count() {
        return { result: this.data.size, onsuccess: null };
    }

    createIndex(name, keyPath, options) {
        this.indexes.set(name, { name, keyPath, options });
        return {
            getAll: (range) => ({ result: Array.from(this.data.values()), onsuccess: null }),
            index: (name) => this.indexes.get(name)
        };
    }

    index(name) {
        return {
            getAll: (range) => ({ result: Array.from(this.data.values()), onsuccess: null })
        };
    }
}

class MockTransaction {
    constructor(storeNames, mode, stores) {
        this.storeNames = storeNames;
        this.mode = mode;
        this.stores = stores;
        this.oncomplete = null;
        this.onerror = null;
    }

    objectStore(name) {
        return this.stores.get(name) || new MockObjectStore(name, {});
    }
}

// Mock fetch for API calls
global.fetchMock = {
    responses: new Map(),
    setup: (url, response) => {
        global.fetchMock.responses.set(url, response);
    },
    reset: () => {
        global.fetchMock.responses.clear();
    }
};

global.fetch = jest.fn((url, options) => {
    const response = global.fetchMock.responses.get(url);
    if (response) {
        return Promise.resolve({
            ok: response.ok !== false,
            status: response.status || 200,
            json: () => Promise.resolve(response.data || response),
            text: () => Promise.resolve(JSON.stringify(response.data || response))
        });
    }
    return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('{}')
    });
});

// Mock window.ethereum (MetaMask)
global.window = global.window || {};
global.window.ethereum = {
    request: jest.fn(async (args) => {
        if (args.method === 'eth_requestAccounts') {
            return ['0x1234567890123456789012345678901234567890'];
        }
        if (args.method === 'eth_chainId') {
            return '0x1'; // Ethereum mainnet
        }
        return null;
    }),
    on: jest.fn(),
    off: jest.fn(),
    isConnected: jest.fn(() => true)
};

// Mock EventTarget
global.window.addEventListener = jest.fn();
global.window.dispatchEvent = jest.fn();

// Mock CustomEvent
global.CustomEvent = class CustomEvent extends Event {
    constructor(event, params) {
        super(event);
        this.detail = params?.detail;
    }
};

// Mock localStorage
global.localStorage = {
    data: {},
    getItem: (key) => global.localStorage.data[key] || null,
    setItem: (key, value) => {
        global.localStorage.data[key] = value.toString();
    },
    removeItem: (key) => {
        delete global.localStorage.data[key];
    },
    clear: () => {
        global.localStorage.data = {};
    }
};

// Mock navigator
global.navigator = global.navigator || {};
global.navigator.onLine = true;

// Mock indexedDB
global.indexedDB = new MockIndexedDB();
global.IDBKeyRange = {
    only: (key) => ({ key }),
    lowerBound: (key) => ({ lower: key }),
    upperBound: (key) => ({ upper: key }),
    bound: (lower, upper) => ({ lower, upper })
};

// Mock Blob and URL
global.Blob = class Blob {
    constructor(parts, options) {
        this.parts = parts;
        this.type = options?.type || '';
    }
};

global.URL = {
    createObjectURL: jest.fn((blob) => 'blob:mock-url'),
    revokeObjectURL: jest.fn()
};

// Mock document
global.document = global.document || {};
global.document.readyState = 'complete';
global.document.createElement = jest.fn((tag) => ({
    href: '',
    download: '',
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    click: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    tagName: tag.toUpperCase()
}));
global.document.body = {
    appendChild: jest.fn(),
    removeChild: jest.fn()
};

// Helper functions for tests
global.testHelpers = {
    // Generate mock transaction
    createMockTransaction: (overrides = {}) => ({
        id: `tx_${Date.now()}`,
        hash: '0xabcd1234',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        type: 'transfer',
        amount: '1.0',
        amountBIO: '100',
        usdValue: '2000',
        chain: 'ethereum',
        chainId: 1,
        status: 'confirmed',
        gas: { gasUsed: 21000, gasPrice: '50', gasCost: '0.00105' },
        timestamp: Date.now(),
        ...overrides
    }),

    // Generate mock wallet
    createMockWallet: (overrides = {}) => ({
        id: 'metamask_0x1234567890123456789012345678901234567890',
        type: 'metamask',
        address: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        connected: true,
        connectedAt: Date.now(),
        balance: '10.5',
        ...overrides
    }),

    // Generate mock stats
    createMockStats: (overrides = {}) => ({
        account: '0x1234567890123456789012345678901234567890',
        totalTransactions: 10,
        confirmedTransactions: 9,
        failedTransactions: 1,
        pendingTransactions: 0,
        totalValueUSD: '20000.00',
        totalBIO: '1000.00',
        totalGasCostETH: '0.01',
        avgGasPerTx: '0.001',
        byType: { transfer: { count: 5, volume: 5 } },
        firstTx: new Date().toISOString(),
        lastTx: new Date().toISOString(),
        daysSinceFirstTx: 30,
        ...overrides
    }),

    // Wait for async operations
    wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};

module.exports = {
    MockIndexedDB,
    MockObjectStore,
    MockTransaction
};
