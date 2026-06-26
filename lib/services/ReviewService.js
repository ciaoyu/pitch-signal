const {
  getPredictionSnapshot,
  buildPostMatchReview,
  savePostMatchReview,
  getSavedPostMatchReview,
  shouldUseSavedPostMatchReview,
} = require('../postMatchReview');
const { filterMatchEvents } = require('../eventFilter');

class ReviewService {
  constructor(deps) {
    this.deps = deps;
  }

  extractMatchContext(matchData, getTeamNameZh) {
    const comp = matchData?.header?.competitions?.[0];
    if (!comp?.competitors) return null;
    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    const status = comp.status?.type || {};

    return {
      comp,
      homeComp,
      awayComp,
      match: {
        homeId: homeComp?.team?.id,
        awayId: awayComp?.team?.id,
        homeName: getTeamNameZh(homeComp?.team?.id),
        awayName: getTeamNameZh(awayComp?.team?.id),
        homeScore: Number.parseInt(homeComp?.score || '0', 10),
        awayScore: Number.parseInt(awayComp?.score || '0', 10),
        status: status.name || '',
        completed: Boolean(status.completed || status.state === 'post' || status.name === 'STATUS_FINAL' || status.name === 'STATUS_FULL_TIME'),
        date: comp.date || matchData.header?.date || '',
        venue: comp.venue?.fullName || '',
      },
    };
  }

  extractKeyEvents(commentary) {
    if (!Array.isArray(commentary)) return null;
    return commentary.slice(0, 12).map((item) => {
      if (typeof item === 'string') return item;
      const text = item?.text || item?.description || item?.detail || '';
      if (!text) return '';
      return {
        minute: item?.time?.displayValue || item?.minute || '',
        type: item?.type || 'commentary',
        text,
        textI18n: item?.textI18n || { zh: text, en: text },
      };
    }).filter(Boolean);
  }

  extractNewsEvidence(newsPayload) {
    if (!newsPayload) return [];
    if (Array.isArray(newsPayload.news)) return newsPayload.news;
    if (Array.isArray(newsPayload.articles)) return newsPayload.articles;
    if (Array.isArray(newsPayload.items)) return newsPayload.items;
    return [];
  }

  async reviewMatch(matchId, { persist = false } = {}) {
    const { espn, getTeamNameZh, getTeamNameI18n, routes } = this.deps;

    const cachedReview = getSavedPostMatchReview(matchId);
    const matchData = await espn(`/summary?event=${matchId}`, `pmr_${matchId}`, 120000);
    const ctx = this.extractMatchContext(matchData, getTeamNameZh);
    if (!ctx) return cachedReview || { error: 'Match not found' };

    ctx.match.homeNameI18n = getTeamNameI18n ? getTeamNameI18n(ctx.match.homeId, ctx.homeComp?.team?.displayName) : null;
    ctx.match.awayNameI18n = getTeamNameI18n ? getTeamNameI18n(ctx.match.awayId, ctx.awayComp?.team?.displayName) : null;

    // Compute momentum from full ESPN commentary (not truncated 12-item extract).
    // Use ESPN display names (e.g. "Portugal") for side inference — the commentary
    // text is English, and Chinese+English names like "葡萄牙 Portugal" won't match.
    const momentumResult = filterMatchEvents(matchData.commentary || [], {
      homeName: ctx.homeComp?.team?.displayName || ctx.match.homeName,
      awayName: ctx.awayComp?.team?.displayName || ctx.match.awayName,
    });
    const momentum = {
      buckets: momentumResult.momentumBuckets,
      matchScript: momentumResult.matchScript,
      notes: momentumResult.notes,
    };
    const keyEvents = momentumResult.keyEvents || [];
    const moments = momentumResult.moments || [];

    if (shouldUseSavedPostMatchReview(cachedReview, ctx.match)) {
      const review = { ...cachedReview };
      if (!review.momentum) review.momentum = momentum;
      if (!review.keyEvents) review.keyEvents = keyEvents;
      if (!review.moments) review.moments = moments;
      return review;
    }

    const snapshot = getPredictionSnapshot(matchId);
    const commentary = this.extractKeyEvents(matchData.commentary) || [];
    let news = [];
    try {
      const newsPayload = routes['GET /api/match/:id/news']
        ? await routes['GET /api/match/:id/news']({ id: matchId })
        : null;
      news = this.extractNewsEvidence(newsPayload);
    } catch { console.warn('ReviewService: failed to fetch news evidence for', matchId); }

    const review = buildPostMatchReview({
      matchId,
      match: ctx.match,
      snapshot,
      evidence: {
        events: commentary,
        commentary,
        news,
      },
      generatedBy: 'post-match-framework',
    });
    review.momentum = momentum;
    review.keyEvents = keyEvents;
    review.moments = moments;

    if (persist && ctx.match.completed) savePostMatchReview(matchId, review);
    return review;
  }
}

module.exports = ReviewService;
