// ========== GO ENRICHMENT ANALYSIS FEATURE MODULE ==========

async function loadGOData() {
    const statusSpan = document.getElementById('goStatus');
    const container = document.getElementById('goTable');
    const chartDiv = document.getElementById('goChart');
    statusSpan.innerHTML = 'Loading...';
    try {
        let data = [];
        let jsonUrl = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/go_enrichment.json';
        let response = await fetch(jsonUrl);
        if (response.ok) {
            data = await response.json();
        } else {
            const csvUrl = 'https://raw.githubusercontent.com/jblumbasi-munialo/HCMI-CMDC-Molecular-Medicine-Research/main/go_enrichment.csv';
            response = await fetch(csvUrl);
            if (!response.ok) throw new Error('No GO data file found');
            const csvText = await response.text();
            const rows = csvText.trim().split('\n').map(row => row.split(','));
            if (rows.length < 2) throw new Error('No GO data');
            const headers = rows[0];
            data = rows.slice(1).map(row => {
                let obj = {};
                headers.forEach((h, i) => obj[h.trim()] = (row[i] || '').trim());
                return obj;
            });
        }

        if (data.length > 0) {
            let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
            Object.keys(data[0]).forEach(k => html += `<th>${k}</th>`);
            html += '</tr></thead><tbody>';
            data.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(v => html += `<td>${v}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-muted">No GO data found.</p>';
        }

        statusSpan.innerHTML = `✅ Loaded ${data.length} GO terms.`;

        if (data.length > 0 && data[0].hasOwnProperty('enrichment_score')) {
            const top10 = [...data].sort((a,b) => parseFloat(b.enrichment_score) - parseFloat(a.enrichment_score)).slice(0,10);
            const terms = top10.map(d => d.term || d.description || 'Term');
            const scores = top10.map(d => parseFloat(d.enrichment_score));
            Plotly.newPlot(chartDiv, [{
                x: scores, y: terms, type: 'bar', orientation: 'h',
                marker: { color: '#2c7a47' }
            }], {
                title: 'Top 10 Enriched GO Terms',
                xaxis: { title: 'Enrichment Score' },
                paper_bgcolor: 'white', font: { color: '#1a1a1a' }
            });
        }
        addRecord("GO Enrichment", `Loaded ${data.length} GO terms`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}
