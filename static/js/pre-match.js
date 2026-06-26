(function() {
    'use strict';
    const API = window.WorldCup.ApiClient;
    const { tx, esc, withClientTimeout } = window.WorldCup.Utils;
    const { renderSpatialMatchupPanel } = window.WorldCup.SpatialMatchup;
    const { renderVenueWeather, renderCornerAnalysis } = window.WorldCup.MatchDetail;
    const { scheduleCache } = window.WorldCup.State;
    const { renderRecentAvgComparison } = window.WorldCup.MatchStats;
    
    async function openPreMatch(matchId, homeId, awayId, homeName, awayName, venueName = '') {
        const modal = document.getElementById('match-modal');
        const content = document.getElementById('modal-content');
        modal.classList.remove('hidden');
        content.innerHTML = `<div class="py-10 text-center text-gray-500">${tx('加载赛前分析...', 'Loading pre-match analysis...')}</div>`;
        const spatialResult = await API.get(`/api/matchup-spatial/${homeId}/${awayId}`, { timeout: API.TIMEOUT_LONG });
        const spatialData = spatialResult.data;
        let html = `<h3 class="font-bold text-base mb-2">📋 ${tx('赛前分析', 'Pre-match Analysis')}</h3>`;
        html += `<div class="mb-4">${renderSpatialMatchupPanel(spatialData)}</div>`;
        const scheduledVenue = venueName || scheduleCache.find(m => String(m.id) === String(matchId))?.venue || '';
        html += `<div id="pre-match-venue" class="glass rounded-xl p-3 mb-3 text-xs text-gray-500">🏟️ ${scheduledVenue ? `${tx('已知场馆', 'Known venue')}: ${esc(scheduledVenue)} · ${tx('加载场地条件...', 'Loading venue conditions...')}` : tx('加载场地与天气...', 'Loading venue & weather...')}</div>`;
        html += `<div class="mt-4">
            <div class="flex gap-1.5 mb-3 overflow-x-auto">
                <button data-action="switch-detail-tab" data-detail-tab="stats" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white">📊 ${tx('统计', 'Stats')}</button>
                <button data-action="switch-detail-tab" data-detail-tab="corners" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400">📐 ${tx('角球', 'Corners')}</button>
                <button data-action="switch-detail-tab" data-detail-tab="coach" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400">🧠 ${tx('教练', 'Coach')}</button>
            </div>
            <div id="detail-content-stats" class="detail-content">
                <div class="flex items-center gap-2 mb-3">
                    <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                    <span class="text-xs text-gray-500">${tx('加载统计数据...', 'Loading stats...')}</span>
                </div>
            </div>
            <div id="detail-content-corners" class="detail-content hidden">
                <div class="text-gray-500 text-xs py-4 text-center">${tx('加载角球数据...', 'Loading corner data...')}</div>
            </div>
            <div id="detail-content-coach" class="detail-content hidden">
                <div class="flex items-center gap-2 mb-3">
                    <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                    <span class="text-xs text-gray-500">${tx('加载教练数据...', 'Loading coach data...')}</span>
                </div>
            </div>
        </div>`;
        content.innerHTML = html;
        Promise.allSettled([
            homeId ? API.get(`/api/team/${homeId}/recent-stats`) : Promise.resolve({ data: null }),
            awayId ? API.get(`/api/team/${awayId}/recent-stats`) : Promise.resolve({ data: null }),
        ]).then(([hRes, aRes]) => {
            const el = document.getElementById('detail-content-stats');
            if (!el) return;
            const hs = (hRes.status === 'fulfilled' && hRes.value?.data?.stats) ? hRes.value.data : null;
            const as = (aRes.status === 'fulfilled' && aRes.value?.data?.stats) ? aRes.value.data : null;
            if (!hs && !as) {
                el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">
                    <p>📊 ${tx('赛前暂无可用统计', 'No pre-match stats')}</p>
                    <p class="text-gray-600 mt-1 text-[10px]">${tx('缺乏近期完赛记录，无法生成场均统计。', 'Insufficient completed matches to generate averages.')}</p>
                </div>`;
                return;
            }
            const hName = homeName || (hs?.teamId || '');
            const aName = awayName || (as?.teamId || '');
            let statsHtml = `<h4 class="text-xs font-bold text-gray-500 mb-2">📊 ${tx('近期场均统计', 'Recent Avg Stats')}</h4>`;
            statsHtml += `<p class="text-[10px] text-gray-500 mb-3">${tx('基于近期完赛记录生成，非预测。', 'Based on recent completed matches, not predictions.')}</p>`;
            statsHtml += renderRecentAvgComparison(hs, as, hName, aName);
            el.innerHTML = statsHtml;
        }).catch(() => {
            const el = document.getElementById('detail-content-stats');
            if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('统计数据加载失败', 'Failed to load stats')}</div>`;
        });
        withClientTimeout(API.get('/api/coach-compare/' + homeId + '/' + awayId, { timeout: API.TIMEOUT_LONG }), 8000).then(res => {
            const el = document.getElementById('detail-content-coach');
            const coachData = res?.data;
            if (el && coachData && !coachData.error) {
                el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(coachData, false);
            } else if (el) {
                el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(null, false);
            }
        }).catch(() => {
            const el = document.getElementById('detail-content-coach');
            if (el) el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(null, false);
        });
        const venueRequest = scheduledVenue
            ? API.get('/api/venue/' + encodeURIComponent(scheduledVenue), { timeout: API.TIMEOUT_LONG }).then(r => r.data)
            : API.get('/api/match/' + matchId).then(r => {
                const match = r.data;
                const fallbackVenue = match?.venue || '';
                return fallbackVenue ? API.get('/api/venue/' + encodeURIComponent(fallbackVenue), { timeout: API.TIMEOUT_LONG }).then(r2 => r2.data) : null;
            });
        venueRequest.then(venue => {
            const el = document.getElementById('pre-match-venue');
            if (!el) return;
            el.innerHTML = venue && !venue.error
                ? renderVenueWeather(venue)
                : `<div class="text-gray-500 text-xs py-2">🏟️ ${tx('场地或实时天气暂不可用；该信息不参与预测。', 'Venue or live weather is unavailable; it is not used in the prediction.')}</div>`;
        }).catch(() => {
            const el = document.getElementById('pre-match-venue');
            if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-2">🏟️ ${tx('场地或实时天气暂不可用；该信息不参与预测。', 'Venue or live weather is unavailable; it is not used in the prediction.')}</div>`;
        });
        API.get('/api/corner-analysis/' + matchId).then(res => {
            const el = document.getElementById('detail-content-corners');
            if (el && res.ok && res.data) el.innerHTML = renderCornerAnalysis(res.data);
            else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('角球数据暂无', 'No corner data')}</div>`;
        });
    }
    
    window.WorldCup.PreMatch = { openPreMatch };
    Object.assign(window, { openPreMatch });
})();