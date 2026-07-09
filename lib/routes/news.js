const { createLogger } = require('../logger');
const logger = createLogger('news');
/**
 * News and head-to-head related routes
 * /api/match/:id/news, /api/news/search, /api/match/:id/head-to-head
 */
const { createHash, randomUUID } = require('crypto');
function hashSeed(...parts) {
  return createHash('sha256').update(parts.join('|')).digest();
}

function seededInt(seed, min, max) {
  if (max <= min) return min;
  const digest = hashSeed(seed);
  const value = digest.readUInt32BE(0);
  return min + (value % (max - min + 1));
}

function seededFloat(seed) {
  const digest = hashSeed(seed);
  return digest.readUInt32BE(0) / 0xffffffff;
}

function safeHostname(rawUrl) {
  try {
    return new URL(rawUrl || 'https://example.com').hostname.replace(/^www\./, '');
  } catch {
    return 'example.com';
  }
}

// Betting domain filtering — non-betting positioning, exclude betting content.
// exclude_domains filters at Tavily source; looksLikeBetting fallback catches remaining betting titles/domains.
const BETTING_DOMAINS = [
  'sportsgambler.com', 'oddschecker.com', 'bet365.com', 'draftkings.com',
  'fanduel.com', 'williamhill.com', 'betway.com', 'paddypower.com',
  'betfair.com', 'pinnacle.com', 'sportsbookwire.usatoday.com',
  'sportsbetting.com', 'covers.com', 'pickswise.com', 'betting.com',
  'forebet.com', 'windrawwin.com', 'bettingexpert.com',
];

function looksLikeBetting(title, content, url) {
  const host = safeHostname(url).toLowerCase();
  if (/bet|gambl|odds|wager|punter|accumulator/.test(host)) return true;
  const text = `${title || ''} ${content || ''}`.toLowerCase();
  return /betting tip|bet of the day|accumulator|best odds|betting preview|gambling|free bet|acca\b/.test(text);
}

function makeId(prefix, seed) {
  const tail = typeof randomUUID === 'function'
    ? randomUUID().slice(0, 8)
    : createHash('md5').update(`${prefix}:${seed}:${Date.now()}`).digest('hex').slice(0, 8);
  return `${prefix}_${Date.now()}_${tail}`;
}

function i18n(zh, en) {
  return { zh, en };
}

function analyzeNewsImportance(title, content) {
  const text = `${title || ''} ${content || ''}`.toLowerCase();

  if (
    text.includes('injury') || text.includes('injured') || text.includes('hurt') ||
    text.includes('doubtful') || text.includes('questionable') || text.includes('out')
  ) return 'red';
  if (text.includes('suspended') || text.includes('ban') || text.includes('red card')) return 'red';
  if (text.includes('lineup') || text.includes('starting') || text.includes('formation change')) return 'red';

  if (text.includes('tactics') || text.includes('formation') || text.includes('strategy')) return 'yellow';
  if (text.includes('press conference') || text.includes('coach') || text.includes('manager')) return 'yellow';
  if (text.includes('transfer') || text.includes('signing') || text.includes('contract')) return 'yellow';

  return 'green';
}

function classifyNewsType(title, content) {
  const text = `${title || ''} ${content || ''}`.toLowerCase();

  if (text.includes('injury') || text.includes('injured') || text.includes('hurt') || text.includes('fitness')) return 'injury';
  if (text.includes('lineup') || text.includes('starting') || text.includes('squad') || text.includes('team news')) return 'lineup';
  if (text.includes('tactics') || text.includes('formation') || text.includes('strategy')) return 'tactical';
  if (text.includes('coach') || text.includes('manager') || text.includes('press conference')) return 'coach';
  if (text.includes('transfer') || text.includes('signing') || text.includes('contract')) return 'transfer';
  if (text.includes('history') || text.includes('record') || text.includes('previous')) return 'history';

  return 'general';
}

function extractTags(title, content) {
  const text = `${title || ''} ${content || ''}`.toLowerCase();
  const tags = [];

  if (text.includes('injury') || text.includes('injured')) tags.push('injury');
  if (text.includes('lineup') || text.includes('starting')) tags.push('lineup');
  if (text.includes('tactics') || text.includes('formation')) tags.push('tactics');
  if (text.includes('coach') || text.includes('manager')) tags.push('coach');
  if (text.includes('transfer') || text.includes('signing')) tags.push('transfer');
  if (text.includes('preview') || text.includes('analysis')) tags.push('preview');
  if (text.includes('training') || text.includes('practice')) tags.push('training');

  return tags.length > 0 ? tags : ['general'];
}

