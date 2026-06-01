# BioWeb3 Phase 2: Advanced Performance Optimization

This document describes Phase 2 enhancements to the BioWeb3 platform, building on the modular architecture from Phase 1.

## Phase 2 Features

### 1. **Feature Flags** ✅
Environment-based feature control without redeployment.

**Files:**
- `js/bio-flags.js` - Feature flag manager
- `features.json` - Environment configuration (dev/staging/production)
- `.env.example` - Environment variable template

**Usage:**
```javascript
// Load flags (automatic on page init)
await featureFlags.load();

// Check if feature enabled
if (featureFlags.isEnabled('alphafold')) {
    // Load alphafold module
}

// Switch environment (dev only)
featureFlags.setEnvironment('staging');

// View all flags in console
featureFlags.showDevTools();
```

**Environments:**
- **development**: All features enabled, dev tools available
- **staging**: All production features + beta features
- **production**: Core features only, dev tools disabled

---

### 2. **Service Worker & Offline Support** ✅
Smart caching with offline fallback capabilities.

**Files:**
- `service-worker.js` - Core caching logic
- `js/bio-sw-manager.js` - Registration & lifecycle management
- `manifest.json` - PWA configuration

**Features:**
- **Precache**: Core assets load immediately on install
- **Network-First API**: Real-time data with offline fallback (5s timeout)
- **Cache-First Features**: Load feature modules from cache, update in background
- **Stale-While-Revalidate**: Keep pages responsive while syncing
- **Auto-Update Detection**: Notifies users when updates available

**Cache Strategy:**
| Content | Strategy | Cache | Lifetime |
|---------|----------|-------|----------|
| Core JS/CSS/HTML | Stale-While-Revalidate | Core | 30 days |
| Feature modules | Cache-First | Features | 30 days |
| API calls | Network-First | API | 5s timeout |
| Images | Cache-First | Images | 60 days |

**Console API:**
```javascript
// View status
swManager.getStatus()

// Force update check
swManager.checkForUpdates()

// Clear all caches
swManager.clearCache()

// Get cache size
swManager.getCacheSize()

// Activate pending update
swManager.skipWaiting()

// Unregister (troubleshooting)
swManager.unregister()
```

---

### 3. **Webpack Bundling** ✅
Minification, tree-shaking, and optimized entry points.

**Files:**
- `webpack.config.js` - Build configuration (core + features)
- `package.json` - NPM scripts and dependencies
- `.babelrc` - ES6 transpilation rules

**Build Scripts:**
```bash
npm install              # Install dependencies
npm run build            # Production build
npm run build:dev        # Development build
npm run build:staging    # Staging build with feature flags
npm run dev              # Development server with live reload
npm run serve            # Serve built dist/
npm run analyze          # Bundle size analysis
npm run lint             # Code linting
npm run format           # Format code with prettier
```

**Output Structure:**
```
dist/
├── core/                # Core bundles (always loaded)
│   ├── bio-utils.bundle.js
│   ├── bio-config.bundle.js
│   ├── bio-flags.bundle.js
│   └── ...
└── features/            # Feature bundles (lazy-loaded)
    ├── bio-sequence.chunk.js
    ├── bio-alphafold.chunk.js
    └── ...
```

**Performance Gains:**
- Minification: ~40% size reduction
- Tree-shaking: Removes unused code
- Code splitting: Parallel downloads
- Source maps: Debug in production

---

### 4. **Dynamic Imports** ✅
ES6 `import()` for lazy module loading with bundler support.

**Migration from script tags to imports:**

Before (Phase 1):
```javascript
// bio-loader.js (dynamic script injection)
const script = document.createElement('script');
script.src = `./js/bio-${feature}.js`;
document.head.appendChild(script);
```

After (Phase 2):
```javascript
// bio-loader.js (ES6 dynamic imports)
const module = await import(`./js/bio-${feature}.js`);
module.initFeature();
```

**Benefits:**
- Better bundler integration (tree-shaking, minification)
- Automatic dependency resolution
- Better error handling
- Works with sourcemaps

---

## Installation & Setup

### 1. Install Dependencies
```bash
cd bioweb3
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local with your settings
```

