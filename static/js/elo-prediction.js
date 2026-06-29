/**
 * elo-prediction.js — Elo rankings, qualification probabilities, prediction cards
 * Extracted from app.js lines 2838-3113
 */
(function () {
    'use strict';

    const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
    const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
    const { tx } = window.WorldCup.Utils;
    const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
    const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
    const displayGroupName = (...a) => (window.WorldCup.I18n?.displayGroupName || ((x) => x))(...a);
    const Fmt = () => window.WorldCup.Fmt || window.WorldCup.Formatters || window.Fmt || {};

    // ── Build Elo rankings table HTML (reusable) ──
    function buildEloTable(rankings) {
        let h = '';
        h += `<div class="pred-section-title text-purple-400" style="font-family:'DM Sans',sans-serif">
            <span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs flex-shrink-0">⚡</span>${tx('Elo 实力排名', 'Elo Rankings')}
        </div>`;

        // Table header
        h += `<div style="display:grid;grid-template-columns:36px 1fr 70px 80px;gap:6px;align-items:center;padding:4px 8px;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,.04)">
            <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">#</span>
            <span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.15)">${esc(tx('球队','Team'))}</span>
            <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15);text-align:right">Elo</span>
            <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15);text-align:right">${esc(tx('出线','Qual.'))}</span>
        </div>`;

        rankings.slice(0, 10).forEach((t, i) => {
            const barWidth = Math.min(100, Math.max(5, Math.round((t.rating - 1400) / 6)));
            const prevRank = t.previousRank || t.prevRank || null;
            let changeHtml = '<span style="color:rgba(248,250,252,.15);font-size:10px">—</span>';
            if (prevRank && prevRank !== t.rank) {
                const diff = prevRank - t.rank;
                changeHtml = diff > 0 ? `<span style="color:#22c55e;font-size:10px;font-weight:600">▲${diff}</span>` : `<span style="color:#ef4444;font-size:10px;font-weight:600">▼${Math.abs(diff)}</span>`;
            } else if (t.change > 0) { changeHtml = `<span style="color:#22c55e;font-size:10px;font-weight:600">▲${t.change}</span>`; }
            else if (t.change < 0) { changeHtml = `<span style="color:#ef4444;font-size:10px;font-weight:600">▼${Math.abs(t.change)}</span>`; }

            const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : 'rgba(248,250,252,.25)';
            const eloFlag = t.flag || '🏳️';
            const qualifyPct = t.qualifyProb ? Math.round(t.qualifyProb * 100) : null;

            h += `<div style="display:grid;grid-template-columns:36px 1fr 70px 80px;gap:6px;align-items:center;padding:5px 8px;border-radius:6px;transition:background .15s" class="hover:bg-white/[0.03]">
                <span style="font:600 11px/1 'JetBrains Mono', monospace;color:${rankColor}">${t.rank}</span>
                <div style="display:flex;align-items:center;gap:6px;min-width:0">
                    <span style="font-size:14px;width:18px;flex-shrink:0;text-align:center">${eloFlag}</span>
                    <span style="font:500 12px/1 'Inter';color:#f8fafc;truncate;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(displayMaybeTeamName(t))}">${esc(displayMaybeTeamName(t))}</span>
                    ${changeHtml}
                </div>
                <div style="text-align:right">
                    <span style="font:500 12px/1 'JetBrains Mono', monospace;color:#a78bfa">${t.rating}</span>
                    <div style="height:3px;border-radius:2px;background:rgba(255,255,255,.06);margin-top:2px;overflow:hidden">
                        <div style="height:100%;border-radius:2px;background:linear-gradient(90deg,#059669,#34d399);width:${barWidth}%;transition:width .8s ease"></div>
                    </div>
                </div>
                <div style="text-align:right">
                    ${qualifyPct !== null ? `<span style="font:500 11px/1 'JetBrains Mono', monospace;color:${qualifyPct>=70?'#34d399':qualifyPct>=40?'#f59e0b':'rgba(248,250,252,.3)'}">${qualifyPct}%</span><div style="height:3px;border-radius:2px;background:rgba(255,255,255,.06);margin-top:2px;overflow:hidden"><div style="height:100%;border-radius:2px;background:${qualifyPct>=70?'rgba(52,211,153,.4)':qualifyPct>=40?'rgba(245,158,11,.3)':'rgba(255,255,255,.08)'};width:${qualifyPct}%;transition:width .8s ease"></div></div>` : '<span style="color:rgba(248,250,252,.1)">—</span>'}
                </div>
            </div>`;
        });
        return h;
    }

    // ── Build prediction cards for upcoming matches ──
    async function buildPredictionCards(upcoming, startIdx) {
        let h = '';
        const predPromises = upcoming.map(m => api(`/api/predict/${m.id}`).catch(() => null));
        const predictions = await Promise.all(predPromises);

        for (let i = 0; i < upcoming.length; i++) {
            const m = upcoming[i];
            const pred = predictions[i];
            const idx = startIdx + i;
            if (pred && !pred.error && pred.homeWin !== undefined) {
                const p = pred;
                const hw = Fmt().pctBar(p.homeWin);
                const dr = Fmt().pctBar(p.draw);
                const aw = Fmt().pctBar(p.awayWin);
                const comps = p.components || {};
                const compConfs = [comps.elo, comps.poisson, comps.coach, comps.venue, comps.odds].filter(Boolean).map(c => Fmt().safeNum(c.confidence, 0));
                const conf = compConfs.length ? Math.round(compConfs.reduce((a, b) => a + b, 0) / compConfs.length * 100) : 65;
                const homeName = displayMaybeTeamName(pred.match?.homeNameI18n || pred.match?.homeName || m.home);
                const awayName = displayMaybeTeamName(pred.match?.awayNameI18n || pred.match?.awayName || m.away);
                const homeFlag = m.home.flag || pred.match?.homeFlag || '🏳️';
                const awayFlag = m.away.flag || pred.match?.awayFlag || '🏳️';
                const score = pred.likelyScore != null && pred.likelyScore !== '' ? pred.likelyScore : '? - ?';
                const confCls = conf > 70 ? 'bg-green-500/20 text-green-400' : conf > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400';
                const eloPred = p.components?.elo || { home: 0, draw: 0, away: 0 };
                const poissonPred = p.components?.poisson || { home: 0, draw: 0, away: 0 };
                const coachPred = p.components?.coach || {};
                const weights = pred.weights || { elo: 0.3, poisson: 0.25, coach: 0.15, venue: 0.10, odds: 0.20 };
                const topScores = p.likelyScore != null && p.likelyScore !== '' ? `${p.likelyScore} ${Fmt().pct(p.likelyScoreProb)}` : '?';
                const confLabel = conf > 70 ? tx('高', 'High') : conf > 50 ? tx('中', 'Medium') : tx('低', 'Low');

                let headerText = '';
                if (m.group && m.matchday !== undefined) headerText = `${m.group} · ${tx('第','MD')} ${m.matchday}`;
                else if (m.group && m.stage && !m.stage.includes('Group')) headerText = `${m.group} · ${m.stage}`;
                else if (m.group) headerText = m.group;
                else if (m.stage) headerText = m.stage;
                else headerText = tx('比赛', 'Match');

                // Group info line
                h += `<div class="pred-card" style="margin-bottom:10px;background:rgba(255,255,255,.03);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px 16px">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                        <span style="font:400 9px/1 'JetBrains Mono', monospace;letter-spacing:1px;color:rgba(248,250,252,.15)">${esc(headerText)}</span>
                        <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.12)">${esc(m.timeBJT||m.dateBJT||'')}</span>
                    </div>`;

                // Teams + score
                h += `<div style="display:flex;align-items:center">
                    <div style="flex:1;display:flex;align-items:center;gap:8px;min-width:0">
                        <div style="width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${homeFlag}</div>
                        <span style="font:500 13px/1 'Inter';color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(homeName)}</span>
                    </div>
                    <div style="padding:0 12px;text-align:center">
                        <span style="font:600 14px/1 'JetBrains Mono', monospace;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.03em">${esc(score)}</span>
                    </div>
                    <div style="flex:1;display:flex;align-items:center;gap:8px;min-width:0;justify-content:flex-end">
                        <span style="font:500 13px/1 'Inter';color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right">${esc(awayName)}</span>
                        <div style="width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${awayFlag}</div>
                    </div>
                </div>`;

                // Prob bar
                h += `<div class="prob-bar" style="margin-top:10px"><div class="prob-bar-home" style="width:${hw}%">${hw > 12 ? hw + '%' : ''}</div><div class="prob-bar-draw" style="width:${dr}%">${dr > 10 ? dr + '%' : ''}</div><div class="prob-bar-away" style="width:${aw}%">${aw > 12 ? aw + '%' : ''}</div></div>`;
                h += `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px">
                    <span style="color:rgba(52,211,153,.5);font-weight:600">${tx('主胜','Home')} ${hw}%</span>
                    <span style="color:rgba(250,204,21,.5);font-weight:600">${tx('平局','Draw')} ${dr}%</span>
                    <span style="color:rgba(248,113,113,.4);font-weight:600">${tx('客胜','Away')} ${aw}%</span>
                </div>`;

                // Expand button + confidence
                h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.04)">
                    <button data-action="toggle-pred-detail" data-target="pred-detail-${idx}" style="font:400 10px/1 'Inter';color:rgba(59,130,246,.5);background:none;border:none;cursor:pointer;padding:0">📊 ${tx('详情','Details')} ▾</button>
                    <span class="confidence-pill ${confCls}">📊 ${tx('置信度','Confidence')}: ${confLabel} ${conf}%</span>
                </div>`;

                // Detail expand
                h += `<div id="pred-detail-${idx}" class="hidden" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.04)">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px">
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#a78bfa;font-weight:600;margin-bottom:3px">⚡ ${tx('Elo 预测','Elo Forecast')}</div>
                            <div style="color:rgba(248,250,252,.35)">${tx('主胜','Home')} ${(eloPred.home*100).toFixed(0)}%  ${tx('平','Draw')} ${(eloPred.draw*100).toFixed(0)}%  ${tx('客','Away')} ${(eloPred.away*100).toFixed(0)}%</div>
                        </div>
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#60a5fa;font-weight:600;margin-bottom:3px">📐 ${tx('Poisson 预测','Poisson Forecast')}</div>
                            <div style="color:rgba(248,250,252,.35)">${tx('主胜','Home')} ${(poissonPred.home*100).toFixed(0)}%  ${tx('平','Draw')} ${(poissonPred.draw*100).toFixed(0)}%  ${tx('客','Away')} ${(poissonPred.away*100).toFixed(0)}%</div>
                        </div>
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#34d399;font-weight:600;margin-bottom:3px">👔 ${tx('教练因素','Coach Factor')}</div>
                            <div style="color:rgba(248,250,252,.35)">${tx('主胜','Home')} ${(coachPred.home*100).toFixed(0)}%  ${tx('平','Draw')} ${(coachPred.draw*100).toFixed(0)}%  ${tx('客','Away')} ${(coachPred.away*100).toFixed(0)}%</div>
                        </div>
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#fbbf24;font-weight:600;margin-bottom:3px">🎯 ${tx('最可能比分','Most Likely Score')}</div>
                            <div style="color:rgba(248,250,252,.35)">${topScores}</div>
                        </div>
                    </div>
                    <div style="font-size:9px;color:rgba(248,250,252,.12);margin-top:8px">${tx('权重','Weights')}: Elo ${(weights.elo*100).toFixed(0)}% · Poisson ${(weights.poisson*100).toFixed(0)}% · ${tx('赔率','Odds')} ${(weights.odds*100).toFixed(0)}% · ${tx('教练','Coach')} ${(weights.coach*100).toFixed(0)}% · ${tx('场馆','Venue')} ${(weights.venue*100).toFixed(0)}%</div>
                </div></div>`;
            } else {
                let headerText = '';
                if (m.group && m.matchday !== undefined) headerText = `${m.group} · ${tx('第','MD')} ${m.matchday}`;
                else if (m.group && m.stage && !m.stage.includes('Group')) headerText = `${m.group} · ${m.stage}`;
                else if (m.group) headerText = m.group;
                else if (m.stage) headerText = m.stage;
                else headerText = tx('比赛', 'Match');

                h += `<div class="pred-card" style="margin-bottom:10px;opacity:.5;background:rgba(255,255,255,.03);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px 16px">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="font:400 9px/1 'JetBrains Mono', monospace;letter-spacing:1px;color:rgba(248,250,252,.15)">${esc(headerText)}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:center;margin-top:8px">
                        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${m.home.flag||'🏳️'}</span><span style="font:500 12px/1 'Inter';color:rgba(248,250,252,.5)">${esc(displayMaybeTeamName(m.home))}</span></div>
                        <span style="margin:0 10px;color:rgba(248,250,252,.1);font-size:12px">VS</span>
                        <div style="display:flex;align-items:center;gap:6px"><span style="font:500 12px/1 'Inter';color:rgba(248,250,252,.5)">${esc(displayMaybeTeamName(m.away))}</span><span style="font-size:12px">${m.away.flag||'🏳️'}</span></div>
                    </div>
                    <div style="text-align:center;font-size:10px;color:rgba(248,250,252,.2);margin-top:6px">${tx('预测暂不可用','Prediction unavailable')}</div>
                </div>`;
            }
        }
        return h;
    }

    async function loadPrediction() {
        const el = document.getElementById('prediction-content');
        el.innerHTML = `<div class="text-center py-10 text-gray-500">🧠 ${esc(tx('loadingPredictions'))}</div>`;

        const [rankings, schedule, qualiData] = await window.WorldCup.ApiClient.allData([
            '/api/elo/rankings', '/api/schedule', '/api/qualification-probabilities',
        ]);

        let html = `<div class="pred-disclaimer border border-amber-400/30 bg-amber-400/10 rounded-xl px-3 py-2.5 text-xs text-amber-100" style="margin-bottom:16px">⚠️ ${tx('本页面为实验性足球概率模型，仅供产品体验参考，不构成任何投注建议。预测基于 Elo 评分与 Poisson 进球预期模型，不接入实时市场赔率。', 'This page provides an experimental football probability model for product evaluation only. It is not betting advice. Predictions are based on Elo ratings and Poisson goal expectations, without live market odds.')}</div>`;

        const allMatches = schedule?.matches || [];
        const isKnockoutStage = allMatches.some(m => m.stage && m.stage !== 'group');
        
        // Find upcoming matches: today's pre matches first, then next day's if empty
        let upcoming = allMatches.filter(m => m.state === 'pre').slice(0, 6);
        
        // If no upcoming matches today, find the next date with pre matches
        if (upcoming.length === 0) {
            const now = new Date();
            const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
            const futureDates = [...new Set(allMatches
                .filter(m => m.date && m.date.slice(0, 10) > todayStr && m.state === 'pre')
                .map(m => m.date.slice(0, 10))
            )].sort();
            
            if (futureDates.length > 0) {
                const nextDate = futureDates[0];
                upcoming = allMatches.filter(m => 
                    m.date && m.date.slice(0, 10) === nextDate && m.state === 'pre'
                ).slice(0, 6);
            }
        }

        const hasRankings = !isKnockoutStage && Array.isArray(rankings) && rankings.length;
        const hasUpcoming = upcoming.length > 0;

        // ── Dual-column layout: Elo table (left) + Prediction cards (right) ──
        if (hasRankings && hasUpcoming) {
            const eloHtml = buildEloTable(rankings);
            const predHtml = await buildPredictionCards(upcoming, 0);

            html += `<div class="pred-two-col" style="display:flex;gap:24px;align-items:start">
                <div class="pred-section" style="flex:1;min-width:0;padding:16px">${eloHtml}</div>
                <div class="pred-section" style="width:380px;flex-shrink:0;padding:16px">
                    <div class="pred-section-title text-blue-400" style="font-family:'DM Sans',sans-serif">
                        <span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs flex-shrink-0">🎯</span>${tx('比赛预测', "Match Predictions")}
                    </div>
                    ${predHtml}
                </div>
            </div>`;
        } else if (hasRankings) {
            // Only Elo, full-width
            html += `<div class="pred-section" style="padding:16px">${buildEloTable(rankings)}</div>`;
        } else if (hasUpcoming) {
            // Only predictions, full-width
            const predHtml = await buildPredictionCards(upcoming, 0);
            html += `<div class="pred-section" style="padding:16px">
                <div class="pred-section-title text-blue-400" style="font-family:'DM Sans',sans-serif">
                    <span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs flex-shrink-0">🎯</span>${tx('比赛预测', "Match Predictions")}
                </div>
                ${predHtml}
            </div>`;
        }

        // ── Qualification probabilities ──
        if (qualiData && typeof qualiData === 'object' && !Array.isArray(qualiData)) {
            const qualiGroups = Object.values(qualiData);
            if (qualiGroups.length) {
                html += `<div class="pred-section" style="margin-top:12px;padding:16px">
                    <div class="pred-section-title text-emerald-400" style="font-family:'DM Sans',sans-serif">
                        <span class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs flex-shrink-0">🎯</span>${tx('出线形势', 'Qualification Probabilities')}
                    </div>`;
                qualiGroups.forEach(g => {
                    const groupName = displayGroupName(g.group || tx('未知小组', 'Unknown Group'));
                    html += `<div style="margin-bottom:12px"><div style="font:600 11px/1 'DM Sans', sans-serif;color:rgba(248,250,252,.3);margin-bottom:6px">${esc(groupName)}</div><div style="display:flex;flex-direction:column;gap:6px">`;
                    (g.results || []).forEach(t => {
                        const pct = Math.round((t.probability || t.qualifyProb || 0) * 100);
                        const barCls = pct >= 70 ? 'quali-high' : pct >= 40 ? 'quali-mid' : 'quali-low';
                        html += `<div class="quali-card flex items-center gap-2.5"><div class="team-flag">${t.flag || '🏳️'}</div><div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-1"><span style="font:500 12px/1 'Inter';color:#f8fafc">${esc(displayMaybeTeamName(t.name))}</span><span style="font:500 12px/1 'JetBrains Mono', monospace;color:${pct >= 70 ? '#34d399' : pct >= 40 ? '#f59e0b' : 'rgba(248,250,252,.3)'}">${pct}%</span></div><div class="quali-bar"><div class="quali-bar-fill ${barCls}" style="width:${pct}%"></div></div></div></div>`;
                    });
                    html += '</div></div>';
                });
                html += '</div>';
            }
        }

        // ── Knockout stage bracket ──
        html += `<div class="pred-section mt-4" style="padding:16px">
            <div class="pred-section-title text-orange-400" style="font-family:'DM Sans',sans-serif">
                <span class="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center text-xs flex-shrink-0">🏆</span>${tx('后期淘汰赛', 'Knockout Stage')}
            </div>
            <div id="bracket-container-pred" class="w-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide text-center min-h-[200px]">
                <div class="text-gray-500 py-10">${tx('加载对阵图...', 'Loading bracket...')}</div>
            </div>
        </div>`;

        el.innerHTML = html || `<div class="text-gray-500 text-center py-10">${tx('暂无预测数据', 'No prediction data available')}</div>`;

        api('/api/bracket').then(data => {
            const container = document.getElementById('bracket-container-pred');
            if (container && data && !data.error) {
                container.innerHTML = '';
                if (typeof renderBracket === 'function') renderBracket(data, container);
                setTimeout(() => { const wrap = container.querySelector('#bk-wrap'); if (wrap) container.scrollLeft = (wrap.scrollWidth - container.clientWidth) / 2; }, 100);
            }
        }).catch(() => {
            const container = document.getElementById('bracket-container-pred');
            if (container) container.innerHTML = `<div class="text-gray-500 py-10">${tx('淘汰赛对阵图将在小组赛结束后生成', 'Knockout bracket will be generated after group stage.')}</div>`;
        });
    }

    // Expose
    window.WorldCup.EloPrediction = { loadPrediction };
    Object.assign(window, { loadPrediction });
})();
