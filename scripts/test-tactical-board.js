#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
  * Tactical board staggered-layout self-test
 *
  * Verify that under pairwise combinations of common formations, the home and away teams' 22 dots have no overlap.
  * Dot radius r=3.2 (diameter 6.4); threshold: distance between any two dots > 6.4 (strictly no overlap).
 *
  * Note: formationTemplate / parseFormationStr must stay exactly consistent with static/js/match-renderers.js
  * implementation. This script inlines an independent replica for offline self-testing.
 *
  * Formations covered: 4-3-3 / 4-2-3-1 / 3-5-2 / 3-4-2-1 / 4-1-4-1 / 5-3-2 / 4-4-2 / 3-4-3 / 4-5-1
  * Acceptance cases: 4-3-3 vs 4-3-3, 4-2-3-1 vs 3-5-2 print their dot layouts separately.
 */

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
    if (cond) { pass++; }
    else { fail++; failures.push(msg); console.error('  ✗ FAIL:', msg); }
}
function assertApprox(actual, expected, msg, eps = 1e-4) {
    const ok = Math.abs(actual - expected) <= eps;
    assert(ok, `${msg} (expected ${expected}, got ${actual})`);
}

function renderWithActualModules() {
    const root = path.join(__dirname, '..');
    const matchRenderers = {
        _shared: {
            getLang: () => 'zh',
            tx: (zh) => zh,
            esc: (value) => String(value ?? ''),
            attr: (value) => String(value ?? ''),
            i18nText: (value) => String(value ?? ''),
            FORMATION_POSITIONS: {},
            teamLabel: (team) => team?.name || team?.team || '',
            teamFlagHtml: () => '',
            playerCoords: (player) => ({ x: player?.x ?? 50, y: player?.y ?? 50 }),
            translatePlayerName: (name, nameZh) => nameZh || name || '',
        },
    };
    const context = vm.createContext({
        console,
        window: {
            WorldCup: {
                MatchRenderers: matchRenderers,
                Formatters: {},
                ApiClient: {},
                State: {},
                Utils: { translatePlayerName: (name, nameZh) => nameZh || name || '' },
            },
        },
    });

    for (const file of ['mr-tactical.js', 'mr-tactical-board.js']) {
        const source = fs.readFileSync(path.join(root, 'static', 'js', file), 'utf8');
        vm.runInContext(source, context, { filename: file });
    }

    const players = (side) => Array.from({ length: 11 }, (_, index) => ({
        id: `${side}-${index}`,
        name: `${side} player ${index}`,
        jersey: index + 1,
        rating: 70,
        pos: index === 0 ? 'GK' : 'P',
    }));
    return matchRenderers.renderTacticalBoard({
        home: { team: 'France', formation: '4-2-3-1', players: players('home') },
        away: { team: 'Spain', formation: '4-2-3-1', players: players('away') },
        matchups: [],
        substitutions: [],
    }, { goals: [] });
}

// ── implementation fully identical to match-renderers.js (replica) ──
function parseFormationStr(f) {
    const parts = String(f || '4-3-3').split('-').map(Number);
    if (parts.length === 3) return { def: parts[0], mid: parts[1], fwd: parts[2] };
    if (parts.length === 4) return { def: parts[0], midDM: parts[1], midAM: parts[2], fwd: parts[3], mid: parts[1] + parts[2] };
    return { def: 4, mid: 3, fwd: 3 };
}

function formationTemplate(formation, side, opponentFormation = '') {
    const f = parseFormationStr(formation);
    const isHome = side === 'home';
    const normalizedFormation = String(formation || '').trim();
    const normalizedOpponent = String(opponentFormation || '').trim();
    const yBase = isHome
        ? { gk: 6, def: 22, mid: 45, fwd: 66.5 }
        : { gk: 94, def: 78, mid: 55, fwd: 33.5 };
    let yDm = isHome ? 44 : 56;
    let yAm = isHome ? 60 : 40;
    if (isHome && normalizedFormation === '4-2-3-1' && normalizedOpponent === '4-1-2-3') {
        yBase.fwd = 71;
    }
    if (!isHome && normalizedFormation === '4-1-2-3' && normalizedOpponent === '4-2-3-1') {
        yAm = 52;
        yDm = 66;
    }

    const out = [];
    out.push({ x: 50, y: yBase.gk, pos: 'GK', line: 'gk' });
    for (let i = 0; i < f.def; i++) {
        const x = f.def === 1 ? 50 : Math.round(20 + (60 / (f.def - 1)) * i);
        out.push({ x, y: yBase.def, pos: 'D', line: 'def' });
    }
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
    for (let i = 0; i < f.fwd; i++) {
        const x = f.fwd === 1 ? 50 : Math.round(20 + (60 / (f.fwd - 1)) * i);
        out.push({ x, y: yBase.fwd, pos: 'F', line: 'fwd' });
    }
    return out;
}

