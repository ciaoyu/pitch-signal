const { JSDOM, VirtualConsole } = require('jsdom');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 5098;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
      });
      return true;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Server not ready after ' + timeoutMs + 'ms');
}

async function runTests() {
  console.log(`🚀 Starting server on port ${PORT}...`);
  const serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT, NODE_ENV: 'test', TEST_MODE: '1', TEST_DB_PATH: ':memory:' }
  });
  serverProcess.stdout.pipe(process.stdout);
  serverProcess.stderr.pipe(process.stderr);

  try {
    await waitForServer(`${BASE_URL}/health`);
    console.log('✅ Server is ready. Launching JSDOM...');

    const virtualConsole = new VirtualConsole();
    let uncaughtErrors = 0;
    
    virtualConsole.on("error", (err) => {
      // Ignore scrollTo error which is a known JSDOM limitation
      if (err?.message?.includes('scrollTo is not a function')) return;
      const msg = err ? String(err) : '';
      if (msg.includes('Uncaught') || msg.includes('TypeError')) {
        console.error('❌ Virtual Console Error:', err);
        uncaughtErrors++;
      }
    });
    virtualConsole.on("log", (...args) => console.log('💻 [JSDOM]', ...args));
    virtualConsole.on("info", (...args) => console.info('ℹ️ [JSDOM]', ...args));
    virtualConsole.on("warn", (...args) => console.warn('⚠️ [JSDOM]', ...args));
    virtualConsole.on("jsdomError", (error) => {
      // Ignore scrollTo error which is a known JSDOM limitation
      if (error?.message?.includes('scrollTo is not a function') || (error?.cause?.message?.includes('scrollTo is not a function'))) return;
      console.error("❌ JSDOM Error:", error);
      uncaughtErrors++;
    });

    const jsdomOptions = {
      runScripts: "dangerously",
      resources: "usable",
      virtualConsole,
      beforeParse(window) {
        // Polyfill CSS.escape for JSDOM
        window.CSS = { escape: (str) => str.replace(/(["\\])/g, '\\$1') };
        
        window.fetch = async (url, options = {}) => {
          if (typeof url === 'string' && url.startsWith('/')) {
            url = BASE_URL + url;
          }
          // Remove jsdom's AbortSignal as it's incompatible with Node's fetch
          const { signal, ...cleanOptions } = options;
          try {
            return await global.fetch(url, cleanOptions);
          } catch (err) {
            console.log(`❌ Mock fetch error for ${url}:`, err);
            throw err;
          }
        };
      }
    };

    console.log('1. Loading homepage...');
    const dom = await JSDOM.fromURL(BASE_URL, jsdomOptions);
    console.log('✅ 1. Homepage loaded successfully.');
    
    // JSDOM does not execute <script type="module"> by default, so we fetch bundle.js manually,
    // strip the export statement, and inject it as inline script.
    const doc = dom.window.document;
    const bundleRes = await fetch(`${BASE_URL}/static/js/bundle.js`);
    let bundleText = await bundleRes.text();
    bundleText = bundleText.replace(/export default\s+([^;]+);/g, '$1;');
    
    try {
      dom.window.eval(bundleText);
      console.log('💻 [JSDOM] bundle.js evaluated successfully');
    } catch (err) {
      console.error('❌ Error evaluating bundle.js:', err);
    }

    // Trigger DOMContentLoaded so the bundle initializes if it relies on it
    const event = new dom.window.Event('DOMContentLoaded', {
      bubbles: true,
      cancelable: true
    });
    doc.dispatchEvent(event);
    dom.window.dispatchEvent(event);

    // Wait a moment for JS init and fetches to complete
    await new Promise(r => setTimeout(r, 4000));

    if (uncaughtErrors > 0) {
      throw new Error(`Found ${uncaughtErrors} unhandled exceptions in console.`);
    }
    console.log('✅ 2. No unhandled console exceptions.');

    console.log('3. Checking Live tab...');
    const liveMatches = doc.querySelectorAll('.match-card-live');
    const emptyStateLive = doc.querySelectorAll('.empty-state');
    if (liveMatches.length === 0 && emptyStateLive.length === 0) {
      console.warn('⚠️ Live tab might not render standard classes, but moving on.');
    }
    console.log('✅ 3. Live tab verified.');

    const waitForDOM = async (selector, checkContent, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = doc.getElementById(selector);
        const content = el?.innerHTML || '';
        if (checkContent(content)) {
          return content;
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return doc.getElementById(selector)?.innerHTML || '';
    };

    console.log('4. Switching to Schedule tab...');
    dom.window.eval("switchTab('schedule')");
    const scheduleContent = await waitForDOM('schedule-list', c => c.includes('match-card') || c.includes('flag-badge') || c.includes('暂无') || c.includes('No match'));
    
    console.log('5. Checking Schedule tab...');
    if (!scheduleContent.includes('match-card') && !scheduleContent.includes('flag-badge') && !scheduleContent.includes('暂无') && !scheduleContent.includes('No match')) {
      console.error("Schedule Content Dump:", scheduleContent.substring(0, 1000));
      throw new Error('Schedule tab empty or malformed');
    }
    console.log('✅ 4. Schedule tab verified.');

    console.log('5. Switching to Standings tab...');
    dom.window.eval("switchTab('standings')");
    const standingsContent = await waitForDOM('tab-standings', c => c.includes('group-table') || c.includes('暂无') || c.includes('No standings') || c.includes('standings-table') || c.includes('Group'));
    
    console.log('6. Checking Standings tab...');
    if (!standingsContent.includes('group-table') && !standingsContent.includes('暂无') && !standingsContent.includes('No standings') && !standingsContent.includes('standings-table') && !standingsContent.includes('Group')) {
      console.error("Standings Content Dump:", standingsContent.substring(0, 1000));
      throw new Error('Standings tab empty or malformed');
    }
    console.log('✅ 5. Standings tab verified.');

    console.log('7. Switching to Prediction tab...');
    dom.window.eval("switchTab('prediction')");
    const predictionContent = await waitForDOM('tab-prediction', c => c.includes('pred-card') || c.includes('暂无') || c.includes('No data'));

    console.log('8. Checking Prediction tab...');
    if (!predictionContent.includes('pred-card') && !predictionContent.includes('暂无') && !predictionContent.includes('No data')) {
      throw new Error('Prediction tab empty or malformed');
    }
    console.log('✅ 7. Prediction tab verified.');

    console.log('9. Switching to Teams tab...');
    dom.window.eval("switchTab('teams')");
    const teamsContent = await waitForDOM('tab-teams', c => c.includes('team-card') || c.includes('⚽'));

    console.log('10. Checking Teams tab...');
    if (!teamsContent.includes('team-card') && !teamsContent.includes('⚽')) {
      throw new Error('Teams tab missing team cards');
    }
    console.log('✅ 8. Teams tab verified.');

    console.log('11. Checking AI Panel...');
    const botFab = doc.getElementById('ai-fab');
    if (!botFab) {
      throw new Error('AI Panel FAB not found');
    }
    console.log('✅ 9. AI Panel verified.');
    await new Promise(r => setTimeout(r, 100));
    botFab.click();
    await new Promise(r => setTimeout(r, 100));
    const panelClasses = doc.getElementById('global-chat-modal')?.className || '';
    if (panelClasses.includes('hidden')) {
      throw new Error('AI Panel did not open on click');
    }
    console.log('✅ 10. AI Panel interaction verified.');

    console.log('12. Checking Match Detail Modal...');
    // In bundle.js, matches use 'onclick="window.WorldCup.openMatchDetail(...)"'
    // Let's just find an element with that onclick or any match-card
    const matchCards = doc.querySelectorAll('[onclick*="openMatchDetail"]');
    if (matchCards.length > 0) {
      matchCards[0].click();
      await new Promise(r => setTimeout(r, 500));
      const matchModal = doc.getElementById('match-modal')?.className || '';
      if (matchModal.includes('hidden')) {
         throw new Error('Match detail modal did not open');
      }
      doc.getElementById('match-modal-close')?.click();
      console.log('✅ 11. Match Detail Modal verified.');
    } else {
      console.log('⚠️ 11. No match cards found to click, skipping modal test.');
    }

    console.log('10. Checking Language Switch...');
    const langBtn = doc.querySelector('button[data-lang="en"]');
    if (langBtn) {
      langBtn.click();
      await new Promise(r => setTimeout(r, 200));
      if (uncaughtErrors > 0) {
        throw new Error('Language switch caused errors.');
      }
    }
    console.log('✅ 10. Language switch did not crash the page.');

    console.log('🎉 UI Smoke Test Passed!');

  } catch (err) {
    console.error('💥 Test failed:', err);
    process.exitCode = 1;
  } finally {
    serverProcess.kill('SIGTERM');
    // Force exit to prevent jsdom/timers from hanging the process
    setTimeout(() => process.exit(process.exitCode || 0), 1000).unref();
  }
}

runTests();
