/**
 * Match Renderers — Shared Utilities
 *
 * Common helpers used across all match renderer modules.
 * Must be loaded BEFORE other mr-*.js modules.
 */

window.WorldCup = window.WorldCup || {};
window.WorldCup.MatchRenderers = window.WorldCup.MatchRenderers || {};

(() => {
    const { Formatters, ApiClient, State, Utils } = window.WorldCup;

    const getLang = () => State.uiLang || 'zh';

    // Translation helper

    const tx = (zh, en) => Utils.tx(zh, en);

    // Escape HTML

    const esc = (value) => Utils.esc(value);

    // Attribute escape (same as esc)

    const attr = (value) => esc(value);

    // i18nText helper (simplified)

    const i18nText = (value, fallback = '') => {
        if (value && typeof value === 'object' && (value.zh || value.en)) {
            return getLang() === 'en' ? (value.en || value.zh || fallback) : (value.zh || value.en || fallback);
        }
        return value || fallback;
    };

    // Formation positions mapping (will be populated later)

    const FORMATION_POSITIONS = {};

    /**
     * Generic formation-coordinate template (mirrors backend calcFormationCoords; ensures "backend y is already in this order").
     * Interleaved order: home GK(y6)→DEF(y22)→MID(y45)→FWD(y74);
     *         away mirror GK(y94)→DEF(y78)→MID(y55)→FWD(y26)
     * At render time cy = y * 1.6, no flip, laid out top-to-bottom naturally:
     *   blue GK → blue DEF → red FWD → blue MID → red MID → blue FWD → red DEF → red GK
     *
     * @param {string} formation e.g. '4-3-3' / '4-2-3-1' / '3-5-2'
     * @param {'home'|'away'} side
     * @returns {Array<{x,y,pos,line}>} 11 player coordinates (GK→DEF→MID→FWD order)
     */

    const teamLabel = (teamObj) => {
        if (!teamObj) return tx('未知球队', 'Unknown Team');
        // Try i18n name first
        const i18n = teamObj.nameI18n;
        if (i18n && (i18n.zh || i18n.en)) {
            return getLang() === 'en' ? (i18n.en || i18n.zh || '') : (i18n.zh || i18n.en || '');
        }
        // Bilingual string: split and pick correct language
        const raw = teamObj.team || teamObj.name || teamObj.shortName || teamObj.teamName || '';
        if (raw) {
            const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
            if (bilingual) return getLang() === 'en' ? bilingual[2].trim() : bilingual[1].trim();
            return raw;
        }
        // Extended fallback: fullName, displayName, label, or id
        const alt = teamObj.fullName || teamObj.displayName || teamObj.label || teamObj.id || '';
        if (alt) return alt;
        return tx('未知球队', 'Unknown Team');
    };

    // Flag helper: show flag emoji, or fallback to team initial avatar

    const teamFlagHtml = (teamObj, bgClass) => {
        const flag = teamObj && teamObj.flag;
        if (flag && flag !== '🏳️' && flag !== '') {
            return `<span class="text-lg shrink-0">${esc(flag)}</span>`;
        }
        // Fallback: circular avatar with first letter of team name
        const name = teamLabel(teamObj);
        const initial = name ? name.charAt(0).toUpperCase() : '?';
        return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${bgClass} text-white text-xs font-bold shrink-0">${esc(initial)}</span>`;
    };

    // Safe helper: get player coordinates with fallback chain

    const playerCoords = (p) => ({
        x: p.x ?? p.coords?.x ?? 50,
        y: p.y ?? p.coords?.y ?? 50,
    });

    // ─── Mock data for testing (Task 4) ───

    const translatePlayerName = (name, nameZh) => Utils.translatePlayerName ? Utils.translatePlayerName(name, nameZh) : (nameZh || name);

    // renderBenchAnalysis function

    // Export shared utilities
    window.WorldCup.MatchRenderers._shared = {
        getLang, tx, esc, attr, i18nText,
        FORMATION_POSITIONS,
        teamLabel, teamFlagHtml, playerCoords,
        translatePlayerName,
    };
})();
