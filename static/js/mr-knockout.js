/**
 * Match Renderers — Knockout Intelligence
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

function renderKnockoutIntel(intel) {
    if (!intel || !intel.meta || !intel.meta.isKnockout || !intel.sections || typeof intel.sections !== 'object') {
        return '';
    }
    const sectionKeys = Object.keys(intel.sections);
    if (sectionKeys.length === 0) {
        return '';
    }

    const L = (o) => {
        if (!o) return '';
        if (typeof o === 'string') return esc(o);
        if (window.WorldCup && window.WorldCup.I18n && typeof window.WorldCup.I18n.i18nText === 'function') {
            return esc(window.WorldCup.I18n.i18nText(o, ''));
        }
        return esc(o.zh || o.en || '');
    };

    const roundText = intel.meta.roundLabel ? L(intel.meta.roundLabel) : esc(intel.meta.round || '');

    const renderSectionHeader = (title, sec) => {
        const confColor = sec.confidence === 'high' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                          sec.confidence === 'medium' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                          'bg-gray-500/15 text-gray-400 border border-gray-500/30';
        const confLabel = esc(({ low: tx('低', 'Low'), medium: tx('中', 'Medium'), high: tx('高', 'High') }[sec.confidence] || sec.confidence || tx('低', 'Low')));
        const sourceLabel = ({
            'ai-postmortem': tx('AI 赛后复盘', 'AI post-match review'),
            'fifa-lineups+player-events': tx('FIFA 阵容与球员事件', 'FIFA lineups + player events'),
            'world-cup-history+ratings+schedule+player-events': tx('世界杯历史与赛事数据', 'World Cup history + match data'),
            'schedule+venues': tx('赛程与场地', 'Schedule + venues'),
            'wc2026/team_style_facts.json': tx('赛事风格事实', 'Tournament style facts'),
            'player-match-events': tx('球员比赛事件', 'Player match events'),
            'player_match_events': tx('球员比赛事件', 'Player match events'),
            'match_officials+player_match_events': tx('裁判与球员事件', 'Officials + player events'),
            'continental-strength/reference-elo-head': tx('洲际实力参考', 'Continental strength reference'),
            'espn-events+fifa-rules': tx('ESPN 赛事与 FIFA 纪律规则', 'ESPN events + FIFA disciplinary rules'),
            'world-cup-history+schedule+player-events': tx('世界杯历史与赛事数据', 'World Cup history + match data'),
        }[sec.source] || sec.source);
        const sourceBadge = sourceLabel ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono">${esc(sourceLabel)}</span>` : '';
        const modelBadge = sec.usedInModel ?
            `<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">${tx('已入量化模型', 'MODEL SIGNAL')}</span>` :
            `<span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">${tx('仅战术参考', 'INFO ONLY')}</span>`;
        return `<div class="flex items-center justify-between mb-1.5 gap-1.5 flex-wrap border-b border-white/5 pb-1">
            <span class="text-xs font-bold text-gray-200">${title}</span>
            <div class="flex items-center gap-1">
                <span class="text-[9px] px-1.5 py-0.5 rounded ${confColor}">${confLabel}</span>
                ${sourceBadge}
                ${modelBadge}
            </div>
        </div>`;
    };

    const renderNote = (sec) => {
        if (!sec || !sec.note) return '';
        return `<div class="text-[10px] text-amber-300/80 mt-1 leading-snug">• ${L(sec.note)}</div>`;
    };

    const SECTION_ORDER = ['suspensions', 'fatigue', 'styleMatchup', 'penalty', 'referee', 'superSubs', 'starForm', 'familiarity', 'gameState', 'experience', 'lessons'];
    const orderedKeys = [...SECTION_ORDER.filter(k => intel.sections[k]), ...sectionKeys.filter(k => !SECTION_ORDER.includes(k))];

    let cardsHtml = '';
    orderedKeys.forEach(key => {
        const sec = intel.sections[key];
        if (!sec) return;

        let cardContent = '';
        if (key === 'suspensions') {
            const renderSide = (sideLabel, data) => {
                if (!data) return '';
                const outList = (data.out || []).map(p => {
                    const name = L(p.playerZh) || esc(p.player);
                    const reason = L(p.reason);
                    return `<div class="text-[10px] text-red-300">🚫 ${name} (${reason})</div>`;
                }).join('');
                const riskList = (data.atRisk || []).map(p => {
                    const name = L(p.playerZh) || esc(p.player);
                    return `<div class="text-[10px] text-amber-300">⚠️ ${name} (${p.yellows || 1} ${tx('黄', 'Y')})</div>`;
                }).join('');
                return `<div class="p-1.5 rounded bg-white/[0.02]">
                    <div class="text-[10px] font-semibold text-gray-400 mb-1">${sideLabel}</div>
                    ${outList || `<div class="text-[10px] text-gray-500">${tx('无停赛', 'No suspensions')}</div>`}
                    ${riskList}
                </div>`;
            };
            cardContent += renderSectionHeader(tx('停赛与伤停风险', 'Suspensions & Risk'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderSide(tx('主队', 'Home'), sec.home)}
                ${renderSide(tx('客队', 'Away'), sec.away)}
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'fatigue') {
            const renderSide = (sideLabel, data) => {
                if (!data) return '';
                return `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] space-y-0.5">
                    <div class="font-semibold text-gray-400">${sideLabel}</div>
                    <div class="flex justify-between"><span class="text-gray-500">${tx('休息天数', 'Rest Days')}:</span> <span class="font-mono text-gray-200">${Fmt.safeNum(data.restDays, 0)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">${tx('加时负荷', 'Extra Time')}:</span> <span class="font-mono ${data.prevWentToEt ? 'text-amber-400' : 'text-gray-300'}">${Fmt.safeNum(data.cumEtMinutes, 0)} ${tx('分钟', 'min')}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">${tx('行程距离', 'Travel')}:</span> <span class="font-mono text-gray-300">${Fmt.safeNum(data.travelKm, 0)} km</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">${tx('疲劳指数', 'Fatigue Score')}:</span> <span class="font-mono font-bold text-blue-300">${Fmt.safeNum(data.score, 0).toFixed(2)}</span></div>
                </div>`;
            };
            cardContent += renderSectionHeader(tx('体能与赛程负荷', 'Fatigue & Travel'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderSide(tx('主队', 'Home'), sec.home)}
                ${renderSide(tx('客队', 'Away'), sec.away)}
            </div>`;
            if (sec.differential != null) {
                cardContent += `<div class="text-[10px] text-gray-400 mt-1.5">${tx('疲劳指数差值', 'Differential')}: <span class="font-mono font-bold text-gray-200">${Fmt.safeNum(sec.differential, 0).toFixed(2)}</span></div>`;
            }
            cardContent += renderNote(sec);
        } else if (key === 'penalty') {
            const renderSide = (sideLabel, data) => {
                if (!data) return '';
                const skillPct = Math.round(Fmt.safeNum(data.winRate, 0) * 100);
                return `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] space-y-1">
                    <div class="flex justify-between font-semibold"><span class="text-gray-400">${sideLabel}</span><span class="font-mono text-emerald-400">${skillPct}%</span></div>
                    <div class="flex justify-between text-gray-500"><span>${tx('世界杯累计', 'World Cup total')}:</span> <span>${Fmt.safeNum(data.shootoutsWon, 0)}/${Fmt.safeNum(data.shootouts, 0)}</span></div>
                    <div class="flex justify-between text-gray-500"><span>${tx('本届', 'Current')}:</span> <span>${Fmt.safeNum(data.currentTournament?.shootoutsWon, 0)}/${Fmt.safeNum(data.currentTournament?.shootouts, 0)}</span></div>
                </div>`;
            };
            cardContent += renderSectionHeader(tx('点球大战能力', 'Penalty Shootout Skill'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderSide(tx('主队', 'Home'), sec.home)}
                ${renderSide(tx('客队', 'Away'), sec.away)}
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'referee') {
            cardContent += renderSectionHeader(tx('执法主裁判档案', 'Referee Profile'), sec);
            cardContent += `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] space-y-1 mt-1">
                <div class="flex justify-between"><span class="text-gray-400">${tx('主裁判', 'Referee')}:</span> <span class="font-semibold text-gray-200">${esc(sec.name || tx('未指派', 'Unassigned'))}</span></div>
                <div class="grid grid-cols-3 gap-1 text-center mt-1">
                    <div class="p-1 rounded bg-white/5"><div class="text-[9px] text-gray-500">${tx('场均黄牌', 'Yellows/M')}</div><div class="font-mono text-amber-400">${Fmt.safeNum(sec.yellowsPerMatch, 0)}</div></div>
                    <div class="p-1 rounded bg-white/5"><div class="text-[9px] text-gray-500">${tx('出示红牌', 'Reds Total')}</div><div class="font-mono text-red-400">${Fmt.safeNum(sec.redsTotal, 0)}</div></div>
                    <div class="p-1 rounded bg-white/5"><div class="text-[9px] text-gray-500">${tx('判罚点球', 'Pens Total')}</div><div class="font-mono text-purple-400">${Fmt.safeNum(sec.pensTotal, 0)}</div></div>
                </div>
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'superSubs') {
            const renderSubs = (sideLabel, data) => {
                const list = Array.isArray(data) ? data : (Array.isArray(data?.superSubs) ? data.superSubs : (Array.isArray(data?.list) ? data.list : []));
                const rows = list.map(s => {
                    const name = L(s.playerZh) || s.playerName || s.player || s.name || '';
                    const balance = s.goalsFor == null || s.goalsAgainst == null ? tx('待补事件', 'no timeline') : `${Fmt.safeNum(s.goalsFor, 0)}-${Fmt.safeNum(s.goalsAgainst, 0)}`;
                    return `<div class="text-[10px]"><div class="flex justify-between"><span class="text-gray-300">${esc(name)}</span><span class="font-mono text-emerald-400">${balance}</span></div><div class="text-[9px] text-gray-500">${Fmt.safeNum(s.appearances, 0)} ${tx('次登场', 'apps')} · ${Fmt.safeNum(s.goalsAfterSub, 0)}G ${Fmt.safeNum(s.assistsAfterSub, 0)}A</div></div>`;
                }).join('');
                return `<div class="p-1.5 rounded bg-white/[0.02]">
                    <div class="text-[10px] font-semibold text-gray-400 mb-1">${sideLabel}</div>
                    ${rows || `<div class="text-[10px] text-gray-500">${tx('无显著数据', 'None')}</div>`}
                </div>`;
            };
            cardContent += renderSectionHeader(tx('超级替补威胁', 'Super Sub Impact'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderSubs(tx('主队', 'Home'), sec.home)}
                ${renderSubs(tx('客队', 'Away'), sec.away)}
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'starForm') {
            const renderForm = (sideLabel, list) => {
                const rows = (list || []).map(s => {
                    const trendIcon = s.trend === 'up' ? '🔥' : s.trend === 'down' ? '❄️' : '➖';
                    return `<div class="flex justify-between text-[10px]"><span class="text-gray-300">${trendIcon} ${esc(s.player)}</span><span class="font-mono text-gray-400">${Fmt.safeNum(s.last3GA, 0)} GA</span></div>`;
                }).join('');
                return `<div class="p-1.5 rounded bg-white/[0.02]">
                    <div class="text-[10px] font-semibold text-gray-400 mb-1">${sideLabel}</div>
                    ${rows || `<div class="text-[10px] text-gray-500">${tx('无显著波动', 'Stable')}</div>`}
                </div>`;
            };
            cardContent += renderSectionHeader(tx('核心球星近况', 'Star Form Index'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderForm(tx('主队', 'Home'), sec.home)}
                ${renderForm(tx('客队', 'Away'), sec.away)}
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'styleMatchup') {
            const tagLabel = tag => ({
                observed_possession_high: tx('观测到的高控球', 'Observed high possession'),
                observed_possession_low: tx('观测到的低控球', 'Observed low possession'),
            }[tag] || tag);
            const renderFacts = (sideLabel, data) => {
                if (!data) return `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] text-gray-500">${sideLabel}: ${tx('未找到可追溯事实', 'No traceable facts found')}</div>`;
                const facts = data.facts || {};
                const formations = Object.entries(facts.formations || {}).map(([name, count]) => `${name} ×${count}`).join(' · ') || tx('未覆盖', 'Not covered');
                const possession = facts.possession?.status === 'covered' ? `${facts.possession.average}% (${facts.possession.sampleMatches} ${tx('场', 'matches')})` : tx('未覆盖', 'Not covered');
                const corners = facts.setPieces?.status === 'covered' ? `${facts.setPieces.cornersFor ?? '—'} / ${facts.setPieces.cornersAgainst ?? '—'}` : tx('未覆盖', 'Not covered');
                const subs = facts.substitutions?.total != null ? `${facts.substitutions.total} (${(facts.substitutions.minutes || []).join(', ') || '—'}')` : tx('未覆盖', 'Not covered');
                const discipline = facts.discipline ? `${facts.discipline.yellow || 0} ${tx('黄', 'Y')} · ${facts.discipline.red || 0} ${tx('红', 'R')}` : tx('未覆盖', 'Not covered');
                const tags = (data.derivedTags || []).map(tagLabel).join(' · ') || tx('无最终标签', 'No final tag');
                const unsupported = Object.entries(facts.unsupported || {}).map(([key, value]) => `${key}: ${value.status === 'not_covered' ? tx('未覆盖', 'Not covered') : value.status}`).join(' · ');
                return `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] space-y-1">
                    <div class="font-semibold text-gray-400">${sideLabel}</div>
                    <div class="flex justify-between gap-2"><span class="text-gray-500">${tx('阵型/场次', 'Formations / matches')}</span><span class="text-gray-300 text-right">${esc(formations)} · ${data.sampleMatches || 0}</span></div>
                    <div class="flex justify-between gap-2"><span class="text-gray-500">${tx('首发变化', 'XI changes')}</span><span class="font-mono text-gray-300">${data.facts.startingXIChanges ?? '—'}</span></div>
                    <div class="flex justify-between gap-2"><span class="text-gray-500">${tx('换人分钟', 'Substitution minutes')}</span><span class="text-gray-300 text-right">${esc(subs)}</span></div>
                    <div class="flex justify-between gap-2"><span class="text-gray-500">${tx('平均控球', 'Avg possession')}</span><span class="font-mono text-gray-300">${esc(possession)}</span></div>
                    <div class="flex justify-between gap-2"><span class="text-gray-500">${tx('角球 (得/失)', 'Corners (for/against)')}</span><span class="font-mono text-gray-300">${esc(corners)}</span></div>
                    <div class="flex justify-between gap-2"><span class="text-gray-500">${tx('纪律', 'Discipline')}</span><span class="font-mono text-gray-300">${esc(discipline)}</span></div>
                    <div><span class="text-gray-500">${tx('最终标签', 'Final tags')}:</span> <span class="text-cyan-300">${esc(tags)}</span></div>
                    <div class="text-gray-600">${tx('压迫/反击/推进', 'Pressing/counterplay/progression')}: ${esc(unsupported || tx('未覆盖', 'Not covered'))}</div>
                </div>`;
            };
            cardContent += renderSectionHeader(tx('战术观察与资料对照', 'Tactical observation & evidence'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">${renderFacts(tx('主队', 'Home'), sec.homeFacts)}${renderFacts(tx('客队', 'Away'), sec.awayFacts)}</div>`;
            cardContent += `<div class="text-[10px] text-amber-300/80 mt-1 leading-snug">${tx('仅展示可追溯事实；规则资格 = 否，OOS 校验 = 未运行，永远 info only。', 'Traceable facts only; rule eligibility = no, OOS validation = not run, always info only.')}</div>`;
            cardContent += renderNote(sec);
        } else if (key === 'familiarity') {
            cardContent += renderSectionHeader(tx('俱乐部联系与熟人', 'Club Familiarity'), sec);
            cardContent += `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] space-y-1 mt-1">
                <div class="flex justify-between"><span class="text-gray-400">${tx('跨队队友关系', 'Cross-team Pairs')}:</span> <span class="font-mono text-gray-200">${Fmt.safeNum(sec.crossTeamPairs, 0)}</span></div>
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'gameState') {
            const renderGS = (sideLabel, data) => {
                if (!data) return '';
                return `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] space-y-0.5">
                    <div class="font-semibold text-gray-400">${sideLabel}</div>
                    <div class="flex justify-between"><span class="text-gray-500">${tx('逆风追分率', 'Comeback Rate')}:</span> <span class="font-mono text-gray-200">${Math.round(Fmt.safeNum(data.comebackRate, 0) * 100)}%</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">${tx('领先守成率', 'Lead Hold Rate')}:</span> <span class="font-mono text-gray-200">${Math.round(Fmt.safeNum(data.leadHoldRate, 0) * 100)}%</span></div>
                </div>`;
            };
            cardContent += renderSectionHeader(tx('顺逆风战力画像', 'Game State Resilience'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderGS(tx('主队', 'Home'), sec.home)}
                ${renderGS(tx('客队', 'Away'), sec.away)}
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'experience') {
            const renderExp = (sideLabel, data) => {
                if (!data) return '';
                const all = data.allTime || null;
                return `<div class="p-1.5 rounded bg-white/[0.02] text-[10px] space-y-0.5">
                    <div class="font-semibold text-gray-400">${sideLabel}</div>
                    <div class="text-gray-500">${tx('本届', 'Current')}: <span class="font-mono text-gray-200">${Fmt.safeNum(data.matchesPlayed, 0)}M · ${Fmt.safeNum(data.goals, 0)}G · ${Fmt.safeNum(data.assists, 0)}A</span></div>
                    ${all ? `<div class="text-gray-500">${tx('世界杯历史累计', 'World Cup all-time')}: <span class="font-mono text-gray-200">${Fmt.safeNum(all.matchesPlayed, 0)}M · ${Fmt.safeNum(all.goals, 0)}G</span></div>
                    <div class="text-gray-500">${tx('加时/点球（下限）', 'ET/pens (lower bound)')}: <span class="font-mono text-gray-200">${all.wentToEt ? tx('是', 'yes') : tx('未确认', 'unconfirmed')} / ${all.decidedByPens ? tx('是', 'yes') : tx('否', 'no')}</span></div>` : ''}
                </div>`;
            };
            cardContent += renderSectionHeader(tx('大赛淘汰赛底蕴', 'Tournament Experience'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderExp(tx('主队', 'Home'), sec.home)}
                ${renderExp(tx('客队', 'Away'), sec.away)}
            </div>`;
            cardContent += renderNote(sec);
        } else if (key === 'lessons') {
            const renderLessons = (sideLabel, list) => {
                const rows = (list || []).map(item => {
                    const legacyUnavailable = getLang() === 'en' && item?.legacySingleLanguage === 'zh';
                    const text = legacyUnavailable ? tx('历史复盘仅提供中文', 'English version unavailable for this historical review') : L(item);
                    return `<div class="text-[10px] text-gray-300 leading-snug">• ${text}</div>`;
                }).join('');
                return `<div class="p-1.5 rounded bg-white/[0.02]">
                    <div class="text-[10px] font-semibold text-gray-400 mb-1">${sideLabel}</div>
                    ${rows || `<div class="text-[10px] text-gray-500">${tx('无历史教训记录', 'No records')}</div>`}
                </div>`;
            };
            cardContent += renderSectionHeader(tx('既往淘汰赛复盘教训', 'Lessons Learned'), sec);
            cardContent += `<div class="grid grid-cols-2 gap-2 mt-1">
                ${renderLessons(tx('主队', 'Home'), sec.home)}
                ${renderLessons(tx('客队', 'Away'), sec.away)}
            </div>`;
            cardContent += renderNote(sec);
        } else {
            cardContent += renderSectionHeader(esc(key), sec);
            cardContent += renderNote(sec);
        }

        cardsHtml += `<div class="elo-card">${cardContent}</div>`;
    });

    return `<div class="pred-section">
        <div class="pred-section-title text-purple-400">
            <span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">⚡</span>
            ${tx('淘汰赛赛前情报', 'Knockout Intelligence')}
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 ml-2 font-mono">${roundText}</span>
        </div>
        <div class="space-y-2 mt-1">
            ${cardsHtml}
        </div>
    </div>`;
}

    // Export to namespace
    MR.renderKnockoutIntel = renderKnockoutIntel;
})();
