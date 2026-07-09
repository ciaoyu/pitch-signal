(function () {
  'use strict';
  const { tx, esc } = window.WorldCup.Utils;

  // PF-7: standalone "Title Odds" card backed by the live Polymarket
  // world-cup-winner market. Pure display — never touches prediction logic.
  function loadWorldCupOdds() {
    const el = document.getElementById('tab-markets');
    if (!el) return;

    el.innerHTML = `<div class="text-center py-10 text-gray-500">${tx('加载夺冠赔率...', 'Loading title odds...')}</div>`;

    window.WorldCup.ApiClient.get('/api/world-cup-winner')
      .then((res) => {
        const odds = res?.ok ? res.data?.odds : null;
        if (!Array.isArray(odds) || odds.length === 0) {
          el.innerHTML = `<div class="text-center py-10 text-gray-500">${tx('夺冠赔率数据暂无', 'No title odds available')}</div>`;
          return;
        }

        const rows = odds.map((o, i) => {
          const eliminated = o.probability < 1;
          const barW = Math.max(2, o.probability);
          return `
            <div class="glass-light rounded-lg p-2 flex items-center justify-between" style="opacity:${eliminated ? '0.55' : '1'}">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-[11px] text-gray-500 w-5 text-right shrink-0">${i + 1}</span>
                <span class="text-sm font-medium text-gray-100 truncate">${esc(o.team)}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="w-24 h-1.5 rounded bg-white/10 overflow-hidden">
                  <div class="h-full" style="width:${barW}%;background:#34d399"></div>
                </div>
                <span class="text-sm font-bold text-green-400 w-12 text-right">${o.probability.toFixed(1)}%</span>
              </div>
            </div>`;
        }).join('');

        el.innerHTML = `
          <div class="glass rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-bold text-yellow-400">🏆 ${tx('夺冠赔率', 'Title Odds')}</h3>
              <span class="text-[11px] text-gray-600">Polymarket</span>
            </div>
            <div class="space-y-1.5">${rows}</div>
            <div class="text-[10px] text-gray-600 mt-3">${tx('数据来源 Polymarket 真实市场，仅供参考', 'Source: Polymarket live markets. Informational only.')}</div>
          </div>`;
      })
      .catch(() => {
        el.innerHTML = `<div class="text-center py-10 text-gray-500">${tx('夺冠赔率加载失败', 'Failed to load title odds')}</div>`;
      });
  }

  window.loadWorldCupOdds = loadWorldCupOdds;
})();
