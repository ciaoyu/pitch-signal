#!/usr/bin/env node

/**
 * build-js.js — esbuild-powered bundle
 *
 * Output: static/js/bundle.js
 * Uses esbuild to properly handle IIFE scoping, TDZ, and cross-module references.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const STATIC_JS_DIR = path.join(__dirname, '..', 'static', 'js');
const OUTPUT_BUNDLE = path.join(STATIC_JS_DIR, 'bundle.js');
const INDEX_HTML_PATH = path.join(__dirname, '..', 'templates', 'index.html');

// All modules to bundle (order doesn't matter for esbuild — it resolves deps)
const MODULES = [
    'state.js',
    'i18n.js',
    'utils.js',
    'api-client.js',
    'formatters.js',
    'match-stats.js',
    'scores.js',
    'schedule.js',
    'standings.js',
    'match-detail.js',
    'team-detail.js',
    'world-cup-odds.js',
    'elo-prediction.js',
    'players-tab.js',
    'spatial-matchup.js',
    'ai-chat.js',
    'coach-comparison.js',
    'match-review.js',
    'player-detail.js',
    'pre-match.js',
    'odds-card.js',
    'ui-helpers.js',
    'match-renderers.js',
    'push-notifications.js',
    'app.js',
];

function md5(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

async function main() {
    console.log('🔧 Building JS Bundle with esbuild...\n');

    // Create a virtual entry point that imports all modules in order
    const entryContent = MODULES
        .map(m => `import './${m}';`)
        .join('\n');
    const entryPath = path.join(STATIC_JS_DIR, '_entry.js');
    fs.writeFileSync(entryPath, entryContent, 'utf8');

    try {
        await esbuild.build({
            entryPoints: [entryPath],
            bundle: true,
            outfile: OUTPUT_BUNDLE,
            format: 'esm',
            target: ['es2020'],
            minify: false,
            sourcemap: false,
            define: {
                'process.env.NODE_ENV': '"production"',
            },
            treeShaking: false,
        });

        const bundleContent = fs.readFileSync(OUTPUT_BUNDLE, 'utf8');
        const bundleHash = md5(bundleContent);

        console.log(`✅ Bundle: ${(bundleContent.length / 1024).toFixed(1)} KB`);
        console.log(`   Hash: ${bundleHash}`);

        const version = `v=${bundleHash}`;
        updateIndexHtml(version);

        console.log('\n🎉 Done!');
    } finally {
        // Clean up virtual entry
        try { fs.unlinkSync(entryPath); } catch {}
    }
}

function updateIndexHtml(version) {
    let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    // Remove old bundle script tag (handles both plain and type="module" variants)
    html = html.replace(/<script(?:[^>]*?)src="\/static\/js\/bundle\.js[^"]*"(?:[^>]*)><\/script>\n?/g, '');

    // Remove old individual module script tags
    for (const m of MODULES) {
        const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(`<script src="/static/js/${escaped}\\?v=[^"]*"><\\/script>\\n?`, 'g'), '');
    }

    // Clean up excess blank lines
    html = html.replace(/\n{3,}/g, '\n\n');

    // Insert bundle before </body> (type=module for ESM format)
    html = html.replace(/<\/body>/, `<script type="module" src="/static/js/bundle.js?${version}"></script>\n</body>`);

    fs.writeFileSync(INDEX_HTML_PATH, html, 'utf8');
    console.log(`✅ Updated index.html (${version})`);
}

main().catch(err => {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
});
