/**
 * Coach comparison route
 * Extracted from server.js to reduce main file size
 */

module.exports = function createCoachRoutes(deps) {
  const { routes } = deps;

  return {
    'GET /api/coach-compare/:teamA/:teamB': async (params) => {
      const cA = await routes['GET /api/coach/:teamId']({teamId: params.teamA});
      const cB = await routes['GET /api/coach/:teamId']({teamId: params.teamB});
      
      if (cA.error || cB.error) return { error: 'Coach data incomplete' };
      
      // Style matchup analysis
      const styleMatchup = {
        '高位逼抢+快攻': { strong_vs: '防守反击', weak_vs: '控球传控' },
        '控球+中场组织': { strong_vs: '高位逼抢', weak_vs: '防守反击' },
        '防守反击+纪律性强': { strong_vs: '控球传控', weak_vs: '高位逼抢' },
        '高压逼抢+战术多变': { strong_vs: '防守反击', weak_vs: '控球传控' },
      };
      const aAdvantage = styleMatchup[cA.style]?.strong_vs === cB.style;
      const bAdvantage = styleMatchup[cB.style]?.strong_vs === cA.style;
      
      // Rating comparison
      const tenureA = parseInt(cA.tenure) || 0;
      const tenureB = parseInt(cB.tenure) || 0;
      const winA = parseInt(cA.winRate) || 50;
      const winB = parseInt(cB.winRate) || 50;
      const adjustA = parseInt(cA.adjustment?.match(/\d+/)?.[0]) || 20;
      const adjustB = parseInt(cB.adjustment?.match(/\d+/)?.[0]) || 20;
      const styleMatchupText = aAdvantage ? `${cA.name} 风格克制 ${cB.name}` :
                        bAdvantage ? `${cB.name} 风格克制 ${cA.name}` : '风格互克，无明显优势';
      const experienceGapText = tenureA > tenureB + 2 ? `${cA.name} 经验优势明显` :
                         tenureB > tenureA + 2 ? `${cB.name} 经验优势明显` : '经验相近';
      const adjustmentEdgeText = adjustA > adjustB + 10 ? `${cA.name} 临场调整更强` :
                          adjustB > adjustA + 10 ? `${cB.name} 临场调整更强` : '临场能力相近';
      
      return {
        coachA: cA,
        coachB: cB,
        comparison: {
          styleMatchup: styleMatchupText,
          styleMatchupI18n: {
            zh: styleMatchupText,
            en: aAdvantage ? `${cA.name}'s style counters ${cB.name}` :
                bAdvantage ? `${cB.name}'s style counters ${cA.name}` : 'Styles offset each other with no clear edge',
          },
          experienceGap: experienceGapText,
          experienceGapI18n: {
            zh: experienceGapText,
            en: tenureA > tenureB + 2 ? `${cA.name} has a clear experience edge` :
                tenureB > tenureA + 2 ? `${cB.name} has a clear experience edge` : 'Similar experience level',
          },
          adjustmentEdge: adjustmentEdgeText,
          adjustmentEdgeI18n: {
            zh: adjustmentEdgeText,
            en: adjustA > adjustB + 10 ? `${cA.name} has the stronger in-game adjustment profile` :
                adjustB > adjustA + 10 ? `${cB.name} has the stronger in-game adjustment profile` : 'Similar in-game adjustment level',
          },
          overallScore: {
            [cA.name]: ((winA * 0.3) + (tenureA * 2 * 0.3) + (adjustA * 0.4)).toFixed(1),
            [cB.name]: ((winB * 0.3) + (tenureB * 2 * 0.3) + (adjustB * 0.4)).toFixed(1),
          },
        },
      };
    },
  };
};
