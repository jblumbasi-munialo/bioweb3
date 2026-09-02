// ========== TRANSACTION ANALYTICS & REPORTING ==========
// Advanced analytics dashboard for blockchain transactions

class TransactionAnalytics {
    /**
     * Initialize Analytics Engine
     * @param {object} ledgerDB - LedgerDatabase instance
     */
    constructor(ledgerDB) {
        this.ledgerDB = ledgerDB;
        this.cache = new Map();
        this.cacheExpiry = 300000; // 5 minutes
    }

    /**
     * Get dashboard data for account
     * @param {string} account - Account address
     */
    async getDashboard(account) {
        const cacheKey = `dashboard_${account}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        try {
            const [txs, stats, timeline, topTypes] = await Promise.all([
                this.ledgerDB.getTransactionsByAccount(account, { limit: 100 }),
                this.getAccountStats(account),
                this.getActivityTimeline(account),
                this.getTransactionTypeBreakdown(account)
            ]);

            const dashboard = {
                summary: stats,
                recentTransactions: txs.slice(0, 20),
                timeline: timeline,
                typeBreakdown: topTypes,
                generated: Date.now()
            };

            this.cache.set(cacheKey, {
                data: dashboard,
                timestamp: Date.now()
            });

            return dashboard;
        } catch (error) {
            console.error('Dashboard generation failed:', error);
            return null;
        }
    }

    /**
     * Get account statistics
     */
    async getAccountStats(account) {
        try {
            const txs = await this.ledgerDB.getTransactionsByAccount(account, { limit: 1000 });

            if (txs.length === 0) {
                return this.getEmptyStats();
            }

            const statsByType = {};
            let totalValue = 0;
            let totalGasCost = 0;
            let confirmationTimes = [];

            txs.forEach(tx => {
                // Group by type
                if (!statsByType[tx.type]) {
                    statsByType[tx.type] = { count: 0, volume: 0, avgGas: 0 };
                }
                statsByType[tx.type].count++;
                statsByType[tx.type].volume += parseFloat(tx.amount || 0);

                // Accumulate values
                totalValue += tx.usdValue || 0;
                totalGasCost += parseFloat(tx.gas?.gasCost || 0);
            });

            // Calculate averages
            Object.keys(statsByType).forEach(type => {
                statsByType[type].avgGas = (statsByType[type].volume / statsByType[type].count).toFixed(4);
            });

            const confirmedTxs = txs.filter(tx => tx.status === 'confirmed');

            return {
                account: account,
                totalTransactions: txs.length,
                confirmedTransactions: confirmedTxs.length,
                failedTransactions: txs.filter(tx => tx.status === 'failed').length,
                pendingTransactions: txs.filter(tx => tx.status === 'pending').length,
                totalValueUSD: totalValue.toFixed(2),
                totalBIO: txs.reduce((sum, tx) => sum + (tx.amountBIO || 0), 0).toFixed(2),
                totalGasCostETH: totalGasCost.toFixed(6),
                avgGasPerTx: (totalGasCost / txs.length).toFixed(6),
                byType: statsByType,
                firstTx: new Date(Math.min(...txs.map(tx => tx.timestamp))).toISOString(),
                lastTx: new Date(Math.max(...txs.map(tx => tx.timestamp))).toISOString(),
                daysSinceFirstTx: Math.floor((Date.now() - Math.min(...txs.map(tx => tx.timestamp))) / (1000 * 60 * 60 * 24))
            };
        } catch (error) {
            console.error('Stats generation failed:', error);
            return this.getEmptyStats();
        }
    }

    /**
     * Get empty stats template
     */
    getEmptyStats() {
        return {
            account: null,
            totalTransactions: 0,
            confirmedTransactions: 0,
            failedTransactions: 0,
            pendingTransactions: 0,
            totalValueUSD: '0.00',
            totalBIO: '0.00',
            totalGasCostETH: '0.000000',
            avgGasPerTx: '0.000000',
            byType: {},
            firstTx: null,
            lastTx: null,
            daysSinceFirstTx: 0
        };
    }

    /**
     * Get activity timeline (hourly/daily aggregation)
     */
    async getActivityTimeline(account, interval = 'daily') {
        try {
            const txs = await this.ledgerDB.getTransactionsByAccount(account, { limit: 1000 });
            
            if (txs.length === 0) {
                return [];
            }

            const timeline = new Map();
            const now = Date.now();
            const lookbackDays = 30;
            const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;

            // Initialize days
            for (let i = 0; i < lookbackDays; i++) {
                const date = new Date(now - (i * 24 * 60 * 60 * 1000));
                const key = date.toISOString().split('T')[0];
                timeline.set(key, {
                    date: key,
                    count: 0,
                    volume: 0,
                    gasUsed: 0,
                    types: {}
                });
            }

            // Aggregate transactions
            txs.forEach(tx => {
                if (tx.timestamp >= now - lookbackMs) {
                    const date = new Date(tx.timestamp).toISOString().split('T')[0];
                    
                    if (timeline.has(date)) {
                        const entry = timeline.get(date);
                        entry.count++;
                        entry.volume += parseFloat(tx.amount || 0);
                        entry.gasUsed += parseFloat(tx.gas?.gasCost || 0);
                        
                        if (!entry.types[tx.type]) {
                            entry.types[tx.type] = 0;
                        }
                        entry.types[tx.type]++;
                    }
                }
            });

            return Array.from(timeline.values())
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error('Timeline generation failed:', error);
            return [];
        }
    }

    /**
     * Get transaction type breakdown
     */
    async getTransactionTypeBreakdown(account) {
        try {
            const txs = await this.ledgerDB.getTransactionsByAccount(account, { limit: 1000 });
            
            const breakdown = {};
            txs.forEach(tx => {
                if (!breakdown[tx.type]) {
                    breakdown[tx.type] = {
                        type: tx.type,
                        count: 0,
                        totalAmount: 0,
                        totalGas: 0,
                        avgAmount: 0,
                        avgGas: 0,
                        successRate: 0
                    };
                }
                breakdown[tx.type].count++;
                breakdown[tx.type].totalAmount += parseFloat(tx.amount || 0);
                breakdown[tx.type].totalGas += parseFloat(tx.gas?.gasCost || 0);
            });

            // Calculate averages and success rates
            Object.keys(breakdown).forEach(type => {
                const data = breakdown[type];
                data.avgAmount = (data.totalAmount / data.count).toFixed(4);
                data.avgGas = (data.totalGas / data.count).toFixed(6);
                
                const typeCount = txs.filter(tx => tx.type === type).length;
                const successCount = txs.filter(tx => tx.type === type && tx.status === 'confirmed').length;
                data.successRate = ((successCount / typeCount) * 100).toFixed(2);
            });

            return Object.values(breakdown)
                .sort((a, b) => b.count - a.count);
        } catch (error) {
            console.error('Type breakdown failed:', error);
            return [];
        }
    }

    /**
     * Export transactions as CSV
     */
    async exportAsCSV(account, filename = 'transactions.csv') {
        try {
            const txs = await this.ledgerDB.getTransactionsByAccount(account, { limit: 10000 });

            const headers = [
                'ID',
                'Hash',
                'Type',
                'From',
                'To',
                'Amount',
                'Amount BIO',
                'USD Value',
                'Chain',
                'Status',
                'Gas Used',
                'Gas Price',
                'Gas Cost',
                'Timestamp'
            ];

            const rows = txs.map(tx => [
                tx.id,
                tx.hash || '',
                tx.type,
                tx.from,
                tx.to,
                tx.amount,
                tx.amountBIO || 0,
                tx.usdValue || 0,
                tx.chain,
                tx.status,
                tx.gas?.gasUsed || 0,
                tx.gas?.gasPrice || 0,
                tx.gas?.gasCost || 0,
                new Date(tx.timestamp).toISOString()
            ]);

            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => 
                    typeof cell === 'string' && cell.includes(',') 
                        ? `"${cell}"` 
                        : cell
                ).join(','))
            ].join('\n');

            this.downloadFile(csv, filename, 'text/csv');
            console.log(`Exported ${rows.length} transactions to ${filename}`);
        } catch (error) {
            console.error('CSV export failed:', error);
        }
    }

    /**
     * Export transactions as JSON
     */
    async exportAsJSON(account, filename = 'transactions.json') {
        try {
            const txs = await this.ledgerDB.getTransactionsByAccount(account, { limit: 10000 });
            
            const json = JSON.stringify({
                exported: new Date().toISOString(),
                account: account,
                transactionCount: txs.length,
                transactions: txs
            }, null, 2);

            this.downloadFile(json, filename, 'application/json');
            console.log(`Exported ${txs.length} transactions to ${filename}`);
        } catch (error) {
            console.error('JSON export failed:', error);
        }
    }

    /**
     * Get tax report (for accountants)
     */
    async getTaxReport(account, year) {
        try {
            const txs = await this.ledgerDB.getTransactionsByAccount(account, { limit: 10000 });
            
            const yearStart = new Date(year, 0, 1).getTime();
            const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

            const yearTxs = txs.filter(tx => tx.timestamp >= yearStart && tx.timestamp <= yearEnd);

            const report = {
                year: year,
                account: account,
                totalTransactions: yearTxs.length,
                byType: {},
                totalIncome: 0,
                totalExpenses: 0,
                netGainLoss: 0,
                taxableEvents: []
            };

            yearTxs.forEach(tx => {
                if (!report.byType[tx.type]) {
                    report.byType[tx.type] = { count: 0, volume: 0 };
                }
                report.byType[tx.type].count++;
                report.byType[tx.type].volume += parseFloat(tx.amount || 0);

                // Simplistic tax categorization
                if (['reward', 'claim'].includes(tx.type)) {
                    report.totalIncome += tx.usdValue || 0;
                } else if (['stake', 'transfer'].includes(tx.type)) {
                    report.totalExpenses += tx.usdValue || 0;
                }

                report.taxableEvents.push({
                    date: new Date(tx.timestamp).toISOString(),
                    type: tx.type,
                    amount: tx.amount,
                    usdValue: tx.usdValue,
                    hash: tx.hash
                });
            });

            report.netGainLoss = report.totalIncome - report.totalExpenses;

            return report;
        } catch (error) {
            console.error('Tax report generation failed:', error);
            return null;
        }
    }

    /**
     * Get performance metrics
     */
    async getPerformanceMetrics(account) {
        try {
            const stats = await this.getAccountStats(account);
            const timeline = await this.getActivityTimeline(account);

            const successRate = stats.totalTransactions > 0
                ? ((stats.confirmedTransactions / stats.totalTransactions) * 100).toFixed(2)
                : 0;

            // Calculate engagement score
            let engagementScore = 0;
            if (stats.totalTransactions > 0) engagementScore += 20;
            if (stats.daysSinceFirstTx > 7) engagementScore += 20;
            if (stats.totalValueUSD > 1000) engagementScore += 20;
            if (successRate > 95) engagementScore += 20;
            if (timeline.filter(t => t.count > 0).length > 5) engagementScore += 20;

            return {
                account: account,
                successRate: parseFloat(successRate),
                engagementScore: engagementScore,
                volumeScore: Math.min(100, (parseFloat(stats.totalValueUSD) / 1000) * 100),
                consistencyScore: this.calculateConsistencyScore(timeline),
                recommendedStrategy: this.getRecommendedStrategy(stats, engagementScore)
            };
        } catch (error) {
            console.error('Metrics calculation failed:', error);
            return null;
        }
    }

    /**
     * Calculate consistency score
     */
    calculateConsistencyScore(timeline) {
        if (timeline.length === 0) return 0;

        const activeDays = timeline.filter(t => t.count > 0).length;
        const totalDays = timeline.length;
        const consistency = (activeDays / totalDays) * 100;

        return Math.min(100, consistency);
    }

    /**
     * Get recommended strategy
     */
    getRecommendedStrategy(stats, engagementScore) {
        if (engagementScore >= 80) return 'advanced_defi';
        if (engagementScore >= 60) return 'intermediate_trader';
        if (engagementScore >= 40) return 'casual_user';
        return 'new_user';
    }

    /**
     * Get gas analytics
     */
    async getGasAnalytics(account) {
        try {
            const txs = await this.ledgerDB.getTransactionsByAccount(account, { limit: 1000 });

            const gasPrices = txs
                .filter(tx => tx.gas && tx.gas.gasPrice)
                .map(tx => parseFloat(tx.gas.gasPrice));

            if (gasPrices.length === 0) {
                return {
                    avgGasPrice: 0,
                    minGasPrice: 0,
                    maxGasPrice: 0,
                    totalGasSpent: 0
                };
            }

            gasPrices.sort((a, b) => a - b);

            return {
                avgGasPrice: (gasPrices.reduce((a, b) => a + b) / gasPrices.length).toFixed(6),
                minGasPrice: gasPrices[0].toFixed(6),
                maxGasPrice: gasPrices[gasPrices.length - 1].toFixed(6),
                medianGasPrice: gasPrices[Math.floor(gasPrices.length / 2)].toFixed(6),
                totalGasSpent: txs.reduce((sum, tx) => sum + parseFloat(tx.gas?.gasCost || 0), 0).toFixed(6),
                gasSpentByType: this.groupGasByType(txs)
            };
        } catch (error) {
            console.error('Gas analytics failed:', error);
            return null;
        }
    }

    /**
     * Group gas costs by transaction type
     */
    groupGasByType(txs) {
        const byType = {};
        txs.forEach(tx => {
            if (!byType[tx.type]) {
                byType[tx.type] = { count: 0, total: 0, avg: 0 };
            }
            byType[tx.type].count++;
            byType[tx.type].total += parseFloat(tx.gas?.gasCost || 0);
        });

        Object.keys(byType).forEach(type => {
            byType[type].avg = (byType[type].total / byType[type].count).toFixed(6);
            byType[type].total = byType[type].total.toFixed(6);
        });

        return byType;
    }

    /**
     * Download file helper
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Analytics cache cleared');
    }
}

window.TransactionAnalytics = TransactionAnalytics;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TransactionAnalytics };
}
