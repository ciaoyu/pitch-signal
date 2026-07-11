/**
 * Match Renderers — Coach Panel
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

function renderCoachPanel(coachData, isFinishedMatch) {
    // No data at all → placeholder
    if (!coachData || (!coachData.coachA && !coachData.coachB)) {
        return `<div class="glass-light rounded-lg p-6 text-center">
            <div class="text-4xl mb-3">🧠</div>
            <div class="text-sm font-bold text-gray-300 mb-2">${tx('教练数据', 'Coach Data')}</div>
            <div class="text-xs text-gray-500">${tx('教练数据将在后续版本中开放，敬请期待。', 'Coach data will be available in a future release. Stay tuned.')}</div>
        </div>`;
    }

    // Both coaches available (with or without comparison)
    const coachA = coachData.coachA;
    const coachB = coachData.coachB;
    const comp = coachData.comparison;

    const renderCoachCard = (coach, side) => {
        if (!coach || coach.error) {
            return `<div class="glass-light rounded-lg p-4 text-center">
                <div class="text-2xl mb-1">🤷</div>
                <div class="text-xs text-gray-500">${tx('教练数据暂未同步', 'Coach data not synced')}</div>
            </div>`;
        }
        const name = coach.name || '?';
        const style = coach.style || tx('未知', 'Unknown');
        const tenure = coach.tenure || '?';
        const formations = Array.isArray(coach.formation) ? coach.formation.join(' / ') : (coach.formation || '');
        const tournament = coach.bigTournament || '';
        const nationality = coach.nationality || '';
        const flag = coach.flag || '';
        const sideColor = side === 'home' ? 'border-l-blue-500' : 'border-l-red-500';
        const initial = name !== '?' ? name.charAt(0).toUpperCase() : '?';

        return `<div class="glass-light rounded-lg p-4 border-l-2 ${sideColor}">
            <div class="flex items-center gap-3 mb-3">
                <div class="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold shadow-inner shrink-0">
                    ${initial}
                    ${flag ? `<div class="absolute -bottom-1 -right-1 text-[10px] bg-gray-800 rounded-full w-4 h-4 flex items-center justify-center border border-gray-700">${esc(flag)}</div>` : ''}
                </div>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-sm font-bold text-gray-200 truncate" title="${esc(name)}">${esc(name)}</span>
                    ${nationality ? `<span class="text-[10px] text-gray-500 truncate" title="${esc(nationality)}">${esc(nationality)}</span>` : ''}
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px] bg-white/5 rounded-lg p-2">
                <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx('风格', 'Style')}</span><span class="text-gray-300 font-semibold truncate" title="${esc(style)}">${esc(style)}</span></div>
                <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx('执教', 'Tenure')}</span><span class="text-gray-300 font-mono font-semibold truncate" title="${esc(tenure)}">${esc(tenure)}</span></div>
                ${formations ? `<div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx('阵型', 'Formation')}</span><span class="text-gray-300 font-semibold truncate" title="${esc(formations)}">${esc(formations)}</span></div>` : ''}
                ${tournament ? `<div class="flex flex-col col-span-2"><span class="text-gray-500 mb-0.5">${tx('赛会履历', 'Tournament record')}</span><span class="text-gray-300 leading-tight">${esc(tournament)}</span></div>` : ''}
            </div>
        </div>`;
    };

    let html = '<div class="grid grid-cols-2 gap-3 mb-3">';
    html += renderCoachCard(coachA, 'home');
    html += renderCoachCard(coachB, 'away');
    html += '</div>';

    // These are recorded facts, not a model score or a claimed tactical edge.
    if (comp?.observations?.length) {
        html += `<div class="glass-light rounded-lg p-4 mt-3">
            <div class="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">
                <span>📚</span> ${tx('战术观察与资料对照', 'Tactical observations & records')}
            </div>
            <div class="space-y-2">${comp.observations.map(item => `<div class="bg-white/5 rounded-lg p-2.5"><div class="text-[10px] text-gray-500 font-bold mb-1">${esc(i18nText(item.label, ''))}</div><div class="grid grid-cols-2 gap-2 text-[11px] text-gray-300"><span>${esc(item.home || '—')}</span><span class="text-right">${esc(item.away || '—')}</span></div></div>`).join('')}</div>
            <div class="text-[9px] text-gray-600 mt-3">${tx('仅展示已记录资料；不提供总体评分或“临场调整优势”结论。', 'Recorded information only; no overall score or in-game-adjustment edge is asserted.')}</div>
        </div>`;
    } else if (coachA && coachB && !coachData._fallback) {
        html += `<div class="glass-light rounded-lg p-4 text-center mt-3">
            <div class="text-xs text-gray-500">${tx('教练对阵分析暂未生成', 'Coach matchup analysis not yet generated')}</div>
        </div>`;
    }

    return html;
}

// ═══════════════════════════════════════════════════════
// HUD Renderers — 3-column desktop layout
// ═══════════════════════════════════════════════════════

/**
 * HUD Left Panel — Stats bar rows (possession, shots, passes etc.)
 * Renders from matchData.teamStats ESPN format
 */
    // Export to namespace
    MR.renderCoachPanel = renderCoachPanel;
})();
