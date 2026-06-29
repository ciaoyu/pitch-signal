/**
 * Match Detail Renderers for PitchSignal
 * 
 * Contains rendering functions for match details, formation, bench, H2H, etc.
 * 
 * Usage:
 *   <script src="/static/js/formatters.js"></script>
 *   <script src="/static/js/api-client.js"></script>
 *   <script src="/static/js/app.js"></script>
 *   <script src="/static/js/match-renderers.js"></script>
 */

window.WorldCup = window.WorldCup || {};
window.WorldCup.MatchRenderers = (() => {
    // Access shared dependencies
    const { Formatters, ApiClient, State, Utils } = window.WorldCup;
    
    // Helper to get current language
    const getLang = () => State.uiLang || 'zh';
    
    // Translation helper
    const tx = (zh, en) => Utils.tx(zh, en);
    
    // Escape HTML
    const esc = (value) => Utils.esc(value);
    
    // Attribute escape (same as esc)
    const attr = (value) => esc(value);
    
    // i18nText helper (simplified)
    const i18nText = (value, fallback = '') => {
        if (value && typeof value === 'object' && (value.zh || value.en)) {
            return getLang() === 'en' ? (value.en || value.zh || fallback) : (value.zh || value.en || fallback);
        }
        return value || fallback;
    };
    
    // Formation positions mapping (will be populated later)
    const FORMATION_POSITIONS = {};

    /**
     * 通用阵型坐标模板（复刻后端 calcFormationCoords，保证"后端 y 已是此序"成立）
     * 交错序：home GK(y6)→DEF(y22)→MID(y45)→FWD(y74)；
     *         away 镜像 GK(y94)→DEF(y78)→MID(y55)→FWD(y26)
     * 渲染时 cy = y * 1.6 不翻转，从上到下自然呈现：
     *   蓝GK → 蓝后卫 → 红前锋 → 蓝中场 → 红中场 → 蓝前锋 → 红后卫 → 红GK
     *
     * @param {string} formation 如 '4-3-3' / '4-2-3-1' / '3-5-2'
     * @param {'home'|'away'} side
     * @returns {Array<{x,y,pos,line}>} 11 人坐标（GK→DEF→MID→FWD 序）
     */
    function formationTemplate(formation, side, opponentFormation = '') {
        const f = parseFormationStr(formation);
        const isHome = side === 'home';
        const normalizedFormation = String(formation || '').trim();
        const normalizedOpponent = String(opponentFormation || '').trim();
        // yBase 与后端 calcFormationCoords 一致，仅 fwd 按用户要求调到相邻两层中点：
        //   红前锋(away fwd) 在 蓝后卫(35.2) 与 蓝中场(72.0) 中点 → cy=53.6 → y=33.5
        //   蓝前锋(home fwd) 在 红中场(88.0) 与 红后卫(124.8) 中点 → cy=106.4 → y=66.5
        const yBase = isHome
            ? { gk: 6, def: 22, mid: 45, fwd: 66.5 }
            : { gk: 94, def: 78, mid: 55, fwd: 33.5 };
        // 4 段阵型（如 4-2-3-1）的双层中场 y
        // AM 层从 66/34 撤到 60/40，避免与前锋层(66.5/33.5)重叠（间距 10.4 > 6.4 直径）
        let yDm = isHome ? 44 : 56;
        let yAm = isHome ? 60 : 40;

        // 当前全场交错视图的两个常见四段阵型需要独立层距：
        // 4-2-3-1：单前锋必须清楚地位于三名攻击中场下方。
        if (isHome && normalizedFormation === '4-2-3-1' && normalizedOpponent === '4-1-2-3') {
            yBase.fwd = 71;
        }
        // 客队 4-1-2-3 从上向下应为 3前锋→2中场→1后腰→4后卫。
        // 在交错视图中，2 位于蓝方“双后腰/三前腰”之间，1 位于蓝方三前腰下方。
        if (!isHome && normalizedFormation === '4-1-2-3' && normalizedOpponent === '4-2-3-1') {
            yAm = 52;
            yDm = 66;
        }

        const out = [];
        // GK
        out.push({ x: 50, y: yBase.gk, pos: 'GK', line: 'gk' });
        // DEF
        for (let i = 0; i < f.def; i++) {
            const x = f.def === 1 ? 50 : Math.round(20 + (60 / (f.def - 1)) * i);
            out.push({ x, y: yBase.def, pos: 'D', line: 'def' });
        }
        // MID（4 段走 DM+AM 双层，3 段走单层）
        if (f.midDM && f.midAM) {
            for (let i = 0; i < f.midDM; i++) {
                const x = f.midDM === 1 ? 50 : Math.round(20 + (60 / (f.midDM - 1)) * i);
                out.push({ x, y: yDm, pos: 'DM', line: 'mid' });
            }
            for (let i = 0; i < f.midAM; i++) {
                const x = f.midAM === 1 ? 50 : Math.round(20 + (60 / (f.midAM - 1)) * i);
                out.push({ x, y: yAm, pos: 'AM', line: 'mid' });
            }
        } else {
            for (let i = 0; i < f.mid; i++) {
                const x = f.mid === 1 ? 50 : Math.round(20 + (60 / (f.mid - 1)) * i);
                out.push({ x, y: yBase.mid, pos: 'M', line: 'mid' });
            }
        }
        // FWD
        for (let i = 0; i < f.fwd; i++) {
            const x = f.fwd === 1 ? 50 : Math.round(20 + (60 / (f.fwd - 1)) * i);
            out.push({ x, y: yBase.fwd, pos: 'F', line: 'fwd' });
        }
        return out;
    }

    /** 阵型字符串解析（与后端 parseFormation 一致） */
    function parseFormationStr(f) {
        const parts = String(f || '4-3-3').split('-').map(Number);
        if (parts.length === 3) return { def: parts[0], mid: parts[1], fwd: parts[2] };
        if (parts.length === 4) return { def: parts[0], midDM: parts[1], midAM: parts[2], fwd: parts[3], mid: parts[1] + parts[2] };
        return { def: 4, mid: 3, fwd: 3 };
    }
    
    // Safe helper: get team label with i18n + fallback chain
    const teamLabel = (teamObj) => {
        if (!teamObj) return tx('未知球队', 'Unknown Team');
        // Try i18n name first
        const i18n = teamObj.nameI18n;
        if (i18n && (i18n.zh || i18n.en)) {
            return getLang() === 'en' ? (i18n.en || i18n.zh || '') : (i18n.zh || i18n.en || '');
        }
        // Bilingual string: split and pick correct language
        const raw = teamObj.team || teamObj.name || teamObj.shortName || teamObj.teamName || '';
        if (raw) {
            const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
            if (bilingual) return getLang() === 'en' ? bilingual[2].trim() : bilingual[1].trim();
            return raw;
        }
        // Extended fallback: fullName, displayName, label, or id
        const alt = teamObj.fullName || teamObj.displayName || teamObj.label || teamObj.id || '';
        if (alt) return alt;
        return tx('未知球队', 'Unknown Team');
    };
    
    // Flag helper: show flag emoji, or fallback to team initial avatar
    const teamFlagHtml = (teamObj, bgClass) => {
        const flag = teamObj && teamObj.flag;
        if (flag && flag !== '🏳️' && flag !== '') {
            return `<span class="text-lg shrink-0">${esc(flag)}</span>`;
        }
        // Fallback: circular avatar with first letter of team name
        const name = teamLabel(teamObj);
        const initial = name ? name.charAt(0).toUpperCase() : '?';
        return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${bgClass} text-white text-xs font-bold shrink-0">${esc(initial)}</span>`;
    };
    
    // Safe helper: get player coordinates with fallback chain
    const playerCoords = (p) => ({
        x: p.x ?? p.coords?.x ?? 50,
        y: p.y ?? p.coords?.y ?? 50,
    });
    
    // ─── Mock data for testing (Task 4) ───
    function getMockMatchupData() {
        return {
            home: {
                formation: '4-3-3',
                players: [
                    { name: 'Emiliano Martínez', number: 23, pos: 'GK', x: 50, y: 8, isKey: false },
                    { name: 'Nahuel Molina', number: 26, pos: 'RB', x: 82, y: 22, isKey: false },
                    { name: 'Cristian Romero', number: 13, pos: 'CB', x: 62, y: 20, isKey: true },
                    { name: 'Nicolás Otamendi', number: 19, pos: 'CB', x: 38, y: 20, isKey: false },
                    { name: 'Nicolás Tagliafico', number: 3, pos: 'LB', x: 18, y: 22, isKey: false },
                    { name: 'Rodrigo De Paul', number: 7, pos: 'CM', x: 75, y: 38, isKey: true },
                    { name: 'Enzo Fernández', number: 24, pos: 'CM', x: 50, y: 35, isKey: false },
                    { name: 'Alexis Mac Allister', number: 20, pos: 'CM', x: 25, y: 38, isKey: false },
                    { name: 'Lionel Messi', number: 10, pos: 'RW', x: 80, y: 48, isKey: true },
                    { name: 'Julián Álvarez', number: 9, pos: 'ST', x: 50, y: 46, isKey: false },
                    { name: 'Ángel Di María', number: 11, pos: 'LW', x: 20, y: 48, isKey: true },
                ]
            },
            away: {
                formation: '4-2-3-1',
                players: [
                    { name: 'Hugo Lloris', number: 1, pos: 'GK', x: 50, y: 8, isKey: false },
                    { name: 'Jules Koundé', number: 5, pos: 'RB', x: 82, y: 22, isKey: false },
                    { name: 'Raphaël Varane', number: 4, pos: 'CB', x: 62, y: 20, isKey: true },
                    { name: 'William Saliba', number: 17, pos: 'CB', x: 38, y: 20, isKey: false },
                    { name: 'Theo Hernández', number: 22, pos: 'LB', x: 18, y: 22, isKey: false },
                    { name: 'Aurélien Tchouaméni', number: 8, pos: 'CDM', x: 62, y: 35, isKey: true },
                    { name: 'Adrien Rabiot', number: 14, pos: 'CDM', x: 38, y: 35, isKey: false },
                    { name: 'Ousmane Dembélé', number: 11, pos: 'RW', x: 80, y: 48, isKey: false },
                    { name: 'Antoine Griezmann', number: 7, pos: 'CAM', x: 50, y: 46, isKey: true },
                    { name: 'Kylian Mbappé', number: 10, pos: 'LW', x: 20, y: 48, isKey: true },
                    { name: 'Olivier Giroud', number: 9, pos: 'ST', x: 50, y: 55, isKey: false },
                ]
            },
            matchups: [
                { homePlayer: 'Lionel Messi', awayPlayer: 'Theo Hernández', type: 'critical' },
                { homePlayer: 'Ángel Di María', awayPlayer: 'Jules Koundé', type: 'key' },
                { homePlayer: 'Rodrigo De Paul', awayPlayer: 'Aurélien Tchouaméni', type: 'key' },
            ]
        };
    }

    function getMockPrediction() {
        return {
            homeWin: 0.452,
            draw: 0.268,
            awayWin: 0.280,
            expectedScore: { home: 1.8, away: 1.1 },
            poissonModeScore: { home: 2, away: 1 },
            components: { elo: { home: 1850, away: 1720 } }
        };
    }

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
        </defs>`;

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

        // ── Source 徽标（official / projected）──
        // 优先级：matchupData.source > matchupData.lineupSource；其次各队 source
        // official → 绿底白字「FIFA 官方首发 · HH:MM 公布」
        // projected → 琥珀底「预测阵容（本届众数/最近一场）」
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
        // 全局 source（同源）置于顶部居中
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

        // ── Helper: find player by name (含去重音符) ──
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
        const subOffMap = new Map(); // side -> Map(nameKey -> sub)
        const subOnMap = new Map();
        const ensureSideMap = (m, side) => { if (!m.has(side)) m.set(side, new Map()); return m.get(side); };
        for (const s of substitutions) {
            if (!s) continue;
            const side = s.side || 'home';
            const offName = s.off || s.playerOut;
            const onName = s.on || s.playerIn;
            const minute = s.minute ?? s.minutePlayed ?? '?';
            if (offName) ensureSideMap(subOffMap, side).set(normalizeName(offName), { minute, on: onName, raw: s });
            if (onName) ensureSideMap(subOnMap, side).set(normalizeName(onName), { minute, off: offName, raw: s });
        }

        // ── 统一坐标帧：cy = y*1.6 不翻转，cx = x 不镜像 ──
        // T1 拥有几何：前端用 formationTemplate 按 formation 字符串算坐标，
        // 覆盖后端传来的 x/y（后端 player 顺序已是 GK→DEF→MID→FWD，按 index 映射）。
        // 后端 y 已是交错序，两队都直接用，从上到下自然呈现
        //   蓝GK→蓝后卫→红前锋→蓝中场→红中场→蓝前锋→红后卫→红GK
        const homeTemplate = formationTemplate(home.formation || '4-3-3', 'home', away.formation || '4-3-3');
        const awayTemplate = formationTemplate(away.formation || '4-3-3', 'away', home.formation || '4-3-3');
        const coord = (p, idx, side) => {
            const tmpl = side === 'home' ? homeTemplate : awayTemplate;
            const t = tmpl[idx] || tmpl[tmpl.length - 1] || { x: 50, y: 50 };
            return { cx: t.x, cy: t.y * 1.6 };
        };

        // ── Key matchup lines（坐标与球员点统一） ──
        svg += `<g class="pitch-pair">`;
        const pairsToRender = (matchupData.pairs && matchupData.pairs.length > 0)
            ? matchupData.pairs
            : matchups;

        for (const m of pairsToRender) {
            // Goalkeeper ratings remain part of the aggregate comparison, but
            // a full-pitch GK-to-GK line is not a real spatial matchup and puts
            // a misleading advantage dot on the center spot.
            if (m.zone === '门将' || m.zone === 'Goalkeeper') continue;
            const hName = m.home?.name || m.homePlayer;
            const aName = m.away?.name || m.awayPlayer;
            const hp = findPlayer(home.players, hName);
            const ap = findPlayer(away.players, aName);
            if (!hp || !ap) continue;

            const hIdx = home.players.indexOf(hp);
            const aIdx = away.players.indexOf(ap);
            const hC = coord(hp, hIdx, 'home');
            const aC = coord(ap, aIdx, 'away');

            const isKey = m.key || m.type === 'critical';
            let gradId = 'tb-m-key';
            let strokeW = isKey ? 1.2 : 0.5;
            let opacity = isKey ? 0.75 : 0.22;

            if (isKey) {
                if (m.advantage === 'home') gradId = 'tb-m-critical-home';
                else if (m.advantage === 'away') gradId = 'tb-m-critical-away';
                else gradId = 'tb-m-even';
            }

            // Key lines: solid; non-key: subtle dash
            const dashArray = isKey ? 'none' : '2,3';
            svg += `<line x1="${hC.cx}" y1="${hC.cy}" x2="${aC.cx}" y2="${aC.cy}" stroke="url(#${gradId})" stroke-width="${strokeW}" opacity="${opacity}" stroke-linecap="round"${dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : ''}/>`;

            if (isKey) {
                const mx = (hC.cx + aC.cx) / 2, my = (hC.cy + aC.cy) / 2;
                const dotColor = m.advantage === 'home' ? '#60a5fa' : (m.advantage === 'away' ? '#f87171' : '#fbbf24');
                svg += `<circle cx="${mx}" cy="${my}" r="1.2" fill="${dotColor}" opacity="1"/>`;
            }
        }
        svg += `</g>`;

        // ── Avatar rendering ──
        const TEAM_STYLE = {
            home: { fill: 'rgba(59,130,246,0.6)', text: 'white' },
            away: { fill: 'rgba(239,68,68,0.6)', text: 'white' },
        };
        const R = 2.6; // 2.6 * 5.4px = 14.04px radius -> 28px diameter
        const goals = matchData?.goals || [];

        const renderPlayerNode = (p, side, idx) => {
            if (!p) return '';
            const { cx, cy } = coord(p, idx, side);
            const st = TEAM_STYLE[side] || TEAM_STYLE.home;
            const jersey = p.number ?? p.jersey ?? '';
            const playerId = p.playerId || p.id || p.espnId || '';
            const rawName = p.name || '';
            const nameZh = window.WorldCup.I18n?.translatePlayerName(rawName) || rawName;
            const shortName = nameZh.includes('·') ? nameZh.split('·').pop() : nameZh.split(' ').pop();
            
            // Check if player scored
            const pNameNorm = normalizeName(rawName);
            const scoredGoals = goals.filter(g => {
                const gn = normalizeName(g.player);
                return gn === pNameNorm || pNameNorm.includes(gn) || gn.includes(pNameNorm);
            }).length;

            const sideMap = subOffMap.get(side);
            const subOff = sideMap ? sideMap.get(normalizeName(rawName)) : null;
            const opacityAttr = subOff ? '0.45' : '0.97';

            let node = `<g class="pitch-${side}-player" data-action="open-player-detail" data-player-id="${attr(String(playerId))}" data-player-name="${attr(rawName)}" style="cursor:pointer">`;
            node += `<g transform="translate(${cx},${cy})" opacity="${opacityAttr}">`;
            
            // Translucent circle with jersey number
            node += `<circle r="${R}" fill="${st.fill}" stroke="white" stroke-width="0.3"/>`;
            node += `<text x="0" y="0.8" text-anchor="middle" font-size="2.2" font-weight="bold" fill="${st.text}" dominant-baseline="middle" style="pointer-events:none">${esc(String(jersey))}</text>`;
            
            // Short name text below
            let nameText = esc(shortName);
            if (scoredGoals > 0) {
                nameText += ' ⚽'.repeat(scoredGoals);
            }
            const nameColor = scoredGoals > 0 ? '#FFD600' : 'white';
            const nameY = side === 'home' ? R + 2.5 : -R - 1.5;
            node += `<text x="0" y="${nameY}" text-anchor="middle" font-size="2" font-weight="bold" fill="${nameColor}" style="pointer-events:none">${nameText}</text>`;
            
            node += `</g>`;

            // Sub-off indicator
            if (subOff) {
                node += `<g transform="translate(${cx},${cy + R + 2.5})">`;
                node += `<circle r="1.5" fill="#ef4444" stroke="white" stroke-width="0.2"/>`;
                node += `<text x="0" y="0.5" text-anchor="middle" font-size="1.8" font-weight="bold" fill="white" dominant-baseline="middle">↓</text>`;
                node += `</g>`;
                node += `<text x="${cx}" y="${cy + R + 5.5}" text-anchor="middle" font-size="1.5" font-weight="bold" fill="#ef4444">${esc(String(subOff.minute))}'</text>`;
            }
            node += `</g>`;
            return node;
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

        // ── 各队独立 source 徽标（当主客 source 不同时）──
        // 全局 source 已显示则跳过；否则按各队 source 在各自半场显示
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
    function renderPredictionLayers(pred) {
        if (!pred || (pred.homeWin === undefined && pred.draw === undefined && pred.awayWin === undefined)) {
            return `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction data unavailable')}</div>`;
        }

        const hw = ((pred.homeWin ?? 0) * 100).toFixed(1);
        const dw = ((pred.draw ?? 0) * 100).toFixed(1);
        const aw = ((pred.awayWin ?? 0) * 100).toFixed(1);
        const hwNum = parseFloat(hw);
        const dwNum = parseFloat(dw);
        const awNum = parseFloat(aw);

        // Score fields may arrive as an object {home,away} (mock) or a "h-a" string ("2-1") from /api/predict.
        const parseScore = (v) => {
            if (v && typeof v === 'object') return { home: v.home, away: v.away };
            if (typeof v === 'string') { const m = v.split('-'); if (m.length === 2) return { home: m[0].trim(), away: m[1].trim() }; }
            return { home: null, away: null };
        };
        // Layer 2 is λ-based: prefer the raw expected goals, fall back to the rounded expectedScore.
        const expStr = parseScore(pred.expectedScore);
        const lamHome = pred.goals?.homeExpected ?? expStr.home;
        const lamAway = pred.goals?.awayExpected ?? expStr.away;
        const escHome = (lamHome != null && lamHome !== '') ? Number(lamHome).toFixed(1) : '-';
        const escAway = (lamAway != null && lamAway !== '') ? Number(lamAway).toFixed(1) : '-';
        const pm = parseScore(pred.poissonModeScore);
        const pmHome = pm.home ?? '-';
        const pmAway = pm.away ?? '-';

        return `
        <div class="glass rounded-xl p-4 space-y-3">
            <!-- Layer 1: Win/Draw/Loss Probability Bar -->
            <div>
                <div class="text-xs font-bold text-gray-400 mb-2">
                    <span class="inline-flex items-center gap-1">
                        <span class="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center text-[10px]">🎯</span>
                        ${tx('胜平负概率', 'Win/Draw/Loss')}
                    </span>
                </div>
                <div class="prob-bar mb-2">
                    <div class="prob-bar-home" style="width:${hw}%">${hwNum > 12 ? hw + '%' : ''}</div>
                    <div class="prob-bar-draw" style="width:${dw}%">${dwNum > 10 ? dw + '%' : ''}</div>
                    <div class="prob-bar-away" style="width:${aw}%">${awNum > 12 ? aw + '%' : ''}</div>
                </div>
                <div class="flex justify-between text-[11px]">
                    <span class="text-green-400 font-bold">${tx('主胜', 'Home')} ${hw}%</span>
                    <span class="text-yellow-400 font-bold">${tx('平局', 'Draw')} ${dw}%</span>
                    <span class="text-red-400 font-bold">${tx('客胜', 'Away')} ${aw}%</span>
                </div>
            </div>

            <div class="border-t border-white/5"></div>

            <!-- Layer 2: Expected Score (λ-based) -->
            <div class="text-center">
                <div class="text-xs font-bold text-emerald-400 mb-1">
                    <span class="inline-flex items-center gap-1">
                        <span class="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-[10px]">📊</span>
                        ${tx('期望比分', 'Expected Score')}
                    </span>
                </div>
                <div class="text-xl font-black font-mono tracking-tight">
                    <span class="text-blue-400">${esc(escHome)}</span>
                    <span class="text-gray-500 mx-1.5">—</span>
                    <span class="text-red-400">${esc(escAway)}</span>
                </div>
                <div class="text-[10px] text-gray-500 mt-1">
                    ${getLang() === 'en' ? 'Based on expected goals λ' : '基于进球期望值 λ'}
                </div>
            </div>

            <div class="border-t border-white/5"></div>

            <!-- Layer 3: Poisson Mode Score -->
            <div class="text-center">
                <div class="text-xs font-bold text-amber-400 mb-1">
                    <span class="inline-flex items-center gap-1">
                        <span class="w-5 h-5 rounded-md bg-amber-400/10 flex items-center justify-center text-[10px]">🔮</span>
                        ${tx('最可能比分', 'Most Likely Score')}
                    </span>
                </div>
                <div class="text-xl font-black font-mono tracking-tight">
                    <span class="text-blue-400">${esc(String(pmHome))}</span>
                    <span class="text-gray-500 mx-1.5">—</span>
                    <span class="text-red-400">${esc(String(pmAway))}</span>
                </div>
                <div class="text-[10px] text-gray-500 mt-1">
                    ${getLang() === 'en'
                        ? 'Poisson mode: the single most probable exact scoreline'
                        : '泊松众数：所有可能比分中概率最高的一组'}
                </div>
            </div>
            ${(() => {
                const vf = pred.venueFactor;
                if (!vf || !vf.applied) return '';
                const fmtBeta = (b) => (b != null ? Number(b).toFixed(2) : '-');
                const row = (side, label) => {
                    const f = vf[side] || {};
                    const dh = f.deltaH != null ? Math.round(f.deltaH) : null;
                    const t = f.tempC != null ? Math.round(f.tempC) : null;
                    const bits = [];
                    if (dh != null && dh > 0) bits.push(tx('海拔差', 'Alt Δ') + ' ' + dh + 'm');
                    if (t != null) bits.push(tx('气温', 'Temp') + ' ' + t + '°C');
                    return `<div class="flex items-center justify-between text-[11px]">
                        <span class="text-gray-400">${label}</span>
                        <span class="font-mono font-bold ${side === 'home' ? 'text-blue-400' : 'text-red-400'}">β ${fmtBeta(f.beta)}</span>
                        <span class="text-gray-500 text-[10px]">${bits.join(' · ') || tx('无修正', 'no effect')}</span>
                    </div>`;
                };
                return `
                <div class="border-t border-white/5"></div>
                <div>
                    <div class="text-xs font-bold text-cyan-400 mb-1.5">
                        <span class="inline-flex items-center gap-1">
                            <span class="w-5 h-5 rounded-md bg-cyan-500/15 flex items-center justify-center text-[10px]">🏔️</span>
                            ${tx('环境修正', 'Venue Adjustment')}
                        </span>
                    </div>
                    <div class="space-y-1">
                        ${row('home', tx('主队', 'Home'))}
                        ${row('away', tx('客队', 'Away'))}
                    </div>
                    <div class="text-[10px] text-gray-500 mt-1.5">
                        ${getLang() === 'en'
                            ? 'High altitude / heat scale down expected goals λ (β<1)'
                            : '高海拔 / 高温会按 β 系数下调进球期望 λ（β<1）'}
                    </div>
                </div>`;
            })()}
        </div>`;
    }

    // renderFormation function — uses SVG tactical board
    function renderFormation(matchupData, isFinishedMatch = false) {
        // Fallback to mock data silently when real data is missing
        if ((!matchupData || !matchupData.home || !matchupData.away) && !isFinishedMatch) {
            matchupData = getMockMatchupData();
        }

        if (!matchupData || !matchupData.home || !matchupData.away) {
            return `<div class="text-gray-500 text-xs text-center py-8">${isFinishedMatch
                ? tx('官方历史首发尚未同步；不以推测阵容替代实际首发。', 'Official historical lineups are not synced; estimates are not shown as actual starters.')
                : tx('暂无官方首发，以下为根据历史首发生成的推测阵容', 'No official lineups; showing projected lineups based on history')}</div>`;
        }

        const home = matchupData.home;
        const away = matchupData.away;
        const pairs = matchupData.pairs || [];
        const matchups = matchupData.matchups || [];
        const summary = matchupData.summary || {};

        // Calculate composite score for display
        const homeAdv = summary.homeAdvantages ?? summary.homeAdvantagePairs ?? 0;
        const awayAdv = summary.awayAdvantages ?? summary.awayAdvantagePairs ?? 0;
        const totalPairs = homeAdv + (summary.evenPairs || 0) + awayAdv;
        const homePct = totalPairs ? (homeAdv / totalPairs * 100) : 0;
        const evenPct = totalPairs ? ((summary.evenPairs || 0) / totalPairs * 100) : (totalPairs === 0 ? 100 : 0);
        const awayPct = totalPairs ? (awayAdv / totalPairs * 100) : 0;

        let html = `
        <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-bold text-blue-300 flex items-center gap-1.5">🔵 ${teamFlagHtml(home, 'bg-blue-600')} ${teamLabel(home)} (${home.formation || '4-3-3'})</div>
            <div class="flex gap-1">
                <button data-action="set-pitch-view" data-view="both" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">${tx('全部', 'All')}</button>
                <button data-action="set-pitch-view" data-view="home" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('主队', 'Home')}</button>
                <button data-action="set-pitch-view" data-view="away" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('客队', 'Away')}</button>
            </div>
            <div class="text-xs font-bold text-red-300 flex items-center gap-1.5 justify-end">${teamLabel(away)} (${away.formation || '4-3-3'}) ${teamFlagHtml(away, 'bg-red-600')} 🔴</div>
        </div>
        
        <!-- Segmented Score Bar -->
        <div class="glass-light rounded-lg p-3 mb-2">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-blue-400">${teamLabel(home)}</span>
                <span class="text-xs text-gray-500">${tx('对位优势分布', 'Matchup Edge')}</span>
                <span class="text-xs font-bold text-red-400">${teamLabel(away)}</span>
            </div>
            <div class="flex h-4 rounded-full overflow-hidden mb-2 shadow-inner bg-white/5">
                <div class="flex items-center justify-center bg-blue-500/80 transition-all duration-700" style="width:${homePct}%">
                    ${homeAdv ? `<span class="text-[10px] font-bold text-white">${homeAdv}</span>` : ''}
                </div>
                <div class="flex items-center justify-center bg-gray-500/50 transition-all duration-700" style="width:${evenPct}%">
                    ${summary.evenPairs ? `<span class="text-[10px] font-bold text-gray-300">${summary.evenPairs}</span>` : ''}
                </div>
                <div class="flex items-center justify-center bg-red-500/80 transition-all duration-700" style="width:${awayPct}%">
                    ${awayAdv ? `<span class="text-[10px] font-bold text-white">${awayAdv}</span>` : ''}
                </div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-gray-400 px-1">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500/80"></span>${tx('主队占优', 'Home Edge')}</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-gray-500/50"></span>${tx('均势', 'Even')}</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500/80"></span>${tx('客队占优', 'Away Edge')}</span>
            </div>
        </div>
        
        <!-- SVG Tactical Board -->
        <div class="w-full" id="pitch-canvas">
            ${renderTacticalBoard(matchupData, matchData)}
        </div>`;

        // Key matchups list (from pairs if available, or from matchups)
        // Short name helper: prefer Chinese, then last name
        const shortName = (name, nameZh) => {
            const d = Utils.translatePlayerName ? Utils.translatePlayerName(name, nameZh) : (nameZh || name);
            return d.includes('·') ? d.split('·').pop() : d.split(' ').pop();
        };

        if (matchups.length > 0) {
            html += '<div class="mt-2 space-y-0.5">';
            html += `<div class="text-[10px] text-gray-500 mb-1">⚔️ ${tx('关键对位', 'Key Matchups')}</div>`;
            for (const m of matchups.slice(0, 4)) {
                const cls = m.type === 'critical' ? 'text-yellow-400' : 'text-gray-400';
                const hName = m.homeInfo?.nameZh || m.homePlayer;
                const aName = m.awayInfo?.nameZh || m.awayPlayer;
                html += `<div class="text-[11px] ${cls} flex items-center gap-1">
                    <span>${m.type === 'critical' ? '⭐' : '•'}</span>
                    ${esc(hName)} ↔ ${esc(aName)}
                    ${m.type === 'critical' ? `<span class="text-[10px] font-bold text-amber-400">${tx('关键', 'Critical')}</span>` : ''}
                </div>`;
            }
            html += '</div>';
        } else if (pairs.length > 0) {
            // Legacy pairs format
            const _pDiff = p => p.diff ?? p.gap ?? 0;
            const keyPairs = pairs.filter(p => Math.abs(_pDiff(p)) >= 8).slice(0, 4);
            if (keyPairs.length) {
                html += '<div class="mt-2 space-y-0.5">';
                for (const p of keyPairs) {
                    const diff = _pDiff(p);
                    const cls = p.advantage === 'home' ? 'text-green-400' : p.advantage === 'away' ? 'text-red-400' : 'text-gray-400';
                    const hShort = shortName(p.home.name, p.home.nameZh);
                    const aShort = shortName(p.away.name, p.away.nameZh);
                    html += `<div class="text-[11px] ${cls} flex items-center gap-1">
                        ${p.advantage === 'home' ? '🟢' : '🔴'}
                        ${esc(hShort)} (${(p.home.rating/10).toFixed(1)}) vs ${esc(aShort)} (${(p.away.rating/10).toFixed(1)})
                        <span class="font-bold">${diff > 0 ? '+' : ''}${(diff/10).toFixed(1)}</span>
                    </div>`;
                }
                html += '</div>';
            }
        }

        return html;
    }
    
    // Translate player name helper
    const translatePlayerName = (name, nameZh) => Utils.translatePlayerName ? Utils.translatePlayerName(name, nameZh) : (nameZh || name);
    
    // renderBenchAnalysis function
    function renderBenchAnalysis(data, isFinishedMatch) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('数据暂无', 'No data')}</div>`;
        
        const home = data.homeTeam;
        const away = data.awayTeam;
        const comparison = data.comparison;
        
        // Bench strength color
        const getStrengthColor = (score) => {
            if (score >= 80) return 'text-green-400';
            if (score >= 60) return 'text-yellow-400';
            return 'text-red-400';
        };
        
        // Impact type icon
        const getImpactIcon = (type) => {
            switch(type) {
                case 'creative': return '🎨';
                case 'defensive': return '🛡️';
                case 'physical': return '💪';
                default: return '⚖️';
            }
        };
        
        // Appearance probability color
        const getProbColor = (prob) => {
            if (prob >= 0.7) return 'text-green-400';
            if (prob >= 0.5) return 'text-yellow-400';
            return 'text-red-400';
        };
        
        // Render bench player card
        const renderBenchPlayer = (player, teamColor, teamNameStr) => {
            const playerNameZh = translatePlayerName(player.name, player.nameZh);
            
            // Find if this player actually played
            let playedStr = '';
            if (data.realSubstitutions && data.realSubstitutions.length > 0) {
                const subEvent = data.realSubstitutions.find(s => {
                    const matchName = s.playerIn.toLowerCase();
                    const pName = (player.name || '').toLowerCase();
                    return matchName === pName || pName.includes(matchName) || matchName.includes(pName);
                });
                if (subEvent) {
                    playedStr = `<span class="font-bold ml-1 text-green-400">🔽 ${subEvent.minute} ${tx('出场', 'In')}</span>`;
                } else if (isFinishedMatch) {
                    playedStr = `<span class="font-bold ml-1 text-gray-600">${tx('未出场', 'Unused')}</span>`;
                }
            }
            
            return `
            <div class="glass-light rounded-lg p-2 mb-2 cursor-pointer hover:bg-white/10 transition-colors"
                 data-action="open-player-detail"
                 data-player-id="${attr(player.id || '')}"
                 data-player-name="${attr(player.name || '')}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold ${teamColor}">${player.jersey || '?'}</span>
                        <span class="text-xs font-bold">${esc(playerNameZh)}</span>
                        <span class="text-[11px] text-gray-500">${esc(player.pos) || '?'}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[11px] text-gray-500">${getImpactIcon(player.impactType)}</span>
                        <span class="text-xs font-bold ${getStrengthColor(player.rating)}">${esc(player.rating) || '-'}</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 text-[11px] mb-1">
                    <span class="text-gray-500">${tx('特色:', 'Traits:')}</span>
                    ${player.traits?.map(t => `<span class="bg-white/5 px-1.5 py-0.5 rounded">${esc(t)}</span>`).join('') || '<span class="text-gray-600">-</span>'}
                </div>
                
                <div class="flex items-center justify-between text-[11px]">
                    <div>
                        <span class="text-gray-500">${tx('替代:', 'Sub for:')}</span>
                        <span class="ml-1">${esc(player.substituteFor?.join(', ')) || '-'}</span>
                    </div>
                    <div>
                        ${playedStr ? `
                            <span class="text-gray-500">${tx('状态:', 'Status:')}</span>
                            ${playedStr}
                        ` : `
                            <span class="text-gray-500">${tx('出场概率:', 'Sub Prob:')}</span>
                            <span class="font-bold ml-1 ${getProbColor(player.appearanceProb)}">${Math.round(player.appearanceProb * 100)}%</span>
                        `}
                    </div>
                </div>
            </div>
            `;
        };
        
        return `
        <div class="space-y-3">
            <!-- Comparison Overview -->
            <div class="glass-light rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-gray-400">🔄 替补席对比</span>
                    <span class="text-[11px] text-gray-500">板凳深度</span>
                </div>
                
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="text-sm font-bold ${getStrengthColor(comparison.homeStrength)}">🔵 ${teamLabel(home)}</div>
                        <div class="text-lg font-bold ${getStrengthColor(comparison.homeStrength)}">${comparison.homeStrength || '-'}</div>
                    </div>
                    
                    <div class="text-center">
                        <div class="text-xs text-gray-500">VS</div>
                        <div class="text-[11px] font-bold ${comparison.advantage === 'home' ? 'text-blue-400' : comparison.advantage === 'away' ? 'text-red-400' : 'text-gray-400'}">${comparison.advantage === 'home' ? '🔵 优势' : comparison.advantage === 'away' ? '🔴 优势' : '⚖️ 均势'}</div>
                    </div>
                    
                    <div class="flex-1 text-right">
                        <div class="text-sm font-bold ${getStrengthColor(comparison.awayStrength)}">${teamLabel(away)} 🔴</div>
                        <div class="text-lg font-bold ${getStrengthColor(comparison.awayStrength)}">${comparison.awayStrength || '-'}</div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-[11px] mt-2">
                    <div>
                        <span class="text-gray-500">超级替补:</span>
                        <span class="font-bold ml-1">${home.superSubCount || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">超级替补:</span>
                        <span class="font-bold ml-1">${away.superSubCount || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">防守选项:</span>
                        <span class="font-bold ml-1">${home.defensiveOptions || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">防守选项:</span>
                        <span class="font-bold ml-1">${away.defensiveOptions || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">进攻选项:</span>
                        <span class="font-bold ml-1">${home.attackingOptions || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">进攻选项:</span>
                        <span class="font-bold ml-1">${away.attackingOptions || 0}</span>
                    </div>
                </div>
            </div>
            
            <!-- Home Bench -->
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-blue-400 mb-2">🔵 ${esc(teamLabel(home))} ${tx('替补席', 'Bench')}</div>
                ${home.bench?.map(p => renderBenchPlayer(p, 'text-blue-400', teamLabel(home))).join('') || `<div class="text-gray-500 text-xs">${tx('暂无替补数据', 'No bench data')}</div>`}
            </div>
            
            <!-- Away Bench -->
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-red-400 mb-2">🔴 ${esc(teamLabel(away))} ${tx('替补席', 'Bench')}</div>
                ${away.bench?.map(p => renderBenchPlayer(p, 'text-red-400', teamLabel(away))).join('') || `<div class="text-gray-500 text-xs">${tx('暂无替补数据', 'No bench data')}</div>`}
            </div>
            
            <!-- Substitution Matrix -->
            ${home.substitutionMatrix && Object.keys(home.substitutionMatrix).length > 0 ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-blue-400 mb-3 flex items-center gap-1">
                    <span>🔄</span> ${teamLabel(home)} ${tx('核心轮换网络', 'Substitution Heatmap')}
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${Object.entries(home.substitutionMatrix).map(([starter, subs]) => `
                    <div class="bg-white/5 rounded-lg p-2 flex flex-col justify-center border border-white/5 shadow-sm">
                        <div class="text-[11px] font-bold text-gray-300 text-center mb-1">${esc(starter)}</div>
                        <div class="flex items-center justify-center">
                            <span class="text-gray-500 text-[10px]">▼</span>
                        </div>
                        <div class="text-center mt-1 flex flex-col items-center gap-1">
                            <span class="inline-block bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded font-medium">${esc(subs.primary) || '—'}</span>
                            ${subs.secondary ? `<span class="inline-block bg-white/5 text-gray-400 text-[9px] px-2 py-0.5 rounded">${esc(subs.secondary)}</span>` : ''}
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${away.substitutionMatrix && Object.keys(away.substitutionMatrix).length > 0 ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-red-400 mb-3 flex items-center gap-1">
                    <span>🔄</span> ${teamLabel(away)} ${tx('核心轮换网络', 'Substitution Heatmap')}
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${Object.entries(away.substitutionMatrix).map(([starter, subs]) => `
                    <div class="bg-white/5 rounded-lg p-2 flex flex-col justify-center border border-white/5 shadow-sm">
                        <div class="text-[11px] font-bold text-gray-300 text-center mb-1">${esc(starter)}</div>
                        <div class="flex items-center justify-center">
                            <span class="text-gray-500 text-[10px]">▼</span>
                        </div>
                        <div class="text-center mt-1 flex flex-col items-center gap-1">
                            <span class="inline-block bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded font-medium">${esc(subs.primary) || '—'}</span>
                            ${subs.secondary ? `<span class="inline-block bg-white/5 text-gray-400 text-[9px] px-2 py-0.5 rounded">${esc(subs.secondary)}</span>` : ''}
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
        `;
    }
    
    // applySubstitutionsToFormation — overlays substitution markers on SVG tactical board
    function applySubstitutionsToFormation(realSubstitutions) {
        if (!realSubstitutions || !realSubstitutions.length) return;

        const svg = document.querySelector('#pitch-canvas svg');
        if (!svg) return;

        // Find all circle elements (player dots) in the SVG
        const circles = svg.querySelectorAll('circle');
        // Also look for <text> elements with jersey numbers
        const texts = svg.querySelectorAll('text');

        realSubstitutions.forEach(sub => {
            const outName = (sub.playerOut || '').toLowerCase();
            if (!outName) return;

            // Try to find the player dot by matching data attributes or nearby text
            circles.forEach(c => {
                // Check if this circle has a data attribute
                const name = c.getAttribute('data-player-name');
                if (name && name.toLowerCase().includes(outName)) {
                    c.setAttribute('opacity', '0.35');
                    // Add an X marker
                    const cx = parseFloat(c.getAttribute('cx') || '0');
                    const cy = parseFloat(c.getAttribute('cy') || '0');
                    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    marker.setAttribute('x', cx);
                    marker.setAttribute('y', cy - 3.5);
                    marker.setAttribute('text-anchor', 'middle');
                    marker.setAttribute('font-size', '2');
                    marker.setAttribute('font-weight', 'bold');
                    marker.setAttribute('fill', '#ef4444');
                    marker.textContent = `🔽${sub.minute}'`;
                    c.parentNode.appendChild(marker);
                }
            });

            // Also fade the corresponding jersey text
            texts.forEach(t => {
                const textContent = (t.textContent || '').trim();
                if (textContent === String(sub.playerOut) || textContent === `${sub.playerOut}'`) {
                    t.setAttribute('opacity', '0.3');
                }
            });
        });
    }
    
    // renderCoachPanel function
    function renderCoachPanel(coachData, isFinishedMatch) {
        // No data at all → placeholder
        if (!coachData || (!coachData.coachA && !coachData.coachB)) {
            return `<div class="glass-light rounded-lg p-6 text-center">
                <div class="text-4xl mb-3">🧠</div>
                <div class="text-sm font-bold text-gray-300 mb-2">${tx('教练数据', 'Coach Data')}</div>
                <div class="text-xs text-gray-500">${tx('教练数据将在后续版本中开放，敬请期待。', 'Coach data will be available in a future release. Stay tuned.')}</div>
            </div>`;
        }

        // Both coaches available (with or without comparison)
        const coachA = coachData.coachA;
        const coachB = coachData.coachB;
        const comp = coachData.comparison;

        const renderCoachCard = (coach, side) => {
            if (!coach || coach.error) {
                return `<div class="glass-light rounded-lg p-4 text-center">
                    <div class="text-2xl mb-1">🤷</div>
                    <div class="text-xs text-gray-500">${tx('教练数据暂未同步', 'Coach data not synced')}</div>
                </div>`;
            }
            const name = coach.name || '?';
            const style = coach.style || tx('未知', 'Unknown');
            const winRate = coach.winRate || '?';
            const tenure = coach.tenure || '?';
            const nationality = coach.nationality || '';
            const flag = coach.flag || '';
            const sideColor = side === 'home' ? 'border-l-blue-500' : 'border-l-red-500';
            const initial = name !== '?' ? name.charAt(0).toUpperCase() : '?';
            
            return `<div class="glass-light rounded-lg p-4 border-l-2 ${sideColor}">
                <div class="flex items-center gap-3 mb-3">
                    <div class="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold shadow-inner shrink-0">
                        ${initial}
                        ${flag ? `<div class="absolute -bottom-1 -right-1 text-[10px] bg-gray-800 rounded-full w-4 h-4 flex items-center justify-center border border-gray-700">${esc(flag)}</div>` : ''}
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-sm font-bold text-gray-200 truncate" title="${esc(name)}">${esc(name)}</span>
                        ${nationality ? `<span class="text-[10px] text-gray-500 truncate" title="${esc(nationality)}">${esc(nationality)}</span>` : ''}
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-[11px] bg-white/5 rounded-lg p-2">
                    <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx('风格', 'Style')}</span><span class="text-gray-300 font-semibold truncate" title="${esc(style)}">${esc(style)}</span></div>
                    <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx('胜率', 'Win %')}</span><span class="text-gray-300 font-mono font-semibold">${esc(winRate)}</span></div>
                    <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx('执教', 'Tenure')}</span><span class="text-gray-300 font-mono font-semibold truncate" title="${esc(tenure)}">${esc(tenure)}</span></div>
                </div>
            </div>`;
        };

        let html = '<div class="grid grid-cols-2 gap-3 mb-3">';
        html += renderCoachCard(coachA, 'home');
        html += renderCoachCard(coachB, 'away');
        html += '</div>';

        // Style comparison analysis
        if (comp) {
            html += `<div class="glass-light rounded-lg p-4 mt-3">
                <div class="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">
                    <span>⚔️</span> ${tx('战术与执教对位', 'Tactical & Coaching Matchup')}
                </div>
                <div class="space-y-2">`;

            // Function to generate the visual metric card
            const renderMatchupItem = (icon, titleZh, titleEn, valueI18n, valueFallback) => {
                const text = valueI18n ? i18nText(valueI18n) : (valueFallback || '—');
                if (text === '—') return '';
                return `
                <div class="flex items-start gap-3 bg-white/5 rounded-lg p-2.5">
                    <div class="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center shrink-0 text-lg">${icon}</div>
                    <div class="flex flex-col justify-center">
                        <span class="text-[10px] text-gray-500 font-bold mb-0.5">${tx(titleZh, titleEn)}</span>
                        <span class="text-[11px] text-gray-300 leading-tight">${esc(text)}</span>
                    </div>
                </div>`;
            };

            html += renderMatchupItem('📋', '风格对垒', 'Style Matchup', comp.styleMatchupI18n, comp.styleMatchup);
            html += renderMatchupItem('⏳', '经验差距', 'Experience Gap', comp.experienceGapI18n, comp.experienceGap);
            html += renderMatchupItem('🎯', '临场调整', 'Adjustment Edge', comp.adjustmentEdgeI18n, comp.adjustmentEdge);

            // Overall scores comparison bar
            if (comp.overallScore) {
                const names = Object.keys(comp.overallScore);
                if (names.length >= 2) {
                    const scoreA = Number(comp.overallScore[names[0]]) || 0;
                    const scoreB = Number(comp.overallScore[names[1]]) || 0;
                    const totalScore = scoreA + scoreB || 1; // avoid div by 0
                    const pctA = (scoreA / totalScore) * 100;
                    const pctB = (scoreB / totalScore) * 100;

                    html += `
                    <div class="mt-4 pt-3 border-t border-white/10">
                        <div class="text-[10px] text-gray-500 mb-2 flex justify-between">
                            <span>${esc(names[0])}</span>
                            <span>${tx('综合评分对比', 'Overall Rating Comparison')}</span>
                            <span>${esc(names[1])}</span>
                        </div>
                        <div class="flex h-3 rounded-full overflow-hidden mb-1 bg-white/5 shadow-inner">
                            <div class="bg-blue-500/80 transition-all duration-700" style="width: ${pctA}%"></div>
                            <div class="bg-red-500/80 transition-all duration-700" style="width: ${pctB}%"></div>
                        </div>
                        <div class="flex justify-between text-[11px] font-mono font-bold">
                            <span class="text-blue-300">${scoreA}</span>
                            <span class="text-red-300">${scoreB}</span>
                        </div>
                    </div>`;
                } else {
                    html += `<div class="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                        <span class="text-gray-500 text-[11px]">${tx('综合评分', 'Overall')}</span>`;
                    for (const [name, score] of Object.entries(comp.overallScore)) {
                        html += `<span class="text-[11px] font-mono font-bold text-gray-200">${esc(name)}: ${esc(String(score))}</span>`;
                    }
                    html += `</div>`;
                }
            }

            html += `</div></div>`;
        } else if (coachA && coachB && !coachData._fallback) {
            html += `<div class="glass-light rounded-lg p-4 text-center mt-3">
                <div class="text-xs text-gray-500">${tx('教练对阵分析暂未生成', 'Coach matchup analysis not yet generated')}</div>
            </div>`;
        }

        return html;
    }

    // ═══════════════════════════════════════════════════════
    // HUD Renderers — 3-column desktop layout
    // ═══════════════════════════════════════════════════════

    /**
     * HUD Left Panel — Stats bar rows (possession, shots, passes etc.)
     * Renders from matchData.teamStats ESPN format
     */
    function renderHudStatsPanel(matchData, pred) {
        const stats = matchData?.teamStats;
        if (!stats || stats.length < 2) {
            return `<div class="text-gray-500 text-xs text-center py-6">${tx('暂无统计数据', 'No stats available')}</div>`;
        }
        const hs = stats[0]?.statistics || [];
        const as = stats[1]?.statistics || [];

        const findStat = (arr, key) => {
            const s = arr.find(x => x.name === key || x.abbreviation === key);
            return s ? String(s.displayValue || s.value || '0') : '0';
        };
        const pct = (v) => parseFloat(v) || 0;

        const statRows = [
            { key: 'Possession', label: tx('控球率', 'Possession'), fmt: v => v.includes('%') ? v : v + '%' },
            { key: 'Total Shots', label: tx('射门', 'Shots'), fmt: v => v },
            { key: 'Shots on Target', label: tx('射正', 'On Target'), fmt: v => v },
            { key: 'PassAccuracy', label: tx('传球成功', 'Pass Acc.'), fmt: v => v.includes('%') ? v : v + '%' },
            { key: 'Corners', label: tx('角球', 'Corners'), fmt: v => v },
            { key: 'Fouls Committed', label: tx('犯规', 'Fouls'), fmt: v => v },
        ];

        let html = `<div style="padding:16px 18px">`;
        html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px">${tx('比赛统计', 'MATCH STATISTICS')}</div>`;
        html += `<div style="display:flex;flex-direction:column;gap:12px">`;

        for (const row of statRows) {
            const hRaw = findStat(hs, row.key);
            const aRaw = findStat(as, row.key);
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
        const score = pred.likelyScore || '? : ?';
        const [sH, sA] = score.includes(':') ? score.split(':').map(s => s.trim()) : ['?', '?'];

        // Arc: hw% of 180° semicircle
        const arcAngle = (hw / 100) * Math.PI;
        const r = 75;
        const cx = 90, cy = 85;
        const x2 = cx + r * Math.cos(Math.PI - arcAngle);
        const y2 = cy - r * Math.sin(Math.PI - arcAngle);
        const largeArc = hw > 50 ? 1 : 0;

        let html = `<div style="background:rgba(15,23,42,.45);backdrop-filter:blur(var(--glass-blur-sm));border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px 18px;box-shadow:0 4px 30px rgba(0,0,0,.4)">`;
        html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px">${tx('胜率预测', 'WIN PROBABILITY')}</div>`;

        // SVG arc
        html += `<div style="text-align:center;margin-bottom:6px">
            <svg width="180" height="95" viewBox="0 0 180 95">
                <path d="M15 85 A75 75 0 0 1 165 85" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="10" stroke-linecap="round"/>
                <path d="M15 85 A${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="rgba(59,130,246,.35)" stroke-width="10" stroke-linecap="round"/>
                <text x="90" y="50" text-anchor="middle" fill="#f8fafc" font-family="JetBrains Mono" font-size="26" font-weight="300">${hw}<tspan font-size="14" fill="rgba(248,250,252,.3)">%</tspan></text>
                <text x="90" y="67" text-anchor="middle" fill="rgba(59,130,246,.5)" font-family="JetBrains Mono" font-size="8" font-weight="400" letter-spacing="1.5">${esc(homeName || 'HOME')} WIN</text>
            </svg>
        </div>`;

        // Breakdown bar
        html += `<div style="display:flex;height:24px;border-radius:6px;overflow:hidden;gap:1px;margin-bottom:8px">
            <div style="width:${hw}%;background:rgba(59,130,246,.15);display:flex;align-items:center;justify-content:center"><span style="font:500 9px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.7)">${hw}%</span></div>
            <div style="width:${dr}%;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center"><span style="font:400 8px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${dr}%</span></div>
            <div style="width:${Math.max(1, aw)}%;background:rgba(248,113,113,.08);display:flex;align-items:center;justify-content:center"><span style="font:400 8px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.45)">${aw}%</span></div>
        </div>`;
        html += `<div style="display:flex;justify-content:space-between"><span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.35)">${esc(homeName || 'H')}</span><span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.15)">DRAW</span><span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.3)">${esc(awayName || 'A')}</span></div>`;

        // Predicted score
        html += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.04)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.35);letter-spacing:1.5px;margin-bottom:8px">${tx('预测比分', 'PREDICTED SCORE')}</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:12px">
                <div style="padding:6px 16px;border-radius:8px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.12)"><span style="font:300 20px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.6)">${esc(sH)}</span></div>
                <span style="font:300 12px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1)">:</span>
                <div style="padding:6px 16px;border-radius:8px;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.08)"><span style="font:300 20px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.45)">${esc(sA)}</span></div>
            </div>
        </div>`;

        html += `</div>`;
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
        const grass = meta?.surface || v.grass || tx('天然草', 'Natural');

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
    return {
        renderFormation,
        renderTacticalBoard,
        renderPredictionLayers,
        renderBenchAnalysis,
        applySubstitutionsToFormation,
        renderCoachPanel,
        getMockMatchupData,
        getMockPrediction,
        formationTemplate,
        parseFormationStr,
        // HUD renderers
        renderHudStatsPanel,
        renderHudWinProbPanel,
        renderHudVenuePanel,
    };
})();
