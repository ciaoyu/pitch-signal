/**
 * bracket.js – 2026 FIFA World Cup Knockout Bracket Renderer
 *
 * Usage: renderBracket(data, containerElement)
 *   data  – the bracket-data.json object { matches, tree }
 *   container – a DOM element to inject into
 *
 * Visual layout (left-to-right):
 *   R32(8) → R16(4) → QF(2) → SF(1) | FINAL | SF(1) → QF(2) → R16(4) → R32(8)
 *
 * Connector lines are drawn with an SVG overlay positioned absolutely
 * over the bracket, linking each match card to its parent.
 */

/* ─── Config ─────────────────────────────────────────────────────────── */
const BK = {
  CARD_W: 80,      // px – match card width
  CARD_H: 38,      // px – match card height (2 teams × ~19px each)
  COL_GAP: 16,     // px – horizontal gap between columns
  ROW_GAP: 4,      // px – vertical gap between sibling match cards
  SIDE_PAD: 40,    // px – outer horizontal padding (MUST be >= CARD_W/2 to avoid left truncation)
  TOP_PAD: 28,     // px – top padding (room for round labels)
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Return display label for a team slot — handles string, object {name, nameI18n}, null */
function bkTeamLabel(raw) {
  if (!raw) return 'TBD';
  if (raw === 'TBD') return 'TBD';
  if (typeof raw === 'object') {
    // Try i18n display name first, fall back to .name
    const fn = (window.WorldCup?.I18n?.displayMaybeTeamName) || ((x) => (x?.nameI18n || x?.name || 'TBD'));
    return fn(raw);
  }
  return String(raw);
}

/** Build a round label string (i18n-aware via window.uiLang) */
function bkRoundLabel(id) {
  const en = (window.uiLang === 'en');
  if (id.startsWith('R32')) return en ? 'Round of 32' : '32强';
  if (id.startsWith('R16')) return en ? 'Round of 16' : '16强';
  if (id.startsWith('QF'))  return en ? 'Quarter-Final' : '四分之一决赛';
  if (id.startsWith('SF'))  return en ? 'Semi-Final' : '半决赛';
  if (id === 'FINAL')       return en ? 'Final' : '决赛';
  return id;
}

/** Short round label for column headers */
function bkRoundShort(id) {
  if (id.startsWith('R32')) return 'R32';
  if (id.startsWith('R16')) return 'R16';
  if (id.startsWith('QF'))  return 'QF';
  if (id.startsWith('SF'))  return 'SF';
  if (id === 'FINAL')       return 'FINAL';
  return id;
}

/* ─── Layout engine ───────────────────────────────────────────────────── */

/**
 * Recursively flatten a tree branch into column arrays.
 * Returns [[leaf nodes], ..., [root node]] from outermost to innermost.
 */
function bkExtractCols(nodes) {
  const result = [nodes];
  const next = [];
  for (const n of nodes) {
    if (n.children && n.children.length) next.push(...n.children);
  }
  if (next.length) {
    for (const col of bkExtractCols(next)) result.push(col);
  }
  return result;
}

/**
 * Compute pixel (x, y) centre positions for every match card.
 * For a column with `count` items, items are evenly distributed in
 * the vertical space allocated to `totalSlots` R32 matches.
 *
 * @param {number} colIndex   – 0 = outermost (R32 side), increases inward
 * @param {number} itemIndex  – which item in this column (0-based)
 * @param {number} count      – total items in this column
 * @param {number} totalSlots – total R32 slots on this side (8)
 * @param {number} totalHeight – total vertical height of the bracket
 * @param {boolean} isLeft
 * @param {number} numCols   – total columns on one side
 * @returns {{ x, y }}
 */
function bkCardPos(colIndex, itemIndex, count, totalSlots, totalHeight, isLeft, numCols, centerX) {
  const slotH = totalHeight / totalSlots;
  // Each item in this column spans (totalSlots / count) slots
  const span = totalSlots / count;
  const y = slotH * (itemIndex * span + span / 2) + BK.TOP_PAD;

  let x;
  if (isLeft) {
    // colIndex 0 = R32 (leftmost), numCols-1 = SF (rightmost on left)
    x = BK.SIDE_PAD + (numCols - 1 - colIndex) * (BK.CARD_W + BK.COL_GAP) + BK.CARD_W / 2;
    // Flip: outermost col should be leftmost
    x = BK.SIDE_PAD + colIndex * (BK.CARD_W + BK.COL_GAP) + BK.CARD_W / 2;
  } else {
    x = centerX + (colIndex + 1) * (BK.CARD_W + BK.COL_GAP) + BK.CARD_W / 2;
  }
  return { x, y };
}

/* ─── Main renderer ───────────────────────────────────────────────────── */

function renderBracket(data, container) {
  const _uid = Math.random().toString(36).slice(2, 7);
  if (!data || !data.matches || !data.tree) {
    const en = (window.uiLang === 'en');
    container.innerHTML = `<div class="text-gray-500 py-10 text-center text-sm">${en ? 'Failed to load bracket data' : '淘汰赛对阵图数据加载失败'}</div>`;
    return;
  }

  const matches = data.matches;

  // Extract columns for each side (outermost = index 0)
  const leftColsRaw  = bkExtractCols(data.tree.left);   // [SF, QF, R16, R32] – reversed order
  const rightColsRaw = bkExtractCols(data.tree.right);  // [SF, QF, R16, R32]

  // We want left side to read R32→R16→QF→SF from left to right
  const leftCols  = [...leftColsRaw].reverse();   // R32, R16, QF, SF
  const rightCols = rightColsRaw;                 // SF, QF, R16, R32

  const numLeftCols  = leftCols.length;   // 4
  const numRightCols = rightCols.length;  // 4

  const R32_COUNT = 8; // R32 matches per side
  const ROW_SLOT_H = BK.CARD_H + BK.ROW_GAP * 2 + 4; // ~50px per slot
  const totalH = R32_COUNT * ROW_SLOT_H;

  // Calculate base X positions
  const leftSfX = BK.SIDE_PAD + (numLeftCols - 1) * (BK.CARD_W + BK.COL_GAP);
  const finalX = leftSfX + BK.CARD_W + BK.COL_GAP;
  const rightSfX = finalX + BK.CARD_W + BK.COL_GAP;
  
  // Total SVG width
  const totalW = rightSfX + (numRightCols - 1) * (BK.CARD_W + BK.COL_GAP) + BK.CARD_W / 2 + BK.SIDE_PAD;
  const totalSvgH = totalH + BK.TOP_PAD + 16;

  /* ── Build position map { matchId → {x, y} } ── */
  const posMap = {};

  // Left side positions (leftCols[0] = R32 outermost)
  leftCols.forEach((col, ci) => {
    col.forEach((node, ni) => {
      const count = col.length;
      // For left side: col 0 = R32 (leftmost x), col 3 = SF (rightmost x before final)
      const x = BK.SIDE_PAD + ci * (BK.CARD_W + BK.COL_GAP);
      const slotH = totalH / count;
      const y = slotH * (ni + 0.5) + BK.TOP_PAD;
      posMap[node.id] = { x, y };
    });
  });

  // Right side positions
  rightCols.forEach((col, ci) => {
    col.forEach((node, ni) => {
      const count = col.length;
      // col 0 = SF (closest to final), col 3 = R32 (rightmost)
      const x = rightSfX + ci * (BK.CARD_W + BK.COL_GAP);
      const slotH = totalH / count;
      const y = slotH * (ni + 0.5) + BK.TOP_PAD;
      posMap[node.id] = { x, y };
    });
  });

  // Final position
  posMap['FINAL'] = { x: finalX, y: totalH / 2 + BK.TOP_PAD };

  /* ── Build connector lines (SVG paths) ── */
  const svgLines = [];

  function addConnectors(tree, isLeft) {
    function walk(node) {
      if (!node.children) return;
      const parentPos = posMap[node.id];
      if (!parentPos) return;

      const parentEdgeX = isLeft
        ? parentPos.x - BK.CARD_W / 2  // left edge of parent card
        : parentPos.x + BK.CARD_W / 2; // right edge of parent card

      node.children.forEach(child => {
        const childPos = posMap[child.id];
        if (!childPos) return;

        const childEdgeX = isLeft
          ? childPos.x + BK.CARD_W / 2  // right edge of child card (facing parent)
          : childPos.x - BK.CARD_W / 2; // left edge of child card (facing parent)

        const midX = (parentEdgeX + childEdgeX) / 2;

        // Cubic bezier: from child right edge → curve → parent left edge
        svgLines.push(
          `<path d="M ${childEdgeX} ${childPos.y} C ${midX} ${childPos.y} ${midX} ${parentPos.y} ${parentEdgeX} ${parentPos.y}"
            fill="none" stroke="url(#connGrad-${_uid})" stroke-width="1.5" stroke-opacity="0.45" />`
        );

        walk(child);
      });
    }
    tree.forEach(n => walk(n));
  }

  addConnectors(data.tree.left, true);
  addConnectors(data.tree.right, false);

  // SF → FINAL connectors
  ['SF-1', 'SF-2'].forEach(sfId => {
    const sfPos = posMap[sfId];
    const finPos = posMap['FINAL'];
    if (!sfPos || !finPos) return;

    const sfEdgeX  = sfId === 'SF-1' ? sfPos.x  + BK.CARD_W / 2 : sfPos.x  - BK.CARD_W / 2;
    const finEdgeX = sfId === 'SF-1' ? finPos.x  - BK.CARD_W / 2 : finPos.x  + BK.CARD_W / 2;
    const midX = (sfEdgeX + finEdgeX) / 2;
    svgLines.push(
      `<path d="M ${sfEdgeX} ${sfPos.y} C ${midX} ${sfPos.y} ${midX} ${finPos.y} ${finEdgeX} ${finPos.y}"
        fill="none" stroke="url(#goldGrad-${_uid})" stroke-width="2" stroke-opacity="0.6" />`
    );
  });

  /* ── Build match cards (absolutely positioned divs) ── */
  const cards = [];

  // Round label columns (top header row) – compute unique x positions
  const roundLabelMap = {}; // x → label

  function addCards(nodeList) {
    nodeList.forEach(node => {
      const m = matches[node.id];
      const pos = posMap[node.id];
      if (!pos || !m) return;

      const teamA = bkTeamLabel(m.teamA);
      const teamB = bkTeamLabel(m.teamB);
      const isFinal = node.id === 'FINAL';
      const winnerA = m.winner === 'A';
      const winnerB = m.winner === 'B';
      const scoreA  = m.scoreA != null ? m.scoreA : '';
      const scoreB  = m.scoreB != null ? m.scoreB : '';
      const hasScore = scoreA !== '' || scoreB !== '';

      const clsWinA = winnerA ? 'text-white font-black' : 'text-gray-300 font-semibold';
      const clsWinB = winnerB ? 'text-white font-black' : 'text-gray-300 font-semibold';
      const bgWinA  = winnerA ? 'bg-blue-600/30' : '';
      const bgWinB  = winnerB ? 'bg-blue-600/30' : '';
      const borderCls = isFinal
        ? 'border border-yellow-400/40 shadow-[0_0_18px_rgba(250,189,0,0.25)]'
        : 'border border-white/10';

      const matchId = m.espnMatchId || m.matchId || '';
      const cardStyle = `position:absolute;left:${pos.x - BK.CARD_W / 2}px;top:${pos.y - BK.CARD_H / 2}px;width:${BK.CARD_W}px;cursor:pointer;`;

      // Round label header
      const roundColKey = Math.round(pos.x - BK.CARD_W / 2);
      if (!roundLabelMap[roundColKey]) roundLabelMap[roundColKey] = bkRoundShort(node.id);

      cards.push(`
        <div class="bk-card ${borderCls} rounded-xl overflow-hidden" style="${cardStyle}" data-match-bk="${node.id}" data-match-id="${matchId}" data-action="open-match-from-bracket">
          ${isFinal ? `<div class="bk-final-badge">🏆 ${bkRoundLabel(node.id)}</div>` : ''}
          <div class="bk-team ${bgWinA} ${clsWinA}" title="${teamA}">
            <span class="bk-team-name">${teamA}</span>
            ${hasScore ? `<span class="bk-score">${scoreA}</span>` : ''}
          </div>
          <div class="bk-divider"></div>
          <div class="bk-team ${bgWinB} ${clsWinB}" title="${teamB}">
            <span class="bk-team-name">${teamB}</span>
            ${hasScore ? `<span class="bk-score">${scoreB}</span>` : ''}
          </div>
        </div>
      `);

      if (node.children) node.children.forEach(c => addCards([c]));
    });
  }

  addCards(data.tree.left);
  addCards(data.tree.right);
  addCards(data.tree.center);

  /* ── Round header labels ── */
  const headers = Object.entries(roundLabelMap).map(([x, label]) => `
    <div style="position:absolute;left:${x}px;top:0;width:${BK.CARD_W}px;text-align:center;"
         class="bk-round-label">${label}</div>
  `).join('');

  /* ── Assemble HTML ── */
  const svgDefs = `
    <defs>
      <linearGradient id="connGrad-${_uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#3b82f6" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.7"/>
      </linearGradient>
      <linearGradient id="goldGrad-${_uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#f59e0b" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
  `;

  container.innerHTML = `
    <div id="bk-wrap" style="position:relative;width:${totalW + 32}px;height:${totalSvgH}px;min-width:${totalW + 32}px;margin:0 16px;box-sizing:border-box;">
      <!-- Connector SVG layer -->
      <svg style="position:absolute;left:0;top:0;width:${totalW}px;height:${totalSvgH}px;overflow:visible;pointer-events:none;" viewBox="0 0 ${totalW} ${totalSvgH}">
        ${svgDefs}
        ${svgLines.join('\n')}
      </svg>
      <!-- Round header labels -->
      ${headers}
      <!-- Match cards -->
      ${cards.join('')}
    </div>
  `;

  // Animate cards in with staggered fade
  const allCards = container.querySelectorAll('.bk-card');
  allCards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(6px)';
    card.style.transition = `opacity 0.3s ease ${i * 18}ms, transform 0.3s ease ${i * 18}ms`;
    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
  });
}

// Expose globally for app.js callers
window.renderBracket = renderBracket;
