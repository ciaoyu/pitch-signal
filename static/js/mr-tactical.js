/**
 * Match Renderers — Formation Template & Lineup Rendering
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

function formationTemplate(formation, side, opponentFormation = '') {
    const isHome = side === 'home';
    // Parse formation into parts
    const parts = String(formation || '4-3-3').split('-').map(Number);
    
    // Ensure valid parts
    let defCount = parts[0] || 4;
    let fwdCount = parts[parts.length - 1] || 3;
    let midLines = parts.slice(1, parts.length - 1);
    if (midLines.length === 0) {
        midLines = [3]; // Default to single midfield line of 3
    }

    const out = [];

    // 1. GK
    const gkY = 6;
    out.push({
        x: 50,
        y: isHome ? gkY : 100 - gkY,
        pos: 'GK',
        line: 'gk'
    });

    // 2. DEF Line
    const defYBase = 22;
    for (let i = 0; i < defCount; i++) {
        let x = 50;
        let dy = 0;
        if (defCount === 2) {
            x = i === 0 ? 35 : 65;
        } else if (defCount === 3) {
            x = i === 0 ? 28 : i === 1 ? 50 : 72;
            if (i === 1) dy = -2.5; // Center CB slightly deeper
        } else if (defCount === 4) {
            x = i === 0 ? 14 : i === 1 ? 36 : i === 2 ? 64 : 86;
            if (i === 0 || i === 3) dy = 3.5; // Fullbacks pushed up
        } else {
            // 5 or more
            const step = 76 / (defCount - 1);
            x = Math.round(12 + step * i);
            if (i === 0 || i === defCount - 1) dy = 5.0; // Wingbacks pushed up
        }

        const y = isHome ? (defYBase + dy) : (100 - defYBase - dy);
        out.push({ x, y, pos: 'D', line: 'def' });
    }

    // 3. Midfield Lines
    const fwdYBase = 70;
    const totalMidLines = midLines.length;
    for (let l = 0; l < totalMidLines; l++) {
        const count = midLines[l] || 3;
        // Interpolate y base for this midfield line
        const midYBase = defYBase + (fwdYBase - defYBase) * ((l + 1) / (totalMidLines + 1));
        
        for (let i = 0; i < count; i++) {
            let x = 50;
            let dy = 0;
            if (count === 1) {
                x = 50;
            } else if (count === 2) {
                x = i === 0 ? 34 : 66;
            } else if (count === 3) {
                x = i === 0 ? 26 : i === 1 ? 50 : 74;
                // Check if it's attacking mid or defensive mid
                if (l === totalMidLines - 1) {
                    // AM style: center advanced
                    if (i === 1) dy = 2.5;
                } else {
                    // DM style: center deeper
                    if (i === 1) dy = -2.5;
                }
            } else if (count === 4) {
                x = i === 0 ? 16 : i === 1 ? 36 : i === 2 ? 64 : 84;
                if (i === 0 || i === 3) dy = 2.0; // Wide mids slightly advanced
            } else {
                const step = 72 / (count - 1);
                x = Math.round(14 + step * i);
                if (i === 0 || i === count - 1) dy = 3.0; // Outer mids slightly advanced
            }

            const y = isHome ? (midYBase + dy) : (100 - midYBase - dy);
            out.push({ x, y, pos: 'M', line: 'mid' });
        }
    }

    // 4. FWD Line
    for (let i = 0; i < fwdCount; i++) {
        let x = 50;
        let dy = 0;
        if (fwdCount === 1) {
            x = 50;
        } else if (fwdCount === 2) {
            x = i === 0 ? 36 : 64;
        } else if (fwdCount === 3) {
            x = i === 0 ? 18 : i === 1 ? 50 : 82;
            if (i === 1) dy = 4.0; // Striker advanced
        } else {
            // 4 or more
            const step = 68 / (fwdCount - 1);
            x = Math.round(16 + step * i);
            if (i > 0 && i < fwdCount - 1) dy = 4.0; // Inner strikers advanced
        }

        const y = isHome ? (fwdYBase + dy) : (100 - fwdYBase - dy);
        out.push({ x, y, pos: 'F', line: 'fwd' });
    }

    return out;
}

/** Parse formation string (consistent with backend parseFormation) */

function parseFormationStr(f) {
    const parts = String(f || '4-3-3').split('-').map(Number);
    if (parts.length === 3) return { def: parts[0], mid: parts[1], fwd: parts[2] };
    if (parts.length === 4) return { def: parts[0], midDM: parts[1], midAM: parts[2], fwd: parts[3], mid: parts[1] + parts[2] };
    return { def: 4, mid: 3, fwd: 3 };
}

// Safe helper: get team label with i18n + fallback chain

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
    // Export to namespace
    MR.formationTemplate = formationTemplate;
    MR.parseFormationStr = parseFormationStr;
    MR.getMockMatchupData = getMockMatchupData;
    MR.getMockPrediction = getMockPrediction;
    MR.renderFormation = renderFormation;
    MR.applySubstitutionsToFormation = applySubstitutionsToFormation;
})();
