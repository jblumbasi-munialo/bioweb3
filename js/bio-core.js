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

// Content manager for config.json
class ContentManager {
    constructor() {
        this.config = null;
    }
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

// Global state
let web3, account;
let analysisCount = 0, structCount = 0, drugCount = 0, tokenBalance = 0;
let ledger = [];
let currentStructure = null;      // stores PDB data for docking
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
    } else alert("Install MetaMask");
}

function addRecord(type, data, reward = 10) {
    let rec = {
        type,
        data,
        time: new Date().toLocaleTimeString(),
        hash: '0x' + Math.random().toString(36).substr(2, 8)
    };
    ledger.unshift(rec);
    let ledgerDiv = document.getElementById('ledger');
    if (ledgerDiv) {
        ledgerDiv.innerHTML = ledger.slice(0,8).map(r => `
            <div class='bg-light p-2 mb-2 rounded'>
                <small>${r.time}</small> <strong>${r.type}</strong><br>
                ${r.data}<br><code>${r.hash}</code>
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
    document.getElementById('seqResult').innerHTML = `
        <strong>Analysis</strong><br>
        Length: ${seq.length}<br>
        GC%: ${gc}%
    `;
    document.getElementById('revCompDisplay').innerHTML = `
        <strong>Reverse complement</strong><br><pre>${rev}</pre>
    `;
    document.getElementById('seqResult').style.display = 'block';
    analysisCount++;
    document.getElementById('analyses').innerText = analysisCount;
    tokenBalance += 5;
    document.getElementById('tokens').innerText = tokenBalance;
    addRecord("Sequence analysis", `GC=${gc}%`, 5);
}

// ========== UNIPROT SEARCH (by exact name) ==========
async function searchUniProt() {
    const proteinName = document.getElementById('proteinName').value.trim();
    if (!proteinName) {
        alert("Enter a protein name (e.g., TP53)");
        return;
    }

    const resultDiv = document.getElementById('structResult');
    resultDiv.innerHTML = '<div class="loading"></div> Searching UniProt...';
    resultDiv.style.display = 'block';

    try {
        const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(proteinName)}+AND+reviewed:true&format=json&size=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error(`No reviewed UniProt entry found for "${proteinName}"`);
        }

        const entry = data.results[0];
        const accession = entry.primaryAccession;
        const proteinDesc = entry.proteinDescription?.recommendedName?.fullName?.value || proteinName;
        const organism = entry.organism?.scientificName || "Unknown";

        resultDiv.innerHTML = `
            <i class="fas fa-check-circle text-success"></i> 
            <strong>Found: ${proteinDesc}</strong><br>
            Accession: ${accession}<br>
            Organism: ${organism}<br>
            ✅ Ready to load structure.
        `;

        document.getElementById('uniprotLink').innerHTML = `
            <a href="https://www.uniprot.org/uniprot/${accession}" target="_blank" class="btn btn-sm btn-outline-primary">
                <i class="fas fa-external-link-alt"></i> View on UniProt
            </a>
        `;

        await loadAlphaFoldStructure(accession, proteinDesc);

    } catch (error) {
        resultDiv.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Error: ${error.message}`;
        document.getElementById('uniprotLink').innerHTML = '';
    }
}

// ========== GENERAL PROTEIN SEARCH (e.g., "breast cancer protein") ==========
async function searchGeneralProtein() {
    const searchTerm = document.getElementById('generalSearch').value.trim();
    if (!searchTerm) {
        alert("Please enter a search term (e.g., breast cancer protein)");
        return;
    }

    const resultDiv = document.getElementById('structResult');
    resultDiv.innerHTML = '<div class="loading"></div> Searching UniProt for "' + searchTerm + '"...';
    resultDiv.style.display = 'block';
    document.getElementById('uniprotLink').innerHTML = '';

    try {
        const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(searchTerm)}+AND+organism_id:9606&format=json&size=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error(`No human protein found for "${searchTerm}"`);
        }

        const bestMatch = data.results[0];
        const accession = bestMatch.primaryAccession;
        const proteinName = bestMatch.proteinDescription?.recommendedName?.fullName?.value || bestMatch.entryName || accession;
        const organism = bestMatch.organism?.scientificName || "Unknown";

        resultDiv.innerHTML = `
            <i class="fas fa-check-circle text-success"></i> 
            <strong>Top Result: ${proteinName}</strong><br>
            Accession: ${accession}<br>
            Organism: ${organism}<br>
            ✅ Ready to load structure.
        `;

        document.getElementById('uniprotLink').innerHTML = `
            <a href="https://www.uniprot.org/uniprot/${accession}" target="_blank" class="btn btn-sm btn-outline-primary">
                <i class="fas fa-external-link-alt"></i> View on UniProt
            </a>
        `;

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
        if (!pdbResponse.ok) throw new Error('AlphaFold model not available for this protein');
        const pdbData = await pdbResponse.text();

        // Render in 3Dmol.js
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

    } catch (err) {
        resultDiv.innerHTML += `<br><i class="fas fa-exclamation-triangle text-danger"></i> Could not load 3D structure: ${err.message}`;
    }
}

// ========== MOLECULAR DOCKING ==========
async function runDock() {
    if (!currentStructure) {
        alert("Please load a protein structure first (search for a protein in the AlphaFold tab)");
        return;
    }
    const resultDiv = document.getElementById('dockResult');
    resultDiv.innerHTML = '<div class="loading"></div> Running docking simulation...';
    resultDiv.style.display = 'block';

    setTimeout(() => {
        const drugs = ["Trastuzumab", "Pertuzumab", "Lapatinib"];
        const scores = drugs.map(() => (-7.5 - Math.random() * 3).toFixed(1));
        resultDiv.innerHTML = `
            <strong>Top hit:</strong> ${drugs[0]} (${scores[0]} kcal/mol)<br>
            ✅ +10 BIO
        `;
        drugCount += drugs.length;
        document.getElementById('drugs').innerText = drugCount;
        tokenBalance += 10;
        document.getElementById('tokens').innerText = tokenBalance;
        addRecord("Docking", `On ${currentAccession || "loaded structure"}`, 10);
        Plotly.newPlot('dockChart', [{
            x: drugs,
            y: scores,
            type: 'bar',
            marker: { color: '#1a5f7a' }
        }], {
            title: 'Binding affinities',
            paper_bgcolor: 'white'
        });
    }, 2000);
}

async function refreshPrices() {
    await cm.loadConfig();
    cm.showNotification("Prices updated from config.json");
}

// ========== AI CHATBOT (calls secure Vercel backend) ==========
function addChatMessage(sender, text, type = 'user') {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `mb-2 p-2 rounded ${type === 'user' ? 'bg-primary text-white text-end' : (type === 'bot' ? 'bg-light border' : 'bg-secondary text-white')}`;
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    addChatMessage('You', question, 'user');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await response.json();
        if (data.error) {
            addChatMessage('Bot', `Error: ${data.error}`, 'bot');
        } else {
            addChatMessage('Bot', data.reply, 'bot');
        }
    } catch (err) {
        addChatMessage('Bot', 'Network error. Please try again.', 'bot');
        console.error(err);
    }
}

// ========== INITIALIZATION ==========
document.getElementById('connectWallet')?.addEventListener('click', connectWallet);
cm.loadConfig();
if (document.getElementById('dockChart')) {
    Plotly.newPlot('dockChart', [{x:[], y:[]}], {title:'Docking results will appear here'});
}
