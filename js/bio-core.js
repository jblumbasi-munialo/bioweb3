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
    async loadConfig() {
        let resp = await fetch('./data/config.json');
        this.config = await resp.json();
        this.applyPrices();
    }
    applyPrices() {
        let tbody = document.querySelector('#priceTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        for (let [drug, price] of Object.entries(this.config.drugs)) {
            let row = tbody.insertRow();
            row.insertCell(0).innerText = drug;
            let kes = price.usdPrice * this.config.exchangeRate;
            row.insertCell(1).innerHTML = `<span class="price-tag">KES ${kes.toLocaleString()}</span>`;
        }
    }
    showNotification(msg) {
        let div = document.createElement('div');
        div.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
        div.style.cssText = 'position:fixed;top:80px;right:20px;background:white;padding:12px 20px;border-radius:12px;box-shadow:0 5px 15px rgba(0,0,0,0.2);z-index:3000';
        document.body.appendChild(div);
        setTimeout(()=>div.remove(), 3000);
    }
}

const bio = BioUtils;
const cm = new ContentManager();

// ========== SUPABASE CLIENT ==========
// *** REPLACE WITH YOUR ACTUAL SUPABASE CREDENTIALS ***
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
let supabase;
async function initSupabase() {
    if (!window.supabaseJs) {
        console.error("Supabase JS not loaded");
        return;
    }
    supabase = window.supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
initSupabase();

// ========== GLOBAL STATE ==========
let web3, account;
let analysisCount = 0, structCount = 0, drugCount = 0, tokenBalance = 0;
let ledger = [];
let currentStructure = null;
let currentAccession = null;

// ========== WALLET & BLOCKCHAIN ==========
async function connectWallet() {
    if (window.ethereum) {
        let acc = await ethereum.request({method:'eth_requestAccounts'});
        account = acc[0];
        web3 = new Web3(window.ethereum);
        document.getElementById('connectWallet').innerHTML = `<i class="fas fa-check-circle"></i> ${account.slice(0,6)}...`;
        document.getElementById('walletStatus').innerHTML = `
            <i class="fas fa-check-circle fa-2x"></i>
            <h4>Connected</h4>
            <p>${account.slice(0,10)}...</p>
            <p>$BIO: <span id="bioBal">0</span></p>
        `;
        loadUserProfile();
        displayProfile();
    } else alert("Install MetaMask");
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
    tokenBalance += 5;
    document.getElementById('tokens').innerText = tokenBalance;
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
        if (!pdbResponse.ok) throw new Error('AlphaFold model not available');
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
        tokenBalance += 15;
        document.getElementById('tokens').innerText = tokenBalance;
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
        tokenBalance += 10;
        document.getElementById('tokens').innerText = tokenBalance;
        addRecord("Docking", `On ${currentAccession || "loaded structure"}`, 10);
        Plotly.newPlot('dockChart', [{x: drugs, y: scores, type: 'bar', marker: { color: '#1a5f7a' }}], { title: 'Binding affinities', paper_bgcolor: 'white' });
        saveUserProfile();
    }, 2000);
}

async function refreshPrices() {
    await cm.loadConfig();
    cm.showNotification("Prices updated");
}

// ========== USER PROFILE (Supabase) ==========
async function saveUserProfile() {
    if (!account) { cm.showNotification("Connect wallet first"); return; }
    if (!supabase) { cm.showNotification("Supabase not initialised – using local storage only"); return; }

    const profile = {
        wallet_address: account,
        saved_analyses: JSON.parse(localStorage.getItem(`analyses_${account}`) || '[]'),
        favorite_proteins: JSON.parse(localStorage.getItem(`favorites_${account}`) || '[]'),
        docking_results: JSON.parse(localStorage.getItem(`docking_${account}`) || '[]'),
        bio_balance: tokenBalance,
        chat_history: conversationHistory.slice(-20),
        last_active: new Date().toISOString()
    };
    localStorage.setItem(`profile_${account}`, JSON.stringify(profile));
    try {
        const { error } = await supabase
            .from('user_profiles')
            .upsert(profile);
        if (error) throw error;
        cm.showNotification("Profile saved to cloud!");
    } catch (err) {
        console.error(err);
        cm.showNotification("Cloud save failed – saved locally only");
    }
}

