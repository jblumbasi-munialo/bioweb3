// ========== TRANSACTION ANALYTICS TESTS ==========

describe('TransactionAnalytics', () => {
    let analytics;
    let mockLedgerDB;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Create mock LedgerDatabase
        mockLedgerDB = {
            getTransactionsByAccount: jest.fn(async () => [
                testHelpers.createMockTransaction({ type: 'transfer', status: 'confirmed' }),
                testHelpers.createMockTransaction({ type: 'stake', status: 'confirmed' }),
                testHelpers.createMockTransaction({ type: 'transfer', status: 'failed' })
            ]),
            addLedgerEntry: jest.fn(async () => 'entry_id')
        };

        const { TransactionAnalytics } = require('./js/bio-tx-analytics.js');
        analytics = new TransactionAnalytics(mockLedgerDB);
    });

    describe('Dashboard', () => {
        test('should generate dashboard', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const dashboard = await analytics.getDashboard(account);

            expect(dashboard).toHaveProperty('summary');
            expect(dashboard).toHaveProperty('recentTransactions');
            expect(dashboard).toHaveProperty('timeline');
            expect(dashboard).toHaveProperty('typeBreakdown');
        });

        test('should cache dashboard data', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            
            await analytics.getDashboard(account);
            const cached = analytics.cache.has(`dashboard_${account}`);
            
            expect(cached).toBe(true);
        });

        test('should return cached data on second call', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            
            const result1 = await analytics.getDashboard(account);
            mockLedgerDB.getTransactionsByAccount.mockClear();
            const result2 = await analytics.getDashboard(account);

            expect(mockLedgerDB.getTransactionsByAccount).not.toHaveBeenCalled();
            expect(result1).toEqual(result2);
        });

        test('should invalidate cache after expiry', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            
            await analytics.getDashboard(account);
            
            // Manually expire cache
            const cached = analytics.cache.get(`dashboard_${account}`);
            cached.timestamp = Date.now() - 400000; // 400 seconds ago
            
            mockLedgerDB.getTransactionsByAccount.mockClear();
            await analytics.getDashboard(account);

            expect(mockLedgerDB.getTransactionsByAccount).toHaveBeenCalled();
        });
    });

    describe('Account Statistics', () => {
        test('should calculate account statistics', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const stats = await analytics.getAccountStats(account);

            expect(stats).toHaveProperty('account');
            expect(stats).toHaveProperty('totalTransactions');
            expect(stats).toHaveProperty('confirmedTransactions');
            expect(stats).toHaveProperty('failedTransactions');
            expect(stats).toHaveProperty('totalValueUSD');
        });

        test('should return empty stats for no transactions', async () => {
            mockLedgerDB.getTransactionsByAccount.mockResolvedValueOnce([]);
            
            const stats = await analytics.getAccountStats('0x1234');
            
            expect(stats.totalTransactions).toBe(0);
            expect(stats.confirmedTransactions).toBe(0);
        });

        test('should count transactions by status', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const stats = await analytics.getAccountStats(account);

            expect(stats.confirmedTransactions).toBeGreaterThanOrEqual(0);
            expect(stats.failedTransactions).toBeGreaterThanOrEqual(0);
        });

        test('should calculate total value', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const stats = await analytics.getAccountStats(account);

            expect(stats.totalValueUSD).toBeDefined();
            expect(parseFloat(stats.totalValueUSD)).toBeGreaterThanOrEqual(0);
        });

        test('should group transactions by type', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const stats = await analytics.getAccountStats(account);

            expect(stats.byType).toBeDefined();
            expect(typeof stats.byType).toBe('object');
        });
    });

    describe('Activity Timeline', () => {
        test('should generate activity timeline', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const timeline = await analytics.getActivityTimeline(account);

            expect(Array.isArray(timeline)).toBe(true);
        });

        test('should include date in timeline entries', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const timeline = await analytics.getActivityTimeline(account);

            if (timeline.length > 0) {
                expect(timeline[0]).toHaveProperty('date');
                expect(timeline[0]).toHaveProperty('count');
                expect(timeline[0]).toHaveProperty('volume');
            }
        });

        test('should aggregate transactions by day', async () => {
            const now = Date.now();
            mockLedgerDB.getTransactionsByAccount.mockResolvedValueOnce([
                testHelpers.createMockTransaction({ timestamp: now }),
                testHelpers.createMockTransaction({ timestamp: now - 86400000 }) // 1 day ago
            ]);

            const timeline = await analytics.getActivityTimeline('0x1234');
            
            expect(timeline.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Transaction Type Breakdown', () => {
        test('should break down transactions by type', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const breakdown = await analytics.getTransactionTypeBreakdown(account);

            expect(Array.isArray(breakdown)).toBe(true);
        });

        test('should include count for each type', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const breakdown = await analytics.getTransactionTypeBreakdown(account);

            if (breakdown.length > 0) {
                expect(breakdown[0]).toHaveProperty('count');
                expect(breakdown[0]).toHaveProperty('type');
            }
        });

        test('should calculate success rate', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const breakdown = await analytics.getTransactionTypeBreakdown(account);

            if (breakdown.length > 0) {
                expect(breakdown[0]).toHaveProperty('successRate');
                const rate = parseFloat(breakdown[0].successRate);
                expect(rate).toBeGreaterThanOrEqual(0);
                expect(rate).toBeLessThanOrEqual(100);
            }
        });
    });

    describe('Export Functions', () => {
        test('should export as CSV', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            
            analytics.downloadFile = jest.fn();
            await analytics.exportAsCSV(account);

            expect(analytics.downloadFile).toHaveBeenCalled();
        });

        test('should export as JSON', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            
            analytics.downloadFile = jest.fn();
            await analytics.exportAsJSON(account);

            expect(analytics.downloadFile).toHaveBeenCalled();
        });

        test('should include metadata in JSON export', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            
            let exportedContent = '';
            analytics.downloadFile = jest.fn((content) => {
                exportedContent = content;
            });
            
            await analytics.exportAsJSON(account);

            const data = JSON.parse(exportedContent);
            expect(data).toHaveProperty('exported');
            expect(data).toHaveProperty('account');
            expect(data).toHaveProperty('transactionCount');
            expect(data).toHaveProperty('transactions');
        });
    });

    describe('Tax Report', () => {
        test('should generate tax report', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const report = await analytics.getTaxReport(account, 2024);

            expect(report).toHaveProperty('year');
            expect(report).toHaveProperty('account');
            expect(report).toHaveProperty('totalTransactions');
        });

        test('should filter by year', async () => {
            const now = Date.now();
            const jan2024 = new Date(2024, 0, 1).getTime();
            const dec2024 = new Date(2024, 11, 31).getTime();

            mockLedgerDB.getTransactionsByAccount.mockResolvedValueOnce([
                testHelpers.createMockTransaction({ timestamp: jan2024 }),
                testHelpers.createMockTransaction({ timestamp: dec2024 })
            ]);

            const report = await analytics.getTaxReport('0x1234', 2024);
            expect(report.year).toBe(2024);
        });

        test('should calculate net gain/loss', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const report = await analytics.getTaxReport(account, 2024);

            expect(report).toHaveProperty('totalIncome');
            expect(report).toHaveProperty('totalExpenses');
            expect(report).toHaveProperty('netGainLoss');
        });
    });

    describe('Performance Metrics', () => {
        test('should calculate performance metrics', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const metrics = await analytics.getPerformanceMetrics(account);

            expect(metrics).toHaveProperty('successRate');
            expect(metrics).toHaveProperty('engagementScore');
            expect(metrics).toHaveProperty('volumeScore');
        });

        test('should include consistency score', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const metrics = await analytics.getPerformanceMetrics(account);

            expect(metrics).toHaveProperty('consistencyScore');
            const score = parseFloat(metrics.consistencyScore);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
        });

        test('should recommend strategy', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const metrics = await analytics.getPerformanceMetrics(account);

            expect(metrics).toHaveProperty('recommendedStrategy');
            expect(['advanced_defi', 'intermediate_trader', 'casual_user', 'new_user']).toContain(metrics.recommendedStrategy);
        });
    });

    describe('Gas Analytics', () => {
        test('should analyze gas costs', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const gasAnalytics = await analytics.getGasAnalytics(account);

            expect(gasAnalytics).toHaveProperty('avgGasPrice');
            expect(gasAnalytics).toHaveProperty('minGasPrice');
            expect(gasAnalytics).toHaveProperty('maxGasPrice');
            expect(gasAnalytics).toHaveProperty('totalGasSpent');
        });

        test('should group gas by transaction type', async () => {
            const account = '0x1234567890123456789012345678901234567890';
            const gasAnalytics = await analytics.getGasAnalytics(account);

            expect(gasAnalytics).toHaveProperty('gasSpentByType');
            expect(typeof gasAnalytics.gasSpentByType).toBe('object');
        });
    });

    describe('Cache Management', () => {
        test('should clear cache', () => {
            analytics.cache.set('test_key', { data: 'test' });
            
            analytics.clearCache();

            expect(analytics.cache.size).toBe(0);
        });
    });
});
