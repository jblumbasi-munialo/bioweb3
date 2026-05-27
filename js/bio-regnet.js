// ========== REGULATORY NETWORK & DRUG TARGETS FEATURE MODULE ==========

let currentDrugTarget = null;

async function loadRegulatoryNetwork() {
    const statusSpan  = document.getElementById('regnetStatus');
    const drugTableDiv = document.getElementById('drugTargetTable');
    statusSpan.innerHTML = 'Loading...';
    drugTableDiv.innerHTML = '<div class="loading"></div>';
    try {
        const drugUrl  = 'https://raw.githubusercontent.com/jblumbasi-munialo/ARCHS4-Regulatory-Network/main/drug_targets.csv';
        const drugResp = await fetch(drugUrl);
        if (!drugResp.ok) throw new Error(`HTTP ${drugResp.status}`);
        const drugCsv  = await drugResp.text();
        const rows     = drugCsv.trim().split('\n').map(r => r.split(','));
        if (rows.length < 2) throw new Error('No drug-target data');
        const headers  = rows[0];
        const dataRows = rows.slice(1);
        let tableHtml  = '<div class="table-responsive"><table class="table table-bordered"><thead><tr>';
        headers.forEach(h => tableHtml += `<th>${h.trim()}</th>`);
        tableHtml += '<th>Select</th></tr></thead><tbody>';
        dataRows.forEach((row, idx) => {
            tableHtml += '<tr>';
            row.forEach(cell => tableHtml += `<td>${cell.trim()}</td>`);
            tableHtml += `<td><input type="radio" name="drugTarget" value="${idx}" onclick="selectDrugTarget(${idx}, '${row[0]}')"></td></tr>`;
        });
        tableHtml += '</tbody></table></div>';
        drugTableDiv.innerHTML = tableHtml;
        statusSpan.innerHTML = `✅ Loaded ${dataRows.length} interactions.`;
        addRecord("Regulatory Network", `Loaded ${dataRows.length} pairs`, 5);
    } catch (err) {
        drugTableDiv.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}

function selectDrugTarget(idx, drugGene) {
    currentDrugTarget = { idx, drugGene };
    document.getElementById('recordDrugTargetBtn').disabled = false;
}

async function recordCurrentDrugTarget() {
    if (!currentDrugTarget) { alert('Select a target first'); return; }
    addRecord("Drug Target Selection", `Selected: ${currentDrugTarget.drugGene}`, 10);
    cm.showNotification(`Recorded ${currentDrugTarget.drugGene}! +10 BIO`);
    document.getElementById('recordDrugTargetBtn').disabled = true;
    currentDrugTarget = null;
}
