// ========== match-detail.js - Match Detail Module ==========
(function() {
    const { tx, esc, displayMaybeTeamName, attr, api, withClientTimeout } = window.WorldCup.Utils;
    const t = window.t;
    const state = window.WorldCup.State;

    async function openMatch(id) {
        const modal = document.getElementById('match-modal');
        const content = document.getElementById('modal-content');
        modal.classList.remove('hidden');
        content.innerHTML = `<div class="py-10 text-center text-gray-500">${tx('加载中...', 'Loading...')}</div>`;

        const [matchData, matchupData] = await window.WorldCup.ApiClient.allData([
            '/api/match/' + id, '/api/matchup/' + id + '/formation',
        ]);

        if (!matchData) { content.innerHTML = `<div class="py-10 text-center text-red-400">${tx('加载失败', 'Failed to load')}</div>`; return; }
        const scheduledMatch = state.scheduleCache.find(m => String(m.id) === String(id)) || {};
        const isFinishedMatch = scheduledMatch.state === 'post' || matchData.state === 'post';

        let html = `<h3 class="font-bold text-base mb-4">${tx('比赛详情', 'Match Details')}</h3>`;
        html += `<div class="mb-4">${window.WorldCup.MatchRenderers.renderFormation(matchupData, isFinishedMatch)}</div>`;
        html += `<div id="detail-content-venue" class="detail-content"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载场地天气数据...', 'Loading venue and weather...')}</span></div></div>`;
        
        const knownVenue = scheduledMatch.venue || matchData.venue || '';
        const loadVenue = () => {
            const venueEl = document.getElementById('detail-content-venue');
            if (venueEl && knownVenue) venueEl.innerHTML = `<div class="text-gray-500 text-xs py-2">🏟️ ${tx('已知场馆', 'Known venue')}: ${esc(knownVenue)} · ${tx('加载场地资料...', 'Loading venue details...')}</div>`;
            if (knownVenue) {
                api('/api/venue/' + encodeURIComponent(knownVenue)).then(venueData => {
                    const el = document.getElementById('detail-content-venue');
                    if (el && venueData && !venueData.error && !venueData.note) el.innerHTML = renderVenueWeather(venueData);
                    else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('场地资料未同步；不以当前天气替代比赛时段天气。', 'Venue details are not synced; current weather is not substituted for match-time weather.')}</div>`;
                }).catch(() => { const el = document.getElementById('detail-content-venue'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('场地资料暂不可用', 'Venue details are unavailable')}</div>`; });
            } else if (venueEl) { venueEl.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('场馆信息未随比赛数据返回。', 'Venue information was not returned with match data.')}</div>`; }
        };
        
        html += `<div id="detail-content-bench" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载替补席数据...', 'Loading bench data...')}</span></div></div>`;
        api('/api/match/' + id + '/bench').then(benchData => {
            const el = document.getElementById('detail-content-bench');
            if (el && benchData && !benchData.error) {
                el.innerHTML = window.WorldCup.MatchRenderers.renderBenchAnalysis(benchData, isFinishedMatch);
                if (benchData.realSubstitutions?.length > 0) window.WorldCup.MatchRenderers.applySubstitutionsToFormation(benchData.realSubstitutions);
            } else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${isFinishedMatch ? tx('官方替补与换人数据尚未同步', 'Official bench and substitution data is not synced') : tx('替补席数据暂无', 'No bench data')}</div>`;
        });
        
        html += `<div id="detail-content-news" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载新闻数据...', 'Loading news...')}</span></div></div>`;
        api('/api/match/' + id + '/news').then(newsRes => { const newsData = newsRes?.data || newsRes; const el = document.getElementById('detail-content-news'); if (el && newsData && !newsData.error) el.innerHTML = renderNewsList(newsData); else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('暂无新闻同步', 'No synced news yet')}</div>`; });
        
        html += `<div id="detail-content-h2h" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载历史交锋数据...', 'Loading head-to-head data...')}</span></div></div>`;
        withClientTimeout(api('/api/h2h/' + id), 8000).then(h2hRes => { const h2hData = h2hRes?.data || h2hRes; const el = document.getElementById('detail-content-h2h'); if (el && h2hData && !h2hData.error) el.innerHTML = renderHeadToHead(h2hData); else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('ESPN 暂无历史交锋样本', 'No ESPN head-to-head sample')}</div>`; });

        const showPreMatch = !isFinishedMatch && (scheduledMatch.state === 'pre' || (matchData.status?.type?.name || '').includes('SCHEDULED'));
        html += `<div class="mt-4"><div class="flex gap-1.5 mb-3 overflow-x-auto" id="detail-tabs">`;
        if (showPreMatch) html += `<button data-action="switch-detail-tab" data-detail-tab="pre-match" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white transition">🧠 ${tx('赛前预测', 'Pre-Match')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="review" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold ${showPreMatch ? 'bg-white/5 text-gray-400' : 'bg-white/10 text-white'} transition">📋 ${tx('回顾', 'Review')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="venue" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">🏟️ ${tx('场地', 'Venue')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="bench" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">🔄 ${tx('替补', 'Bench')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="news" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">📰 ${tx('新闻', 'News')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="h2h" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">⚔️ ${tx('交锋', 'H2H')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="stats" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">📊 ${tx('统计', 'Stats')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="corners" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">📐 ${tx('角球', 'Corners')}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="coach" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">🧠 ${tx('教练', 'Coach')}</button>`;
        html += `</div>`;
        if (showPreMatch) html += `<div id="detail-content-pre-match" class="detail-content"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载赛前预测...', 'Loading pre-match prediction...')}</span></div></div>`;
        html += `<div id="detail-content-review" class="detail-content"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载比赛回顾...', 'Loading match review...')}</span></div></div>`;
        html += `<div id="detail-content-stats" class="detail-content"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载统计数据...', 'Loading stats...')}</span></div></div>`;
        html += `<div id="detail-content-corners" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx('加载角球数据...', 'Loading corner data...')}</span></div></div>`;
        html += `<div id="detail-content-coach" class="detail-content hidden">${window.WorldCup.MatchRenderers.renderCoachPanel(matchData, isFinishedMatch)}</div>`;
        html += '</div>';

        content.innerHTML = html;
        loadVenue();

        // Stats loading
        const isFin = isFinishedMatch;
        const mHomeId = scheduledMatch.home?.id || matchData.home?.id || matchData.homeId;
        const mAwayId = scheduledMatch.away?.id || matchData.away?.id || matchData.awayId;
        const mHomeScore = parseInt(scheduledMatch.home?.score ?? matchData.home?.score ?? '0');
        const mAwayScore = parseInt(scheduledMatch.away?.score ?? matchData.away?.score ?? '0');
        const statsEl = document.getElementById('detail-content-stats');
        if (statsEl && isFin && matchData.teamStats?.length) {
            let statsHtml = '';
            if (matchData.goals?.length) { statsHtml += `<h4 class="text-xs font-bold text-gray-500 mb-2">⚽ ${tx('进球', 'Goals')}</h4>`; statsHtml += matchData.goals.map(g => `<div class="flex items-center gap-2 text-xs py-1"><span class="text-gray-500 w-10">${esc(g.minute)}</span><span class="font-medium">${esc(g.player)}</span><span class="text-gray-600">(${esc(g.team)})</span></div>`).join(''); }
            statsHtml += `<h4 class="text-xs font-bold text-gray-500 mb-2 mt-3">📊 ${tx('技术统计', 'Match Stats')}</h4>`;
            statsHtml += window.WorldCup.MatchStats.renderMatchStats(matchData.teamStats);
            statsEl.innerHTML = statsHtml;
        } else if (statsEl && isFin) { statsEl.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center"><p>⏳ ${tx('赛后统计暂未同步', 'Post-match stats not synced')}</p></div>`; }
        else if (statsEl) {
            const hId = mHomeId || matchData.home?.id, aId = mAwayId || matchData.away?.id;
            if (hId && aId) {
                Promise.allSettled([hId ? api('/api/team/' + hId + '/recent-stats') : Promise.resolve(null), aId ? api('/api/team/' + aId + '/recent-stats') : Promise.resolve(null)]).then(([h, a]) => {
                    const el = document.getElementById('detail-content-stats'); if (!el) return;
                    const hVal = h.value?.data || h.value;
                    const aVal = a.value?.data || a.value;
                    const hs = (h.status === 'fulfilled' && hVal?.stats) ? hVal : null;
                    const as = (a.status === 'fulfilled' && aVal?.stats) ? aVal : null;
                    if (!hs && !as) { el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center"><p>📊 ${tx('赛前暂无可用统计', 'No pre-match stats')}</p></div>`; return; }
                    const hName = displayMaybeTeamName(matchData.home?.nameI18n || matchData.home?.name || '');
                    const aName = displayMaybeTeamName(matchData.away?.nameI18n || matchData.away?.name || '');
                    let s = `<h4 class="text-xs font-bold text-gray-500 mb-2">📊 ${tx('近期场均统计', 'Recent Avg Stats')}</h4><p class="text-[10px] text-gray-500 mb-3">${tx('基于近期完赛记录生成，非预测。', 'Based on recent completed matches, not predictions.')}</p>`;
                    s += window.WorldCup.MatchStats.renderRecentAvgComparison(hs, as, hName, aName);
                    el.innerHTML = s;
                }).catch(() => { const el = document.getElementById('detail-content-stats'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('统计数据加载失败', 'Failed to load stats')}</div>`; });
            }
        }

        if (showPreMatch) {
            api('/api/predict/' + id).then(predRes => { const pred = predRes?.data || predRes; const el = document.getElementById('detail-content-pre-match'); if (el && pred && !pred.error && pred.homeWin !== undefined) el.innerHTML = renderPreMatchPrediction(pred); else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction data unavailable')}</div>`; }).catch(() => { const el = document.getElementById('detail-content-pre-match'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction data unavailable')}</div>`; });
        }

        api('/api/corner-analysis/' + id).then(cornerRes => { const corner = cornerRes?.data || cornerRes; const el = document.getElementById('detail-content-corners'); if (el && corner && !corner.error) el.innerHTML = renderCornerAnalysis(corner); else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('角球数据暂无', 'No corner data')}</div>`; });

        if (isFin && mHomeId && mAwayId) {
            fetch('/api/post-match-review/' + id).then(r => r.json()).then(async review => {
                if (review && !review.error) {
                    if (!review.aiPrediction) { const pred = await api('/api/predict/' + id); if (pred && !pred.error && pred.homeWin !== undefined) { review.aiPrediction = { homeWin: Math.round((pred.homeWin || 0) * 1000) / 10, draw: Math.round((pred.draw || 0) * 1000) / 10, awayWin: Math.round((pred.awayWin || 0) * 1000) / 10, predictedScore: pred.likelyScore || '', source: 'current_model' }; review.predictionSourceNote = tx('赛前预测快照缺失', 'Pre-match snapshot missing'); } }
                    const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = window.WorldCup.MatchReview.renderMatchReview(review);
                } else { const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = `<div class="review-unavailable"><p>${tx('赛后复盘暂未生成', 'Post-match review not yet available')}</p></div>`; }
            }).catch(() => { const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">比赛回顾暂不可用</div>`; });
        } else { const el = document.getElementById('detail-content-review'); if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">⏳ 比赛结束后自动生成回顾</div>`; }

        if (mHomeId && mAwayId) {
            withClientTimeout(window.WorldCup.ApiClient.get('/api/coach-compare/' + mHomeId + '/' + mAwayId, { timeout: window.WorldCup.ApiClient.TIMEOUT_LONG }), 8000).then(res => {
                const el = document.getElementById('detail-content-coach'); const coachData = res?.data;
                if (el && coachData && !coachData.error) { el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(coachData, isFinishedMatch); }
                else if (el) { Promise.allSettled([window.WorldCup.ApiClient.get('/api/coach/' + mHomeId, { timeout: 5000 }), window.WorldCup.ApiClient.get('/api/coach/' + mAwayId, { timeout: 5000 })]).then(([homeR, awayR]) => { if (el) { const homeC = homeR.status === 'fulfilled' && homeR.value?.data && !homeR.value.data.error ? homeR.value.data : null; const awayC = awayR.status === 'fulfilled' && awayR.value?.data && !awayR.value.data.error ? awayR.value.data : null; el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel({ coachA: homeC, coachB: awayC, comparison: null, _fallback: true }, isFinishedMatch); } }).catch(() => { if (el) el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(null, isFinishedMatch); }); }
            }).catch(() => { const el = document.getElementById('detail-content-coach'); if (el) el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(null, isFinishedMatch); });
        } else { const el = document.getElementById('detail-content-coach'); if (el) el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(null, isFinishedMatch); }
    }

    function switchDetailTab(tab, btn) { document.querySelectorAll('.detail-content').forEach(el => el.classList.add('hidden')); document.querySelectorAll('.detail-tab').forEach(el => { el.classList.remove('bg-white/10', 'text-white'); el.classList.add('bg-white/5', 'text-gray-400'); }); document.getElementById('detail-content-' + tab)?.classList.remove('hidden'); if (btn) { btn.classList.remove('bg-white/5', 'text-gray-400'); btn.classList.add('bg-white/10', 'text-white'); } }

    function closeModal() { document.getElementById('match-modal').classList.add('hidden'); }

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
        html+=`<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx('交锋走势','H2H Trend')}</div><div class="space-y-2"><div class="flex items-center gap-2"><span class="text-blue-400">●</span><span class="text-sm">${esc(homeSummary.summaryText||homeTeam+tx(" 数据不足"," Insufficient data"))}</span></div><div class="flex items-center gap-2"><span class="text-red-400">●</span><span class="text-sm">${esc(awaySummary.summaryText||awayTeam+tx(" 数据不足"," Insufficient data"))}</span></div></div></div>`;
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
