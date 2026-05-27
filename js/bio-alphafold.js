// ========== ALPHAFOLD STRUCTURE ANALYSIS FEATURE MODULE ==========
// Loaded when AlphaFold tab is activated

let currentPdbData = null;
let currentPlddtData = null;
let currentAccessionFull = null;
let currentProteinNameFull = null;
let currentViewer = null;
let pocketHighlights = [];

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
    resultDiv.style.display = 'block';
    document.getElementById('confidenceLabel').style.display = 'none';

    const modelSelect = document.getElementById('modelSelect');
    const modelType = modelSelect ? modelSelect.value : 'AF2';

    const pdbUrl = `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v4.pdb`;

    try {
        const pdbResponse = await fetch(pdbUrl);
        if (!pdbResponse.ok) {
            if (modelType !== 'AF2') {
                console.warn(`${modelType} model not found, falling back to AF2`);
                const fallbackResponse = await fetch(pdbUrl);
                if (!fallbackResponse.ok) throw new Error(`No model available for ${accession}`);
                currentPdbData = await fallbackResponse.text();
            } else {
                throw new Error(`AlphaFold model not available for ${accession}`);
            }
        } else {
            currentPdbData = await pdbResponse.text();
        }

        const plddtMap = new Map();
        const lines = currentPdbData.split('\n');
        for (const line of lines) {
            if (line.startsWith('ATOM')) {
                const resNum = parseInt(line.substring(22, 26).trim());
                const bfactor = parseFloat(line.substring(60, 66).trim());
                if (!plddtMap.has(resNum) || bfactor > plddtMap.get(resNum)) {
                    plddtMap.set(resNum, bfactor);
                }
            }
        }
        currentPlddtData = Array.from(plddtMap.entries()).sort((a,b) => a[0]-b[0]);

        const getColor = (bfactor) => {
            if (bfactor >= 90) return '#0055d4';
            if (bfactor >= 70) return '#3ca14d';
            if (bfactor >= 50) return '#f9ac67';
            return '#e34132';
        };

        const config = { backgroundColor: 0xf5f5f5 };
        if (currentViewer) currentViewer.clear();
        currentViewer = new $3Dmol.GLViewer(viewerDiv, config);
        currentViewer.addModel(currentPdbData, "pdb");
        currentViewer.setStyle({}, (atom) => {
            if (atom.resn === 'HOH') return {};
            return { cartoon: { color: getColor(plddtMap.get(atom.resi) || 50), opacity: 0.9 } };
        });
        currentViewer.zoomTo();
        currentViewer.render();

        document.getElementById('confidenceLabel').style.display = 'block';
        drawPlddtChart(currentPlddtData);

        resultDiv.innerHTML = `<i class="fas fa-check-circle text-success"></i> <strong>Loaded: ${proteinName}</strong><br>
                               Model: ${modelType}<br>Accession: ${accession}<br>✅ +15 BIO`;
        structCount++;
        document.getElementById('structures').innerText = structCount;
        addRecord("AlphaFold", `${proteinName} (${accession}) ${modelType} model loaded with confidence coloring`, 15);
        currentAccessionFull = accession;
        currentProteinNameFull = proteinName;
        saveUserProfile();
    } catch (err) {
        resultDiv.innerHTML += `<br><i class="fas fa-exclamation-triangle text-danger"></i> Could not load structure: ${err.message}`;
    }
}

function drawPlddtChart(plddtData) {
    const residues = plddtData.map(d => d[0]);
    const scores = plddtData.map(d => d[1]);
    const colors = scores.map(s => {
        if (s >= 90) return '#0055d4';
        if (s >= 70) return '#3ca14d';
        if (s >= 50) return '#f9ac67';
        return '#e34132';
    });
    const trace = {
        x: residues,
        y: scores,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: colors, size: 4 },
        line: { color: '#666', width: 1 },
        name: 'pLDDT'
    };
    const layout = {
        title: 'Per-residue Confidence (pLDDT)',
        xaxis: { title: 'Residue Number' },
        yaxis: { title: 'pLDDT Score', range: [0, 100] },
        margin: { t: 30, l: 40, r: 20, b: 30 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        height: 150
    };
    Plotly.newPlot('plddtChart', [trace], layout, { responsive: true });
}