### 3. Configure Features
Edit `features.json` to enable/disable features per environment:
```json
{
  "development": {
    "alphafold": true,
    "healthcare50": true,
    "devTools": true
  },
  "staging": {
    "alphafold": true,
    "healthcare50": false,
    "devTools": false
  },
  "production": {
    "alphafold": true,
    "healthcare50": false,
    "devTools": false
  }
}
```

### 4. Build for Production
```bash
npm run build
```

### 5. Deploy
- Upload `dist/` to your web server
- Service Worker auto-registers on page load
- Feature flags load from `features.json`

---

## Architecture Overview

### Module Loading Flow
```
1. Page Load
   ↓
2. Load Feature Flags (bio-flags.js)
   ↓
3. Load Core Modules (always ~50KB)
   ├── bio-utils.js         (156 lines)
   ├── bio-config.js        (180 lines)
   ├── bio-state.js         (120 lines)
   ├── bio-wallet.js        (200 lines)
   ├── bio-profile.js       (150 lines)
   └── bio-chatbot.js       (100 lines)
   ↓
4. Register Service Worker
   ├── Precache core assets
   ├── Setup cache strategies
   └── Listen for updates
   ↓
5. User clicks tab → Lazy-load feature module (~30-300KB each)
   ├── Check feature flags
   ├── Download from cache or network
   └── Initialize feature
   ↓
6. Online/Offline Detection
   ├── Network: Prefer fresh data
   └── Offline: Serve from cache
```

---

## Performance Metrics

### Phase 1 (Module Splitting)
- **Initial JS Parse**: 69% faster (800ms → 250ms)
- **Memory Usage**: 55% reduction (~300KB vs 672KB)
- **Time to Interactive**: 40% faster

### Phase 2 (Expected Additions)
- **Bundle Size**: 40% reduction (minification + tree-shaking)
- **Offline Support**: ✅ Full offline access to cached features
- **Update Speed**: 20% faster with Service Worker precaching
- **Feature Deployment**: 0 downtime (feature flags)

---

## Developer Guide

### Adding a New Feature Module

1. **Create module file** (`js/bio-newfeature.js`):
```javascript
// Module initialization
async function initNewFeature() {
    console.log('Initializing new feature...');
    // Load data, setup UI, etc.
}

// Dynamic import support
export { initNewFeature };
```

2. **Add to webpack config** (`webpack.config.js`):
```javascript
const featureModules = {
    // ... existing modules
    'bio-newfeature': './js/bio-newfeature.js',
};
```

3. **Add feature flag** (`features.json`):
```json
{
  "development": { "newFeature": true },
  "production": { "newFeature": false }
}
```

4. **Update loader** (`js/bio-loader.js`):
```javascript
const featureModules = {
    // ... existing modules
    'NewFeature': 'bio-newfeature',
};
```

5. **Build and test**:
```bash
npm run build:dev
# Test locally, then deploy
```

---

## Troubleshooting

### Service Worker Not Registering
```javascript
// Check status in console
swManager.getStatus()

// Check browser DevTools → Application → Service Workers
// Look for errors in Console tab
```

### Cache Causing Stale Content
```javascript
// Clear all caches
swManager.clearCache()

// Or unregister and reinstall
swManager.unregister()
// Then reload page
```

### Feature Flag Not Taking Effect
```javascript
// Check current environment
console.log(featureFlags.getEnvironment())

// Switch environment (dev only)
featureFlags.setEnvironment('staging')

// View all flags
featureFlags.showDevTools()
```

### Build Errors
```bash
# Clear cache and node_modules
npm run clean
rm -rf node_modules
npm install

# Then rebuild
npm run build
```

---

## Next Steps

Future improvements:
1. **IndexedDB for offline data**: Store sequencing results, analysis history
2. **Background Sync**: Auto-sync blockchain transactions when online
3. **Web Workers**: Offload heavy computation (AlphaFold, DEG pipeline)
4. **Push Notifications**: Notify when long-running tasks complete
5. **Analytics**: Track feature usage and performance metrics

---

## Support

For issues or questions:
1. Check browser Console for errors
2. Run `swManager.getStatus()` and `featureFlags.showDevTools()`
3. Clear cache and rebuild: `npm run clean && npm install && npm run build`
4. File an issue with console output and `swManager.getStatus()` result
