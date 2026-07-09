class PolymarketClient {
  constructor() {
    this.apiBase = 'https://gamma-api.polymarket.com';
    // In-memory cache so we don't hammer the public Gamma API on every request.
    this._cache = {};
  }

  /**
   * Fetch LIVE "World Cup Winner" market from Polymarket's public Gamma API.
   *
   * The event `world-cup-winner` contains one "Will <Team> win the 2026 FIFA
   * World Cup?" market per team; the "Yes" outcome price is that team's
   * title-win probability. Returns a ranked list, or `null` on any failure
   * (network error, non-200, empty/unknown response). NEVER returns mock data.
   */
  async fetchWorldCupWinner() {
    const cached = this._cache.worldCup;
    if (cached && Date.now() < cached.expires) return cached.data;

    try {
      const url = `${this.apiBase}/events?slug=world-cup-winner`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { accept: 'application/json' },
      });
      clearTimeout(timer);

      if (!res.ok) return this._cacheNull();
      const events = await res.json();
      const ev = Array.isArray(events) ? events[0] : null;
      if (!ev || !Array.isArray(ev.markets)) return this._cacheNull();

      const odds = this._parseWorldCupMarkets(ev.markets);
      const data = {
        eventTitle: ev.title,
        source: 'polymarket-gamma',
        odds,
        fetchedAt: new Date().toISOString(),
      };
      // Cache success for 5 minutes.
      this._cache.worldCup = { data, expires: Date.now() + 5 * 60 * 1000 };
      return data;
    } catch (e) {
      // Network/timeout/parse failure -> graceful null, never mock.
      return this._cacheNull();
    }
  }

  _parseWorldCupMarkets(markets) {
    const TEAM_RE = /Will\s+(.+?)\s+win the 2026 FIFA World Cup\?/i;
    const out = [];
    for (const m of markets) {
      const q = m.question || '';
      const mm = q.match(TEAM_RE);
      if (!mm) continue;
      const team = mm[1].trim();

      let prices = m.outcomePrices;
      if (typeof prices === 'string') {
        try { prices = JSON.parse(prices); } catch { continue; }
      }
      if (!Array.isArray(prices) || prices.length < 2) continue;

      const prob = parseFloat(prices[0]); // "Yes" outcome = title-win probability
      if (isNaN(prob)) continue;

      out.push({
        team,
        probability: Number((prob * 100).toFixed(2)),
        volumeUsd: Number(m.volumeNum) || 0,
        liquidity: Number(m.liquidityNum) || 0,
      });
    }
    out.sort((a, b) => b.probability - a.probability);
    return out;
  }

  // Cache a null result briefly (60s) so a failing/empty API isn't retried
  // on every single request, but recovers quickly once data returns.
  _cacheNull() {
    this._cache.worldCup = { data: null, expires: Date.now() + 60 * 1000 };
    return null;
  }

  /**
   * Legacy single-match market fetch (kept for the gated prediction path).
   * Currently disabled: World Cup per-match markets are not live, so this
   * returns a deterministic mock. Used only behind POLYMARKET_ENABLED gate
   * in prediction.js, which is forced off during public Beta.
   */
  async fetchMatchMarkets(homeTeam, awayTeam) {
    return this._mockFetchMarket(homeTeam, awayTeam);
  }

  _mockFetchMarket(homeTeam, awayTeam) {
    const hashStr = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      return Math.abs(hash);
    };

    const homeHash = hashStr(homeTeam);
    const awayHash = hashStr(awayTeam);
    const total = homeHash + awayHash;

    const rawHome = (homeHash / total) * 0.95;
    const rawAway = (awayHash / total) * 0.95;
    const rawDraw = Math.abs(1.0 - (rawHome + rawAway)) + 0.05;

    const volume = (total % 100) * 15000;

    return {
      tokens: { homeWin: rawHome, awayWin: rawAway, draw: rawDraw },
      volumeUsd: volume,
    };
  }

  extractImpliedProbabilities(marketData) {
    if (!marketData || !marketData.tokens) return null;
    const { homeWin, awayWin, draw } = marketData.tokens;
    const sum = homeWin + awayWin + draw;
    if (sum === 0) return null;
    return {
      homeWin: Number((homeWin / sum).toFixed(4)),
      awayWin: Number((awayWin / sum).toFixed(4)),
      draw: Number((draw / sum).toFixed(4)),
    };
  }

  assessLiquidity(volumeUsd) {
    if (volumeUsd > 500000) return 'high';
    if (volumeUsd > 100000) return 'medium';
    return 'low';
  }
}

module.exports = PolymarketClient;
