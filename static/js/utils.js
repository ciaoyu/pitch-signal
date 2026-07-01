// ========== utils.js - Utility Functions Module ==========
(function() {
    // Get state from WorldCup namespace
    function getState() {
        return window.WorldCup.State;
    }

    function tx(zh, en) {
        const state = getState();
        return state.uiLang === 'zh' ? zh : en;
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function attr(value) {
        return esc(value);
    }

    function safeUrl(url) {
        if (!url) return '';
        const str = String(url).trim();
        if (str.startsWith('http://') || str.startsWith('https://')) {
            return esc(str);
        }
        return '';
    }

    function normalizeCelsius(value, unit) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return unit === 'F' || (!unit && n > 50) ? (n - 32) * 5 / 9 : n;
    }

    function getWeatherUnit() {
        try { return localStorage.getItem('weatherUnit') === 'F' ? 'F' : 'C'; } catch { return 'C'; }
    }

    function formatTemperature(value, sourceUnit = 'C', displayUnit = getWeatherUnit()) {
        const celsius = normalizeCelsius(value, sourceUnit);
        if (celsius === null) return '--';
        const converted = displayUnit === 'F' ? celsius * 9 / 5 + 32 : celsius;
        return `${Math.round(converted)}°${displayUnit}`;
    }

    function setWeatherUnit(unit) {
        const next = unit === 'F' ? 'F' : 'C';
        try { localStorage.setItem('weatherUnit', next); } catch {}
        document.querySelectorAll('[data-temp-c]').forEach(el => {
            el.textContent = formatTemperature(el.dataset.tempC, 'C', next);
        });
        document.querySelectorAll('[data-weather-unit]').forEach(el => {
            el.classList.toggle('active', el.dataset.weatherUnit === next);
            el.setAttribute('aria-pressed', String(el.dataset.weatherUnit === next));
        });
    }

    // Backward-compatible wrapper: returns raw data on success, null on failure.
    // All existing callers work unchanged. Prefer API.get() / API.post() for new code.
    async function api(url, options = {}) {
        const { ApiClient } = window.WorldCup;
        return ApiClient.legacy(url, options);
    }



    // I18n-aware team name display
    function displayMaybeTeamName(...a) {
        return (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
    }
    function displayGroupName(...a) {
        return (window.WorldCup.I18n?.displayGroupName || ((x) => x))(...a);
    }

    // Expose to WorldCup namespace (mutate existing object to preserve getters)
    const U = window.WorldCup.Utils;
    U.tx = tx;
    U.esc = esc;
    U.attr = attr;
    U.safeUrl = safeUrl;
    U.api = api;
    U.normalizeCelsius = normalizeCelsius;
    U.getWeatherUnit = getWeatherUnit;
    U.formatTemperature = formatTemperature;
    U.setWeatherUnit = setWeatherUnit;

    U.displayMaybeTeamName = displayMaybeTeamName;
    U.displayGroupName = displayGroupName;
    // t (i18n translation) is defined in i18n.js — use getter for load-order safety
    Object.defineProperty(U, 't', { get() { return window.t; }, enumerable: true });

    // Also expose globally for backward compatibility
    window.tx = tx;
    window.esc = esc;
    window.attr = attr;
    window.safeUrl = safeUrl;
    window.api = api;

})();