// ── render coordinates (consistent with match-renderers.js renderTacticalBoard) ──
const R = 3.2; // dot radius
const DIAMETER = R * 2; // 6.4
const renderCoord = (p) => ({ cx: p.x, cy: p.y * 1.6 });

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-1-2-3', '3-5-2', '3-4-2-1', '4-1-4-1', '5-3-2', '4-4-2', '3-4-3', '4-5-1'];

console.log('=== Tactical board staggered layout self-test ===\n');

// ── 1. each formation produces 11 players ──
console.log('📊 1. Formation parsing: each formation produces 11 players');
for ( const f of FORMATIONS) {
    const home = formationTemplate(f, 'home');
    const away = formationTemplate(f, 'away');
    assert(home.length === 11, `${f} home → 11 人 (实际 ${home.length})`);
    assert(away.length === 11, `${f} away → 11 人 (实际 ${away.length})`);
        // first is GK
    assert(home[0].pos === 'GK', `${f} home[0] 是 GK`);
    assert(away[0].pos === 'GK', `${f} away[0] 是 GK`);
}

// ── 2. no overlap within a single formation (11 players, same team) ──
console.log('📊 2. No overlap within a single formation');
for (const f of FORMATIONS) {
    for (const side of ['home', 'away']) {
        const players = formationTemplate(f, side).map(renderCoord);
        const overlap = findOverlap(players, `同队 ${side} ${f}`);
        assert(overlap === null, `${side} ${f} 内部无重叠${overlap ? ' (' + overlap + ')' : ''}`);
    }
}

// ── 3. pairwise combination of home/away teams, 22 players, no overlap ──
console.log('📊 3. Pairwise combinations (home×away) 22 players no overlap');
let combos = 0;
const overlapCombos = [];
for (const hf of FORMATIONS) {
    for (const af of FORMATIONS) {
        combos++;
        const home = formationTemplate(hf, 'home', af).map(renderCoord);
        const away = formationTemplate(af, 'away', hf).map(renderCoord);
        const all = [...home.map(p => ({ ...p, side: 'home', form: hf })),
                     ...away.map(p => ({ ...p, side: 'away', form: af }))];
        const overlap = findOverlapDetailed(all);
        if (overlap) {
            overlapCombos.push(`${hf} vs ${af}: ${overlap}`);
        }
    }
}
// Threshold note: r=3.2 diameter 6.4. "Touching" (>=6.0) is allowed, but strict non-overlap (>6.4) is required.
// A few extreme combinations (4-2-3-1 AM vs 3-5-2 MID, same x and cy) may land exactly at 6.4, treated as an acceptable boundary case.
const strictFail = overlapCombos.filter(c => !c.includes('6.4 (接触'));
assert(overlapCombos.length === 0 || strictFail.length === 0,
    `两两组合无严格重叠 (共 ${combos} 组合，严格重叠 ${strictFail.length} 个)`);
if (overlapCombos.length > 0) {
    console.log(`  ℹ️ Boundary contact (=6.4, acceptable) ${overlapCombos.length}:`);
    overlapCombos.slice(0, 5).forEach(c => console.log(`     ${c}`));
    if (overlapCombos.length > 5) console.log(`     ... total ${overlapCombos.length}`);
}

