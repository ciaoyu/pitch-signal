/**
 * Compress ESPN-style match events into evidence suitable for post-match analysis.
 * The function deliberately leaves team-dependent fields unchanged when an event
 * does not identify a team, rather than guessing from the event text.
 */

const MatchMoment = require('./models/MatchMoment');
const { translateEventToBilingual, translateFootballCommentaryToZh } = require('./keyEvents');

const WATER_BREAK_WINDOWS = [
  { minute: 30, start: 27, end: 33 },
  { minute: 75, start: 72, end: 78 },
];

function getEventText(event) {
  if (typeof event === 'string') return event.trim();
  if (!event || typeof event !== 'object') return '';

  return String(
    event.text
      || event.description
      || event.detail
      || event.textI18n?.zh
      || event.textI18n?.en
      || '',
  ).trim();
}

function getEventType(event) {
  if (!event || typeof event !== 'object') return '';
  const type = event.type;
  if (typeof type === 'object') {
    return String(type.name || type.text || type.displayName || type.id || '').toLowerCase();
  }
  return String(type || '').toLowerCase();
}

function getMinute(event) {
  const rawMinute = event && typeof event === 'object'
    ? event.minute ?? event.time?.displayValue ?? event.time?.value ?? event.clock?.displayValue
    : '';
  const value = rawMinute && typeof rawMinute === 'object'
    ? rawMinute.displayValue ?? rawMinute.value ?? rawMinute.text
    : rawMinute;

  return String(value ?? '').trim();
}

