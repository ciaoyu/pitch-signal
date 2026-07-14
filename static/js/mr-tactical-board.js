/**
 * Match Renderers — Tactical Board SVG Renderer
 *
 * Split from match-renderers.js (T7 refactoring)
 * Functions are attached to window.WorldCup.MatchRenderers namespace.
 */

window.WorldCup = window.WorldCup || {};
window.WorldCup.MatchRenderers = window.WorldCup.MatchRenderers || {};

(() => {
    const MR = window.WorldCup.MatchRenderers;
    const { Formatters, ApiClient, State, Utils } = window.WorldCup;
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

function renderTacticalBoard(matchupData, matchData) {
    // Flatten gk/def/mid/fwd into players if players array is empty
    if (matchupData) {
        ['home', 'away'].forEach(side => {
            const s = matchupData[side];
            if (s && (!s.players || !s.players.length)) {
                s.players = [...(s.gk || []), ...(s.def || []), ...(s.mid || []), ...(s.fwd || [])];
            }
        });
    }
    const hasData = matchupData
        && matchupData.home?.players?.length >= 1
        && matchupData.away?.players?.length >= 1;

    let svg = `<svg viewBox="0 0 100 160" class="w-full rounded-xl border-2 border-white/10" style="display:block;max-width:420px;margin:0 auto">`;

    // ── Defs: gradients + avatar clip ──
    svg += `<defs>
        <linearGradient id="tb-pitch" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e5631"/>
            <stop offset="49%" stop-color="#1a472a"/>
            <stop offset="50%" stop-color="#1a472a"/>
            <stop offset="100%" stop-color="#1e5631"/>
        </linearGradient>
        <linearGradient id="tb-m-critical-home" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#9ca3af" stop-opacity="0.3"/>
        </linearGradient>
        <linearGradient id="tb-m-critical-away" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#9ca3af" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.9"/>
        </linearGradient>
        <linearGradient id="tb-m-even" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#9ca3af" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#9ca3af" stop-opacity="0.4"/>
        </linearGradient>
        <linearGradient id="tb-m-key" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#f87171" stop-opacity="0.2"/>
        </linearGradient>
        <clipPath id="tb-avatar-clip"><circle r="2.8" cx="0" cy="0"/></clipPath>
        <filter id="tb-ability-blur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.2"/>
        </filter>
        <radialGradient id="halo-glow-home" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="1.0"/>
            <stop offset="35%" stop-color="#3b82f6" stop-opacity="0.85"/>
            <stop offset="70%" stop-color="#3b82f6" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="halo-glow-away" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="1.0"/>
            <stop offset="35%" stop-color="#ef4444" stop-opacity="0.85"/>
            <stop offset="70%" stop-color="#ef4444" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
        </radialGradient>
    </defs>
    <style>
        .pitch-player-group {
            cursor: pointer;
        }
        .ability-halo {
            transition: opacity 0.2s ease;
        }
        .pitch-player-group:hover .ability-halo {
            opacity: 1.0 !important;
        }
        .pitch-player-group:hover .player-core {
            stroke-width: 0.7px !important;
            filter: drop-shadow(0 0.8px 1.5px rgba(0,0,0,0.5)) !important;
        }
    </style>`;

    // ── Pitch background ──
    svg += `<rect width="100" height="160" fill="url(#tb-pitch)"/>`;

    // ── Grass stripes (horizontal zebra, 20 bands, every other at 0.03 opacity) ──
    for (let i = 0; i < 20; i += 2) svg += `<rect x="0" y="${i * 8}" width="100" height="8" fill="rgba(255,255,255,0.03)"/>`;

    // ── Pitch markings ──
    svg += `<line x1="0" y1="80" x2="100" y2="80" stroke="rgba(255,255,255,0.15)" stroke-width="0.3"/>`;
    svg += `<circle cx="50" cy="80" r="12" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
    svg += `<circle cx="50" cy="80" r="0.8" fill="rgba(255,255,255,0.2)"/>`;
    // Home penalty area
    svg += `<rect x="20" y="0" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
    svg += `<rect x="35" y="0" width="30" height="8" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
    // Away penalty area
    svg += `<rect x="20" y="140" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
    svg += `<rect x="35" y="152" width="30" height="8" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
    // Center circle arc at home (just decorative)
    svg += `<path d="M 38 80 A 12 12 0 0 0 62 80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.3"/>`;
    svg += `<path d="M 38 80 A 12 12 0 0 1 62 80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.3"/>`;
    // Penalty arcs (semi-circles at penalty area edges)
    svg += `<path d="M 38 20 A 12 12 0 0 0 62 20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
    svg += `<path d="M 38 140 A 12 12 0 0 1 62 140" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
    // Corner arcs (4 corners, radius 2)
    svg += `<path d="M 2 0 A 2 2 0 0 1 0 2" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
    svg += `<path d="M 98 0 A 2 2 0 0 0 100 2" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
    svg += `<path d="M 100 158 A 2 2 0 0 0 98 160" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
    svg += `<path d="M 0 158 A 2 2 0 0 1 2 160" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;

    // ── Source badge (official / projected) ──
    // Priority: matchupData.source > matchupData.lineupSource; then per-team source
    // official → green bg, white text: "FIFA official lineup · announced HH:MM"
    // projected → amber bg: "projected lineup (mode of this tournament / most recent match)"
    const renderSourceBadge = (source, announceTime, x, y) => {
        if (!source) return '';
        const isOfficial = source === 'official';
        const bg = isOfficial ? 'rgba(16,185,129,0.85)' : 'rgba(245,158,11,0.85)';
        const textZh = isOfficial
            ? `FIFA 官方首发${announceTime ? ' · ' + announceTime + ' 公布' : ''}`
            : '预测阵容（本届众数/最近一场）';
        const textEn = isOfficial
            ? `Official XI${announceTime ? ' · ' + announceTime : ''}`
            : 'Projected XI (mode/recent)';
        const text = getLang() === 'en' ? textEn : textZh;
        const w = isOfficial ? 44 : 52;
        return `<g transform="translate(${x - w/2},${y})">
            <rect x="0" y="0" width="${w}" height="4.5" rx="2" fill="${bg}" opacity="0.95"/>
            <text x="${w/2}" y="3.1" text-anchor="middle" font-size="2.2" font-weight="600" fill="white" dominant-baseline="middle">${esc(text)}</text>
        </g>`;
    };
    // Global source (same source) placed top-center
    const globalSource = matchupData.source || matchupData.lineupSource || null;
    const globalTime = matchupData.announceTime || matchupData.publishedAt || null;
    if (globalSource) {
        svg += renderSourceBadge(globalSource, globalTime, 50, 1.5);
    }

    if (!hasData) {
        // Empty pitch fallback
        svg += `<text x="50" y="75" text-anchor="middle" font-size="3" fill="rgba(255,255,255,0.25)">${esc(tx('暂无首发数据', 'No lineup data'))}</text>`;
        svg += `<text x="50" y="85" text-anchor="middle" font-size="2.5" fill="rgba(255,255,255,0.15)">${esc(tx('等待官方公布', 'Awaiting official announcement'))}</text>`;
        svg += `</svg>`;
        return svg;
    }

    const home = matchupData.home;
    const away = matchupData.away;
    // Flatten gk/def/mid/fwd into players if players array is empty
    const flattenPlayers = (side) => {
        if (!side) return;
        if (!side.players || !side.players.length) {
            side.players = [
                ...(side.gk || []),
                ...(side.def || []),
                ...(side.mid || []),
                ...(side.fwd || []),
            ];
        }
    };
    flattenPlayers(home);
    flattenPlayers(away);
    const matchups = matchupData.matchups || [];
    const substitutions = matchupData.substitutions || [];

    // ── Helper: find player by name (strips diacritics) ──
    const normalizeName = (s) => String(s || '').toLowerCase().replace(/['\u0301\u0300\u0308]/g, '').trim();
    const findPlayer = (players, name) => {
        if (!players || !name) return null;
        const n = normalizeName(name);
        return players.find(p => {
            const pn = normalizeName(p.name);
            return pn === n || pn.includes(n) || n.includes(pn);
        });
    };

    // ── 换人索引：off 球员 → {minute, on}；on 球员 → {minute, off} ──
    // 兼容字段：off||playerOut, on||playerIn, minute
    const subOffMap = new Map(); // side -> Map(nameKey/idKey -> sub)
    const subOnMap = new Map();
    const ensureSideMap = (m, side) => { if (!m.has(side)) m.set(side, new Map()); return m.get(side); };
    for (const s of substitutions) {
        if (!s) continue;
        const side = s.side || 'home';
        const offName = s.offName || s.playerOut;
        const offId = s.off;
        const onName = s.onName || s.playerIn;
        const onId = s.on;
        const minute = s.minute ?? s.minutePlayed ?? '?';
        
        const subData = {
            minute,
            onId,
            onName,
            onNameZh: s.onNameZh || null,
            onRating: s.onRating || 70,
            onJersey: s.onJersey || '?',
            offId,
            offName,
            offNameZh: s.offNameZh || null,
            offRating: s.offRating || 70,
            raw: s
        };

        const offMap = ensureSideMap(subOffMap, side);
        if (offId) offMap.set(String(offId).toLowerCase(), subData);
        if (offName) offMap.set(normalizeName(offName), subData);

        const onMap = ensureSideMap(subOnMap, side);
        if (onId) onMap.set(String(onId).toLowerCase(), subData);
        if (onName) onMap.set(normalizeName(onName), subData);
    }

    // ── 统一坐标帧：cy = y*1.6 不翻转，cx = x 不镜像 ──
    // T1 拥有几何：前端用 formationTemplate 按 formation 字符串算坐标，
    // 覆盖后端传来的 x/y（后端 player 顺序已是 GK→DEF→MID→FWD，按 index 映射）。
    // 后端 y 已是交错序，两队都直接用，从上到下自然呈现
    //   蓝GK→蓝后卫→红前锋→蓝中场→红中场→蓝前锋→红后卫→红GK
    const homeTemplate = MR.formationTemplate(home.formation || '4-3-3', 'home', away.formation || '4-3-3');
    const awayTemplate = MR.formationTemplate(away.formation || '4-3-3', 'away', home.formation || '4-3-3');

    // Resolve overlaps between home and away players
    const MIN_DIST = 9.0;
    for (let iter = 0; iter < 10; iter++) {
        let adjusted = false;
        for (let i = 0; i < homeTemplate.length; i++) {
            const h = homeTemplate[i];
            for (let j = 0; j < awayTemplate.length; j++) {
                const a = awayTemplate[j];
                const dx = h.x - a.x;
                const dy = (h.y * 1.6) - (a.y * 1.6);
                const dist = Math.hypot(dx, dy);
                if (dist < MIN_DIST) {
                    adjusted = true;
                    const overlap = MIN_DIST - dist;
                    const angle = dist > 0.1 ? Math.atan2(dy, dx) : (Math.random() * 2 * Math.PI);
                    const pushAmount = overlap / 2;
                    
                    const hPushX = Math.cos(angle) * pushAmount;
                    const hPushY = (Math.sin(angle) * pushAmount) / 1.6;
                    
                    h.x += hPushX;
                    h.y += hPushY;
                    a.x -= hPushX;
                    a.y -= hPushY;
                    
                    // Clamp coordinates to stay within pitch boundaries [10, 90]
                    h.x = Math.max(10, Math.min(90, h.x));
                    a.x = Math.max(10, Math.min(90, a.x));
                }
            }
        }
        if (!adjusted) break;
    }

    const coord = (p, idx, side) => {
        const tmpl = side === 'home' ? homeTemplate : awayTemplate;
        const t = tmpl[idx] || tmpl[tmpl.length - 1] || { x: 50, y: 50 };
        return { cx: t.x, cy: t.y * 1.6 };
    };

    // ── Ability halo + identifiable player marker; matchup lines stay removed ──
    const TEAM_STYLE = {
        home: { halo: 'rgba(59,130,246,0.6)', solid: '#2563eb', stroke: '#93c5fd', text: 'white' },
        away: { halo: 'rgba(239,68,68,0.6)', solid: '#dc2626', stroke: '#fca5a5', text: 'white' },
    };
    const R = 2.6; // 2.6 * 5.4px = 14.04px radius -> 28px diameter
    const goals = matchData?.goals || [];

    const translatePlayerName = (name, nameZh) => Utils.translatePlayerName ? Utils.translatePlayerName(name, nameZh) : (nameZh || name);

    const playerMatchesName = (pName, eventName) => {
        if (!pName || !eventName) return false;
        const pn = normalizeName(pName);
        const en = normalizeName(eventName);
        return pn === en || pn.includes(en) || en.includes(pn);
    };

    const getPlayerGoals = (pName, side) => {
        const teamName = side === 'home' ? (home?.team || '') : (away?.team || '');
        return goals.filter(g => {
            const teamMatches = String(g.team || '').toLowerCase().includes(String(teamName).toLowerCase()) || 
                                String(teamName).toLowerCase().includes(String(g.team || '').toLowerCase());
            return teamMatches && playerMatchesName(pName, g.player);
        });
    };

    const renderEventBadge = (x, y, icon, text, isSubOn) => {
        const displayStr = `${icon}${text}`;
        const w = displayStr.length * 1.3 + 1.8;
        const bg = isSubOn ? 'rgba(16,185,129,0.85)' : 'rgba(0,0,0,0.65)';
        return `<g transform="translate(${x},${y})">
            <rect x="-${w/2}" y="-2.3" width="${w}" height="3.2" rx="0.8" fill="${bg}" stroke="rgba(255,255,255,0.15)" stroke-width="0.2"/>
            <text x="0" y="-0.7" text-anchor="middle" dominant-baseline="middle" font-size="1.8" fill="white" font-weight="800">${esc(displayStr)}</text>
        </g>`;
    };

    const renderPlayerNode = (p, side, idx) => {
        if (!p) return '';
        const { cx, cy } = coord(p, idx, side);
        const st = TEAM_STYLE[side] || TEAM_STYLE.home;
        const playerId = p.playerId || p.id || p.espnId || '';
        const rawName = p.name || '';
        const pIdLower = String(playerId).toLowerCase();
        const pNameNorm = normalizeName(rawName);
        
        const sideSubOff = subOffMap.get(side);
        const subOff = sideSubOff ? (sideSubOff.get(pIdLower) || sideSubOff.get(pNameNorm)) : null;

        // Determine active player parameters
        let activePlayerId = playerId;
        let activeName = rawName;
        let activeJersey = p.jersey || p.number || '?';
        let activeRating = Number(p.rating) || 65;
        let activeNameZh = p.nameZh || null;
        let isSubOn = false;
        let subOffDetails = null;

        if (subOff) {
            activePlayerId = subOff.onId || '';
            activeName = subOff.onName;
            activeJersey = subOff.onJersey || '?';
            activeRating = Number(subOff.onRating) || 65;
            activeNameZh = subOff.onNameZh || null;
            isSubOn = true;
            subOffDetails = {
                minute: subOff.minute,
                starterName: translatePlayerName(rawName, p.nameZh)
            };
        }

        const pGoals = getPlayerGoals(activeName, side);
        const hasGoals = pGoals.length > 0;
        const goalMinutesJoin = pGoals.map(g => String(g.minute).replace(/'/g, '') + "'").join(',');

        const rating = Math.max(50, Math.min(100, activeRating));
        const ratingDiff = Math.max(0, rating - 50);
        const radius = 2.8 + Math.pow(ratingDiff, 1.25) * 0.10;
        const pNameZh = translatePlayerName(activeName, activeNameZh);
        const pTeamName = side === 'home' ? (home?.team || '') : (away?.team || '');

        let statusText = '';
        if (isSubOn) {
            statusText = esc(tx(`替补上场 ${subOffDetails.minute} ← ${subOffDetails.starterName}`, `Sub On ${subOffDetails.minute} ← ${subOffDetails.starterName}`));
        } else {
            statusText = esc(tx('首发', 'Starting'));
        }

        let htmlNode = '';

        // Draw Active Player Group
        const goalsText = hasGoals ? goalMinutesJoin : '';
        htmlNode += `<g class="pitch-player-group pitch-${side}-player" data-action="open-player-detail" data-player-id="${attr(String(activePlayerId))}" data-player-name="${attr(activeName)}" style="cursor:pointer" data-player-tip="true" data-name="${attr(pNameZh)}" data-pos="${attr(p.pos || '')}" data-rating="${(rating/10).toFixed(1)}" data-team="${attr(pTeamName)}" data-status="${statusText}" data-goals="${attr(goalsText)}">`;
        
        // Radial Gradient Glow Halo
        htmlNode += `<circle class="ability-halo" cx="${cx}" cy="${cy}" r="${radius}" fill="url(#halo-glow-${side})" opacity="0.8" filter="url(#tb-ability-blur)"/>`;
        
        // Core player circle
        const strokeDash = isSubOn ? 'stroke-dasharray="0.8 0.4"' : '';
        htmlNode += `<circle class="player-core" cx="${cx}" cy="${cy}" r="${R}" fill="${st.solid}" stroke="${st.stroke}" stroke-width="0.45" ${strokeDash}/>`;
        htmlNode += `<text x="${cx}" y="${cy + 0.15}" text-anchor="middle" dominant-baseline="middle" fill="${st.text}" font-size="2.45" font-weight="800">${esc(String(activeJersey))}</text>`;
        htmlNode += `</g>`;

        // Draw Badges
        if (isSubOn) {
            htmlNode += renderEventBadge(cx - 3.8, cy - 2.8, '↑', subOffDetails.minute, true);
        }
        if (hasGoals) {
            htmlNode += renderEventBadge(cx + 3.8, cy - 2.8, '⚽', goalMinutesJoin, false);
        }

        return htmlNode;
    };

    // ── Home XI ──
    svg += `<g class="pitch-home">`;
    home.players.forEach((p, i) => {
        svg += renderPlayerNode(p, 'home', i);
    });
    svg += `</g>`;

    // ── Away XI ──
    svg += `<g class="pitch-away">`;
    away.players.forEach((p, i) => {
        svg += renderPlayerNode(p, 'away', i);
    });
    svg += `</g>`;

    // ── Per-team independent source badges (when home/away sources differ) ──
    // Skip if global source already shown; otherwise show each team's source in its own half
    if (!globalSource) {
        const homeSrc = home.source || home.lineupSource || null;
        const awaySrc = away.source || away.lineupSource || null;
        if (homeSrc) svg += renderSourceBadge(homeSrc, home.announceTime || home.publishedAt, 28, 1.5);
        if (awaySrc) svg += renderSourceBadge(awaySrc, away.announceTime || away.publishedAt, 72, 1.5);
    }

    svg += `</svg>`;
    return svg;
}

// ─── Task 3: Prediction Three-Layer Display ───
    // Export to namespace
    MR.renderTacticalBoard = renderTacticalBoard;
})();
