// AI Ask route — extracted from server.js (2026-06-26)
// Rule-engine Q&A. No external API calls.
module.exports = function createAskRoute(deps) {
  const { getPlayerRatingData, getTeamNameZh, routes } = deps;

  return {
    'POST /api/ask': async (params, body) => {
      const { question, matchId, homeId, awayId, context } = body || {};
      if (!question) return { error: 'Missing question' };
      
      // Get team data
      const homeLookup = getPlayerRatingData(homeId);
      const awayLookup = getPlayerRatingData(awayId);
      const homeData = homeLookup.team;
      const awayData = awayLookup.team;
      
      if (!homeData || !awayData) {
        return { answer: '抱歉，找不到这场比赛的球队数据。' };
      }
      
      // Simple rule-based AI (fallback when MiMo is unavailable)
      const homePlayers = Object.values(homeData.players || {});
      const awayPlayers = Object.values(awayData.players || {});
      const homeAvg = homePlayers.reduce((s, p) => s + (p.rating || 70), 0) / (homePlayers.length || 1);
      const awayAvg = awayPlayers.reduce((s, p) => s + (p.rating || 70), 0) / (awayPlayers.length || 1);
      const homeName = getTeamNameZh(homeLookup.espnId);
      const awayName = getTeamNameZh(awayLookup.espnId);
      const diff = homeAvg - awayAvg;
      
      let answer = '';
      const q = question.toLowerCase();
      
      if (q.includes('谁会赢') || q.includes('谁能赢') || q.includes('预测')) {
        if (diff > 3) {
          answer = `根据球员评分分析，${homeName}（平均 ${(homeAvg/10).toFixed(1)}）明显优于 ${awayName}（平均 ${(awayAvg/10).toFixed(1)}），预计 ${homeName} 获胜概率较大。`;
        } else if (diff < -3) {
          answer = `根据球员评分分析，${awayName}（平均 ${(awayAvg/10).toFixed(1)}）明显优于 ${homeName}（平均 ${(homeAvg/10).toFixed(1)}），预计 ${awayName} 获胜概率较大。`;
        } else {
          answer = `两队实力接近（${homeName} ${(homeAvg/10).toFixed(1)} vs ${awayName} ${(awayAvg/10).toFixed(1)}），比赛结果难以预测，可能是一场激烈的对决。`;
        }
      } else if (q.includes('关键对位') || q.includes('对位分析')) {
        // Find key matchups
        const spatialData = await (async () => {
          try {
            const handler = routes['GET /api/matchup-spatial/:home/:away'];
            return handler ? await handler({ home: String(homeId), away: String(awayId) }) : null;
          } catch { return null; }
        })();
        
        if (spatialData?.pairs) {
          const keyPairs = spatialData.pairs.filter(p => Math.abs(p.diff) >= 5).slice(0, 3);
          if (keyPairs.length) {
            answer = `关键对位分析：\n`;
            keyPairs.forEach(p => {
              const adv = p.diff > 0 ? homeName : awayName;
              answer += `• ${p.home.name}(${(p.home.rating/10).toFixed(1)}) vs ${p.away.name}(${(p.away.rating/10).toFixed(1)})，${adv} 优势 +${Math.abs(p.diff/10).toFixed(1)}\n`;
            });
          } else {
            answer = '两队各位置实力接近，没有明显的单点优势。';
          }
        } else {
          answer = '暂时无法获取详细对位数据。';
        }
      } else if (q.includes('战术') || q.includes('风格')) {
        answer = `${homeName} 采用 ${homeData.formation || '未知'} 阵型，${awayName} 采用 ${awayData.formation || '未知'} 阵型。两队阵型${homeData.formation === awayData.formation ? '相同' : '不同'}，这将影响中场争夺和进攻空间。`;
      } else {
        // Generic answer
        answer = `这是 ${homeName} 对阵 ${awayName} 的比赛。两队平均评分分别为 ${(homeAvg/10).toFixed(1)} 和 ${(awayAvg/10).toFixed(1)}。您可以询问具体问题，如"谁会赢"、"关键对位"或"战术分析"。`;
      }
      
      return { answer, matchId, homeId, awayId };
    },
  };
};
