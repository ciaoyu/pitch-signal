// ========== standings.js - Standings Module (2-col grid + sub-tabs) ==========
(function() {
    let standingsData = null;

    function switchStandingsSubTab(tab, btn) {
        const groupsContent = document.getElementById('standings-sub-groups-content');
        const knockoutContent = document.getElementById('standings-sub-knockout-content');
        const scorersContent = document.getElementById('standings-sub-scorers-content');

        // Hide all
        if (groupsContent) groupsContent.classList.add('hidden');
        if (knockoutContent) knockoutContent.classList.add('hidden');
        if (scorersContent) scorersContent.classList.add('hidden');

        // Deactivate all sub-tab buttons
        document.querySelectorAll('[data-action="switch-standings-sub-tab"]').forEach(b => {
            b.classList.remove('tab-on');
            b.style.color = 'rgba(248,250,252,.3)';
        });

        // Activate target
        if (tab === 'knockout') {
            if (knockoutContent) knockoutContent.classList.remove('hidden');
        } else if (tab === 'scorers') {
            if (scorersContent) scorersContent.classList.remove('hidden');
        } else {
            if (groupsContent) groupsContent.classList.remove('hidden');
        }

        if (btn) {
            btn.classList.add('tab-on');
            btn.style.color = '#f8fafc';
        }

        // Lazy-load knockout bracket
        if (tab === 'knockout' && window.WorldCup.Utils) {
            const container = document.getElementById('bracket-container-standings');
            if (container && !container.querySelector('#bk-wrap')) {
                fetch('/api/bracket').then(r => r.json()).then(data => {
                    if (container && data && !data.error && window.renderBracket) {
                        container.innerHTML = '';
                        window.renderBracket(data, container);
                        setTimeout(() => {
                            const wrap = container.querySelector('#bk-wrap');
                            if (wrap) container.scrollLeft = (wrap.scrollWidth - container.clientWidth) / 2;
                        }, 100);
                    }
                }).catch(() => {
                    const t = window.t;
                    if (container) container.innerHTML = `<div class="text-gray-500 py-10">${t ? t('淘汰赛对阵图将在小组赛结束后生成', 'Knockout bracket will be generated after group stage.') : '淘汰赛对阵图将在小组赛结束后生成'}</div>`;
                });
            }
        }

        // Lazy-load top scorers
        if (tab === 'scorers' && scorersContent) {
            if (scorersContent.querySelector('.text-gray-500') || scorersContent.innerHTML.trim() === '') {
                scorersContent.innerHTML = `<div class="text-center py-10 text-gray-500">${window.WorldCup.Utils.tx('加载射手榜...', 'Loading scorers...')}</div>`;
                window.WorldCup.ApiClient.get('/api/tournament-stats').then(res => {
                    if (res.ok && res.data?.topScorers) {
                        scorersContent.innerHTML = renderTopScorers(res.data.topScorers);
                    } else {
                        scorersContent.innerHTML = `<div class="text-center py-10 text-gray-500">${window.WorldCup.Utils.tx('射手榜数据暂无', 'No scorer data available')}</div>`;
                    }
                }).catch(() => {
                    scorersContent.innerHTML = `<div class="text-center py-10 text-gray-500">${window.WorldCup.Utils.tx('射手榜加载失败', 'Failed to load scorers')}</div>`;
                });
            }
        }
    }

    function renderTopScorers(scorers) {
        const { esc, tx, attr } = window.WorldCup.Utils;
        const playerZh = (name) => (window.WorldCup.I18n?.translatePlayerName || ((n) => n))(name);
        if (!scorers.length) return `<div class="text-center py-10 text-gray-500">${tx('暂无射手数据', 'No scorer data')}</div>`;

        let html = '';
        scorers.slice(0, 20).forEach((p, i) => {
            const rank = i + 1;
            const nameZh = playerZh(p.name);
            const rankColor = rank <= 3 ? '#34d399' : 'rgba(248,250,252,.3)';
            const clickable = (p.athleteId || p.teamEspnId) ? ` data-action="open-player-detail" data-player-id="${attr(p.athleteId || '')}" data-team-id="${attr(p.teamEspnId || '')}" data-player-name="${attr(p.name)}" style="cursor:pointer"` : '';
            html += `<div class="schedule-row"${clickable}>
                <span style="font:600 13px/1 'JetBrains Mono', monospace;color:${rankColor};min-width:24px;text-align:center">${rank}</span>
                <span style="font-size:18px;flex-shrink:0">${p.flag || '🏳️'}</span>
                <div style="flex:1;min-width:0;overflow:hidden">
                    <div style="font:500 12px/1 'Inter';color:rgba(248,250,252,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nameZh)}</div>
                    <div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.3);margin-top:2px">${esc(p.team)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <div style="font:700 18px/1 'JetBrains Mono', monospace;color:#34d399">${p.goals}</div>
                    <div style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.2);margin-top:2px">${tx('球',' goals')}</div>
                </div>
            </div>`;
        });

        return html;
    }

    async function loadStandings() {
        const { esc, tx, displayGroupName, displayMaybeTeamName, attr } = window.WorldCup.Utils;
        const t = window.t;

        const container = document.getElementById('standings-sub-groups-content');
        container.innerHTML = `<div class="text-center py-10 text-gray-500">${tx('加载积分榜...', 'Loading table...')}</div>`;
        const res = await window.WorldCup.ApiClient.get('/api/standings');
        if (!res.ok || !res.data?.groups) {
            container.innerHTML = `<div class="text-center py-10 text-red-400">${tx('积分榜加载失败', 'Table failed to load')}</div>`;
            return;
        }
        const d = res.data;

        // 2-column grid for groups (design spec: 960px max-width)
        let html = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">` + d.groups.map(g => `
            <div style="background:rgba(15,23,42,.4);backdrop-filter:blur(48px);-webkit-backdrop-filter:blur(48px);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)">
                <div style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:space-between">
                    <span style="font:600 11px/1 'DM Sans',sans-serif;color:rgba(248,250,252,.5);letter-spacing:.5px">${esc(displayGroupName(g.name))}</span>
                    <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">MD ${g.matchday !== undefined ? g.matchday : 0}/3</span>
                </div>
                <table style="width:100%;table-layout:fixed;font-size:12px;border-collapse:separate;border-spacing:0">
                    <colgroup>
                        <col style="width:26px">
                        <col>
                        <col style="width:28px">
                        <col style="width:28px">
                        <col style="width:28px">
                        <col style="width:30px">
                        <col style="width:36px">
                    </colgroup>
                    <thead><tr style="font:400 8px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.2);border-bottom:1px solid rgba(255,255,255,.04)">
                        <th style="text-align:left;padding:6px 4px 6px 14px">#</th>
                        <th style="text-align:left;padding:6px 4px">${tx('球队','Team')}</th>
                        <th style="text-align:center;padding:6px 4px">${tx('胜','W')}</th>
                        <th style="text-align:center;padding:6px 4px">${tx('平','D')}</th>
                        <th style="text-align:center;padding:6px 4px">${tx('负','L')}</th>
                        <th style="text-align:center;padding:6px 4px">${tx('净','GD')}</th>
                        <th style="text-align:right;padding:6px 12px 6px 4px;font-weight:600">${tx('分','Pts')}</th>
                    </tr></thead>
                    <tbody>${g.standings.map((row, i) => {
                        const isQ1 = i === 0;
                        const isQ2 = i === 1;
                        const borderColor = isQ1 ? 'rgba(52,211,153,.35)' : isQ2 ? 'rgba(52,211,153,.18)' : 'transparent';
                        const ptsColor = isQ1 || isQ2 ? '#34d399' : 'rgba(59,130,246,.6)';
                        return `
                        <tr style="border-left:2px solid ${borderColor};border-bottom:1px solid rgba(255,255,255,.03)">
                            <td style="padding:6px 4px 6px 12px;font:400 11px/1 'JetBrains Mono', monospace;color:${isQ1?'rgba(52,211,153,.5)':'rgba(248,250,252,.2)'}">${i+1}</td>
                            <td style="padding:6px 4px"><div style="display:flex;align-items:center;gap:6px;overflow:hidden">
                                ${row.logo ? `<img src="${attr(row.logo)}" style="width:14px;height:14px;object-fit:contain;flex-shrink:0;border-radius:2px" onerror="this.style.display='none'">` : ''}
                                <span style="font:400 11px/1 'Inter';color:rgba(248,250,252,.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" data-action="open-team-detail" data-team-id="${attr(row.id)}" data-team-name="${attr(row.name)}" data-group="${attr(g.name)}">${esc(displayMaybeTeamName(row))}</span>
                            </div></td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.4)">${row.wins}</td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.4)">${row.draws}</td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.4)">${row.losses}</td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:${+row.gd>0?'rgba(52,211,153,.5)':+row.gd<0?'rgba(248,113,113,.3)':'rgba(248,250,252,.2)'}">${+row.gd>=0?'+':''}${row.gd}</td>
                            <td style="text-align:right;padding:6px 12px 6px 4px;font:600 12px/1 'JetBrains Mono', monospace;color:${ptsColor}">${row.pts}</td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>
        `).join('') + `</div>`;

        // Legend
        html += `<div style="display:flex;align-items:center;gap:12px;margin-top:12px;font:400 9px/1 'Inter';color:rgba(248,250,252,.2)">
            <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:2px;border-radius:1px;background:rgba(52,211,153,.35)"></div> ${tx('已晋级','Qualified')}</div>
            <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:2px;border-radius:1px;background:rgba(52,211,153,.18)"></div> ${tx('有望晋级','Likely qualified')}</div>
        </div>`;

        container.innerHTML = html;
    }

    // Event delegation for bracket match clicks
    document.addEventListener('click', (e) => {
        const card = e.target.closest('[data-action="open-match-from-bracket"]');
        if (!card) return;
        const matchId = card.dataset.matchId;
        if (!matchId) return;

        const openFn = window.WorldCup.MatchDetail?.open || window.WorldCup.MatchDetail?.openMatch || window.openMatch || window.openMatchDetail;
        if (openFn) {
            openFn(matchId);
        }
    });

    // Expose
    window.WorldCup.Standings = { loadStandings, switchStandingsSubTab };
    window.loadStandings = loadStandings;
    window.switchStandingsSubTab = switchStandingsSubTab;
    window.renderTopScorers = renderTopScorers;
})();
