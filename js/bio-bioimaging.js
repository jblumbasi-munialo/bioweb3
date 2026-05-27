// ========== BIOIMAGING VIEWER FEATURE MODULE ==========
// Loaded when Bioimaging tab is activated

function setZarrUrl(url) {
    document.getElementById('zarrUrl').value = url;
    loadZarr();
}

async function loadZarr() {
    const url = document.getElementById('zarrUrl').value.trim();
    if (!url) { alert('Please enter a Zarr URL'); return; }
    const container = document.getElementById('vizarrFrame');
    container.innerHTML = `<iframe src="https://hms-dbmi.github.io/vizarr/?source=${encodeURIComponent(url)}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;
}
