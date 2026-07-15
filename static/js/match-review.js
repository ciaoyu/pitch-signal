/**
 * match-review.js — Match review/post-match analysis renderer
 * Extracted from app.js lines 4119-4414
 */
(function () {
    'use strict';
    const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
    const { tx } = window.WorldCup.Utils;
    const i18nText = (...a) => (window.WorldCup.I18n?.i18nText || ((o, f) => f))(...a);
    const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);

    function renderFrozenKnockoutComparison(review) {
        const uiLang = window.WorldCup.State?.uiLang || 'zh';
        const snapshot = review.predictionSnapshot;
        const intel = snapshot?.payload?.knockoutIntel;
        const sections = intel?.sections;
        const actualEvents = [
            ...(Array.isArray(review.keyEvents) ? review.keyEvents : []),
            ...(Array.isArray(review.evidence?.events) ? review.evidence.events : []),
        ];
        const eventText = event => typeof event === 'string' ? event : i18nText(event?.textI18n, event?.text || event?.summary || event?.description || '');
        const eventSearchText = event => typeof event === 'string'
            ? event
            : [event?.textI18n?.zh, event?.textI18n?.en, event?.text, event?.summary, event?.description].filter(Boolean).join(' ');
        const factRows = actualEvents
            .filter(event => /goal|yellow|red|card|substitution|penalty|extra time|加时|点球|进球|黄牌|红牌|换人/i.test(eventSearchText(event)) || /goal|card|substitution/i.test(String(event?.type || '')))
            .slice(0, 12)
            .map(event => `${event?.minute || ''} ${eventText(event)}`.trim());
        const actual = review.match || {};
        const lineups = review.postMatchFacts || {};
        const style = sections?.styleMatchup;
        const sourceNote = style && (style.usedInModel === false || style.source === 'tactical-style-matrix')
            ? tx('事实观测仅供参考，info only，不进入胜率模型；未完成 OOS 校验前不触发对位规则。', 'Observed facts are info only and stay out of win probabilities; no matchup rule runs before OOS validation.')
            : '';

        let left = '';
        if (!sections) {
            left = `<div class="text-[11px] text-gray-500">${tx('缺少赛前快照，不能在赛后补算成赛前情报。仅接受发布时间早于开球且带原始链接的外部存档补充。', 'No pre-match snapshot: do not reconstruct pre-match intelligence after the result. Only externally archived, linked material published before kickoff may be added.')}</div>`;
        } else {
            const tags = value => (value || []).map(tag => ({
                possession: { zh: '控球主导', en: 'Possession-led' },
                counter_fast: { zh: '快速反击', en: 'Fast counter-attacks' },
                high_press: { zh: '高位逼抢', en: 'High press' },
                low_block: { zh: '低位防守', en: 'Low block' },
                crossing: { zh: '传中/定位球', en: 'Crosses/set pieces' },
                observed_possession_high: { zh: '观测到的高控球', en: 'Observed high possession' },
                observed_possession_low: { zh: '观测到的低控球', en: 'Observed low possession' },
            }[tag] || { zh: tag, en: tag })).map(tag => i18nText(tag, '')).join(' · ') || tx('覆盖不足', 'Insufficient coverage');
            const confidence = value => ({ low: tx('低', 'Low'), medium: tx('中', 'Medium'), high: tx('高', 'High') }[value] || value || tx('低', 'Low'));
            left += `<div class="space-y-2 text-[11px]">`;
            if (style) left += `<div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('风格对垒', 'Style matchup')} <span class="text-[9px] text-gray-600">${esc(confidence(style.confidence))}</span></div><div class="text-gray-400 mt-1">${tx('主队', 'Home')}: ${esc(tags(style.homeTags))}<br>${tx('客队', 'Away')}: ${esc(tags(style.awayTags))}</div><div class="text-[9px] text-gray-600 mt-1">${sourceNote}</div></div>`;
            const frozenReason = comparison => {
                if (comparison?.reasonI18n) return i18nText(comparison.reasonI18n, comparison.reason || '');
                const legacy = {
                    'Bench outcomes roughly level': {zh:'双方替补登场后的比赛影响大致相当',en:'Bench outcomes roughly level'},
                    'Bench strength roughly level': {zh:'双方替补席实力大致相当',en:'Bench strength roughly level'},
                    'Home bench produced the stronger post-substitution goal balance': {zh:'主队替补登场后的进球净影响更强',en:'Home bench produced the stronger post-substitution goal balance'},
                    'Away bench produced the stronger post-substitution goal balance': {zh:'客队替补登场后的进球净影响更强',en:'Away bench produced the stronger post-substitution goal balance'},
                    'Elo and experience roughly level': {zh:'双方 Elo 与点球经验大致相当',en:'Elo and experience roughly level'},
                    'Home side shows clear advantage in Elo/defence/shootout experience': {zh:'主队在 Elo、防守与点球大战经验上优势明显',en:'Home side shows clear advantage in Elo/defence/shootout experience'},
                    'Home side shows slight advantage in Elo/defence/shootout experience': {zh:'主队在 Elo、防守与点球大战经验上略占优势',en:'Home side shows slight advantage in Elo/defence/shootout experience'},
                    'Away side shows clear advantage in Elo/defence/shootout experience': {zh:'客队在 Elo、防守与点球大战经验上优势明显',en:'Away side shows clear advantage in Elo/defence/shootout experience'},
                    'Away side shows slight advantage in Elo/defence/shootout experience': {zh:'客队在 Elo、防守与点球大战经验上略占优势',en:'Away side shows slight advantage in Elo/defence/shootout experience'},
                };
                return i18nText(legacy[comparison?.reason], comparison?.reason || tx('无可比较结论', 'No comparable conclusion'));
            };
            if (sections.superSubs) left += `<div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('替补影响预览', 'Bench preview')}</div><div class="text-gray-500 mt-1">${esc(frozenReason(sections.superSubs.comparison))}</div></div>`;
            if (sections.penalty) left += `<div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('点球情报', 'Penalty context')}</div><div class="text-gray-500 mt-1">${esc(frozenReason(sections.penalty.comparison))}</div></div>`;
            if (sections.experience) left += `<div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('淘汰赛经历', 'Knockout experience')}</div><div class="text-gray-500 mt-1">${esc(i18nText(sections.experience.note, ''))}</div></div>`;
            left += `<div class="text-[9px] text-gray-600">${tx('以上内容读取的是开球前冻结快照，赛后不重算。', 'This column reads the kickoff-frozen snapshot and is never recomputed after the match.')}</div></div>`;
        }

        const score = `${actual.homeScore ?? actual.home?.score ?? '—'} : ${actual.awayScore ?? actual.away?.score ?? '—'}`;
        const playerName = player => uiLang === 'en' ? (player.name || player.nameZh || '') : (player.nameZh || player.name || '');
        const xi = team => (team || []).map(playerName).join(uiLang === 'en' ? ', ' : '、');
        const subs = (lineups.substitutions || []).map(sub => `${sub.minute || '?'} ${uiLang === 'en' ? (sub.offName || sub.offNameZh) : (sub.offNameZh || sub.offName)} → ${uiLang === 'en' ? (sub.onName || sub.onNameZh) : (sub.onNameZh || sub.onName)}`).join('<br>');
        const right = `<div class="space-y-2 text-[11px]"><div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('最终比分', 'Final score')}</div><div class="text-gray-400 mt-1">${esc(score)}</div></div><div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('实际首发', 'Starting XI')}</div><div class="text-gray-500 mt-1">${lineups.hasRealLineups ? `${esc(xi(lineups.homeXI))}<br>${esc(xi(lineups.awayXI))}` : tx('本接口未返回可验证首发：本场无法验证。', 'No verified starting XI returned: cannot verify this match.')}</div></div><div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('实际换人', 'Substitutions')}</div><div class="text-gray-500 mt-1">${subs || tx('本接口未返回可验证换人：本场无法验证。', 'No verified substitutions returned: cannot verify this match.')}</div></div><div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('红黄牌、加时与点球', 'Cards, extra time & penalties')}</div><div class="text-gray-500 mt-1">${factRows.filter(row => /yellow|red|card|penalty|extra time|加时|点球|黄牌|红牌/i.test(row)).map(esc).join('<br>') || tx('本接口未返回可验证记录：本场无法验证。', 'No verifiable record was returned: cannot verify this match.')}</div></div><div class="bg-white/5 rounded-lg p-2"><div class="font-bold text-gray-300">${tx('关键事件', 'Key events')}</div><div class="text-gray-500 mt-1">${factRows.filter(row => /goal|进球/i.test(row)).map(esc).join('<br>') || tx('本接口未返回可验证记录：本场无法验证。', 'No verifiable record was returned: cannot verify this match.')}</div></div></div>`;
        return `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-300 mb-2">🧊 ${tx('赛前淘汰赛情报与赛后事实对照', 'Frozen pre-match intelligence vs post-match facts')}</div><div class="grid grid-cols-1 md:grid-cols-2 gap-2"><div><div class="text-[10px] font-bold text-cyan-300 mb-1.5">${tx('赛前淘汰赛情报（冻结快照）', 'Pre-match knockout intelligence (frozen snapshot)')}</div>${left}</div><div><div class="text-[10px] font-bold text-amber-300 mb-1.5">${tx('赛后事实与验证', 'Post-match facts & verification')}</div>${right}</div></div></div>`;
    }

    function renderMatchReview(review) {
        if (!review || review.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('比赛回顾加载失败', 'Match review failed to load')}</div>`;
        const match = review.match || {}, ai = review.aiPrediction || {}, bias = review.biasAnalysis || {};
        const summary = review.matchSummary || {}, eloChange = review.eloChange || {};
        const factors = bias.factors || [], aiPostmortem = review.aiPostmortem || {};
        const liveTimeline = review.liveTimelineI18n || [];
        const uiLang = window.WorldCup.State?.uiLang || 'zh';
        const pmLang = uiLang === 'zh' ? 'zh' : 'en';
        const pmArr = (f, l) => (f && Array.isArray(f[pmLang]) ? f[pmLang] : (l || []));
        const postmortemItems = [...pmArr(aiPostmortem.whyRightI18n, aiPostmortem.whyRight), ...pmArr(aiPostmortem.whyWrongI18n, aiPostmortem.whyWrong), ...pmArr(aiPostmortem.processNotesI18n, aiPostmortem.processNotes)].slice(0, 4);
        const pmHeadline = i18nText(aiPostmortem.headlineI18n, aiPostmortem.headline || '');
        const postmortemRaw = [pmHeadline, ...postmortemItems].join(' ');
        const aiGenerated = aiPostmortem.status === 'completed' && (pmHeadline || postmortemItems.length > 0);
        const hasLocalizedPostmortem = uiLang === 'zh'
            ? Boolean(aiPostmortem.headlineI18n?.zh || postmortemItems.length)
            : Boolean(aiPostmortem.headlineI18n?.en || postmortemItems.length);
        const evidence = review.evidence || {};
        const predictionSource = review.predictionSource || 'pre_match';
        const predictionSnapshotNote = review.predictionSnapshotNote || null;
        const isRetrospective = predictionSource === 'retrospective';
        const momentum = review.momentum || {};
        const momentumBuckets = momentum.buckets || [];
        const momentumScript = momentum.matchScript || 'unknown';
        const momentumNotes = momentum.notes || [];
        const hasValue = v => v !== undefined && v !== null && v !== '';
        const displayValue = (v, fb = '?') => hasValue(v) ? v : fb;
        const displayPct = v => hasValue(v) ? `${v}%` : '—';
        const firstValue = (...vs) => { const f = vs.find(hasValue); return f === undefined ? undefined : f; };
        const scoreHome = firstValue(match.home?.score, match.homeScore);
        const scoreAway = firstValue(match.away?.score, match.awayScore);
        const regulationHome = firstValue(match.regulationScore?.home, scoreHome);
        const regulationAway = firstValue(match.regulationScore?.away, scoreAway);
        const wentToExtraTime = Boolean(match.wentToExtraTime);
        const matchTypeText = i18nText(summary.matchTypeI18n, summary.matchType || tx('已结束', 'Finished'));
        const overviewText = i18nText(summary.overviewI18n, summary.overview || '');
        const upsetText = i18nText(summary.upsetTextI18n, summary.upsetText || '');
        const biasSummary = i18nText(bias.summaryI18n, bias.summary || '');
        const sHN = Number(regulationHome), sAN = Number(regulationAway);
        const scoreColor = Number.isFinite(sHN) && Number.isFinite(sAN) ? (sHN > sAN ? 'green' : sHN < sAN ? 'red' : 'yellow') : 'yellow';
        const rawKE = Array.isArray(review.keyEvents) ? review.keyEvents : [];
        const rawEE = Array.isArray(evidence.events) ? evidence.events : [];
        const seenTexts = new Set(rawKE.map(e => typeof e === 'string' ? e : (e?.text || '')));
        const events = [...rawKE, ...rawEE.filter(e => { const t = typeof e === 'string' ? e : (e?.text || ''); if (!t || seenTexts.has(t)) return false; seenTexts.add(t); return true; })];

        let html = `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-start gap-2.5"><span class="text-lg mt-0.5">📋</span><div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1"><span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-${['dominant_win','goal_fest'].includes(summary.matchTypeKey)||summary.matchType==='碾压大胜'||summary.matchType==='进球大战'?'yellow':'blue'}-400">${matchTypeText}</span><span class="text-[11px] text-gray-500">${match.group||''}</span></div><div class="text-xs text-gray-400 leading-relaxed">${overviewText}</div>${upsetText?`<div class="text-[11px] font-bold text-yellow-400 mt-1">⚡ ${upsetText}</div>`:''}</div></div></div>`;

        if (isRetrospective && predictionSnapshotNote) {
            html += `<div class="glass rounded-xl p-3 mb-2.5 border border-yellow-500/20 bg-yellow-500/5"><div class="flex items-start gap-2"><span class="text-sm mt-0.5">⚠️</span><div class="text-[11px] text-yellow-300 leading-relaxed">${esc(i18nText(predictionSnapshotNote, predictionSnapshotNote.en||''))}</div></div></div>`;
        }

        html += renderFrozenKnockoutComparison(review);

        html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">🤖 ${tx('AI 预测 vs 真实结果','AI Forecast vs Actual Result')}${isRetrospective?` <span class="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 align-middle">${tx('赛后参考','retro')}</span>`:''}</div><div class="grid grid-cols-2 gap-2"><div class="bg-white/5 rounded-lg p-2.5 text-center"><div class="text-[11px] text-gray-500 mb-1">${tx('AI 预测（90分钟）','AI Forecast (90 min)')}</div><div class="text-xl font-bold text-blue-400">${ai.predictedScore||tx('缺快照','No snapshot')}</div><div class="text-[11px] text-gray-500 mt-1">${tx('主','Home')} ${displayPct(ai.homeWin)} · ${tx('平','Draw')} ${displayPct(ai.draw)} · ${tx('客','Away')} ${displayPct(ai.awayWin)}</div><div class="text-[11px] text-gray-600">xG ${displayValue(ai.homeExpectedGoals,'-')} - ${displayValue(ai.awayExpectedGoals,'-')}</div>${review.predictionSourceNote?`<div class="text-[10px] text-amber-300 mt-1">${esc(review.predictionSourceNote)}</div>`:''}</div><div class="bg-white/5 rounded-lg p-2.5 text-center"><div class="text-[11px] text-gray-500 mb-1">${tx('常规时间结果','Regulation Result')}</div><div class="text-xl font-bold text-${scoreColor}-400">${displayValue(regulationHome)} : ${displayValue(regulationAway)}</div>${wentToExtraTime?`<div class="text-[10px] text-amber-300 mt-1">${tx('加时后最终比分','Final after extra time')} ${displayValue(scoreHome)} : ${displayValue(scoreAway)}</div>`:''}<div class="text-[11px] text-gray-500 mt-1">${displayMaybeTeamName(match.homeNameI18n||match.home||'')} vs ${displayMaybeTeamName(match.awayNameI18n||match.away||'')}</div><div class="text-[11px] text-gray-600">${match.date||''}</div></div></div>`;
        const accCls = bias.accuracy==='highly_accurate'||bias.accuracy==='exact_score'?'text-green-400 bg-green-500/10':bias.accuracy==='result_correct_score_wrong'?'text-yellow-400 bg-yellow-500/10':bias.accuracy==='regulation_draw_advancer_correct'?'text-sky-400 bg-sky-500/10':'text-red-400 bg-red-500/10';
        const accLabel = bias.accuracy==='highly_accurate'||bias.accuracy==='exact_score'?`🟢 ${tx('精准命中','Accurate')}`:bias.accuracy==='result_correct_score_wrong'?`🟡 ${tx('比分偏差','Score off')}`:bias.accuracy==='regulation_draw_advancer_correct'?`🔵 ${tx('命中晋级方','Advancer hit')}`:bias.accuracy==='wrong_result'?`🔴 ${tx('结果错误','Wrong result')}`:`⚪ ${tx('未知','Unknown')}`;
        html += `<div class="mt-2.5 pt-2.5 border-t border-white/5"><div class="flex items-center justify-between"><span class="text-[11px] font-bold ${accCls} px-2 py-0.5 rounded-md">${accLabel}</span><span class="text-[11px] text-gray-500">${tx('预测置信','Forecast Confidence')} ${bias.predictedConfidence||0}%</span></div><div class="text-[11px] text-gray-400 mt-1">${biasSummary}</div><div class="text-[9px] text-gray-600 mt-1">${tx('"精准命中 / 比分偏差 / 结果错误"仅为本场预测与结果的对比，不代表模型整体准确率。','"Accurate / Score off / Wrong result" compares this match only and does not represent overall model accuracy.')}</div></div></div>`;

        if (factors.length > 0) {
            html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">🔍 ${tx('偏差因素分析','Bias Factors')}</div><div class="space-y-1.5">`;
            for (const f of factors) {
                const impCls = f.impact==='high'?'border-red-500/20 bg-red-500/5':f.impact==='medium'?'border-yellow-500/20 bg-yellow-500/5':'border-gray-500/20 bg-gray-500/5';
                const dotCls = f.impact==='high'?'bg-red-500':f.impact==='medium'?'bg-yellow-500':'bg-gray-500';
                html += `<div class="border ${impCls} rounded-lg p-2"><div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${dotCls} shrink-0"></span><span class="text-[11px] font-bold text-gray-300">${i18nText(f.factorI18n||f.nameI18n,f.factor||f.name||'')}</span><span class="text-[9px] text-gray-500 ml-auto uppercase">${f.impact||''}</span></div><div class="text-[11px] text-gray-400 mt-0.5 ml-3">${i18nText(f.detailI18n,f.detail||'')}</div></div>`;
            }
            html += '</div></div>';
        }

        if (liveTimeline.length > 0) {
            html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-center justify-between mb-2"><div class="text-xs font-bold text-gray-400">🕒 ${tx('实时时间线','Live Timeline')}</div><span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">${liveTimeline.length}</span></div><div class="space-y-1.5">`;
            for (const item of liveTimeline) {
                const label = i18nText(item.titleI18n, item.title || '');
                const summary = i18nText(item.summaryI18n, item.summary || '');
                html += `<div class="bg-white/5 rounded-lg p-2.5 border border-white/5"><div class="flex items-center gap-2 mb-1"><span class="text-[10px] font-mono text-gray-500">${displayValue(item.minute,'')}</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold">${esc(label)}</span><span class="text-[10px] text-gray-600 ml-auto">${esc(item.score || '')}</span></div><div class="text-[11px] text-gray-300 leading-relaxed">${esc(summary)}</div></div>`;
            }
            html += `</div></div>`;
        }

        if (momentumScript !== 'unknown' || momentumBuckets.length > 0) {
            const sl = { comeback:{zh:'逆转',en:'Comeback',cls:'bg-orange-500/15 text-orange-400 border-orange-500/20',icon:'🔄'}, control_win:{zh:'控场胜',en:'Control Win',cls:'bg-green-500/15 text-green-400 border-green-500/20',icon:'🎯'}, smash_and_grab:{zh:'偷袭',en:'Smash & Grab',cls:'bg-red-500/15 text-red-400 border-red-500/20',icon:'🥷'}, collapse:{zh:'崩盘',en:'Collapse',cls:'bg-red-500/15 text-red-400 border-red-500/20',icon:'📉'}, even:{zh:'僵持',en:'Even',cls:'bg-gray-500/15 text-gray-400 border-gray-500/20',icon:'⚖️'} };
            const script = sl[momentumScript]||{zh:momentumScript,en:momentumScript,cls:'bg-gray-500/15 text-gray-400 border-gray-500/20',icon:'❓'};
            html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-center justify-between mb-2.5"><div class="text-xs font-bold text-gray-400">📊 ${tx('比赛动量','Match Momentum')}</div><span class="text-[10px] px-1.5 py-0.5 rounded-full border ${script.cls}">${script.icon} ${i18nText({zh:script.zh,en:script.en},script.en)}</span></div>`;
            if (momentumBuckets.length > 0) {
                const maxShots = Math.max(1, ...momentumBuckets.map(b => Math.max(b.homeShots||0,b.awayShots||0)));
                html += `<div class="space-y-1">`;
                for (const b of momentumBuckets) {
                    const hW = Math.round(((b.homeShots||0)/maxShots)*100), aW = Math.round(((b.awayShots||0)/maxShots)*100);
                    html += `<div class="flex items-center gap-1.5 text-[10px]"><span class="w-10 text-right text-gray-500 shrink-0">${b.window||''}'</span><div class="flex-1 flex items-center gap-0.5"><div class="flex justify-end flex-1"><div class="h-3 rounded-sm bg-blue-500/40" style="width:${hW}%"></div></div><span class="text-gray-500 w-5 text-center shrink-0">${b.homeShots||0}-${b.awayShots||0}</span><div class="flex justify-start flex-1"><div class="h-3 rounded-sm bg-red-500/40" style="width:${aW}%"></div></div></div><span class="text-gray-500 w-12 text-left shrink-0">${(b.goals||0)>0?' ⚽'.repeat(b.goals):''}</span></div>`;
                }
                html += `</div><div class="flex justify-between text-[9px] text-gray-600 mt-1.5"><span>${tx('主队射门','Home shots')}</span><span>H-A</span><span>${tx('客队射门','Away shots')}</span></div>`;
            }
            if (momentumNotes.length > 0) {
                html += `<div class="mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 space-y-0.5">`;
                for (const note of momentumNotes.slice(0,3)) {
                    const noteText = typeof note==='object'&&note!==null?tx(note.zh,note.en):String(note);
                    html += `<div class="leading-relaxed">💡 ${noteText}</div>`;
                }
                html += `</div>`;
            }
            html += '</div>';
        }

        if (eloChange.homeBefore != null) {
            const hD = eloChange.homeChange||0, aD = eloChange.awayChange||0;
            html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">⚡ ${tx('Elo 评分变化','Elo Rating Change')}</div><div class="grid grid-cols-2 gap-2"><div class="bg-white/5 rounded-lg p-2"><div class="flex items-center justify-between"><span class="text-[11px] font-bold">${displayMaybeTeamName(match.homeNameI18n||match.home||'')}</span><span class="text-[11px] font-mono font-bold ${hD>0?'text-green-400':hD<0?'text-red-400':'text-gray-400'}">${hD>0?'+':''}${hD}</span></div><div class="text-[11px] text-gray-500 mt-1">${eloChange.homeBefore} → <span class="text-white font-bold">${eloChange.homeAfter}</span></div></div><div class="bg-white/5 rounded-lg p-2"><div class="flex items-center justify-between"><span class="text-[11px] font-bold">${displayMaybeTeamName(match.awayNameI18n||match.away||'')}</span><span class="text-[11px] font-mono font-bold ${aD>0?'text-green-400':aD<0?'text-red-400':'text-gray-400'}">${aD>0?'+':''}${aD}</span></div><div class="text-[11px] text-gray-500 mt-1">${eloChange.awayBefore} → <span class="text-white font-bold">${eloChange.awayAfter}</span></div></div></div><div class="text-[11px] text-gray-600 mt-1.5 flex items-center gap-2"><span>${tx('预期胜率','Expected Win Rate')}: ${Math.round((eloChange.expectedHome||0)*100)}% / ${Math.round((eloChange.expectedAway||0)*100)}%</span><span>${tx('比分加成','Score Multiplier')}: x${(eloChange.goalDiffMultiplier||1).toFixed(2)}</span></div></div>`;
        }

        if (events.length > 0) {
            html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">🎬 ${tx('关键事件','Key Events')}</div><div class="space-y-1">`;
            for (const evt of events) {
                const ne = typeof evt==='string'?{text:evt}:(evt||{});
                const eTxt = i18nText(ne.textI18n, firstValue(ne.text,ne.description,ne.title,ne.event,ne.summary,''));
                const eClr = ne.type==='goal'?'bg-green-500/15 text-green-400':ne.type==='highlight'?'bg-yellow-500/10 text-yellow-400':'bg-blue-500/10 text-blue-400';
                const eIco = ne.type==='goal'?'⚽':ne.type==='highlight'?'⭐':'💡';
                html += `<div class="flex items-start gap-2 py-1"><span class="text-[11px] font-mono text-gray-600 shrink-0 w-8 text-right">${displayValue(ne.minute,'')}</span><span class="${eClr} px-1.5 py-0.5 rounded text-[11px] shrink-0">${eIco}</span><span class="text-[11px] text-gray-300">${esc(eTxt)}</span>${hasValue(ne.score)?`<span class="text-[11px] font-mono font-bold text-white ml-auto shrink-0">${esc(ne.score)}</span>`:''}</div>`;
            }
            html += '</div></div>';
        }

        html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-center justify-between mb-2"><div class="text-xs font-bold text-purple-400">🧠 ${tx('AI 赛后复盘（实验性）','AI Post-match Review (Experimental)')}</div><span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">${aiPostmortem.status||'pending_provider'}</span></div>${(aiPostmortem.headline||aiPostmortem.headlineI18n)?`<div class="text-xs font-bold text-white mb-1">${i18nText(aiPostmortem.headlineI18n,aiPostmortem.headline||'')} ${!hasLocalizedPostmortem?`<span class="text-[9px] text-yellow-500 font-normal ml-1">(${tx('未返回中文','English version unavailable')})</span>`:''}</div>`:`<div class="text-[11px] text-gray-500 mb-1">${tx('AI 赛后复盘正在生成中...','Waiting for expert commentary/news evidence before AI attribution')}</div>`}<div class="grid grid-cols-3 gap-1.5 text-[10px] text-gray-500 mb-2"><div class="bg-white/5 rounded p-1.5 text-center">${tx('事件','Events')} ${evidence.events?.length||0}</div><div class="bg-white/5 rounded p-1.5 text-center">${tx('新闻','News')} ${evidence.news?.length||0}</div><div class="bg-white/5 rounded p-1.5 text-center">${tx('评论','Commentary')} ${evidence.commentary?.length||0}</div></div>${postmortemItems.length>0?postmortemItems.map(n=>`<div class="text-[11px] text-gray-300 border-l border-purple-400/30 pl-2 mb-1">${i18nText(n)}</div>`).join(''):''}</div>`;
        html += `<div class="text-center text-[9px] text-gray-700 mt-2">${tx('实验性赛后复盘：AI 自动生成内容可能不完整或存在误差，仅供参考。','Experimental post-match review: AI-generated content may be incomplete or inaccurate and is for reference only.')}</div>`;
        return html;
    }

    window.WorldCup.MatchReview = { renderMatchReview };
    Object.assign(window, { renderMatchReview });
})();
