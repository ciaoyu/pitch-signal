// ========== match-stats.js - Match Statistics Rendering Module ==========
(function() {
    const MATCH_STAT_GROUPS = {
        attack: {
            label: { zh: '进攻', en: 'Attack' },
            icon: '⚔️',
            stats: {
                possessionPct: { zh: '控球率', en: 'Possession' },
                wonCorners: { zh: '角球', en: 'Corners' },
                offsides: { zh: '越位', en: 'Offsides' },
            },
        },
        shooting: {
            label: { zh: '射门', en: 'Shooting' },
            icon: '🎯',
            stats: {
                shotsSummary: { zh: '射门（射正）', en: 'Shots (on target)' },
                totalShots: { zh: '总射门', en: 'Total shots' },
                shotsOnTarget: { zh: '射正', en: 'Shots on target' },
                shotPct: { zh: '射门转化率', en: 'Shot conversion' },
                blockedShots: { zh: '封堵射门', en: 'Blocked shots' },
                penaltyKickGoals: { zh: '点球得分', en: 'Penalty goals' },
                penaltyKickShots: { zh: '点球数', en: 'Penalty shots' },
            },
        },
        passing: {
            label: { zh: '传球', en: 'Passing' },
            icon: '🧭',
            stats: {
                accuratePasses: { zh: '准确传球', en: 'Accurate passes' },
                totalPasses: { zh: '总传球', en: 'Total passes' },
                passPct: { zh: '传球成功率', en: 'Pass accuracy' },
                accurateCrosses: { zh: '准确传中', en: 'Accurate crosses' },
                totalCrosses: { zh: '总传中', en: 'Total crosses' },
                crossPct: { zh: '传中成功率', en: 'Cross accuracy' },
                accurateLongBalls: { zh: '准确长传', en: 'Accurate long balls' },
                totalLongBalls: { zh: '总长传', en: 'Total long balls' },
                longballPct: { zh: '长传成功率', en: 'Long-ball accuracy' },
            },
        },
        defending: {
            label: { zh: '防守', en: 'Defending' },
            icon: '🛡️',
            stats: {
                saves: { zh: '扑救', en: 'Saves' },
                effectiveTackles: { zh: '成功抢断', en: 'Successful tackles' },
                totalTackles: { zh: '总抢断', en: 'Total tackles' },
                tacklePct: { zh: '抢断成功率', en: 'Tackle success' },
                interceptions: { zh: '拦截', en: 'Interceptions' },
                effectiveClearance: { zh: '有效解围', en: 'Effective clearances' },
                totalClearance: { zh: '总解围', en: 'Total clearances' },
            },
        },
        discipline: {
            label: { zh: '纪律', en: 'Discipline' },
            icon: '🟨',
            stats: {
                foulsCommitted: { zh: '犯规', en: 'Fouls committed' },
                yellowCards: { zh: '黄牌', en: 'Yellow cards' },
                redCards: { zh: '红牌', en: 'Red cards' },
            },
        },
    };

    function matchStatHasValue(value) {
        const parts = String(value ?? '').match(/\d+(?:\.\d+)?/g);
        return Boolean(parts?.some(part => Number(part) !== 0));
    }

    function matchStatMagnitude(value) {
        const firstNumber = String(value ?? '').match(/\d+(?:\.\d+)?/);
        return firstNumber ? Number(firstNumber[0]) : 0;
    }

    function renderMatchStatComparison(stat, label) {
        const { esc, attr, i18nText } = window.WorldCup.Utils;
        const homeValue = String(stat.home ?? '0');
        const awayValue = String(stat.away ?? '0');
        const homeMagnitude = matchStatMagnitude(homeValue);
        const awayMagnitude = matchStatMagnitude(awayValue);
        const total = homeMagnitude + awayMagnitude;
        const homeWidth = total ? Math.round(homeMagnitude / total * 100) : 0;
        const awayWidth = total ? Math.round(awayMagnitude / total * 100) : 0;

        return `<div class="py-2.5 border-b border-white/5 last:border-b-0">
            <div class="flex items-center gap-2 mb-1.5">
                <span class="flex-1 text-xs font-mono font-bold tabular-nums">${esc(homeValue)}</span>
                <span class="w-32 shrink-0 text-center text-[11px] font-medium text-gray-400">${esc(i18nText(label))}</span>
                <span class="flex-1 text-right text-xs font-mono font-bold tabular-nums">${esc(awayValue)}</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5" aria-label="${attr(i18nText(label))}">
                <div class="elo-bar flex justify-end"><div class="elo-bar-fill" style="width:${homeWidth}%"></div></div>
                <div class="elo-bar"><div class="elo-bar-fill" style="width:${awayWidth}%"></div></div>
            </div>
        </div>`;
    }

    function renderMatchStats(teamStats) {
        const { esc, i18nText, tx } = window.WorldCup.Utils;
        const statsByName = new Map(teamStats.map(stat => [stat.name, stat]));
        const groups = Object.values(MATCH_STAT_GROUPS).map(group => {
            const rows = Object.entries(group.stats)
                .map(([name, label]) => ({ stat: statsByName.get(name), label }))
                .filter(({ stat }) => stat && (matchStatHasValue(stat.home) || matchStatHasValue(stat.away)));
            if (!rows.length) return '';

            return `<section class="pred-section mb-3 last:mb-0">
                <h4 class="pred-section-title text-blue-400">${group.icon} ${esc(i18nText(group.label))}</h4>
                ${rows.map(({ stat, label }) => renderMatchStatComparison(stat, label)).join('')}
            </section>`;
        }).join('');

        return groups || `<div class="text-gray-600 text-sm py-2">${tx('暂无技术统计', 'No match statistics')}</div>`;
    }

    // Render a side-by-side comparison of recent-avg stats for two teams
    // hs/as: { stats: { "passCompletionPct": { avg: 82.5, count: 3 }, ... }, matches: N, teamId }
    function renderRecentAvgComparison(hs, as, hName, aName) {
        const { esc, i18nText, tx } = window.WorldCup.Utils;
        if (!hs && !as) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('赛前暂无可用统计', 'No pre-match stats')}</div>`;

        // Known stat categories to extract
        const statDefs = [
            { key: 'possessionPct', label: { zh: '控球率%', en: 'Possession%' }, postfix: '%' },
            { key: 'totalShots', label: { zh: '总射门', en: 'Total Shots' } },
            { key: 'shotsOnTarget', label: { zh: '射正', en: 'Shots on Target' } },
            { key: 'passCompletionPct', label: { zh: '传球成功率%', en: 'Pass Acc%' }, postfix: '%' },
            { key: 'foulsCommitted', label: { zh: '犯规', en: 'Fouls' }, lowerIsBetter: true },
            { key: 'yellowCards', label: { zh: '黄牌', en: 'Yellow Cards' }, lowerIsBetter: true },
            { key: 'redCards', label: { zh: '红牌', en: 'Red Cards' }, lowerIsBetter: true },
            { key: 'offsides', label: { zh: '越位', en: 'Offsides' }, lowerIsBetter: true },
            { key: 'corners', label: { zh: '角球', en: 'Corners' } },
            { key: 'saves', label: { zh: '扑救', en: 'Saves' } },
            { key: 'tacklesWon', label: { zh: '成功抢断', en: 'Tackles Won' } },
            { key: 'crosses', label: { zh: '传中', en: 'Crosses' } },
            { key: 'goalsAgainst', label: { zh: '失球', en: 'Goals Against' }, lowerIsBetter: true },
        ];

        const fmtVal = (key, sideData) => {
            const entry = (sideData?.stats || {})[key];
            if (!entry) return null;
            return { avg: entry.avg, count: entry.count };
        };

        // Only render rows where at least one side has data
        const rows = statDefs.map(def => {
            const hv = fmtVal(def.key, hs);
            const av = fmtVal(def.key, as);
            return { def, hv, av };
        }).filter(r => r.hv || r.av);

        if (!rows.length) {
            return `<div class="text-gray-500 text-xs py-4 text-center">${tx('赛前暂无可用统计', 'No pre-match stats')}</div>`;
        }

        // Sample-size subtitles
        const hSample = hs?.matches || 0;
        const aSample = as?.matches || 0;

        let html = '';

        // Subtitle bar: team name + sample size
        html += `<div class="flex items-center gap-2 mb-3 text-[10px] text-gray-500">
            <span class="flex-1 truncate text-left font-medium text-gray-300">${esc(hName)} <span class="text-gray-500">(n=${hSample})</span></span>
            <span class="w-24 shrink-0 text-center font-bold text-gray-400">${tx('统计项', 'Stat')}</span>
            <span class="flex-1 truncate text-right font-medium text-gray-300">${esc(aName)} <span class="text-gray-500">(n=${aSample})</span></span>
        </div>`;

        for (const { def, hv, av } of rows) {
            const label = i18nText(def.label);
            const pfx = def.postfix || '';
            const hStr = hv ? (hv.avg + pfx) : '-';
            const aStr = av ? (av.avg + pfx) : '-';
            const hNum = hv ? hv.avg : 0;
            const aNum = av ? av.avg : 0;
            const total = hNum + aNum || 1;
            const hPct = Math.round((hNum / total) * 100);
            const aPct = 100 - hPct;
            const lib = def.lowerIsBetter;

            html += `<div class="py-2.5 border-b border-white/5 last:border-b-0">
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="flex-1 text-xs font-mono font-bold tabular-nums text-left ${lib && hStr !== '-' ? 'text-amber-300' : ''}">${esc(hStr)}</span>
                    <span class="w-24 shrink-0 text-center text-[10px] text-gray-500">${esc(label)}</span>
                    <span class="flex-1 text-right text-xs font-mono font-bold tabular-nums ${lib && aStr !== '-' ? 'text-amber-300' : ''}">${esc(aStr)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500/70 rounded-full" style="width:${hPct}%"></div>
                    </div>
                    <div class="w-24 shrink-0"></div>
                    <div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-red-400/70 rounded-full ml-auto" style="width:${aPct}%"></div>
                    </div>
                </div>
            </div>`;
        }

        return html;
    }

    // Expose to WorldCup namespace
    window.WorldCup.MatchStats = {
        MATCH_STAT_GROUPS,
        matchStatHasValue,
        matchStatMagnitude,
        renderMatchStatComparison,
        renderMatchStats,
        renderRecentAvgComparison
    };

    // Also expose globally for backward compatibility
    window.MATCH_STAT_GROUPS = MATCH_STAT_GROUPS;
    window.renderMatchStatComparison = renderMatchStatComparison;
    window.renderMatchStats = renderMatchStats;
    window.renderRecentAvgComparison = renderRecentAvgComparison;
})();