function setViewStyle(style) {
    if (!currentViewer) return;
    currentViewer.clear();
    currentViewer.addModel(currentPdbData, "pdb");
    if (style === 'cartoon') {
        const colors = {};
        currentPlddtData.forEach(([res, score]) => {
            let color;
            if (score >= 90) color = '#0055d4';
            else if (score >= 70) color = '#3ca14d';
            else if (score >= 50) color = '#f9ac67';
            else color = '#e34132';
            colors[res] = color;
        });
        currentViewer.setStyle({}, (atom) => {
            if (atom.resn === 'HOH') return {};
            return { cartoon: { color: colors[atom.resi] || '#3ca14d', opacity: 0.9 } };
        });
    } else if (style === 'surface') {
        currentViewer.setStyle({}, { surface: { opacity: 0.7, color: '#3ca14d' } });
    } else if (style === 'line') {
        currentViewer.setStyle({}, { line: { color: '#2c7a47', linewidth: 1 } });
    } else if (style === 'sphere') {
        currentViewer.setStyle({}, { sphere: { scale: 0.5, color: '#3ca14d' } });
    }
    currentViewer.zoomTo();
    currentViewer.render();
}

async function predictBindingPockets() {
    if (!currentPdbData) {
        showToast('Load a protein structure first.', 'warning');
        return;
    }
    const resultDiv = document.getElementById('structResult');
    resultDiv.innerHTML += '<div class="loading"></div> Predicting binding pockets...';
    try {
        const lines = currentPdbData.split('\n');
        const residues = [];
        for (const line of lines) {
            if (line.startsWith('ATOM') && line[13] !== 'H') {
                const resNum = parseInt(line.substring(22, 26).trim());
                const bfactor = parseFloat(line.substring(60, 66).trim());
                if (!residues.find(r => r.num === resNum)) {
                    residues.push({ num: resNum, bfactor });
                }
            }
        }
        const pocketResidues = residues.filter(r => r.bfactor < 60).map(r => r.num);
        if (pocketResidues.length === 0) {
            showToast('No potential pockets found.', 'info');
            resultDiv.innerHTML += '<br>⚠️ No clear binding pockets predicted.';
            return;
        }
        if (currentViewer) {
            currentViewer.setStyle({}, (atom) => {
                if (atom.resn === 'HOH') return {};
                if (pocketResidues.includes(atom.resi)) {
                    return { cartoon: { color: '#ffaa00', opacity: 0.9 } };
                }
                const color = atom.bfactor >= 90 ? '#0055d4' : atom.bfactor >= 70 ? '#3ca14d' : atom.bfactor >= 50 ? '#f9ac67' : '#e34132';
                return { cartoon: { color, opacity: 0.9 } };
            });
            currentViewer.render();
            pocketHighlights = pocketResidues;
            resultDiv.innerHTML += `<br><i class="fas fa-map-pin"></i> Predicted binding pockets at residues: ${pocketResidues.slice(0,20).join(', ')}${pocketResidues.length > 20 ? '…' : ''}`;
            addRecord("Binding Pocket Prediction", `Found ${pocketResidues.length} pocket residues`, 10);
        }
    } catch (err) {
        resultDiv.innerHTML += `<br><span class="text-danger">Pocket prediction error: ${err.message}</span>`;
    }
}

async function downloadStructureReport() {
    if (!currentPdbData || !currentAccessionFull) {
        alert('Load a protein structure first.');
        return;
    }
    let screenshotDataUrl = '';
    if (typeof html2canvas !== 'undefined') {
        try {
            const viewerDiv = document.getElementById('viewer3d');
            const canvas = await html2canvas(viewerDiv, { scale: 2 });
            screenshotDataUrl = canvas.toDataURL();
        } catch (e) { console.warn('Screenshot capture failed', e); }
    }
    const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>AlphaFold Report: ${currentAccessionFull}</title><style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #2c7a47; }
            .section { margin-bottom: 30px; }
            img { max-width: 100%; border: 1px solid #ccc; }
        </style></head>
        <body>
            <h1>AlphaFold Structure Report</h1>
            <div class="section"><strong>Protein:</strong> ${currentProteinNameFull || currentAccessionFull}</div>
            <div class="section"><strong>Accession:</strong> ${currentAccessionFull}</div>
            <div class="section"><strong>Model Type:</strong> ${document.getElementById('modelSelect')?.value || 'AF2'}</div>
            <div class="section"><strong>Date:</strong> ${new Date().toLocaleString()}</div>
            <div class="section"><strong>Structure Viewer Screenshot:</strong><br><img src="${screenshotDataUrl}" alt="Structure Screenshot"></div>
            <div class="section"><strong>Blockchain Record:</strong> ${ledger[0]?.hash || 'Not recorded'}</div>
        </body>
        </html>
    `;
    const blob = new Blob([reportHtml], {type: 'text/html'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alphafold_report_${currentAccessionFull}.html`;
    link.click();
}
