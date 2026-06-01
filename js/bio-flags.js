// ========== FEATURE FLAGS MANAGER ==========
// Control feature availability per environment

class FeatureFlags {
    constructor() {
        this.flags = {};
        this.environment = this.detectEnvironment();
        this.loaded = false;
    }

    detectEnvironment() {
        const env = new URLSearchParams(window.location.search).get('env');
        if (env && ['dev', 'development', 'staging', 'production'].includes(env)) {
            return env === 'dev' ? 'development' : env;
        }
        
        if (localStorage.getItem('bioweb3_env')) {
            return localStorage.getItem('bioweb3_env');
        }
        
        const hostname = window.location.hostname;
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            return 'development';
        }
        if (hostname.includes('staging')) {
            return 'staging';
        }
        return 'production';
    }

    async load() {
        if (this.loaded) return;
        try {
            const response = await fetch('./features.json');
            if (!response.ok) throw new Error('Failed to load features.json');
            const allFlags = await response.json();
            this.flags = allFlags[this.environment] || allFlags.production;
            this.loaded = true;
            console.log(`✅ Feature flags loaded for: ${this.environment}`, this.flags);
        } catch (err) {
            console.warn('Could not load feature flags, using defaults:', err);
            this.flags = this.getDefaults();
            this.loaded = true;
        }
    }

    getDefaults() {
        return {
            sequence: true,
            alphafold: true,
            docking: true,
            pricing: true,
            bioimaging: true,
            crispr: true,
            drugDiscovery: true,
            goEnrichment: true,
            genomeViewer: true,
            regulatoryNetwork: true,
            survival: true,
            degPipeline: true,
            healthcare50: false,
            researchAgg: false,
            chatbot: true,
            blockchain: true,
            profile: true,
            betaFeatures: false,
            devTools: false
        };
    }

    isEnabled(featureName) {
        return this.flags[featureName] === true;
    }

    setEnvironment(env) {
        if (['development', 'staging', 'production'].includes(env)) {
            this.environment = env;
            localStorage.setItem('bioweb3_env', env);
            console.log(`✅ Environment switched to: ${env}`);
            window.location.reload();
        } else {
            console.error('Invalid environment:', env);
        }
    }

    getEnvironment() {
        return this.environment;
    }

    getAllFlags() {
        return { ...this.flags, environment: this.environment };
    }

    conditionalLoad(featureName) {
        if (!this.isEnabled(featureName)) {
            console.log(`⚠️ Feature disabled: ${featureName}`);
            return false;
        }
        return true;
    }

    showDevTools() {
        if (!this.isEnabled('devTools')) {
            console.warn('DevTools disabled in this environment');
            return;
        }
        console.table(this.getAllFlags());
        console.log('To change environment, run: featureFlags.setEnvironment("staging")');
    }
}

const featureFlags = new FeatureFlags();

// Expose in window for console access (dev only)
if (featureFlags.environment === 'development') {
    window.featureFlags = featureFlags;
}
