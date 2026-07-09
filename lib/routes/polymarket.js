const PolymarketClient = require('../polymarketClient');

/**
 * PF-7: live "World Cup Winner" title-odds card.
 *
 * Standalone, read-only display of Polymarket's real Gamma API data.
 * Does NOT feed any prediction fusion and does NOT touch any existing
 * displayed probability. Returns null gracefully when the API is
 * unavailable (never mock, never crash).
 */
module.exports = function createPolymarketRoutes() {
  const client = new PolymarketClient();

  return {
    'GET /api/world-cup-winner': async () => {
      try {
        const data = await client.fetchWorldCupWinner();
        if (!data || !data.odds || data.odds.length === 0) {
          return { source: 'polymarket-gamma', odds: null, error: 'unavailable' };
        }
        return data;
      } catch (e) {
        return { source: 'polymarket-gamma', odds: null, error: 'fetch failed' };
      }
    },
  };
};
