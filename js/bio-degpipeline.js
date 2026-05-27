// ========== DEG PIPELINE FEATURE MODULE ==========
// Differential Expression Gene Analysis

async function runDEGPipeline() {
    const fileInput = document.getElementById('degCountFile');
    const statusDiv = document.getElementById('pipelineStatus');
    const resultsDiv = document.getElementById('pipelineResults');
    
    statusDiv.style.display = 'block';
    resultsDiv.innerHTML = '';

    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        statusDiv.innerHTML = '<div class="alert alert-warning">⚠️ Please select a CSV file.</div>';
        return;
    }

    statusDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>⚠️ Simulation:</strong> This is client-side with Welch's t-test and Benjamini-Hochberg FDR.
        </div>
        <p><span class="loading"></span> Parsing CSV…</p>
    `;

    try {
        const text = await readFileAsText(fileInput.files[0]);
        const { genes, controlCols, treatCols, matrix } = parseCountMatrix(text);

        if (genes.length === 0) throw new Error('No genes found.');
        if (controlCols.length < 2 || treatCols.length < 2) {
            throw new Error(`Need ≥2 control AND ≥2 treatment samples.`);
        }

        statusDiv.innerHTML += `<p>✅ Parsed <strong>${genes.length} genes</strong>.</p>`;

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

        const n = results.length;
        const sorted = [...results].sort((a, b) => a.pValue - b.pValue);
        sorted.forEach((r, rank) => { r.adjPValue = Math.min(1, (r.pValue * n) / (rank + 1)); });

        results.forEach(r => {
            r.significant = r.adjPValue < 0.05 && Math.abs(r.log2FC) >= 1;
            r.direction   = r.log2FC > 0 ? 'UP' : 'DOWN';
        });

        const upCount   = results.filter(r => r.significant && r.direction === 'UP').length;
        const downCount = results.filter(r => r.significant && r.direction === 'DOWN').length;

        statusDiv.innerHTML += `<p>✅ <strong class="text-danger">${upCount} up</strong>, <strong class="text-primary">${downCount} down</strong></p>`;

        renderVolcanoPlot(results, resultsDiv);
        renderDEGTable(results, resultsDiv);

        const csvData = resultsToCSV(results);
        const dlBtn   = document.createElement('a');
        dlBtn.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvData);
        dlBtn.download = 'deg_results.csv';
        dlBtn.className = 'btn btn-success mt-3';
        dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Results CSV';
        resultsDiv.appendChild(dlBtn);

        analysisCount++;
        document.getElementById('analyses').innerText = analysisCount;
        addRecord("DEG Pipeline", `${genes.length} genes – ${upCount} up, ${downCount} down`, 20);
        saveUserProfile();

    } catch (err) {
        statusDiv.innerHTML += `<div class="alert alert-danger">❌ ${err.message}</div>`;
    }
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
        text: genes.map(r => `${r.gene}<br>log₂FC: ${r.log2FC.toFixed(2)}`),
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
        paper_bgcolor: 'white'
    }, { responsive: true });
}

function renderDEGTable(results, container) {
    const topGenes = [...results].filter(r => r.significant)
        .sort((a, b) => Math.abs(b.log2FC) - Math.abs(a.log2FC)).slice(0, 30);
    if (topGenes.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-muted mt-3';
        p.textContent = 'No significant DEGs found.';
        container.appendChild(p); 
        return;
    }
    const wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';
    wrap.innerHTML = `
        <h5 class="mt-3">Top ${topGenes.length} Significant DEGs</h5>
        <table class="table table-sm table-striped" style="font-size:13px">
            <thead><tr><th>Gene</th><th>Dir</th><th>log₂FC</th><th>p-value</th><th>adj. p</th></tr></thead>
            <tbody>
                ${topGenes.map(r => `<tr>
                    <td><strong>${r.gene}</strong></td>
                    <td><span class="badge bg-${r.direction === 'UP' ? 'danger' : 'primary'}">${r.direction}</span></td>
                    <td>${r.log2FC.toFixed(3)}</td>
                    <td>${r.pValue.toExponential(2)}</td>
                    <td>${r.adjPValue.toExponential(2)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
    container.appendChild(wrap);
}

function resultsToCSV(results) {
    const header = 'gene,log2FC,pValue,adjPValue,direction,significant';
    const rows = results.map(r =>
        `${r.gene},${r.log2FC.toFixed(4)},${r.pValue.toExponential(4)},${r.adjPValue.toExponential(4)},${r.direction},${r.significant}`
    );
    return [header, ...rows].join('\n');
}
