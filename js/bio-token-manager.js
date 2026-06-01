// ========== BIO TOKEN ECONOMICS MANAGER ==========
// Manages staking, rewards, fees, and token economics

class TokenManager {
    /**
     * Initialize TokenManager
     * @param {object} contractManager - ContractManager instance
     * @param {object} networkManager - NetworkManager instance
     */
    constructor(contractManager, networkManager) {
        this.contractManager = contractManager;
        this.networkManager = networkManager;
        this.stakingConfig = {
            minStakeAmount: ethers.utils.parseUnits('10', 18), // 10 BIO minimum
            maxStakePerUser: ethers.utils.parseUnits('1000000', 18), // 1M BIO max
            lockPeriod: 2592000, // 30 days in seconds
            baseAPY: 10, // 10% base APY
            maxAPY: 20, // 20% max APY
            rewardDistributionRate: 0.0001 // 0.01% per block
        };
        this.tokenDecimals = 18;
        this.tokenSymbol = '$BIO';
    }

    /**
     * Get BIO token balance for address
     * @param {string} address - User address
     * @returns {string} Balance in BIO tokens
     */
    async getTokenBalance(address) {
        try {
            if (!ethers.utils.isAddress(address)) {
                throw new Error('Invalid address');
            }

            const balance = await this.contractManager.callFunction(
                'BIOToken',
                'balanceOf',
                [address]
            );

            return this.contractManager.formatTokenAmount(balance, this.tokenDecimals);
        } catch (err) {
            console.error('Error getting token balance:', err);
            return '0';
        }
    }

    /**
     * Get total token supply
     * @returns {string} Total supply in BIO
     */
    async getTotalSupply() {
        try {
            const supply = await this.contractManager.callFunction(
                'BIOToken',
                'totalSupply',
                []
            );

            return this.contractManager.formatTokenAmount(supply, this.tokenDecimals);
        } catch (err) {
            console.error('Error getting total supply:', err);
            return '0';
        }
    }

    /**
     * Stake BIO tokens
     * @param {number|string} amount - Amount to stake (in BIO)
     * @param {object} signer - ethers.js signer
     * @returns {object} Transaction response
     */
    async stakeTokens(amount, signer) {
        try {
            const amountWei = this.contractManager.parseTokenAmount(amount, this.tokenDecimals);

            if (amountWei.lt(this.stakingConfig.minStakeAmount)) {
                throw new Error(`Minimum stake is ${this.stakingConfig.minStakeAmount} BIO`);
            }

            // First approve spending
            console.log(`Approving ${amount} BIO for staking...`);
            const approveTx = await this.contractManager.sendTransaction(
                'BIOToken',
                'approve',
                [
                    getContractAddress('BIOStaking', this.networkManager.currentChainId),
                    amountWei
                ],
                signer
            );

            if (!approveTx) {
                throw new Error('Approval failed');
            }

            // Wait for approval
            await this.contractManager.waitForConfirmation(approveTx);

            // Now stake
            console.log(`Staking ${amount} BIO...`);
            const stakeTx = await this.contractManager.sendTransaction(
                'BIOStaking',
                'stake',
                [amountWei],
                signer
            );

            return stakeTx;
        } catch (err) {
            console.error('Error staking tokens:', err);
            return null;
        }
    }

    /**
     * Unstake BIO tokens
     * @param {number|string} amount - Amount to unstake (in BIO)
     * @param {object} signer - ethers.js signer
     * @returns {object} Transaction response
     */
    async unstakeTokens(amount, signer) {
        try {
            const amountWei = this.contractManager.parseTokenAmount(amount, this.tokenDecimals);

            console.log(`Unstaking ${amount} BIO...`);
            const tx = await this.contractManager.sendTransaction(
                'BIOStaking',
                'unstake',
                [amountWei],
                signer
            );

            return tx;
        } catch (err) {
            console.error('Error unstaking tokens:', err);
            return null;
        }
    }

    /**
     * Get staked amount for user
     * @param {string} address - User address
     * @returns {string} Staked amount in BIO
     */
    async getStakedAmount(address) {
        try {
            const staked = await this.contractManager.callFunction(
                'BIOStaking',
                'getStaked',
                [address]
            );

            return this.contractManager.formatTokenAmount(staked, this.tokenDecimals);
        } catch (err) {
            console.error('Error getting staked amount:', err);
            return '0';
        }
    }

    /**
     * Get pending rewards for user
     * @param {string} address - User address
     * @returns {string} Pending rewards in BIO
     */
    async getPendingRewards(address) {
        try {
            const rewards = await this.contractManager.callFunction(
                'BIOStaking',
                'getPendingRewards',
                [address]
            );

            return this.contractManager.formatTokenAmount(rewards, this.tokenDecimals);
        } catch (err) {
            console.error('Error getting pending rewards:', err);
            return '0';
        }
    }

    /**
     * Claim staking rewards
     * @param {object} signer - ethers.js signer
     * @returns {object} Transaction response
     */
    async claimRewards(signer) {
        try {
            console.log('Claiming staking rewards...');
            const tx = await this.contractManager.sendTransaction(
                'BIOStaking',
                'claimRewards',
                [],
                signer
            );

            return tx;
        } catch (err) {
            console.error('Error claiming rewards:', err);
            return null;
        }
    }

