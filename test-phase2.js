#!/usr/bin/env node

/**
 * Phase 2 Verification Test
 * Validates build readiness
 */

const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

function checkFile(filePath, label) {
    const exists = fs.existsSync(filePath);
    if (exists) {
        const stats = fs.statSync(filePath);
        log(colors.green, `✓ ${label} (${stats.size} bytes)`);
    } else {
        log(colors.red, `✗ ${label}: NOT FOUND`);
    }
    return exists;
}

function validateJSON(filePath, label) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        JSON.parse(content);
        log(colors.green, `✓ ${label} is valid JSON`);
        return true;
    } catch (err) {
        log(colors.red, `✗ ${label} JSON error: ${err.message}`);
        return false;
    }
}

function validateJavaScript(filePath, label) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Try to parse as a module (basic syntax check)
        new Function(content);
        log(colors.green, `✓ ${label} syntax OK`);
        return true;
    } catch (err) {
        log(colors.red, `✗ ${label} syntax error: ${err.message}`);
        return false;
    }
}

function main() {
    log(colors.blue, '\n=== BioWeb3 Phase 2 Verification ===\n');
    
    let allPass = true;
    
    // 1. Check core files exist
    log(colors.cyan, '1. Checking Core Files...');
    allPass &= checkFile(path.join(__dirname, 'webpack.config.js'), '  webpack.config.js');
    allPass &= checkFile(path.join(__dirname, 'package.json'), '  package.json');
    allPass &= checkFile(path.join(__dirname, 'features.json'), '  features.json');
    allPass &= checkFile(path.join(__dirname, 'manifest.json'), '  manifest.json');
    allPass &= checkFile(path.join(__dirname, 'index.html'), '  index.html');
    allPass &= checkFile(path.join(__dirname, 'service-worker.js'), '  service-worker.js');
    
    // 2. Validate JSON files
    log(colors.cyan, '\n2. Validating JSON Files...');
    allPass &= validateJSON(path.join(__dirname, 'package.json'), '  package.json');
    allPass &= validateJSON(path.join(__dirname, 'features.json'), '  features.json');
    allPass &= validateJSON(path.join(__dirname, 'manifest.json'), '  manifest.json');
    
    // 3. Validate JavaScript files
    log(colors.cyan, '\n3. Validating JavaScript Files...');
    allPass &= validateJavaScript(path.join(__dirname, 'webpack.config.js'), '  webpack.config.js');
    allPass &= validateJavaScript(path.join(__dirname, 'service-worker.js'), '  service-worker.js');
    
    // 4. Check all module files exist
    log(colors.cyan, '\n4. Checking Module Files...');
    const modules = [
        'bio-utils', 'bio-config', 'bio-state', 'bio-flags', 'bio-loader',
        'bio-sequence', 'bio-alphafold', 'bio-docking', 'bio-pricing',
        'bio-bioimaging', 'bio-crispr', 'bio-drugs', 'bio-goenrichment',
        'bio-genome', 'bio-regnet', 'bio-survival', 'bio-degpipeline',
        'bio-healthcare50', 'bio-researchagg', 'bio-wallet', 'bio-profile',
        'bio-chatbot'
    ];
    
    const jsDir = path.join(__dirname, 'js');
    modules.forEach(module => {
        const filePath = path.join(jsDir, `${module}.js`);
        const exists = fs.existsSync(filePath);
        if (exists) {
            log(colors.green, `✓ ${module}.js`);
        } else {
            log(colors.red, `✗ ${module}.js: NOT FOUND`);
            allPass = false;
        }
    });
    
    // 5. Check index.html imports
    log(colors.cyan, '\n5. Checking index.html Imports...');
    try {
        const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        const checks = [
            { pattern: 'manifest.json', name: 'manifest.json link' },
            { pattern: 'bootstrap', name: 'Bootstrap' },
            { pattern: 'font-awesome', name: 'Font Awesome' },
            { pattern: 'plotly', name: 'Plotly.js' },
            { pattern: 'web3', name: 'Web3.js' },
            { pattern: 'style.css', name: 'style.css' }
        ];
        
        checks.forEach(check => {
            if (htmlContent.includes(check.pattern)) {
                log(colors.green, `✓ ${check.name} imported`);
            } else {
                log(colors.yellow, `⚠ ${check.name} not found`);
            }
        });
    } catch (err) {
        log(colors.red, `✗ Error reading index.html: ${err.message}`);
        allPass = false;
    }
    
    // Summary
    log(colors.blue, '\n=== Summary ===');
    if (allPass) {
        log(colors.green, '\n✓ All critical checks passed!\n');
        log(colors.green, 'Phase 2 build is ready for npm build.\n');
        process.exit(0);
    } else {
        log(colors.red, '\n✗ Some checks failed. See above for details.\n');
        process.exit(1);
    }
}

main();
