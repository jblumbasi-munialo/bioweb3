# Phase 3 Deployment Guide

## Overview
Phase 3 blockchain implementation is complete. This guide walks through final deployment steps.

## Completed Components

### Ledger System (Offline-First)
- **bio-ledger-db.js** - IndexedDB storage with transaction history
- **bio-ledger-sync.js** - Cloud sync to Supabase with conflict resolution

### Token Economics
- **bio-token-manager.js** - Staking, rewards, fees, governance
- **bio-network-manager.js** - Multi-chain support (Ethereum, Polygon, BSC, Arbitrum)

### Analytics & Reporting
- **bio-tx-analytics.js** - Dashboard, tax reports, performance metrics
- **bio-wallet-advanced.js** - MetaMask, WalletConnect, Ledger, Trezor, multi-sig

### Integration
- **bio-phase3-manager.js** - Master orchestrator for all components
- **index.html** - Updated with all Phase 3 script imports

## Pre-Deployment Checklist

### 1. Configure Supabase
```bash
# Create Supabase project at https://supabase.com
# Get project URL and anon key from settings
```

**Create database schema:**
```sql
-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tx_id TEXT UNIQUE NOT NULL,
  tx_hash TEXT,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  type TEXT, -- transfer, stake, unstake, claim, reward
  amount DECIMAL(30, 8),
  amount_bio DECIMAL(30, 8),
  usd_value DECIMAL(20, 2),
  chain TEXT,
  chain_id INTEGER,
  status TEXT,
  gas_used DECIMAL(20, 8),
  gas_price TEXT,
  gas_cost DECIMAL(20, 8),
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  metadata JSONB,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX idx_user_id ON transactions(user_id);
CREATE INDEX idx_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_created_at ON transactions(created_at DESC);

-- Ledger table
CREATE TABLE ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  account TEXT NOT NULL,
  action TEXT, -- analysis, reward, stake, withdrawal
  details JSONB,
  timestamp TIMESTAMP DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX idx_account ON ledger(account);
CREATE INDEX idx_action ON ledger(action);

-- Enable row-level security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Users can access own transactions" ON transactions
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Grant permissions
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON ledger TO authenticated;
```

### 2. Configure Environment Variables

**Create `.env` file in project root:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_anon_key_here
VITE_RPC_MAINNET=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
VITE_RPC_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
VITE_RPC_BSC=https://bsc-dataseed1.binance.org/
VITE_RPC_ARBITRUM=https://arb1.arbitrum.io/rpc
VITE_WALLET_CONNECT_ID=your_walletconnect_project_id
```

### 3. Update Hardcoded Values

**In bio-contracts.js:**
- Update `contractAddresses` with deployed smart contract addresses
- Update RPC endpoints with actual API keys

**In bio-phase3-manager.js:**
- Update `supabaseUrl` and `supabaseKey` in initialization

### 4. Deploy Smart Contracts (Optional)

If implementing on-chain token economics:

**Deploy sequence:**
```bash
# 1. Deploy BIOToken.sol (ERC-20)
# 2. Deploy BIOStaking.sol
# 3. Deploy BIORewards.sol
# 4. Deploy BIOGovernance.sol
# Update addresses in bio-contracts.js
```

### 5. Build & Deploy Frontend

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to hosting
# Option A: Netlify
netlify deploy --prod --dir=dist

# Option B: Vercel
vercel deploy --prod

# Option C: GitHub Pages
npm run build
git add .
git commit -m "Phase 3 deployment"
git push origin main
```

## Runtime Configuration

### Initialize Phase 3 on Page Load

**Add to your app startup (e.g., in bio-loader.js or main initialization):**