    /**
     * Get current staking APY
     * @returns {number} APY percentage
     */
    async getCurrentAPY() {
        try {
            const apy = await this.contractManager.callFunction(
                'BIOStaking',
                'getAPY',
                []
            );

            // Convert from contract format (might be basis points)
            return parseInt(apy) / 100;
        } catch (err) {
            console.warn('Error getting APY, using default:', err);
            return this.stakingConfig.baseAPY;
        }
    }

    /**
     * Get total staked on network
     * @returns {string} Total staked in BIO
     */
    async getTotalStaked() {
        try {
            const total = await this.contractManager.callFunction(
                'BIOStaking',
                'getTotalStaked',
                []
            );

            return this.contractManager.formatTokenAmount(total, this.tokenDecimals);
        } catch (err) {
            console.error('Error getting total staked:', err);
            return '0';
        }
    }

    /**
     * Calculate estimated rewards for amount and period
     * @param {number|string} amount - Stake amount in BIO
     * @param {number} days - Staking period in days
     * @param {number} apy - APY percentage
     * @returns {number} Estimated rewards in BIO
     */
    calculateEstimatedRewards(amount, days, apy = null) {
        const rate = apy || this.stakingConfig.baseAPY;
        const dailyRate = rate / 365;
        const rewards = parseFloat(amount) * (dailyRate / 100) * days;
        return parseFloat(rewards.toFixed(6));
    }

    /**
     * Get transaction fee
     * @param {string} txType - Type of transaction (transfer, stake, unstake, etc)
     * @returns {number} Fee percentage
     */
    getTransactionFee(txType) {
        const fees = {
            transfer: 0.1,      // 0.1%
            stake: 0.0,         // No fee
            unstake: 0.5,       // 0.5%
            claim: 0.0,         // No fee
            governance: 0.0,    // No fee
            analysis: 1.0       // 1% for analysis features
        };

        return fees[txType] || 0;
    }

    /**
     * Calculate net amount after fees
     * @param {number|string} amount - Gross amount
     * @param {string} txType - Transaction type
     * @returns {string} Net amount after fees
     */
    calculateNetAmount(amount, txType) {
        const feePercent = this.getTransactionFee(txType);
        const fee = parseFloat(amount) * (feePercent / 100);
        const net = parseFloat(amount) - fee;
        return net.toFixed(6);
    }

    /**
     * Get governance voting power
     * @param {string} address - User address
     * @returns {string} Voting power in BIO
     */
    async getVotingPower(address) {
        try {
            const power = await this.contractManager.callFunction(
                'BIOGovernance',
                'getVotes',
                [address]
            );

            return this.contractManager.formatTokenAmount(power, this.tokenDecimals);
        } catch (err) {
            console.error('Error getting voting power:', err);
            return '0';
        }
    }

    /**
     * Vote on proposal
     * @param {number} proposalId - Proposal ID
     * @param {number} support - 0=against, 1=for, 2=abstain
     * @param {object} signer - ethers.js signer
     * @returns {object} Transaction response
     */
    async vote(proposalId, support, signer) {
        try {
            if (![0, 1, 2].includes(support)) {
                throw new Error('Invalid support value: 0=against, 1=for, 2=abstain');
            }

            console.log(`Voting on proposal ${proposalId}...`);
            const tx = await this.contractManager.sendTransaction(
                'BIOGovernance',
                'vote',
                [proposalId, support],
                signer
            );

            return tx;
        } catch (err) {
            console.error('Error voting:', err);
            return null;
        }
    }

    /**
     * Get token economics dashboard data
     * @param {string} address - User address (optional)
     * @returns {object} Dashboard data
     */
    async getDashboardData(address = null) {
        try {
            const [totalSupply, totalStaked, currentAPY] = await Promise.all([
                this.getTotalSupply(),
                this.getTotalStaked(),
                this.getCurrentAPY()
            ]);

            let userData = null;
            if (address && ethers.utils.isAddress(address)) {
                const [balance, staked, pending, votingPower] = await Promise.all([
                    this.getTokenBalance(address),
                    this.getStakedAmount(address),
                    this.getPendingRewards(address),
                    this.getVotingPower(address)
                ]);

                userData = { balance, staked, pending, votingPower };
            }

            return {
                network: {
                    chainId: this.networkManager.currentChainId,
                    name: this.networkManager.currentNetworkName
                },
                token: {
                    totalSupply,
                    totalStaked,
                    stakingPercentage: (parseFloat(totalStaked) / parseFloat(totalSupply) * 100).toFixed(2),
                    currentAPY: currentAPY.toFixed(2)
                },
                user: userData
            };
        } catch (err) {
            console.error('Error getting dashboard data:', err);
            return null;
        }
    }
}

// Create global instance
let tokenManager = null;

function initTokenManager(contractManager, networkManager) {
    tokenManager = new TokenManager(contractManager, networkManager);
    console.log('TokenManager initialized');
    return tokenManager;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TokenManager, initTokenManager };
}
