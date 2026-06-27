// ========== scores.js - Live Scores Module ==========
(function() {
    async function loadScores() {
        const { tx, esc, displayMaybeTeamName, attr } = window.WorldCup.Utils;
        const t = window.t;
        const state = window.WorldCup.State;
        const res = await window.WorldCup.ApiClient.get('/api/scores');
        const d = res.data;
        const el = document.getElementById('live-list');
        if (!res.ok) {
            el.innerHTML = `<div style="text-align:center;padding:60px 0"><div style="font-size:40px;margin-bottom:10px">&#9888;&#65039;</div><p style="color:rgba(248,250,252,.3)">${res.isFailure ? tx('加载失败，请稍后重试', 'Failed to load, please retry') : esc(res.error || '')}</p></div>`;
            return;
        }
        const visibleMatches = d.matches || [];

        if (!visibleMatches.length) {
            el.innerHTML = `<div style="text-align:center;padding:60px 0"><div style="font-size:40px;margin-bottom:10px">&#128564;</div><p style="color:rgba(248,250,252,.3)">${esc(t('noMatchesToday'))}</p></div>`;
            // Update date even when no matches
            const dateEl2 = document.getElementById('live-date');
            if (dateEl2) {
                const now = new Date();
                dateEl2.textContent = now.toLocaleDateString(state.uiLang === 'zh' ? 'zh-CN' : 'en-US', {
                    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
                });
            }
            return;
        }

        // Sort into 3 buckets
        const inMatches = visibleMatches.filter(m => m.state === 'in');
        const postMatches = visibleMatches.filter(m => m.state === 'post');
        const preMatches = visibleMatches.filter(m => m.state === 'pre');

        // Build sections
        const sections = [];

        if (inMatches.length) {
            sections.push(sectionHeader('in', inMatches.length));
            sections.push(...inMatches.map(m => liveCard(m)));
        }

        if (postMatches.length) {
            sections.push(sectionHeader('post', postMatches.length));
            sections.push(...postMatches.map(m => doneCard(m)));
        }

        if (preMatches.length) {
            sections.push(sectionHeader('pre', preMatches.length));
            sections.push(...preMatches.map(m => preCard(m)));
        }

        el.innerHTML = sections.join('');

        // Update header badge
        const badge = document.getElementById('live-count-badge');
        if (badge && inMatches.length > 0) {
            badge.querySelector('span').textContent = inMatches.length + ' LIVE';
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }

        // Update live date
        const dateEl = document.getElementById('live-date');
        if (dateEl) {
            const now = new Date();
            const dateStr = now.toLocaleDateString(state.uiLang === 'zh' ? 'zh-CN' : 'en-US', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
            });
            dateEl.textContent = dateStr + ' · ESPN';
        }

        // Enrich live/finished match cards with stats (async, non-blocking)
        enrichMatchStats(visibleMatches);

        document.getElementById('update-time').textContent = t('updatePrefix') + new Date().toLocaleTimeString(state.uiLang === 'zh' ? 'zh-CN' : 'en-US', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' });
    }

    function sectionHeader(type, count) {
        const { tx } = window.WorldCup.Utils;
        const labels = {
            in: tx('进行中', 'IN PROGRESS'),
            post: tx('今日已结束', 'FINISHED TODAY'),
            pre: tx('即将开始', 'COMING UP')
        };
        const isLive = type === 'in';
        return `<div class="section-label${isLive ? ' section-label-live' : ''}">${isLive ? '<span class="dot"></span>' : ''}${labels[type]}</div>`;
    }

    // ── Live card (state === 'in') ──
    function liveCard(m) {
        const { esc, attr, tx, displayMaybeTeamName } = window.WorldCup.Utils;
        const action = 'open-match';

        let minute = '';
        if (m.status) {
            const minMatch = m.status.match(/(\d+)/);
            if (minMatch) minute = esc(minMatch[1]) + "'";
        }

        const groupInfo = esc(m.group || '');

        return `
        <div class="match-card-live" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || '')}" data-away-id="${attr(m.away.id || '')}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || '')}">
            <div class="accent-line"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div class="match-meta match-meta-live">${groupInfo}</div>
                <div class="live-badge">
                    <span class="dot"></span>
                    <span class="live-badge-text">${minute}</span>
                </div>
            </div>
            <div style="display:flex;align-items:center">
                <div style="flex:1;display:flex;align-items:center;gap:12px">
                    ${flagBadge(m.home, 'home')}
                    <div>
                        <div class="team-name-live">${esc(displayMaybeTeamName(m.home))}</div>
                        <div class="scorer-text scorer-home"></div>
                    </div>
                </div>
                <div style="min-width:90px;text-align:center">
                    <div class="score-jumbo" style="animation:score-flash 4s ease-in-out infinite">${esc(m.home.score)}<span class="score-sep">:</span>${esc(m.away.score)}</div>
                </div>
                <div style="flex:1;display:flex;align-items:center;gap:12px;justify-content:flex-end">
                    <div style="text-align:right">
                        <div class="team-name-live">${esc(displayMaybeTeamName(m.away))}</div>
                        <div class="scorer-text scorer-away"></div>
                    </div>
                    ${flagBadge(m.away, 'away')}
                </div>
            </div>
            <div class="stats-strip">
                <div class="stat-item">
                    <span class="stat-label">${tx('控球','Poss')}</span>
                    <div class="possession-bar"><div class="possession-home" data-stat="poss-h" style="width:50%"></div><div class="possession-away" data-stat="poss-a" style="width:50%"></div></div>
                    <span class="stat-val" data-stat="poss">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">${tx('射门','Shots')}</span>
                    <span class="stat-val" data-stat="shots">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">xG</span>
                    <span class="stat-val" data-stat="xg">--</span>
                </div>
            </div>
            ${probBarHTML(m)}
        </div>`;
    }

    // ── Finished card (state === 'post') ──
    function doneCard(m) {
        const { esc, attr, tx, displayMaybeTeamName } = window.WorldCup.Utils;
        const action = 'open-match';
        const groupInfo = esc(m.group || '');

        return `
        <div class="match-card-done" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || '')}" data-away-id="${attr(m.away.id || '')}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || '')}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div class="match-meta match-meta-done">${groupInfo}</div>
                <div class="ft-badge">FT</div>
            </div>
            <div style="display:flex;align-items:center">
                <div style="flex:1;display:flex;align-items:center;gap:12px">
                    ${flagBadge(m.home, 'neutral')}
                    <div>
                        <div class="team-name-dim">${esc(displayMaybeTeamName(m.home))}</div>
                        <div class="scorer-text scorer-dim"></div>
                    </div>
                </div>
                <div style="min-width:90px;text-align:center">
                    <div class="score-jumbo score-dim">${esc(m.home.score)}<span class="score-sep">:</span>${esc(m.away.score)}</div>
                </div>
                <div style="flex:1;display:flex;align-items:center;gap:12px;justify-content:flex-end">
                    <div style="text-align:right">
                        <div class="team-name-dim">${esc(displayMaybeTeamName(m.away))}</div>
                        <div class="scorer-text scorer-dim"></div>
                    </div>
                    ${flagBadge(m.away, 'neutral')}
                </div>
            </div>
            <div class="stats-strip-dim">
                <div class="stat-item">
                    <span class="stat-label-dim">${tx('控球','Poss')}</span>
                    <span class="stat-val-dim" data-stat="poss">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label-dim">${tx('射门','Shots')}</span>
                    <span class="stat-val-dim" data-stat="shots">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label-dim">xG</span>
                    <span class="stat-val-dim" data-stat="xg">--</span>
                </div>
                <div class="stat-item" style="margin-left:auto">
                    <span style="font:300 8px/1 'Inter';color:rgba(248,250,252,.1)">${esc(m.venue || '')}</span>
                </div>
            </div>
        </div>`;
    }

    // ── Upcoming card (state === 'pre') ──
    function preCard(m) {
        const { esc, attr, tx, displayMaybeTeamName } = window.WorldCup.Utils;
        const action = 'open-match';
        const groupInfo = esc(m.group || '');

        const timeText = (() => {
            const raw = String(m.timeBJT || m.dateBJT || '').trim();
            if (!raw) return '';
            const parts = raw.split(/\s+/);
            return (parts.length > 1 ? parts[1] : parts[0]).substring(0, 5);
        })();

        const homeEloVal = m.home.elo || m.home.rank || '';
        const awayEloVal = m.away.elo || m.away.rank || '';
        const homeRank = homeEloVal ? 'ELO ' + homeEloVal : '';
        const awayRank = awayEloVal ? 'ELO ' + awayEloVal : '';

        return `
        <div class="match-card-pre" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || '')}" data-away-id="${attr(m.away.id || '')}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || '')}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div class="match-meta match-meta-pre">${groupInfo}</div>
                <div class="time-badge">${esc(timeText)} CST</div>
            </div>
            <div style="display:flex;align-items:center">
                <div style="flex:1;display:flex;align-items:center;gap:12px">
                    ${flagBadge(m.home, 'neutral')}
                    <div>
                        <div class="team-name-pre">${esc(displayMaybeTeamName(m.home))}</div>
                        ${homeRank ? `<div class="elo-label">${homeRank}</div>` : ''}
                    </div>
                </div>
                <div style="min-width:90px;text-align:center">
                    <div style="font:300 18px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">&mdash; : &mdash;</div>
                </div>
                <div style="flex:1;display:flex;align-items:center;gap:12px;justify-content:flex-end">
                    <div style="text-align:right">
                        <div class="team-name-pre">${esc(displayMaybeTeamName(m.away))}</div>
                        ${awayRank ? `<div class="elo-label">${awayRank}</div>` : ''}
                    </div>
                    ${flagBadge(m.away, 'neutral')}
                </div>
            </div>
            ${probBarHTML(m)}
            ${m.venue ? `
            <div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.03)">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L8 4L5 7" stroke="rgba(248,250,252,.15)" stroke-width=".8"></path><circle cx="5" cy="9" r=".8" fill="rgba(248,250,252,.1)"></circle></svg>
                <span class="venue-text">${esc(m.venue)}</span>
            </div>` : ''}
        </div>`;
    }

    function flagBadge(team, type) {
        const { esc, attr } = window.WorldCup.Utils;
        const cls = type === 'home' ? 'flag-badge-home' : type === 'away' ? 'flag-badge-away' : 'flag-badge-neutral';
        if (team.logo) {
            return `<div class="flag-badge ${cls}" style="background-image:url(${attr(team.logo)});background-size:contain;background-position:center;background-repeat:no-repeat;background-color:rgba(255,255,255,.05)"></div>`;
        }
        if (team.flag) {
            return `<div class="flag-badge ${cls}">${esc(team.flag)}</div>`;
        }
        const initial = (team.abbr || team.name || '?').charAt(0).toUpperCase();
        return `<div class="flag-badge ${cls}" style="font:500 14px/1 'Inter'">${esc(initial)}</div>`;
    }

    // ── Probability bar helper ──
    function probBarHTML(m) {
        const hw = m.homeWin || 0, dr = m.draw || 0, aw = m.awayWin || 0;
        if (!hw && !dr && !aw) return '';
        const { tx } = window.WorldCup.Utils;
        return `
            <div class="prob-strip">
                <div class="prob-home" style="width:${hw}%"></div>
                <div class="prob-draw" style="width:${dr}%"></div>
                <div class="prob-away" style="width:${aw}%"></div>
            </div>
            <div class="prob-label-strip">
                <span class="prob-label-home">${hw}% ${tx('主胜','WIN')}</span>
                <span class="prob-label-draw">${dr}% ${tx('平局','DRAW')}</span>
                <span class="prob-label-away">${aw}% ${tx('客胜','WIN')}</span>
            </div>`;
    }

    // ── Enrich match cards with stats from /api/match/:id ──
    async function enrichMatchStats(matches) {
        const targets = matches.filter(m => m.state === 'in' || m.state === 'post');
        if (!targets.length) return;
        const results = await Promise.allSettled(
            targets.map(m => window.WorldCup.ApiClient.get('/api/match/' + m.id))
        );
        results.forEach((r, i) => {
            if (r.status !== 'fulfilled' || !r.value?.ok) return;
            const data = r.value.data;
            const card = document.querySelector('[data-match-id="' + targets[i].id + '"]');
            if (!card) return;
            const stats = {};
            for (const s of (data.teamStats || [])) {
                const n = (s.name || '').toLowerCase();
                const h = (s.home || '').replace('%','');
                const a = (s.away || '').replace('%','');
                if (n.includes('poss')) stats.poss = { h: parseInt(h)||50, a: parseInt(a)||50 };
                else if (n.includes('shot') && !n.includes('target') && !n.includes('block')) {
                    if (!stats.shots) stats.shots = { h: s.home, a: s.away };
                }
                else if (n.includes('expect') || n === 'xg') stats.xg = { h: s.home, a: s.away };
            }
            if (stats.poss) {
                const pe = card.querySelector('[data-stat="poss"]');
                const ph = card.querySelector('[data-stat="poss-h"]');
                const pa = card.querySelector('[data-stat="poss-a"]');
                if (pe) pe.textContent = stats.poss.h + ':' + stats.poss.a;
                if (ph) ph.style.width = stats.poss.h + '%';
                if (pa) pa.style.width = stats.poss.a + '%';
            }
            if (stats.shots) {
                const se = card.querySelector('[data-stat="shots"]');
                if (se) se.textContent = stats.shots.h + ':' + stats.shots.a;
            }
            if (stats.xg) {
                const xe = card.querySelector('[data-stat="xg"]');
                if (xe) xe.textContent = stats.xg.h + ':' + stats.xg.a;
            }
        });
    }

    // Router card: delegates to correct renderer by match state
    function card(m) {
        if (m.state === 'in') return liveCard(m);
        if (m.state === 'post') return doneCard(m);
        return preCard(m);
    }

    // Expose to WorldCup namespace
    window.WorldCup.Scores = {
        loadScores,
        liveCard,
        doneCard,
        preCard,
        card,
        flagBadge
    };

    // Also expose globally for backward compatibility
    window.loadScores = loadScores;
    window.card = card;
    window.logo = flagBadge;
})();
