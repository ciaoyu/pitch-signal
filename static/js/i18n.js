// ========== i18n.js - Internationalization Module ==========
import ZH_NAMES from '../../data/player_name_zh.json';
(function() {


    // Get state from WorldCup namespace
    function getState() {
        return window.WorldCup.State;
    }

    // Lazy-built lowercase+no-accent index for fuzzy player name lookup
    let _zhNamesLower = null;
    function getZhNamesLower() {
        if (!_zhNamesLower) {
            _zhNamesLower = {};
            for (const [k, v] of Object.entries(ZH_NAMES)) {
                const norm = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                _zhNamesLower[norm] = v;
            }
        }
        return _zhNamesLower;
    }

    function translatePlayerName(name, nameZh) {
        const state = getState();
        if (!name) return name;
        if (state.uiLang === 'en') return name;
        // Prefer the backend-returned nameZh, falling back to the local dictionary
        if (nameZh) return nameZh;
        if (ZH_NAMES[name]) return ZH_NAMES[name];
        // Fuzzy fallback: case-insensitive + accent-stripped
        const norm = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return getZhNamesLower()[norm] || name;
    }

    function translateCoachField(val, type) {
        const state = getState();
        if (!val) return val;
        if (state.uiLang === 'zh') {
            if (type === 'tenure') return val;
            return ZH_NAMES[val] || val;
        } else {
            if (type === 'tenure') {
                return String(val).replace('年', ' years').replace('个月', ' months');
            }
            if (type === 'style' || type === 'nationality') {
                const revDict = Object.fromEntries(Object.entries(ZH_NAMES).map(([k,v])=>[v,k]));
                return revDict[val] || val;
            }
            return val;
        }
    }

    function t(key) {
        const state = getState();
        const { I18N } = window.WorldCup;
        return I18N[state.uiLang]?.[key] || I18N.zh[key] || key;
    }

    function displayTeamName(name) {
        const state = getState();
        const raw = String(name || '').trim();
        const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
        if (!bilingual) {
            if (state.uiLang === 'zh' && ZH_NAMES[raw]) return ZH_NAMES[raw];
            return raw;
        }
        return state.uiLang === 'en' ? bilingual[2].trim() : bilingual[1].trim();
    }

    function displayMaybeTeamName(name) {
        if (name && typeof name === 'object') {
            const i18n = name.nameI18n || name;
            if (i18n && (i18n.zh || i18n.en)) {
                const state = getState();
                return state.uiLang === 'en' ? (i18n.en || i18n.zh || '') : (i18n.zh || i18n.en || '');
            }
            return displayTeamName(name.name || name.displayName || name.shortName || '');
        }
        return displayTeamName(name);
    }

    function i18nText(value, fallback = '') {
        const state = getState();
        if (value && typeof value === 'object' && (value.zh || value.en)) {
            return state.uiLang === 'en' ? (value.en || value.zh || fallback) : (value.zh || value.en || fallback);
        }
        return value || fallback;
    }

    function displayGroupName(name) {
        const state = getState();
        const group = String(name || '').match(/([A-L])$/)?.[1] || '';
        if (!group) return name || '';
        return state.uiLang === 'en' ? `Group ${group}` : `小组 ${group}`;
    }

    function applyLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        // S2: Update aria-labels on date scroll buttons
        const scrollLeft = document.getElementById('date-scroll-left');
        if (scrollLeft) scrollLeft.setAttribute('aria-label', t('scrollLeft'));
        const scrollRight = document.getElementById('date-scroll-right');
        if (scrollRight) scrollRight.setAttribute('aria-label', t('scrollRight'));
        document.querySelectorAll('.lang-btn').forEach(btn => {
            const state = getState();
            const active = btn.dataset.lang === state.uiLang;
            btn.classList.toggle('bg-white/15', active);
            btn.classList.toggle('text-white', active);
            btn.classList.toggle('text-gray-500', !active);
        });
    }

    function setLanguage(lang) {
        const state = getState();
        const { I18N } = window.WorldCup;
        if (!I18N[lang] || lang === state.uiLang) return;
        state.uiLang = lang;
        localStorage.setItem('worldcup_lang', state.uiLang);
        applyLanguage();
        if (window.syncGlobalChatLanguage) window.syncGlobalChatLanguage();
        // Reload current tab content
        if (state.tab === 'live') loadScores();
        if (state.tab === 'schedule') {
            const selectedDate = document.querySelector('.date-btn.tab-on')?.dataset.date;
            if (selectedDate) filterDate(selectedDate);
            else loadSchedule();
        }
        if (state.tab === 'standings') loadStandings();
        if (state.tab === 'teams') {
            state.allTeams = [];
            loadTeams();
        }
        if (state.tab === 'prediction') loadPrediction();
    }

    // Expose to WorldCup namespace
    window.WorldCup.I18n = {
        ZH_NAMES,
        translatePlayerName,
        translateCoachField,
        t,
        displayTeamName,
        displayMaybeTeamName,
        i18nText,
        displayGroupName,
        applyLanguage,
        setLanguage
    };

    // Also expose globally for backward compatibility
    window.translatePlayerName = translatePlayerName;
    window.t = t;
    window.displayTeamName = displayTeamName;
    window.displayMaybeTeamName = displayMaybeTeamName;
    window.i18nText = i18nText;
    window.displayGroupName = displayGroupName;
    window.applyLanguage = applyLanguage;
    window.setLanguage = setLanguage;
})();