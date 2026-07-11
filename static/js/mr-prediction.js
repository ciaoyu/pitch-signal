/**
 * Match Renderers — Prediction Layers & Bench Analysis
 *
 * Split from match-renderers.js (T7 refactoring)
 * Functions are attached to window.WorldCup.MatchRenderers namespace.
 */

window.WorldCup = window.WorldCup || {};
window.WorldCup.MatchRenderers = window.WorldCup.MatchRenderers || {};

(() => {
    const MR = window.WorldCup.MatchRenderers;
    const getLang = MR._shared.getLang;
    const tx = MR._shared.tx;
    const esc = MR._shared.esc;
    const attr = MR._shared.attr;
    const i18nText = MR._shared.i18nText;
    const FORMATION_POSITIONS = MR._shared.FORMATION_POSITIONS;
    const teamLabel = MR._shared.teamLabel;
    const teamFlagHtml = MR._shared.teamFlagHtml;
    const playerCoords = MR._shared.playerCoords;
    const translatePlayerName = MR._shared.translatePlayerName;

function renderPredictionLayers(pred) {
    if (!pred || (pred.homeWin === undefined && pred.draw === undefined && pred.awayWin === undefined)) {
        return `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction data unavailable')}</div>`;
    }

    const hw = ((pred.homeWin ?? 0) * 100).toFixed(1);
    const dw = ((pred.draw ?? 0) * 100).toFixed(1);
    const aw = ((pred.awayWin ?? 0) * 100).toFixed(1);
    const hwNum = parseFloat(hw);
    const dwNum = parseFloat(dw);
    const awNum = parseFloat(aw);

    // Score fields may arrive as an object {home,away} (mock) or a "h-a" string ("2-1") from /api/predict.
    const parseScore = (v) => {
        if (v && typeof v === 'object') return { home: v.home, away: v.away };
        if (typeof v === 'string') { const m = v.split('-'); if (m.length === 2) return { home: m[0].trim(), away: m[1].trim() }; }
        return { home: null, away: null };
    };
    // Layer 2 is λ-based: prefer the raw expected goals, fall back to the rounded expectedScore.
    const expStr = parseScore(pred.expectedScore);
    const lamHome = pred.goals?.homeExpected ?? expStr.home;
    const lamAway = pred.goals?.awayExpected ?? expStr.away;
    const escHome = (lamHome != null && lamHome !== '') ? Number(lamHome).toFixed(1) : '-';
    const escAway = (lamAway != null && lamAway !== '') ? Number(lamAway).toFixed(1) : '-';
    const pm = parseScore(pred.poissonModeScore);
    const pmHome = pm.home ?? '-';
    const pmAway = pm.away ?? '-';

    return `
    <div class="glass rounded-xl p-4 space-y-3">
        <!-- Layer 1: Win/Draw/Loss Probability Bar -->
        <div>
            <div class="text-xs font-bold text-gray-400 mb-2">
                <span class="inline-flex items-center gap-1">
                    <span class="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center text-[10px]">🎯</span>
                    ${tx('胜平负概率', 'Win/Draw/Loss')}
                </span>
            </div>
            <div class="prob-bar mb-2">
                <div class="prob-bar-home" style="width:${hw}%">${hwNum > 12 ? hw + '%' : ''}</div>
                <div class="prob-bar-draw" style="width:${dw}%">${dwNum > 10 ? dw + '%' : ''}</div>
                <div class="prob-bar-away" style="width:${aw}%">${awNum > 12 ? aw + '%' : ''}</div>
            </div>
            <div class="flex justify-between text-[11px]">
                <span class="text-green-400 font-bold">${tx('主胜', 'Home')} ${hw}%</span>
                <span class="text-yellow-400 font-bold">${tx('平局', 'Draw')} ${dw}%</span>
                <span class="text-red-400 font-bold">${tx('客胜', 'Away')} ${aw}%</span>
            </div>
        </div>

        <div class="border-t border-white/5"></div>

        <!-- Layer 2: Expected Score (λ-based) -->
        <div class="text-center">
            <div class="text-xs font-bold text-emerald-400 mb-1">
                <span class="inline-flex items-center gap-1">
                    <span class="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-[10px]">📊</span>
                    ${tx('期望比分', 'Expected Score')}
                </span>
            </div>
            <div class="text-xl font-black font-mono tracking-tight">
                <span class="text-blue-400">${esc(escHome)}</span>
                <span class="text-gray-500 mx-1.5">—</span>
                <span class="text-red-400">${esc(escAway)}</span>
            </div>
            <div class="text-[10px] text-gray-500 mt-1">
                ${getLang() === 'en' ? 'Based on expected goals λ' : '基于进球期望值 λ'}
            </div>
        </div>

        <div class="border-t border-white/5"></div>

        <!-- Layer 3: Poisson Mode Score -->
        <div class="text-center">
            <div class="text-xs font-bold text-amber-400 mb-1">
                <span class="inline-flex items-center gap-1">
                    <span class="w-5 h-5 rounded-md bg-amber-400/10 flex items-center justify-center text-[10px]">🔮</span>
                    ${tx('最可能比分', 'Most Likely Score')}
                </span>
            </div>
            <div class="text-xl font-black font-mono tracking-tight">
                <span class="text-blue-400">${esc(String(pmHome))}</span>
                <span class="text-gray-500 mx-1.5">—</span>
                <span class="text-red-400">${esc(String(pmAway))}</span>
            </div>
            <div class="text-[10px] text-gray-500 mt-1">
                ${getLang() === 'en'
                    ? 'Poisson mode: the single most probable exact scoreline'
                    : '泊松众数：所有可能比分中概率最高的一组'}
            </div>
        </div>
        ${(() => {
            const vf = pred.venueFactor;
            if (!vf || !vf.applied) return '';
            const fmtBeta = (b) => (b != null ? Number(b).toFixed(2) : '-');
            const row = (side, label) => {
                const f = vf[side] || {};
                const dh = f.deltaH != null ? Math.round(f.deltaH) : null;
                const t = f.tempC != null ? Math.round(f.tempC) : null;
                const bits = [];
                if (dh != null && dh > 0) bits.push(tx('海拔差', 'Alt Δ') + ' ' + dh + 'm');
                if (t != null) bits.push(tx('气温', 'Temp') + ' ' + t + '°C');
                return `<div class="flex items-center justify-between text-[11px]">
                    <span class="text-gray-400">${label}</span>
                    <span class="font-mono font-bold ${side === 'home' ? 'text-blue-400' : 'text-red-400'}">β ${fmtBeta(f.beta)}</span>
                    <span class="text-gray-500 text-[10px]">${bits.join(' · ') || tx('无修正', 'no effect')}</span>
                </div>`;
            };
            return `
            <div class="border-t border-white/5"></div>
            <div>
                <div class="text-xs font-bold text-cyan-400 mb-1.5">
                    <span class="inline-flex items-center gap-1">
                        <span class="w-5 h-5 rounded-md bg-cyan-500/15 flex items-center justify-center text-[10px]">🏔️</span>
                        ${tx('环境修正', 'Venue Adjustment')}
                    </span>
                </div>
                <div class="space-y-1">
                    ${row('home', tx('主队', 'Home'))}
                    ${row('away', tx('客队', 'Away'))}
                </div>
                <div class="text-[10px] text-gray-500 mt-1.5">
                    ${getLang() === 'en'
                        ? 'High altitude / heat scale down expected goals λ (β<1)'
                        : '高海拔 / 高温会按 β 系数下调进球期望 λ（β<1）'}
                </div>
            </div>`;
        })()}
    </div>`;
}

// renderFormation function — uses SVG tactical board

function renderBenchAnalysis(data, isFinishedMatch) {
    if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('数据暂无', 'No data')}</div>`;

    const home = data.homeTeam;
    const away = data.awayTeam;
    const comparison = data.comparison;

    // Bench strength color
    const getStrengthColor = (score) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    // Impact type icon
    const getImpactIcon = (type) => {
        switch(type) {
            case 'creative': return '🎨';
            case 'defensive': return '🛡️';
            case 'physical': return '💪';
            default: return '⚖️';
        }
    };

    // Appearance probability color
    const getProbColor = (prob) => {
        if (prob >= 0.7) return 'text-green-400';
        if (prob >= 0.5) return 'text-yellow-400';
        return 'text-red-400';
    };

    const renderSubstitutionImpact = (item) => {
        const impact = item.teamImpact;
        const playerLabel = item.playerIn
            ? `${esc(item.playerIn)}${item.playerOut ? ` ${tx('换下', 'for')} ${esc(item.playerOut)}` : ''}`
            : tx('换人', 'Substitution');
        let signal = `<span class="text-gray-500">${tx('数据不足', 'Insufficient data')}</span>`;
        if (item.impact?.status === 'pending') {
            signal = `<span class="text-gray-500">${tx('评估中', 'Evaluating')}</span>`;
        } else if (impact?.status === 'ready') {
            const direction = impact.direction;
            const icon = direction === 'positive' ? '↑' : direction === 'negative' ? '↓' : '→';
            const label = direction === 'positive'
                ? tx('压力提升', 'Pressure up')
                : direction === 'negative'
                    ? tx('压力下降', 'Pressure down')
                    : tx('压力持平', 'Pressure steady');
            const color = direction === 'positive'
                ? 'text-green-400'
                : direction === 'negative' ? 'text-red-400' : 'text-gray-300';
            const delta = Number(impact.slopeDelta);
            signal = `<span class="${color} font-bold">${icon} ${label} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}/min</span>`;
        }
        return `<div class="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
            <div class="min-w-0">
                <div class="text-xs text-gray-200 truncate">${playerLabel}</div>
                <div class="text-[10px] text-gray-500">${esc(item.minute)}′ · ${item.side === 'home' ? esc(teamLabel(home)) : item.side === 'away' ? esc(teamLabel(away)) : tx('球队待确认', 'Team unknown')}</div>
            </div>
            <div class="text-[11px] text-right shrink-0">${signal}</div>
        </div>`;
    };

    // Render bench player card
    const renderBenchPlayer = (player, teamColor, teamNameStr) => {
        const playerNameZh = translatePlayerName(player.name, player.nameZh);

        // Find if this player actually played
        let playedStr = '';
        if (data.realSubstitutions && data.realSubstitutions.length > 0) {
            const subEvent = data.realSubstitutions.find(s => {
                const matchName = s.playerIn.toLowerCase();
                const pName = (player.name || '').toLowerCase();
                return matchName === pName || pName.includes(matchName) || matchName.includes(pName);
            });
            if (subEvent) {
                playedStr = `<span class="font-bold ml-1 text-green-400">🔽 ${subEvent.minute} ${tx('出场', 'In')}</span>`;
            } else if (isFinishedMatch) {
                playedStr = `<span class="font-bold ml-1 text-gray-600">${tx('未出场', 'Unused')}</span>`;
            }
        }

        return `
        <div class="glass-light rounded-lg p-2 mb-2 cursor-pointer hover:bg-white/10 transition-colors"
             data-action="open-player-detail"
             data-player-id="${attr(player.id || '')}"
             data-player-name="${attr(player.name || '')}">
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold ${teamColor}">${player.jersey || '?'}</span>
                    <span class="text-xs font-bold">${esc(playerNameZh)}</span>
                    <span class="text-[11px] text-gray-500">${esc(player.pos) || '?'}</span>
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-[11px] text-gray-500">${getImpactIcon(player.impactType)}</span>
                    <span class="text-xs font-bold ${getStrengthColor(player.rating)}">${esc(player.rating) || '-'}</span>
                </div>
            </div>

            <div class="flex items-center gap-2 text-[11px] mb-1">
                <span class="text-gray-500">${tx('特色:', 'Traits:')}</span>
                ${player.traits?.map(t => `<span class="bg-white/5 px-1.5 py-0.5 rounded">${esc(t)}</span>`).join('') || '<span class="text-gray-600">-</span>'}
            </div>

            <div class="flex items-center justify-between text-[11px]">
                <div>
                    <span class="text-gray-500">${tx('替代:', 'Sub for:')}</span>
                    <span class="ml-1">${esc(player.substituteFor?.join(', ')) || '-'}</span>
                </div>
                <div>
                    ${playedStr ? `
                        <span class="text-gray-500">${tx('状态:', 'Status:')}</span>
                        ${playedStr}
                    ` : `
                        <span class="text-gray-500">${tx('出场概率:', 'Sub Prob:')}</span>
                        <span class="font-bold ml-1 ${getProbColor(player.appearanceProb)}">${Math.round(player.appearanceProb * 100)}%</span>
                    `}
                </div>
            </div>
        </div>
        `;
    };

    return `
    <div class="space-y-3">
        <!-- Comparison Overview -->
        <div class="glass-light rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-400">🔄 替补席对比</span>
                <span class="text-[11px] text-gray-500">板凳深度</span>
            </div>

            <div class="flex items-center gap-3">
                <div class="flex-1">
                    <div class="text-sm font-bold ${getStrengthColor(comparison.homeStrength)}">🔵 ${teamLabel(home)}</div>
                    <div class="text-lg font-bold ${getStrengthColor(comparison.homeStrength)}">${comparison.homeStrength || '-'}</div>
                </div>

                <div class="text-center">
                    <div class="text-xs text-gray-500">VS</div>
                    <div class="text-[11px] font-bold ${comparison.advantage === 'home' ? 'text-blue-400' : comparison.advantage === 'away' ? 'text-red-400' : 'text-gray-400'}">${comparison.advantage === 'home' ? '🔵 优势' : comparison.advantage === 'away' ? '🔴 优势' : '⚖️ 均势'}</div>
                </div>

                <div class="flex-1 text-right">
                    <div class="text-sm font-bold ${getStrengthColor(comparison.awayStrength)}">${teamLabel(away)} 🔴</div>
                    <div class="text-lg font-bold ${getStrengthColor(comparison.awayStrength)}">${comparison.awayStrength || '-'}</div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] mt-2">
                <div>
                    <span class="text-gray-500">超级替补:</span>
                    <span class="font-bold ml-1">${home.superSubCount || 0}</span>
                </div>
                <div class="text-right">
                    <span class="text-gray-500">超级替补:</span>
                    <span class="font-bold ml-1">${away.superSubCount || 0}</span>
                </div>
                <div>
                    <span class="text-gray-500">防守选项:</span>
                    <span class="font-bold ml-1">${home.defensiveOptions || 0}</span>
                </div>
                <div class="text-right">
                    <span class="text-gray-500">防守选项:</span>
                    <span class="font-bold ml-1">${away.defensiveOptions || 0}</span>
                </div>
                <div>
                    <span class="text-gray-500">进攻选项:</span>
                    <span class="font-bold ml-1">${home.attackingOptions || 0}</span>
                </div>
                <div class="text-right">
                    <span class="text-gray-500">进攻选项:</span>
                    <span class="font-bold ml-1">${away.attackingOptions || 0}</span>
                </div>
            </div>
        </div>

        ${Array.isArray(data.substitutionImpacts) && data.substitutionImpacts.length ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-gray-300 mb-1">${tx('换人影响', 'Substitution Impact')}</div>
            <div class="text-[10px] text-gray-500 mb-2">${tx('换人前后 10 分钟 Pressure Index 斜率', 'Pressure Index slope, 10 minutes before and after')}</div>
            ${data.substitutionImpacts.map(renderSubstitutionImpact).join('')}
        </div>
        ` : ''}

        <div class="grid grid-cols-2 gap-2">
            <div class="glass-light rounded-lg p-2 min-w-0">
                <div class="text-xs font-bold text-blue-400 mb-2">🔵 ${esc(teamLabel(home))}</div>
                ${home.bench?.map(p => renderBenchPlayer(p, 'text-blue-400', teamLabel(home))).join('') || `<div class="text-gray-500 text-xs">${tx('暂无替补数据', 'No bench data')}</div>`}
            </div>
            <div class="glass-light rounded-lg p-2 min-w-0">
                <div class="text-xs font-bold text-red-400 mb-2 text-right">${esc(teamLabel(away))} 🔴</div>
                ${away.bench?.map(p => renderBenchPlayer(p, 'text-red-400', teamLabel(away))).join('') || `<div class="text-gray-500 text-xs">${tx('暂无替补数据', 'No bench data')}</div>`}
            </div>
        </div>

        <!-- Substitution Matrix -->
        ${home.substitutionMatrix && Object.keys(home.substitutionMatrix).length > 0 ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-blue-400 mb-3 flex items-center gap-1">
                <span>🔄</span> ${teamLabel(home)} ${tx('核心轮换网络', 'Substitution Heatmap')}
            </div>
            <div class="grid grid-cols-2 gap-2">
                ${Object.entries(home.substitutionMatrix).map(([starter, subs]) => `
                <div class="bg-white/5 rounded-lg p-2 flex flex-col justify-center border border-white/5 shadow-sm">
                    <div class="text-[11px] font-bold text-gray-300 text-center mb-1">${esc(starter)}</div>
                    <div class="flex items-center justify-center">
                        <span class="text-gray-500 text-[10px]">▼</span>
                    </div>
                    <div class="text-center mt-1 flex flex-col items-center gap-1">
                        <span class="inline-block bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded font-medium">${esc(subs.primary) || '—'}</span>
                        ${subs.secondary ? `<span class="inline-block bg-white/5 text-gray-400 text-[9px] px-2 py-0.5 rounded">${esc(subs.secondary)}</span>` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${away.substitutionMatrix && Object.keys(away.substitutionMatrix).length > 0 ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-red-400 mb-3 flex items-center gap-1">
                <span>🔄</span> ${teamLabel(away)} ${tx('核心轮换网络', 'Substitution Heatmap')}
            </div>
            <div class="grid grid-cols-2 gap-2">
                ${Object.entries(away.substitutionMatrix).map(([starter, subs]) => `
                <div class="bg-white/5 rounded-lg p-2 flex flex-col justify-center border border-white/5 shadow-sm">
                    <div class="text-[11px] font-bold text-gray-300 text-center mb-1">${esc(starter)}</div>
                    <div class="flex items-center justify-center">
                        <span class="text-gray-500 text-[10px]">▼</span>
                    </div>
                    <div class="text-center mt-1 flex flex-col items-center gap-1">
                        <span class="inline-block bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded font-medium">${esc(subs.primary) || '—'}</span>
                        ${subs.secondary ? `<span class="inline-block bg-white/5 text-gray-400 text-[9px] px-2 py-0.5 rounded">${esc(subs.secondary)}</span>` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>
    `;
}

// applySubstitutionsToFormation — overlays substitution markers on SVG tactical board
    // Export to namespace
    MR.renderPredictionLayers = renderPredictionLayers;
    MR.renderBenchAnalysis = renderBenchAnalysis;
})();
