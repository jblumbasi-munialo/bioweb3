// ========== FEATURE LAZY LOADER ==========
// Loads feature modules dynamically when tabs are activated

const featureModules = {
    'seq': { script: 'js/bio-sequence.js', loaded: false },
    'structure': { script: 'js/bio-alphafold.js', loaded: false },
    'docking': { script: 'js/bio-docking.js', loaded: false },
    'pricing': { script: 'js/bio-pricing.js', loaded: false },
    'profile': { script: 'js/bio-profile.js', loaded: false },
    'bioimaging': { script: 'js/bio-bioimaging.js', loaded: false },
    'crispr': { script: 'js/bio-crispr.js', loaded: false },
    'drugdiscovery': { script: 'js/bio-drugs.js', loaded: false },
    'goenrichment': { script: 'js/bio-goenrichment.js', loaded: false },
    'genomicviewer': { script: 'js/bio-genome.js', loaded: false },
    'runpipe': { script: 'js/bio-degpipeline.js', loaded: false },
    'regnet': { script: 'js/bio-regnet.js', loaded: false },
    'survival': { script: 'js/bio-survival.js', loaded: false },
    'healthcare50': { script: 'js/bio-healthcare50.js', loaded: false },
    'researchAgg': { script: 'js/bio-researchagg.js', loaded: false }
};

function loadFeatureModule(tabId) {
    const feature = featureModules[tabId];
    if (!feature || feature.loaded) return;

    const script = document.createElement('script');
    script.src = feature.script;
    script.onload = () => {
        feature.loaded = true;
        console.log(`✅ Feature loaded: ${tabId}`);
    };
    script.onerror = () => {
        console.warn(`⚠️ Failed to load feature: ${tabId} from ${feature.script}`);
    };
    document.head.appendChild(script);
}

// Hook into Bootstrap tab events for lazy loading
document.addEventListener('DOMContentLoaded', () => {
    const mainTab = document.getElementById('mainTab');
    if (mainTab) {
        mainTab.addEventListener('show.bs.tab', (event) => {
            const tabId = event.target.getAttribute('data-bs-target')?.substring(1);
            if (tabId && featureModules[tabId]) {
                loadFeatureModule(tabId);
            }
        });
    }
});

function preloadFeatures(tabIds) {
    tabIds.forEach(tabId => {
        if (featureModules[tabId]) {
            loadFeatureModule(tabId);
        }
    });
}
