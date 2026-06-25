/**
 * Shared Formatters & Helpers for PitchSignal
 * 
 * Consolidates repeated formatting patterns to prevent:
 *   - NaN% display
 *   - undefined / [object Object] rendering
 *   - Inconsistent i18n handling
 * 
 * Usage:
 *   <script src="/static/js/formatters.js"></script>
 *   <script src="/static/js/api-client.js"></script>
 *   <script src="/static/js/app.js"></script>
 */

const Fmt = (() => {
    // ========== Safe Number Parsing ==========

    /**
     * Parse a value to a finite number, return fallback if NaN/undefined/null.
     * @param {*} value
     * @param {number} [fallback=0]
     * @returns {number}
     */
    function safeNum(value, fallback = 0) {
        if (value === null || value === undefined || value === '') return fallback;
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    /**
     * Parse a value to a finite integer, return fallback if not.
     */
    function safeInt(value, fallback = 0) {
        return Math.round(safeNum(value, fallback));
    }

    // ========== Percentage & Probability Formatting ==========

    /**
     * Format a 0-1 probability as a percentage string (e.g., 0.543 → "54%").
     * Returns fallback for null/undefined/NaN.
     * @param {*} prob - value between 0 and 1
     * @param {string} [fallback='-']
     * @returns {string}
     */
    function pct(prob, fallback = '-') {
        const n = safeNum(prob, null);
        if (n === null) return fallback;
        return Math.round(n * 100) + '%';
    }

    /**
     * Format a number that's already a percentage (e.g., 54.3 → "54%").
     * Returns fallback for null/undefined/NaN.
     */
    function rawPct(value, fallback = '-') {
        const n = safeNum(value, null);
        if (n === null) return fallback;
        return Math.round(n) + '%';
    }

    /**
     * Format a probability with decimal precision (e.g., 0.543 → "54.3%").
     */
    function pctPrecise(prob, decimals = 1, fallback = '-') {
        const n = safeNum(prob, null);
        if (n === null) return fallback;
        return (n * 100).toFixed(decimals) + '%';
    }

    /**
     * Format a probability for display in a bar (returns number 0-100 for CSS width).
     * Returns 0 for invalid input.
     */
    function pctBar(prob) {
        const n = safeNum(prob, 0);
        return Math.min(100, Math.max(0, Math.round(n * 100)));
    }

    // ========== Score & Match Formatting ==========

    /**
     * Format a score safely (e.g., "2-1" → "2-1", null → "0-0").
     */
    function score(home, away) {
        const h = safeInt(home, 0);
        const a = safeInt(away, 0);
        return `${h}-${a}`;
    }

    /**
     * Format match result badge text.
     */
    function resultBadge(result, lang = 'zh') {
        if (result === 'W') return lang === 'zh' ? '胜' : 'W';
        if (result === 'D') return lang === 'zh' ? '平' : 'D';
        if (result === 'L') return lang === 'zh' ? '负' : 'L';
        return '-';
    }

    // ========== Team Name Display ==========

    /**
     * Display team name based on language.
     * Handles bilingual names like "沙特阿拉伯 Saudi Arabia".
     * @param {string} name
     * @param {string} [lang] - defaults to uiLang global
     * @returns {string}
     */
    function teamName(name, lang) {
        const ui = lang || (typeof uiLang !== 'undefined' ? uiLang : 'zh');
        const raw = String(name || '').trim();
        const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
        if (!bilingual) return raw;
        return ui === 'en' ? bilingual[2].trim() : bilingual[1].trim();
    }

    /**
     * Display team name from an object that might have nameI18n.
     * Handles: string, { name, nameI18n: { zh, en } }, { displayName, shortName }
     */
    function teamNameFromObj(nameOrObj, lang) {
        const ui = lang || (typeof uiLang !== 'undefined' ? uiLang : 'zh');
        if (nameOrObj && typeof nameOrObj === 'object') {
            const i18n = nameOrObj.nameI18n || nameOrObj;
            if (i18n && (i18n.zh || i18n.en)) {
                return ui === 'en' ? (i18n.en || i18n.zh || '') : (i18n.zh || i18n.en || '');
            }
            return teamName(nameOrObj.name || nameOrObj.displayName || nameOrObj.shortName || '', lang);
        }
        return teamName(nameOrObj, lang);
    }

    // ========== i18n Text ==========

    /**
     * Extract localized text from an i18n object { zh, en }.
     * Also handles plain strings (returned as-is).
     * @param {*} value - string or { zh, en } object
     * @param {string} [fallback='']
     * @param {string} [lang] - defaults to uiLang global
     * @returns {string}
     */
    function text(value, fallback = '', lang) {
        const ui = lang || (typeof uiLang !== 'undefined' ? uiLang : 'zh');
        if (value && typeof value === 'object' && (value.zh || value.en)) {
            return ui === 'en' ? (value.en || value.zh || fallback) : (value.zh || value.en || fallback);
        }
        return value || fallback;
    }

    // ========== HTML Escaping ==========

    /**
     * Escape HTML special characters.
     */
    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    /**
     * Escape for use in HTML attributes.
     */
    function attr(value) {
        return esc(value);
    }

    /**
     * Safe URL validation — returns escaped URL or empty string.
     */
    function safeUrl(url) {
        if (!url) return '';
        const str = String(url).trim();
        if (str.startsWith('http://') || str.startsWith('https://')) {
            return esc(str);
        }
        return '';
    }

    // ========== Empty / Error State Helpers ==========

    /**
     * Render an empty state message.
     */
    function emptyState(message, icon = '📭') {
        return `<div class="text-center py-8"><div class="text-4xl mb-2">${icon}</div><p class="text-gray-500 text-sm">${esc(message)}</p></div>`;
    }

    /**
     * Render an error state message.
     */
    function errorState(message, icon = '⚠️') {
        return `<div class="text-center py-8"><div class="text-4xl mb-2">${icon}</div><p class="text-red-400 text-sm">${esc(message)}</p></div>`;
    }

    /**
     * Render a loading spinner.
     */
    function loadingState(message) {
        return `<div class="flex items-center justify-center gap-2 py-8">
            <div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <span class="text-gray-500 text-sm">${esc(message)}</span>
        </div>`;
    }

    /**
     * Check if a value is "displayable" (not null/undefined/empty/NaN).
     */
    function hasValue(value) {
        return value !== undefined && value !== null && value !== '' && value !== 'NaN';
    }

    /**
     * Get a display value or fallback.
     */
    function displayOr(value, fallback = '-') {
        return hasValue(value) ? value : fallback;
    }

    // ========== Confidence / Quality Badges ==========

    /**
     * Format a confidence level as a colored badge.
     * @param {number} value - 0 to 1
     * @param {string} [label]
     */
    function confidenceBadge(value, label) {
        const n = safeNum(value, 0);
        const pctVal = Math.round(n * 100);
        const cls = pctVal >= 70 ? 'bg-green-500/20 text-green-400' :
                    pctVal >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400';
        const text = label ? `${label} ${pctVal}%` : `${pctVal}%`;
        return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}">${text}</span>`;
    }

    /**
     * Format data quality indicator.
     */
    function dataQualityBadge(quality) {
        const labels = {
            'live': { zh: '✓ 实时数据', en: '✓ Live Data', cls: 'bg-green-500/20 text-green-400' },
            'partial': { zh: '⚠ 部分数据', en: '⚠ Partial Data', cls: 'bg-yellow-500/20 text-yellow-400' },
            'unavailable': { zh: '✗ 暂无数据', en: '✗ No Data', cls: 'bg-red-500/20 text-red-400' },
        };
        const info = labels[quality] || labels['unavailable'];
        const lang = typeof uiLang !== 'undefined' ? uiLang : 'zh';
        const text = lang === 'en' ? info.en : info.zh;
        return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${info.cls}">${text}</span>`;
    }

    // ========== Elo Rating Helpers ==========

    /**
     * Get Elo rank badge class.
     */
    function eloRankClass(index) {
        if (index === 0) return 'rank-gold';
        if (index === 1) return 'rank-silver';
        if (index === 2) return 'rank-bronze';
        return 'rank-default';
    }

    /**
     * Format Elo change arrow.
     */
    function eloChange(current, previous) {
        if (!previous || previous === current) return '<span class="rank-change rank-same">—</span>';
        const diff = previous - current;
        if (diff > 0) return `<span class="rank-change rank-up">▲${diff}</span>`;
        return `<span class="rank-change rank-down">▼${Math.abs(diff)}</span>`;
    }

    // Public API
    return {
        // Numbers
        safeNum,
        safeInt,
        // Percentages
        pct,
        rawPct,
        pctPrecise,
        pctBar,
        // Scores
        score,
        resultBadge,
        // Names
        teamName,
        teamNameFromObj,
        // i18n
        text,
        // HTML
        esc,
        attr,
        safeUrl,
        // States
        emptyState,
        errorState,
        loadingState,
        hasValue,
        displayOr,
        // Badges
        confidenceBadge,
        dataQualityBadge,
        // Elo
        eloRankClass,
        eloChange,
    };
})();

// Freeze to prevent accidental mutation
Object.freeze(Fmt);
