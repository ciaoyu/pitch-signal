/**
 * players-tab.js — Players grid, search, and detail
 * Extracted from app.js lines 3163-3223
 */
(function () {
    'use strict';

    const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
    const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
    const { tx } = window.WorldCup.Utils;
    const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);

    let allPlayersCache = [];

    function loadAllPlayers() {
        if (allPlayersCache.length) { renderPlayers(allPlayersCache); return; }
        const grid = document.getElementById('players-grid');
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">加载球员数据...</div>';
        const teamIds = ['660','210','206','211','204','214','208','220','448','209','473','201','472','471','476','475','474','477','207','212','478','479','213','218'];
        Promise.all(teamIds.map(id => api(`/api/team/${id}/lineup`).catch(() => null)))
            .then(results => {
                const players = [];
                for (const r of results) {
                    if (!r || r.error) continue;
                    for (const p of (r.players || [])) {
                        players.push({ ...p, teamName: r.name, teamId: r.teamId });
                    }
                }
                allPlayersCache = players;
                renderPlayers(players);
            });
    }

    function renderPlayers(players) {
        const grid = document.getElementById('players-grid');
        grid.innerHTML = players.map(p => `
            <div class="card glass rounded-xl p-2.5 cursor-pointer" data-action="open-player-detail" data-player-id="${attr(p.id)}">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">${esc(p.jersey || '?')}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-bold truncate">${esc(p.name)}</div>
                        <div class="text-[11px] text-gray-500">${esc(p.teamName || '')} · ${esc(p.pos)}</div>
                    </div>
                </div>
                <div class="mt-1.5 flex items-center gap-1">
                    <span class="text-xs font-bold ${p.rating >= 80 ? 'text-green-400' : p.rating >= 70 ? 'text-yellow-400' : 'text-gray-400'}">${p.rating}</span>
                    <div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${p.rating >= 80 ? 'bg-green-500' : p.rating >= 70 ? 'bg-yellow-500' : 'bg-gray-600'}" style="width:${p.rating}%"></div>
                    </div>
                </div>
                <div class="mt-1 grid grid-cols-3 gap-0.5 text-[10px] text-gray-600">
                    <span>攻${p.dims?.attack||0}</span>
                    <span>防${p.dims?.defense||0}</span>
                    <span>体${p.dims?.physical||0}</span>
                </div>
            </div>
        `).join('') || '<div class="col-span-full text-center text-gray-500 py-10">无球员数据</div>';
    }

    function searchPlayers(q) {
        if (!q) { renderPlayers(allPlayersCache); return; }
        const lower = q.toLowerCase();
        const filtered = allPlayersCache.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            p.pos?.toLowerCase().includes(lower) ||
            p.teamName?.toLowerCase().includes(lower)
        );
        renderPlayers(filtered);
    }

    window.WorldCup.PlayersTab = { loadAllPlayers, renderPlayers, searchPlayers };
    Object.assign(window, { loadAllPlayers, renderPlayers, searchPlayers });
})();