function generateMockNews(homeTeam, awayTeam, matchDate, homeI18n = null, awayI18n = null, matchStatus = null) {
  const now = new Date();
  const matchTime = new Date(matchDate);
  const hoursUntilMatch = Number.isFinite(matchTime.getTime())
    ? Math.max(0, (matchTime - now) / (1000 * 60 * 60))
    : 0;
  const normalizedStatus = String(matchStatus || '').toUpperCase();
  const isFinished = normalizedStatus === 'POST'
    || /FINAL|FULL_TIME|FINISHED/.test(normalizedStatus)
    || (matchTime.getTime() > 0 && now > matchTime && hoursUntilMatch < -2);

  const news = [];
  const homeZh = homeI18n?.zh || homeTeam;
  const awayZh = awayI18n?.zh || awayTeam;
  const homeEn = homeI18n?.en || homeTeam;
  const awayEn = awayI18n?.en || awayTeam;

  if (isFinished) {
    // === Post-match mock news (match already finished) ===
    const title = `${homeZh} vs ${awayZh} 赛后总结`;
    const summary = `${homeZh}与${awayZh}的世界杯小组赛已经结束，双方在场上展现了高水平的竞技状态。`;
    const content = `${homeZh}与${awayZh}的世界杯小组赛落下帷幕。两队在攻防两端均有亮眼表现，比赛过程扣人心弦。赛后双方教练都对球队的发挥进行了点评。`;
    news.push({
      id: 'mock_1',
      title,
      titleI18n: i18n(title, `${homeEn} vs ${awayEn} match recap`),
      summary,
      summaryI18n: i18n(summary, `${homeEn} and ${awayEn} have completed their World Cup group stage match. Both sides demonstrated high-level competitive form.`),
      content,
      contentI18n: i18n(content, `The World Cup group stage match between ${homeEn} and ${awayEn} has concluded. Both teams showed impressive attacking and defensive performances in a gripping contest, with both coaches commenting on their sides' displays after the final whistle.`),
      url: '',
      source: '世界杯分析',
      sourceI18n: i18n('世界杯分析', 'World Cup analysis'),
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      importance: 'yellow',
      type: 'tactical',
      relatedTeams: [homeTeam, awayTeam],
      tags: ['post-match', 'analysis'],
    });

    const title2 = `${homeZh} 主教练赛后发布会`;
    const summary2 = `${homeZh}主教练在赛后新闻发布会上对球队的表现进行了总结，并对接下来的比赛进行了展望。`;
    const content2 = `${homeZh}主教练在赛后发布会上表示：球队在比赛中执行了赛前部署，虽然过程中有起伏，但整体表现令人满意。他还提到了接下来需要改进的环节，并向球迷表示感谢。`;
    news.push({
      id: 'mock_2',
      title: title2,
      titleI18n: i18n(title2, `${homeEn} coach post-match press conference`),
      summary: summary2,
      summaryI18n: i18n(summary2, `${homeEn}'s coach reflected on the team's performance and looked ahead to the next fixture in the post-match press conference.`),
      content: content2,
      contentI18n: i18n(content2, `${homeEn}'s coach said in the post-match press conference that the team executed the pre-match plan. While there were ups and downs, the overall performance was satisfactory. He noted areas for improvement moving forward and thanked the supporters.`),
      url: '',
      source: '球队官方',
      sourceI18n: i18n('球队官方', 'Team official'),
      publishedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      importance: 'yellow',
      type: 'coach',
      relatedTeams: [homeTeam],
      tags: ['coach', 'press conference', 'post-match'],
    });

    const title3 = `${awayZh} vs ${homeZh} 比赛数据复盘`;
    const summary3 = `本场比赛的关键数据统计显示，两队在多项指标上势均力敌。`;
    const content3 = `赛后数据统计显示：控球率接近五五开，射门次数和射正次数均相当接近。这是一场真正意义上的胶着对决，比赛的胜负往往取决于一两个关键时刻的发挥。`;
    news.push({
      id: 'mock_3',
      title: title3,
      titleI18n: i18n(title3, `${awayEn} vs ${homeEn} statistical recap`),
      summary: summary3,
      summaryI18n: i18n(summary3, `Key statistics from this match show both teams were evenly matched across several metrics.`),
      content: content3,
      contentI18n: i18n(content3, `Post-match statistics show possession was close to 50-50, with shot and on-target totals similarly tight. This was a genuinely close contest where the result often came down to one or two decisive moments.`),
      url: '',
      source: '数据分析',
      sourceI18n: i18n('数据分析', 'Data analysis'),
      publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      importance: 'green',
      type: 'tactical',
      relatedTeams: [homeTeam, awayTeam],
      tags: ['statistics', 'post-match'],
    });

    const title4 = `${homeZh} 球员赛后评分`;
    const summary4 = `各媒体对${homeZh}与${awayZh}的球员进行了赛后评分，多名球员获得了高分评价。`;
    const content4 = `赛后各大媒体对双方球员进行了评分。${homeZh}和${awayZh}的多名球员凭借出色的个人发挥收获了高分。其中关键位置的球员表现尤为抢眼，成为赛后讨论的焦点。`;
    news.push({
      id: 'mock_4',
      title: title4,
      titleI18n: i18n(title4, `${homeEn} player ratings after match`),
      summary: summary4,
      summaryI18n: i18n(summary4, `Media outlets have published player ratings for ${homeEn} vs ${awayEn}, with several players receiving high marks.`),
      content: content4,
      contentI18n: i18n(content4, `Post-match player ratings from major media outlets saw several ${homeEn} and ${awayEn} players earn high marks for standout individual displays. Players in key positions were particularly impressive and became focal points of the post-match discussion.`),
      url: '',
      source: '媒体评分',
      sourceI18n: i18n('媒体评分', 'Media ratings'),
      publishedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      importance: 'green',
      type: 'general',
      relatedTeams: [homeTeam, awayTeam],
      tags: ['ratings', 'post-match'],
    });

    const title5 = `世界杯小组赛: ${homeZh} vs ${awayZh} 历史交锋`;
    const summary5 = `两队在世界杯历史上曾多次交手，战绩不分上下。`;
    const content5 = `两队在世界杯历史上曾多次交手，战绩不分上下。本场比赛的加入使双方交锋记录更加丰富。`;
    news.push({
      id: 'mock_5',
      title: title5,
      titleI18n: i18n(title5, `World Cup group stage: ${homeEn} vs ${awayEn} head-to-head`),
      summary: summary5,
      summaryI18n: i18n(summary5, 'The two teams have met several times in World Cup history, with a fairly even record.'),
      content: content5,
      contentI18n: i18n(content5, `The two teams have met multiple times in World Cup history with a fairly even record. This match adds another chapter to their shared history.`),
      url: '',
      source: '历史数据',
      sourceI18n: i18n('历史数据', 'Historical data'),
      publishedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      importance: 'green',
      type: 'history',
      relatedTeams: [homeTeam, awayTeam],
      tags: ['history', 'record'],
    });

  } else {
    // === Pre-match mock news (match hasn't started yet) ===
    const title = `${homeZh} vs ${awayZh} 赛前分析`;
    const summary = `两队将在世界杯小组赛中交锋，${homeZh}希望在主场取得好成绩。`;
    const content = `两队将在世界杯小组赛中交锋，${homeZh}希望在主场取得好成绩。${awayZh}也不会轻易放弃，这将是一场激烈的比赛。`;
    news.push({
      id: 'mock_1',
      title,
      titleI18n: i18n(title, `${homeEn} vs ${awayEn} pre-match analysis`),
      summary,
      summaryI18n: i18n(summary, `${homeEn} and ${awayEn} meet in the World Cup group stage, with ${homeEn} looking for a strong home result.`),
      content,
      contentI18n: i18n(content, `${homeEn} and ${awayEn} meet in the World Cup group stage. ${homeEn} will want a strong home result, while ${awayEn} will not give anything away easily.`),
      url: '',
      source: '世界杯分析',
      sourceI18n: i18n('世界杯分析', 'World Cup analysis'),
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      importance: 'yellow',
      type: 'preview',
      relatedTeams: [homeTeam, awayTeam],
      tags: ['preview', 'analysis'],
    });

    const title2 = `${homeZh} 主教练赛前新闻发布会`;
    const summary2 = `${homeZh}主教练表示球队已经做好了充分准备，对比赛充满信心。`;
    const content2 = `${homeZh}主教练在赛前新闻发布会上表示，球队已经做好了充分准备，对比赛充满信心。他强调了团队合作的重要性，并对球员们的状态表示满意。`;
    news.push({
      id: 'mock_2',
      title: title2,
      titleI18n: i18n(title2, `${homeEn} coach pre-match press conference`),
      summary: summary2,
      summaryI18n: i18n(summary2, `${homeEn}'s coach said the team is well prepared and confident before the match.`),
      content: content2,
      contentI18n: i18n(content2, `${homeEn}'s coach said in the pre-match press conference that the team is well prepared and confident. He emphasized teamwork and was pleased with the players' condition.`),
      url: '',
      source: '球队官方',
      sourceI18n: i18n('球队官方', 'Team official'),
      publishedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      importance: 'yellow',
      type: 'coach',
      relatedTeams: [homeTeam],
      tags: ['coach', 'press conference'],
    });

    const title3 = `${awayZh} 伤病情况更新`;
    const summary3 = `${awayZh}有一名主力球员因伤可能缺席比赛。`;
    const content3 = `${awayZh}有一名主力球员在训练中受伤，目前还不确定能否参加比赛。球队医疗团队正在评估其伤势。`;
    news.push({
      id: 'mock_3',
      title: title3,
      titleI18n: i18n(title3, `${awayEn} injury update`),
      summary: summary3,
      summaryI18n: i18n(summary3, `${awayEn} may be without a key player because of injury.`),
      content: content3,
      contentI18n: i18n(content3, `A key ${awayEn} player was injured in training and remains uncertain for the match while the medical staff evaluates the issue.`),
      url: '',
      source: '伤病报告',
      sourceI18n: i18n('伤病报告', 'Injury report'),
      publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      importance: 'red',
      type: 'injury',
      relatedTeams: [awayTeam],
      tags: ['injury', 'doubtful'],
    });

    const title4 = `世界杯小组赛: ${homeZh} vs ${awayZh} 历史交锋`;
    const summary4 = `两队在世界杯历史上曾多次交手，战绩不分上下。`;
    const content4 = `两队在世界杯历史上曾多次交手，战绩不分上下。这将是他们在世界杯上的又一次对决，球迷们期待一场精彩的比赛。`;
    news.push({
      id: 'mock_4',
      title: title4,
      titleI18n: i18n(title4, `World Cup group stage: ${homeEn} vs ${awayEn} head-to-head`),
      summary: summary4,
      summaryI18n: i18n(summary4, 'The two teams have met several times in World Cup history, with a fairly even record.'),
      content: content4,
      contentI18n: i18n(content4, `The two teams have met several times in World Cup history with a fairly even record. This will be another World Cup meeting that supporters expect to be compelling.`),
      url: '',
      source: '历史数据',
      sourceI18n: i18n('历史数据', 'Historical data'),
      publishedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      importance: 'green',
      type: 'history',
      relatedTeams: [homeTeam, awayTeam],
      tags: ['history', 'record'],
    });

    const title5 = `${homeZh} 球迷热情高涨`;
    const summary5 = `${homeZh}球迷对即将到来的比赛充满期待，主场气氛热烈。`;
    const content5 = `${homeZh}球迷对即将到来的比赛充满期待，主场气氛热烈。球迷们纷纷购买门票，准备为球队加油助威。`;
    news.push({
      id: 'mock_5',
      title: title5,
      titleI18n: i18n(title5, `${homeEn} supporters build excitement`),
      summary: summary5,
      summaryI18n: i18n(summary5, `${homeEn} supporters are looking forward to the match, creating a lively home atmosphere.`),
      content: content5,
      contentI18n: i18n(content5, `${homeEn} supporters are looking forward to the match and creating a lively home atmosphere, with many preparing to back the team in person.`),
      url: '',
      source: '球迷动态',
      sourceI18n: i18n('球迷动态', 'Fan mood'),
      publishedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(),
      importance: 'green',
      type: 'general',
      relatedTeams: [homeTeam],
      tags: ['fans', 'atmosphere'],
    });
  }

  return news;
}

