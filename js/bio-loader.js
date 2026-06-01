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

async function loadFeatureModule(tabId) {
    const feature = featureModules[tabId];
    if (!feature || feature.loaded) return;

    try {
        // Convert file path to ES6 module path (remove .js and convert to import path)
        const modulePath = feature.script.startsWith('./') ? feature.script : `./${feature.script}`;
        const module = await import(modulePath);
        feature.loaded = true;
        console.log(`✅ Feature loaded: ${tabId}`);
        return module;
    } catch (error) {
        console.warn(`⚠️ Failed to load feature: ${tabId} from ${feature.script}`, error);
        feature.loaded = false; // Allow retry on error
        throw error; // Re-throw for caller to handle if needed
    }
}

// Hook into Bootstrap tab events for lazy loading
document.addEventListener('DOMContentLoaded', () => {
    const mainTab = document.getElementById('mainTab');
    if (mainTab) {
        mainTab.addEventListener('show.bs.tab', (event) => {
            const tabId = event.target.getAttribute('data-bs-target')?.substring(1);
            if (tabId && featureModules[tabId]) {
                // Call async function but don't wait - allows UI to remain responsive
                loadFeatureModule(tabId).catch(error => {
                    console.error(`Error loading feature ${tabId}:`, error);
                });
            }
        });
    }
});

async function preloadFeatures(tabIds) {
    const loadPromises = tabIds
        .filter(tabId => featureModules[tabId])
        .map(tabId => loadFeatureModule(tabId).catch(error => {
            console.error(`Error preloading feature ${tabId}:`, error);
        }));
    
    await Promise.all(loadPromises);
}
