/**
 * team-detail.js — Teams grid & team detail modal
 * Extracted from app.js
 */
(function () {
    'use strict';

    const esc   = (...a) => (window.WorldCup.Utils?.esc   || ((s) => s))(...a);
    const attr  = (...a) => (window.WorldCup.Utils?.attr  || ((s) => s))(...a);
    const { tx } = window.WorldCup.Utils;
    const api   = (...a) => (window.WorldCup.Utils?.api   || (async () => ({})))(...a);
    const displayMaybeTeamName  = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName  || ((x) => x))(...a);
    const displayGroupName      = (...a) => (window.WorldCup.I18n?.displayGroupName      || ((x) => x))(...a);
    const translatePlayerName   = (...a) => (window.WorldCup.I18n?.translatePlayerName   || ((x) => x))(...a);
    const translateCoachField   = (...a) => (window.WorldCup.I18n?.translateCoachField   || ((x) => x))(...a);

    let allTeams = [];

    async function refreshTeamsFromStandings() {
        const [d, b] = await Promise.all([api('/api/standings'), api('/api/bracket')]);
        const eliminatedIds = new Set();
        const eliminatedNames = new Set();
        // Any team id that appears anywhere in the bracket (winner or loser, any
        // round) qualified for the knockout stage. /api/standings never sets a
        // status/eliminated field of its own, so a team whose group stage is
        // finished (played >= 3) but who never shows up in the bracket at all
        // simply finished outside the top two and was eliminated in the groups —
        // that must be inferred here, not assumed already-flagged upstream.
        const qualifiedIds = new Set();
        if (b?.matches) {
            for (const [slotId, m] of Object.entries(b.matches)) {
                if (m.teamA?.id) qualifiedIds.add(String(m.teamA.id));
                if (m.teamB?.id) qualifiedIds.add(String(m.teamB.id));
                if (m.status === 'final' && m.winner && !slotId.startsWith('SF-')) {
                    const loser = m.winner === 'A' ? m.teamB : m.teamA;
                    // Primary match key is id: /api/standings' team.name is a combined
                    // "中文 English" string (e.g. "南非 South Africa") while bracket
                    // loser.name is English-only ("South Africa") — those never match
                    // by string equality, which silently kept every knockout-stage
                    // loser marked "Active" forever. id is format-independent.
                    if (loser?.id) eliminatedIds.add(String(loser.id));
                    if (loser?.name) eliminatedNames.add(loser.name);
                    if (loser?.nameI18n?.en) eliminatedNames.add(loser.nameI18n.en);
                    if (loser?.nameI18n?.zh) eliminatedNames.add(loser.nameI18n.zh);
                }
            }
        }
        if (d?.groups) {
            allTeams = [];
            for (const g of d.groups) {
                for (const t of g.standings) {
                    const failedToQualify = qualifiedIds.size > 0 && Number(t.played) >= 3 && !qualifiedIds.has(String(t.id));
                    const isEliminated = t.status === 'eliminated' || t.eliminated === true
                        || eliminatedIds.has(String(t.id))
                        || eliminatedNames.has(t.name)
                        || failedToQualify
                        || (t.nameI18n?.en && eliminatedNames.has(t.nameI18n.en))
                        || (t.nameI18n?.zh && eliminatedNames.has(t.nameI18n.zh));
                    allTeams.push({ ...t, group: g.name, eliminated: !!isEliminated });
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
            el.innerHTML = `<div class="col-span-full text-center py-10" style="color:rgba(248,250,252,.2)">⚽ ${tx('teamsLoading')}</div>`;
            try { await refreshTeamsFromStandings(); } catch (e) {
                el.innerHTML = `<div class="col-span-full text-center py-10" style="color:rgba(248,113,113,.4)">⚠️ ${tx('teamsError')}</div>`;
                return;
            }
        }
        const sortedTeams = [...allTeams].sort((a, b) => {
            if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
            return (Number(b.pts) || 0) - (Number(a.pts) || 0);
        });
        el.innerHTML = sortedTeams.map(team => `
            <div style="background:rgba(0,0,0,.28);backdrop-filter:blur(48px);-webkit-backdrop-filter:blur(48px);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:16px 14px;cursor:pointer;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04);transition:border-color .2s;opacity:${team.eliminated ? '0.6' : '1'}" onmouseover="this.style.borderColor='rgba(52,211,153,.15)'" onmouseout="this.style.borderColor='rgba(255,255,255,.05)'" data-action="open-team-detail" data-team-id="${attr(team.id)}" data-team-name="${attr(team.name)}" data-group="${attr(team.group)}">
                ${team.logo ? `<img src="${attr(team.logo)}" style="width:36px;height:36px;object-fit:contain;margin:0 auto 8px" onerror="this.style.display='none'">` : `<div style="font-size:28px;margin-bottom:8px">🏳️</div>`}
                <div style="font:500 14px/1 'Inter';color:#f8fafc;margin-bottom:2px">${esc(displayMaybeTeamName(team))}</div>
                <div style="font:400 9px/1 'Inter';color:rgba(248,250,252,.15);margin-bottom:6px">${esc(displayGroupName(team.group))}</div>
                <div style="display:flex;justify-content:center;align-items:center;gap:6px;font:400 9px/1 'JetBrains Mono',monospace">
                    ${team.eliminated ? `<span style="padding:2px 6px;border-radius:4px;background:rgba(248,113,113,.1);color:rgba(248,113,113,.7)">${esc(tx('已淘汰', 'Out'))}</span>` : `<span style="padding:2px 6px;border-radius:4px;background:rgba(52,211,153,.1);color:#34d399">${esc(tx('在役', 'Active'))}</span>`}
                    <span style="padding:2px 7px;border-radius:4px;background:rgba(52,211,153,.06);color:rgba(52,211,153,.5)">${esc(tx('积分', 'Pts'))} <span style="font-weight:600;color:#34d399">${esc(team.pts)}</span></span>
                    <span style="padding:2px 7px;border-radius:4px;background:rgba(255,255,255,.03);color:rgba(248,250,252,.2)">${esc(team.wins)}-${esc(team.draws)}-${esc(team.losses)}</span>
                </div>
            </div>
        `).join('') || `<div class="col-span-full text-center py-10" style="color:rgba(248,250,252,.2)">${esc(tx('teamsLoading'))}</div>`;
    }

    function renderTeamWCMatches(data) {
        const matches = data?.matches;
        if (!matches || !matches.length) return '';
        const resultBadge = r => {
            if (r === 'W') return `<span style="font:600 11px/1 'JetBrains Mono',monospace;color:#34d399;width:20px;text-align:center">${tx('胜','W')}</span>`;
            if (r === 'D') return `<span style="font:600 11px/1 'JetBrains Mono',monospace;color:#f59e0b;width:20px;text-align:center">${tx('平','D')}</span>`;
            if (r === 'L') return `<span style="font:600 11px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.6);width:20px;text-align:center">${tx('负','L')}</span>`;
            return `<span style="font:400 11px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1);width:20px;text-align:center">-</span>`;
        };
        const stateLabel = s => s === 'post' ? `<span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.15)">FT</span>`
            : s === 'in' ? `<span style="font:400 10px/1 'Inter';color:rgba(248,113,113,.6);animation:pulse-live 1.8s infinite">LIVE</span>`
            : `<span style="font:400 10px/1 'Inter';color:rgba(52,211,153,.4)">${tx('待赛','TBD')}</span>`;
        const rows = matches.map(m => {
            const opp = m.opponent;
            const oppName = opp ? displayMaybeTeamName(m.opponentNameI18n || opp.nameI18n || opp.name || opp.abbreviation || '?') : '?';
            const score = (m.state === 'post' || m.state === 'in') ? `${m.score?.home ?? '-'} : ${m.score?.away ?? '-'}` : 'vs';
            const dateStr = m.dateBJT ? m.dateBJT.split(' ')[0].replace(/\//g, '-') : (m.date ? m.date.slice(0, 10) : '');
            const homeAwayLabel = m.isHome ? `<span style="font:400 9px/1 'Inter';color:rgba(52,211,153,.5)">${tx('主','H')}</span>` : `<span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.2)">${tx('客','A')}</span>`;
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='rgba(255,255,255,.02)'" data-action="open-match" data-match-id="${attr(m.matchId)}">${resultBadge(m.result)}${homeAwayLabel}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 12px/1 'Inter';color:rgba(248,250,252,.7)">${esc(oppName)}</span><span style="font:500 13px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.6)">${esc(score)}</span>${stateLabel(m.state)}<span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.15);min-width:54px;text-align:right">${esc(dateStr)}</span></div>`;
        }).join('');
        const completedCount = matches.filter(m => m.state === 'post').length;
        const totalCount = matches.length;
        const note = completedCount > 0 ? tx(`本届世界杯 · 共 ${totalCount} 场 · ${completedCount} 场已结束`, `World Cup · ${totalCount} matches · ${completedCount} completed`) : tx(`本届世界杯 · 共 ${totalCount} 场赛程`, `World Cup · ${totalCount} scheduled`);
        // W/D/L summary from schedule result field (single source of truth)
        const w = matches.filter(m => m.result === 'W').length;
        const d = matches.filter(m => m.result === 'D').length;
        const l = matches.filter(m => m.result === 'L').length;
        const summaryBar = completedCount > 0 ? `<div style="display:flex;justify-content:center;gap:12px;margin-bottom:10px;font:500 12px/1 'JetBrains Mono',monospace"><span style="color:#34d399">${w}${tx('胜','W')}</span><span style="color:#f59e0b">${d}${tx('平','D')}</span><span style="color:rgba(248,113,113,.6)">${l}${tx('负','L')}</span></div>` : '';
        return `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1px">📅 ${tx('本届赛程', 'WC Record')}</span><span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.15)">${esc(note)}</span></div>${summaryBar}<div style="display:flex;flex-direction:column;gap:4px">${rows}</div><div style="margin-top:8px;font:400 8px/1 'Inter';color:rgba(248,250,252,.1)">ESPN 实时 · 仅含本届世界杯比赛</div></div>`;
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
        return `<div class="mb-2"><div style="font:500 8px/1 'JetBrains Mono', monospace;color:rgba(52,211,153,.35);letter-spacing:1px;margin-bottom:8px">${emoji} ${label} (${players.length})</div><div class="grid grid-cols-1 gap-1">${sorted.map((p, idx) => {
            const role = getRosterRole(p, posGroup || p.pos, idx);
            const roleBadge = role === 'starter' ? `<span style="font:500 9px/1 'Inter';color:#f59e0b">⭐${tx('主力', 'Start')}</span>` : role === 'keySub' ? `<span style="font:500 9px/1 'Inter';color:rgba(52,211,153,.5)">🔄${tx('替补', 'Sub')}</span>` : '';
            return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='rgba(255,255,255,.02)'" data-action="open-player-detail" data-player-id="${p.id}" data-player-name="${p.name || ''}" data-player-pos="${p.pos || ''}" data-player-jersey="${p.jersey || ''}" data-player-age="${p.age || ''}" data-player-height="${p.height || ''}" data-player-nationality="${p.nationality || ''}"><span style="width:22px;text-align:center;font:400 11px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.2)">#${p.jersey || '?'}</span><span style="flex:1;font:400 12px/1 'Inter';color:rgba(248,250,252,.7)">${translatePlayerName(p.name, p.nameZh)}</span>${roleBadge}<span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${p.pos}</span>${p.age ? `<span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${p.age}${tx('岁', '')}</span>` : ''}<span style="font:400 11px/1 'Inter';color:rgba(248,250,252,.1)">›</span></div>`;
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
        new Chart(ctx, { type: 'radar', data: { labels, datasets: [{ label: tx('球队能力', 'Team Ability'), data: values, backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: '#34d399', borderWidth: 1.5, pointBackgroundColor: '#34d399', pointBorderColor: '#0f172a', pointHoverBackgroundColor: '#0f172a', pointHoverBorderColor: '#34d399' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: 'rgba(255, 255, 255, 0.06)' }, pointLabels: { color: 'rgba(248, 250, 252, 0.35)', font: { size: 9 } } } } } });
    }

    function renderPlayerRadarChart(canvasId, data) {
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) existingChart.destroy();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const uiLang = window.WorldCup.State?.uiLang || 'zh';
        const labels = uiLang === 'en' ? ['Attack', 'Defense', 'Physical', 'Form', 'Experience'] : ['进攻', '防守', '身体', '状态', '经验'];
        const values = [data.attack || 70, data.defense || 70, data.physical || 70, data.form || 70, data.experience || 70];
        new Chart(ctx, { type: 'radar', data: { labels, datasets: [{ label: tx('球员能力', 'Player Ability'), data: values, backgroundColor: 'rgba(52, 211, 153, 0.10)', borderColor: 'rgba(52, 211, 153, 0.6)', borderWidth: 1.5, pointBackgroundColor: '#34d399', pointBorderColor: '#0f172a', pointHoverBackgroundColor: '#0f172a', pointHoverBorderColor: '#34d399' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: 'rgba(255, 255, 255, 0.06)' }, pointLabels: { color: 'rgba(248, 250, 252, 0.35)', font: { size: 9 } } } } } });
    }

    function renderTeamBasic(teamData, coachData, teamName, group) {
        let html = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">${teamData?.logo ? `<img src="${teamData.logo}" style="width:40px;height:40px;object-fit:contain">` : ''}<div><h3 style="font:600 18px/1 'Inter';color:#f8fafc">${teamName}</h3><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">${group} · ${teamData?.record || '战绩未知'}</div></div></div>`;
        if (coachData && !coachData.error) {
            html += `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px;margin-bottom:12px">
                <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1px;margin-bottom:10px">🧠 ${tx('教练', 'Coach')}</div>
                <div style="font:500 13px/1 'Inter';color:rgba(248,250,252,.7);margin-bottom:2px">${translateCoachField(coachData.name, 'name')} <span style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25)">${translateCoachField(coachData.nationality, 'nationality')}</span></div>
                <div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.35);margin-bottom:10px">${translateCoachField(coachData.style, 'style')} · ${coachData.styleDetail || ''}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx('执教时长', 'Tenure')}</div><div style="font-weight:600;color:rgba(248,250,252,.6)">${translateCoachField(coachData.tenure || coachData.since, 'tenure')}</div></div>
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx('胜率', 'Win Rate')}</div><div style="font-weight:600;color:#34d399">${coachData.winRate}</div></div>
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx('常用阵型', 'Formation')}</div><div style="font-weight:600;color:rgba(248,250,252,.6)">${(coachData.formation||[]).join(' / ')}</div></div>
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx('临场调整', 'In-game Adjustments')}</div><div style="font-weight:600;color:rgba(248,250,252,.6)">${coachData.adjustment?.substring(0,20) || tx('中等', 'Medium')}...</div></div>
                </div>
                <div style="margin-top:8px;font:400 10px/1 'Inter';color:rgba(248,250,252,.25)"><span style="color:rgba(248,250,252,.15)">${tx('大赛', 'Tournaments')}: </span>${coachData.bigTournament || tx('暂无', 'None')}</div>
                <div style="margin-top:2px;font:400 10px/1 'Inter';color:rgba(248,250,252,.25)"><span style="color:rgba(248,250,252,.15)">${tx('特点', 'Notes')}: </span>${coachData.notes || ''}</div>
            </div>`;
        }
        const roster = teamData?.roster || [];
        if (roster.length) {
            const gk = roster.filter(p => p.pos === 'G' || p.pos === 'GK');
            const def = roster.filter(p => ['D','CB','LB','RB'].includes(p.pos));
            const mid = roster.filter(p => ['M','CM','CDM','CAM'].includes(p.pos));
            const fwd = roster.filter(p => ['F','FW','ST','LW','RW'].includes(p.pos));
            const other = roster.filter(p => ![...gk,...def,...mid,...fwd].includes(p));
            html += `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px">
                <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1px;margin-bottom:10px">👥 ${tx('大名单', 'Roster')} (${roster.length}${tx('人', '')})</div>
                ${renderRosterGroup(tx('门将', 'Goalkeepers'), '🧤', gk)}${renderRosterGroup(tx('后卫', 'Defenders'), '🛡️', def)}${renderRosterGroup(tx('中场', 'Midfielders'), '🎯', mid)}${renderRosterGroup(tx('前锋', 'Forwards'), '⚡', fwd)}${renderRosterGroup(tx('其他', 'Other'), '📋', other)}
            </div>`;
        } else {
            html += `<div style="color:rgba(248,250,252,.2);font-size:13px;text-align:center;padding:20px 0">${tx('阵容数据暂未公布', 'Roster data has not been released')}</div>`;
        }
        return html;
    }

    async function openTeamDetail(teamId, teamName, group) {
        const modal = document.getElementById('team-modal');
        const content = document.getElementById('team-modal-content');
        modal.classList.remove('hidden');
        content.innerHTML = '<div class="py-10 text-center" style="color:rgba(248,250,252,.2)">加载中...</div>';
        await refreshTeamsFromStandings();
        const standingTeam = findTeamStanding(teamId);
        const liveGroup = standingTeam?.group || group;
        const liveGroupRecord = groupRecordFromStanding(standingTeam);
        const [enhancedData, wcMatches] = await window.WorldCup.ApiClient.allData(['/api/team/' + teamId + '/enhanced', '/api/team/' + teamId + '/recent-matches']);
        if (enhancedData && !enhancedData.error) {
            // Compute World Cup record from wcMatches (across all stages: group + knockout)
            const wcGroupRecord = (() => {
                const ms = wcMatches?.matches?.filter(m => m.state === 'post');
                if (!ms?.length) return null;
                const w = ms.filter(m => m.result === 'W').length;
                const d = ms.filter(m => m.result === 'D').length;
                const l = ms.filter(m => m.result === 'L').length;
                let gf = 0, ga = 0;
                ms.forEach(m => {
                    const hs = Number(m.score?.home || 0), as_ = Number(m.score?.away || 0);
                    if (m.isHome) { gf += hs; ga += as_; } else { gf += as_; ga += hs; }
                });
                return { w, d, l, gf, ga, gd: gf - ga, pts: w * 3 + d };
            })();
            const finalGroupRecord = wcGroupRecord || liveGroupRecord;
            if (finalGroupRecord) { enhancedData.overview ||= {}; enhancedData.overview.group = liveGroup; enhancedData.overview.groupRecord = finalGroupRecord; }
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
        const getWinRateColor = (winRate) => winRate >= 0.6 ? '#34d399' : winRate >= 0.4 ? '#f59e0b' : 'rgba(248,113,113,.6)';
        const getRankingColor = (ranking) => ranking <= 10 ? '#34d399' : ranking <= 30 ? '#f59e0b' : 'rgba(248,113,113,.5)';
        const card = 'background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px';
        const secHdr = 'font:500 8px/1 \'JetBrains Mono\',monospace;color:rgba(52,211,153,.4);letter-spacing:1px;margin-bottom:10px';
        let h = `<div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:center;gap:12px">${d.logo ? `<img src="${d.logo}" style="width:40px;height:40px;object-fit:contain">` : ''}<div><h3 style="font:600 18px/1 'Inter';color:#f8fafc">${displayMaybeTeamName(d)}</h3><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">${displayGroupName(group)} · ${d.shortName || ''}</div></div></div>`;
        if (d.overview) {
            h += `<div style="${card}"><div style="${secHdr}">📊 ${tx('球队概况', 'Team Overview')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx('世界排名', 'World Rank')}</span><span style="font-weight:600;margin-left:4px;color:${getRankingColor(d.overview.worldRanking)}">#${d.overview.worldRanking || '?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('FIFA积分', 'FIFA Points')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.overview.fifaPoints || '?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('市值', 'Market Value')}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.overview.marketValue || '?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('平均年龄', 'Avg Age')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.overview.avgAge || '?'}${tx('岁', '')}</span></div></div>`;
            if (d.overview.groupRecord) {
                const rec = d.overview.groupRecord;
                h += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)"><div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:6px">${tx('本届世界杯战绩', 'World Cup Record')}</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;font:500 12px/1 'Inter'"><div style="color:#34d399">${rec.w||0}${tx('胜','W')}</div><div style="color:#f59e0b">${rec.d||0}${tx('平','D')}</div><div style="color:rgba(248,113,113,.6)">${rec.l||0}${tx('负','L')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;font:400 11px/1 'Inter';margin-top:4px"><div><span style="color:rgba(248,250,252,.25)">${tx('进球','GF')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${rec.gf||0}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('失球','GA')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${rec.ga||0}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('净胜球','GD')}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${rec.gd ?? ((rec.gf||0)-(rec.ga||0))}</span></div></div></div>`;
            }
            h += `</div>`;
        }
        h += `<div style="${card}"><div style="${secHdr}">📊 ${tx('能力雷达图','Ability Radar')}</div><div style="height:200px"><canvas id="team-radar-chart"></canvas></div></div>`;
        if (d.recentForm) {
            h += `<div style="${card}"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="${secHdr}margin-bottom:0">📈 ${tx('近期表现','Recent Form')}</span><span style="font:500 11px/1 'Inter';color:${getWinRateColor(parseFloat(d.recentForm.winRate))}">${tx('胜率','Win Rate')} ${Math.round(parseFloat(d.recentForm.winRate)*100)}%</span></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;font:500 12px/1 'Inter';margin-bottom:8px"><div style="color:#34d399">${d.recentForm.last10?.w||0}${tx('胜','W')}</div><div style="color:#f59e0b">${d.recentForm.last10?.d||0}${tx('平','D')}</div><div style="color:rgba(248,113,113,.6)">${d.recentForm.last10?.l||0}${tx('负','L')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx('场均进球','Avg Goals')}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.recentForm.attack?.avgGoals||'-'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('场均失球','Avg Conceded')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,113,113,.5)">${d.recentForm.defense?.avgConceded||'-'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('控球率','Possession')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.recentForm.possession?.avgPossession||'-'}%</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('传球成功率','Pass Accuracy')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.recentForm.possession?.passAccuracy?Math.round(parseFloat(d.recentForm.possession.passAccuracy)*100)+'%':'-'}</span></div></div><div style="margin-top:8px;font:400 10px/1 'Inter';color:rgba(248,250,252,.15)">${tx('趋势','Trend')}: ${d.recentForm.trend||tx('表现稳定','Stable')}</div></div>`;
        }
        if (d.coach) {
            h += `<div style="${card}"><div style="${secHdr}">🧠 ${tx('教练','Coach')}</div><div style="font:500 13px/1 'Inter';color:rgba(248,250,252,.7);margin-bottom:2px">${translateCoachField(d.coach.name,'name')} <span style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25)">${translateCoachField(d.coach.nationality,'nationality')}</span></div><div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.35);margin-bottom:10px">${translateCoachField(d.coach.style,'style')||''}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx('执教时长','Tenure')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.coach.tenure||d.coach.since||'?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('胜率','Win Rate')}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.coach.winRate||'?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('常用阵型','Formation')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${(d.coach.formation||[]).join(' / ')||'?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('大赛经验','Tournament Exp.')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.coach.bigTournament?'✓':'?'}</span></div></div></div>`;
        }
        if (d.squadChanges) {
            h += `<div style="${card}"><div style="${secHdr}">🔄 ${tx('球队动态','Team News')}</div>`;
            if (d.squadChanges.injuries?.length) h += `<div style="margin-bottom:8px"><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:4px">🏥 ${tx('伤病','Injuries')}</div>${d.squadChanges.injuries.map(i=>`<div style="font:400 11px/1 'Inter';color:rgba(248,113,113,.5)">• ${i.player||'?'} (${i.pos||'?'}) - ${i.issue||'?'}</div>`).join('')}</div>`;
            if (d.squadChanges.suspended?.length) h += `<div style="margin-bottom:8px"><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:4px">🚫 ${tx('停赛','Suspensions')}</div>${d.squadChanges.suspended.map(s=>`<div style="font:400 11px/1 'Inter';color:#f59e0b">• ${s.player||'?'} (${s.pos||'?'}) - ${s.reason||'?'}</div>`).join('')}</div>`;
            if (d.squadChanges.watchPoints?.length) h += `<div><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:4px">⚠️ ${tx('关注点','Watch Points')}</div>${d.squadChanges.watchPoints.map(w=>`<div style="font:400 11px/1 'Inter';color:rgba(251,146,60,.5)">• ${w}</div>`).join('')}</div>`;
            if (!d.squadChanges.injuries?.length && !d.squadChanges.suspended?.length && !d.squadChanges.watchPoints?.length) h += `<div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.15)">${tx('暂无重大动态','No major updates')}</div>`;
            h += `</div>`;
        }
        if (d.tournamentHistory) {
            h += `<div style="${card}"><div style="${secHdr}">🏆 ${tx('大赛历史','Tournament History')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx('参赛次数','Appearances')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.tournamentHistory.worldCupApps||'?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('最佳成绩','Best Finish')}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.tournamentHistory.bestResult||'?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('上届成绩','Last Edition')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.tournamentHistory.lastEdition||'?'}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx('累计战绩','All-time Record')}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.tournamentHistory.allTimeRecord?`${d.tournamentHistory.allTimeRecord.w}${tx('胜','W')} ${d.tournamentHistory.allTimeRecord.d}${tx('平','D')} ${d.tournamentHistory.allTimeRecord.l}${tx('负','L')}`:'?'}</span></div></div></div>`;
        }
        if (d.roster?.length) {
            h += `<div style="${card}"><div style="${secHdr}">👥 ${tx('大名单','Roster')} (${d.roster.length}${tx('人','')})</div>${renderRosterGroup(tx('门将','Goalkeepers'),'🧤',d.roster.filter(p=>p.pos==='G'||p.pos==='GK'),'GK')}${renderRosterGroup(tx('后卫','Defenders'),'🛡️',d.roster.filter(p=>['D','CB','LB','RB','LWB','RWB'].includes(p.pos)),'DF')}${renderRosterGroup(tx('中场','Midfielders'),'🎯',d.roster.filter(p=>['M','CM','CDM','CAM','LM','RM'].includes(p.pos)),'MF')}${renderRosterGroup(tx('前锋','Forwards'),'⚡',d.roster.filter(p=>['F','FW','ST','LW','RW','CF'].includes(p.pos)),'FW')}</div>`;
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
