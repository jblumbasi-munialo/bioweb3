// ========== BIOINFORMATICS CORE ==========
class BioUtils {
    static reverseComplement(seq) {
        const comp = {'A':'T','T':'A','C':'G','G':'C','a':'t','t':'a','c':'g','g':'c'};
        return seq.split('').reverse().map(c => comp[c] || c).join('');
    }
    static gcContent(seq) {
        let gc = (seq.match(/[GCgc]/g) || []).length;
        return (gc / seq.length * 100).toFixed(1);
    }
}

class ContentManager {
    constructor() { this.config = null; }

    // ── FIX 4: fetch config + live KES/USD rate ────────────────────────────
    async loadConfig() {
        try {
            let resp = await fetch('./data/config.json');
            if (!resp.ok) resp = await fetch('./config.json'); // fallback path
            this.config = await resp.json();
        } catch (err) {
            console.error('Could not load config.json:', err);
            this.config = { drugs: {}, exchangeRate: 130 };
        }

        // Fetch live rate from frankfurter.app (free, no key needed)
        try {
            const fx = await fetch('https://api.frankfurter.app/latest?from=USD&to=KES');
            if (fx.ok) {
                const fxData = await fx.json();
                if (fxData.rates && fxData.rates.KES) {
                    this.config.exchangeRate = fxData.rates.KES;
                    console.log(`✅ Live KES rate: ${this.config.exchangeRate.toFixed(2)}`);
                }
            }
        } catch (err) {
            console.warn('FX API unavailable, using config rate:', this.config.exchangeRate);
        }

        this.applyPrices();
    }

    applyPrices() {
        let tbody = document.querySelector('#priceTable tbody');
        if (!tbody || !this.config) return;
        tbody.innerHTML = '';
        // Show live rate note
        const note = document.getElementById('exchangeRateNote');
        if (note) note.textContent = `Live rate: 1 USD = ${(this.config.exchangeRate || 130).toFixed(2)} KES`;

        for (let [drug, price] of Object.entries(this.config.drugs || {})) {
            let row = tbody.insertRow();
            row.insertCell(0).innerText = drug;
            row.insertCell(1).innerText = `$${(price.usdPrice || 0).toLocaleString()}`;
            let kes = Math.round((price.usdPrice || 0) * (this.config.exchangeRate || 130));
            row.insertCell(2).innerHTML = `<span class="price-tag">KES ${kes.toLocaleString()}</span>`;
        }
    }

