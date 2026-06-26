/**
 * team-detail.js — Teams grid & team detail modal
 * Extracted from app.js
 */
(function () {
    'use strict';

    const esc   = (...a) => (window.WorldCup.Utils?.esc   || ((s) => s))(...a);
    const attr  = (...a) => (window.WorldCup.Utils?.attr  || ((s) => s))(...a);
    const tx    = (...a) => (window.WorldCup.I18n?.t      || ((z,e) => e))(...a);
    const api   = (...a) => (window.WorldCup.Utils?.api   || (async () => ({})))(...a);
    const displayMaybeTeamName  = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName  || ((x) => x))(...a);
    const displayGroupName      = (...a) => (window.WorldCup.I18n?.displayGroupName      || ((x) => x))(...a);
    const translatePlayerName   = (...a) => (window.WorldCup.I18n?.translatePlayerName   || ((x) => x))(...a);
    const translateCoachField   = (...a) => (window.WorldCup.I18n?.translateCoachField   || ((x) => x))(...a);

    let allTeams = [];

    async function refreshTeamsFromStandings() {
        const d = await api('/api/standings');
        if (d?.groups) {
            allTeams = [];
            for (const g of d.groups) {
                for (const t of g.standings) {
                    allTeams.push({ ...t, group: g.name });
                }
            }
        }
        return allTeams;
    }

    function findTeamStanding(teamId) {
        return allTeams.find(team => String(team.id) === String(teamId)) || null;
    }

    function groupRecordFromStanding(team) {
        if (!team) return null;
        return {
            w: Number(team.wins) || 0, d: Number(team.draws) || 0,
            l: Number(team.losses) || 0, gf: Number(team.gf) || 0,
            ga: Number(team.ga) || 0, gd: Number(team.gd) || 0,
            pts: Number(team.pts) || 0,
        };
    }

    async function loadTeams() {
        const el = document.getElementById('teams-grid');
        if (!allTeams.length) {
            el.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">⚽ ${tx('teamsLoading')}</div>`;
            try { await refreshTeamsFromStandings(); } catch (e) {
                el.innerHTML = `<div class="col-span-full text-center py-10 text-red-400">⚠️ ${tx('teamsError')}</div>`;
                return;
            }
        }
        el.innerHTML = allTeams.map(team => `
            <div class="card glass rounded-xl p-3 cursor-pointer" data-action="open-team-detail" data-team-id="${attr(team.id)}" data-team-name="${attr(team.name)}" data-group="${attr(team.group)}">
                <div class="flex items-center gap-2 mb-2">
                    ${team.logo ? `<img src="${attr(team.logo)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">` : ''}
                    <div>
                        <div class="font-bold text-sm">${esc(displayMaybeTeamName(team))}</div>
                        <div class="text-[11px] text-gray-500">${esc(displayGroupName(team.group))}</div>
                    </div>
                </div>
                <div class="flex items-center gap-3 text-[11px] text-gray-500">
                    <span>${esc(tx('pointsLabel'))} <span class="text-blue-400 font-bold tabular-nums">${esc(team.pts)}</span></span>
                    <span class="tabular-nums">${esc(team.wins)}-${esc(team.draws)}-${esc(team.losses)}</span>
                </div>
            </div>
        `).join('') || `<div class="col-span-full text-center text-gray-500 py-10">${esc(tx('teamsLoading'))}</div>`;
    }

    function renderTeamWCMatches(data) {
        const matches = data?.matches;
        if (!matches || !matches.length) return '';
        const resultBadge = r => {
            if (r === 'W') return `<span class="text-[11px] font-bold text-green-400 w-5 text-center">${tx('胜','W')}</span>`;
            if (r === 'D') return `<span class="text-[11px] font-bold text-yellow-400 w-5 text-center">${tx('平','D')}</span>`;
            if (r === 'L') return `<span class="text-[11px] font-bold text-red-400 w-5 text-center">${tx('负','L')}</span>`;
            return `<span class="text-[11px] text-gray-600 w-5 text-center">-</span>`;
        };
        const stateLabel = s => s === 'post' ? `<span class="text-[10px] text-gray-600">FT</span>`
            : s === 'in' ? `<span class="text-[10px] text-red-400 animate-pulse">LIVE</span>`
            : `<span class="text-[10px] text-blue-400">${tx('待赛','TBD')}</span>`;
        const rows = matches.map(m => {
            const opp = m.opponent;
            const oppName = opp ? (opp.name || opp.abbreviation || '?') : '?';
            const score = (m.state === 'post' || m.state === 'in') ? `${m.score?.home ?? '-'} : ${m.score?.away ?? '-'}` : 'vs';
            const dateStr = m.dateBJT ? m.dateBJT.split(' ')[0].replace(/\//g, '-') : (m.date ? m.date.slice(0, 10) : '');
            const homeAwayLabel = m.isHome ? `<span class="text-[10px] text-blue-400/70">${tx('主','H')}</span>` : `<span class="text-[10px] text-gray-500">${tx('客','A')}</span>`;
            return `<div class="flex items-center gap-2 py-1.5 px-2 glass-light rounded-lg text-xs cursor-pointer hover:bg-white/10 transition-colors" data-action="open-match" data-match-id="${attr(m.matchId)}">${resultBadge(m.result)}${homeAwayLabel}<span class="flex-1 truncate font-medium">${esc(oppName)}</span><span class="tabular-nums text-gray-300 font-bold">${esc(score)}</span>${stateLabel(m.state)}<span class="text-gray-600 text-[10px] min-w-[54px] text-right">${esc(dateStr)}</span></div>`;
        }).join('');
        const completedCount = matches.filter(m => m.state === 'post').length;
        const totalCount = matches.length;
        const note = completedCount > 0 ? tx(`本届世界杯 · 共 ${totalCount} 场 · ${completedCount} 场已结束`, `World Cup · ${totalCount} matches · ${completedCount} completed`) : tx(`本届世界杯 · 共 ${totalCount} 场赛程`, `World Cup · ${totalCount} scheduled`);
        return `<div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-cyan-400">📅 ${tx('本届赛程', 'WC Record')}</span><span class="text-[11px] text-gray-600">${esc(note)}</span></div><div class="space-y-1">${rows}</div><div class="mt-2 text-[10px] text-gray-700">ESPN 实时 · 仅含本届世界杯比赛</div></div>`;
    }

    function getRosterRole(p, posGroup, rankInGroup) {
        const apps = p.appearances || 0;
        const subs = p.subIns || 0;
        if (apps > 0) { return apps > subs ? 'starter' : 'keySub'; }
        if (posGroup === 'GK') return rankInGroup === 0 ? 'starter' : rankInGroup === 1 ? 'keySub' : 'reserve';
        if (posGroup === 'DF') return rankInGroup < 4 ? 'starter' : rankInGroup < 6 ? 'keySub' : 'reserve';
        if (posGroup === 'MF') return rankInGroup < 4 ? 'starter' : rankInGroup < 6 ? 'keySub' : 'reserve';
        if (posGroup === 'FW') return rankInGroup < 3 ? 'starter' : rankInGroup < 5 ? 'keySub' : 'reserve';
        return 'reserve';
    }

    function renderRosterGroup(label, emoji, players, posGroup) {
        if (!players.length) return '';
        const hasRealData = players.some(p => (p.appearances || 0) > 0);
        const sorted = [...players].sort((a, b) => {
            if (hasRealData) { const d = (b.appearances || 0) - (a.appearances || 0); return d !== 0 ? d : (a.subIns || 0) - (b.subIns || 0); }
            return (parseInt(a.jersey) || 999) - (parseInt(b.jersey) || 999);
        });
        return `<div class="mb-2"><div class="text-[11px] font-bold text-gray-500 mb-1">${emoji} ${label} (${players.length})</div><div class="grid grid-cols-1 gap-1">${sorted.map((p, idx) => {
            const role = getRosterRole(p, posGroup || p.pos, idx);
            const roleBadge = role === 'starter' ? `<span class="text-[10px] text-yellow-400 font-bold">⭐${tx('主力', 'Start')}</span>` : role === 'keySub' ? `<span class="text-[10px] text-blue-400 font-bold">🔄${tx('替补', 'Sub')}</span>` : '';
            return `<div class="flex items-center gap-2 text-xs py-1.5 px-2 glass-light rounded-lg cursor-pointer hover:bg-white/10 transition-colors" data-action="open-player-detail" data-player-id="${p.id}" data-player-name="${p.name || ''}" data-player-pos="${p.pos || ''}" data-player-jersey="${p.jersey || ''}" data-player-age="${p.age || ''}" data-player-height="${p.height || ''}" data-player-nationality="${p.nationality || ''}"><span class="w-6 text-center text-gray-500 font-mono text-[11px]">#${p.jersey || '?'}</span><span class="font-medium flex-1">${translatePlayerName(p.name)}</span>${roleBadge}<span class="text-gray-600 text-[11px]">${p.pos}</span>${p.age ? `<span class="text-gray-600 text-[11px]">${p.age}${tx('岁', '')}</span>` : ''}<span class="text-gray-700 text-[11px]">›</span></div>`;
        }).join('')}</div></div>`;
    }

    function renderTeamRadarChart(canvasId, data) {
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) existingChart.destroy();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const uiLang = window.WorldCup.State?.uiLang || 'zh';
        const labels = uiLang === 'en' ? ['Attack', 'Defense', 'Possession', 'Physical', 'Discipline'] : ['进攻', '防守', '控球', '体能', '纪律'];
        const values = [data.attack || 70, data.defense || 70, data.possession || 70, data.physical || 70, data.discipline || 70];
        new Chart(ctx, { type: 'radar', data: { labels, datasets: [{ label: tx('球队能力', 'Team Ability'), data: values, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgb(59, 130, 246)', borderWidth: 2, pointBackgroundColor: 'rgb(59, 130, 246)', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: 'rgb(59, 130, 246)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, pointLabels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 10 } } } } } });
    }

    function renderPlayerRadarChart(canvasId, data) {
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) existingChart.destroy();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const uiLang = window.WorldCup.State?.uiLang || 'zh';
        const labels = uiLang === 'en' ? ['Attack', 'Defense', 'Physical', 'Form', 'Experience'] : ['进攻', '防守', '身体', '状态', '经验'];
        const values = [data.attack || 70, data.defense || 70, data.physical || 70, data.form || 70, data.experience || 70];
        new Chart(ctx, { type: 'radar', data: { labels, datasets: [{ label: tx('球员能力', 'Player Ability'), data: values, backgroundColor: 'rgba(168, 85, 247, 0.2)', borderColor: 'rgb(168, 85, 247)', borderWidth: 2, pointBackgroundColor: 'rgb(168, 85, 247)', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: 'rgb(168, 85, 247)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, pointLabels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 10 } } } } } });
    }

    function renderTeamBasic(teamData, coachData, teamName, group) {
        let html = `<div class="flex items-center gap-3 mb-4">${teamData?.logo ? `<img src="${teamData.logo}" class="w-12 h-12 object-contain">` : ''}<div><h3 class="font-bold text-lg">${teamName}</h3><div class="text-xs text-gray-500">${group} · ${teamData?.record || '战绩未知'}</div></div></div>`;
        if (coachData && !coachData.error) {
            html += `<div class="glass rounded-xl p-3 mb-3"><h4 class="text-xs font-bold text-purple-400 mb-2">🧠 ${tx('教练', 'Coach')}</h4><div class="text-sm font-bold mb-1">${translateCoachField(coachData.name, 'name')} <span class="text-gray-500 text-xs">${translateCoachField(coachData.nationality, 'nationality')}</span></div><div class="text-xs text-gray-400 mb-2">${translateCoachField(coachData.style, 'style')} · ${coachData.styleDetail || ''}</div><div class="grid grid-cols-2 gap-2 text-xs"><div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('执教时长', 'Tenure')}</div><div class="font-bold">${translateCoachField(coachData.tenure || coachData.since, 'tenure')}</div></div><div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('胜率', 'Win Rate')}</div><div class="font-bold text-green-400">${coachData.winRate}</div></div><div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('常用阵型', 'Formation')}</div><div class="font-bold">${(coachData.formation||[]).join(' / ')}</div></div><div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('临场调整', 'In-game Adjustments')}</div><div class="font-bold">${coachData.adjustment?.substring(0,20) || tx('中等', 'Medium')}...</div></div></div><div class="mt-2 text-[11px] text-gray-500"><span class="text-gray-600">${tx('大赛', 'Tournaments')}: </span>${coachData.bigTournament || tx('暂无', 'None')}</div><div class="mt-1 text-[11px] text-gray-500"><span class="text-gray-600">${tx('特点', 'Notes')}: </span>${coachData.notes || ''}</div></div>`;
        }
        const roster = teamData?.roster || [];
        if (roster.length) {
            const gk = roster.filter(p => p.pos === 'G' || p.pos === 'GK');
            const def = roster.filter(p => ['D','CB','LB','RB'].includes(p.pos));
            const mid = roster.filter(p => ['M','CM','CDM','CAM'].includes(p.pos));
            const fwd = roster.filter(p => ['F','FW','ST','LW','RW'].includes(p.pos));
            const other = roster.filter(p => ![...gk,...def,...mid,...fwd].includes(p));
            html += `<div class="glass rounded-xl p-3"><h4 class="text-xs font-bold text-blue-400 mb-2">👥 ${tx('大名单', 'Roster')} (${roster.length}${tx('人', '')})</h4>${renderRosterGroup(tx('门将', 'Goalkeepers'), '🧤', gk)}${renderRosterGroup(tx('后卫', 'Defenders'), '🛡️', def)}${renderRosterGroup(tx('中场', 'Midfielders'), '🎯', mid)}${renderRosterGroup(tx('前锋', 'Forwards'), '⚡', fwd)}${renderRosterGroup(tx('其他', 'Other'), '📋', other)}</div>`;
        } else {
            html += `<div class="text-gray-500 text-sm text-center py-4">${tx('阵容数据暂未公布', 'Roster data has not been released')}</div>`;
        }
        return html;
    }

    async function openTeamDetail(teamId, teamName, group) {
        const modal = document.getElementById('team-modal');
        const content = document.getElementById('team-modal-content');
        modal.classList.remove('hidden');
        content.innerHTML = '<div class="py-10 text-center text-gray-500">加载中...</div>';
        await refreshTeamsFromStandings();
        const standingTeam = findTeamStanding(teamId);
        const liveGroup = standingTeam?.group || group;
        const liveGroupRecord = groupRecordFromStanding(standingTeam);
        const [enhancedData, wcMatches] = await window.WorldCup.ApiClient.allData(['/api/team/' + teamId + '/enhanced', '/api/team/' + teamId + '/recent-matches']);
        if (enhancedData && !enhancedData.error) {
            if (liveGroupRecord) { enhancedData.overview ||= {}; enhancedData.overview.group = liveGroup; enhancedData.overview.groupRecord = liveGroupRecord; }
            content.innerHTML = renderTeamEnhanced(enhancedData, liveGroup, wcMatches);
            setTimeout(() => {
                const r = enhancedData.radar;
                if (r) { renderTeamRadarChart('team-radar-chart', { attack: r.attack, defense: r.defense, possession: r.possession, physical: Math.round((r.pace + r.stamina) / 2), discipline: r.tactics }); }
                else if (enhancedData.recentForm) { renderTeamRadarChart('team-radar-chart', { attack: parseFloat(enhancedData.recentForm.attack?.avgGoals || 1.5) * 40, defense: 100 - parseFloat(enhancedData.recentForm.defense?.avgConceded || 1.0) * 40, possession: parseFloat(enhancedData.recentForm.possession?.avgPossession || 50), physical: 70, discipline: 70 }); }
            }, 100);
        } else {
            const [teamData, coachData] = await window.WorldCup.ApiClient.allData(['/api/team/' + teamId, '/api/coach/' + teamId]);
            if (teamData && liveGroupRecord) teamData.groupRecord = liveGroupRecord;
            content.innerHTML = renderTeamBasic(teamData, coachData, teamName, liveGroup);
        }
    }

    function renderTeamEnhanced(d, group, wcMatchData) {
        const getWinRateColor = (winRate) => winRate >= 0.6 ? 'text-green-400' : winRate >= 0.4 ? 'text-yellow-400' : 'text-red-400';
        const getRankingColor = (ranking) => ranking <= 10 ? 'text-green-400' : ranking <= 30 ? 'text-yellow-400' : 'text-red-400';
        let h = `<div class="space-y-3"><div class="flex items-center gap-3">${d.logo ? `<img src="${d.logo}" class="w-12 h-12 object-contain">` : ''}<div><h3 class="font-bold text-lg">${displayMaybeTeamName(d)}</h3><div class="text-xs text-gray-500">${displayGroupName(group)} · ${d.shortName || ''}</div></div></div>`;
        if (d.overview) {
            h += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">📊 ${tx('球队概况', 'Team Overview')}</div><div class="grid grid-cols-2 gap-2 text-[11px]"><div><span class="text-gray-500">${tx('世界排名', 'World Rank')}</span><span class="font-bold ml-1 ${getRankingColor(d.overview.worldRanking)}">#${d.overview.worldRanking || '?'}</span></div><div><span class="text-gray-500">${tx('FIFA积分', 'FIFA Points')}</span><span class="font-bold ml-1">${d.overview.fifaPoints || '?'}</span></div><div><span class="text-gray-500">${tx('市值', 'Market Value')}</span><span class="font-bold ml-1 text-green-400">${d.overview.marketValue || '?'}</span></div><div><span class="text-gray-500">${tx('平均年龄', 'Avg Age')}</span><span class="font-bold ml-1">${d.overview.avgAge || '?'}${tx('岁', '')}</span></div></div>`;
            if (d.overview.groupRecord) {
                h += `<div class="mt-2 pt-2 border-t border-white/5"><div class="text-[11px] text-gray-500 mb-1">${tx('小组赛战绩', 'Group Record')}</div><div class="grid grid-cols-3 gap-2 text-center text-[11px]"><div><div class="font-bold text-green-400">${d.overview.groupRecord.w||0}${tx('胜','W')}</div></div><div><div class="font-bold text-yellow-400">${d.overview.groupRecord.d||0}${tx('平','D')}</div></div><div><div class="font-bold text-red-400">${d.overview.groupRecord.l||0}${tx('负','L')}</div></div></div><div class="grid grid-cols-3 gap-2 text-center text-[11px] mt-1"><div><span class="text-gray-500">${tx('进球','GF')}</span><span class="font-bold ml-1">${d.overview.groupRecord.gf||0}</span></div><div><span class="text-gray-500">${tx('失球','GA')}</span><span class="font-bold ml-1">${d.overview.groupRecord.ga||0}</span></div><div><span class="text-gray-500">${tx('积分','Pts')}</span><span class="font-bold ml-1 text-blue-400">${d.overview.groupRecord.pts||0}</span></div></div></div>`;
            }
            h += `</div>`;
        }
        h += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">📊 ${tx('能力雷达图','Ability Radar')}</div><div style="height:200px"><canvas id="team-radar-chart"></canvas></div></div>`;
        if (d.recentForm) {
            h += `<div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-gray-400">📈 ${tx('近期表现','Recent Form')}</span><span class="text-xs ${getWinRateColor(parseFloat(d.recentForm.winRate))}">${tx('胜率','Win Rate')} ${Math.round(parseFloat(d.recentForm.winRate)*100)}%</span></div><div class="grid grid-cols-3 gap-2 text-center text-[11px] mb-2"><div><div class="font-bold text-green-400">${d.recentForm.last10?.w||0}${tx('胜','W')}</div></div><div><div class="font-bold text-yellow-400">${d.recentForm.last10?.d||0}${tx('平','D')}</div></div><div><div class="font-bold text-red-400">${d.recentForm.last10?.l||0}${tx('负','L')}</div></div></div><div class="grid grid-cols-2 gap-2 text-[11px]"><div><span class="text-gray-500">${tx('场均进球','Avg Goals')}</span><span class="font-bold ml-1 text-green-400">${d.recentForm.attack?.avgGoals||'-'}</span></div><div><span class="text-gray-500">${tx('场均失球','Avg Conceded')}</span><span class="font-bold ml-1 text-red-400">${d.recentForm.defense?.avgConceded||'-'}</span></div><div><span class="text-gray-500">${tx('控球率','Possession')}</span><span class="font-bold ml-1">${d.recentForm.possession?.avgPossession||'-'}%</span></div><div><span class="text-gray-500">${tx('传球成功率','Pass Accuracy')}</span><span class="font-bold ml-1">${d.recentForm.possession?.passAccuracy?Math.round(parseFloat(d.recentForm.possession.passAccuracy)*100)+'%':'-'}</span></div></div><div class="mt-2 text-[11px] text-gray-600">${tx('趋势','Trend')}: ${d.recentForm.trend||tx('表现稳定','Stable')}</div></div>`;
        }
        if (d.coach) {
            h += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-purple-400 mb-2">🧠 ${tx('教练','Coach')}</div><div class="text-sm font-bold mb-1">${translateCoachField(d.coach.name,'name')} <span class="text-gray-500 text-xs">${translateCoachField(d.coach.nationality,'nationality')}</span></div><div class="text-xs text-gray-400 mb-2">${translateCoachField(d.coach.style,'style')||''}</div><div class="grid grid-cols-2 gap-2 text-[11px]"><div><span class="text-gray-500">${tx('执教时长','Tenure')}</span><span class="font-bold ml-1">${d.coach.tenure||d.coach.since||'?'}</span></div><div><span class="text-gray-500">${tx('胜率','Win Rate')}</span><span class="font-bold ml-1 text-green-400">${d.coach.winRate||'?'}</span></div><div><span class="text-gray-500">${tx('常用阵型','Formation')}</span><span class="font-bold ml-1">${(d.coach.formation||[]).join(' / ')||'?'}</span></div><div><span class="text-gray-500">${tx('大赛经验','Tournament Exp.')}</span><span class="font-bold ml-1">${d.coach.bigTournament?'✓':'?'}</span></div></div></div>`;
        }
        if (d.squadChanges) {
            h += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-yellow-400 mb-2">🔄 ${tx('球队动态','Team News')}</div>`;
            if (d.squadChanges.injuries?.length) h += `<div class="mb-2"><div class="text-[11px] text-gray-500 mb-1">🏥 ${tx('伤病','Injuries')}</div>${d.squadChanges.injuries.map(i=>`<div class="text-[11px] text-red-400">• ${i.player||'?'} (${i.pos||'?'}) - ${i.issue||'?'}</div>`).join('')}</div>`;
            if (d.squadChanges.suspended?.length) h += `<div class="mb-2"><div class="text-[11px] text-gray-500 mb-1">🚫 ${tx('停赛','Suspensions')}</div>${d.squadChanges.suspended.map(s=>`<div class="text-[11px] text-yellow-400">• ${s.player||'?'} (${s.pos||'?'}) - ${s.reason||'?'}</div>`).join('')}</div>`;
            if (d.squadChanges.watchPoints?.length) h += `<div><div class="text-[11px] text-gray-500 mb-1">⚠️ ${tx('关注点','Watch Points')}</div>${d.squadChanges.watchPoints.map(w=>`<div class="text-[11px] text-orange-400">• ${w}</div>`).join('')}</div>`;
            if (!d.squadChanges.injuries?.length && !d.squadChanges.suspended?.length && !d.squadChanges.watchPoints?.length) h += `<div class="text-[11px] text-gray-600">${tx('暂无重大动态','No major updates')}</div>`;
            h += `</div>`;
        }
        if (d.tournamentHistory) {
            h += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-blue-400 mb-2">🏆 ${tx('大赛历史','Tournament History')}</div><div class="grid grid-cols-2 gap-2 text-[11px]"><div><span class="text-gray-500">${tx('参赛次数','Appearances')}</span><span class="font-bold ml-1">${d.tournamentHistory.worldCupApps||'?'}</span></div><div><span class="text-gray-500">${tx('最佳成绩','Best Finish')}</span><span class="font-bold ml-1 text-green-400">${d.tournamentHistory.bestResult||'?'}</span></div><div><span class="text-gray-500">${tx('上届成绩','Last Edition')}</span><span class="font-bold ml-1">${d.tournamentHistory.lastEdition||'?'}</span></div><div><span class="text-gray-500">${tx('累计战绩','All-time Record')}</span><span class="font-bold ml-1">${d.tournamentHistory.allTimeRecord?`${d.tournamentHistory.allTimeRecord.w}${tx('胜','W')} ${d.tournamentHistory.allTimeRecord.d}${tx('平','D')} ${d.tournamentHistory.allTimeRecord.l}${tx('负','L')}`:'?'}</span></div></div></div>`;
        }
        if (d.roster?.length) {
            h += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-blue-400 mb-2">👥 ${tx('大名单','Roster')} (${d.roster.length}${tx('人','')})</div>${renderRosterGroup(tx('门将','Goalkeepers'),'🧤',d.roster.filter(p=>p.pos==='G'||p.pos==='GK'),'GK')}${renderRosterGroup(tx('后卫','Defenders'),'🛡️',d.roster.filter(p=>['D','CB','LB','RB','LWB','RWB'].includes(p.pos)),'DF')}${renderRosterGroup(tx('中场','Midfielders'),'🎯',d.roster.filter(p=>['M','CM','CDM','CAM','LM','RM'].includes(p.pos)),'MF')}${renderRosterGroup(tx('前锋','Forwards'),'⚡',d.roster.filter(p=>['F','FW','ST','LW','RW','CF'].includes(p.pos)),'FW')}</div>`;
        }
        h += renderTeamWCMatches(wcMatchData);
        return h + `</div>`;
    }

    function closeTeamModal() {
        document.getElementById('team-modal').classList.add('hidden');
    }

    // ── Expose to window.WorldCup namespace ──
    const ns = window.WorldCup.TeamDetail = {
        loadTeams, openTeamDetail, closeTeamModal, refreshTeamsFromStandings,
        renderTeamRadarChart, renderPlayerRadarChart,
    };
    Object.assign(window, { loadTeams, openTeamDetail, closeTeamModal, refreshTeamsFromStandings });
})();
