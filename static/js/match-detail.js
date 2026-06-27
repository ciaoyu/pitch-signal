// ========== match-detail.js - Match Detail Module (HUD Layout) ==========
(function() {
    const { tx, esc, displayMaybeTeamName, attr, api, withClientTimeout } = window.WorldCup.Utils;
    const t = window.t;
    const state = window.WorldCup.State;
    const MR = () => window.WorldCup.MatchRenderers;

    async function openMatch(id) {
        const modal = document.getElementById('match-modal');
        const content = document.getElementById('modal-content');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // lock body scroll
        content.innerHTML = `<div class="py-10 text-center text-gray-500">${tx('加载中...', 'Loading...')}</div>`;

        const [matchData, matchupData] = await window.WorldCup.ApiClient.allData([
            '/api/match/' + id, '/api/matchup/' + id + '/formation',
        ]);

        if (!matchData) { content.innerHTML = `<div class="py-10 text-center text-red-400">${tx('加载失败', 'Failed to load')}</div>`; return; }
        const scheduledMatch = state.scheduleCache.find(m => String(m.id) === String(id)) || {};
        const isFinishedMatch = scheduledMatch.state === 'post' || matchData.state === 'post';
        const isLive = matchData.state === 'in';
        const knownVenue = scheduledMatch.venue || matchData.venue || '';
        const mHomeId = scheduledMatch.home?.id || matchData.home?.id || matchData.homeId;
        const mAwayId = scheduledMatch.away?.id || matchData.away?.id || matchData.awayId;
        const homeName = displayMaybeTeamName(scheduledMatch.home?.nameI18n || scheduledMatch.home?.name || matchData.home?.nameI18n || matchData.home?.name || '');
        const awayName = displayMaybeTeamName(scheduledMatch.away?.nameI18n || scheduledMatch.away?.name || matchData.away?.nameI18n || matchData.away?.name || '');
        const homeScore = matchData.home?.score ?? '-';
        const awayScore = matchData.away?.score ?? '-';
        const homeElo = matchData.home?.elo || matchData.elo?.home || '';
        const awayElo = matchData.away?.elo || matchData.elo?.away || '';
        const homeFormation = matchupData?.home?.formation || '4-3-3';
        const awayFormation = matchupData?.away?.formation || '4-3-3';

        // Fill topbar info
        const groupLabel = scheduledMatch.group || matchData.group || '';
        const mdLabel = scheduledMatch.matchday || matchData.matchday || '?';
        const topbarInfo = document.getElementById('hud-topbar-info');
        if (topbarInfo) topbarInfo.textContent = groupLabel ? `${groupLabel} · MD ${mdLabel}/3` : '';

        // ── Build HUD HTML ──
        let html = '';

        // Resolve team logos (scheduledMatch has logo from parseEvent; matchData from /api/match/:id does not)
        const homeLogo = scheduledMatch.home?.logo || matchData.home?.logo || '';
        const awayLogo = scheduledMatch.away?.logo || matchData.away?.logo || '';
        const homeFlag = scheduledMatch.home?.flag || '🏳️';
        const awayFlag = scheduledMatch.away?.flag || '🏳️';

        // Score header — jumbo
        html += `<div id="hud-score" style="display:flex;align-items:center;justify-content:center;padding:24px 24px 16px;gap:20px">
            <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:16px">
                <div style="text-align:right">
                    <div style="font:500 22px/1 'Inter';color:#f8fafc">${esc(homeName)}</div>
                    <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:4px">
                        ${homeElo ? `<span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.45)">ELO ${homeElo}</span><span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.12)">|</span>` : ''}
                        <span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${esc(homeFormation)}</span>
                    </div>
                </div>
                ${homeLogo ? `<img src="${attr(homeLogo)}" style="width:52px;height:52px;border-radius:14px;object-fit:contain;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.12);flex-shrink:0" onerror="this.style.display='none'">` : `<div style="width:52px;height:52px;border-radius:14px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.12);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">${esc(homeFlag)}</div>`}
            </div>
            <div style="min-width:140px;text-align:center;padding:0 20px;flex-shrink:0">
                <div style="font:300 52px/1 'JetBrains Mono',monospace;color:#f8fafc;letter-spacing:-3px">${esc(String(homeScore))} <span style="font-size:22px;color:rgba(248,250,252,.12)">:</span> ${esc(String(awayScore))}</div>
                ${isLive ? `<div style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 12px;border-radius:8px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.12)"><div style="width:5px;height:5px;border-radius:50%;background:#34d399;animation:pulse-live 1.8s ease-in-out infinite"></div><span style="font:500 9px/1 'JetBrains Mono',monospace;color:#34d399">LIVE</span></div>` : isFinishedMatch ? `<div style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.3);margin-top:8px">FT</div>` : `<div style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.4);margin-top:8px">${tx('待赛', 'TBD')}</div>`}
            </div>
            <div style="flex:1;display:flex;align-items:center;justify-content:flex-start;gap:16px">
                ${awayLogo ? `<img src="${attr(awayLogo)}" style="width:52px;height:52px;border-radius:14px;object-fit:contain;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.1);flex-shrink:0" onerror="this.style.display='none'">` : `<div style="width:52px;height:52px;border-radius:14px;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.1);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">${esc(awayFlag)}</div>`}
                <div>
                    <div style="font:500 22px/1 'Inter';color:#f8fafc">${esc(awayName)}</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                        ${awayElo ? `<span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.45)">ELO ${awayElo}</span><span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.12)">|</span>` : ''}
                        <span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${esc(awayFormation)}</span>
                    </div>
                </div>
            </div>
        </div>`;

        // ── 3-column HUD body (design: 300 / flex center 540 max / 280) ──
        html += `<div id="hud-body" style="display:flex;gap:12px;padding:8px 24px 0;align-items:flex-start;min-height:360px">`;

        // LEFT: Stats / H2H / News tabs (300px)
        html += `<div id="hud-left" style="width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:0">
            <div class="hud-glass-panel">
                <div style="display:flex;border-bottom:1px solid rgba(255,255,255,.05);padding:0 4px" id="hud-left-tabs">
                    <button data-action="switch-detail-tab" data-detail-tab="stats" class="detail-tab flex-1 py-2 text-[10px] font-medium transition-all rounded-lg hud-tab-btn active">${tx('统计', 'Stats')}</button>
                    <button data-action="switch-detail-tab" data-detail-tab="h2h" class="detail-tab flex-1 py-2 text-[10px] font-medium transition-all rounded-lg hud-tab-btn">${tx('交锋', 'H2H')}</button>
                    <button data-action="switch-detail-tab" data-detail-tab="news" class="detail-tab flex-1 py-2 text-[10px] font-medium transition-all rounded-lg hud-tab-btn">${tx('新闻', 'News')}</button>
                </div>
                <div id="hud-left-content" style="max-height:calc(100vh - 380px);overflow-y:auto">
                    <div id="detail-content-stats" class="detail-content">${tx('加载中...', 'Loading...')}</div>
                    <div id="detail-content-h2h" class="detail-content hidden">${tx('加载中...', 'Loading...')}</div>
                    <div id="detail-content-news" class="detail-content hidden">${tx('加载中...', 'Loading...')}</div>
                </div>
            </div>
        </div>`;

        // CENTER: Tactical board (flex:1, max-width:540px, aspect-ratio:1.45/1)
        html += `<div id="hud-center" style="flex:1;display:flex;flex-direction:column;align-items:center;padding:0 6px;min-width:0">
            <div id="pitch-canvas" style="width:100%;max-width:540px;aspect-ratio:1.45/1;position:relative;background:linear-gradient(180deg,rgba(16,42,28,.25) 0%,rgba(22,58,36,.2) 100%);border-radius:12px;border:1px solid rgba(52,211,153,.08);overflow:hidden">
                ${MR().renderTacticalBoard(matchupData)}
            </div>
            <div style="display:flex;align-items:center;gap:14px;margin-top:6px">
                <div style="display:flex;align-items:center;gap:4px"><div style="width:7px;height:7px;border-radius:50%;background:rgba(59,130,246,.3);border:1px solid rgba(59,130,246,.5)"></div><span style="font:400 8px/1 'Inter';color:rgba(248,250,252,.25)">${esc(homeName)}</span></div>
                <div style="display:flex;align-items:center;gap:4px"><div style="width:7px;height:7px;border-radius:50%;background:rgba(248,113,113,.2);border:1px solid rgba(248,113,113,.4)"></div><span style="font:400 8px/1 'Inter';color:rgba(248,250,252,.25)">${esc(awayName)}</span></div>
            </div>
        </div>`;

        // RIGHT: Win probability + Venue (280px)
        html += `<div id="hud-right" style="width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:10px">
            <div class="hud-glass-panel" style="padding:14px 16px">
                <div id="hud-winprob">${tx('加载预测...', 'Loading prediction...')}</div>
            </div>
            <div class="hud-glass-panel" style="padding:14px 16px">
                <div id="hud-venue">${tx('加载场地...', 'Loading venue...')}</div>
            </div>
        </div>`;

        html += `</div>`; // end hud-body

        // Bottom dock: extra tabs (Bench, Coach, Review, Corners, Pre-match)
        html += `<div id="hud-bottom" style="margin-top:8px;background:rgba(15,23,42,.5);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-top:1px solid rgba(255,255,255,.06);border-radius:24px 24px 0 0;padding:14px 32px 18px">
            <div style="display:flex;gap:1.5rem;overflow-x:auto;margin-bottom:10px" id="hud-bottom-tabs">`;

        const showPreMatch = !isFinishedMatch && (scheduledMatch.state === 'pre' || (matchData.status?.type?.name || '').includes('SCHEDULED'));
        if (showPreMatch) html += `<button data-action="switch-detail-tab" data-detail-tab="pre-match" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white transition whitespace-nowrap">🧠 ${tx('赛前预测', 'Pre-Match')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="review" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold ${showPreMatch ? 'bg-white/5 text-gray-400' : 'bg-white/10 text-white'} transition whitespace-nowrap">📋 ${tx('回顾', 'Review')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="bench" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap">🔄 ${tx('替补', 'Bench')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="corners" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap">📐 ${tx('角球', 'Corners')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="coach" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap">🧠 ${tx('教练', 'Coach')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="venue-tab" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap">🏟️ ${tx('场地详情', 'Venue')}</button>`;
        html += `</div>`;

        if (showPreMatch) html += `<div id="detail-content-pre-match" class="detail-content"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载赛前预测...', 'Loading...')}</span></div></div>`;
        html += `<div id="detail-content-review" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载比赛回顾...', 'Loading...')}</span></div></div>`;
        html += `<div id="detail-content-bench" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载替补席数据...', 'Loading...')}</span></div></div>`;
        html += `<div id="detail-content-corners" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载角球数据...', 'Loading...')}</span></div></div>`;
        html += `<div id="detail-content-coach" class="detail-content hidden">${MR().renderCoachPanel(matchData, isFinishedMatch)}</div>`;
        html += `<div id="detail-content-venue-tab" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载场地天气数据...', 'Loading...')}</span></div></div>`;
        html += `</div>`; // end hud-bottom

        content.innerHTML = html;

        // ── Async data loads ──

        // Prediction → HUD right winprob
        api('/api/predict/' + id).then(predRes => {
            const pred = predRes?.data || predRes;
            const el = document.getElementById('hud-winprob');
            if (el) el.innerHTML = MR().renderHudWinProbPanel(pred, homeName, awayName);
            // Also fill pre-match tab if present
            const pmEl = document.getElementById('detail-content-pre-match');
            if (pmEl && pred && !pred.error && pred.homeWin !== undefined) pmEl.innerHTML = renderPreMatchPrediction(pred);
            else if (pmEl) pmEl.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction unavailable')}</div>`;
        }).catch(() => {
            const el = document.getElementById('hud-winprob');
            if (el) el.innerHTML = `<div class="text-gray-500 text-xs text-center py-6">${tx('预测暂不可用', 'Prediction unavailable')}</div>`;
        });

        // Venue → HUD right venue
        if (knownVenue) {
            api('/api/venue/' + encodeURIComponent(knownVenue)).then(venueData => {
                const el = document.getElementById('hud-venue');
                if (el && venueData && !venueData.error && !venueData.note) el.innerHTML = MR().renderHudVenuePanel(venueData);
                else if (el) el.innerHTML = matchData.weather ? renderMatchWeatherBlock(matchData.weather) : '';
                // Also fill venue-tab
                const vEl = document.getElementById('detail-content-venue-tab');
                if (vEl && venueData && !venueData.error && !venueData.note) vEl.innerHTML = renderVenueWeather(venueData);
                else if (vEl) vEl.innerHTML = matchData.weather ? renderMatchWeatherBlock(matchData.weather) : `<div class="text-gray-500 text-xs py-4 text-center">${tx('场地资料暂不可用', 'Venue details unavailable')}</div>`;
            }).catch(() => {
                const el = document.getElementById('hud-venue');
                if (el && matchData.weather) el.innerHTML = renderMatchWeatherBlock(matchData.weather);
                else if (el) el.innerHTML = '';
            });
        } else if (matchData.weather) {
            const el = document.getElementById('hud-venue');
            if (el) el.innerHTML = renderMatchWeatherBlock(matchData.weather);
        }

        // Stats → left panel
        const isFin = isFinishedMatch;
        if (isFin && matchData.teamStats?.length) {
            const statsEl = document.getElementById('detail-content-stats');
            if (statsEl) {
                let statsHtml = '';
                if (matchData.goals?.length) {
                    statsHtml += `<div style="padding:12px 18px 0"><div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;margin-bottom:8px">${tx('进球', 'GOALS')}</div>`;
                    statsHtml += matchData.goals.map(g => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px"><span style="color:rgba(248,250,252,.3);min-width:28px;font-family:'JetBrains Mono',monospace;font-size:10px">${esc(g.minute)}</span><span style="color:rgba(248,250,252,.7)">${esc(g.player)}</span><span style="color:rgba(248,250,252,.2);font-size:10px">(${esc(g.team)})</span></div>`).join('');
                    statsHtml += `</div>`;
                }
                statsHtml += MR().renderHudStatsPanel(matchData, null);
                statsEl.innerHTML = statsHtml;
            }
        } else {
            // Pre-match: show recent stats
            const hId = mHomeId || matchData.home?.id, aId = mAwayId || matchData.away?.id;
            if (hId && aId) {
                Promise.allSettled([api('/api/team/' + hId + '/recent-stats'), api('/api/team/' + aId + '/recent-stats')]).then(([h, a]) => {
                    const el = document.getElementById('detail-content-stats'); if (!el) return;
                    const hVal = h.value?.data || h.value; const aVal = a.value?.data || a.value;
                    const hs = (h.status === 'fulfilled' && hVal?.stats) ? hVal : null;
                    const as2 = (a.status === 'fulfilled' && aVal?.stats) ? aVal : null;
                    if (!hs && !as2) { el.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx('赛前暂无可用统计', 'No pre-match stats')}</div>`; return; }
                    el.innerHTML = `<div style="padding:16px 18px"><div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;margin-bottom:12px">${tx('近期场均', 'RECENT AVG')}</div>${window.WorldCup.MatchStats.renderRecentAvgComparison(hs, as2, homeName, awayName)}</div>`;
                }).catch(() => { const el = document.getElementById('detail-content-stats'); if (el) el.innerHTML = ''; });
            }
        }

        // H2H → left panel
        withClientTimeout(api('/api/h2h/' + id), 8000).then(h2hRes => {
            const h2hData = h2hRes?.data || h2hRes;
            const el = document.getElementById('detail-content-h2h');
            if (el && h2hData && !h2hData.error) el.innerHTML = `<div style="padding:16px 18px">${renderHeadToHead(h2hData)}</div>`;
            else if (el) el.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx('暂无交锋记录', 'No H2H data')}</div>`;
        });

        // News → left panel
        api('/api/match/' + id + '/news').then(newsRes => {
            const newsData = newsRes?.data || newsRes;
            const el = document.getElementById('detail-content-news');
            if (el && newsData && !newsData.error) el.innerHTML = `<div style="padding:16px 18px">${renderNewsList(newsData)}</div>`;
            else if (el) el.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx('暂无新闻', 'No news')}</div>`;
        });

        // Bench → bottom dock
        api('/api/match/' + id + '/bench').then(benchData => {
            const el = document.getElementById('detail-content-bench');
            if (el && benchData && !benchData.error) {
                el.innerHTML = MR().renderBenchAnalysis(benchData, isFinishedMatch);
                if (benchData.realSubstitutions?.length > 0) MR().applySubstitutionsToFormation(benchData.realSubstitutions);
            } else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('替补席数据暂无', 'No bench data')}</div>`;
        });

        // Corners → bottom dock
        api('/api/corner-analysis/' + id).then(cornerRes => {
            const corner = cornerRes?.data || cornerRes;
            const el = document.getElementById('detail-content-corners');
            if (el && corner && !corner.error) el.innerHTML = renderCornerAnalysis(corner);
            else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('角球数据暂无', 'No corner data')}</div>`;
        });

        // Review → bottom dock
        if (isFin && mHomeId && mAwayId) {
            fetch('/api/post-match-review/' + id).then(r => r.json()).then(async review => {
                if (review && !review.error) {
                    if (!review.aiPrediction) { const pred = await api('/api/predict/' + id); if (pred && !pred.error && pred.homeWin !== undefined) { review.aiPrediction = { homeWin: Math.round((pred.homeWin || 0) * 1000) / 10, draw: Math.round((pred.draw || 0) * 1000) / 10, awayWin: Math.round((pred.awayWin || 0) * 1000) / 10, predictedScore: pred.likelyScore || '', source: 'current_model' }; } }
                    const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = window.WorldCup.MatchReview.renderMatchReview(review);
                } else { const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('赛后复盘暂未生成', 'Post-match review not yet available')}</div>`; }
            }).catch(() => { const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('比赛回顾暂不可用', 'Review unavailable')}</div>`; });
        } else { const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">⏳ ${tx('比赛结束后自动生成回顾', 'Auto-generated after match ends')}</div>`; }

        // Coach → bottom dock
        if (mHomeId && mAwayId) {
            withClientTimeout(window.WorldCup.ApiClient.get('/api/coach-compare/' + mHomeId + '/' + mAwayId, { timeout: window.WorldCup.ApiClient.TIMEOUT_LONG }), 8000).then(res => {
                const el = document.getElementById('detail-content-coach'); const coachData = res?.data;
                if (el && coachData && !coachData.error) { el.innerHTML = MR().renderCoachPanel(coachData, isFinishedMatch); }
                else if (el) { Promise.allSettled([window.WorldCup.ApiClient.get('/api/coach/' + mHomeId, { timeout: 5000 }), window.WorldCup.ApiClient.get('/api/coach/' + mAwayId, { timeout: 5000 })]).then(([homeR, awayR]) => { if (el) { const homeC = homeR.status === 'fulfilled' && homeR.value?.data && !homeR.value.data.error ? homeR.value.data : null; const awayC = awayR.status === 'fulfilled' && awayR.value?.data && !awayR.value.data.error ? awayR.value.data : null; el.innerHTML = MR().renderCoachPanel({ coachA: homeC, coachB: awayC, comparison: null, _fallback: true }, isFinishedMatch); } }).catch(() => { if (el) el.innerHTML = MR().renderCoachPanel(null, isFinishedMatch); }); }
            }).catch(() => { const el = document.getElementById('detail-content-coach'); if (el) el.innerHTML = MR().renderCoachPanel(null, isFinishedMatch); });
        } else { const el = document.getElementById('detail-content-coach'); if (el) el.innerHTML = MR().renderCoachPanel(null, isFinishedMatch); }
    }

    // Left-panel tabs (stats/h2h/news) and bottom-dock tabs (pre-match/review/bench/corners/coach/venue-tab)
    const LEFT_TABS = ['stats', 'h2h', 'news'];
    function switchDetailTab(tab, btn) {
        // Determine which group this tab belongs to
        const isLeft = LEFT_TABS.includes(tab);
        const contents = document.querySelectorAll('.detail-content');
        contents.forEach(el => el.classList.add('hidden'));
        // All detail-tab buttons reset
        document.querySelectorAll('.detail-tab').forEach(el => {
            el.classList.remove('active');
            el.style.color = 'rgba(248,250,252,.35)';
            el.style.borderBottom = 'none';
            el.style.background = 'transparent';
        });
        // Show target
        const target = document.getElementById('detail-content-' + tab);
        if (target) target.classList.remove('hidden');
        // Activate clicked button
        if (btn) {
            btn.classList.add('active');
            if (isLeft) {
                btn.style.color = '#f8fafc';
                btn.style.borderBottom = '2px solid #34d399';
                btn.style.background = 'rgba(255,255,255,.03)';
            } else {
                btn.style.background = 'rgba(255,255,255,.1)';
                btn.style.color = '#f8fafc';
            }
        }
    }

    function closeModal() {
        document.getElementById('match-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    function renderNewsList(data) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('数据暂无', 'No data')}</div>`;
        const news = data.news || [];
        const source = data.source || 'unknown';
        const getImportanceIcon = (i) => ({red:'🔴',yellow:'🟡',green:'🟢'}[i]||'⚪');
        const getImportanceColor = (i) => ({red:'border-red-500/30',yellow:'border-yellow-500/30',green:'border-green-500/30'}[i]||'border-white/10');
        const getTypeIcon = (t) => ({injury:'🏥',lineup:'📋',tactical:'🧠',coach:'👔',transfer:'💰',history:'📊'}[t]||'📰');
        const formatTime = (dateStr) => { const d=new Date(dateStr),now=new Date(),dh=Math.floor((now-d)/(36e5)); if(dh<1)return tx('刚刚','Just now'); if(dh<24)return state.uiLang==='en'?`${dh}h ago`:`${dh}小时前`; const dd=Math.floor(dh/24); if(dd<7)return state.uiLang==='en'?`${dd}d ago`:`${dd}天前`; return d.toLocaleDateString(state.uiLang==='en'?'en-US':'zh-CN',{month:'short',day:'numeric'}); };
        return `<div class="space-y-3"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="text-lg">📰</span><div><div class="text-sm font-bold">${tx('比赛相关新闻','Match News')}</div><div class="text-[11px] text-gray-500">${esc(displayMaybeTeamName(data.homeNameI18n||data.homeTeam||''))} ${tx('对阵','vs')} ${esc(displayMaybeTeamName(data.awayNameI18n||data.awayTeam||''))}</div></div></div><div class="text-[11px] text-gray-600">${tx('来源','Source')}: ${source==='tavily'?'Tavily AI':tx('暂无同步','Not synced')}</div></div>${news.length>0?news.map(item=>`<div class="glass-light rounded-lg p-3 border-l-2 ${getImportanceColor(item.importance)}"><div class="flex items-start gap-2"><span class="text-sm mt-0.5">${getImportanceIcon(item.importance)}</span><div class="flex-1"><div class="flex items-center gap-1 mb-1"><span class="text-[11px] text-gray-500">${getTypeIcon(item.type)} ${esc(item.type)||'general'}</span><span class="text-[11px] text-gray-600 ml-auto">${formatTime(item.publishedAt)}</span></div><div class="font-bold text-xs mb-1">${esc(window.WorldCup.I18n.i18nText(item.titleI18n,item.title||''))}</div><div class="text-[11px] text-gray-400 mb-2">${esc(window.WorldCup.I18n.i18nText(item.summaryI18n,item.summary||''))}</div><div class="flex items-center justify-between"><div class="text-[11px] text-gray-600">${tx('来源','Source')}: ${esc(window.WorldCup.I18n.i18nText(item.sourceI18n,item.source||tx('未知','Unknown')))}</div>${item.url?`<a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-blue-400 hover:underline">${tx('阅读全文','Read full article')} →</a>`:''}</div>${item.tags?.length>0?`<div class="flex flex-wrap gap-1 mt-2">${item.tags.map(tag=>`<span class="bg-white/5 px-1.5 py-0.5 rounded text-[11px] text-gray-500">${esc(tag)}</span>`).join('')}</div>`:''}</div></div></div>`).join(''):`<div class="glass-light rounded-lg p-4 text-center"><div class="text-gray-500 text-xs">${tx('暂无新闻同步','No synced news yet')}</div></div>`}<div class="text-[11px] text-gray-600 text-center">${tx('共','Total')} ${news.length} ${tx('条新闻','news items')} · ${tx('更新时间','Updated')}: ${new Date(data.lastUpdated).toLocaleString(state.uiLang==='en'?'en-US':'zh-CN')}</div></div>`;
    }

    function renderHeadToHead(data) {
        if (!data || data.dataQuality === "unavailable") return `<div class="text-gray-500 text-xs py-4 text-center">${tx('ESPN 暂无历史交锋样本','No historical H2H data from ESPN')}</div>`;
        const homeTeam=data.homeTeam||tx("主队","Home"),awayTeam=data.awayTeam||tx("客队","Away"),grouped=data.grouped||{},summary=data.summary||{},homeSummary=summary.home||{},awaySummary=summary.away||{},recentMatches=data.recentMatches||[];
        let html='<div class="space-y-3">';
        const recentHome=data.recent?.home||homeSummary.recent10||[];const recentAway=data.recent?.away||awaySummary.recent10||[];
        const wdl=r10=>{if(!r10.length)return'';let w=0,d=0,l=0;r10.forEach(m=>{if(m.result==='W')w++;else if(m.result==='D')d++;else l++;});return ` <span class=\"font-mono text-[11px] text-white/40\">${w}-${d}-${l}</span>`;};
        html+=`<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx('交锋走势','H2H Trend')}</div><div class="space-y-2"><div class="flex items-center gap-2"><span class="text-blue-400">●</span><span class="text-sm">${esc(homeSummary.summaryText||homeTeam+tx(" 数据不足"," Insufficient data"))}${wdl(recentHome)}</span></div><div class="flex items-center gap-2"><span class="text-red-400">●</span><span class="text-sm">${esc(awaySummary.summaryText||awayTeam+tx(" 数据不足"," Insufficient data"))}${wdl(recentAway)}</span></div></div></div>`;
        html+=`<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx('对阵记录','H2H History')}</div>`;
        const wc=grouped.worldCup;
        if(wc?.matches?.length) html+=`<div class="mb-3"><div class="flex items-center gap-2 mb-1"><span>🏆</span><span class="text-sm font-bold">${esc(wc.label||tx("世界杯","World Cup"))}</span><span class="text-[11px] text-gray-500">${tx('共 ','Total ')}${esc(wc.stats?.total||0)}${tx(' 场',' matches')}</span></div>${renderH2HMatchList(wc.matches)}</div>`;
        const other=grouped.other;
        if(other?.subGroups) for(const[subType,sub]of Object.entries(other.subGroups)) if(sub.matches?.length) html+=`<div class="mb-3"><div class="flex items-center gap-2 mb-1"><span>📁</span><span class="text-sm font-bold">${esc(sub.label||subType)}</span><span class="text-[11px] text-gray-500">${tx('共 ','Total ')}${esc(sub.stats?.total||0)}${tx(' 场',' matches')}</span></div>${renderH2HMatchList(sub.matches)}</div>`;
        if(!wc?.matches?.length&&!other?.subGroups) html+=recentMatches.length>0?`<div class="text-[11px] text-gray-500 mb-1">${tx('近期交锋','Recent Meetings')}</div>${renderH2HMatchList(recentMatches)}`:`<div class="text-gray-500 text-xs">${tx('暂无对阵记录','No H2H history')}</div>`;
        html+='</div>';
        if(summary.totalMatches>0) html+=`<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx('交锋统计','H2H Stats')}</div><div class="grid grid-cols-3 gap-2 text-center"><div><div class="text-xs text-blue-400">${esc(homeTeam)}</div><div class="text-lg font-bold">${esc(summary.homeWins||0)}${tx(' 胜',' Wins')}</div><div class="text-[11px] text-gray-500">${esc(summary.homeWinRate||"0%")}</div></div><div><div class="text-xs text-gray-500">${tx('平局','Draws')}</div><div class="text-lg font-bold text-yellow-400">${esc(summary.draws||0)}</div><div class="text-[11px] text-gray-500">${esc(summary.drawRate||"0%")}</div></div><div><div class="text-xs text-red-400">${esc(awayTeam)}</div><div class="text-lg font-bold">${esc(summary.awayWins||0)}${tx(' 胜',' Wins')}</div><div class="text-[11px] text-gray-500">${esc(summary.awayWinRate||"0%")}</div></div></div></div>`;
        html+='</div>';
        return html;
    }

    function renderH2HMatchList(matches) {
        if (!matches?.length) return `<div class="text-gray-600 text-xs">${tx('暂无比赛','No matches')}</div>`;
        return '<div class="space-y-1">'+matches.map(m=>{const score=m.score||(m.homeScore!==undefined?m.homeScore+"-"+m.awayScore:"0-0");const[hs,as]=score.split("-").map(Number);let cls="text-yellow-400";if(hs>as)cls="text-blue-400";else if(hs<as)cls="text-red-400";const teams=[m.homeTeamName,m.awayTeamName].filter(Boolean).join(' vs ');return `<div class="flex items-center justify-between text-[11px] py-1 border-b border-white/5"><span class="text-gray-600">${esc((m.date||"").substring(0,10))}</span><span class="text-gray-500 truncate px-2">${esc(teams||m.competition||"")}</span><span class="font-bold ${cls}">${esc(score)}</span></div>`;}).join("")+'</div>';
    }

    function renderMatchWeatherBlock(w) {
        if (!w) return '';
        const wmoEmoji = (code) => {
            if (code === 0) return '☀️';
            if (code <= 3) return ['🌤️','⛅','☁️'][Math.min(code - 1, 2)];
            if (code <= 48) return '🌫️';
            if (code <= 55) return '🌦️';
            if (code <= 65) return '🌧️';
            if (code <= 75) return '🌨️';
            if (code <= 82) return '🌧️';
            if (code >= 95) return '⛈️';
            return '🌤️';
        };
        const emoji = wmoEmoji(w.code);
        const tempColor = w.tC >= 32 ? 'rgba(248,113,113,.6)' : w.tC <= 10 ? 'rgba(59,130,246,.6)' : 'rgba(248,250,252,.5)';
        return `<div style="background:rgba(15,23,42,.45);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px 18px;box-shadow:0 4px 30px rgba(0,0,0,.4)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx('比赛天气', 'MATCH WEATHER')}</div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                <span style="font-size:28px">${emoji}</span>
                <div>
                    <div style="font:300 28px/1 'JetBrains Mono',monospace;color:${tempColor}">${w.tC}<span style="font-size:12px;color:rgba(248,250,252,.2)">°C</span></div>
                    <div style="font:400 9px/1 'Inter';color:rgba(248,250,252,.2);margin-top:2px">${tx('体感', 'Feels')} ${w.feelsC}°C</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);text-align:center">
                    <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">💧 ${tx('降水概率', 'Rain')}</div>
                    <div style="font:400 16px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.5)">${w.pp}<span style="font-size:9px;color:rgba(59,130,246,.3)">%</span></div>
                </div>
                <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);text-align:center">
                    <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">💨 ${tx('风速', 'Wind')}</div>
                    <div style="font:400 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${Math.round(w.windKmh)}<span style="font-size:9px;color:rgba(248,250,252,.2)">km/h</span></div>
                </div>
                <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);text-align:center">
                    <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">💦 ${tx('湿度', 'Humidity')}</div>
                    <div style="font:400 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${w.rh}<span style="font-size:9px;color:rgba(248,250,252,.2)">%</span></div>
                </div>
            </div>
        </div>`;
    }

    function renderVenueWeather(data) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">数据暂无</div>`;
        const v=data,w=v.weather,impact=v.impact;
        const weatherIcon=w?({Clear:'☀️',Clouds:'☁️',Rain:'🌧️',Snow:'❄️',Thunderstorm:'⛈️'}[w.condition]||'🌤️'):'🌤️';
        const impactColor=impact?.overall>10?'text-green-400':impact?.overall<-10?'text-red-400':'text-yellow-400';
        const impactEmoji=impact?.overall>10?'✅':impact?.overall<-10?'⚠️':'➡️';
        const grassIcon=(v.grass||'').includes('人工')?'🟢':(v.grass||'').includes('混合')?'🟡':'🌿';
        const roofIcon=v.roof==='closed'?'🏟️':v.roof==='retractable'?'🔄':'☁️';
        return `<div class="space-y-3"><div class="glass-light rounded-lg p-3"><div class="flex items-center gap-2 mb-2"><span class="text-lg">${roofIcon}</span><div><div class="font-bold text-sm">${esc(v.name)||'未知场馆'}</div><div class="text-[11px] text-gray-500">${esc(v.city)||''}, ${esc(v.country)||''}</div></div></div><div class="grid grid-cols-2 gap-2 text-[11px]"><div><span class="text-gray-500">容量</span><span class="font-bold ml-1">${v.capacity?.toLocaleString()||'-'}</span></div><div><span class="text-gray-500">海拔</span><span class="font-bold ml-1">${v.altitude||0}m</span></div><div><span class="text-gray-500">草皮</span><span class="ml-1">${grassIcon} ${esc(v.grass)||'未知'}</span></div><div><span class="text-gray-500">屋顶</span><span class="ml-1">${v.roof==='closed'?'封闭':v.roof==='retractable'?'可伸缩':'开放'}</span></div></div></div>${w?`<div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-gray-400">${weatherIcon} 天气状况</span><span class="text-[11px] text-gray-500">${esc(w.description)||''}</span></div><div class="grid grid-cols-3 gap-3 text-center"><div><div class="text-xl font-bold">${esc(w.temp)||'-'}°C</div><div class="text-[11px] text-gray-500">温度</div><div class="text-[11px] text-gray-600">体感 ${esc(w.feelsLike)||'-'}°C</div></div><div><div class="text-xl font-bold">${esc(w.humidity)||'-'}%</div><div class="text-[11px] text-gray-500">湿度</div></div><div><div class="text-xl font-bold">${w.windSpeed?esc(Math.round(w.windSpeed)):'-'}</div><div class="text-[11px] text-gray-500">风速 km/h</div></div></div></div>`:`<div class="glass-light rounded-lg p-3"><div class="text-center text-gray-500 text-xs"><div class="mb-1">🌤️ 天气数据</div><div>暂无实时天气</div></div></div>`}${impact?`<div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-gray-400">📊 场地影响分析</span><span class="text-xs ${impactColor} font-bold">${impactEmoji} ${impact.overall>0?'+':''}${esc(impact.overall)}</span></div><div class="grid grid-cols-2 gap-2 text-[11px] mb-2"><div><span class="text-gray-500">进攻</span><span class="font-bold ml-1 ${impact.attack>0?'text-green-400':impact.attack<0?'text-red-400':''}">${impact.attack>0?'+':''}${esc(impact.attack)}%</span></div><div><span class="text-gray-500">防守</span><span class="font-bold ml-1 ${impact.defense>0?'text-green-400':impact.defense<0?'text-red-400':''}">${impact.defense>0?'+':''}${esc(impact.defense)}%</span></div><div><span class="text-gray-500">控球</span><span class="font-bold ml-1 ${impact.possession>0?'text-green-400':impact.possession<0?'text-red-400':''}">${impact.possession>0?'+':''}${esc(impact.possession)}%</span></div><div><span class="text-gray-500">体能</span><span class="font-bold ml-1 ${impact.physical>0?'text-green-400':impact.physical<0?'text-red-400':''}">${impact.physical>0?'+':''}${esc(impact.physical)}%</span></div></div>${impact.details?.length?`<div class="border-t border-white/5 pt-2">${impact.details.map(d=>`<div class="text-[11px] text-gray-400 mb-1">• ${esc(d)}</div>`).join('')}</div>`:''}</div>`:''}</div>`;
    }

    function renderPreMatchPrediction(pred) {
        if (!pred || pred.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败','Prediction data unavailable')}</div>`;
        const homeName=displayMaybeTeamName(pred.match?.homeNameI18n||pred.match?.homeName||'主队'),awayName=displayMaybeTeamName(pred.match?.awayNameI18n||pred.match?.awayName||'客队');
        const eloHome=Fmt.safeNum(pred.components?.elo?.home,0),eloAway=Fmt.safeNum(pred.components?.elo?.away,0),eloTotal=eloHome+eloAway||1;
        const eloHomePct=Math.round((eloHome/eloTotal)*100),eloAwayPct=100-eloHomePct,eloDiff=Math.abs(eloHome-eloAway).toFixed(3);
        const hw=Fmt.pctBar(pred.homeWin),dr=Fmt.pctBar(pred.draw),aw=Fmt.pctBar(pred.awayWin);
        const homeLambda=Fmt.safeNum(pred.goals?.homeExpected||pred.components?.poisson?.homeLambda,0).toFixed(2);
        const awayLambda=Fmt.safeNum(pred.goals?.awayExpected||pred.components?.poisson?.awayLambda,0).toFixed(2);
        let html=`<div class="space-y-3"><div class="pred-section"><div class="pred-section-title text-purple-400"><span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">⚡</span>${tx('Elo 实力对比','Elo Comparison')}</div><div class="space-y-2"><div class="flex items-center gap-2"><span class="text-xs font-bold w-20 truncate">${esc(homeName)}</span><div class="elo-bar flex-1"><div class="elo-bar-fill" style="width:${eloHomePct}%"></div></div><span class="text-xs font-mono font-bold text-purple-400 w-12 text-right">${eloHomePct}%</span></div><div class="flex items-center gap-2"><span class="text-xs font-bold w-20 truncate">${esc(awayName)}</span><div class="elo-bar flex-1"><div class="elo-bar-fill" style="width:${eloAwayPct}%"></div></div><span class="text-xs font-mono font-bold text-purple-400 w-12 text-right">${eloAwayPct}%</span></div><div class="text-[10px] text-gray-500 text-center mt-1.5">${tx('Elo 差值','Elo Diff')}: ${eloDiff}</div></div></div>`;
        html+=`<div class="pred-section"><div class="pred-section-title text-blue-400"><span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">🎯</span>${tx('胜平负概率','W/D/L Probability')}</div><div class="prob-bar mb-2"><div class="prob-bar-home" style="width:${hw}%">${hw>12?hw+'%':''}</div><div class="prob-bar-draw" style="width:${dr}%">${dr>10?dr+'%':''}</div><div class="prob-bar-away" style="width:${aw}%">${aw>12?aw+'%':''}</div></div><div class="flex justify-between text-[11px]"><span class="text-green-400 font-bold">${tx('主胜','Home')} ${hw}%</span><span class="text-yellow-400 font-bold">${tx('平局','Draw')} ${dr}%</span><span class="text-red-400 font-bold">${tx('客胜','Away')} ${aw}%</span></div></div>`;
        html+=`<div class="pred-section"><div class="pred-section-title text-emerald-400"><span class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">📊</span>${tx('进球期望值 (λ)','Expected Goals (λ)')}</div><div class="grid grid-cols-2 gap-2"><div class="elo-card"><div class="text-xs font-bold mb-1.5 text-emerald-300">${esc(homeName)}</div><div class="text-sm font-mono font-bold text-emerald-400">${homeLambda}</div><div class="text-[10px] text-gray-500 mt-0.5">${tx('场均进球','Avg Goals')}</div></div><div class="elo-card"><div class="text-xs font-bold mb-1.5 text-red-300">${esc(awayName)}</div><div class="text-sm font-mono font-bold text-red-400">${awayLambda}</div><div class="text-[10px] text-gray-500 mt-0.5">${tx('场均进球','Avg Goals')}</div></div></div></div>`;
        if(pred.tacticalScenario?.applicable) html+=renderTacticalScenario(pred.tacticalScenario);
        html+='</div>';
        return html;
    }
    function renderTacticalScenario(ts) {
        const L=(o)=>esc(window.WorldCup.I18n.i18nText(o,'')),focusIds=Object.keys(ts.teams||{});
        const standings=(ts.standings||[]).map(s=>`<div class="flex items-center gap-2 text-[10px] py-0.5 ${focusIds.includes(s.id)?'text-white font-semibold':'text-gray-400'}"><span class="w-4 text-gray-500">${s.rank}</span><span class="flex-1 truncate">${L(s.name)}</span><span class="w-7 text-right font-mono">${s.pts}</span><span class="w-8 text-right font-mono text-gray-500">${s.gd>=0?'+':''}${s.gd}</span></div>`).join('');
        const row=(label,sc)=>{if(!sc)return'';return`<div class="flex justify-between text-[10px] py-0.5"><span class="text-gray-500">${label}</span><span class="font-semibold ${sc.gdDependent?'text-amber-400':'text-gray-200'}">${L(sc.status)}</span></div>`;};
        const oppLine=(label,info)=>(info?.opponent)?`<div class="flex justify-between text-[10px]"><span class="text-gray-500">${label}</span><span class="text-gray-300 text-right">${L(info.opponent.label)}${info.opponent.elo?` <span class="text-gray-500">Elo ${info.opponent.elo}</span>`:''}</span></div>`:'';
        const teamCards=Object.values(ts.teams||{}).map(t=>{const locked=t.locked?`<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">${L(t.locked)}</span>`:'';const br=t.bracket||{};const inc=br.incentive?`<div class="text-[10px] text-amber-300/90 mt-1 leading-snug">⚠ ${L(br.incentive.note)}</div>`:'';return`<div class="elo-card"><div class="flex items-center justify-between mb-1 gap-1"><span class="text-xs font-bold truncate">${L(t.name)}</span>${locked}</div>${row(tx('胜','Win'),t.ifWin)}${row(tx('平','Draw'),t.ifDraw)}${row(tx('负','Lose'),t.ifLose)}<div class="border-t border-white/5 mt-1.5 pt-1.5 space-y-0.5"><div class="text-[9px] text-gray-500 mb-0.5">${tx('下一轮对阵 (R32)','Next round (R32)')}</div>${oppLine(tx('若第一','If 1st'),br.asFirst)}${oppLine(tx('若第二','If 2nd'),br.asSecond)}${inc}</div></div>`;}).join('');
        const notes=(ts.notes||[]).map(n=>`<div class="text-[10px] text-amber-300/90 leading-snug">• ${L(n)}</div>`).join('');
        return `<div class="pred-section"><div class="pred-section-title text-amber-400"><span class="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs">🎲</span>${tx('末轮战略情境','Final-Round Scenario')}<span class="text-[9px] text-gray-500 font-normal ml-1">${tx('情境推演·非比分预测','scenario · not a forecast')}</span></div><div class="glass-light rounded-lg p-2 mb-2"><div class="text-[9px] text-gray-500 mb-1">${tx('小组','Group')} ${esc(ts.groupLetter||'')} · ${tx('当前积分榜','current table')}</div>${standings}<div class="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-white/5">${tx('同时进行','Simultaneous')}: ${L(ts.parallelMatch?.homeName)} vs ${L(ts.parallelMatch?.awayName)}</div></div><div class="grid grid-cols-2 gap-2">${teamCards}</div>${notes?`<div class="mt-2 space-y-1">${notes}</div>`:''}<div class="text-[9px] text-gray-600 mt-2 leading-snug">${L(ts.disclaimer)}</div></div>`;
    }
    function renderCornerAnalysis(data) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('数据暂无','No data')}</div>`;
        const p=data.predicted,o=data.odds,r=data.realtime,h=data.historical;
        const trend=r.trend||'neutral',trendEmoji={over_strong:'🔴',over_slight:'🟠',under_strong:'🔵',under_slight:'🟤'}[trend]||'⚪';
        const conf=r.confidence==='high'?'🟢':r.confidence==='medium'?'🟡':'⚪';
        const progressPct=Math.min(100,((r.current?.total||0)/(o?.line||9.5))*100),expectedPct=r.progress?.expected||0;
        const paceStatus=r.pace==='above'?`⚡${tx('节奏快','Fast pace')}`:r.pace==='below'?`• ${tx('节奏慢','Slow pace')}`:`✓${tx('正常','Normal')}`;
        const paceColor=r.pace==='above'?'text-yellow-400':r.pace==='below'?'text-blue-400':'text-green-400';
        return `<div class="space-y-3"><div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-gray-400">📐 ${tx('角球预测','Corner Forecast')}</span><span class="text-xs text-gray-500">${tx('盘口线','Line')} <span class="font-bold text-white">${o?.line||9.5}</span></span></div><div class="flex items-center gap-3 mb-3"><div class="text-center"><div class="text-2xl font-bold text-white">${p?.total||'-'}</div><div class="text-[11px] text-gray-500">${tx('预测总角球','Projected Corners')}</div></div><div class="flex-1"><div class="flex items-center gap-1 mb-1"><span class="text-xs">${trendEmoji}</span><span class="text-xs font-bold ${trend.includes('over')?'text-red-400':trend.includes('under')?'text-blue-400':'text-gray-400'}">${esc(trend.replace('_',' ').toUpperCase())}</span><span class="ml-auto">${conf}</span></div><div class="text-[11px] text-gray-500">${tx('实际','Actual')} <span class="font-bold text-white">${r.current?.total||0}</span> / ${o?.line||9.5}</div></div></div><div class="relative h-4 bg-white/5 rounded-full overflow-hidden mb-2"><div class="absolute top-0 bottom-0 w-0.5 bg-yellow-500/50" style="left:${expectedPct}%"></div><div class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700" style="width:${progressPct}%"></div><div class="absolute inset-0 flex items-center justify-between px-2 text-[9px]"><span class="text-white font-bold">${r.current?.total||0}</span><span class="text-gray-400">${Math.round(progressPct)}%</span></div></div><div class="flex items-center justify-between text-[11px]"><span class="text-gray-500">${esc(window.WorldCup.I18n.translateCoachField(h?.homeStyle,'style')||tx('均衡型','Balanced'))} ${tx('对阵','vs')} ${esc(window.WorldCup.I18n.translateCoachField(h?.awayStyle,'style')||tx('均衡型','Balanced'))}</span><span class="${paceColor} font-bold">${paceStatus}</span></div></div><div class="grid grid-cols-2 gap-2"><div class="glass-light rounded-lg p-2"><div class="text-[11px] text-gray-500 mb-1">🔵 ${tx('主队','Home')}</div><div class="text-sm font-bold">${h?.homeAvg||'-'} ${tx('场均','avg')}</div><div class="text-[11px] text-gray-600">${esc(window.WorldCup.I18n.translateCoachField(h?.homeStyle,'style')||tx('均衡型','Balanced'))} (${esc(h?.homeStyleCoeff)||1}x)</div></div><div class="glass-light rounded-lg p-2"><div class="text-[11px] text-gray-500 mb-1">🔴 ${tx('客队','Away')}</div><div class="text-sm font-bold">${h?.awayAvg||'-'} ${tx('场均','avg')}</div><div class="text-[11px] text-gray-600">${esc(window.WorldCup.I18n.translateCoachField(h?.awayStyle,'style')||tx('均衡型','Balanced'))} (${esc(h?.awayStyleCoeff)||1}x)</div></div></div>${data.verdict?.reason||data.verdict?.reasonI18n?`<div class="glass-light rounded-lg p-2"><div class="text-[11px] text-gray-500 mb-1">📊 ${tx('分析结论','Verdict')}</div><div class="text-xs text-gray-300">${esc(window.WorldCup.I18n.i18nText(data.verdict.reasonI18n,data.verdict.reason||''))}</div></div>`:''}</div>`;
    }

    window.WorldCup.MatchDetail = { openMatch, switchDetailTab, closeModal, renderVenueWeather, renderNewsList, renderHeadToHead, renderPreMatchPrediction, renderTacticalScenario, renderCornerAnalysis };
    window.openMatch = openMatch;
    window.switchDetailTab = switchDetailTab;
    window.closeModal = closeModal;
})();
