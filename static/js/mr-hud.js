/**
 * Match Renderers — HUD Panels (Stats, WinProb, Pressure, LiveProb, Venue)
 *
 * Split from match-renderers.js (T7 refactoring)
 * Functions are attached to window.WorldCup.MatchRenderers namespace.
 */

window.WorldCup = window.WorldCup || {};
window.WorldCup.MatchRenderers = window.WorldCup.MatchRenderers || {};

(() => {
    const MR = window.WorldCup.MatchRenderers;
    const getLang = MR._shared.getLang;
    const tx = MR._shared.tx;
    const esc = MR._shared.esc;
    const attr = MR._shared.attr;
    const i18nText = MR._shared.i18nText;
    const FORMATION_POSITIONS = MR._shared.FORMATION_POSITIONS;
    const teamLabel = MR._shared.teamLabel;
    const teamFlagHtml = MR._shared.teamFlagHtml;
    const playerCoords = MR._shared.playerCoords;
    const translatePlayerName = MR._shared.translatePlayerName;

function renderHudStatsPanel(matchData, pred) {
    const stats = matchData?.teamStats;
    if (!stats || stats.length === 0) {
        return `<div class="text-gray-500 text-xs text-center py-6">${tx('暂无统计数据', 'No stats available')}</div>`;
    }
    const isFlat = stats.some(stat => stat && ('home' in stat || 'away' in stat));
    const hs = isFlat ? [] : (stats[0]?.statistics || []);
    const as = isFlat ? [] : (stats[1]?.statistics || []);
    const flatMap = new Map(stats.map(stat => [stat.name || stat.abbreviation, stat]));

    const findStat = (side, keys) => {
        const candidates = Array.isArray(keys) ? keys : [keys];
        if (isFlat) {
            for (const key of candidates) {
                const stat = flatMap.get(key);
                if (stat && stat[side] != null) return String(stat[side]);
            }
            return '0';
        }
        const arr = side === 'home' ? hs : as;
        const stat = arr.find(item => candidates.includes(item.name) || candidates.includes(item.abbreviation));
        return stat ? String(stat.displayValue ?? stat.value ?? '0') : '0';
    };
    const pct = (v) => parseFloat(v) || 0;
    const pctDisplay = (v) => {
        const n = pct(v);
        const normalized = n > 0 && n <= 1 ? n * 100 : n;
        return `${Math.round(normalized * 10) / 10}%`;
    };

    const statRows = [
        { keys: ['possessionPct', 'Possession'], label: tx('控球率', 'Possession'), fmt: pctDisplay },
        { keys: ['totalShots', 'Total Shots'], label: tx('射门', 'Shots'), fmt: v => v },
        { keys: ['shotsOnTarget', 'Shots on Target'], label: tx('射正', 'On Target'), fmt: v => v },
        { keys: ['passPct', 'PassAccuracy'], label: tx('传球成功', 'Pass Acc.'), fmt: pctDisplay },
        { keys: ['wonCorners', 'Corners'], label: tx('角球', 'Corners'), fmt: v => v },
        { keys: ['foulsCommitted', 'Fouls Committed'], label: tx('犯规', 'Fouls'), fmt: v => v },
    ];

    let html = `<div style="padding:16px 18px">`;
    html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px">${tx('比赛统计', 'MATCH STATISTICS')}</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:12px">`;

    for (const row of statRows) {
        const hRaw = findStat('home', row.keys);
        const aRaw = findStat('away', row.keys);
        const hVal = row.fmt(hRaw);
        const aVal = row.fmt(aRaw);
        const hNum = pct(hRaw);
        const aNum = pct(aRaw);
        const total = hNum + aNum || 1;
        const hPct = Math.round((hNum / total) * 100);

        html += `<div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
                <span style="font:500 16px/1 'JetBrains Mono',monospace;color:#f8fafc">${esc(hVal)}</span>
                <span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.3)">${esc(row.label)}</span>
                <span style="font:500 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.45)">${esc(aVal)}</span>
            </div>
            <div style="display:flex;height:4px;gap:2px;border-radius:2px;overflow:hidden">
                <div style="width:${hPct}%;background:linear-gradient(90deg,rgba(59,130,246,.5),rgba(59,130,246,.25));border-radius:2px"></div>
                <div style="width:${100 - hPct}%;background:rgba(248,113,113,.15);border-radius:2px"></div>
            </div>
        </div>`;
    }

    html += `</div>`;

    // Poisson xG section
    if (pred && pred.goals) {
        const hxG = pred.goals.homeExpected != null ? Number(pred.goals.homeExpected).toFixed(1) : '-';
        const axG = pred.goals.awayExpected != null ? Number(pred.goals.awayExpected).toFixed(1) : '-';
        html += `<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.04)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">${tx('泊松期望进球', 'POISSON EXPECTED SCORE')}</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:16px">
                <div style="text-align:center"><div style="font:300 32px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.6)">${hxG}</div><div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">xG ${tx('主', 'H')}</div></div>
                <div style="font:300 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1)">—</div>
                <div style="text-align:center"><div style="font:300 32px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.5)">${axG}</div><div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">xG ${tx('客', 'A')}</div></div>
            </div>
        </div>`;
    }

    html += `</div>`;
    return html;
}

/**
 * HUD Right Panel — Win Probability arc + breakdown bar
 */

function renderHudWinProbPanel(pred, homeName, awayName) {
    if (!pred || pred.homeWin == null) {
        return `<div class="text-gray-500 text-xs text-center py-6">${tx('预测数据加载失败', 'Prediction unavailable')}</div>`;
    }
    const hw = Math.round((pred.homeWin || 0) * 100);
    const dr = Math.round((pred.draw || 0) * 100);
    const aw = 100 - hw - dr;
    const expectedHome = Number(pred.goals?.homeExpected);
    const expectedAway = Number(pred.goals?.awayExpected);
    const fallbackScore = Number.isFinite(expectedHome) && Number.isFinite(expectedAway)
        ? `${Math.max(0, Math.round(expectedHome))}-${Math.max(0, Math.round(expectedAway))}`
        : `${hw > aw ? 1 : 0}-${aw > hw ? 1 : 0}`;
    const score = String(pred.likelyScore || fallbackScore);
    const scoreParts = score.split(/[-:]/).map(s => s.trim());
    const [sH, sA] = scoreParts.length >= 2 ? scoreParts : ['?', '?'];

    // Three-segment arc: left=home(blue) → draw(amber) → away(red)=right
    // Semicircle: center (90,76), radius 66, sweeps left→top→right
    const cx = 90, cy = 76, r = 66, SW = 10;
    const pt = pct => {
        const θ = Math.PI * (1 - pct / 100);
        return { x: +(cx + r * Math.cos(θ)).toFixed(2), y: +(cy - r * Math.sin(θ)).toFixed(2) };
    };
    const p0 = pt(0);           // left (home start)
    const p1 = pt(hw);          // home/draw boundary
    const p2 = pt(hw + dr);     // draw/away boundary
    const p3 = pt(100);         // right (away end)
    const seg = (a, b, col) => (a.x === b.x && a.y === b.y) ? '' :
        `<path d="M${a.x} ${a.y} A${r} ${r} 0 0 1 ${b.x} ${b.y}" fill="none" stroke="${col}" stroke-width="${SW}" stroke-linecap="butt"/>`;

    let html = `<div style="background:rgba(15,23,42,.45);backdrop-filter:blur(var(--glass-blur-sm));border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px 18px;box-shadow:0 4px 30px rgba(0,0,0,.4)">`;
    html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx('胜率预测', 'WIN PROBABILITY')}</div>`;

    // SVG: bg arc → three segments → outer round caps → separator dots
    html += `<div style="text-align:center;margin-bottom:4px">
        <svg width="180" height="88" viewBox="0 0 180 88">
            <path d="M${p0.x} ${p0.y} A${r} ${r} 0 0 1 ${p3.x} ${p3.y}" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="${SW}" stroke-linecap="butt"/>
            ${hw > 1 ? seg(p0, p1, 'rgba(59,130,246,.6)') : ''}
            ${dr > 1 ? seg(p1, p2, 'rgba(251,191,36,.5)') : ''}
            ${aw > 1 ? seg(p2, p3, 'rgba(248,113,113,.5)') : ''}
            <circle cx="${p0.x}" cy="${p0.y}" r="${SW / 2}" fill="${hw > 1 ? 'rgba(59,130,246,.6)' : 'rgba(255,255,255,.05)'}"/>
            <circle cx="${p3.x}" cy="${p3.y}" r="${SW / 2}" fill="${aw > 1 ? 'rgba(248,113,113,.5)' : 'rgba(255,255,255,.05)'}"/>
            ${hw > 2 && dr > 2 ? `<circle cx="${p1.x}" cy="${p1.y}" r="${SW / 2 + 1.5}" fill="rgba(10,18,36,.96)"/>` : ''}
            ${dr > 2 && aw > 2 ? `<circle cx="${p2.x}" cy="${p2.y}" r="${SW / 2 + 1.5}" fill="rgba(10,18,36,.96)"/>` : ''}
            <text x="${cx}" y="44" text-anchor="middle" fill="#f8fafc" font-family="JetBrains Mono" font-size="26" font-weight="300">${hw}<tspan font-size="13" fill="rgba(248,250,252,.3)">%</tspan></text>
            <text x="${cx}" y="60" text-anchor="middle" fill="rgba(59,130,246,.45)" font-family="JetBrains Mono" font-size="7" font-weight="400" letter-spacing="1.5">${esc((homeName || 'HOME').toUpperCase())} WIN</text>
        </svg>
    </div>`;

    // Three numbers below arc
    html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:0 2px;margin-bottom:12px">
        <div style="text-align:left">
            <div style="font:600 15px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.8)">${hw}<span style="font-size:9px;font-weight:400;color:rgba(59,130,246,.35)">%</span></div>
            <div style="font:400 7px/1 'Inter';color:rgba(59,130,246,.3);margin-top:3px;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(homeName || 'HOME')}</div>
        </div>
        <div style="text-align:center">
            <div style="font:400 12px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.55)">${dr}<span style="font-size:9px;color:rgba(251,191,36,.25)">%</span></div>
            <div style="font:400 7px/1 'Inter';color:rgba(251,191,36,.25);margin-top:3px">${tx('平', 'DRAW')}</div>
        </div>
        <div style="text-align:right">
            <div style="font:500 13px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.6)">${aw}<span style="font-size:9px;font-weight:400;color:rgba(248,113,113,.25)">%</span></div>
            <div style="font:400 7px/1 'Inter';color:rgba(248,113,113,.25);margin-top:3px;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl">${esc(awayName || 'AWAY')}</div>
        </div>
    </div>`;

    // Predicted scores
    if (Array.isArray(pred.topScores) && pred.topScores.length > 0) {
        html += `<div style="padding-top:12px;border-top:1px solid rgba(255,255,255,.04)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.35);letter-spacing:1.5px;margin-bottom:8px">${tx('可能比分矩阵', 'TOP PREDICTED SCORES')}</div>
            <div style="display:flex;flex-direction:column;gap:5px">`;
        pred.topScores.slice(0, 4).forEach((item, idx) => {
            const probPct = item.prob != null ? `${(Number(item.prob) * 100).toFixed(2)}%` : '';
            html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05)">
                <span style="font:500 12px/1 'JetBrains Mono',monospace;color:${idx === 0 ? 'rgba(52,211,153,.85)' : 'rgba(248,250,252,.65)'}">${esc(item.score)}</span>
                ${probPct ? `<span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.4)">${probPct}</span>` : ''}
            </div>`;
        });
        html += `</div></div>`;
    } else {
        html += `<div style="padding-top:12px;border-top:1px solid rgba(255,255,255,.04)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.35);letter-spacing:1.5px;margin-bottom:8px">${tx('预测比分', 'PREDICTED SCORE')}</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:12px">
                <div style="padding:6px 16px;border-radius:8px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.12)"><span style="font:300 20px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.6)">${esc(sH)}</span></div>
                <span style="font:300 12px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1)">:</span>
                <div style="padding:6px 16px;border-radius:8px;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.08)"><span style="font:300 20px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.45)">${esc(sA)}</span></div>
            </div>
        </div>`;
    }

    html += `</div>`;
    return html;
}

/**
 * HUD Right Panel — Pressure Index card
 * Shows dual-color split bar (current PI) + SVG sparkline trend
 */

function renderPressurePanel(pressureData, homeName, awayName) {
    if (!pressureData || pressureData.error) return '';
    const current = pressureData.current;
    const curve = Array.isArray(pressureData.curve) ? pressureData.curve : [];
    if (!current && curve.length === 0) return '';

    const homePI = current?.home ?? 0;
    const awayPI = current?.away ?? 0;
    const total = homePI + awayPI || 1;
    const homePct = Math.round((homePI / total) * 100);
    const awayPct = 100 - homePct;
    const dominant = current?.dominant;
    const minute = current?.atMinute;

    const domLabel = dominant === 'home'
        ? `<span style="color:rgba(59,130,246,.7)">${esc(homeName)}</span>`
        : dominant === 'away'
        ? `<span style="color:rgba(248,113,113,.6)">${esc(awayName)}</span>`
        : `<span style="color:rgba(248,250,252,.25)">${tx('均势', 'Even')}</span>`;

    let html = `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx('态势走势', 'MOMENTUM')}</div>`;

    // Sparkline
    if (curve.length > 1) {
        const W = 244, H = 52;
        const maxMin = Math.max(...curve.map(r => r.minute), 90);
        const toX = m => ((m / maxMin) * (W - 8) + 4).toFixed(1);
        const toY = v => (H - 4 - (Math.min(v, 100) / 100) * (H - 10)).toFixed(1);

        const hPts = curve.map(r => `${toX(r.minute)},${toY(r.pressure_home)}`).join(' ');
        const aPts = curve.map(r => `${toX(r.minute)},${toY(r.pressure_away)}`).join(' ');
        const last = curve[curve.length - 1];
        const midY = toY(50);

        html += `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin-bottom:10px;overflow:visible">
            <line x1="4" y1="${midY}" x2="${W - 4}" y2="${midY}" stroke="rgba(255,255,255,.05)" stroke-width="1" stroke-dasharray="2,4"/>
            <polyline points="${hPts}" fill="none" stroke="rgba(59,130,246,.55)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            <polyline points="${aPts}" fill="none" stroke="rgba(248,113,113,.45)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="${toX(last.minute)}" cy="${toY(last.pressure_home)}" r="2.5" fill="rgba(59,130,246,.8)"/>
            <circle cx="${toX(last.minute)}" cy="${toY(last.pressure_away)}" r="2.5" fill="rgba(248,113,113,.7)"/>
        </svg>`;
    }

    // Current PI split bar
    html += `<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;gap:1px;margin-bottom:6px">
        <div style="width:${homePct}%;background:rgba(59,130,246,.18);display:flex;align-items:center;justify-content:center;min-width:28px">
            <span style="font:500 9px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.75)">${homePI.toFixed(0)}</span>
        </div>
        <div style="width:${awayPct}%;background:rgba(248,113,113,.12);display:flex;align-items:center;justify-content:center;min-width:28px">
            <span style="font:400 9px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.55)">${awayPI.toFixed(0)}</span>
        </div>
    </div>`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.35)">${esc(homeName || 'H')}</span>
        <span style="font:400 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.18)">${domLabel} ${tx('主导', 'dominant')}${minute != null ? ` · ${minute}'` : ''}</span>
        <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.3)">${esc(awayName || 'A')}</span>
    </div>`;

    // Legend
    html += `<div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">
        <div style="display:flex;align-items:center;gap:4px"><div style="width:16px;height:1.5px;background:rgba(59,130,246,.55)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(homeName || 'H')}</span></div>
        <div style="display:flex;align-items:center;gap:4px"><div style="width:16px;height:1.5px;background:rgba(248,113,113,.45)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(awayName || 'A')}</span></div>
        <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1);margin-left:auto">${tx('压力指数', 'PI 0–100')}</span>
    </div>`;

    return html;
}

/**
 * HUD Right Panel — Live Probability Journey (Track A)
 * Shows SVG 3-line chart of how W/D/L probabilities evolved through the match
 */

function renderLiveProbPanel(data, homeName, awayName) {
    if (!data || data.error) return '';
    const preMatch = data.preMatch || {};
    const current = data.current || null;
    const curve = Array.isArray(data.curve) ? data.curve : [];
    if (!preMatch.homeWin && curve.length === 0) return '';

    const W = 244, H = 64;
    const pct = v => Math.round((v || 0) * 100);

    let html = `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx('概率走势', 'PROB JOURNEY')}</div>`;

    // ── Live Score & Match State Machine Bar (pre/match/ht/et/pen/end) ──
    const st = data.liveState?.state || (current && (current.minuteElapsed > 0 || current.homeScore > 0 || current.awayScore > 0) ? 'match' : 'pre');
    const stLabel = data.liveState?.label || (st === 'end' ? 'FT' : st === 'match' ? 'LIVE' : 'PRE');
    const hSc = data.score?.home ?? current?.homeScore ?? '-';
    const aSc = data.score?.away ?? current?.awayScore ?? '-';

    const stStyles = {
        pre:   'background:rgba(100,116,139,.15);color:#94a3b8;border:1px solid rgba(100,116,139,.25)',
        match: 'background:rgba(52,211,153,.15);color:#34d399;border:1px solid rgba(52,211,153,.3)',
        ht:    'background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.3)',
        et:    'background:rgba(168,85,247,.15);color:#c084fc;border:1px solid rgba(168,85,247,.3)',
        pen:   'background:rgba(244,63,94,.15);color:#fb7185;border:1px solid rgba(244,63,94,.3)',
        end:   'background:rgba(100,116,139,.2);color:#cbd5e1;border:1px solid rgba(100,116,139,.3)',
    };
    const badgeStyle = stStyles[st] || stStyles.pre;
    const pulseCircle = st === 'match' ? `<div style="width:5px;height:5px;border-radius:50%;background:#34d399;animation:pulse-live 1.8s ease-in-out infinite"></div>` : '';

    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:6px;max-width:35%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            <span style="font:500 11px/1 'Inter';color:#f8fafc" title="${esc(homeName || '')}">${esc(homeName || 'H')}</span>
            <span style="font:700 14px/1 'JetBrains Mono',monospace;color:#f8fafc">${esc(String(hSc))}</span>
        </div>
        <div style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;font:600 8px/1 'JetBrains Mono',monospace;letter-spacing:0.5px;flex-shrink:0;${badgeStyle}">
            ${pulseCircle}<span>${esc(stLabel)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;max-width:35%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            <span style="font:700 14px/1 'JetBrains Mono',monospace;color:#f8fafc">${esc(String(aSc))}</span>
            <span style="font:500 11px/1 'Inter';color:#f8fafc" title="${esc(awayName || '')}">${esc(awayName || 'A')}</span>
        </div>
    </div>`;

    // SVG chart
    if (curve.length > 1) {
        const maxMin = Math.max(...curve.map(r => r.minute || 0), 90);
        const toX = m => ((Math.min(m || 0, maxMin) / maxMin) * (W - 8) + 4).toFixed(1);
        const toY = v => (H - 4 - Math.min(Math.max(v || 0, 0), 1) * (H - 12)).toFixed(1);

        const hPts = curve.map(r => `${toX(r.minute)},${toY(r.prob_home_win)}`).join(' ');
        const dPts = curve.map(r => `${toX(r.minute)},${toY(r.prob_draw)}`).join(' ');
        const aPts = curve.map(r => `${toX(r.minute)},${toY(r.prob_away_win)}`).join(' ');
        const pmHY = toY(preMatch.homeWin || 0);
        const goals = curve.filter(r => r.type === 'goal');

        html += `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin-bottom:8px;overflow:visible">
            <line x1="4" y1="${pmHY}" x2="${W - 4}" y2="${pmHY}" stroke="rgba(59,130,246,.12)" stroke-width="1" stroke-dasharray="3,5"/>
            <polyline points="${aPts}" fill="none" stroke="rgba(248,113,113,.5)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            <polyline points="${dPts}" fill="none" stroke="rgba(251,191,36,.4)" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>
            <polyline points="${hPts}" fill="none" stroke="rgba(59,130,246,.75)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
            ${goals.map(g => `<circle cx="${toX(g.minute)}" cy="${toY(g.prob_home_win)}" r="2.5" fill="rgba(52,211,153,.85)"/>`).join('')}
        </svg>`;
    }

    // Pre-match baseline row
    const pmH = pct(preMatch.homeWin), pmD = pct(preMatch.draw), pmA = pct(preMatch.awayWin);
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);margin-bottom:5px">
        <span style="font:400 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.18)">${tx('赛前', 'PRE')}</span>
        <div style="display:flex;gap:8px">
            <span style="font:500 10px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.6)">${pmH}%</span>
            <span style="font:400 9px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.4)">${pmD}%</span>
            <span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.5)">${pmA}%</span>
        </div>
    </div>`;

    // Current live probability (Track A) — only show if we have a real live state
    if (current && !current.error && (current.minuteElapsed > 0 || current.homeScore > 0 || current.awayScore > 0)) {
        const lH = pct(current.homeWin), lD = pct(current.draw), lA = pct(current.awayWin);
        const delta = (current.homeWin || 0) - (preMatch.homeWin || 0);
        const deltaStr = delta > 0.005 ? `+${Math.round(delta * 100)}%` : delta < -0.005 ? `${Math.round(delta * 100)}%` : '';
        const deltaColor = delta > 0.005 ? 'rgba(52,211,153,.7)' : delta < -0.005 ? 'rgba(248,113,113,.6)' : 'rgba(248,250,252,.2)';
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.13)">
            <span style="font:400 7px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.5)">${tx('当前', 'NOW')}</span>
            <div style="display:flex;gap:8px;align-items:center">
                <span style="font:700 11px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.85)">${lH}%</span>
                <span style="font:400 9px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.45)">${lD}%</span>
                <span style="font:500 10px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.6)">${lA}%</span>
                ${deltaStr ? `<span style="font:500 8px/1 'JetBrains Mono',monospace;color:${deltaColor}">${esc(deltaStr)}</span>` : ''}
            </div>
        </div>`;
    }

    // Legend
    html += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">
        <div style="display:flex;align-items:center;gap:3px"><div style="width:12px;height:2px;background:rgba(59,130,246,.75)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(homeName || 'H')}</span></div>
        <div style="display:flex;align-items:center;gap:3px"><div style="width:12px;height:1.5px;background:rgba(251,191,36,.4)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${tx('平', 'D')}</span></div>
        <div style="display:flex;align-items:center;gap:3px"><div style="width:12px;height:1.5px;background:rgba(248,113,113,.5)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(awayName || 'A')}</span></div>
        <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1);margin-left:auto">Track A</span>
    </div>`;

    // ── Knockout advance probability (C refactor: regulation vs advance) ──
    if (data.isKnockout && data.advance) {
        const adv = data.advance;
        const aH = pct(adv.homeWin), aA = pct(adv.awayWin);
        html += `<div style="margin-top:8px;padding:6px 8px;border-radius:6px;background:rgba(168,85,247,.07);border:1px solid rgba(168,85,247,.13)">
            <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font:400 7px/1 'JetBrains Mono',monospace;color:rgba(168,85,247,.5)">🏆 ${tx('晋级', 'ADVANCE')}</span>
                <div style="display:flex;gap:8px;align-items:center">
                    <span style="font:700 11px/1 'JetBrains Mono',monospace;color:rgba(168,85,247,.85)">${aH}%</span>
                    <span style="font:500 10px/1 'JetBrains Mono',monospace;color:rgba(244,63,94,.6)">${aA}%</span>
                </div>
            </div>
            ${adv.homeWinAfterET > 0 || adv.awayWinAfterET > 0 ? `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px;padding-top:3px;border-top:1px solid rgba(168,85,247,.08)">
                <span style="font:300 6px/1 'Inter';color:rgba(248,250,252,.12)">${tx('加时', 'ET')} · ${tx('点球', 'PEN')}</span>
                <div style="display:flex;gap:6px">
                    <span style="font:400 8px/1 'JetBrains Mono',monospace;color:rgba(168,85,247,.4)">${pct(adv.penaltyHomeWin)}%</span>
                    <span style="font:400 8px/1 'JetBrains Mono',monospace;color:rgba(244,63,94,.3)">${pct(adv.penaltyAwayWin)}%</span>
                </div>
            </div>` : ''}
        </div>`;
    }

    return html;
}

/**
 * HUD Right Panel — Venue Conditions card
 */

function renderHudVenuePanel(venueData) {
    if (!venueData || venueData.error) {
        return '';
    }
    const v = venueData;
    const w = v.weather;
    const impact = v.impact;
    const meta = v.meta;

    let html = `<div style="background:rgba(15,23,42,.45);backdrop-filter:blur(var(--glass-blur-sm));border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.4)">`;
    html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;padding:16px 18px 12px">${tx('场地条件', 'VENUE CONDITIONS')}</div>`;

    // Wikipedia thumbnail
    if (v.wikiThumb) {
        html += `<div style="padding:0 18px;margin-bottom:12px"><img src="${esc(v.wikiThumb)}" alt="${esc(v.name || '')}" style="width:100%;height:120px;object-fit:cover;border-radius:10px;opacity:.85" loading="lazy"></div>`;
    }

    html += `<div style="padding:0 18px"><div style="font:italic 400 15px/1 'Instrument Serif',serif;color:rgba(248,250,252,.6);margin-bottom:3px">${esc(v.name || '')}</div>`;
    html += `<div style="font:400 9px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:14px">${esc(v.city || '')}, ${esc(v.country || '')}</div></div>`;

    // Meta cards (yearBuilt, architect, cost) + capacity from venues.json
    const metaCards = [];
    if (v.capacity) metaCards.push({ label: tx('容量', 'Capacity'), value: v.capacity.toLocaleString(), color: 'rgba(248,250,252,.5)' });
    if (meta?.yearBuilt) metaCards.push({ label: tx('建造', 'Built'), value: String(meta.yearBuilt), color: 'rgba(167,139,250,.6)' });
    if (meta?.architect) metaCards.push({ label: tx('建筑师', 'Architect'), value: meta.architect, color: 'rgba(251,191,36,.5)' });
    if (meta?.cost) metaCards.push({ label: tx('造价', 'Cost'), value: meta.cost, color: 'rgba(52,211,153,.5)' });

    if (metaCards.length > 0) {
        const cols = metaCards.length <= 2 ? metaCards.length : 2;
        html += `<div style="padding:0 18px;margin-bottom:14px;display:grid;grid-template-columns:${'1fr '.repeat(cols).trim()};gap:8px">`;
        for (const c of metaCards) {
            html += `<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
                <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${c.label}</div>
                <div style="font:500 12px/1.2 'JetBrains Mono',monospace;color:${c.color}">${esc(c.value)}</div>
            </div>`;
        }
        html += `</div>`;
    }

    // Weather cards: altitude, temp, surface, humidity
    const alt = v.altitude || 0;
    const altWarn = alt > 1500;
    const temp = w?.temp || '--';
    const hum = w?.humidity || '--';
    const grass = v.grass || (meta?.surfaceI18n
        ? window.WorldCup.I18n.i18nText(meta.surfaceI18n, meta.surface || '')
        : meta?.surface) || tx('未知', 'N/A');

    html += `<div style="padding:0 18px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
            <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx('海拔', 'Altitude')}</div>
            <div style="font:400 18px/1 'JetBrains Mono',monospace;color:rgba(251,146,60,.6)">${alt.toLocaleString()}<span style="font-size:9px;color:rgba(251,146,60,.3)">m</span></div>
            ${altWarn ? `<div style="font:400 7px/1 'Inter';color:rgba(251,146,60,.35);margin-top:3px">⚠ ${tx('高海拔', 'High altitude')}</div>` : ''}
        </div>
        <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
            <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx('温度', 'Temp')}</div>
            <div style="font:400 18px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${esc(String(temp))}<span style="font-size:9px;color:rgba(248,250,252,.2)">°C</span></div>
        </div>
        <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
            <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx('草皮', 'Surface')}</div>
            <div style="font:500 11px/1 'Inter';color:rgba(52,211,153,.5);margin-top:2px">${esc(grass)}</div>
        </div>
        <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
            <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx('湿度', 'Humidity')}</div>
            <div style="font:400 18px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${esc(String(hum))}<span style="font-size:9px;color:rgba(248,250,252,.2)">%</span></div>
        </div>
    </div>`;

    // Venue factor impact
    if (impact && impact.overall != null) {
        const pct = Math.min(100, Math.max(0, Math.round((impact.overall + 50))));
        const color = impact.overall > 5 ? 'rgba(52,211,153,.5)' : impact.overall < -5 ? 'rgba(248,113,113,.5)' : 'rgba(251,146,60,.5)';
        html += `<div style="margin-top:12px;padding:10px;border-radius:8px;background:rgba(251,146,60,.04);border:1px solid rgba(251,146,60,.08)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(251,146,60,.4);letter-spacing:1px;margin-bottom:6px">${tx('场地因子', 'VENUE FACTOR')}</div>
            <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:4px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${color},${color.replace('.5', '.15')});border-radius:2px"></div></div>
                <span style="font:400 10px/1 'JetBrains Mono',monospace;color:${color}">${impact.overall > 0 ? '+' : ''}${impact.overall.toFixed(0)}</span>
            </div>
        </div>`;
    }

    html += `</div>`;
    return html;
}

// Export functions
    // Export to namespace
    MR.renderHudStatsPanel = renderHudStatsPanel;
    MR.renderHudWinProbPanel = renderHudWinProbPanel;
    MR.renderPressurePanel = renderPressurePanel;
    MR.renderLiveProbPanel = renderLiveProbPanel;
    MR.renderHudVenuePanel = renderHudVenuePanel;
})();
