// ========== schedule.js - Schedule Module ==========
(function() {
    async function loadSchedule() {
        const { tx, esc, attr } = window.WorldCup.Utils;
        const t = window.t;
        const state = window.WorldCup.State;
        const res = await window.WorldCup.ApiClient.get('/api/schedule');
        if (!res.ok || !res.data?.matches) {
            document.getElementById('schedule-list').innerHTML = `<div class="text-center py-10 text-gray-500">${tx('赛程加载失败', 'Failed to load schedule')}</div>`;
            return;
        }
        state.scheduleCache = res.data.matches;

        const byDate = {};
        state.scheduleCache.forEach(m => {
            const dt = m.dateBJT?.split(' ')[0] || '?';
            (byDate[dt] ??= []).push(m);
        });

        const dates = Object.keys(byDate).sort();
        
        // Determine Today and Yesterday strings in Asia/Shanghai
        const nowMs = Date.now();
        const tzStr = { timeZone: 'Asia/Shanghai' };
        const getMMDD = ms => {
            const parts = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', ...tzStr }).formatToParts(new Date(ms));
            return `${parts.find(p=>p.type==='month').value}/${parts.find(p=>p.type==='day').value}`;
        };
        const todayStr = getMMDD(nowMs);
        const yesterdayStr = getMMDD(nowMs - 86400000);

        let defaultDate = dates[dates.length - 1]; // fallback

        document.getElementById('date-bar').innerHTML = dates.map((d, i) => {
            const n = byDate[d].length;
            
            let label = esc(d); // e.g., "06/20"
            let extraCls = 'bg-white/5 hover:bg-white/10 text-gray-300';
            let specialIcon = '';
            
            if (d === todayStr) {
                label = state.uiLang === 'zh' ? '今天 ' + label : 'Today';
                extraCls = 'bg-blue-600/30 text-blue-400 border border-blue-500/50';
                specialIcon = '📍';
                defaultDate = d; // Set default to today
            } else if (d === yesterdayStr) {
                label = state.uiLang === 'zh' ? '昨天 ' + label : 'Yest.';
                extraCls = 'bg-gray-600/30 text-gray-400 border border-gray-500/50';
                if (!dates.includes(todayStr)) defaultDate = d; // fallback to yesterday if today has no matches
            }
            
            return `<button data-d="${attr(d)}" data-action="filter-date" data-date="${attr(d)}"
                class="date-btn snap-center shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-bold transition
                ${extraCls}">
                ${specialIcon} ${label} <span class="opacity-50 text-[10px] ml-1">${n}${state.uiLang === 'zh' ? '' : ' '}${esc(t(n === 1 ? 'matchSuffix' : 'matchesSuffix'))}</span></button>`;
        }).join('');

        if (dates.length) {
            const selectionDate = dates.includes(todayStr) ? todayStr : defaultDate;
            filterDate(selectionDate);

            setTimeout(() => {
                const db = document.getElementById('date-bar');
                const targetBtn = db.querySelector(`[data-d="${yesterdayStr}"]`) || db.querySelector(`[data-d="${todayStr}"]`);
                if (targetBtn && db) {
                    const targetLeft = targetBtn.offsetLeft - db.offsetLeft - 10;
                    db.scrollTo({ left: targetLeft, behavior: 'smooth' });
                }
            }, 100);
        }

        const db = document.getElementById('date-bar');
        if (db && !db.dataset.wheelBound) {
            db.dataset.wheelBound = 'true';
            db.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    db.scrollLeft += e.deltaY;
                }
            });
            
            document.getElementById('date-scroll-left')?.addEventListener('click', () => {
                db.scrollBy({ left: -150, behavior: 'smooth' });
            });
            document.getElementById('date-scroll-right')?.addEventListener('click', () => {
                db.scrollBy({ left: 150, behavior: 'smooth' });
            });
        }
    }

    function filterDate(d) {
        const state = window.WorldCup.State;
        document.querySelectorAll('.date-btn').forEach(b => {
            b.classList.remove('ring-2', 'ring-white', 'text-white', 'scale-105');
            b.classList.add('opacity-70');
        });
        const activeBtn = document.querySelector(`[data-d="${CSS.escape(d)}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('opacity-70');
            activeBtn.classList.add('ring-2', 'ring-white', 'text-white', 'scale-105');
        }
        const list = state.scheduleCache.filter(m => m.dateBJT?.startsWith(d));
        document.getElementById('schedule-list').innerHTML = list.map(m => window.WorldCup.Scores.card(m)).join('');
    }

    // Expose to WorldCup namespace
    window.WorldCup.Schedule = {
        loadSchedule,
        filterDate
    };

    // Also expose globally for backward compatibility
    window.loadSchedule = loadSchedule;
    window.filterDate = filterDate;
})();