```javascript
// Initialize Phase 3 blockchain system
async function initBlockchain() {
    try {
        const phase3 = await initPhase3({
            supabaseUrl: process.env.VITE_SUPABASE_URL,
            supabaseKey: process.env.VITE_SUPABASE_KEY,
            autoSync: true,
            syncInterval: 30000
        });

        window.phase3Manager = phase3;
        console.log('Blockchain system ready');

        // Listen for events
        phase3.on('phase3:ready', () => {
            console.log('Phase 3 initialized');
        });

        phase3.on('phase3:staked', (data) => {
            console.log('Staked:', data);
            // Update UI
        });

        phase3.on('phase3:claimed', (data) => {
            console.log('Claimed rewards:', data);
            // Update UI
        });

    } catch (error) {
        console.error('Blockchain initialization failed:', error);
    }
}

// Call on app startup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlockchain);
} else {
    initBlockchain();
}
```

## Usage Examples

### Connect Wallet
```javascript
const wallet = await window.phase3Manager.connectWallet('metamask');
console.log('Connected:', wallet.address);
```

### Stake Tokens
```javascript
const tx = await window.phase3Manager.stake('1000');
console.log('Staked:', tx);
```

### Get Dashboard
```javascript
const dashboard = await window.phase3Manager.getDashboard();
console.log('Dashboard:', dashboard);
```

### Export Transactions
```javascript
await window.phase3Manager.exportTransactions('csv');
// Downloads transactions.csv
```

### Claim Rewards
```javascript
const rewards = await window.phase3Manager.claimRewards();
console.log('Rewards claimed:', rewards);
```

## Testing Checklist

### Offline Functionality
- [ ] Add transactions with no internet
- [ ] Verify transactions queued in IndexedDB
- [ ] Connect to internet
- [ ] Verify auto-sync completes
- [ ] Verify transactions synced to Supabase

### Multi-Chain
- [ ] Connect to Ethereum mainnet
- [ ] Switch to Polygon
- [ ] Switch to BSC
- [ ] Switch to Arbitrum
- [ ] Verify contract calls work on each chain

### Analytics
- [ ] Generate dashboard report
- [ ] Export to CSV
- [ ] Export to JSON
- [ ] Get tax report for year
- [ ] Get performance metrics

### Wallets
- [ ] Connect with MetaMask
- [ ] Connect with WalletConnect
- [ ] Connect with Ledger (physical device)
- [ ] Create multi-sig wallet
- [ ] Test multi-sig proposal/approval

### Error Handling
- [ ] Test with invalid RPC endpoint
- [ ] Test with invalid contract address
- [ ] Test with insufficient balance
- [ ] Test network disconnect/reconnect
- [ ] Verify error events emitted

## Troubleshooting

### "MetaMask not installed"
- Install MetaMask browser extension
- Allow access to website in MetaMask settings

### "Supabase connection failed"
- Verify environment variables are correct
- Check Supabase project is active
- Verify API key has correct permissions

### "Invalid contract address"
- Verify contract deployed to current chain
- Check bio-contracts.js has correct addresses
- Ensure contract is compatible with ethers.js

### "Gas estimation failed"
- Verify RPC endpoint is working
- Check account has sufficient balance for gas
- Verify contract function parameters are correct

### "Sync fails silently"
- Check browser console for errors
- Verify Supabase tables exist
- Check row-level security policies
- Verify user is authenticated

## Post-Deployment

### Monitor Performance
- Track average transaction confirmation time
- Monitor gas costs across chains
- Track user engagement metrics
- Monitor error rates

### Gather Feedback
- Survey users on blockchain features
- Track feature adoption rates
- Collect bug reports

### Plan Phase 4 (Future)
- Advanced DeFi integrations
- Cross-chain bridges
- DAO governance expansion
- NFT marketplace integration

## Support

For issues or questions:
1. Check console logs for error messages
2. Review Supabase dashboard for data issues
3. Verify contract addresses and RPC endpoints
4. Check browser network tab for API calls

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| bio-ledger-db.js | 550+ | IndexedDB operations |
| bio-ledger-sync.js | 420+ | Cloud sync logic |
| bio-tx-analytics.js | 660+ | Analytics & reporting |
| bio-wallet-advanced.js | 580+ | Multi-wallet support |
| bio-phase3-manager.js | 420+ | Master orchestrator |
| bio-network-manager.js | 300+ | Multi-chain support |
| bio-token-manager.js | 470+ | Token economics |

**Total Phase 3 Code: 4,000+ lines**