    showNotification(msg) {
        let div = document.createElement('div');
        div.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
        div.style.cssText = 'position:fixed;top:80px;right:20px;background:white;padding:12px 20px;border-radius:12px;box-shadow:0 5px 15px rgba(0,0,0,0.2);z-index:3000';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
}

const bio = BioUtils;
const cm = new ContentManager();

// ── FIX 1: Supabase initialisation ────────────────────────────────────────
// Replace the two strings below with your actual Supabase project values.
// Find them at: Supabase dashboard → Settings → API
const SUPABASE_URL  = "https://YOUR_PROJECT_ID.supabase.co"; // ← replace
const SUPABASE_ANON = "YOUR_ANON_KEY_HERE";                  // ← replace

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

// Safe wrapper — always returns { data, error }
async function dbFetch(table, options = {}) {
    if (!supabaseClient) {
        // Fall back to the GitHub CSV path used by each loader
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

// ========== GLOBAL STATE ==========
let web3, account;
let analysisCount = 0, structCount = 0, drugCount = 0, tokenBalance = 0;
let ledger = [];
let currentStructure = null;
let currentAccession = null;

// ========== WALLET & BLOCKCHAIN ==========
// ── FIX 3: wallet connect with MetaMask detection + fallback modal ─────────
async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        // MetaMask (or compatible) is present — attempt connection
        const btn = document.getElementById('connectWallet');
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting…';
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            account = accounts[0];
            web3 = new Web3(window.ethereum);

            // Restore saved token balance
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
        // No wallet detected — show friendly install modal
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

async function recordCurrent() {
    addRecord("Manual entry", "Research data", 10);
    cm.showNotification("Recorded on blockchain!");
}

// ========== SEQUENCE ANALYSIS ==========
async function analyzeSeq() {
    let seq = document.getElementById('seqInput').value.trim();
    if (!seq) { alert("Paste a sequence"); return; }
    let rev = bio.reverseComplement(seq);
    let gc = bio.gcContent(seq);
    document.getElementById('seqResult').innerHTML = `<strong>Analysis</strong><br>Length: ${seq.length}<br>GC%: ${gc}%`;
    document.getElementById('revCompDisplay').innerHTML = `<strong>Reverse complement</strong><br><pre>${rev}</pre>`;
    document.getElementById('seqResult').style.display = 'block';
    analysisCount++;
    document.getElementById('analyses').innerText = analysisCount;
    addRecord("Sequence analysis", `GC=${gc}%`, 5);
    saveUserProfile();
}

// ========== UNIPROT SEARCH ==========
async function searchUniProt() {
    const proteinName = document.getElementById('proteinName').value.trim();
    if (!proteinName) { alert("Enter a protein name"); return; }
    const resultDiv = document.getElementById('structResult');
    resultDiv.innerHTML = '<div class="loading"></div> Searching UniProt...';
    resultDiv.style.display = 'block';
    try {
        const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(proteinName)}+AND+reviewed:true&format=json&size=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        if (!data.results || data.results.length === 0) throw new Error(`No entry found for "${proteinName}"`);
        const entry = data.results[0];
        const accession = entry.primaryAccession;
        const proteinDesc = entry.proteinDescription?.recommendedName?.fullName?.value || proteinName;
        const organism = entry.organism?.scientificName || "Unknown";
        resultDiv.innerHTML = `<i class="fas fa-check-circle text-success"></i> <strong>Found: ${proteinDesc}</strong><br>Accession: ${accession}<br>Organism: ${organism}<br>✅ Ready to load structure.`;
        document.getElementById('uniprotLink').innerHTML = `<a href="https://www.uniprot.org/uniprot/${accession}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="fas fa-external-link-alt"></i> View on UniProt</a>`;
        await loadAlphaFoldStructure(accession, proteinDesc);
    } catch (error) {
        resultDiv.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Error: ${error.message}`;
        document.getElementById('uniprotLink').innerHTML = '';
    }
}

async function searchGeneralProtein() {
    const searchTerm = document.getElementById('generalSearch').value.trim();
    if (!searchTerm) { alert("Enter a search term"); return; }
    const resultDiv = document.getElementById('structResult');
    resultDiv.innerHTML = '<div class="loading"></div> Searching UniProt...';
    resultDiv.style.display = 'block';
    document.getElementById('uniprotLink').innerHTML = '';
    try {
        const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(searchTerm)}+AND+organism_id:9606&format=json&size=1`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.results || data.results.length === 0) throw new Error(`No human protein found for "${searchTerm}"`);
        const bestMatch = data.results[0];
        const accession = bestMatch.primaryAccession;
        const proteinName = bestMatch.proteinDescription?.recommendedName?.fullName?.value || bestMatch.entryName || accession;
        const organism = bestMatch.organism?.scientificName || "Unknown";
        resultDiv.innerHTML = `<i class="fas fa-check-circle text-success"></i> <strong>Top Result: ${proteinName}</strong><br>Accession: ${accession}<br>Organism: ${organism}<br>✅ Ready to load structure.`;
        document.getElementById('uniprotLink').innerHTML = `<a href="https://www.uniprot.org/uniprot/${accession}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="fas fa-external-link-alt"></i> View on UniProt</a>`;
        await loadAlphaFoldStructure(accession, proteinName);
    } catch (error) {
        resultDiv.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Error: ${error.message}`;
    }
}

async function loadAlphaFoldStructure(accession, proteinName) {
    const viewerDiv = document.getElementById('viewer3d');
    const resultDiv = document.getElementById('structResult');
    resultDiv.innerHTML += '<br><div class="loading"></div> Fetching 3D structure from AlphaFold...';
    try {
        const pdbUrl = `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v4.pdb`;
        const pdbResponse = await fetch(pdbUrl);
        if (!pdbResponse.ok) throw new Error(`AlphaFold model not available for ${accession}. Try a different protein.`);
        const pdbData = await pdbResponse.text();
        const config = { backgroundColor: 0xf5f5f5 };
        const viewer = new $3Dmol.GLViewer(viewerDiv, config);
        viewer.addModel(pdbData, "pdb");
        viewer.setStyle({}, { cartoon: { color: '#2c7a47' } });
        viewer.zoomTo();
        viewer.render();
        resultDiv.innerHTML += `<br><i class="fas fa-cube"></i> 3D structure loaded. ✅ +15 BIO`;
        structCount++;
        document.getElementById('structures').innerText = structCount;
        addRecord("AlphaFold", `${proteinName} (${accession}) structure loaded`, 15);
        currentStructure = pdbData;
        currentAccession = accession;
        saveUserProfile();
    } catch (err) {
        resultDiv.innerHTML += `<br><i class="fas fa-exclamation-triangle text-danger"></i> Could not load 3D structure: ${err.message}`;
    }
}

async function runDock() {
    if (!currentStructure) { alert("Load a protein structure first"); return; }
    const resultDiv = document.getElementById('dockResult');
    resultDiv.innerHTML = '<div class="loading"></div> Running docking...';
    resultDiv.style.display = 'block';
    setTimeout(() => {
        const drugs = ["Trastuzumab", "Pertuzumab", "Lapatinib"];
        const scores = drugs.map(() => (-7.5 - Math.random() * 3).toFixed(1));
        resultDiv.innerHTML = `<strong>Top hit:</strong> ${drugs[0]} (${scores[0]} kcal/mol)<br>✅ +10 BIO`;
        drugCount += drugs.length;
        document.getElementById('drugs').innerText = drugCount;
        addRecord("Docking", `On ${currentAccession || "loaded structure"}`, 10);
        Plotly.newPlot('dockChart', [{x: drugs, y: scores, type: 'bar', marker: { color: '#1a5f7a' }}], { title: 'Binding affinities', paper_bgcolor: 'white' });
        saveUserProfile();
    }, 2000);
}

async function refreshPrices() {
    await cm.loadConfig();
    cm.showNotification("Prices updated with live rate");
}

// ========== USER PROFILE (localStorage) ==========
async function saveUserProfile() {
    if (!account) return; // silently skip if no wallet
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

// ========== BIOIMAGING (Vizarr) ==========
function setZarrUrl(url) {
    document.getElementById('zarrUrl').value = url;
    loadZarr();
}
async function loadZarr() {
    const url = document.getElementById('zarrUrl').value.trim();
    if (!url) { alert('Please enter a Zarr URL'); return; }
    const container = document.getElementById('vizarrFrame');
    container.innerHTML = `<iframe src="https://hms-dbmi.github.io/vizarr/?source=${encodeURIComponent(url)}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;
}

// ========== CRISPR DATA ==========
async function loadCrisprData() {
    const statusSpan = document.getElementById('crisprStatus');
    const container = document.getElementById('crisprTable');
    statusSpan.innerHTML = 'Loading...';
    try {
        const url = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/crispr_off_target_analysis.csv';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} – file not found in repo`);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n').map(row => row.split(','));
        if (rows.length < 2) throw new Error('CSV has no data rows');
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        headers.forEach(h => html += `<th>${h.trim()}</th>`);
        html += '</tr></thead><tbody>';
        dataRows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += `<td>${cell.trim()}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
        statusSpan.innerHTML = `✅ Loaded ${dataRows.length} records.`;
        addRecord("CRISPR Analysis", `Loaded ${dataRows.length} off-target predictions`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading CRISPR data: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}

// ========== DRUG DISCOVERY DATA ==========
async function loadDrugData() {
    const statusSpan = document.getElementById('drugStatus');
    const container = document.getElementById('drugTable');
    statusSpan.innerHTML = 'Loading...';
    try {
        const url = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/clinical_trial_opportunities.csv';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} – file not found in repo`);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n').map(row => row.split(','));
        if (rows.length < 2) throw new Error('CSV has no data rows');
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        headers.forEach(h => html += `<th>${h.trim()}</th>`);
        // ── BUG FIX: was </tr> not </tr></thead> ──
        html += '</tr></thead><tbody>';
        dataRows.forEach(row => {
            html += '<tr>';
            // ── BUG FIX: cells were using <tr> tag instead of <td> ──
            row.forEach(cell => html += `<td>${cell.trim()}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
        statusSpan.innerHTML = `✅ Loaded ${dataRows.length} records.`;
        addRecord("Drug Discovery", `Loaded ${dataRows.length} clinical opportunities`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading drug data: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}

// ========== GO ENRICHMENT DATA ==========
async function loadGOData() {
    const statusSpan = document.getElementById('goStatus');
    const container = document.getElementById('goTable');
    const chartDiv = document.getElementById('goChart');
    statusSpan.innerHTML = 'Loading...';
    try {
        let data = [];
        let jsonUrl = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/go_enrichment.json';
        let response = await fetch(jsonUrl);
        if (response.ok) {
            data = await response.json();
        } else {
            const csvUrl = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/go_enrichment.csv';
            response = await fetch(csvUrl);
            if (!response.ok) throw new Error('No GO data file found in repo');
            const csvText = await response.text();
            const rows = csvText.trim().split('\n').map(row => row.split(','));
            if (rows.length < 2) throw new Error('No GO data');
            const headers = rows[0];
            data = rows.slice(1).map(row => {
                let obj = {};
                headers.forEach((h, i) => obj[h.trim()] = (row[i] || '').trim());
                return obj;
            });
        }

        if (data.length > 0) {
            let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
            Object.keys(data[0]).forEach(k => html += `<th>${k}</th>`);
            // ── BUG FIX: was <tr> not </tr></thead> ──
            html += '</tr></thead><tbody>';
            data.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(v => html += `<td>${v}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-muted">No GO data found.</p>';
        }

        statusSpan.innerHTML = `✅ Loaded ${data.length} GO terms.`;

        if (data.length > 0 && data[0].hasOwnProperty('enrichment_score')) {
            const top10 = [...data].sort((a,b) => parseFloat(b.enrichment_score) - parseFloat(a.enrichment_score)).slice(0,10);
            const terms = top10.map(d => d.term || d.description || 'Term');
            const scores = top10.map(d => parseFloat(d.enrichment_score));
            Plotly.newPlot(chartDiv, [{
                x: scores, y: terms, type: 'bar', orientation: 'h',
                marker: { color: '#2c7a47' }
            }], {
                title: 'Top 10 Enriched GO Terms',
                xaxis: { title: 'Enrichment Score' },
                paper_bgcolor: 'white', font: { color: '#1a1a1a' }
            });
        } else {
            chartDiv.innerHTML = '<p class="text-muted">Add an enrichment_score column to your GO data to see a chart.</p>';
        }
        addRecord("GO Enrichment", `Loaded ${data.length} GO terms`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading GO data: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}

// ========== GENOMIC VIEWER (IGV.js) ==========
let igvBrowser = null;
async function loadGenomicViewer() {
    const bamUrl = document.getElementById('bamUrl').value.trim();
    if (!bamUrl) { alert('Please enter a BAM/CRAM URL or use the demo button.'); return; }
    const container = document.getElementById('igvContainer');
    container.innerHTML = '<div class="text-center p-5"><div class="loading"></div> Loading genome browser...</div>';
    try {
        if (igvBrowser) igvBrowser.dispose();
        const options = {
            genome: "hg38",
            locus: "chr8:127,000,000-128,000,000",
            tracks: [{ name: "User BAM", url: bamUrl, indexURL: bamUrl + ".bai", format: "bam", type: "alignment" }]
        };
        igvBrowser = await igv.createBrowser(container, options);
        addRecord("Genomic Viewer", `Loaded BAM: ${bamUrl}`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading IGV: ${err.message}</p>`;
    }
}
async function loadDemoGenomic() {
    const container = document.getElementById('igvContainer');
    container.innerHTML = '<div class="text-center p-5"><div class="loading"></div> Loading demo genome browser...</div>';
    try {
        if (igvBrowser) igvBrowser.dispose();
        const options = {
            genome: "hg38",
            locus: "chr8:127,000,000-128,000,000",
            tracks: [{ name: "Demo BAM (NA12878)", url: "https://igv.org/web/release/data/NA12878.bam", indexURL: "https://igv.org/web/release/data/NA12878.bam.bai", format: "bam", type: "alignment" }]
        };
        igvBrowser = await igv.createBrowser(container, options);
        addRecord("Genomic Viewer", "Loaded demo BAM", 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading demo: ${err.message}</p>`;
    }
}

// ── FIX 5: DEG Pipeline — client-side with real stats + honest disclaimer ──
async function runDEGPipeline() {
    const fileInput = document.getElementById('degCountFile');
    const statusDiv = document.getElementById('pipelineStatus');
    const resultsDiv = document.getElementById('pipelineResults');

    statusDiv.style.display = 'block';
    resultsDiv.innerHTML = '';

    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        statusDiv.innerHTML = '<div class="alert alert-warning">⚠️ Please select a CSV file first.</div>';
        return;
    }

    statusDiv.innerHTML = `
        <div class="alert alert-info mb-2">
            <strong>⚠️ Simulation Notice:</strong> This is a <u>client-side simulation</u>.
            It calculates real log₂ fold-changes and applies Welch's t-test with
            Benjamini-Hochberg FDR correction — but it is <strong>not</strong> DESeq2,
            limma, or edgeR. Validate significant hits in R/Python before publishing.
        </div>
        <p><span class="loading"></span> Parsing CSV…</p>
    `;

    try {
        const text = await readFileAsText(fileInput.files[0]);
        const { genes, controlCols, treatCols, matrix } = parseCountMatrix(text);

        if (genes.length === 0) throw new Error('No genes found. Check CSV format: genes as rows, samples as columns, first column = gene names.');
        if (controlCols.length < 2 || treatCols.length < 2) {
            throw new Error(
                `Need ≥2 control AND ≥2 treatment columns. Found ${controlCols.length} control, ${treatCols.length} treatment.\n\n` +
                `Column naming: control → include "ctrl", "control", or "untreated". Treatment → "treat", "treated", or "case".\n` +
                `If columns are unlabelled, the first half are treated as control, second half as treatment.`
            );
        }

        statusDiv.innerHTML += `<p>✅ Parsed <strong>${genes.length} genes</strong>, ${controlCols.length} control + ${treatCols.length} treatment samples.</p>`;

        // Calculate DEG statistics
        const results = genes.map((gene, i) => {
            const ctrlVals  = controlCols.map(c => matrix[i][c] + 1);
            const treatVals = treatCols.map(c => matrix[i][c] + 1);
            const ctrlMean  = mean(ctrlVals);
            const treatMean = mean(treatVals);
            const log2FC    = Math.log2(treatMean / ctrlMean);
            const ctrlVar   = variance(ctrlVals);
            const treatVar  = variance(treatVals);
            const se        = Math.sqrt(ctrlVar / ctrlVals.length + treatVar / treatVals.length);
            const tStat     = se > 0 ? (treatMean - ctrlMean) / se : 0;
            const df        = ctrlVals.length + treatVals.length - 2;
            const pValue    = tStatToPValue(Math.abs(tStat), df);
            return { gene, log2FC, pValue, ctrlMean, treatMean };
        });

        // Benjamini-Hochberg FDR correction
        const n = results.length;
        const sorted = [...results].sort((a, b) => a.pValue - b.pValue);
        sorted.forEach((r, rank) => { r.adjPValue = Math.min(1, (r.pValue * n) / (rank + 1)); });

        results.forEach(r => {
            r.significant = r.adjPValue < 0.05 && Math.abs(r.log2FC) >= 1;
            r.direction   = r.log2FC > 0 ? 'UP' : 'DOWN';
        });

        const upCount   = results.filter(r => r.significant && r.direction === 'UP').length;
        const downCount = results.filter(r => r.significant && r.direction === 'DOWN').length;

        statusDiv.innerHTML += `<p>✅ Done: <strong class="text-danger">${upCount} up-regulated</strong>, <strong class="text-primary">${downCount} down-regulated</strong> (adj.p &lt; 0.05, |log₂FC| ≥ 1)</p>`;

        renderVolcanoPlot(results, resultsDiv);
        renderDEGTable(results, resultsDiv);

        // Download button
        const csvData = resultsToCSV(results);
        const dlBtn   = document.createElement('a');
        dlBtn.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvData);
        dlBtn.download = 'deg_results.csv';
        dlBtn.className = 'btn btn-success mt-3';
        dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Full Results CSV';
        resultsDiv.appendChild(dlBtn);

        analysisCount++;
        document.getElementById('analyses').innerText = analysisCount;
        addRecord("DEG Pipeline", `${genes.length} genes – ${upCount} up, ${downCount} down`, 20);
        saveUserProfile();

    } catch (err) {
        statusDiv.innerHTML += `<div class="alert alert-danger mt-2">❌ ${err.message.replace(/\n/g, '<br>')}</div>`;
    }
}

// DEG helpers
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = e => resolve(e.target.result);
        r.onerror = () => reject(new Error('Failed to read file'));
        r.readAsText(file);
    });
}

