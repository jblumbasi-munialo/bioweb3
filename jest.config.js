module.exports = {
    displayName: 'BioWeb3 Phase 3',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    collectCoverage: true,
    collectCoverageFrom: [
        'js/bio-*.js',
        '!js/bio-core.js',
        '!js/bio-core-*.js',
        '!js/bio-utils.js',
        '!js/bio-config.js'
    ],
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60
        }
    },
    testMatch: [
        '**/?(*.)+(spec|test).js',
        '!node_modules/**'
    ],
    moduleFileExtensions: ['js', 'json'],
    transformIgnorePatterns: [
        'node_modules/(?!(web3|ethers)/)'
    ],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': '<rootDir>/jest.mock.css.js',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/jest.mock.file.js'
    },
    verbose: true,
    testTimeout: 10000
};
