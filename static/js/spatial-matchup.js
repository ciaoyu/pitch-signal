/**
 * spatial-matchup.js — Spatial matchup tab, formations, pitch renderer
 */
(function () {
    'use strict';
    const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
    const { tx } = window.WorldCup.Utils;
    const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
    const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
    const translatePlayerName = (...a) => (window.WorldCup.I18n?.translatePlayerName || ((x) => x))(...a);

    let allTeamOptions = [];

    function loadSpatialTab() {
        const homeSelect = document.getElementById('spatial-home');
        const awaySelect = document.getElementById('spatial-away');
        if (allTeamOptions.length) return;
        const teams = [
            {id:'660',name:'USA'},{id:'210',name:'Paraguay'},{id:'206',name:'Canada'},{id:'211',name:'Bosnia-Herzegovina'},
            {id:'204',name:'Mexico'},{id:'214',name:'South Africa'},{id:'208',name:'South Korea'},{id:'220',name:'Czech Republic'},
            {id:'448',name:'Germany'},{id:'209',name:'Japan'},{id:'473',name:'Spain'},{id:'201',name:'Brazil'},
            {id:'472',name:'France'},{id:'471',name:'England'},{id:'476',name:'Argentina'},{id:'475',name:'Portugal'},
            {id:'474',name:'Netherlands'},{id:'477',name:'Belgium'},{id:'207',name:'Croatia'},{id:'212',name:'Morocco'},
            {id:'478',name:'Switzerland'},{id:'479',name:'Uruguay'},{id:'213',name:'Colombia'},{id:'218',name:'Ecuador'},
        ];
        allTeamOptions = teams;
        homeSelect.innerHTML = '<option value="">选择主队...</option>' + teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        awaySelect.innerHTML = '<option value="">选择客队...</option>' + teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        document.getElementById('spatial-home').value = '660';
        document.getElementById('spatial-away').value = '210';
        loadSelectedSpatial();
    }

    async function loadSelectedSpatial() {
        const home = document.getElementById('spatial-home').value;
        const away = document.getElementById('spatial-away').value;
        if (!home || !away) { document.getElementById('spatial-result').innerHTML = '<div class="text-gray-500 text-center py-10 text-xs">请选择两支球队</div>'; return; }
        const el = document.getElementById('spatial-result');
        el.innerHTML = '<div class="text-center py-10 text-gray-500">加载中...</div>';
        el.innerHTML = renderSpatialMatchupPanel(await loadSpatialMatchup(home, away));
    }

    async function loadSpatialMatchup(homeId, awayId) {
        const d = await api(`/api/matchup-spatial/${homeId}/${awayId}`);
        return (d && !d.error) ? d : null;
    }

    function renderSpatialPitch(data) {
        if (!data) return '<div class="text-gray-500 text-center py-10">对位数据加载失败</div>';
        const W = 680, H = 1050;
        let svg = `<svg viewBox="0 0 ${W} ${H}" class="w-full rounded-xl overflow-hidden" style="max-height:500px;"><rect width="${W}" height="${H}" fill="#1a472a" rx="8"/>`;
        // Horizontal grass stripes (zebra pattern, opacity 0.03)
        const sH = (H - 40) / 20;
        for (let i = 0; i < 20; i += 2) svg += `<rect x="20" y="${20 + i * sH}" width="${W-40}" height="${sH}" fill="rgba(255,255,255,0.03)"/>`;
        svg += `<rect x="20" y="20" width="${W-40}" height="${H-40}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>`;
        svg += `<line x1="20" y1="${H/2}" x2="${W-20}" y2="${H/2}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>`;
        svg += `<circle cx="${W/2}" cy="${H/2}" r="80" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><circle cx="${W/2}" cy="${H/2}" r="4" fill="rgba(255,255,255,0.3)"/>`;
        svg += `<rect x="${W/2-150}" y="20" width="300" height="150" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><rect x="${W/2-90}" y="20" width="180" height="60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
        svg += `<rect x="${W/2-150}" y="${H-170}" width="300" height="150" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><rect x="${W/2-90}" y="${H-80}" width="180" height="60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
        // Penalty arcs (semi-circles at penalty area edges)
        svg += `<path d="M ${W/2-60} 170 A 60 60 0 0 0 ${W/2+60} 170" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>`;
        svg += `<path d="M ${W/2-60} ${H-170} A 60 60 0 0 1 ${W/2+60} ${H-170}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>`;
        // Corner arcs (4 corners, radius 15)
        svg += `<path d="M 35 20 A 15 15 0 0 1 20 35" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<path d="M ${W-35} 20 A 15 15 0 0 0 ${W-20} 35" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<path d="M ${W-20} ${H-35} A 15 15 0 0 0 ${W-35} ${H-20}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<path d="M 20 ${H-35} A 15 15 0 0 1 35 ${H-20}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<defs><filter id="ability-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
        const renderBubbles = (players, color, className) => {
            for (const p of (players || [])) {
                const px = p.x * 6.8, py = (100 - p.y) * 10.5;
                const rating = Math.max(50, Math.min(100, Number(p.rating) || 65));
                const radius = 12 + (rating - 50) * 0.48;
                svg += `<circle class="${className}" cx="${px}" cy="${py}" r="${radius * 1.3}" fill="${color}" opacity="0.2" filter="url(#ability-blur)"/>`;
                svg += `<circle class="${className}" cx="${px}" cy="${py}" r="${radius}" fill="${color}" opacity="0.48" filter="url(#ability-blur)"/>`;
            }
        };
        renderBubbles(data.home?.players, 'rgb(59,130,246)', 'pitch-home');
        renderBubbles(data.away?.players, 'rgb(239,68,68)', 'pitch-away');
        return svg + '</svg>';
    }

    function renderSpatialMatchupPanel(data) {
        if (!data) return '';
        const s = data.summary || {}, pairs = data.pairs || [];
        const homeAvg = data.home?.players?.length ? data.home.players.reduce((sum, p) => sum + (p.rating || 70), 0) / data.home.players.length : 70;
        const awayAvg = data.away?.players?.length ? data.away.players.reduce((sum, p) => sum + (p.rating || 70), 0) / data.away.players.length : 70;
        const total = homeAvg + awayAvg;
        const homePct = total > 0 ? (homeAvg / total * 100).toFixed(1) : 50;
        const awayPct = total > 0 ? (awayAvg / total * 100).toFixed(1) : 50;
        const avgGap = s.avgGap || 0;
        let difficulty = '低', difficultyColor = 'text-green-400';
        if (avgGap >= 8) { difficulty = '高'; difficultyColor = 'text-red-400'; } else if (avgGap >= 5) { difficulty = '中等'; difficultyColor = 'text-yellow-400'; }
        return `<div class="spatial-matchup-panel glass rounded-xl p-3 mb-3"><div class="mb-3"><div class="flex items-center justify-between mb-1"><div class="flex items-center gap-2"><span class="text-lg">${data.home?.flag||'🏳️'}</span><div><div class="text-sm font-bold text-white">${displayMaybeTeamName(data.home||tx('主队','Home'))}</div><div class="text-[11px] text-gray-500">${tx('推测阵型','Estimated formation')} ${data.home?.formation||'?'}</div></div></div><div class="text-center"><div class="text-[11px] text-gray-500 mb-0.5">${tx('综合评分','Composite')}</div><div class="text-lg font-black ${homePct>awayPct?'text-red-400':'text-blue-400'}">${homePct} <span class="text-gray-600">vs</span> ${awayPct}</div><div class="text-[11px] font-bold ${difficultyColor}">${difficulty}</div></div><div class="flex items-center gap-2"><div class="text-right"><div class="text-sm font-bold text-white">${displayMaybeTeamName(data.away||tx('客队','Away'))}</div><div class="text-[11px] text-gray-500">${tx('推测阵型','Estimated formation')} ${data.away?.formation||'?'}</div></div><span class="text-lg">${data.away?.flag||'🏳️'}</span></div></div><div class="flex h-2.5 rounded-full overflow-hidden bg-white/5 mb-2"><div class="bg-red-500 transition-all duration-500" style="width:${homePct}%"></div><div class="bg-blue-500 transition-all duration-500" style="width:${awayPct}%"></div></div><div class="flex justify-between text-[11px]"><span class="text-red-400 font-bold">${tx('主优','Home edges')} ${s.homeAdvantages||0}</span><span class="text-gray-400">${tx('均势','Even')} ${s.even||0}</span><span class="text-blue-400 font-bold">${tx('客优','Away edges')} ${s.awayAdvantages||0}</span><span class="text-gray-500">${tx('平均差','Avg gap')} ${avgGap}</span></div></div><div class="flex items-center justify-between mb-2"><h4 class="text-xs font-bold text-blue-400">⚔️ ${tx('空间对位','Spatial Matchups')}</h4><div class="flex gap-1"><button data-action="set-pitch-view" data-view="both" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">${tx('全部','All')}</button><button data-action="set-pitch-view" data-view="home" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('主队','Home')}</button><button data-action="set-pitch-view" data-view="away" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('客队','Away')}</button></div></div>${renderSpatialPitch(data)}<p class="mt-2 text-[10px] text-gray-500">${tx('阵型与球员位置基于常用阵型及位置评分的估计，不是官方首发。','Formation and player positions are estimates from usual shape and position ratings, not an official lineup.')}</p><div class="mt-2 flex flex-wrap gap-1">${pairs.filter(p=>p.key).map(p=>`<span class="pitch-pair text-[11px] px-1.5 py-0.5 rounded ${p.advantage==='home'?'bg-green-500/20 text-green-400':p.advantage==='away'?'bg-red-500/20 text-red-400':'bg-white/5 text-gray-400'}">${p.home.name.split(' ').pop()}(${p.home.rating}) vs ${p.away.name.split(' ').pop()}(${p.away.rating}) ${p.diff>0?'+':''}${p.diff}</span>`).join('')}</div></div>`;
    }

    function getFlagEmoji(teamId) {
        if (!teamId) return '🏳️';
        const flagMap = {
            '202':'🇦🇷','203':'🇲🇽','205':'🇧🇷','206':'🇨🇦','208':'🇨🇴','209':'🇪🇨',
            '210':'🇵🇾','212':'🇺🇾','214':'🇨🇷','4375':'🇮🇶','4398':'🇶🇦','4469':'🇬🇭',
            '448':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','449':'🇳🇱','450':'🇨🇿','451':'🇰🇷','452':'🇧🇦','459':'🇧🇪',
            '464':'🇳🇴','465':'🇹🇷','466':'🇸🇪','467':'🇿🇦','469':'🇮🇷','472':'🇫🇷',
            '474':'🇦🇹','475':'🇨🇭','477':'🇭🇷','478':'🇫🇷','481':'🇩🇪','482':'🇵🇹',
            '580':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','624':'🇩🇿','627':'🇯🇵','628':'🇦🇺','654':'🇸🇳','655':'🇸🇦',
            '659':'🇹🇳','660':'🇺🇸','2570':'🇺🇿','2597':'🇨🇻','2620':'🇪🇬','2654':'🇭🇹',
            '2659':'🇵🇦','2666':'🇳🇿','2850':'🇨🇩','2869':'🇲🇦','2917':'🇯🇴','11678':'🇨🇼','4789':'🇨🇮',
        };
        return flagMap[String(teamId)] || '🏳️';
    }

    window.WorldCup.SpatialMatchup = { loadSpatialTab, loadSelectedSpatial, renderSpatialPitch, renderSpatialMatchupPanel, getFlagEmoji, FORMATIONS: {} };
    Object.assign(window, { loadSpatialTab, loadSelectedSpatial, getFlagEmoji });
})();
