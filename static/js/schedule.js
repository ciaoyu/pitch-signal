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
            const mVal = parts.find(p=>p.type==='month').value;
            const dVal = parts.find(p=>p.type==='day').value;
            return { mmdd: `${mVal}/${dVal}`, month: mVal, day: dVal };
        };
        // Name weekday from Intl
        const getWeekdayShort = ms => {
            return new Intl.DateTimeFormat(state.uiLang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', ...tzStr }).format(new Date(ms));
        };
        const todayInfo = getMMDD(nowMs);
        const yesterdayInfo = getMMDD(nowMs - 86400000);
        const todayStr = todayInfo.mmdd;
        const yesterdayStr = yesterdayInfo.mmdd;

        let defaultDate = dates[dates.length - 1]; // fallback

        document.getElementById('date-bar').innerHTML = dates.map((d, i) => {
            const n = byDate[d].length;
            const parts = d.split('/');
            const month = parts[0] || '';
            const day = parts[1] || '';

            let isToday = d === todayStr;
            let isYesterday = d === yesterdayStr;
            let specialLabel = '';
            let extraCls = 'text-slate-500 hover:text-slate-300';

            if (isToday) {
                specialLabel = state.uiLang === 'zh' ? '今天' : 'Today';
                extraCls = 'bg-emerald-500/8 text-emerald-400 border border-emerald-500/15';
                defaultDate = d;
            } else if (isYesterday) {
                specialLabel = state.uiLang === 'zh' ? '昨天' : 'Yest.';
                extraCls = 'bg-white/5 text-slate-400 border border-white/5';
                if (!dates.includes(todayStr)) defaultDate = d;
            }
            
            return `<button data-d="${attr(d)}" data-action="filter-date" data-date="${attr(d)}"
                class="date-btn snap-center shrink-0 flex flex-col items-center justify-center min-w-[52px] px-2.5 py-2 rounded-lg transition-all duration-150
                ${extraCls}">
                <span style="font:400 9px/1 'Inter'">${specialLabel ? esc(specialLabel) : month+'月'}</span>
                <span style="font:600 16px/1 'JetBrains Mono', monospace">${esc(day)}</span>
                <span style="font:400 8px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">${n}场</span>
            </button>`;
        }).join('');

        if (dates.length) {
            const selectionDate = dates.includes(todayStr) ? todayStr : defaultDate;
            filterDate(selectionDate);

            setTimeout(() => {
                const db = document.getElementById('date-bar');
                const targetBtn = db.querySelector(`[data-d="${yesterdayStr}"]`) || db.querySelector(`[data-d="${todayStr}"]`);
                if (targetBtn && db) {
                    const targetLeft = targetBtn.offsetLeft - db.offsetLeft - 16;
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
            b.style.background = '';
            b.style.border = '';
            b.style.color = '';
        });
        const activeBtn = document.querySelector(`[data-d="${CSS.escape(d)}"]`);
        if (activeBtn) {
            activeBtn.style.background = 'rgba(52,211,153,.08)';
            activeBtn.style.border = '1px solid rgba(52,211,153,.15)';
            activeBtn.style.color = '#34d399';
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