function buildH2HFromESPN(matchId, espn) {
  return espn(`/summary?event=${matchId}`, `m_${matchId}`, 300000)
    .then((d) => {
      const h2hGames = d?.headToHeadGames || [];
      if (!h2hGames.length) return null;

      const games = [];
      for (const team of h2hGames) {
        for (const ev of (team.events || [])) {
          games.push({
            date: ev.gameDate,
            homeTeam: ev.homeTeamId,
            awayTeam: ev.awayTeamId,
            score: ev.score,
            competition: ev.competitionName,
            result: ev.gameResult,
          });
        }
      }

      return {
        dataQuality: 'live',
        source: 'ESPN',
        totalGames: games.length,
        games,
      };
    })
    .catch(() => null);
}

function buildDeterministicH2H(homeTeam, awayTeam, homeId, awayId, matchDate) {
  const seed = `${homeId || homeTeam}:${awayId || awayTeam}:${matchDate || ''}`;
  const totalMatches = seededInt(`${seed}:total`, 8, 14);
  const homeWins = Math.min(
    totalMatches,
    Math.round(totalMatches * (0.3 + seededFloat(`${seed}:home`) * 0.2))
  );
  const draws = Math.min(
    totalMatches - homeWins,
    Math.round((totalMatches - homeWins) * (0.2 + seededFloat(`${seed}:draw`) * 0.2))
  );
  const awayWins = Math.max(0, totalMatches - homeWins - draws);

  const recentMatches = [];
  const years = [2024, 2023, 2022, 2021, 2020];
  for (let i = 0; i < Math.min(5, totalMatches); i++) {
    const year = years[i] || 2020;
    const month = seededInt(`${seed}:month:${i}`, 1, 12);
    const day = seededInt(`${seed}:day:${i}`, 1, 28);
    const homeScore = seededInt(`${seed}:homeScore:${i}`, 0, 3);
    const awayScore = seededInt(`${seed}:awayScore:${i}`, 0, 3);
    const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : '平局';

    recentMatches.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      competition: i === 0 ? '世界杯' : i === 1 ? '美洲杯' : '国际友谊赛',
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      result: winner === homeTeam ? '主胜' : winner === awayTeam ? '客胜' : '平局',
      venue: i % 2 === 0 ? '主场' : '客场',
    });
  }

  const totalGoals = recentMatches.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0);
  const avgGoals = recentMatches.length > 0 ? (totalGoals / recentMatches.length).toFixed(1) : '0.0';
  const homeCleanSheets = recentMatches.filter(m => m.awayScore === 0).length;
  const awayCleanSheets = recentMatches.filter(m => m.homeScore === 0).length;

  let biggestHomeWin = { score: '0-0', date: '' };
  let biggestAwayWin = { score: '0-0', date: '' };
  for (const m of recentMatches) {
    if (m.homeScore > m.awayScore) {
      const diff = m.homeScore - m.awayScore;
      const biggestDiff = parseInt(biggestHomeWin.score.split('-')[0], 10) - parseInt(biggestHomeWin.score.split('-')[1], 10);
      if (diff > biggestDiff) biggestHomeWin = { score: `${m.homeScore}-${m.awayScore}`, date: m.date };
    }
    if (m.awayScore > m.homeScore) {
      const diff = m.awayScore - m.homeScore;
      const biggestDiff = parseInt(biggestAwayWin.score.split('-')[1], 10) - parseInt(biggestAwayWin.score.split('-')[0], 10);
      if (diff > biggestDiff) biggestAwayWin = { score: `${m.homeScore}-${m.awayScore}`, date: m.date };
    }
  }

  return {
    dataQuality: 'estimated',
    source: 'deterministic-mock',
    totalMatches,
    homeWins,
    draws,
    awayWins,
    recentMatches,
    stats: {
      totalGoals,
      avgGoals,
      homeCleanSheets,
      awayCleanSheets,
      biggestHomeWin,
      biggestAwayWin,
    },
  };
}