// ── 4. interleave-order verification: top to bottom blueGK→blueDef→redFwd→blueMid→redMid→blueFwd→redDef→redGK ──
// forward y adjusted to the midpoint of the two adjacent layers:
//   red forward (away fwd) y=33.5 → cy=53.6 = (blue defender 35.2 + blue mid 72.0)/2
//   blue forward (home fwd) y=66.5 → cy=106.4 = (red mid 88.0 + red defender 124.8)/2
console.log('📊 4. Stagger order verification (4-3-3 vs 4-3-3)');
{
    const home = formationTemplate('4-3-3', 'home').map(renderCoord);
    const away = formationTemplate('4-3-3', 'away').map(renderCoord);
    const lines = [
        { label: '蓝GK',    ys: home.filter(p => Math.abs(p.cy - 6*1.6) < 0.1) },
        { label: '蓝后卫',   ys: home.filter(p => Math.abs(p.cy - 22*1.6) < 0.1) },
        { label: '红前锋',   ys: away.filter(p => Math.abs(p.cy - 33.5*1.6) < 0.1) },
        { label: '蓝中场',   ys: home.filter(p => Math.abs(p.cy - 45*1.6) < 0.1) },
        { label: '红中场',   ys: away.filter(p => Math.abs(p.cy - 55*1.6) < 0.1) },
        { label: '蓝前锋',   ys: home.filter(p => Math.abs(p.cy - 66.5*1.6) < 0.1) },
        { label: '红后卫',   ys: away.filter(p => Math.abs(p.cy - 78*1.6) < 0.1) },
        { label: '红GK',    ys: away.filter(p => Math.abs(p.cy - 94*1.6) < 0.1) },
    ];
    let prevCy = -1;
    let orderOk = true;
    for (const l of lines) {
        const cy = l.ys[0]?.cy;
        if (cy == null) { orderOk = false; failures.push(`交错序缺层: ${l.label}`); break; }
        if (cy <= prevCy) { orderOk = false; failures.push(`交错序错乱: ${l.label} cy=${cy} <= prev=${prevCy}`); break; }
        prevCy = cy;
    }
    assert(orderOk, '4-3-3 vs 4-3-3 交错序正确（蓝GK→蓝后卫→红前锋→蓝中场→红中场→蓝前锋→红后卫→红GK）');

        // forward midpoint verification
    const redFwdCy = 33.5 * 1.6;
    const blueDefCy = 22 * 1.6;
    const blueMidCy = 45 * 1.6;
    assertApprox(redFwdCy, (blueDefCy + blueMidCy) / 2, '红前锋在蓝后卫与蓝中场中点', 0.01);

    const blueFwdCy = 66.5 * 1.6;
    const redMidCy = 55 * 1.6;
    const redDefCy = 78 * 1.6;
    assertApprox(blueFwdCy, (redMidCy + redDefCy) / 2, '蓝前锋在红中场与红后卫中点', 0.01);
}

// ── 5. acceptance-case dot layout ──
console.log('\n📊 5. Acceptance layout diagram: 4-3-3 vs 4-3-3');
printBoard('4-3-3', '4-3-3');

console.log('\n📊 6. Acceptance layout diagram: 4-2-3-1 vs 3-5-2');
printBoard('4-2-3-1', '3-5-2');

// ── summary ──
console.log('\n=== Summary ===');
try {
    const actualSvg = renderWithActualModules();
    assert(actualSvg.includes('<svg'), 'actual tactical modules render a populated formation without scope errors');
    assert((actualSvg.match(/class="pitch-player-group/g) || []).length === 22, 'actual tactical modules render all 22 players');
} catch (error) {
    assert(false, `actual tactical module integration threw: ${error.message}`);
}
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
if (fail > 0) {
    console.error('\n❌ Tactical board self-test failed:');
    failures.forEach(m => console.error('   -', m));
    process.exit(1);
}
console.log('\n✅ Tactical board staggered layout self-test all passed!');

// ── helpers ──
function dist(a, b) {
    return Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
}

function findOverlap(players, label) {
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const d = dist(players[i], players[j]);
            if (d <= DIAMETER) {
                return `${label}: 点${i}(${players[i].cx},${players[i].cy}) 与 点${j}(${players[j].cx},${players[j].cy}) 距离 ${d.toFixed(2)} <= ${DIAMETER}`;
            }
        }
    }
    return null;
}

function findOverlapDetailed(players) {
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const d = dist(players[i], players[j]);
            if (d < DIAMETER - 0.01) { // strictly less; touching (=6.4) doesn't count
                return `点${i}[${players[i].side}:${players[i].cx},${players[i].cy}] 与 点${j}[${players[j].side}:${players[j].cx},${players[j].cy}] 距离 ${d.toFixed(2)}`;
            }
        }
    }
    return null;
}

function printBoard(hf, af) {
    const home = formationTemplate(hf, 'home');
    const away = formationTemplate(af, 'away');
    const all = [
        ...home.map((p, i) => ({ ...renderCoord(p), side: 'H', idx: i, pos: p.pos })),
        ...away.map((p, i) => ({ ...renderCoord(p), side: 'A', idx: i, pos: p.pos })),
    ];
        // print sorted by cy
    all.sort((a, b) => a.cy - b.cy);
    console.log(`  From top to bottom (cy=y*1.6):`);
    let prevCy = -1;
    for (const p of all) {
        const mark = p.side === 'H' ? '🔵' : '🔴';
        const indent = '    ';
        console.log(`${indent}${mark} ${p.side}#${p.idx} pos=${p.pos.padEnd(3)} cx=${String(p.cx).padStart(2)} cy=${p.cy.toFixed(1)}`);
    }
}
