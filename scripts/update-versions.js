#!/usr/bin/env node

/**
 * Version Management Script for PitchSignal
 * 
 * This script reads the version from version.json and updates all related files:
 * 1. HTML template (templates/index.html) - script and stylesheet versions
 * 2. Service Worker (static/sw.js) - CACHE_NAME
 * 3. Service Worker registration (static/js/app.js) - sw.js version
 * 
 * Usage:
 *   node scripts/update-versions.js
 *   node scripts/update-versions.js --bump  # Increment version by 1 day
 *   node scripts/update-versions.js --set 20260626  # Set specific version
 */

const fs = require('fs');
const path = require('path');

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'version.json');
const HTML_FILE = path.join(ROOT_DIR, 'templates', 'index.html');
const SW_FILE = path.join(ROOT_DIR, 'static', 'sw.js');
const APP_JS_FILE = path.join(ROOT_DIR, 'static', 'js', 'app.js');

// Read current version
function readVersion() {
    try {
        const data = fs.readFileSync(VERSION_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('❌ Error reading version.json:', err.message);
        process.exit(1);
    }
}

// Write version to file
function writeVersion(versionData) {
    try {
        fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n');
        console.log('✅ Updated version.json');
    } catch (err) {
        console.error('❌ Error writing version.json:', err.message);
        process.exit(1);
    }
}

// Update HTML file versions
function updateHtmlVersions(version) {
    try {
        let content = fs.readFileSync(HTML_FILE, 'utf8');
        
        // Pattern to match versioned resources
        const patterns = [
            // CSS files
            { pattern: /href="\/static\/css\/([^"]+)\?v=[^"]*"/g, replacement: `href="/static/css/$1?v=${version}"` },
            // JS files
            { pattern: /src="\/static\/js\/([^"]+)\?v=[^"]*"/g, replacement: `src="/static/js/$1?v=${version}"` },
            // Service Worker registration
            { pattern: /navigator\.serviceWorker\.register\('\/static\/sw\.js\?v=[^']*'\)/g, replacement: `navigator.serviceWorker.register('/static/sw.js?v=${version}')` },
        ];
        
        let updated = false;
        for (const { pattern, replacement } of patterns) {
            const newContent = content.replace(pattern, replacement);
            if (newContent !== content) {
                updated = true;
                content = newContent;
            }
        }
        
        if (updated) {
            fs.writeFileSync(HTML_FILE, content);
            console.log('✅ Updated templates/index.html');
        } else {
            console.log('ℹ️  No changes needed in templates/index.html');
        }
    } catch (err) {
        console.error('❌ Error updating HTML file:', err.message);
        process.exit(1);
    }
}

// Update Service Worker CACHE_NAME
function updateServiceWorkerVersion(version) {
    try {
        let content = fs.readFileSync(SW_FILE, 'utf8');
        
        // Update CACHE_NAME
        const newContent = content.replace(
            /const CACHE_NAME = '[^']*';/,
            `const CACHE_NAME = 'worldcup-v${version}';`
        );
        
        if (newContent !== content) {
            fs.writeFileSync(SW_FILE, newContent);
            console.log('✅ Updated static/sw.js CACHE_NAME');
        } else {
            console.log('ℹ️  No changes needed in static/sw.js');
        }
    } catch (err) {
        console.error('❌ Error updating Service Worker:', err.message);
        process.exit(1);
    }
}

// Update Service Worker registration in app.js
function updateAppJsSwVersion(version) {
    try {
        let content = fs.readFileSync(APP_JS_FILE, 'utf8');
        
        // Update Service Worker registration
        const newContent = content.replace(
            /navigator\.serviceWorker\.register\('\/static\/sw\.js\?v=[^']*'\)/,
            `navigator.serviceWorker.register('/static/sw.js?v=${version}')`
        );
        
        if (newContent !== content) {
            fs.writeFileSync(APP_JS_FILE, newContent);
            console.log('✅ Updated static/js/app.js Service Worker registration');
        } else {
            console.log('ℹ️  No changes needed in static/js/app.js');
        }
    } catch (err) {
        console.error('❌ Error updating app.js:', err.message);
        process.exit(1);
    }
}

// Increment version by 1 day
function bumpVersion(version) {
    const date = new Date(
        parseInt(version.slice(0, 4)),
        parseInt(version.slice(4, 6)) - 1,
        parseInt(version.slice(6, 8))
    );
    date.setDate(date.getDate() + 1);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
}

// Main function
function main() {
    const args = process.argv.slice(2);
    const versionData = readVersion();
    
    let newVersion = versionData.version;
    
    // Parse command line arguments
    if (args.includes('--bump')) {
        newVersion = bumpVersion(versionData.version);
        console.log(`📅 Bumping version from ${versionData.version} to ${newVersion}`);
    } else if (args.includes('--set')) {
        const setIndex = args.indexOf('--set');
        if (setIndex + 1 < args.length) {
            newVersion = args[setIndex + 1];
            console.log(`🔧 Setting version to ${newVersion}`);
        } else {
            console.error('❌ --set requires a version argument');
            process.exit(1);
        }
    } else {
        console.log(`ℹ️  Current version: ${versionData.version}`);
        console.log('   Use --bump to increment or --set <version> to set a specific version');
        process.exit(0);
    }
    
    // Update version data
    versionData.version = newVersion;
    versionData.updated = new Date().toISOString();
    
    // Write updated version
    writeVersion(versionData);
    
    // Update all files
    updateHtmlVersions(newVersion);
    updateServiceWorkerVersion(newVersion);
    updateAppJsSwVersion(newVersion);
    
    console.log(`\n🎉 Version updated to ${newVersion}`);
    console.log('   Run "git add -A && git commit -m \'chore: bump version to ' + newVersion + '\'" to commit changes');
}

// Run main function
main();