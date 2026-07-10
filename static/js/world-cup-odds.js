(function () {
  'use strict';
  const { tx, esc } = window.WorldCup.Utils;

  // PF-7: standalone "Title Odds" display backed by the live Polymarket
  // world-cup-winner market. Pure display — never touches prediction logic.
  function renderWorldCupOdds(resData) {
    const odds = Array.isArray(resData) ? resData : (Array.isArray(resData?.odds) ? resData.odds : []);
    const activeOdds = odds.filter(o => Number(o.probability) >= 1);

    if (!activeOdds || activeOdds.length === 0) {
      return `
        <div class="pred-section" style="padding:14px;height:100%;display:flex;flex-direction:column">
          <div class="pred-section-title text-yellow-400" style="font-family:'DM Sans',sans-serif">
            <span class="w-6 h-6 rounded-lg bg-yellow-500/20 flex items-center justify-center text-xs flex-shrink-0">🏆</span>${tx('夺冠赔率', 'Title Odds')}
            <span class="text-[10px] text-gray-500 font-normal ml-auto">Polymarket</span>
          </div>
          <div class="glass-light rounded-lg p-3 text-xs text-gray-400 my-auto">${tx('夺冠赔率数据暂无', 'No active title odds available')}</div>
        </div>`;
    }

    const rows = activeOdds.map((o, i) => {
      const prob = Number(o.probability) || 0;
      const barW = Math.max(2, Math.min(100, prob));
      return `
        <div class="glass-light rounded-lg p-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-[10px] text-gray-500 w-4 text-right shrink-0">${i + 1}</span>
            <span class="text-xs font-medium text-gray-100 truncate">${esc(o.team)}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="w-16 h-1.5 rounded bg-white/10 overflow-hidden">
              <div class="h-full rounded" style="width:${barW}%;background:#34d399"></div>
            </div>
            <span class="text-xs font-bold text-green-400 w-11 text-right font-mono">${prob.toFixed(1)}%</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="pred-section" style="padding:14px;height:100%;display:flex;flex-direction:column">
        <div class="pred-section-title text-yellow-400" style="font-family:'DM Sans',sans-serif">
          <span class="w-6 h-6 rounded-lg bg-yellow-500/20 flex items-center justify-center text-xs flex-shrink-0">🏆</span>${tx('夺冠赔率', 'Title Odds')}
          <span class="text-[10px] text-gray-500 font-normal ml-auto">Polymarket</span>
        </div>
        <div class="space-y-1.5 flex-1">${rows}</div>
        <div class="text-[10px] text-gray-600 mt-2.5">${tx('数据来源 Polymarket 实时市场，仅展示当前存续球队', 'Source: Polymarket live markets (remaining teams only)')}</div>
      </div>`;
  }

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
        el.innerHTML = renderWorldCupOdds(res.data);
      })
      .catch(() => {
        el.innerHTML = `<div class="text-center py-10 text-gray-500">${tx('夺冠赔率加载失败', 'Failed to load title odds')}</div>`;
      });
  }

  window.renderWorldCupOdds = renderWorldCupOdds;
  window.loadWorldCupOdds = loadWorldCupOdds;
})();
