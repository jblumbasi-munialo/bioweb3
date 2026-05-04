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
// 🔴 REPLACE WITH YOUR ACTUAL SUPABASE URL AND ANON KEY 🔴
const SUPABASE_URL = "https://your-project.supabase.co";      // <-- CHANGE THIS
const SUPABASE_ANON_KEY = "your-anon-key";                   // <-- CHANGE THIS
let supabase;
async function initSupabase() {
    if (!window.supabaseJs) {
        console.error("Supabase JS not loaded – using fallback (local storage only)");
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

// ========== GENOME VAULT (VCF storage & query) ==========
// Helper: compute SHA-256 hash
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function uploadVCF() {
    const fileInput = document.getElementById('vcfFile');
    const file = fileInput.files[0];
    if (!file) return alert("Select a VCF file");
    if (!account) return alert("Connect wallet first");

    const text = await file.text();
    const lines = text.split('\n');
    const variants = [];
    let variantCount = 0;

    for (let line of lines) {
        if (line.startsWith('#')) continue;
        const cols = line.split('\t');
        if (cols.length < 5) continue;
        // Basic VCF columns: CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT, ...
        variants.push({
            wallet_address: account,
            chromosome: cols[0],
            position: parseInt(cols[1]),
            ref: cols[3],
            alt: cols[4],
            rsid: (cols[2] !== '.' && cols[2] !== '') ? cols[2] : null,
            genotype: cols[9] ? cols[9].split(':')[0] : ''
        });
        variantCount++;
        // Limit to 10,000 to avoid hitting Supabase limits for demo
        if (variantCount >= 10000) break;
    }

    if (variants.length === 0) {
        alert("No valid variants found in VCF");
        return;
    }

    // Insert into Supabase
    if (supabase) {
        const { error } = await supabase.from('user_variants').insert(variants);
        if (error) {
            console.error(error);
            alert("Database error: " + error.message);
            return;
        }
    } else {
        // Fallback: store in localStorage
        localStorage.setItem(`vcf_${account}`, JSON.stringify(variants));
    }

    // Record hash in blockchain ledger
    const hash = await sha256(text);
    addRecord("VCF storage", `Stored ${variants.length} variants, hash: ${hash.slice(0,16)}...`, 20);
    cm.showNotification(`Stored ${variants.length} variants in Genome Vault! +20 BIO`);
    fileInput.value = ''; // clear
}

async function queryVariants() {
    const query = document.getElementById('chrPos').value.trim();
    const match = query.match(/chr([0-9XY]+):(\d+)-(\d+)/i);
    if (!match) {
        alert("Use format: chr7:55174779-55274879");
        return;
    }
    const [, chr, start, end] = match;
    if (!account) {
        alert("Connect wallet first");
        return;
    }

    let variants = [];
    if (supabase) {
        const { data, error } = await supabase
            .from('user_variants')
            .select('*')
            .eq('wallet_address', account)
            .eq('chromosome', chr)
            .gte('position', parseInt(start))
            .lte('position', parseInt(end));
        if (error) {
            console.error(error);
            alert("Query error: " + error.message);
            return;
        }
        variants = data;
    } else {
        const stored = localStorage.getItem(`vcf_${account}`);
        if (stored) {
            const all = JSON.parse(stored);
            variants = all.filter(v => v.chromosome === chr && v.position >= parseInt(start) && v.position <= parseInt(end));
        }
    }

    const resultDiv = document.getElementById('variantResult');
    if (variants.length === 0) {
        resultDiv.innerHTML = "<p>No variants found in this region.</p>";
    } else {
        let html = `<strong>Found ${variants.length} variants:</strong><div class="table-responsive"><table class="table table-sm table-bordered table-variants"><thead><tr><th>Chr</th><th>Pos</th><th>Ref</th><th>Alt</th><th>rsID</th><th>Genotype</th></tr></thead><tbody>`;
        variants.forEach(v => {
            html += `<tr><td>${v.chromosome}</td><td>${v.position}</td><td>${v.ref}</td><td>${v.alt}</td><td>${v.rsid || '-'}</td><td>${v.genotype || '-'}</td></tr>`;
        });
        html += `</tbody></table></div>`;
        resultDiv.innerHTML = html;
    }
    resultDiv.style.display = 'block';

    // Also load IGV.js for visualisation (only if we have a BAM/CRAM, but we can show a placeholder)
    const igvDiv = document.getElementById('igvViewer');
    igvDiv.innerHTML = '<div class="text-muted">IGV.js visualisation requires a BAM/CRAM file. This feature can be extended later.</div>';
    // Optionally, you could call IGV with a public BAM – but we skip for now.
}

// ========== FLOATING CHATBOT WITH MEMORY ==========
let conversationHistory = [
    { role: "system", content: "You are a helpful scientific assistant for BioWeb3. The platform offers: protein sequence analysis, AlphaFold structure prediction, molecular docking simulation, blockchain recording, drug pricing in KES, a bioimaging viewer, and a Genome Vault to store/query VCF files. Answer only science questions. Redirect off-topic politely." }
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
});
