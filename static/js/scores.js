// ========== scores.js - Live Scores Module ==========
(function() {
    async function loadScores() {
        const { tx, esc, displayMaybeTeamName, attr } = window.WorldCup.Utils;
        const t = window.t;
        const state = window.WorldCup.State;
        const res = await window.WorldCup.ApiClient.get('/api/scores');
        const d = res.data;
        const el = document.getElementById('live-list');
        if (!res.ok) {
            el.innerHTML = `<div class="text-center py-20"><div class="text-5xl mb-3">⚠️</div><p class="text-gray-500">${res.isFailure ? tx('加载失败，请稍后重试', 'Failed to load, please retry') : esc(res.error || '')}</p></div>`;
            return;
        }
        // Show today's matches including finished ones — ESPN scoreboard already
        // scoped to today, so include post matches with final scores.
        const visibleMatches = d.matches || [];

        if (!visibleMatches.length) {
            el.innerHTML = `<div class="text-center py-20"><div class="text-5xl mb-3">😴</div><p class="text-gray-500">${esc(t('noMatchesToday'))}</p></div>`;
            return;
        }

        el.innerHTML = visibleMatches.map(m => card(m)).join('');
        document.getElementById('update-time').textContent = t('updatePrefix') + new Date().toLocaleTimeString(state.uiLang === 'zh' ? 'zh-CN' : 'en-US', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' });
    }

    function card(m) {
        const { esc, attr, tx, displayMaybeTeamName } = window.WorldCup.Utils;
        const live = m.state === 'in';
        const done = m.state === 'post';
        const statusCls = live ? 'text-red-400' : done ? 'text-gray-500' : 'text-blue-400';
        const score = m.state !== 'pre' ? `${esc(m.home.score)} : ${esc(m.away.score)}` : 'vs';
        const scoreCls = live ? 'text-white' : done ? 'text-gray-400' : 'text-gray-600';

        let minute = '';
        if (live && m.status) {
            const minMatch = m.status.match(/(\d+)/);
            if (minMatch) minute = esc(minMatch[1]) + "'";
        }

        const action = 'open-match';
        const timeText = (() => {
            const raw = String(m.timeBJT || m.dateBJT || '').trim();
            if (!raw) return '';
            const parts = raw.split(/\s+/);
            return (parts.length > 1 ? parts[1] : parts[0]).substring(0, 5);
        })();

        return `
        <div class="schedule-row" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || '')}" data-away-id="${attr(m.away.id || '')}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || '')}">
            <div class="schedule-time">${esc(timeText)} <span class="text-[9px] text-gray-600">${tx('北京时间', 'CST')}</span></div>
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
                ${logo(m.home)}
                <span class="font-bold text-xs truncate">${esc(displayMaybeTeamName(m.home))}</span>
            </div>
            <div class="flex flex-col items-center px-2">
                <span class="${scoreCls} text-sm font-bold tabular-nums">${score}</span>
                ${live ? `<span class="text-[9px] text-red-400 font-bold animate-pulse">LIVE ${minute}</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 flex-1 min-w-0 justify-end text-right">
                <span class="font-bold text-xs truncate">${esc(displayMaybeTeamName(m.away))}</span>
                ${logo(m.away)}
            </div>
            <span class="text-[11px] ${statusCls} font-bold min-w-[40px] text-right">${esc(m.status)}</span>
        </div>`;
    }

    function logo(t) {
        const { esc, attr } = window.WorldCup.Utils;
        if (t.logo) return `<img src="${attr(t.logo)}" class="w-7 h-7 object-contain shrink-0" loading="lazy" onerror="this.style.display='none'">`;
        if (t.flag) return `<span class="text-lg shrink-0">${esc(t.flag)}</span>`;
        return '';
    }

    // Expose to WorldCup namespace
    window.WorldCup.Scores = {
        loadScores,
        card,
        logo
    };

    // Also expose globally for backward compatibility
    window.loadScores = loadScores;
    window.card = card;
    window.logo = logo;
})();