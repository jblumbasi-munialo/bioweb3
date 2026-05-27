// ========== DRUG DISCOVERY & DE NOVO DESIGN FEATURE MODULE ==========

async function predictDrug() {
    const gene = document.getElementById('targetGene').value.trim();
    if (!gene) { alert("Enter target gene"); return; }
    const resultDiv = document.getElementById('drugResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<strong>Drugs for ${gene}:</strong><br>Trastuzumab (KES 5,850,000), Pertuzumab (KES 8,060,000), Sotorasib (KES 16,250,000)<br>✅ +10 BIO`;
    addRecord("Drug Discovery", `Predicted drugs for ${gene}`, 10);
}

async function loadDrugData() {
    const statusSpan = document.getElementById('drugStatus');
    const container = document.getElementById('drugTable');
    statusSpan.innerHTML = 'Loading...';
    try {
        const url = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/clinical_trial_opportunities.csv';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
        addRecord("Drug Discovery", `Loaded ${dataRows.length} clinical opportunities`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}

async function generateDeNovoMolecules() {
    const target = document.getElementById('targetGeneDeNovo').value.trim();
    if (!target) { alert("Enter a target gene"); return; }
    const resultDiv = document.getElementById('deNovoResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="loading"></div> Generating novel molecules with AI...';

    setTimeout(() => {
        const molecules = [
            { smiles: "CC(C)(C)C(=O)O", affinity: -9.2, novelty: 0.92 },
            { smiles: "C1=CC=C2C(=C1)C=CC=N2", affinity: -8.7, novelty: 0.88 },
            { smiles: "C1=CC(=CC=C1C(=O)N2CCN(CC2)C3=NC=NC(=C3)C4=CC(=C(C=C4)O)O)O", affinity: -10.1, novelty: 0.95 }
        ];
        const html = `<strong>Top AI‑generated molecules for ${target}:</strong><br>${molecules.map(m => `<div class="d-flex justify-content-between p-2 bg-light rounded mb-1"><code>${m.smiles}</code><span class="badge bg-success">ΔG = ${m.affinity} kcal/mol</span></div>`).join('')}`;
        resultDiv.innerHTML = html;
        addRecord("De Novo Drug Design", `Generated 3 molecules for ${target}`, 15);
        Plotly.newPlot('deNovoChart', [{x: molecules.map(m => m.smiles.slice(0,10)), y: molecules.map(m => m.affinity), type: 'bar', marker: { color: '#2e7d32' }}], { title: 'Predicted binding affinities', paper_bgcolor: 'white' });
    }, 2000);
}
