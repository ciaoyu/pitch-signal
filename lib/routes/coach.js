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
      
      return {
        coachA: cA,
        coachB: cB,
        comparison: {
          dataQuality: 'info_only',
          observations: [
            { label: { zh: '已知风格', en: 'Recorded style' }, home: cA.style || null, away: cB.style || null },
            { label: { zh: '常用阵型', en: 'Recorded formations' }, home: (cA.formation || []).join(' / ') || null, away: (cB.formation || []).join(' / ') || null },
            { label: { zh: '执教年限', en: 'Tenure' }, home: cA.tenure || null, away: cB.tenure || null },
            { label: { zh: '赛会履历', en: 'Tournament record' }, home: cA.bigTournament || null, away: cB.bigTournament || null },
          ],
        },
      };
    },
  };
};