async function findMatchContext(matchId, espn) {
  try {
    const summary = await espn(`/summary?event=${matchId}`, `news_match_${matchId}`, 120000);
    const competition = summary?.header?.competitions?.[0];
    const homeComp = competition?.competitors?.find(c => c.homeAway === 'home');
    const awayComp = competition?.competitors?.find(c => c.homeAway === 'away');
    if (homeComp?.team && awayComp?.team) {
      return {
        homeTeam: homeComp.team.displayName || '',
        awayTeam: awayComp.team.displayName || '',
        homeId: homeComp.team.id || '',
        awayId: awayComp.team.id || '',
        matchDate: competition.date || summary.header?.date || '',
        matchStatus: competition.status?.type?.name || competition.status?.type?.state || 'pre',
        homeScore: homeComp.score?.value ?? null,
        awayScore: awayComp.score?.value ?? null,
        venue: competition.venue?.fullName || null,
        weatherCondition: competition.weather?.condition || null,
        temperature: competition.weather?.temperature?.fahrenheit || null,
      };
    }
  } catch {}

  const sb = await espn('/scoreboard', 'scores', 60000);
  for (const ev of (sb?.events || [])) {
    if (ev.id === matchId) {
      const homeComp = ev.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home');
      const awayComp = ev.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away');
      return {
        homeTeam: homeComp?.team?.displayName || '',
        awayTeam: awayComp?.team?.displayName || '',
        homeId: homeComp?.team?.id || '',
        awayId: awayComp?.team?.id || '',
        matchDate: ev.date || '',
        matchStatus: ev.status?.type?.name || ev.competitions?.[0]?.status?.type?.name || 'pre',
        homeScore: homeComp?.score?.value ?? null,
        awayScore: awayComp?.score?.value ?? null,
        venue: ev.competitions?.[0]?.venue?.fullName || null,
        weatherCondition: ev.competitions?.[0]?.weather?.condition || null,
        temperature: ev.competitions?.[0]?.weather?.temperature?.fahrenheit || null,
      };
    }
  }
  return null;
}

