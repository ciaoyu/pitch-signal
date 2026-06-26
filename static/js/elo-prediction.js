/**
 * elo-prediction.js — Elo rankings, qualification probabilities, prediction cards
 * Extracted from app.js lines 2838-3113
 */
(function () {
    'use strict';

    const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
    const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
    const tx = (...a) => (window.WorldCup.I18n?.t || ((z, e) => e))(...a);
    const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
    const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
    const displayGroupName = (...a) => (window.WorldCup.I18n?.displayGroupName || ((x) => x))(...a);
    const Fmt = () => window.WorldCup.Fmt || window.WorldCup.Formatters || window.Fmt || {};

    async function loadPrediction() {
        const el = document.getElementById('prediction-content');
        el.innerHTML = `<div class="text-center py-10 text-gray-500">🧠 ${esc(tx('loadingPredictions'))}</div>`;

        const [rankings, schedule, qualiData] = await window.WorldCup.ApiClient.allData([
            '/api/elo/rankings', '/api/schedule', '/api/qualification-probabilities',
        ]);

        let html = `<div class="pred-disclaimer border border-amber-400/30 bg-amber-400/10 rounded-xl px-3 py-2.5 text-xs text-amber-100">⚠️ ${tx('本页面为实验性足球概率模型，仅供产品体验参考，不构成任何投注建议。预测基于 Elo 评分与 Poisson 进球预期模型，不接入实时市场赔率。', 'This page provides an experimental football probability model for product evaluation only. It is not betting advice. Predictions are based on Elo ratings and Poisson goal expectations, without live market odds.')}</div>`;

        const allMatches = schedule?.matches || [];
        const isKnockoutStage = allMatches.some(m => m.stage && m.stage !== 'group');

        if (!isKnockoutStage && Array.isArray(rankings) && rankings.length) {
            html += `<div class="pred-section"><div class="pred-section-title text-purple-400"><span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">⚡</span>${tx('Elo 实力排名 Top 10', 'Elo Rankings Top 10')}</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">`;
            rankings.slice(0, 10).forEach((t, i) => {
                const bar = Math.min(100, Math.max(5, Math.round((t.rating - 1400) / 6)));
                const rankCls = i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : 'rank-default';
                const prevRank = t.previousRank || t.prevRank || null;
                let changeHtml = '<span class="rank-change rank-same">—</span>';
                if (prevRank && prevRank !== t.rank) {
                    const diff = prevRank - t.rank;
                    changeHtml = diff > 0 ? `<span class="rank-change rank-up">▲${diff}</span>` : `<span class="rank-change rank-down">▼${Math.abs(diff)}</span>`;
                } else if (t.change > 0) { changeHtml = `<span class="rank-change rank-up">▲${t.change}</span>`; }
                else if (t.change < 0) { changeHtml = `<span class="rank-change rank-down">▼${Math.abs(t.change)}</span>`; }
                const eloFlag = t.flag || getFlagEmoji(t.teamId) || '🏳️';
                html += `<div class="elo-card flex items-center gap-3"><div class="elo-rank-badge ${rankCls}">#${t.rank}</div><div class="team-flag">${eloFlag}</div><div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-1"><span class="text-xs font-bold truncate">${displayMaybeTeamName(t)}</span><div class="flex items-center gap-1.5">${changeHtml}<span class="text-xs font-mono font-bold text-purple-400">${t.rating}</span></div></div><div class="elo-bar"><div class="elo-bar-fill" style="width:${bar}%"></div></div></div></div>`;
            });
            html += '</div></div>';
        }

        if (qualiData && typeof qualiData === 'object' && !Array.isArray(qualiData)) {
            const qualiGroups = Object.values(qualiData);
            if (qualiGroups.length) {
                html += `<div class="pred-section"><div class="pred-section-title text-emerald-400"><span class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">🎯</span>${tx('出线形势', 'Qualification Probabilities')}</div>`;
                qualiGroups.forEach(g => {
                    const groupName = displayGroupName(g.group || tx('未知小组', 'Unknown Group'));
                    html += `<div class="mb-3 last:mb-0"><div class="text-[11px] font-bold text-gray-400 mb-1.5">${esc(groupName)}</div><div class="space-y-1.5">`;
                    (g.results || []).forEach(t => {
                        const pct = Math.round((t.probability || t.qualifyProb || 0) * 100);
                        const barCls = pct >= 70 ? 'quali-high' : pct >= 40 ? 'quali-mid' : 'quali-low';
                        html += `<div class="quali-card flex items-center gap-2.5"><div class="team-flag">${t.flag || '🏳️'}</div><div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-1"><span class="text-[11px] font-bold truncate">${displayMaybeTeamName(t.name)}</span><span class="text-[11px] font-mono font-bold ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}">${pct}%</span></div><div class="quali-bar"><div class="quali-bar-fill ${barCls}" style="width:${pct}%"></div></div></div></div>`;
                    });
                    html += '</div></div>';
                });
                html += '</div>';
            }
        }

        html += `<div class="pred-section mt-4"><div class="pred-section-title text-orange-400"><span class="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center text-xs">🏆</span>${tx('后期淘汰赛', 'Knockout Stage')}</div><div id="bracket-container-pred" class="w-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide text-center flex justify-center min-h-[200px]"><div class="text-gray-500 py-10">${tx('加载对阵图...', 'Loading bracket...')}</div></div></div>`;

        const matches = schedule?.matches || [];
        const upcoming = matches.filter(m => m.state === 'pre').slice(0, 6);

        if (upcoming.length) {
            html += `<div class="pred-section"><div class="pred-section-title text-blue-400"><span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">🎯</span>${tx('今日比赛预测', "Today's Predictions")}</div>`;
            const predPromises = upcoming.map(m => api(`/api/predict/${m.id}`).catch(() => null));
            const predictions = await Promise.all(predPromises);

            for (let i = 0; i < upcoming.length; i++) {
                const m = upcoming[i];
                const pred = predictions[i];
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

                    html += `<div class="pred-card mb-2.5"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2 flex-1 min-w-0"><div class="team-flag">${homeFlag}</div><span class="text-sm font-exbold truncate">${homeName}</span></div><div class="flex flex-col items-center px-3"><div class="score-badge">${score}</div><span class="text-[9px] text-gray-500 mt-0.5">${tx('预测比分', 'Predicted Score')}</span></div><div class="flex items-center gap-2 flex-1 min-w-0 justify-end"><span class="text-sm font-extrabold truncate text-right">${awayName}</span><div class="team-flag">${awayFlag}</div></div></div>`;
                    html += `<div class="prob-bar mb-2"><div class="prob-bar-home" style="width:${hw}%">${hw > 12 ? hw + '%' : ''}</div><div class="prob-bar-draw" style="width:${dr}%">${dr > 10 ? dr + '%' : ''}</div><div class="prob-bar-away" style="width:${aw}%">${aw > 12 ? aw + '%' : ''}</div></div>`;
                    html += `<div class="flex justify-between text-[11px] mb-2"><span class="text-green-400 font-bold">${tx('主胜', 'Home')} ${hw}%</span><span class="text-yellow-400 font-bold">${tx('平局', 'Draw')} ${dr}%</span><span class="text-red-400 font-bold">${tx('客胜', 'Away')} ${aw}%</span></div>`;
                    html += `<div class="flex justify-between items-center"><button data-action="toggle-pred-detail" data-target="pred-detail-${i}" class="text-[11px] text-blue-400 hover:text-blue-300 transition">📊 ${tx('详情', 'Details')} ▾</button><span class="confidence-pill ${confCls}"><span>📊</span> ${tx('置信度', 'Confidence')}: ${confLabel} ${conf}%</span></div>`;
                    html += `<div id="pred-detail-${i}" class="hidden mt-3 pt-3 border-t border-white/5"><div class="grid grid-cols-2 gap-2 text-[11px]"><div class="bg-white/3 rounded-lg p-2"><div class="text-purple-400 font-bold mb-1">⚡ ${tx('Elo 预测', 'Elo Forecast')}</div><div>${tx('主胜', 'Home')} ${(eloPred.home*100).toFixed(0)}%  ${tx('平', 'Draw')} ${(eloPred.draw*100).toFixed(0)}%  ${tx('客', 'Away')} ${(eloPred.away*100).toFixed(0)}%</div></div><div class="bg-white/3 rounded-lg p-2"><div class="text-blue-400 font-bold mb-1">📐 ${tx('Poisson 预测', 'Poisson Forecast')}</div><div>${tx('主胜', 'Home')} ${(poissonPred.home*100).toFixed(0)}%  ${tx('平', 'Draw')} ${(poissonPred.draw*100).toFixed(0)}%  ${tx('客', 'Away')} ${(poissonPred.away*100).toFixed(0)}%</div></div><div class="bg-white/3 rounded-lg p-2"><div class="text-green-400 font-bold mb-1">👔 ${tx('教练因素', 'Coach Factor')}</div><div>${tx('主胜', 'Home')} ${(coachPred.home*100).toFixed(0)}%  ${tx('平', 'Draw')} ${(coachPred.draw*100).toFixed(0)}%  ${tx('客', 'Away')} ${(coachPred.away*100).toFixed(0)}%</div></div><div class="bg-white/3 rounded-lg p-2"><div class="text-yellow-400 font-bold mb-1">🎯 ${tx('最可能比分', 'Most Likely Score')}</div><div>${topScores}</div></div></div>`;
                    html += `<div class="text-[9px] text-gray-500 mt-2">${tx('权重', 'Weights')}: Elo ${(weights.elo*100).toFixed(0)}% · Poisson ${(weights.poisson*100).toFixed(0)}% · ${tx('赔率', 'Odds')} ${(weights.odds*100).toFixed(0)}% · ${tx('教练', 'Coach')} ${(weights.coach*100).toFixed(0)}% · ${tx('场馆', 'Venue')} ${(weights.venue*100).toFixed(0)}%</div></div></div>`;
                } else {
                    html += `<div class="pred-card mb-2.5 opacity-60"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><div class="team-flag">${m.home.flag||'🏳️'}</div><span class="text-xs font-bold">${displayMaybeTeamName(m.home)}</span></div><span class="text-[11px] text-gray-500">VS</span><div class="flex items-center gap-2"><span class="text-xs font-bold">${displayMaybeTeamName(m.away)}</span><div class="team-flag">${m.away.flag||'🏳️'}</div></div></div><div class="text-center text-[11px] text-gray-500 mt-2">${tx('预测暂不可用', 'Prediction unavailable')}</div></div>`;
                }
            }
            html += '</div>';
        }

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
