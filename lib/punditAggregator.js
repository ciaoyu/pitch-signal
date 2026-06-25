'use strict';

// Public beta: this mock aggregator must not be connected to the prediction
// pipeline. Phase 3 activation requires an out-of-sample backtest gate.

/**
 * Aggregates opinions from international football Key Opinion Leaders (KOLs)
 * and specialized media (e.g. Gary Neville, The Athletic, L'Equipe).
 */
class PunditAggregator {
  
  /**
   * Fetches and parses pundit sentiment.
   * In a real implementation, this would use a web search agent or a specialized sports news API.
   * Here we mock the behavior for architectural integration.
   */
  async getPunditSentiment(homeId, awayId) {
    // Mocked fetched opinions
    const opinions = [
      { source: "The Athletic", author: "Tactical Analyst", sentiment: "Home slight advantage, better midfield control", homeProb: 0.55 },
      { source: "Sky Sports", author: "Gary Neville", sentiment: "Away team has momentum and lethal counter-attack", awayProb: 0.60 },
      { source: "L'Equipe", author: "Editorial", sentiment: "Draw likely, both teams missing key creators", drawProb: 0.50 }
    ];

    // Compute an average implied probability from pundits
    let homeTotal = 0, drawTotal = 0, awayTotal = 0, count = 0;
    
    for (const op of opinions) {
      if (op.homeProb) { homeTotal += op.homeProb; drawTotal += (1-op.homeProb)/2; awayTotal += (1-op.homeProb)/2; count++; }
      else if (op.awayProb) { awayTotal += op.awayProb; drawTotal += (1-op.awayProb)/2; homeTotal += (1-op.awayProb)/2; count++; }
      else if (op.drawProb) { drawTotal += op.drawProb; homeTotal += (1-op.drawProb)/2; awayTotal += (1-op.drawProb)/2; count++; }
    }

    if (count === 0) return null;

    return {
      homeWin: homeTotal / count,
      draw: drawTotal / count,
      awayWin: awayTotal / count,
      rawOpinions: opinions
    };
  }
}

module.exports = new PunditAggregator();
