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

// ========== SUPABASE CLIENT (disabled – prevent redeclaration) ==========
// The Supabase library may have already created a global 'supabase'.
// We'll just assign null to it if it doesn't exist.
if (typeof supabase === 'undefined') {
    var supabase = null;
}
async function initSupabase() { console.log("Supabase not configured"); }
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

// ========== USER PROFILE (local storage fallback) ==========
async function saveUserProfile() {
    if (!account) { cm.showNotification("Connect wallet first"); return; }
    let profile = { wallet_address: account, bio_balance: tokenBalance, saved_analyses: [] };
    localStorage.setItem(`profile_${account}`, JSON.stringify(profile));
    cm.showNotification("Profile saved locally");
}

async function loadUserProfile() {
    if (!account) return;
    let local = localStorage.getItem(`profile_${account}`);
    if (local) {
        let profile = JSON.parse(local);
        tokenBalance = profile.bio_balance || 0;
        document.getElementById('tokens').innerText = tokenBalance;
        cm.showNotification("Profile loaded from local storage");
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
        const csvText = await response.text();
        const rows = csvText.trim().split('\n').map(row => row.split(','));
        if (rows.length < 2) throw new Error('No data');
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><table>';
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

// ========== DRUG DISCOVERY DATA ==========
async function loadDrugData() {
    const statusSpan = document.getElementById('drugStatus');
    const container = document.getElementById('drugTable');
    statusSpan.innerHTML = 'Loading...';
    try {
        const url = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/clinical_trial_opportunities.csv';
        const response = await fetch(url);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n').map(row => row.split(','));
        if (rows.length < 2) throw new Error('No data');
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '<tr></thead><tbody>';
        dataRows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += `<tr>${cell}</td>`);
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
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        if (data.length) {
            Object.keys(data[0]).forEach(k => html += `<th>${k}</th>`);
            html += '<tr></thead><tbody>';
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

// ========== DIFFERENTIAL EXPRESSION PIPELINE (with alerts) ==========
async function runDEGPipeline() {
    alert("Step 1: Function started");
    const fileInput = document.getElementById('degCountFile');
    if (!fileInput) {
        alert("No file input element with id 'degCountFile'");
        return;
    }
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a CSV file.");
        return;
    }
    alert("File selected: " + file.name);

    const formData = new FormData();
    formData.append('file', file);

    const statusDiv = document.getElementById('pipelineStatus');
    const resultsDiv = document.getElementById('pipelineResults');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div class="loading"></div> Submitting job...';
    resultsDiv.innerHTML = '';

    try {
        alert("Sending request to /api/run-deg");
        const response = await fetch('/api/run-deg', {
            method: 'POST',
            body: formData
        });
        alert("Response status: " + response.status);
        const data = await response.json();
        alert("Data received: " + JSON.stringify(data).slice(0, 100));
        if (data.error) throw new Error(data.error);
        
        resultsDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        statusDiv.style.display = 'none';
    } catch (err) {
        alert("Error: " + err.message);
        statusDiv.innerHTML = '<div class="text-danger">Error: ' + err.message + '</div>';
    }
}

// ========== REGULATORY NETWORK & DRUG TARGETS ==========
let currentDrugTarget = null;
async function loadRegulatoryNetwork() {
    const statusSpan = document.getElementById('regnetStatus');
    const drugTableDiv = document.getElementById('drugTargetTable');
    const summaryDiv = document.getElementById('regnetSummary');
    statusSpan.innerHTML = 'Loading regulatory network data...';
    drugTableDiv.innerHTML = '<div class="loading"></div>';
    try {
        const drugUrl = 'https://raw.githubusercontent.com/jblumbasi-munialo/ARCHS4-Regulatory-Network/main/drug_targets.csv';
        const drugResp = await fetch(drugUrl);
        const drugCsv = await drugResp.text();
        const rows = drugCsv.trim().split('\n').map(r => r.split(','));
        if (rows.length < 2) throw new Error('No drug-target data');
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let tableHtml = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        headers.forEach(h => tableHtml += `<th>${h}</th>`);
        tableHtml += '<th>Select</th></tr></thead><tbody>';
        dataRows.forEach((row, idx) => {
            tableHtml += '<tr>';
            row.forEach(cell => tableHtml += `<td>${cell}</td>`);
            tableHtml += `<td><input type="radio" name="drugTarget" value="${idx}" onclick="selectDrugTarget(${idx}, '${row[0]}')"></td></tr>`;
        });
        tableHtml += '</tbody></table></div>';
        drugTableDiv.innerHTML = tableHtml;
        let summaryHtml = '<div class="alert alert-secondary">Summary statistics not available.</div>';
        summaryDiv.innerHTML = summaryHtml;
        statusSpan.innerHTML = `✅ Loaded ${dataRows.length} drug-target interactions. Click a radio button and record to blockchain.`;
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
    const plotDiv = document.getElementById('kmPlot');
    const summaryDiv = document.getElementById('survivalSummary');
    statusSpan.innerHTML = 'Loading survival data...';
    plotDiv.innerHTML = '<div class="loading"></div>';
    try {
        let url = './data/survival_analysis_results.csv';
        let response = await fetch(url);
        let useDemo = !response.ok;
        let times = [], events = [], groups = [];
        if (useDemo) {
            for (let i = 0; i < 100; i++) {
                let isTreatment = Math.random() < 0.5;
                let time = isTreatment ? Math.random() * 50 + 10 : Math.random() * 40 + 5;
                let event = Math.random() < 0.7 ? 1 : 0;
                times.push(time);
                events.push(event);
                groups.push(isTreatment ? "Treatment" : "Control");
            }
            statusSpan.innerHTML = 'Demo survival data (no file found) – loaded demo.';
        } else {
            const csvText = await response.text();
            const rows = csvText.trim().split('\n').map(r => r.split(','));
            const headers = rows[0].map(h => h.toLowerCase());
            const timeIdx = headers.findIndex(h => h.includes('time'));
            const eventIdx = headers.findIndex(h => h.includes('event'));
            const groupIdx = headers.findIndex(h => h.includes('group'));
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < Math.max(timeIdx, eventIdx, groupIdx) + 1) continue;
                times.push(parseFloat(row[timeIdx]));
                events.push(parseFloat(row[eventIdx]));
                groups.push(row[groupIdx]);
            }
            statusSpan.innerHTML = `✅ Loaded survival data: ${times.length} patients.`;
        }
        const uniqueGroups = [...new Set(groups)];
        const traces = [];
        for (let g of uniqueGroups) {
            const idxs = groups.map((val, i) => val === g ? i : -1).filter(i => i !== -1);
            const grpTimes = idxs.map(i => times[i]);
            const grpEvents = idxs.map(i => events[i]);
            const sorted = grpTimes.map((t, i) => ({t, e: grpEvents[i]})).sort((a,b) => a.t - b.t);
            let survival = 1.0;
            let atRisk = sorted.length;
            let x = [0], y = [1.0];
            for (let i = 0; i < sorted.length; i++) {
                const {t, e} = sorted[i];
                if (e === 1) {
                    survival = survival * (1 - 1 / atRisk);
                    x.push(t);
                    y.push(survival);
                }
                atRisk--;
            }
            traces.push({ x: x, y: y, mode: 'lines', name: g, line: { width: 3 }, type: 'scatter' });
        }
        const layout = {
            title: 'Kaplan‑Meier Survival Curves',
            xaxis: { title: 'Time (days / months)' },
            yaxis: { title: 'Survival Probability', range: [0, 1] },
            plot_bgcolor: 'white', paper_bgcolor: 'white', font: { color: '#1a1a1a' }, hovermode: 'closest', legend: { x: 0.8, y: 0.9 }
        };
        Plotly.newPlot('kmPlot', traces, layout);
        const totalPatients = times.length;
        const eventsCount = events.filter(e => e === 1).length;
        summaryDiv.innerHTML = `<div class="alert alert-info"><strong>Summary</strong><br>Total patients: ${totalPatients}<br>Events: ${eventsCount}<br>Groups: ${uniqueGroups.join(', ')}</div>`;
        currentSurvivalStats = { totalPatients, eventsCount, groups: uniqueGroups };
        addRecord("Survival Analysis", `Loaded survival data (n=${totalPatients})`, 5);
    } catch (err) {
        plotDiv.innerHTML = `<p class="text-danger">Error loading survival data: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed to load';
        console.error(err);
    }
}
async function recordSurvivalAnalysis() {
    if (!currentSurvivalStats) { alert('Load survival data first.'); return; }
    addRecord("Survival Analysis", `Total=${currentSurvivalStats.totalPatients}, events=${currentSurvivalStats.eventsCount}, groups=${currentSurvivalStats.groups.join(',')}`, 10);
    cm.showNotification(`Survival analysis recorded to blockchain! +10 BIO`);
}

// ========== FLOATING CHATBOT WITH MEMORY ==========
let conversationHistory = [
    { role: "system", content: "You are a helpful scientific assistant for BioWeb3. The platform offers: protein sequence analysis, AlphaFold, docking, blockchain, KES pricing, profile, bioimaging, CRISPR analysis, drug discovery, GO enrichment, genome viewer, differential expression pipeline, regulatory network/drug target analysis, and survival analysis (Kaplan‑Meier). Answer only science questions. Redirect off-topic politely." }
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
    if (container) container.innerHTML = '<div class="message-bubble system-bubble">Chat cleared. Ask me about bioinformatics, protein structures, drug discovery, or how to use this platform.</div>';
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
    if (input) input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    const sendBtn = document.getElementById('chatbotSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    const toggleBtn = document.getElementById('chatbotToggleBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleChatbot);
    const closeBtn = document.getElementById('closeChatbotBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeChatbot);
}
// ========== HEALTHCARE 5.0: FEDERATED LEARNING ==========
let flChart = null;
let flRound = 0;
let flAccuracies = [];
let flRunning = false;

async function runFederatedLearning() {
    if (flRunning) return;
    flRunning = true;
    document.getElementById('flProgress').style.display = 'block';
    const progressDiv = document.getElementById('flProgress');
    flRound = 0;
    flAccuracies = [];

    // Initialize chart
    if (flChart) {
        Plotly.purge('flChart');
    }
    flChart = Plotly.newPlot('flChart', [{
        x: [],
        y: [],
        mode: 'lines+markers',
        name: 'Global Accuracy',
        line: { color: '#2e7d32', width: 2 }
    }], {
        title: 'Federated Learning Rounds',
        xaxis: { title: 'Round', range: [0, 10] },
        yaxis: { title: 'Accuracy', range: [0.5, 1.0] },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white'
    });

    for (let round = 1; round <= 10; round++) {
        progressDiv.innerHTML = `<div class="loading"></div> Round ${round}/10 – Training local clients...`;
        try {
            const response = await fetch('/api/federated_learning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round: round-1, clients: 4 })
            });
            const data = await response.json();
            flAccuracies.push(data.global_accuracy);
            Plotly.extendTraces('flChart', { x: [[round]], y: [[data.global_accuracy]] }, [0]);
            // Record blockchain entry for each round
            addRecord("Federated Learning", `Round ${round} accuracy: ${(data.global_accuracy*100).toFixed(2)}%`, 5);
            progressDiv.innerHTML = `<div class="text-success">✅ Round ${round} completed – accuracy ${(data.global_accuracy*100).toFixed(2)}%</div>`;
            await new Promise(r => setTimeout(r, 800)); // simulate training delay
        } catch (err) {
            progressDiv.innerHTML = `<div class="text-danger">Error: ${err.message}</div>`;
            break;
        }
    }
    progressDiv.innerHTML = '<div class="alert alert-success">Federated learning completed! Global model accuracy: ' + (flAccuracies[flAccuracies.length-1]*100).toFixed(2) + '%</div>';
    flRunning = false;
}

// ========== HEALTHCARE 5.0: INTRUSION DETECTION ==========
async function testIntrusionSample() {
    const resultDiv = document.getElementById('idsResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="loading"></div> Analyzing network packet...';

    try {
        const response = await fetch('/api/intrusion_detection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sample: 'random' })
        });
        const data = await response.json();
        const metrics = data.metrics;
        const predictionClass = data.prediction === 'attack' ? 'danger' : 'success';
        resultDiv.innerHTML = `
            <div class="alert alert-${predictionClass}">
                <strong>Prediction:</strong> ${data.prediction.toUpperCase()} (confidence: ${(data.confidence*100).toFixed(1)}%)
            </div>
            <table class="table table-sm table-bordered mt-2">
                <tr><th>Accuracy</th><td>${(metrics.accuracy*100).toFixed(2)}%</td></tr>
                <tr><th>Sensitivity (TPR)</th><td>${(metrics.sensitivity*100).toFixed(2)}%</td></tr>
                <tr><th>Specificity (TNR)</th><td>${(metrics.specificity*100).toFixed(2)}%</td></tr>
                <tr><th>False Positive Rate</th><td>${(metrics.false_positive_rate*100).toFixed(2)}%</td></tr>
                <tr><th>False Negative Rate</th><td>${(metrics.false_negative_rate*100).toFixed(2)}%</td></tr>
            </table>
        `;
        // Display fixed metrics from paper for comparison
        document.getElementById('idsMetrics').innerHTML = `
            <div class="alert alert-secondary">
                <strong>Paper's validation results (Table 5):</strong><br>
                Accuracy: 96.5% (Client H3)<br>
                Sensitivity: 98.64%<br>
                Specificity: 90.57%<br>
                False Positive Rate: 9.43%
            </div>
        `;
        addRecord("Intrusion Detection", `Predicted: ${data.prediction}, confidence: ${(data.confidence*100).toFixed(1)}%`, 10);
    } catch (err) {
        resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
}

// Attach event listeners after DOM ready (add inside existing DOMContentLoaded)
// But we also need to attach them when the Healthcare 5.0 tab is shown (to avoid duplicates)
// We'll add them in a function that runs once.
function initHealthcare50() {
    const flBtn = document.getElementById('startFLBtn');
    if (flBtn && !flBtn.hasListener) {
        flBtn.addEventListener('click', runFederatedLearning);
        flBtn.hasListener = true;
    }
    const idsBtn = document.getElementById('testIDSBtn');
    if (idsBtn && !idsBtn.hasListener) {
        idsBtn.addEventListener('click', testIntrusionSample);
        idsBtn.hasListener = true;
    }
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
    if (profileTab) profileTab.addEventListener('shown.bs.tab', () => displayProfile());
});
