// ========== RESEARCH AGGREGATOR FEATURE MODULE ==========

async function optInAndShare() {
    if (!account) { alert("Connect wallet first"); return; }
    if (!supabaseClient) { alert("Supabase not configured"); return; }
    const { data, error } = await supabaseClient
        .from('user_variants')
        .select('chromosome, position')
        .eq('wallet_address', account);
    if (error || !data || data.length === 0) {
        document.getElementById('aggStatus').innerHTML = '<span class="text-danger">No variants to share.</span>';
        return;
    }
    const counts = {};
    data.forEach(v => { counts[v.chromosome] = (counts[v.chromosome] || 0) + 1; });
    const { error: insertError } = await supabaseClient
        .from('aggregated_counts')
        .insert({ chromosome: Object.keys(counts), count: Object.values(counts), submitted_by: account });
    if (insertError) {
        document.getElementById('aggStatus').innerHTML = `<span class="text-danger">Error: ${insertError.message}</span>`;
    } else {
        addRecord("Research Contribution", `Shared variant counts`, 5);
        document.getElementById('aggStatus').innerHTML = '<span class="text-success">✅ +5 BIO earned!</span>';
        loadAggregatedData();
    }
}

async function loadAggregatedData() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('aggregated_counts').select('chromosome, count');
    if (error || !data) return;
    const totals = {};
    data.forEach(row => {
        for (let i = 0; i < row.chromosome.length; i++) {
            const chr = row.chromosome[i];
            const cnt = row.count[i];
            totals[chr] = (totals[chr] || 0) + cnt;
        }
    });
    let html = '<table class="table table-sm"><thead><tr><th>Chromosome</th><th>Total Variants</th></tr></thead><tbody>';
    for (const [chr, cnt] of Object.entries(totals)) {
        html += `<tr><td>${chr}</td><td>${cnt}</td></tr>`;
    }
    html += '</tbody></table>';
    document.getElementById('aggregatedData').innerHTML = html;
}
