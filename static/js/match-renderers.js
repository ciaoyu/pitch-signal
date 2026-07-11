/**
 * Match Detail Renderers — Aggregator
 *
 * Re-exports functions from split mr-*.js modules.
 * Original 2054-line file split into 8 modules (T7 refactoring).
 *
 * Load order (build-js.js handles bundling):
 *   mr-shared.js → mr-tactical.js → mr-tactical-board.js →
 *   mr-prediction.js → mr-coach.js → mr-hud.js → mr-knockout.js →
 *   match-renderers.js
 */

window.WorldCup = window.WorldCup || {};
window.WorldCup.MatchRenderers = window.WorldCup.MatchRenderers || {};

(() => {
    const MR = window.WorldCup.MatchRenderers;

    // Backward-compat alias
    if (typeof window !== 'undefined') {
        window.renderKnockoutIntel = MR.renderKnockoutIntel;
    }
})();
