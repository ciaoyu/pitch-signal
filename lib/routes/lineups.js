/**
 * Lineups and Substitutions routes
 * Extracted from server.js to reduce main file size
 */

const lineupsSource = require('../lineups-source');

module.exports = function createLineupsRoutes(deps) {
  return {
    'GET /api/match/:id/lineups': async (params) => {
      const matchId = params.id;
      return { error: 'Lineups endpoint not yet implemented (fifa_scraper stub removed)', matchId };
    },

    'GET /api/match/:id/substitutions': async (params) => {
      const matchId = params.id;
      try {
        const result = lineupsSource.getSubstitutions(matchId);
        return result;
      } catch (e) {
        console.error('Substitutions fetch error:', e.message || e);
        return { error: 'Substitutions fetch error', matchId };
      }
    },
  };
};