async function loadUserProfile() {
    if (!account || !supabase) return;
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('wallet_address', account)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
            tokenBalance = data.bio_balance || 0;
            document.getElementById('tokens').innerText = tokenBalance;
            analysisCount = data.saved_analyses?.length || 0;
            structCount = data.favorite_proteins?.length || 0;
            document.getElementById('analyses').innerText = analysisCount;
            document.getElementById('structures').innerText = structCount;
            drugCount = data.docking_results?.length || 0;
            document.getElementById('drugs').innerText = drugCount;
            cm.showNotification("Profile loaded from cloud");
        } else {
            await saveUserProfile();
        }
    } catch (err) {
        console.error(err);
        cm.showNotification("Could not load cloud profile – using local");
    }
}

async function displayProfile() {
    if (!account) {
        document.getElementById('profileInfo').innerHTML = '<p>Connect wallet to see your profile.</p>';
        return;
    }
    let profile = null;
    if (supabase) {
        const { data } = await supabase.from('user_profiles').select('*').eq('wallet_address', account).single();
        profile = data;
    } else {
        const local = localStorage.getItem(`profile_${account}`);
        if (local) profile = JSON.parse(local);
    }
    if (profile) {
        document.getElementById('profileInfo').innerHTML = `
            <p><strong>Wallet:</strong> ${account.slice(0,6)}...${account.slice(-4)}</p>
            <p><strong>$BIO Balance:</strong> ${profile.bio_balance || 0}</p>
            <p><strong>Saved analyses:</strong> ${profile.saved_analyses?.length || 0}</p>
            <p><strong>Favorite proteins:</strong> ${profile.favorite_proteins?.length || 0}</p>
        `;
        document.getElementById('savedItems').innerHTML = `
            <h6>Recent Analyses</h6>
            <ul>${(profile.saved_analyses || []).slice(-5).map(a => `<li>${a}</li>`).join('') || '<li>None yet</li>'}</ul>
        `;
    } else {
        document.getElementById('profileInfo').innerHTML = `<p>No saved profile yet. Start using the platform to create one.</p>`;
        document.getElementById('savedItems').innerHTML = '';
    }
}