/**
 * Context-aware news search query builder (P2-5)
 * @param {object} ctx - from findMatchContext
 * @param {object} opts - { isFinished, getElo, getStyle, getQualification }
 * @returns {string[]} search queries
 */
function buildContextAwareSearchTerms(ctx, opts = {}) {
  const { homeTeam, awayTeam, venue, weatherCondition, temperature } = ctx || {};
  const { isFinished, getElo, getStyle, getQualification } = opts;

  if (!homeTeam || !awayTeam) return [];

  const base = isFinished
    ? [
        `${homeTeam} ${awayTeam} result highlights`,
        `${homeTeam} ${awayTeam} match analysis`,
        `${homeTeam} post-match reaction`,
        `${awayTeam} post-match reaction`,
        `${homeTeam} ${awayTeam} recap`,
      ]
    : [
        `${homeTeam} vs ${awayTeam} preview`,
        `${homeTeam} team news`,
        `${awayTeam} team news`,
        `${homeTeam} injury update`,
        `${awayTeam} injury update`,
      ];

  const extra = [];

  // Focus on upset/favorite when Elo difference > 100
  if (typeof getElo === 'function') {
    try {
      const eloHome = getElo(ctx.homeId) || 1500;
      const eloAway = getElo(ctx.awayId) || 1500;
      const diff = eloHome - eloAway;
      if (Math.abs(diff) > 100) {
        const favorite = diff > 0 ? homeTeam : awayTeam;
        const underdog = diff > 0 ? awayTeam : homeTeam;
        extra.push(`${favorite} vs ${underdog} upset chance`);
        extra.push(`${underdog} underdog tactics`);
      }
    } catch (e) {}
  }

  // Tactical style clash (attack vs defense)
  if (typeof getStyle === 'function') {
    try {
      const homeStyle = getStyle(ctx.homeId);
      const awayStyle = getStyle(ctx.awayId);
      const attackStyles = ['attacking', 'counter-attack', 'possession'];
      const defendStyles = ['defensive', 'park-the-bus', 'low-block'];
      if (attackStyles.includes(homeStyle) && defendStyles.includes(awayStyle)) {
        extra.push(`${homeTeam} breaking low block`);
        extra.push(`${awayTeam} defensive tactics`);
      } else if (attackStyles.includes(awayStyle) && defendStyles.includes(homeStyle)) {
        extra.push(`${awayTeam} counter attack threat`);
        extra.push(`${homeTeam} defensive setup`);
      }
    } catch (e) {}
  }

  // Extreme weather / altitude
  if (weatherCondition) {
    const w = weatherCondition.toLowerCase();
    if (w.includes('rain') || w.includes('snow') || w.includes('hot') || w.includes('cold')) {
      extra.push(`${homeTeam} ${awayTeam} weather impact`);
    }
  }
  if (temperature && temperature > 90) {
    extra.push('heat stress FIFA World Cup');
  }

  // Qualification scenarios (knockout)
  if (typeof getQualification === 'function') {
    try {
      const q = getQualification(ctx.homeId, ctx.awayId);
      if (q?.stage === 'knockout') {
        extra.push(`${homeTeam} ${awayTeam} must win`);
        extra.push(`${homeTeam} ${awayTeam} qualification scenario`);
      }
    } catch (e) {}
  }

  // Deduplicate and cap at 8 queries
  const all = [...base, ...extra];
  const unique = [];
  const seen = new Set();
  for (const q of all) {
    const norm = q.toLowerCase().trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(q);
    }
  }
  return unique.slice(0, 8);
}


