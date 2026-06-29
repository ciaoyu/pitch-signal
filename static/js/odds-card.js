(function() {
    'use strict';
    const { tx } = window.WorldCup.Utils;
    
    function renderOddsTrend(current, previous) {
        if (!previous) return `<span class="text-gray-600 text-[11px]">${tx('首次数据', 'First sample')}</span>`;
        const diff = current - previous;
        const pct = ((diff / previous) * 100).toFixed(1);
        if (Math.abs(diff) < 0.01) return '<span class="trend-flat">→</span>';
        if (diff > 0) return `<span class="trend-up arrow-bounce">↑ +${pct}%</span>`;
        return `<span class="trend-down arrow-bounce">↓ ${pct}%</span>`;
    }
    
    function renderOddsCard(odds) {
        if (!odds || odds.source === 'api_key_not_configured') return '';
        const hist = odds.history || [];
        const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
        const homeTrend = prev ? renderOddsTrend(odds.homeWin, prev.homeWin) : '';
        const drawTrend = prev ? renderOddsTrend(odds.draw, prev.draw) : '';
        const awayTrend = prev ? renderOddsTrend(odds.awayWin, prev.awayWin) : '';
        return `
        <div class="glass rounded-xl p-3 mb-3">
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-bold text-yellow-400">💰 ${tx('盘口', 'Odds')}</h4>
                <div class="flex items-center gap-2">
                    ${odds._frozen ? `<span class="text-[11px] text-orange-400 font-bold">⚡ ${tx('赛前数据', 'Pre-match data')}</span>` : ''}
                    <span class="text-[11px] text-gray-600">${odds.bookmakers?.length || 0}${tx('家博彩', ' books')}</span>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center mb-2">
                <div class="glass-light rounded-lg p-2">
                    <div class="text-[11px] text-gray-500">${tx('主胜', 'Home')}</div>
                    <div class="text-base font-bold text-green-400">${odds.homeWin || '-'}</div>
                    <div class="text-[11px]">${homeTrend}</div>
                </div>
                <div class="glass-light rounded-lg p-2">
                    <div class="text-[11px] text-gray-500">${tx('平局', 'Draw')}</div>
                    <div class="text-base font-bold">${odds.draw || '-'}</div>
                    <div class="text-[11px]">${drawTrend}</div>
                </div>
                <div class="glass-light rounded-lg p-2">
                    <div class="text-[11px] text-gray-500">${tx('客胜', 'Away')}</div>
                    <div class="text-base font-bold text-blue-400">${odds.awayWin || '-'}</div>
                    <div class="text-[11px]">${awayTrend}</div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="glass-light rounded-lg p-2 text-center">
                    <div class="text-[11px] text-gray-500">${tx('大小球', 'Total')} ${odds.overUnder?.line || 2.5}</div>
                    <div>${tx('大', 'Over')} ${odds.overUnder?.over || '-'} / ${tx('小', 'Under')} ${odds.overUnder?.under || '-'}</div>
                </div>
                <div class="glass-light rounded-lg p-2 text-center">
                    <div class="text-[11px] text-gray-500">${tx('让球盘', 'Handicap')}</div>
                    <div>${odds.asianHandicap?.line > 0 ? tx('主让', 'Home -') + odds.asianHandicap.line : odds.asianHandicap?.line < 0 ? tx('客让', 'Away -') + Math.abs(odds.asianHandicap.line) : tx('平手', 'Level')} ${odds.asianHandicap?.home || '-'}</div>
                </div>
            </div>
        </div>`;
    }
    
    window.WorldCup.OddsCard = { renderOddsTrend, renderOddsCard };
    Object.assign(window, { renderOddsTrend, renderOddsCard });
})();