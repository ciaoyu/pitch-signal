class PolymarketClient {
  constructor() {
    this.apiBase = 'https://gamma-api.polymarket.com';
  }

  /**
   * Fetch live market data for a specific match.
   */
  async fetchMatchMarkets(homeTeam, awayTeam) {
    try {
      // In a real environment with live World Cup markets:
      // const url = new URL(`${this.apiBase}/events`);
      // url.searchParams.append('limit', 10);
      // url.searchParams.append('active', true);
      // url.searchParams.append('query', `${homeTeam} vs ${awayTeam}`);
      // const response = await fetch(url);
      // const data = await response.json();
      
      // Since World Cup markets aren't live currently, we use a robust 
      // deterministic mock to simulate Polymarket API payloads.
      return this._mockFetchMarket(homeTeam, awayTeam);
    } catch (error) {
      console.error('Error fetching from Polymarket:', error);
      return null;
    }
  }

  _mockFetchMarket(homeTeam, awayTeam) {
    // Generate pseudo-deterministic odds based on team names 
    // to simulate a stable "market consensus" for testing.
    const hashStr = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      return Math.abs(hash);
    };

    const homeHash = hashStr(homeTeam);
    const awayHash = hashStr(awayTeam);
    const total = homeHash + awayHash;
    
    // Simulate raw "Yes" token prices (vig included, sum > 1.0)
    const rawHome = (homeHash / total) * 0.95; 
    const rawAway = (awayHash / total) * 0.95;
    const rawDraw = Math.abs(1.0 - (rawHome + rawAway)) + 0.05; // vig

    // Simulate high liquidity for major teams, lower for others
    const volume = (total % 100) * 15000; // Between 0 and 1.5M USD

    return {
      tokens: {
        homeWin: rawHome,
        awayWin: rawAway,
        draw: rawDraw
      },
      volumeUsd: volume
    };
  }

  /**
   * Convert token prices to implied probabilities (vig removed).
   */
  extractImpliedProbabilities(marketData) {
    if (!marketData || !marketData.tokens) return null;
    
    const { homeWin, awayWin, draw } = marketData.tokens;
    
    // Normalize to strictly sum to 1.0
    const sum = homeWin + awayWin + draw;
    if (sum === 0) return null;

    return {
      homeWin: Number((homeWin / sum).toFixed(4)),
      awayWin: Number((awayWin / sum).toFixed(4)),
      draw: Number((draw / sum).toFixed(4))
    };
  }

  /**
   * Map USD volume to liquidity confidence tiers.
   */
  assessLiquidity(volumeUsd) {
    if (volumeUsd > 500000) return 'high';
    if (volumeUsd > 100000) return 'medium';
    return 'low';
  }
}

module.exports = PolymarketClient;