const { translateNewsItems, translateSearchResult } = require('../translate');

module.exports = function createNewsRoutes(deps) {
  const { espn, getTeamNameI18n, teamNamesZh, loader } = deps;

  return {
    'GET /api/match/:id/news': async (params) => {
      let ctx = await findMatchContext(params.id, espn).catch(() => null);
      if ((!ctx?.homeTeam || !ctx?.awayTeam) && loader && typeof loader.getSchedule === 'function') {
        const scheduled = (loader.getSchedule().matches || []).find(m => String(m.matchId || m.id) === String(params.id));
        if (scheduled) {
          const home = scheduled.teams?.home || {};
          const away = scheduled.teams?.away || {};
          ctx = {
            homeTeam: home.nameI18n?.en || home.fullName || home.name || '',
            awayTeam: away.nameI18n?.en || away.fullName || away.name || '',
            homeId: home.id || '',
            awayId: away.id || '',
            matchDate: scheduled.kickoffUtc || scheduled.date || '',
            matchStatus: scheduled.state === 'post' || scheduled.sClass === 'finished' ? 'STATUS_FINAL' : 'pre',
          };
        }
      }
      if (!ctx?.homeTeam || !ctx?.awayTeam) {
        return { error: 'Match not found', matchId: params.id };
      }

      const matchStatus = String(ctx.matchStatus || '').toUpperCase();
      const isFinished = matchStatus === 'POST' || /FINAL|FULL_TIME|FINISHED/.test(matchStatus);

      // P2-5: Context-aware search terms (Elo diff / tactical style / weather / qualification)
      const queries = buildContextAwareSearchTerms(ctx, {
        isFinished,
        getElo: deps.getElo || null,
        getStyle: deps.getTeamStyle || null,
        getQualification: deps.getQualificationForMatch || null,
      });
      const searchTermsUsed = [...queries]; // Retain search queries for debugging
      const homeNameI18n = getTeamNameI18n ? getTeamNameI18n(ctx.homeId, ctx.homeTeam) : { zh: ctx.homeTeam, en: ctx.homeTeam };
      const awayNameI18n = getTeamNameI18n ? getTeamNameI18n(ctx.awayId, ctx.awayTeam) : { zh: ctx.awayTeam, en: ctx.awayTeam };

      const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
      let newsItems = [];
      let source = 'empty';
      let emptyReason = TAVILY_API_KEY ? 'no_results' : 'missing_tavily_key';

      if (TAVILY_API_KEY) {
        const seen = new Set();
        for (const query of queries) {
          try {
            const response = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 5,
                exclude_domains: BETTING_DOMAINS,
              }),
            });

            if (!response.ok) {
              emptyReason = `tavily_http_${response.status}`;
              continue;
            }

            const tavilyData = await response.json();
            for (const result of (tavilyData.results || [])) {
              const title = result.title || '';
              const content = result.content || '';
              const url = result.url || '';
              if (!title && !content) continue;
              if (looksLikeBetting(title, content, url)) continue;
              const dedupeKey = url || title.toLowerCase().replace(/\s+/g, ' ').trim();
              if (seen.has(dedupeKey)) continue;
              seen.add(dedupeKey);
              newsItems.push({
                id: makeId('news', `${params.id}:${newsItems.length}`),
                title,
                summary: content ? `${content.substring(0, 200)}...` : '',
                content,
                url,
                source: safeHostname(url),
                publishedAt: result.published_date || new Date().toISOString(),
                importance: analyzeNewsImportance(title, content),
                type: classifyNewsType(title, content),
                relatedTeams: [ctx.homeTeam, ctx.awayTeam],
                tags: extractTags(title, content),
              });
            }
          } catch (e) {
            emptyReason = 'tavily_error';
            logger.error('Tavily API error:', { error: e.message });
          }
        }
      }

      if (newsItems.length > 0) {
        source = 'tavily';
        // Translate Tavily news (adds titleI18n / summaryI18n / contentI18n / sourceI18n)
        const useLLM = !!(process.env.TRANSLATE_API_URL && process.env.TRANSLATE_API_KEY);
        newsItems = await translateNewsItems(newsItems, { teamNamesZh, homeI18n: homeNameI18n, awayI18n: awayNameI18n, useLLM });
      } else {
        newsItems = generateMockNews(
          ctx.homeTeam,
          ctx.awayTeam,
          ctx.matchDate,
          homeNameI18n,
          awayNameI18n,
          ctx.matchStatus,
        );
        source = 'generated-summary';
      }

      const importanceOrder = { red: 0, yellow: 1, green: 2 };
      newsItems.sort((a, b) => (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2));

      return {
        matchId: params.id,
        homeTeam: ctx.homeTeam,
        awayTeam: ctx.awayTeam,
        homeNameI18n,
        awayNameI18n,
        news: newsItems,
        total: newsItems.length,
        lastUpdated: new Date().toISOString(),
        source,
        searchTermsUsed,               // P2-5: Debug observability
        emptyReason: newsItems.length === 0 ? emptyReason : null,
      };
    },

    'GET /api/news/search': async (params) => {
      const query = params.query || '';
      if (!query) return { error: 'Query parameter required' };

      const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
      let results = [];
      let source = 'empty';

      if (TAVILY_API_KEY) {
        try {
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: TAVILY_API_KEY,
              query,
              search_depth: 'basic',
              include_answer: true,
              max_results: 20,
              exclude_domains: BETTING_DOMAINS,
            }),
          });

          if (response.ok) {
            const tavilyData = await response.json();
            source = 'tavily';
            for (const result of (tavilyData.results || [])) {
              const title = result.title || '';
              const content = result.content || '';
              if (looksLikeBetting(title, content, result.url)) continue;
              results.push({
                id: makeId('search', `${query}:${results.length}`),
                title,
                summary: content ? `${content.substring(0, 200)}...` : '',
                content,
                url: result.url || '',
                source: safeHostname(result.url),
                publishedAt: result.published_date || new Date().toISOString(),
                importance: analyzeNewsImportance(title, content),
                type: classifyNewsType(title, content),
                tags: extractTags(title, content),
              });
            }
          }
        } catch (e) {
          console.log('Tavily API error:', e.message);
        }
      }

      // Translate search results (adds i18n fields)
      if (results.length > 0) {
        const useLLM = !!(process.env.TRANSLATE_API_URL && process.env.TRANSLATE_API_KEY);
        const translated = [];
        for (const item of results) {
          translated.push(await translateSearchResult(item, { teamNamesZh, useLLM }));
        }
        results = translated;
      }

      return {
        query,
        results,
        total: results.length,
        source,
      };
    },

    'GET /api/match/:id/head-to-head': async (params) => {
      const ctx = await findMatchContext(params.id, espn).catch(() => null);
      if (!ctx?.homeTeam || !ctx?.awayTeam) {
        return { error: 'Match not found', matchId: params.id };
      }

      const live = await buildH2HFromESPN(params.id, espn);
      if (live) {
        return {
          matchId: params.id,
          homeTeam: ctx.homeTeam,
          awayTeam: ctx.awayTeam,
          homeId: ctx.homeId,
          awayId: ctx.awayId,
          ...live,
        };
      }

      // Try CSV fallback
      let csvGames = [];
      let dataQuality = 'unavailable';
      let source = null;
      
      try {
        if (loader && typeof loader.getH2HMatches === 'function') {
          const csvMatches = loader.getH2HMatches(ctx.homeTeam, ctx.awayTeam);
          csvGames = csvMatches.map(m => ({
            date: m.date || `${m.year}`,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            homeTeamName: m.homeTeam,
            awayTeamName: m.awayTeam,
            score: m.score,
            competition: m.competition || 'World Cup',
            result: m.homeGoals > m.awayGoals ? 'homeWin' : m.homeGoals < m.awayGoals ? 'awayWin' : 'draw',
            year: m.year,
            stage: m.stage,
            source: 'csv',
          }));
          
          if (csvGames.length > 0) {
            dataQuality = 'historical';
            source = 'CSV';
          }
        }
      } catch (e) {
        logger.warn('[H2H] CSV lookup failed in news.js:', { error: e.message });
      }
      
      // Build stats from CSV games
      let totalMatches = csvGames.length;
      let homeWins = 0, awayWins = 0, draws = 0;
      for (const g of csvGames) {
        const [hs, as] = (g.score || '0-0').split('-').map(Number);
        if (hs === as) { draws++; continue; }
        const winnerId = hs > as ? g.homeTeam : g.awayTeam;
        if (winnerId === ctx.homeTeam) homeWins++;
        else if (winnerId === ctx.awayTeam) awayWins++;
        else if (hs > as) homeWins++;
        else awayWins++;
      }
      
      const recentMatches = csvGames.slice(0, 5).map(m => {
        const [hs, as] = (m.score || '0-0').split('-').map(Number);
        return {
          date: m.date,
          competition: m.competition || '',
          homeScore: hs,
          awayScore: as,
          result: hs > as ? '主胜' : hs < as ? '客胜' : '平局',
          venue: '',
        };
      });
      
      const totalGoals = csvGames.reduce((sum, m) => {
        const [hs, as] = (m.score || '0-0').split('-').map(Number);
        return sum + hs + as;
      }, 0);
      const avgGoals = csvGames.length > 0 ? (totalGoals / csvGames.length).toFixed(1) : '0.0';
      
      return {
        matchId: params.id,
        homeTeam: ctx.homeTeam,
        awayTeam: ctx.awayTeam,
        homeId: ctx.homeId,
        awayId: ctx.awayId,
        dataQuality,
        source,
        totalMatches,
        homeWins,
        draws,
        awayWins,
        recentMatches,
        stats: {
          totalGoals,
          avgGoals,
          homeCleanSheets: 0,
          awayCleanSheets: 0,
          biggestHomeWin: { score: '0-0', date: '' },
          biggestAwayWin: { score: '0-0', date: '' },
        },
      };
    },
  };
};