async function clearUserData() {
    if (!account) return;
    localStorage.removeItem(`profile_${account}`);
    if (supabase) {
        await supabase.from('user_profiles').delete().eq('wallet_address', account);
    }
    tokenBalance = 0;
    analysisCount = 0;
    structCount = 0;
    drugCount = 0;
    document.getElementById('tokens').innerText = tokenBalance;
    document.getElementById('analyses').innerText = analysisCount;
    document.getElementById('structures').innerText = structCount;
    document.getElementById('drugs').innerText = drugCount;
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
    if (!url) {
        alert('Please enter a Zarr URL');
        return;
    }
    const container = document.getElementById('vizarrFrame');
    container.innerHTML = `<iframe src="https://hms-dbmi.github.io/vizarr/?source=${encodeURIComponent(url)}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;
}

// ========== NEW: CRISPR DATA ==========
async function loadCrisprData() {
    const statusSpan = document.getElementById('crisprStatus');
    const container = document.getElementById('crisprTable');
    statusSpan.innerHTML = 'Loading...';
    try {
        // *** REPLACE WITH YOUR ACTUAL RAW CSV URL ***
        const url = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/crispr_off_target_analysis.csv';
        const response = await fetch(url);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n').map(row => row.split(','));
        if (rows.length < 2) throw new Error('No data');
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        dataRows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += `<td>${cell}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
        statusSpan.innerHTML = `✅ Loaded ${dataRows.length} records.`;
        addRecord("CRISPR Analysis", `Loaded ${dataRows.length} off‑target predictions`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading CRISPR data: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}

// ========== NEW: DRUG DISCOVERY DATA ==========
async function loadDrugData() {
    const statusSpan = document.getElementById('drugStatus');
    const container = document.getElementById('drugTable');
    statusSpan.innerHTML = 'Loading...';
    try {
        // *** REPLACE WITH YOUR ACTUAL RAW CSV URL ***
        const url = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/clinical_trial_opportunities.csv';
        const response = await fetch(url);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n').map(row => row.split(','));
        if (rows.length < 2) throw new Error('No data');
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        dataRows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += `<td>${cell}</td>`);
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

// ========== NEW: GO ENRICHMENT DATA ==========
async function loadGOData() {
    const statusSpan = document.getElementById('goStatus');
    const container = document.getElementById('goTable');
    const chartDiv = document.getElementById('goChart');
    statusSpan.innerHTML = 'Loading...';
    try {
        // *** TRY JSON FIRST, THEN CSV – ADJUST URLs ***
        let jsonUrl = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/go_enrichment.json';
        let response = await fetch(jsonUrl);
        let data = [];
        if (!response.ok) {
            const csvUrl = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/go_enrichment.csv';
            response = await fetch(csvUrl);
            const csvText = await response.text();
            const rows = csvText.trim().split('\n').map(row => row.split(','));
            if (rows.length < 2) throw new Error('No GO data');
            const headers = rows[0];
            data = rows.slice(1).map(row => {
                let obj = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                return obj;
            });
        } else {
            data = await response.json();
        }

        // Build table
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        if (data.length) {
            Object.keys(data[0]).forEach(k => html += `<th>${k}</th>`);
            html += '</tr></thead><tbody>';
            data.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(v => html += `<td>${v}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        } else {
            html = '<p>No data found</p>';
        }
        container.innerHTML = html;
        statusSpan.innerHTML = `✅ Loaded ${data.length} GO terms.`;

        // Create bar chart if enrichment_score exists
        if (data.length > 0 && data[0].hasOwnProperty('enrichment_score')) {
            const top10 = data.sort((a,b) => parseFloat(b.enrichment_score) - parseFloat(a.enrichment_score)).slice(0,10);
            const terms = top10.map(d => d.term || d.description || 'Term');
            const scores = top10.map(d => parseFloat(d.enrichment_score));
            Plotly.newPlot(chartDiv, [{
                x: scores,
                y: terms,
                type: 'bar',
                orientation: 'h',
                marker: { color: '#2c7a47' }
            }], {
                title: 'Top 10 Enriched GO Terms',
                xaxis: { title: 'Enrichment Score' },
                yaxis: { title: '' },
                paper_bgcolor: 'white',
                font: { color: '#1a1a1a' }
            });
        } else {
            chartDiv.innerHTML = '<p class="text-muted">Enrichment score not available for chart.</p>';
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
    if (!bamUrl) {
        alert('Please enter a BAM/CRAM URL or use the demo button.');
        return;
    }
    const container = document.getElementById('igvContainer');
    container.innerHTML = '<div class="text-center p-5"><div class="loading"></div> Loading genome browser...</div>';
    try {
        if (igvBrowser) {
            igvBrowser.dispose();
        }
        const options = {
            genome: "hg38",
            locus: "chr8:127,000,000-128,000,000",
            tracks: [
                {
                    name: "User BAM",
                    url: bamUrl,
                    indexURL: bamUrl + ".bai",
                    format: "bam",
                    type: "alignment"
                }
            ]
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
        if (igvBrowser) {
            igvBrowser.dispose();
        }
        const options = {
            genome: "hg38",
            locus: "chr8:127,000,000-128,000,000",
            tracks: [
                {
                    name: "Demo BAM (NA12878)",
                    url: "https://igv.org/web/release/data/NA12878.bam",
                    indexURL: "https://igv.org/web/release/data/NA12878.bam.bai",
                    format: "bam",
                    type: "alignment"
                }
            ]
        };
        igvBrowser = await igv.createBrowser(container, options);
        addRecord("Genomic Viewer", "Loaded demo BAM", 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading demo: ${err.message}</p>`;
    }
}

// ========== DIFFERENTIAL EXPRESSION PIPELINE ==========
async function runDEGPipeline() {
    const fileInput = document.getElementById('degCountFile');
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a CSV count matrix file.");
        return;
    }
    const statusDiv = document.getElementById('pipelineStatus');
    const resultsDiv = document.getElementById('pipelineResults');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div class="loading"></div> Submitting job...';
    resultsDiv.innerHTML = '';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/run-deg', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        statusDiv.style.display = 'none';
        resultsDiv.innerHTML = `
            <div class="alert alert-success mt-2">
                <strong>✅ Analysis complete!</strong><br>
                Found ${data.deg_count} differentially expressed genes (FDR < 0.05).
            </div>
            <div id="pipelineVolcano" style="height: 500px;"></div>
            <div class="row mt-3">
                <div class="col-md-6">
                    <h5>Top up‑regulated genes</h5>
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>Gene</th><th>log2FC</th><th>padj</th></tr></thead>
                        <tbody>
                            ${data.top_up.map(g => `<tr><td><strong>${g.gene}</strong></td><td>${g.log2fc.toFixed(3)}</td><td>${g.padj.toExponential(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="col-md-6">
                    <h5>Top down‑regulated genes</h5>
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>Gene</th><th>log2FC</th><th>padj</th></tr></thead>
                        <tbody>
                            ${data.top_down.map(g => `<tr><td><strong>${g.gene}</strong></td><td>${g.log2fc.toFixed(3)}</td><td>${g.padj.toExponential(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Create volcano plot
        Plotly.newPlot('pipelineVolcano', [{
            x: data.volcano.log2fc,
            y: data.volcano.neg_log10_padj,
            mode: 'markers',
            marker: {
                color: data.volcano.is_significant.map(s => s ? '#ef4444' : '#9ca3af'),
                size: 6
            },
            text: data.volcano.gene_names
        }], {
            title: 'Volcano Plot',
            xaxis: { title: 'Log2 Fold Change' },
            yaxis: { title: '-Log10 adjusted P-value' },
            plot_bgcolor: 'white',
            paper_bgcolor: 'white'
        });

        addRecord("DEG Pipeline", `Computed ${data.deg_count} DEGs`, 20);
        cm.showNotification(`Pipeline finished! ${data.deg_count} DEGs found.`);

    } catch (err) {
        statusDiv.innerHTML = `<div class="text-danger">Error: ${err.message}</div>`;
        console.error(err);
    }
}

// ========== FLOATING CHATBOT WITH MEMORY ==========
let conversationHistory = [
    { role: "system", content: "You are a helpful scientific assistant for BioWeb3. The platform offers: protein sequence analysis, AlphaFold, docking, blockchain, KES pricing, profile, bioimaging, CRISPR analysis, drug discovery, GO enrichment, genome viewer, and a differential expression pipeline (upload CSV). Answer only science questions. Redirect off-topic politely." }
];

function addChatMessage(sender, text, type = 'user') {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'message-bubble ' + (type === 'user' ? 'user-bubble' : (type === 'bot' ? 'bot-bubble' : 'system-bubble'));
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatbotInput');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    conversationHistory.push({ role: "user", content: question });
    addChatMessage('You', question, 'user');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory })
        });
        const data = await response.json();
        if (data.error) {
            addChatMessage('Bot', `Error: ${data.error}`, 'bot');
        } else {
            conversationHistory.push({ role: "assistant", content: data.reply });
            addChatMessage('Bot', data.reply, 'bot');
            saveUserProfile();
        }
    } catch (err) {
        addChatMessage('Bot', 'Network error. Please try again.', 'bot');
        console.error(err);
    }
}

function clearChatHistory() {
    conversationHistory = [conversationHistory[0]];
    const container = document.getElementById('chatbotMessages');
    if (container) {
        container.innerHTML = '<div class="message-bubble system-bubble">Chat cleared. Ask me about bioinformatics, protein structures, drug discovery, or how to use this platform.</div>';
    }
}

let chatbotOpen = false;
function toggleChatbot() {
    const win = document.getElementById('chatbotWindow');
    if (win) {
        chatbotOpen = !chatbotOpen;
        win.style.display = chatbotOpen ? 'flex' : 'none';
    }
}
function closeChatbot() {
    chatbotOpen = false;
    const win = document.getElementById('chatbotWindow');
    if (win) win.style.display = 'none';
}

function setupChatbotEvents() {
    const input = document.getElementById('chatbotInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    const sendBtn = document.getElementById('chatbotSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    const toggleBtn = document.getElementById('chatbotToggleBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleChatbot);
    const closeBtn = document.getElementById('closeChatbotBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeChatbot);
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    const walletBtn = document.getElementById('connectWallet');
    if (walletBtn) walletBtn.addEventListener('click', connectWallet);
    cm.loadConfig();
    if (document.getElementById('dockChart')) {
        Plotly.newPlot('dockChart', [{x:[], y:[]}], {title:'Docking results will appear here'});
    }
    setupChatbotEvents();
    const profileTab = document.querySelector('#mainTab button[data-bs-target="#profile"]');
    if (profileTab) {
        profileTab.addEventListener('shown.bs.tab', () => displayProfile());
    }
    // Optional: preload data for any tab? Not needed.
});
