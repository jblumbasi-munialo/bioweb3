// ========== CRISPR OFF-TARGET ANALYSIS FEATURE MODULE ==========
// Loaded when CRISPR tab is activated

async function loadCrisprData() {
    const statusSpan = document.getElementById('crisprStatus');
    const container = document.getElementById('crisprTable');
    statusSpan.innerHTML = 'Loading...';
    try {
        const url = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/crispr_off_target_analysis.csv';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} – file not found in repo`);
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
        addRecord("CRISPR Analysis", `Loaded ${dataRows.length} off-target predictions`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error loading CRISPR data: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}
