# Test Suite Documentation

## Overview
Comprehensive test suite for BioWeb3 Phase 3 blockchain implementation with 40+ test cases covering all major modules.

## Test Files

### Setup & Mocks (jest.setup.js)
- MockIndexedDB - Full IndexedDB simulation
- MockObjectStore - Object store operations
- MockTransaction - Transaction handling
- Global fetch mock for API calls
- Mock window.ethereum (MetaMask)
- Mock browser APIs (localStorage, navigator, document)
- Test helpers (transaction/wallet generators)

### Unit Tests

**bio-ledger-db.test.js** (11 test suites, 30+ tests)
- Database initialization
- Transaction CRUD operations
- Filtering and pagination
- Ledger entries management
- Pending transaction queue
- Statistics calculation
- Data export

**bio-tx-analytics.test.js** (9 test suites, 28+ tests)
- Dashboard generation and caching
- Account statistics calculation
- Activity timeline aggregation
- Transaction type breakdown
- CSV/JSON export functionality
- Tax report generation
- Performance metrics
- Gas analytics

**bio-wallet-advanced.test.js** (7 test suites, 25+ tests)
- MetaMask wallet connection
- Wallet switching and management
- Multi-sig wallet creation
- Multi-sig approvals and execution
- Wallet history tracking
- Event emission and listening
- Error handling

**bio-network-manager.test.js** (5 test suites, 15+ tests)
- Network detection
- Network switching
- Provider management and caching
- Gas price estimation
- Multi-chain support
- Event handling

**bio-phase3-manager.test.js** (8 test suites, 20+ tests)
- Manager initialization
- Component lifecycle
- Wallet integration
- Staking operations
- Dashboard and reporting
- Sync management
- Event handling
- Cleanup and destruction

### Integration Tests (bio-integration.test.js)
- Ledger + Analytics workflow
- Wallet + Network integration
- Token Manager + Ledger tracking
- Multi-Sig + Analytics tracking
- Sync + Analytics updates
- Full end-to-end blockchain workflow

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test file
```bash
npm test bio-ledger-db.test.js
```

### Run tests with coverage
```bash
npm test -- --coverage
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run specific test suite
```bash
npm test -- --testNamePattern="Transaction Management"
```

### Run with verbose output
```bash
npm test -- --verbose
```

## Test Coverage

### Current Coverage Targets
- Branches: 60%+
- Functions: 60%+
- Lines: 60%+
- Statements: 60%+

### Files Tested
- js/bio-ledger-db.js
- js/bio-tx-analytics.js
- js/bio-wallet-advanced.js
- js/bio-network-manager.js
- js/bio-phase3-manager.js
- js/bio-ledger-sync.js (partial)
- js/bio-token-manager.js (partial)

### Files Not Tested (Dependencies)
- js/bio-core.js (Phase 1)
- js/bio-core-*.js (Phase 1)
- js/bio-utils.js (Phase 1)
- js/bio-config.js (Phase 1)

## Key Testing Patterns

### Mocking Async Operations
```javascript
test('should handle async operations', async () => {
    const mock = jest.fn(async () => ({ data: 'test' }));
    const result = await mock();
    expect(result.data).toBe('test');
});
```

### Mocking Browser APIs
```javascript
test('should use localStorage', () => {
    localStorage.setItem('key', 'value');
    expect(localStorage.getItem('key')).toBe('value');
});
```

### Testing Events
```javascript
test('should emit events', (done) => {
    component.on('event', (data) => {
        expect(data).toBeDefined();
        done();
    });
    component.emit('event', { data: 'test' });
});
```

### Testing Errors
```javascript
test('should handle errors', async () => {
    const result = await component.riskyOperation();
    expect(result).toBeNull(); // Component handles errors gracefully
});
```

## Test Data Helpers

### Creating Mock Transactions
```javascript
const tx = testHelpers.createMockTransaction({
    type: 'stake',
    amount: '100',
    status: 'pending'
});
```

### Creating Mock Wallets
```javascript
const wallet = testHelpers.createMockWallet({
    type: 'metamask',
    chainId: 137
});
```

### Creating Mock Stats
```javascript
const stats = testHelpers.createMockStats({
    totalTransactions: 50,
    confirmedTransactions: 45
});
```

### Waiting for Async
```javascript
await testHelpers.wait(500); // Wait 500ms
```

## Common Issues & Solutions

### Issue: "Cannot find module"
**Solution:** Ensure jest.config.js moduleFileExtensions includes all needed types

### Issue: "TypeError: window.ethereum is undefined"
**Solution:** jest.setup.js mocks window.ethereum globally

### Issue: "Test timeout"
**Solution:** Increase testTimeout in jest.config.js or add timeout param to test

### Issue: "Mock not working"
**Solution:** Call jest.clearAllMocks() in beforeEach

### Issue: IndexedDB operations fail
**Solution:** MockIndexedDB is setup globally, but requires manual transaction handling

## Adding New Tests

### Template
```javascript
describe('ComponentName', () => {
    let component;

    beforeEach(() => {
        jest.clearAllMocks();
        const { ComponentName } = require('./js/bio-component.js');
        component = new ComponentName();
    });

    describe('Feature Group', () => {
        test('should do something', async () => {
            // Arrange
            const input = 'test';

            // Act
            const result = await component.method(input);

            // Assert
            expect(result).toBeDefined();
        });
    });
});
```

### Best Practices
1. Clear mocks in beforeEach
2. Use descriptive test names
3. Follow Arrange-Act-Assert pattern
4. Mock external dependencies
5. Test both success and error paths
6. Test with boundary values
7. Keep tests isolated and independent

## Continuous Integration

### GitHub Actions Configuration
Create `.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
```

## Performance Testing

### Measuring Slow Tests
```bash
npm test -- --detectOpenHandles
```

### Profile Tests
```bash
npm test -- --testTimeout=30000
```

## Debugging Tests

### Debug Single Test
```bash
node --inspect-brk node_modules/.bin/jest --runInBand bio-ledger-db.test.js
```

Then open chrome://inspect in Chrome

### Console Logs
```javascript
test('should debug', () => {
    console.log('Debug info:', variable);
    expect(true).toBe(true);
});
```

Use `npm test -- --verbose` to see console output

## Test Maintenance

### Update Tests When Code Changes
- Keep tests in sync with implementation
- Update mock data structures
- Add tests for new features
- Remove tests for removed features

### Regular Review
- Check coverage reports monthly
- Update test data libraries
- Refactor repetitive tests
- Document test assumptions

## Support & Resources

- Jest Documentation: https://jestjs.io/
- Testing Library: https://testing-library.com/
- Mock Service Worker: https://mswjs.io/
- Enzyme (if needed): https://enzymejs.github.io/enzyme/

## Next Steps

1. ✅ Run test suite: `npm test`
2. ✅ Check coverage: `npm test -- --coverage`
3. ✅ Fix any failing tests
4. ✅ Set up CI/CD pipeline
5. ✅ Monitor test performance
