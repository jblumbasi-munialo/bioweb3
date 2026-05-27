// ========== CORE BIOINFORMATICS UTILITIES ==========
// Extracted from bio-core.js for modular loading
// Load this first on page init

class BioUtils {
    static reverseComplement(seq) {
        const comp = {'A':'T','T':'A','C':'G','G':'C','a':'t','t':'a','c':'g','g':'c'};
        return seq.split('').reverse().map(c => comp[c] || c).join('');
    }
    static gcContent(seq) {
        let gc = (seq.match(/[GCgc]/g) || []).length;
        return (gc / seq.length * 100).toFixed(1);
    }
}

const bio = BioUtils;

// ========== COMMON HELPERS ==========
async function fetchWithTimeout(url, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch { 
        clearTimeout(id); 
        return null; 
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
    toast.style.zIndex = 9999;
    const icon = type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    toast.innerHTML = `<i class="fas fa-${icon} me-2"></i>${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// SHA-256 helper for blockchain
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// DNA classification helper
async function classifyDNASequence(seq) {
    const length = seq.length;
    const gcCount = (seq.match(/[GC]/g) || []).length;
    const gcPercent = (gcCount / length) * 100;
    let classification = "Unknown";
    let confidence = 0;

    if (gcPercent > 35 && gcPercent < 45 && length > 50000) {
        classification = "Human / Mammalian genome fragment";
        confidence = 0.65;
    } else if (gcPercent > 50 && length < 10000) {
        classification = "Bacterial or viral sequence";
        confidence = 0.70;
    } else if (gcPercent > 28 && gcPercent < 36 && length > 10000) {
        classification = "Plant or fungal DNA";
        confidence = 0.60;
    } else if (length > 1000) {
        classification = "Eukaryotic genomic fragment";
        confidence = 0.55;
    } else if (length < 200 && /^[ATCG]+$/i.test(seq)) {
        classification = "Short oligo or primer";
        confidence = 0.80;
    }
    if (seq.slice(-20).match(/A{10,}|T{10,}/)) {
        classification += " (possible cDNA)";
    }
    return { classification, confidence, gcPercent, length };
}

function estimateCompressibility(seq) {
    const len = seq.length;
    if (len === 0) return 0;
    const tetramers = new Set();
    for (let i = 0; i <= len - 4; i++) {
        tetramers.add(seq.substr(i, 4));
    }
    const complexity = tetramers.size / Math.max(1, len - 3);
    return Math.min(0.95, Math.max(0, 1 - complexity));
}

function sequenceQualityScore(seq) {
    let score = 100;
    const gc = (seq.match(/[GC]/gi) || []).length / seq.length * 100;
    if (gc < 20 || gc > 80) score -= 20;
    const runs = seq.match(/([ATCG])\1*/gi) || [];
    const maxRun = Math.max(...runs.map(run => run.length));
    if (maxRun > 10) score -= 10;
    if (maxRun > 20) score -= 15;
    const ambig = (seq.match(/[^ATCG]/gi) || []).length;
    if (ambig > 0) score -= Math.min(30, ambig / seq.length * 100);
    return Math.max(0, Math.min(100, score));
}

// Math helpers for DEG pipeline
function mean(arr) { 
    return arr.reduce((s, v) => s + v, 0) / arr.length; 
}

function variance(arr) {
    const m = mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(arr.length - 1, 1);
}

function tStatToPValue(t, df) {
    if (df <= 0) return 1;
    if (df > 30) return 2 * (1 - normalCDF(t));
    const x = df / (df + t * t);
    return Math.min(1, Math.max(0, 1 - Math.pow(1 - x, 0.5) * Math.pow(x, df / 2)));
}

function normalCDF(z) { 
    return 0.5 * (1 + erf(z / Math.SQRT2)); 
}

function erf(x) {
    const sign = x < 0 ? -1 : 1; 
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = e => resolve(e.target.result);
        r.onerror = () => reject(new Error('Failed to read file'));
        r.readAsText(file);
    });
}
