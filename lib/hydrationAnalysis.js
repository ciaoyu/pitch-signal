'use strict';

/**
 * Analyzes play-by-play events around Hydration Breaks (Cooling Breaks).
 * Hydration breaks typically occur around the 30th and 75th minute.
 */
class HydrationBreakAnalyzer {
  
  /**
   * Build the Gemini prompt context for analyzing the hydration break's tactical impact.
   * @param {Array} events - Full play-by-play event list
   * @param {Object} match - Match info { homeName, awayName }
   */
  buildAnalysisPrompt(events, match) {
    return {
      instruction: `Analyze the tactical impact of the Hydration Breaks for this match.
Assess:
1. Did the weaker team survive heavy pressure before the break and recover after?
2. Did a team change their tactical approach (e.g. substitutions, sudden press) immediately after the break?
3. What is the general impact of the break on the match flow?
Return a structured JSON with your findings.`,
      matchContext: {
        home: match.homeName,
        away: match.awayName
      },
      data: {
        allEvents: events
      },
      requiredOutputFormat: {
        "firstHalfImpact": "string",
        "secondHalfImpact": "string",
        "generalTacticalShift": "string"
      }
    };
  }
}

module.exports = new HydrationBreakAnalyzer();