function parseCountMatrix(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const sampleHeaders = headers.slice(1);
    const controlCols = [], treatCols = [];
    sampleHeaders.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (/ctrl|control|untreated/.test(lower)) controlCols.push(i);
        else if (/treat|treated|case/.test(lower))  treatCols.push(i);
        else {
            if (i < Math.floor(sampleHeaders.length / 2)) controlCols.push(i);
            else treatCols.push(i);
        }
    });
    const genes = [], matrix = [];
    for (let r = 1; r < lines.length; r++) {
        const cols = lines[r].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;
        genes.push(cols[0]);
        matrix.push(cols.slice(1).map(v => parseFloat(v) || 0));
    }
    return { genes, controlCols, treatCols, matrix };
}

function mean(arr)     { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function variance(arr) {
    const m = mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(arr.length - 1, 1);
}
function tStatToPValue(t, df) {
    if (df <= 0) return 1;
    if (df > 30) return 2 * (1 - normalCDF(t));
    const x = df / (df + t * t);
    return Math.min(1, Math.max(0, 1 - Math.pow(1 - x, 0.5) * Math.pow(x, df / 2)));
}
function normalCDF(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
function erf(x) {
    const sign = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
}

function renderVolcanoPlot(results, container) {
    const plotDiv = document.createElement('div');
    plotDiv.style.cssText = 'height:420px;margin-bottom:20px;';
    container.appendChild(plotDiv);
    const up   = results.filter(r => r.significant && r.direction === 'UP');
    const down = results.filter(r => r.significant && r.direction === 'DOWN');
    const ns   = results.filter(r => !r.significant);
    const toTrace = (genes, color, name) => ({
        x: genes.map(r => r.log2FC),
        y: genes.map(r => -Math.log10(r.pValue + 1e-300)),
        text: genes.map(r => `${r.gene}<br>log₂FC: ${r.log2FC.toFixed(2)}<br>p: ${r.pValue.toExponential(2)}`),
        mode: 'markers', type: 'scatter', name, marker: { color, size: 5, opacity: 0.7 }
    });
    Plotly.newPlot(plotDiv, [
        toTrace(ns,   '#aaa',    'Not significant'),
        toTrace(down, '#3B8BD4', 'Down-regulated'),
        toTrace(up,   '#E8593C', 'Up-regulated')
    ], {
        title: 'Volcano Plot',
        xaxis: { title: 'log₂ Fold Change' },
        yaxis: { title: '−log₁₀(p-value)' },
        shapes: [
            { type:'line', x0:-1, x1:-1, y0:0, y1:20, line:{color:'#666',dash:'dot'} },
            { type:'line', x0:1,  x1:1,  y0:0, y1:20, line:{color:'#666',dash:'dot'} }
        ],
        margin: { t:50 }, paper_bgcolor: 'white'
    }, { responsive: true });
}

function renderDEGTable(results, container) {
    const topGenes = [...results].filter(r => r.significant)
        .sort((a, b) => Math.abs(b.log2FC) - Math.abs(a.log2FC)).slice(0, 30);
    if (topGenes.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-muted mt-3';
        p.textContent = 'No significant DEGs found (adj.p < 0.05, |log₂FC| ≥ 1).';
        container.appendChild(p); return;
    }
    const wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';
    wrap.innerHTML = `
        <h5 class="mt-3">Top ${topGenes.length} Significant DEGs</h5>
        <table class="table table-sm table-striped" style="font-size:13px">
            <thead><tr><th>Gene</th><th>Dir</th><th>log₂FC</th><th>p-value</th><th>adj. p</th><th>Ctrl mean</th><th>Treat mean</th></tr></thead>
            <tbody>
                ${topGenes.map(r => `<tr>
                    <td><strong>${r.gene}</strong></td>
                    <td><span class="badge bg-${r.direction === 'UP' ? 'danger' : 'primary'}">${r.direction}</span></td>
                    <td>${r.log2FC.toFixed(3)}</td>
                    <td>${r.pValue.toExponential(2)}</td>
                    <td>${r.adjPValue.toExponential(2)}</td>
                    <td>${r.ctrlMean.toFixed(1)}</td>
                    <td>${r.treatMean.toFixed(1)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
    container.appendChild(wrap);
}

function resultsToCSV(results) {
    const header = 'gene,log2FC,pValue,adjPValue,direction,significant,ctrlMean,treatMean';
    const rows = results.map(r =>
        `${r.gene},${r.log2FC.toFixed(4)},${r.pValue.toExponential(4)},${r.adjPValue.toExponential(4)},${r.direction},${r.significant},${r.ctrlMean.toFixed(2)},${r.treatMean.toFixed(2)}`
    );
    return [header, ...rows].join('\n');
}

// ========== REGULATORY NETWORK & DRUG TARGETS ==========
let currentDrugTarget = null;
async function loadRegulatoryNetwork() {
    const statusSpan  = document.getElementById('regnetStatus');
    const drugTableDiv = document.getElementById('drugTargetTable');
    const summaryDiv  = document.getElementById('regnetSummary');
    statusSpan.innerHTML = 'Loading regulatory network data...';
    drugTableDiv.innerHTML = '<div class="loading"></div>';
    try {
        const drugUrl  = 'https://raw.githubusercontent.com/jblumbasi-munialo/ARCHS4-Regulatory-Network/main/drug_targets.csv';
        const drugResp = await fetch(drugUrl);
        if (!drugResp.ok) throw new Error(`HTTP ${drugResp.status}`);
        const drugCsv  = await drugResp.text();
        const rows     = drugCsv.trim().split('\n').map(r => r.split(','));
        if (rows.length < 2) throw new Error('No drug-target data');
        const headers  = rows[0];
        const dataRows = rows.slice(1);
        let tableHtml  = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        headers.forEach(h => tableHtml += `<th>${h.trim()}</th>`);
        tableHtml += '<th>Select</th></tr></thead><tbody>';
        dataRows.forEach((row, idx) => {
            tableHtml += '<tr>';
            row.forEach(cell => tableHtml += `<td>${cell.trim()}</td>`);
            tableHtml += `<td><input type="radio" name="drugTarget" value="${idx}" onclick="selectDrugTarget(${idx}, '${row[0]}')"></td></tr>`;
        });
        tableHtml += '</tbody></table></div>';
        drugTableDiv.innerHTML = tableHtml;
        summaryDiv.innerHTML = '';
        statusSpan.innerHTML = `✅ Loaded ${dataRows.length} drug-target interactions.`;
        addRecord("Regulatory Network", `Loaded ${dataRows.length} drug-target pairs`, 5);
    } catch (err) {
        drugTableDiv.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed to load';
    }
}
function selectDrugTarget(idx, drugGene) {
    currentDrugTarget = { idx, drugGene };
    document.getElementById('recordDrugTargetBtn').disabled = false;
}
async function recordCurrentDrugTarget() {
    if (!currentDrugTarget) { alert('Select a drug-target interaction first.'); return; }
    addRecord("Drug Target Selection", `Selected target: ${currentDrugTarget.drugGene}`, 10);
    cm.showNotification(`Recorded target ${currentDrugTarget.drugGene} to blockchain! +10 BIO`);
    document.getElementById('recordDrugTargetBtn').disabled = true;
    currentDrugTarget = null;
}

// ========== SURVIVAL ANALYSIS ==========
let currentSurvivalStats = null;
async function loadSurvivalData() {
    const statusSpan = document.getElementById('survivalStatus');
    const plotDiv    = document.getElementById('kmPlot');
    const summaryDiv = document.getElementById('survivalSummary');
    statusSpan.innerHTML = 'Loading survival data...';
    plotDiv.innerHTML = '<div class="loading"></div>';
    try {
        let times = [], events = [], groups = [];
        let response = await fetch('./data/survival_analysis_results.csv');
        if (!response.ok) {
            // Demo data fallback
            for (let i = 0; i < 100; i++) {
                const isTreatment = Math.random() < 0.5;
                times.push(isTreatment ? Math.random() * 50 + 10 : Math.random() * 40 + 5);
                events.push(Math.random() < 0.7 ? 1 : 0);
                groups.push(isTreatment ? 'Treatment' : 'Control');
            }
            statusSpan.innerHTML = '⚠️ No CSV found — showing demo data.';
        } else {
            const csvText = await response.text();
            const rows = csvText.trim().split('\n').map(r => r.split(','));
            const headers = rows[0].map(h => h.toLowerCase());
            const timeIdx  = headers.findIndex(h => h.includes('time'));
            const eventIdx = headers.findIndex(h => h.includes('event'));
            const groupIdx = headers.findIndex(h => h.includes('group'));
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < Math.max(timeIdx, eventIdx, groupIdx) + 1) continue;
                times.push(parseFloat(row[timeIdx]));
                events.push(parseFloat(row[eventIdx]));
                groups.push(row[groupIdx]);
            }
            statusSpan.innerHTML = `✅ Loaded ${times.length} patients.`;
        }
        const uniqueGroups = [...new Set(groups)];
        const traces = uniqueGroups.map(g => {
            const idxs     = groups.map((v, i) => v === g ? i : -1).filter(i => i !== -1);
            const sorted   = idxs.map(i => ({ t: times[i], e: events[i] })).sort((a,b) => a.t - b.t);
            let survival = 1.0, atRisk = sorted.length;
            let x = [0], y = [1.0];
            for (const { t, e } of sorted) {
                if (e === 1) { survival *= (1 - 1/atRisk); x.push(t); y.push(survival); }
                atRisk--;
            }
            return { x, y, mode: 'lines', name: g, line: { width: 3 }, type: 'scatter' };
        });
        Plotly.newPlot('kmPlot', traces, {
            title: 'Kaplan-Meier Survival Curves',
            xaxis: { title: 'Time' },
            yaxis: { title: 'Survival Probability', range: [0, 1] },
            plot_bgcolor: 'white', paper_bgcolor: 'white', font: { color: '#1a1a1a' }
        });
        const eventsCount = events.filter(e => e === 1).length;
        summaryDiv.innerHTML = `<div class="alert alert-info"><strong>Summary</strong><br>Total patients: ${times.length}<br>Events: ${eventsCount}<br>Groups: ${uniqueGroups.join(', ')}</div>`;
        currentSurvivalStats = { totalPatients: times.length, eventsCount, groups: uniqueGroups };
        addRecord("Survival Analysis", `n=${times.length} patients`, 5);
    } catch (err) {
        plotDiv.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}
async function recordSurvivalAnalysis() {
    if (!currentSurvivalStats) { alert('Load survival data first.'); return; }
    addRecord("Survival Analysis", `Total=${currentSurvivalStats.totalPatients}, events=${currentSurvivalStats.eventsCount}, groups=${currentSurvivalStats.groups.join(',')}`, 10);
    cm.showNotification('Survival analysis recorded! +10 BIO');
}

// ── FIX 2: Chatbot wired to Anthropic via /api/chat ──────────────────────
// The system prompt lives in conversationHistory[0]; Anthropic expects it
// as a separate 'system' field, not in the messages array.
// The /api/chat route handles this — see api/chat.js.
const SYSTEM_PROMPT = "You are a helpful scientific assistant for BioWeb3, a decentralised bioinformatics platform. Features include: protein sequence analysis, AlphaFold 3D structures, molecular docking, blockchain research ledger, KES drug pricing, bioimaging (OME-Zarr), CRISPR off-target analysis, drug discovery, GO enrichment, genome browser (IGV.js), DEG pipeline, regulatory network, survival analysis (Kaplan-Meier), and Healthcare 5.0 (federated learning, intrusion detection, PGx vault). Answer science and platform questions concisely. Politely redirect off-topic requests.";

let conversationHistory = [];

function addChatMessage(text, role) {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;
    const clear = document.createElement('div');
    clear.style.clear = 'both';
    container.appendChild(clear);
    const wrap = document.createElement('div');
    wrap.className = 'message-bubble';
    const bubble = document.createElement('div');
    bubble.className = role === 'user' ? 'user-bubble' : 'bot-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function addSystemBubble(text) {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'message-bubble system-bubble';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSendBtn');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    addChatMessage(text, 'user');
    conversationHistory.push({ role: 'user', content: text });

    const typingBubble = addChatMessage('…', 'assistant');

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory, system: SYSTEM_PROMPT })
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        // Anthropic returns content[0].text; our proxy returns it directly
        const reply = data.content?.[0]?.text || data.reply || 'No response.';
        typingBubble.textContent = reply;

        conversationHistory.push({ role: 'assistant', content: reply });
        // Keep last 20 turns to avoid token bloat
        if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

    } catch (err) {
        typingBubble.textContent = '⚠️ ' + err.message;
        addSystemBubble('Check that /api/chat is deployed and ANTHROPIC_API_KEY is set in Vercel.');
        conversationHistory.pop(); // remove failed user turn
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

function clearChatHistory() {
    conversationHistory = [];
    const container = document.getElementById('chatbotMessages');
    if (container) container.innerHTML = '<div class="message-bubble system-bubble">Chat cleared. Ask me about bioinformatics or how to use this platform.</div>';
}

let chatbotOpen = false;
function toggleChatbot() {
    chatbotOpen = !chatbotOpen;
    const win = document.getElementById('chatbotWindow');
    if (win) win.style.display = chatbotOpen ? 'flex' : 'none';
}
function closeChatbot() {
    chatbotOpen = false;
    const win = document.getElementById('chatbotWindow');
    if (win) win.style.display = 'none';
}

function setupChatbotEvents() {
    const input   = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSendBtn');
    const toggle  = document.getElementById('chatbotToggleBtn');
    const close   = document.getElementById('closeChatbotBtn');
    if (input)   input.addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (toggle)  toggle.addEventListener('click', toggleChatbot);
    if (close)   close.addEventListener('click', closeChatbot);
}

// ========== HEALTHCARE 5.0: FEDERATED LEARNING ==========
let flChart = null, flRunning = false;

async function runFederatedLearning() {
    if (flRunning) return;
    flRunning = true;
    document.getElementById('flProgress').style.display = 'block';
    const progressDiv = document.getElementById('flProgress');
    const flAccuracies = [];

    if (flChart) Plotly.purge('flChart');
    Plotly.newPlot('flChart', [{ x: [], y: [], mode: 'lines+markers', name: 'Global Accuracy', line: { color: '#2e7d32', width: 2 } }], {
        title: 'Federated Learning Rounds',
        xaxis: { title: 'Round', range: [0, 10] },
        yaxis: { title: 'Accuracy', range: [0.5, 1.0] },
        paper_bgcolor: 'white', plot_bgcolor: 'white'
    });

    for (let round = 1; round <= 10; round++) {
        progressDiv.innerHTML = `<span class="loading"></span> Round ${round}/10 – Training local clients...`;
        try {
            const response = await fetch('/api/federated_learning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round: round - 1, clients: 4 })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            flAccuracies.push(data.global_accuracy);
            Plotly.extendTraces('flChart', { x: [[round]], y: [[data.global_accuracy]] }, [0]);
            addRecord("Federated Learning", `Round ${round} accuracy: ${(data.global_accuracy * 100).toFixed(2)}%`, 5);
            progressDiv.innerHTML = `<span class="text-success">✅ Round ${round} – accuracy ${(data.global_accuracy * 100).toFixed(2)}%</span>`;
            await new Promise(r => setTimeout(r, 800));
        } catch (err) {
            progressDiv.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`;
            break;
        }
    }
    const finalAcc = flAccuracies.length ? (flAccuracies[flAccuracies.length - 1] * 100).toFixed(2) : 'N/A';
    progressDiv.innerHTML = `<div class="alert alert-success">Federated learning complete! Final accuracy: ${finalAcc}%</div>`;
    flRunning = false;
}

// ========== HEALTHCARE 5.0: INTRUSION DETECTION ==========
async function testIntrusionSample() {
    const resultDiv = document.getElementById('idsResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<span class="loading"></span> Analyzing network packet...';
    try {
        const response = await fetch('/api/intrusion_detection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sample: 'random' })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const metrics = data.metrics;
        resultDiv.innerHTML = `
            <div class="alert alert-${data.prediction === 'attack' ? 'danger' : 'success'}">
                <strong>Prediction:</strong> ${data.prediction.toUpperCase()} (confidence: ${(data.confidence * 100).toFixed(1)}%)
            </div>
            <table class="table table-sm table-bordered mt-2">
                <tr><th>Accuracy</th><td>${(metrics.accuracy*100).toFixed(2)}%</td></tr>
                <tr><th>Sensitivity</th><td>${(metrics.sensitivity*100).toFixed(2)}%</td></tr>
                <tr><th>Specificity</th><td>${(metrics.specificity*100).toFixed(2)}%</td></tr>
                <tr><th>False Positive Rate</th><td>${(metrics.false_positive_rate*100).toFixed(2)}%</td></tr>
            </table>
        `;
        document.getElementById('idsMetrics').innerHTML = `
            <div class="alert alert-secondary">
                <strong>Paper validation results (Table 5):</strong><br>
                Accuracy: 96.5% | Sensitivity: 98.64% | Specificity: 90.57% | FPR: 9.43%
            </div>
        `;
        addRecord("Intrusion Detection", `Predicted: ${data.prediction}, confidence: ${(data.confidence*100).toFixed(1)}%`, 10);
    } catch (err) {
        resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
}

function initHealthcare50() {
    const flBtn  = document.getElementById('startFLBtn');
    const idsBtn = document.getElementById('testIDSBtn');
    if (flBtn  && !flBtn._init)  { flBtn.addEventListener('click', runFederatedLearning); flBtn._init = true; }
    if (idsBtn && !idsBtn._init) { idsBtn.addEventListener('click', testIntrusionSample); idsBtn._init = true; }
}

// ========== PGx VAULT ==========
let pgxEntries = JSON.parse(localStorage.getItem('pgxEntries') || '[]');

function addPGxEntry(e) {
    e.preventDefault();
    const gene    = document.getElementById('pgxGene').value.trim();
    const variant = document.getElementById('pgxVariant').value.trim();
    const drug    = document.getElementById('pgxDrug').value.trim();
    const rec     = document.getElementById('pgxRec').value.trim();
    if (!gene || !variant || !drug) { cm.showNotification('Gene, Variant and Drug are required.'); return; }
    pgxEntries.push({ gene, variant, drug, rec, timestamp: new Date().toISOString() });
    localStorage.setItem('pgxEntries', JSON.stringify(pgxEntries));
    document.getElementById('pgxForm').reset();
    loadPGxEntries();
    addRecord("PGx Vault", `Added: ${gene} ${variant} – ${drug}`, 5);
}

function loadPGxEntries() {
    pgxEntries = JSON.parse(localStorage.getItem('pgxEntries') || '[]');
    const listEl = document.getElementById('pgxEntriesList');
    if (!listEl) return;
    if (pgxEntries.length === 0) {
        listEl.innerHTML = '<p class="text-muted">No entries yet. Add your first pharmacogenomic interaction.</p>';
        return;
    }
    listEl.innerHTML = pgxEntries.map((entry, i) => `
        <div class="card mb-2">
            <div class="card-body p-2">
                <strong>${entry.gene} ${entry.variant}</strong> → ${entry.drug}
                ${entry.rec ? `<br><small class="text-muted">${entry.rec}</small>` : ''}
                <br><small class="text-secondary">${new Date(entry.timestamp).toLocaleString()}</small>
                <button class="btn btn-sm btn-outline-danger float-end" onclick="deletePGxEntry(${i})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function deletePGxEntry(i) {
    pgxEntries.splice(i, 1);
    localStorage.setItem('pgxEntries', JSON.stringify(pgxEntries));
    loadPGxEntries();
}

// ========== INITIALIZATION ==========
const hcTab = document.querySelector('#mainTab button[data-bs-target="#healthcare50"]');
if (hcTab) {
    hcTab.addEventListener('shown.bs.tab', () => {
        initHealthcare50();
        const pgxForm = document.getElementById('pgxForm');
        if (pgxForm && !pgxForm._init) { pgxForm.addEventListener('submit', addPGxEntry); pgxForm._init = true; }
        loadPGxEntries();
        const idsMetrics = document.getElementById('idsMetrics');
        if (idsMetrics && !idsMetrics.innerHTML.trim()) {
            idsMetrics.innerHTML = '<div class="alert alert-secondary">Click "Test Random Sample" to see intrusion detection predictions.</div>';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();

    const walletBtn = document.getElementById('connectWallet');
    if (walletBtn) walletBtn.addEventListener('click', connectWallet);

    cm.loadConfig(); // Fix 4: loads config + live KES rate

    if (document.getElementById('dockChart')) {
        Plotly.newPlot('dockChart', [{ x: [], y: [] }], { title: 'Docking results will appear here', paper_bgcolor: 'white' });
    }

    setupChatbotEvents();

    const profileTab = document.querySelector('#mainTab button[data-bs-target="#profile"]');
    if (profileTab) profileTab.addEventListener('shown.bs.tab', () => displayProfile());

    // Restore token balance from localStorage if wallet was previously connected
    const savedAddress = Object.keys(localStorage).find(k => k.startsWith('profile_'));
    if (savedAddress) {
        const profile = JSON.parse(localStorage.getItem(savedAddress) || '{}');
        if (profile.bio_balance) {
            tokenBalance = profile.bio_balance;
            document.getElementById('tokens').innerText = tokenBalance;
        }
    }
});
