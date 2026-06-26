/**
 * coach-comparison.js — Coach comparison panel for match detail
 * Extracted from app.js lines 3911-3951
 */
(function () {
    'use strict';
    const tx = (...a) => (window.WorldCup.I18n?.t || ((z, e) => e))(...a);
    const translateCoachField = (...a) => (window.WorldCup.I18n?.translateCoachField || ((x) => x))(...a);
    const i18nText = (...a) => (window.WorldCup.I18n?.i18nText || ((o, f) => f))(...a);

    function renderCoachComparison(data) {
        if (!data || data.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('教练数据暂无', 'No coach data')}</div>`;
        const a = data.coachA || {}, b = data.coachB || {}, c = data.comparison || {};
        const score = c.overallScore || {};
        const scoreA = score[a.name] || '-';
        const scoreB = score[b.name] || '-';
        const renderCoach = (coach, accent, scoreValue) => `<div class="glass-light rounded-lg p-3"><div class="flex items-start justify-between gap-2 mb-2"><div><div class="text-sm font-bold text-white">${translateCoachField(coach.name, 'name') || tx('未知教练', 'Unknown coach')}</div><div class="text-[11px] text-gray-500">${translateCoachField(coach.nationality, 'nationality') || ''} · ${coach.age || '?'}${tx('岁', '')} · ${translateCoachField(coach.tenure, 'tenure') || ''}</div></div><div class="text-right"><div class="text-[11px] text-gray-500">${tx('评分', 'Rating')}</div><div class="text-base font-black ${accent}">${scoreValue}</div></div></div><div class="text-xs font-bold ${accent} mb-1">${i18nText(coach.styleI18n, coach.style || tx('战术风格未知', 'Style unknown'))}</div><div class="text-[11px] text-gray-400 leading-relaxed">${i18nText(coach.styleDetailI18n, coach.styleDetail || coach.notes || '')}</div><div class="grid grid-cols-2 gap-2 mt-2 text-[11px]"><div><span class="text-gray-500">${tx('胜率', 'Win Rate')}</span> <span class="font-bold">${coach.winRate || '-'}</span></div><div><span class="text-gray-500">${tx('阵型', 'Formation')}</span> <span class="font-bold">${(coach.formation || []).join(' / ') || '-'}</span></div></div></div>`;
        return `<div class="space-y-3"><div class="grid sm:grid-cols-2 gap-2">${renderCoach(a, 'text-blue-400', scoreA)}${renderCoach(b, 'text-red-400', scoreB)}</div><div class="glass-light rounded-lg p-3 text-[11px] text-gray-300 space-y-1"><div><span class="text-gray-500">${tx('风格对位', 'Style matchup')}</span> <span class="font-bold text-white">${i18nText(c.styleMatchupI18n, c.styleMatchup || '-')}</span></div><div><span class="text-gray-500">${tx('经验差距', 'Experience gap')}</span> <span class="font-bold text-white">${i18nText(c.experienceGapI18n, c.experienceGap || '-')}</span></div><div><span class="text-gray-500">${tx('临场优势', 'Adjustment edge')}</span> <span class="font-bold text-white">${i18nText(c.adjustmentEdgeI18n, c.adjustmentEdge || '-')}</span></div></div></div>`;
    }

    window.WorldCup.CoachComparison = { renderCoachComparison };
    Object.assign(window, { renderCoachComparison });
})();
