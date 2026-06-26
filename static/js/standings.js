// ========== standings.js - Standings Module ==========
(function() {
    async function loadStandings() {
        const { esc, tx, displayGroupName, displayMaybeTeamName, attr } = window.WorldCup.Utils;
    const t = window.t;
        const state = window.WorldCup.State;
        const el = document.getElementById('groups-container');
        el.innerHTML = `<div class="text-center py-10 text-gray-500">${state.uiLang === 'zh' ? '加载积分榜...' : 'Loading table...'}</div>`;
        const res = await window.WorldCup.ApiClient.get('/api/standings');
        if (!res.ok || !res.data?.groups) {
            el.innerHTML = `<div class="text-center py-10 text-red-400">${state.uiLang === 'zh' ? '积分榜加载失败' : 'Table failed to load'}</div>`;
            return;
        }
        const d = res.data;
        let html = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">` + d.groups.map(g => `
            <div class="glass rounded-xl overflow-hidden">
                <div class="px-3 py-1.5 bg-white/5 text-[11px] font-bold">${esc(displayGroupName(g.name))}</div>
                <table class="w-full table-fixed text-[11px]">
                    <colgroup>
                        <col style="width:20px">
                        <col>
                        <col style="width:26px">
                        <col style="width:26px">
                        <col style="width:26px">
                        <col style="width:26px">
                        <col style="width:30px">
                        <col style="width:32px">
                    </colgroup>
                    <thead><tr class="text-[10px] text-gray-500 border-b border-white/5">
                        <th class="text-left pl-2 py-1">#</th>
                        <th class="text-left py-1">${esc(t('team'))}</th>
                        <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('played'))}</th>
                        <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('wins'))}</th>
                        <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('draws'))}</th>
                        <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('losses'))}</th>
                        <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('goalDifference'))}</th>
                        <th class="text-right pr-2 py-1 font-bold tabular-nums">${esc(t('points'))}</th>
                    </tr></thead>
                    <tbody>${g.standings.map((t, i) => `
                        <tr class="border-b border-white/[0.03] hover:bg-white/[0.03] transition">
                            <td class="pl-2 py-1.5 text-gray-600">${i+1}</td>
                            <td class="py-1.5"><div class="flex items-center gap-1">
                                ${t.logo ? `<img src="${attr(t.logo)}" class="w-3.5 h-3.5 object-contain flex-shrink-0" onerror="this.style.display='none'">` : ''}
                                <span class="font-medium truncate cursor-pointer hover:text-blue-400 transition max-w-full" data-action="open-team-detail" data-team-id="${attr(t.id)}" data-team-name="${attr(t.name)}" data-group="${attr(g.name)}">${esc(displayMaybeTeamName(t))}</span>
                            </div></td>
                            <td class="text-right py-1.5 text-gray-500 tabular-nums pr-0.5">${t.played}</td>
                            <td class="text-right py-1.5 tabular-nums pr-0.5">${t.wins}</td>
                            <td class="text-right py-1.5 tabular-nums pr-0.5">${t.draws}</td>
                            <td class="text-right py-1.5 tabular-nums pr-0.5">${t.losses}</td>
                            <td class="text-right py-1.5 tabular-nums pr-0.5 ${+t.gd>0?'text-green-400':+t.gd<0?'text-red-400':''}">${t.gd}</td>
                            <td class="text-right pr-2 py-1.5 font-bold text-blue-400 tabular-nums">${t.pts}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `).join('') + `</div>`;

        // Append Knockout Stage placeholder
        html += `<div class="mt-4 glass rounded-2xl p-4">
            <div class="flex items-center gap-2 mb-3 text-orange-400 font-bold text-xs">
                <span>🏆</span>
                <span>${tx('后期淘汰赛', 'Knockout Stage')}</span>
            </div>
            <div id="bracket-container-standings" class="w-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide text-center flex justify-center min-h-[200px]">
                <div class="text-gray-500 py-10">${tx('加载对阵图...', 'Loading bracket...')}</div>
            </div>
        </div>`;

        el.innerHTML = html;
        
        // Load bracket from dynamic API (resolves group positions → team names)
        window.WorldCup.Utils.api('/api/bracket').then(data => {
            const container = document.getElementById('bracket-container-standings');
            if (container && data && !data.error) {
                container.innerHTML = '';
                window.renderBracket(data, container);
                setTimeout(() => {
                    const wrap = container.querySelector('#bk-wrap');
                    if (wrap) container.scrollLeft = (wrap.scrollWidth - container.clientWidth) / 2;
                }, 100);
            }
        }).catch(e => {
            const container = document.getElementById('bracket-container-standings');
            if (container) container.innerHTML = `<div class="text-gray-500 py-10">${tx('淘汰赛对阵图将在小组赛结束后生成', 'Knockout bracket will be generated after group stage.')}</div>`;
        });
    }

    // Expose to WorldCup namespace
    window.WorldCup.Standings = {
        loadStandings
    };

    // Also expose globally for backward compatibility
    window.loadStandings = loadStandings;
})();