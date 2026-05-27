// ========== GLOBAL STATE & WALLET ==========
// Extracted from bio-core.js

let web3, account;
let analysisCount = 0, structCount = 0, drugCount = 0, tokenBalance = 0;
let ledger = [];
let currentStructure = null;
let currentAccession = null;

// Supabase configuration
const SUPABASE_URL  = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON = "YOUR_ANON_KEY_HERE";
let supabaseClient = null;

function initSupabase() {
    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        console.warn('Supabase not configured. Data tabs will use GitHub CSV fallbacks.');
        return false;
    }
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        console.log('✅ Supabase initialised');
        return true;
    } catch (err) {
        console.error('Supabase init failed:', err);
        return false;
    }
}

async function dbFetch(table, options = {}) {
    if (!supabaseClient) {
        return { data: null, error: 'Supabase not configured – using CSV fallback' };
    }
    try {
        let query = supabaseClient.from(table).select(options.select || '*');
        if (options.filter) query = query.match(options.filter);
        if (options.limit)  query = query.limit(options.limit);
        const { data, error } = await query;
        return { data, error: error ? error.message : null };
    } catch (err) {
        return { data: null, error: err.message };
    }
}

function addRecord(type, data, reward = 10) {
    let rec = { type, data, time: new Date().toLocaleTimeString(), hash: '0x' + Math.random().toString(36).substr(2,8) };
    ledger.unshift(rec);
    let ledgerDiv = document.getElementById('ledger');
    if (ledgerDiv) {
        ledgerDiv.innerHTML = ledger.slice(0,8).map(r => `
            <div class='bg-light p-2 mb-2 rounded'>
                <small>${r.time}</small> <strong>${r.type}</strong><br>${r.data}<br><code>${r.hash}</code>
            </div>
        `).join('');
    }
    tokenBalance += reward;
    document.getElementById('tokens').innerText = tokenBalance;
    if (account) localStorage.setItem(`bioTokens_${account}`, tokenBalance);
    if (document.getElementById('bioBal')) document.getElementById('bioBal').innerText = tokenBalance;
}
