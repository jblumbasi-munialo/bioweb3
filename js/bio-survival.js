// ========== SURVIVAL ANALYSIS FEATURE MODULE ==========

let currentSurvivalStats = null;

async function loadSurvivalData() {
    const statusSpan = document.getElementById('survivalStatus');
    const plotDiv    = document.getElementById('kmPlot');
    const summaryDiv = document.getElementById('survivalSummary');
    statusSpan.innerHTML = 'Loading...';
    plotDiv.innerHTML = '<div class="loading"></div>';
    try {
        let times = [], events = [], groups = [];
        let response = await fetch('./data/survival_analysis_results.csv');
        if (!response.ok) {
            for (let i = 0; i < 100; i++) {
                const isTreatment = Math.random() < 0.5;
                times.push(isTreatment ? Math.random() * 50 + 10 : Math.random() * 40 + 5);
                events.push(Math.random() < 0.7 ? 1 : 0);
                groups.push(isTreatment ? 'Treatment' : 'Control');
            }
            statusSpan.innerHTML = '⚠️ No CSV found – showing demo data.';
        } else {
            const csvText = await response.text();
            const rows = csvText.trim().split('\n').map(r => r.split(','));
            const headers = rows[0].map(h => h.toLowerCase());
            const timeIdx  = headers.findIndex(h => h.includes('time'));
            const eventIdx = headers.findIndex(h => h.includes('event'));
            const groupIdx = headers.findIndex(h => h.includes('group'));
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < Math.max(timeIdx, eventIdx, groupIdx) + 1) continue;
                times.push(parseFloat(row[timeIdx]));
                events.push(parseFloat(row[eventIdx]));
                groups.push(row[groupIdx]);
            }
            statusSpan.innerHTML = `✅ Loaded ${times.length} patients.`;
        }
        const uniqueGroups = [...new Set(groups)];
        const traces = uniqueGroups.map(g => {
            const idxs     = groups.map((v, i) => v === g ? i : -1).filter(i => i !== -1);
            const sorted   = idxs.map(i => ({ t: times[i], e: events[i] })).sort((a,b) => a.t - b.t);
            let survival = 1.0, atRisk = sorted.length;
            let x = [0], y = [1.0];
            for (const { t, e } of sorted) {
                if (e === 1) { survival *= (1 - 1/atRisk); x.push(t); y.push(survival); }
                atRisk--;
            }
            return { x, y, mode: 'lines', name: g, line: { width: 3 }, type: 'scatter' };
        });
        Plotly.newPlot('kmPlot', traces, {
            title: 'Kaplan-Meier Survival Curves',
            xaxis: { title: 'Time' },
            yaxis: { title: 'Survival Probability', range: [0, 1] },
            paper_bgcolor: 'white'
        });
        const eventsCount = events.filter(e => e === 1).length;
        summaryDiv.innerHTML = `<div class="alert alert-info"><strong>Summary</strong><br>Patients: ${times.length}<br>Events: ${eventsCount}<br>Groups: ${uniqueGroups.join(', ')}</div>`;
        currentSurvivalStats = { totalPatients: times.length, eventsCount, groups: uniqueGroups };
        addRecord("Survival Analysis", `n=${times.length}`, 5);
    } catch (err) {
        plotDiv.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
        statusSpan.innerHTML = '❌ Failed';
    }
}

async function recordSurvivalAnalysis() {
    if (!currentSurvivalStats) { alert('Load data first'); return; }
    addRecord("Survival Analysis", `Patients=${currentSurvivalStats.totalPatients}`, 10);
    cm.showNotification('Analysis recorded! +10 BIO');
}
