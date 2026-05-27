// ========== GENOMIC VIEWER (IGV.js) FEATURE MODULE ==========

let igvBrowser = null;

async function loadGenomicViewer() {
    const bamUrl = document.getElementById('bamUrl').value.trim();
    if (!bamUrl) { alert('Please enter a BAM URL'); return; }
    const container = document.getElementById('igvContainer');
    container.innerHTML = '<div class="text-center p-5"><div class="loading"></div> Loading...</div>';
    try {
        if (igvBrowser) igvBrowser.dispose();
        const options = {
            genome: "hg38",
            locus: "chr8:127,000,000-128,000,000",
            tracks: [{ name: "User BAM", url: bamUrl, format: "bam", type: "alignment" }]
        };
        igvBrowser = await igv.createBrowser(container, options);
        addRecord("Genomic Viewer", `Loaded BAM: ${bamUrl}`, 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
    }
}

async function loadDemoGenomic() {
    const container = document.getElementById('igvContainer');
    container.innerHTML = '<div class="text-center p-5"><div class="loading"></div> Loading demo...</div>';
    try {
        if (igvBrowser) igvBrowser.dispose();
        const options = {
            genome: "hg38",
            locus: "chr8:127,000,000-128,000,000",
            tracks: [{ name: "Demo BAM", url: "https://igv.org/web/release/data/NA12878.bam", format: "bam", type: "alignment" }]
        };
        igvBrowser = await igv.createBrowser(container, options);
        addRecord("Genomic Viewer", "Loaded demo BAM", 5);
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
    }
}
