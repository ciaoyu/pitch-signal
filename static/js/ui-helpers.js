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
    
    function showTip(el, name, pos, rating, team, status) {
        let tip = document.getElementById('player-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'player-tip';
            tip.className = 'player-tip';
            document.body.appendChild(tip);
        }
        const cls = rating >= 7.5 ? 'text-green-400' : rating >= 6.5 ? 'text-yellow-400' : 'text-red-400';
        const st = status || '首发';
        const sCls = st === '首发' ? 'text-green-400' : st === '替补' ? 'text-yellow-400' : 'text-red-400';
        tip.innerHTML = `
            <div class="text-sm font-bold">${esc(name)}</div>
            <div class="text-[11px] text-gray-500 mb-2">${esc(team)} · ${esc(pos)}</div>
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">状态</span>
                <span class="text-xs font-bold ${sCls}">${esc(st)}</span>
            </div>
            <div class="flex items-center gap-2 mb-1">
                <span class="text-xs text-gray-400">评分</span>
                <span class="text-lg font-bold ${cls}">${esc(rating)}</span>
            </div>
            <div class="text-[11px] text-gray-600">点击查看球员详情 →</div>
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
        const status = el.dataset.status || '首发';
        showTip(el, name, pos, rating, team, status);
    }
    
    window.WorldCup.UIHelpers = { setPitchView, showTip, hideTip, showTipFromDataset };
    Object.assign(window, { setPitchView, showTip, hideTip, showTipFromDataset });
})();