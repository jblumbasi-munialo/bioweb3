// ========== WALLET & BLOCKCHAIN INTEGRATION ==========
// Extracted from bio-core.js

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        const btn = document.getElementById('connectWallet');
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting…';
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            account = accounts[0];
            web3 = new Web3(window.ethereum);

            const saved = localStorage.getItem(`bioTokens_${account}`);
            if (saved) tokenBalance = parseInt(saved);
            document.getElementById('tokens').innerText = tokenBalance;

            btn.innerHTML = `<i class="fas fa-check-circle"></i> ${account.slice(0,6)}...`;
            btn.disabled = false;
            document.getElementById('walletStatus').innerHTML = `
                <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                <h4>Connected</h4>
                <p class="text-muted small mb-1">${account}</p>
                <p>$BIO: <span id="bioBal">${tokenBalance}</span></p>
                <button class="btn btn-sm btn-outline-danger mt-2" onclick="disconnectWallet()">Disconnect</button>
            `;
            loadUserProfile();
            displayProfile();
        } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
            cm.showNotification('⚠️ Connection rejected. Please approve in MetaMask.');
        }
    } else {
        showNoWalletModal();
    }
}

function disconnectWallet() {
    account = null;
    tokenBalance = 0;
    document.getElementById('tokens').innerText = 0;
    const btn = document.getElementById('connectWallet');
    btn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
    document.getElementById('walletStatus').innerHTML = `
        <i class="fas fa-link fa-2x mb-2"></i>
        <h4>Connect Wallet</h4>
        <p>Earn BIO tokens for each analysis (KES rewards)</p>
    `;
    const profileInfo = document.getElementById('profileInfo');
    if (profileInfo) profileInfo.innerHTML = '<p>Connect your wallet to view your profile.</p>';
}

function showNoWalletModal() {
    document.getElementById('noWalletModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'noWalletModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <i class="fas fa-wallet" style="font-size:3rem;color:#2c7a47;margin-bottom:16px;display:block;"></i>
            <h4 style="margin-bottom:8px;">No Wallet Detected</h4>
            <p style="color:#555;margin-bottom:20px;">
                To earn $BIO tokens you need a Web3 wallet like MetaMask.<br>
                <strong>You can still use all analysis features without a wallet.</strong>
            </p>
            <a href="https://metamask.io/download/" target="_blank" rel="noopener"
               style="display:inline-block;padding:10px 20px;background:#2c7a47;color:#fff;border-radius:8px;text-decoration:none;margin-right:8px;">
               <i class="fas fa-download"></i> Install MetaMask
            </a>
            <button onclick="document.getElementById('noWalletModal').remove()"
                    style="padding:10px 20px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer;">
                Continue without wallet
            </button>
        </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

async function recordCurrent() {
    addRecord("Manual entry", "Research data", 10);
    cm.showNotification("Recorded on blockchain!");
}
