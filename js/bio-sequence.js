// ========== SEQUENCE ANALYSIS FEATURE MODULE ==========
// Loaded when Sequence tab is activated

async function analyzeSeq() {
    let seq = document.getElementById('seqInput').value.trim();
    if (!seq) { alert("Paste a DNA/RNA/protein sequence"); return; }
    seq = seq.toUpperCase();

    const rev = bio.reverseComplement(seq);
    const gc = bio.gcContent(seq);
    const length = seq.length;

    const classification = await classifyDNASequence(seq);
    const compressibility = estimateCompressibility(seq);
    const quality = sequenceQualityScore(seq);
    const maxRun = Math.max(...(seq.match(/([ATCG])\1*/gi) || []).map(run => run.length));

    const hash = await sha256(seq);
    addRecord("DNA Sequence Analysis", `Length: ${length}, GC%: ${gc}%, Hash: ${hash.slice(0,16)}...`, 5);

    document.getElementById('seqResult').innerHTML = `
        <strong>Analysis</strong><br>
        Length: ${length}<br>
        GC%: ${gc}%<br>
        <strong>Predicted type:</strong> ${classification.classification} (confidence: ${(classification.confidence*100).toFixed(0)}%)<br>
        Estimated compressibility: ${(compressibility*100).toFixed(1)}% (higher = more repeats)<br>
        Quality score: ${quality}/100<br>
        <small>GC% = ${classification.gcPercent.toFixed(1)}%, max homopolymer run = ${maxRun}</small>
    `;
    document.getElementById('revCompDisplay').innerHTML = `<strong>Reverse complement</strong><br><pre>${rev}</pre>`;
    document.getElementById('seqResult').style.display = 'block';

    analysisCount++;
    document.getElementById('analyses').innerText = analysisCount;
    saveUserProfile();

    cm.showNotification(`Sequence analysis recorded on blockchain (hash: ${hash.slice(0,8)}...)`);
}

async function downloadSequenceReport() {
    const seq = document.getElementById('seqInput').value.trim();
    if (!seq) { alert("Please analyze a sequence first"); return; }
    
    const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Sequence Analysis Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #2c7a47; }
                .section { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 20px; }
                code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>Sequence Analysis Report</h1>
            <div class="section">
                <h3>Analysis Summary</h3>
                <p>${document.getElementById('seqResult').innerHTML}</p>
            </div>
            <div class="section">
                <h3>Reverse Complement</h3>
                <pre>${document.getElementById('revCompDisplay').textContent}</pre>
            </div>
            <div class="section">
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `;
    
    const blob = new Blob([reportHtml], {type: 'text/html'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sequence_report_${new Date().getTime()}.html`;
    link.click();
}
