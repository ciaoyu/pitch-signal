'use strict';

const { db } = require('./db');
const { getSavedPostMatchReview } = require('./postMatchReview');

/**
 * Aggregates all post-match reviews for a given date or all recent matches
 * to calculate global model lessons and generate adjustment parameters.
 */
class DailyCalibrationEngine {
  constructor() {
    this.defaultAdjustments = {
      knockoutDefenseShrinkage: 0.85,
      formFactorDecayLambda: 0.00385,
      mathWeightPrior: 0.70,
    };
  }

  /**
   * Run daily calibration to adjust global model parameters.
   * In a real system, this would query recent `post_match_reviews` 
   * and parse Gemini's `globalModelLessons` strings to average out adjustments.
   * 
   * @param {string} date - The date to calibrate for (YYYY-MM-DD)
   */
  calibrate(date = new Date().toISOString().split('T')[0]) {
    // 1. Fetch completed reviews for the day (or recently)
    // Here we simulate fetching from db.
    const recentReviews = db.prepare(`
      SELECT match_id, review_json 
      FROM post_match_reviews 
      WHERE DATE(created_at) >= date('now', '-3 days')
        AND status = 'completed'
    `).all();

    let adjustments = { ...this.defaultAdjustments };
    const globalLessons = [];

    // 2. Extract global model lessons
    for (const row of recentReviews) {
      try {
        const review = JSON.parse(row.review_json);
        if (review?.aiPostmortem?.lessonsLearned?.globalModel) {
          globalLessons.push(review.aiPostmortem.lessonsLearned.globalModel);
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    // 3. Process lessons (This would normally use LLM to summarize/extract numerical tweaks)
    // For now, we mock the logic of tweaking parameters based on summarized intelligence.
    if (globalLessons.length > 0) {
      // Mocked intelligence extraction:
      // If many lessons mention "defense shrinkage should be lower", we adjust it.
      const joinedLessons = globalLessons.join(' ');
      if (joinedLessons.includes('defense shrinkage') && joinedLessons.includes('0.80')) {
        adjustments.knockoutDefenseShrinkage = 0.80;
      }
    }

    return {
      dateAnalyzed: date,
      reviewsCount: recentReviews.length,
      globalLessonsSummarized: globalLessons,
      shadowRecommendations: adjustments
    };
  }
}

module.exports = {
  DailyCalibrationEngine,
  calibrateDaily: (date) => new DailyCalibrationEngine().calibrate(date)
};
