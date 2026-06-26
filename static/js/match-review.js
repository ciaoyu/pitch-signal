/**
 * match-review.js — Match review/post-match analysis renderer
 * Extracted from app.js lines 4119-4414
 */
(function () {
    'use strict';
    const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
    const tx = (...a) => (window.WorldCup.I18n?.t || ((z, e) => e))(...a);
    const i18nText = (...a) => (window.WorldCup.I18n?.i18nText || ((o, f) => f))(...a);
    const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);

    function renderMatchReview(review) {
        if (!review || review.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('比赛回顾加载失败', 'Match review failed to load')}</div>`;
        const match = review.match || {}, ai = review.aiPrediction || {}, bias = review.biasAnalysis || {};
        const summary = review.matchSummary || {}, eloChange = review.eloChange || {};
        const factors = bias.factors || [], aiPostmortem = review.aiPostmortem || {};
        const uiLang = window.WorldCup.State?.uiLang || 'zh';
        const pmLang = uiLang === 'zh' ? 'zh' : 'en';
        const pmArr = (f, l) => (f && Array.isArray(f[pmLang]) ? f[pmLang] : (l || []));
        const postmortemItems = [...pmArr(aiPostmortem.whyRightI18n, aiPostmortem.whyRight), ...pmArr(aiPostmortem.whyWrongI18n, aiPostmortem.whyWrong), ...pmArr(aiPostmortem.processNotesI18n, aiPostmortem.processNotes)].slice(0, 4);
        const pmHeadline = i18nText(aiPostmortem.headlineI18n, aiPostmortem.headline || '');
        const postmortemRaw = [pmHeadline, ...postmortemItems].join(' ');
        const aiGenerated = aiPostmortem.status === 'completed' && (pmHeadline || postmortemItems.length > 0);
        const hasChinesePostmortem = uiLang !== 'zh' || Boolean(aiPostmortem.headlineI18n?.zh) || /[\u4e00-\u9fff]/.test(postmortemRaw) || aiGenerated;
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
        const matchTypeText = i18nText(summary.matchTypeI18n, summary.matchType || tx('已结束', 'Finished'));
        const overviewText = i18nText(summary.overviewI18n, summary.overview || '');
        const upsetText = i18nText(summary.upsetTextI18n, summary.upsetText || '');
        const biasSummary = i18nText(bias.summaryI18n, bias.summary || '');
        const sHN = Number(scoreHome), sAN = Number(scoreAway);
        const scoreColor = Number.isFinite(sHN) && Number.isFinite(sAN) ? (sHN > sAN ? 'green' : sHN < sAN ? 'red' : 'yellow') : 'yellow';
        const rawKE = Array.isArray(review.keyEvents) ? review.keyEvents : [];
        const rawEE = Array.isArray(evidence.events) ? evidence.events : [];
        const seenTexts = new Set(rawKE.map(e => typeof e === 'string' ? e : (e?.text || '')));
        const events = [...rawKE, ...rawEE.filter(e => { const t = typeof e === 'string' ? e : (e?.text || ''); if (!t || seenTexts.has(t)) return false; seenTexts.add(t); return true; })];

        let html = `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-start gap-2.5"><span class="text-lg mt-0.5">📋</span><div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1"><span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-${['dominant_win','goal_fest'].includes(summary.matchTypeKey)||summary.matchType==='碾压大胜'||summary.matchType==='进球大战'?'yellow':'blue'}-400">${matchTypeText}</span><span class="text-[11px] text-gray-500">${match.group||''}</span></div><div class="text-xs text-gray-400 leading-relaxed">${overviewText}</div>${upsetText?`<div class="text-[11px] font-bold text-yellow-400 mt-1">⚡ ${upsetText}</div>`:''}</div></div></div>`;

        if (isRetrospective && predictionSnapshotNote) {
            html += `<div class="glass rounded-xl p-3 mb-2.5 border border-yellow-500/20 bg-yellow-500/5"><div class="flex items-start gap-2"><span class="text-sm mt-0.5">⚠️</span><div class="text-[11px] text-yellow-300 leading-relaxed">${esc(i18nText(predictionSnapshotNote, predictionSnapshotNote.en||''))}</div></div></div>`;
        }

        html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">🤖 ${tx('AI 预测 vs 真实结果','AI Forecast vs Actual Result')}${isRetrospective?` <span class="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 align-middle">${tx('赛后参考','retro')}</span>`:''}</div><div class="grid grid-cols-2 gap-2"><div class="bg-white/5 rounded-lg p-2.5 text-center"><div class="text-[11px] text-gray-500 mb-1">${tx('AI 预测','AI Forecast')}</div><div class="text-xl font-bold text-blue-400">${ai.predictedScore||tx('缺快照','No snapshot')}</div><div class="text-[11px] text-gray-500 mt-1">${tx('主','Home')} ${displayPct(ai.homeWin)} · ${tx('平','Draw')} ${displayPct(ai.draw)} · ${tx('客','Away')} ${displayPct(ai.awayWin)}</div><div class="text-[11px] text-gray-600">xG ${displayValue(ai.homeExpectedGoals,'-')} - ${displayValue(ai.awayExpectedGoals,'-')}</div>${review.predictionSourceNote?`<div class="text-[10px] text-amber-300 mt-1">${esc(review.predictionSourceNote)}</div>`:''}</div><div class="bg-white/5 rounded-lg p-2.5 text-center"><div class="text-[11px] text-gray-500 mb-1">${tx('真实结果','Actual Result')}</div><div class="text-xl font-bold text-${scoreColor}-400">${displayValue(scoreHome)} : ${displayValue(scoreAway)}</div><div class="text-[11px] text-gray-500 mt-1">${displayMaybeTeamName(match.homeNameI18n||match.home||'')} vs ${displayMaybeTeamName(match.awayNameI18n||match.away||'')}</div><div class="text-[11px] text-gray-600">${match.date||''}</div></div></div>`;
        const accCls = bias.accuracy==='highly_accurate'||bias.accuracy==='exact_score'?'text-green-400 bg-green-500/10':bias.accuracy==='result_correct_score_wrong'?'text-yellow-400 bg-yellow-500/10':'text-red-400 bg-red-500/10';
        const accLabel = bias.accuracy==='highly_accurate'||bias.accuracy==='exact_score'?`🟢 ${tx('精准命中','Accurate')}`:bias.accuracy==='result_correct_score_wrong'?`🟡 ${tx('比分偏差','Score off')}`:bias.accuracy==='wrong_result'?`🔴 ${tx('结果错误','Wrong result')}`:`⚪ ${tx('未知','Unknown')}`;
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

        html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-center justify-between mb-2"><div class="text-xs font-bold text-purple-400">🧠 ${tx('AI 赛后复盘（实验性）','AI Post-match Review (Experimental)')}</div><span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">${aiPostmortem.status||'pending_provider'}</span></div>${(aiPostmortem.headline||aiPostmortem.headlineI18n)?`<div class="text-xs font-bold text-white mb-1">${i18nText(aiPostmortem.headlineI18n,aiPostmortem.headline||'')} ${!hasChinesePostmortem?`<span class="text-[9px] text-yellow-500 font-normal ml-1">(${tx('未返回中文','English Only')})</span>`:''}</div>`:`<div class="text-[11px] text-gray-500 mb-1">${tx('AI 赛后复盘正在生成中...','Waiting for expert commentary/news evidence before AI attribution')}</div>`}<div class="grid grid-cols-3 gap-1.5 text-[10px] text-gray-500 mb-2"><div class="bg-white/5 rounded p-1.5 text-center">${tx('事件','Events')} ${evidence.events?.length||0}</div><div class="bg-white/5 rounded p-1.5 text-center">${tx('新闻','News')} ${evidence.news?.length||0}</div><div class="bg-white/5 rounded p-1.5 text-center">${tx('评论','Commentary')} ${evidence.commentary?.length||0}</div></div>${postmortemItems.length>0?postmortemItems.map(n=>`<div class="text-[11px] text-gray-300 border-l border-purple-400/30 pl-2 mb-1">${i18nText(n)}</div>`).join(''):''}</div>`;
        html += `<div class="text-center text-[9px] text-gray-700 mt-2">${tx('实验性赛后复盘：AI 自动生成内容可能不完整或存在误差，仅供参考。','Experimental post-match review: AI-generated content may be incomplete or inaccurate and is for reference only.')}</div>`;
        return html;
    }

    window.WorldCup.MatchReview = { renderMatchReview };
    Object.assign(window, { renderMatchReview });
})();
