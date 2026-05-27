// ========== HEALTHCARE 5.0 FEATURE MODULE ==========
// Federated Learning, IDS, PGx Vault

let flRunning = false;
let pgxEntries = JSON.parse(localStorage.getItem('pgxEntries') || '[]');

async function runFederatedLearning() {
    if (flRunning) return;
    flRunning = true;
    const progressDiv = document.getElementById('flProgress');
    if (!progressDiv) return;
    progressDiv.style.display = 'block';

    Plotly.newPlot('flChart', [{
        x: [], y: [], mode: 'lines+markers', name: 'Global Accuracy',
        line: { color: '#2e7d32', width: 2 }
    }], {
        title: 'Federated Learning Rounds (Privacy‑Preserving)',
        xaxis: { title: 'Round', range: [0,10] },
        yaxis: { title: 'Accuracy', range: [0.5,1.0] },
        paper_bgcolor: 'white'
    });

    for (let round = 1; round <= 10; round++) {
        progressDiv.innerHTML = `<span class="loading"></span> Round ${round}/10…`;
        try {
            const clientNoise = [0.02, -0.01, 0.03, -0.02];
            const response = await fetch('/api/federated_learning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round: round-1, clients: 4, noise: clientNoise })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            Plotly.extendTraces('flChart', { x: [[round]], y: [[data.global_accuracy]] }, [0]);
            addRecord("Federated Learning", `Round ${round}: ${(data.global_accuracy*100).toFixed(1)}%`, 5);
            await new Promise(r => setTimeout(r, 800));
        } catch (err) {
            progressDiv.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`;
            break;
        }
    }
    progressDiv.innerHTML = `<div class="alert alert-success">✅ Federated learning complete!</div>`;
    flRunning = false;
}

async function testIntrusionSample() {
    const resultDiv = document.getElementById('idsResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<span class="loading"></span> Analyzing…';
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
                <strong>Prediction:</strong> ${data.prediction.toUpperCase()} (${(data.confidence*100).toFixed(1)}%)
            </div>
            <table class="table table-sm">
                <tr><th>Accuracy</th><td>${(metrics.accuracy*100).toFixed(2)}%</td></tr>
                <tr><th>Sensitivity</th><td>${(metrics.sensitivity*100).toFixed(2)}%</td></tr>
                <tr><th>Specificity</th><td>${(metrics.specificity*100).toFixed(2)}%</td></tr>
            </table>
        `;
        addRecord("Intrusion Detection", `Predicted: ${data.prediction}`, 10);
    } catch (err) {
        resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
}

function addPGxEntry(e) {
    e.preventDefault();
    const gene    = document.getElementById('pgxGene').value.trim();
    const variant = document.getElementById('pgxVariant').value.trim();
    const drug    = document.getElementById('pgxDrug').value.trim();
    const rec     = document.getElementById('pgxRec').value.trim();
    if (!gene || !variant || !drug) { cm.showNotification('Gene, Variant, Drug required'); return; }
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
        listEl.innerHTML = '<p class="text-muted">No entries yet.</p>';
        return;
    }
    listEl.innerHTML = pgxEntries.map((entry, i) => `
        <div class="card mb-2">
            <div class="card-body p-2">
                <strong>${entry.gene} ${entry.variant}</strong> → ${entry.drug}
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

function initHealthcare50() {
    const flBtn  = document.getElementById('startFLBtn');
    const idsBtn = document.getElementById('testIDSBtn');
    if (flBtn  && !flBtn._init)  { flBtn.addEventListener('click', runFederatedLearning); flBtn._init = true; }
    if (idsBtn && !idsBtn._init) { idsBtn.addEventListener('click', testIntrusionSample); idsBtn._init = true; }
}
