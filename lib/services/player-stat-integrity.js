'use strict';

// ESPN occasionally returns a season shell (labels but no values) and a game-log
// event list with no player stat rows.  Treat those as unavailable, never as zero.
function statValue(statistics, name) {
  const stat = (statistics || []).find(item => item?.name === name);
  const raw = stat?.displayValue ?? stat?.value;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  return raw;
}

function numericStat(statistics, name) {
  const raw = statValue(statistics, name);
  if (raw === null) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function buildClubStats(statsSummary) {
  const statistics = statsSummary?.statistics;
  if (!Array.isArray(statistics) || !statistics.length) {
    return { dataQuality: 'unavailable', _note: '俱乐部赛季数据源未返回有效统计' };
  }

  const startsSubIns = statValue(statistics, 'starts-subIns');
  const minutes = numericStat(statistics, 'minutesPlayed');
  const startsMatch = String(startsSubIns || '').match(/^\s*(\d+)\s*(?:\((\d+)\))?/);
  const starts = startsMatch ? Number(startsMatch[1]) : null;
  const subIns = startsMatch && startsMatch[2] !== undefined ? Number(startsMatch[2]) : null;
  const appearances = starts !== null && subIns !== null ? starts + subIns : null;

  // A zero goal total is valid only when ESPN also supplies participation data.
  if (appearances === null && minutes === null) {
    return { dataQuality: 'unavailable', _note: '俱乐部赛季数据源未返回出场或分钟，不能将空值显示为 0' };
  }

  return {
    season: statsSummary.displayName || '',
    appearances,
    starts,
    minutes,
    goals: numericStat(statistics, 'totalGoals'),
    assists: numericStat(statistics, 'goalAssists'),
    shots: numericStat(statistics, 'totalShots'),
    dataQuality: 'live',
    source: 'ESPN athlete statsSummary',
  };
}

function buildRecentForm(gamelog, limit = 10) {
  const rows = Object.values(gamelog?.events || [])
    .map(event => {
      const minutes = numericStat(event?.stats, 'minutesPlayed');
      return {
        event,
        minutes,
        goals: numericStat(event?.stats, 'totalGoals'),
        assists: numericStat(event?.stats, 'goalAssists'),
        date: event?.date || event?.gameDate || '',
      };
    })
    // A game-log entry without minutes is only a fixture shell, not an appearance.
    .filter(row => row.minutes !== null && row.minutes > 0)
    .sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))
    .slice(0, limit);

  if (!rows.length) {
    return { dataQuality: 'unavailable', _note: '近期比赛数据源未返回可验证的出场分钟' };
  }
  return {
    matches: rows.length,
    goals: rows.reduce((sum, row) => sum + (row.goals || 0), 0),
    assists: rows.reduce((sum, row) => sum + (row.assists || 0), 0),
    minutes: Math.round(rows.reduce((sum, row) => sum + row.minutes, 0)),
    dataQuality: 'live',
    source: 'ESPN athlete gamelog',
  };
}

module.exports = { buildClubStats, buildRecentForm };
