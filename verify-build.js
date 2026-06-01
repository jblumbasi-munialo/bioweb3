#!/usr/bin/env node

/**
 * Build Verification Script
 * Validates webpack output, cache sizes, and deployment readiness
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

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function checkFile(filePath, label) {
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        log(colors.green, `✓ ${label}: ${formatBytes(stats.size)}`);
        return { exists: true, size: stats.size };
    } else {
        log(colors.red, `✗ ${label}: FILE NOT FOUND`);
        return { exists: false, size: 0 };
    }
}

function main() {
    log(colors.blue, '\n=== BioWeb3 Phase 2 Build Verification ===\n');

    const dist = path.join(__dirname, 'dist');
    const core = path.join(dist, 'core');
    const features = path.join(dist, 'features');

    // Check output directories
    log(colors.cyan, 'Checking Build Output...');
    if (!fs.existsSync(dist)) {
        log(colors.red, '✗ Build directory not found. Run: npm run build');
        process.exit(1);
    }

    // Check core bundles
    log(colors.cyan, '\nCore Bundles:');
    let coreSize = 0;
    const coreFiles = ['bio-utils', 'bio-config', 'bio-state', 'bio-flags', 'bio-loader'];
    coreFiles.forEach((file) => {
        const result = checkFile(
            path.join(core, `${file}.bundle.js`),
            `  ${file}.bundle.js`
        );
        coreSize += result.size;
    });

    // Check feature bundles
    log(colors.cyan, '\nFeature Bundles:');
    let featureSize = 0;
    const featureFiles = [
        'bio-sequence',
        'bio-alphafold',
        'bio-docking',
        'bio-pricing',
        'bio-bioimaging',
        'bio-crispr',
        'bio-drugs',
        'bio-goenrichment',
        'bio-genome',
        'bio-regnet',
        'bio-survival',
        'bio-degpipeline',
        'bio-healthcare50',
        'bio-researchagg',
    ];
    featureFiles.forEach((file) => {
        const result = checkFile(
            path.join(features, `${file}.chunk.js`),
            `  ${file}.chunk.js`
        );
        featureSize += result.size;
    });

    // Check source maps
    log(colors.cyan, '\nSource Maps:');
    checkFile(path.join(core, 'bio-utils.bundle.js.map'), '  Core sourcemap');
    checkFile(path.join(features, 'bio-alphafold.chunk.js.map'), '  Features sourcemap');

    // Summary
    log(colors.blue, '\n=== Size Summary ===');
    log(colors.green, `Core Bundles: ${formatBytes(coreSize)}`);
    log(colors.green, `Feature Bundles: ${formatBytes(featureSize)}`);
    log(colors.green, `Total: ${formatBytes(coreSize + featureSize)}`);

    // Performance targets
    log(colors.cyan, '\nPerformance Targets:');
    const coreTarget = 150 * 1024; // 150KB
    const featureTarget = 3 * 1024 * 1024; // 3MB
    const totalTarget = 3.5 * 1024 * 1024; // 3.5MB

    if (coreSize <= coreTarget) {
        log(colors.green, `✓ Core size within target (${formatBytes(coreTarget)})`);
    } else {
        log(colors.yellow, `⚠ Core size exceeds target by ${formatBytes(coreSize - coreTarget)}`);
    }

    if (featureSize <= featureTarget) {
        log(colors.green, `✓ Feature size within target (${formatBytes(featureTarget)})`);
    } else {
        log(colors.yellow, `⚠ Feature size exceeds target by ${formatBytes(featureSize - featureTarget)}`);
    }

    // Check config files
    log(colors.cyan, '\nConfiguration Files:');
    checkFile(path.join(__dirname, 'features.json'), '  features.json');
    checkFile(path.join(__dirname, 'manifest.json'), '  manifest.json');
    checkFile(path.join(__dirname, 'package.json'), '  package.json');
    checkFile(path.join(__dirname, '.env.example'), '  .env.example');

    // Check source files
    log(colors.cyan, '\nSource Files:');
    checkFile(path.join(__dirname, 'js', 'bio-flags.js'), '  bio-flags.js');
    checkFile(path.join(__dirname, 'js', 'bio-sw-manager.js'), '  bio-sw-manager.js');
    checkFile(path.join(__dirname, 'service-worker.js'), '  service-worker.js');
    checkFile(path.join(__dirname, 'webpack.config.js'), '  webpack.config.js');
    checkFile(path.join(__dirname, '.babelrc'), '  .babelrc');

    log(colors.green, '\n✓ Build verification complete!\n');
}

main();