function parseMinute(minute) {
  const match = String(minute || '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function classifyEvent(type, text) {
  const normType = String(type).trim().toLowerCase();
  
  // 1. Strict exact matches on 'type' first
  if (normType === 'own-goal' || normType === 'own_goal') return 'own_goal';
  if (normType === 'var') return 'var';
  if (normType === 'penalty') return 'penalty';
  if (normType === 'red-card' || normType === 'red card') return 'card';
  if (normType === 'yellow-card' || normType === 'yellow card') return 'card';
  if (normType === 'substitution' || normType === 'sub') return 'substitution';
  if (normType === 'goal') return 'goal';
  if (normType === 'shot') return 'shot';

  // 2. Fallback to regex inference on combined string
  const value = `${type} ${text}`.toLowerCase();

  if (/own[ -]?goal|乌龙/.test(value)) return 'own_goal';
  if (/\bvar\b|video assistant|视频助理裁判/.test(value)) return 'var';
  if (/penalty|点球/.test(value)) return 'penalty';
  if (/red card|yellow[- ]?card|\bcard\b|红牌|黄牌/.test(value)) return 'card';
  if (/substitution|substitute|\bsub\b|换人/.test(value)) return 'substitution';
  
  // Evaluate 'shot' before 'goal' to prevent "Shot on goal" being classified as a scored goal
  // …but check ESPN's scored-goal pattern FIRST: "Goal! Team X, Team 0."
  // to prevent "Goal! Portugal … right footed shot …" being misclassified as shot.
  if (/^goal!/i.test(String(text || '').trim())) return 'goal';
  if (/\bshot\b|missed goal|射门|打门/.test(value)) return 'shot';
  if (/\bgoal\b|进球|破门|得分/.test(value) && !/goal kick|球门球/.test(value)) return 'goal';

  return null;
}

function isScoredGoal(type, text, category) {
  if (category === 'goal' || category === 'own_goal') return true;
  return category === 'penalty' && /(?:penalty.*(?:goal|scored)|点球.*(?:命中|罚入|打进))/.test(`${type} ${text}`.toLowerCase());
}

function normaliseName(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function textMentionsTeam(text, teamName) {
  const normalizedTeam = normaliseName(teamName);
  if (!normalizedTeam) return false;

  if (/^[a-z0-9 .'-]+$/i.test(normalizedTeam)) {
    const escapedName = normalizedTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escapedName}\\b`, 'i').test(text);
  }

  return normaliseName(text).includes(normalizedTeam);
}

function inferSide(event, text, ctx) {
  const explicitSide = event && typeof event === 'object'
    ? event.homeAway || event.side || event.teamSide || event.team?.homeAway || event.team?.side
    : '';
  const normalizedSide = String(explicitSide || '').toLowerCase();
  if (normalizedSide === 'home' || normalizedSide === 'away') return normalizedSide;

  const normalizedText = normaliseName(text);
  const homeName = normaliseName(ctx.homeName);
  const awayName = normaliseName(ctx.awayName);
  const eventTeamName = normaliseName(
    event?.team?.displayName || event?.team?.name || event?.teamName || event?.team,
  );

  if (eventTeamName && eventTeamName === homeName) return 'home';
  if (eventTeamName && eventTeamName === awayName) return 'away';

  if (homeName && textMentionsTeam(normalizedText, homeName)) return 'home';
  if (awayName && textMentionsTeam(normalizedText, awayName)) return 'away';

  return null;
}

function getBucket(minute, buckets) {
  if (!Number.isFinite(minute)) return null;
  const start = Math.floor(Math.max(minute - 1, 0) / 15) * 15;
  const window = `${start}-${start + 15}`;
  if (!buckets.has(window)) {
    buckets.set(window, { window, homeShots: 0, awayShots: 0, goals: 0 });
  }
  return buckets.get(window);
}

function buildMatchScript(goalTimeline, shotCounts) {
  if (goalTimeline.length === 0) return 'unknown';

  let homeScore = 0;
  let awayScore = 0;
  let homeTrailed = false;
  let awayTrailed = false;
  let homeLed = false;
  let awayLed = false;

  for (const goal of goalTimeline) {
    if (goal.side === 'home') homeScore += 1;
    else awayScore += 1;

    if (homeScore > awayScore) homeLed = true;
    if (awayScore > homeScore) awayLed = true;
    if (homeScore < awayScore) homeTrailed = true;
    if (awayScore < homeScore) awayTrailed = true;
  }

  if (homeScore === awayScore) return homeLed || awayLed ? 'collapse' : 'even';

  const winner = homeScore > awayScore ? 'home' : 'away';
  const winnerTrailed = winner === 'home' ? homeTrailed : awayTrailed;
  if (winnerTrailed) return 'comeback';

  const winnerShots = winner === 'home' ? shotCounts.home : shotCounts.away;
  const loserShots = winner === 'home' ? shotCounts.away : shotCounts.home;
  if (loserShots >= 3 && loserShots >= winnerShots * 2 + 2) return 'smash_and_grab';

  return 'control_win';
}

function filterMatchEvents(events, ctx = {}) {
  if (!Array.isArray(events)) {
    return { keyEvents: [], momentumBuckets: [], matchScript: 'unknown', notes: [], moments: [] };
  }

  const keyEvents = [];
  const moments = [];
  const buckets = new Map();
  const notes = [];
  const yellowCards = { home: 0, away: 0 };
  const goalTimeline = [];
  const shotCounts = { home: 0, away: 0 };
  let homeScore = 0;
  let awayScore = 0;

  for (const event of events) {
    const text = getEventText(event);
    const type = getEventType(event);
    const category = classifyEvent(type, text);
    if (!category) continue;

    const minute = getMinute(event);
    const minuteNumber = parseMinute(minute);
    const side = inferSide(event, text, ctx);
    const gameState = `${homeScore}-${awayScore}`;
    const textI18n = typeof event === 'string'
      ? { zh: translateFootballCommentaryToZh(event), en: event }
      : translateEventToBilingual(event);
    keyEvents.push({ minute, type: category, text, textI18n, gameState });

    // Create MatchMoment for this event
    const momentCategory = MatchMoment.mapESPNTypeToCategory(type);
    const scoreBefore = { home: homeScore, away: awayScore };
    
    const moment = MatchMoment.fromESPNEvent({
      ...event,
      minute,
      type: { name: category },
      text,
      homeAway: side,
      athlete: event.athlete || {},
      team: event.team || {},
    }, {
      matchId: ctx.matchId,
      homeId: ctx.homeId,
      awayId: ctx.awayId,
      scoreBefore,
    });
    
    moments.push(moment);

    const bucket = getBucket(minuteNumber, buckets);
    if (category === 'shot' && side && bucket) {
      bucket[side === 'home' ? 'homeShots' : 'awayShots'] += 1;
      shotCounts[side] += 1;
    }

    const scoredGoal = isScoredGoal(type, text, category);
    if (scoredGoal && bucket) bucket.goals += 1;
    if (scoredGoal && side) {
      const scoringSide = category === 'own_goal' ? (side === 'home' ? 'away' : 'home') : side;
      if (scoringSide === 'home') homeScore += 1;
      else awayScore += 1;
      goalTimeline.push({ minute: minuteNumber, side: scoringSide });
      
      // Update moment with score after
      moment.scoreAfter = { home: homeScore, away: homeScore };
      moment.isSwingMoment = MatchMoment.determineIsSwingMoment(moment);
      moment.significance = MatchMoment.determineSignificance(moment);
    }

    if (category === 'card' && side && /yellow[- ]?card|黄牌/.test(`${type} ${text}`.toLowerCase())) {
      yellowCards[side] += 1;
    }

    if (/goalkeeper.*(?:error|mistake|howler)|(?:error|mistake|howler).*goalkeeper|门将.*(?:失误|送礼)/i.test(text)) {
      notes.push({
        en: `Goalkeeper error signal: ${minute || 'unknown minute'} ${text}`,
        zh: `门将疑似失误信号: ${minute || '未知时间'} ${text}`
      });
    }

    for (const window of WATER_BREAK_WINDOWS) {
      if (minuteNumber !== null && minuteNumber >= window.start && minuteNumber <= window.end) {
        notes.push({
          en: `Key event near the ${window.minute}' hydration window: ${minute}' ${text}`,
          zh: `补水窗口 (${window.minute}') 附近的关键事件: ${minute}' ${text}`
        });
      }
    }
  }

  for (const [side, count] of Object.entries(yellowCards)) {
    if (count >= 2) {
      const teamName = side === 'home' ? ctx.homeName : ctx.awayName;
      notes.push({
        en: `${teamName || side} received ${count} yellow cards; suspension risk depends on competition rules.`,
        zh: `${teamName || side} 收到 ${count} 张黄牌；停赛风险取决于赛事具体规则。`
      });
    }
  }

  return {
    keyEvents,
    momentumBuckets: [...buckets.values()],
    matchScript: buildMatchScript(goalTimeline, shotCounts),
    notes,
    moments,
  };
}

module.exports = { filterMatchEvents };
