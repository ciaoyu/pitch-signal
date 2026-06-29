(function() {
    'use strict';
    const { esc } = window.WorldCup.Utils;
    
    function setPitchView(mode, btn) {
        window.WorldCup.State.pitchViewMode = mode;
        const panel = btn.closest('.spatial-matchup-panel') || document;
        panel.querySelectorAll('.pitch-view-btn').forEach(b => {
            b.classList.remove('bg-white/10', 'text-white', 'font-bold');
            b.classList.add('bg-white/5', 'text-gray-500');
        });
        btn.classList.remove('bg-white/5', 'text-gray-500');
        btn.classList.add('bg-white/10', 'text-white', 'font-bold');
        panel.querySelectorAll('.pitch-home').forEach(el => el.style.display = mode === 'away' ? 'none' : '');
        panel.querySelectorAll('.pitch-away').forEach(el => el.style.display = mode === 'home' ? 'none' : '');
        panel.querySelectorAll('.pitch-pair').forEach(el => el.style.display = mode === 'both' ? '' : 'none');
    }
    
    const POS_ZH = { GK:'门将', CB:'中后卫', LB:'左后卫', RB:'右后卫', LWB:'左翼卫', RWB:'右翼卫', DF:'后卫', DM:'后腰', CM:'中场', AM:'攻击中场', LM:'左中场', RM:'右中场', MF:'中场', LW:'左翼', RW:'右翼', SS:'影子前锋', CF:'中锋', ST:'前锋', FW:'前锋' };

    function showTip(el, name, pos, rating, team, status, goals) {
        let tip = document.getElementById('player-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'player-tip';
            tip.className = 'player-tip';
            document.body.appendChild(tip);
        }
        const tx = window.WorldCup?.I18n?.tx || ((zh) => zh);
        const lang = window.WorldCup?.State?.uiLang || 'zh';
        const cls = rating >= 7.5 ? 'text-green-400' : rating >= 6.5 ? 'text-yellow-400' : 'text-red-400';
        const defaultStatus = tx('首发', 'Starting');
        const st = status || defaultStatus;
        const isSub = st !== defaultStatus && st !== '首发' && st !== 'Starting';
        const sCls = isSub ? 'text-amber-400' : 'text-green-400';
        const posLabel = lang === 'zh' ? (POS_ZH[pos] || pos) : pos;
        const goalsHtml = goals ? `<div class="text-[11px] text-emerald-400 mt-1">⚽ ${esc(goals)}</div>` : '';
        tip.innerHTML = `
            <div class="text-sm font-bold mb-0.5">${esc(name)}</div>
            <div class="text-[11px] text-gray-500 mb-2">${esc(team)} · ${esc(posLabel)}</div>
            <div class="mb-1.5">
                <div class="text-[10px] text-gray-500 mb-0.5">${tx('状态', 'Status')}</div>
                <div class="text-xs font-bold ${sCls}" style="line-height:1.4;word-break:break-word">${esc(st)}</div>
            </div>
            ${goalsHtml}
            <div class="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/5">
                <span class="text-[10px] text-gray-500">${tx('评分', 'Rating')}</span>
                <span class="text-base font-bold font-mono ${cls}">${esc(rating)}</span>
            </div>
            <div class="text-[10px] text-gray-600 mt-1">${tx('点击查看球员详情', 'Click for details')} →</div>
        `;
        const rect = el.getBoundingClientRect();
        tip.style.left = Math.min(rect.right + 8, window.innerWidth - 200) + 'px';
        tip.style.top = Math.max(rect.top - 20, 8) + 'px';
        tip.classList.add('show');
    }
    
    function hideTip() {
        const tip = document.getElementById('player-tip');
        if (tip) tip.classList.remove('show');
    }
    
    function showTipFromDataset(el) {
        const name = el.dataset.name || '';
        const pos = el.dataset.pos || '';
        const rating = parseFloat(el.dataset.rating) || 0;
        const team = el.dataset.team || '';
        const status = el.dataset.status || '';
        const goals = el.dataset.goals || '';
        showTip(el, name, pos, rating, team, status, goals);
    }
    
    window.WorldCup.UIHelpers = { setPitchView, showTip, hideTip, showTipFromDataset };
    Object.assign(window, { setPitchView, showTip, hideTip, showTipFromDataset });
})();