// ========== USER PROFILE & LOCAL STORAGE ==========
// Extracted from bio-core.js

async function saveUserProfile() {
    if (!account) return;
    let profile = { wallet_address: account, bio_balance: tokenBalance, saved_analyses: [] };
    localStorage.setItem(`profile_${account}`, JSON.stringify(profile));
}

async function loadUserProfile() {
    if (!account) return;
    let local = localStorage.getItem(`profile_${account}`);
    if (local) {
        let profile = JSON.parse(local);
        tokenBalance = profile.bio_balance || 0;
        document.getElementById('tokens').innerText = tokenBalance;
        cm.showNotification("Profile loaded");
    }
}

async function displayProfile() {
    if (!account) {
        document.getElementById('profileInfo').innerHTML = '<p>Connect wallet to see your profile.</p>';
        return;
    }
    let profile = JSON.parse(localStorage.getItem(`profile_${account}`) || '{}');
    document.getElementById('profileInfo').innerHTML = `
        <p><strong>Wallet:</strong> ${account.slice(0,6)}...${account.slice(-4)}</p>
        <p><strong>$BIO Balance:</strong> ${profile.bio_balance || 0}</p>
        <p><strong>Saved analyses:</strong> ${profile.saved_analyses?.length || 0}</p>
    `;
}

async function clearUserData() {
    if (!account) return;
    localStorage.removeItem(`profile_${account}`);
    localStorage.removeItem(`bioTokens_${account}`);
    tokenBalance = 0;
    document.getElementById('tokens').innerText = tokenBalance;
    cm.showNotification("All data cleared");
    displayProfile();
}
