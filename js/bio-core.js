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
        div.className = 'toast-notification';
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
let currentStructure = null;

// Wallet connection
async function connectWallet() {
    if (window.ethereum) {
        let acc = await ethereum.request({method:'eth_requestAccounts'});
        account = acc[0];
        web3 = new Web3(window.ethereum);
        document.getElementById('connectWallet').innerHTML = `<i class="fas fa-check-circle"></i> ${account.slice(0,6)}...`;
        document.getElementById('walletStatus').innerHTML = `<i class="fas fa-check-circle fa-2x"></i><h4>Connected</h4><p>${account.slice(0,10)}...</p><p>$BIO: <span id="bioBal">0</span></p>`;
    } else alert("Install MetaMask");
}

// Record on blockchain ledger
function addRecord(type, data, reward = 10) {
    let rec = {type, data, time: new Date().toLocaleTimeString(), hash:'0x'+Math.random().toString(36).substr(2,8)};
    ledger.unshift(rec);
    let ledgerDiv = document.getElementById('ledger');
    if (ledgerDiv) {
        ledgerDiv.innerHTML = ledger.slice(0,8).map(r=>`<div class='bg-light p-2 mb-2 rounded'><small>${r.time}</small> <strong>${r.type}</strong><br>${r.data}<br><code>${r.hash}</code></div>`).join('');
    }
    tokenBalance += reward;
    document.getElementById('tokens').innerText = tokenBalance;
    if (document.getElementById('bioBal')) document.getElementById('bioBal').innerText = tokenBalance;
}

async function recordCurrent() {
    addRecord("Manual entry", "Research data", 10);
    cm.showNotification("Recorded on blockchain!");
}

// Sequence analysis
async function analyzeSeq() {
    let seq = document.getElementById('seqInput').value.trim();
    if (!seq) { alert("Paste a sequence"); return; }
    let rev = bio.reverseComplement(seq);
    let gc = bio.gcContent(seq);
    document.getElementById('seqResult').innerHTML = `<strong>Analysis</strong><br>Length: ${seq.length}<br>GC%: ${gc}%`;
    document.getElementById('revCompDisplay').innerHTML = `<strong>Reverse complement</strong><br><pre>${rev}</pre>`;
    document.getElementById('seqResult').style.display = 'block';
    analysisCount++; document.getElementById('analyses').innerText = analysisCount;
    tokenBalance += 5; document.getElementById('tokens').innerText = tokenBalance;
    addRecord("Sequence analysis", `GC=${gc}%`, 5);
}

// AlphaFold prediction (simulated with 3D viewer)
async function predictStructure() {
    let id = document.getElementById('uniprot').value;
    let resultDiv = document.getElementById('structResult');
    resultDiv.innerHTML = '<div class="loading"></div> Predicting structure...';
    resultDiv.style.display = 'block';
    setTimeout(() => {
        resultDiv.innerHTML = `<i class="fas fa-check-circle text-success"></i> Predicted ${id} (confidence 88%)<br>✅ +15 BIO`;
        structCount++; document.getElementById('structures').innerText = structCount;
        tokenBalance += 15; document.getElementById('tokens').innerText = tokenBalance;
        addRecord("AlphaFold", `${id} predicted`, 15);
        let viewer = new $3Dmol.GLViewer(document.getElementById('viewer3d'), {backgroundColor:0xf5f5f5});
        viewer.addLabel(`${id} (predicted)`, {position:{x:0,y:0,z:0}, fontSize:14});
        viewer.setStyle({},{sphere:{scale:0.5,color:'#2c7a47'}});
        viewer.zoomTo(); viewer.render();
        currentStructure = id;
    }, 2000);
}

// Docking simulation
async function runDock() {
    if (!currentStructure) { alert("Predict a structure first"); return; }
    let resultDiv = document.getElementById('dockResult');
    resultDiv.innerHTML = '<div class="loading"></div> Running docking...';
    resultDiv.style.display = 'block';
    setTimeout(() => {
        let drugs = ["Trastuzumab","Pertuzumab","Lapatinib"];
        let scores = drugs.map(()=>(-7.5-Math.random()*3).toFixed(1));
        resultDiv.innerHTML = `<strong>Top hit:</strong> ${drugs[0]} (${scores[0]} kcal/mol)<br>✅ +10 BIO`;
        drugCount += drugs.length; document.getElementById('drugs').innerText = drugCount;
        tokenBalance += 10; document.getElementById('tokens').innerText = tokenBalance;
        addRecord("Docking", `On ${currentStructure}`, 10);
        Plotly.newPlot('dockChart', [{x:drugs, y:scores, type:'bar', marker:{color:'#1a5f7a'}}], {title:'Binding affinities', paper_bgcolor:'white'});
    }, 2000);
}

async function refreshPrices() {
    await cm.loadConfig();
    cm.showNotification("Prices updated from config.json");
}

// Initialize
document.getElementById('connectWallet')?.addEventListener('click', connectWallet);
cm.loadConfig();
if (document.getElementById('dockChart')) Plotly.newPlot('dockChart', [{x:[],y:[]}], {title:'Docking results will appear here'});
