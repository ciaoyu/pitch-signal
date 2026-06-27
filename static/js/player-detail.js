(function() {
    'use strict';
    const { tx, esc, api } = window.WorldCup.Utils;
    const { translatePlayerName } = window.WorldCup.I18n;
    
    function openPlayerDetail(id, inlineData) {
        if (!id && !inlineData) return;
        const modal = document.getElementById('match-modal');
        const content = document.getElementById('modal-content');
        modal.classList.remove('hidden');
        content.innerHTML = '<div class="py-10 text-center text-gray-500">' + tx('加载球员信息...', 'Loading player...') + '</div>';
        const showInline = () => {
            if (!inlineData) { content.innerHTML = '<div class="text-gray-500 text-center py-10">' + tx('球员数据暂无', 'No player data') + '</div>'; return; }
            const nameZh = translatePlayerName(inlineData.name, inlineData.nameZh);
            content.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center gap-3">
                    <div class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl">⚽</div>
                    <div>
                        <h3 class="font-bold text-lg">${nameZh}</h3>
                        ${nameZh !== inlineData.name ? `<div class="text-xs text-gray-500">${inlineData.name}</div>` : ''}
                        <div class="text-xs text-gray-500">${inlineData.pos || ''} · ${inlineData.nationality || ''}</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    ${inlineData.jersey ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('球衣号', 'Jersey')}</div><div class="font-bold">#${inlineData.jersey}</div></div>` : ''}
                    ${inlineData.age ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('年龄', 'Age')}</div><div class="font-bold">${inlineData.age}${tx('岁', '')}</div></div>` : ''}
                    ${inlineData.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('身高', 'Height')}</div><div class="font-bold">${inlineData.height}</div></div>` : ''}
                    ${inlineData.pos ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('位置', 'Position')}</div><div class="font-bold">${inlineData.pos}</div></div>` : ''}
                </div>
                <div class="text-[11px] text-gray-600 text-center">${tx('详细数据加载中...', 'Loading stats...')}</div>
            </div>`;
        };
        if (inlineData) showInline();
        if (!id) return;
        api('/api/player/' + id + '/enhanced').then(d => {
            if (!d || d.error) {
                api('/api/player/' + id).then(basic => {
                    if (!basic || basic.error) { if (!inlineData) showInline(); return; }
                    content.innerHTML = renderPlayerBasic(basic);
                });
                return;
            }
            content.innerHTML = renderPlayerEnhanced(d);
        }).catch(() => { if (!inlineData) showInline(); });
    }
    
    function renderPlayerBasic(d) {
        return `
        <div class="space-y-3">
            <!-- Header -->
            <div class="flex items-center gap-3">
                ${d.headshot ? `<img src="${d.headshot}" class="w-16 h-16 rounded-full object-cover bg-white/10">` : ''}
                <div>
                    <h3 class="font-bold text-lg">${d.name}</h3>
                    <div class="text-xs text-gray-500">${d.position || ''} · ${d.team || ''} · ${d.nationality || ''}</div>
                </div>
            </div>
            
            <!-- Basic Info -->
            <div class="grid grid-cols-2 gap-2 text-xs">
                ${d.age ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">年龄</div><div class="font-bold">${d.age}岁</div></div>` : ''}
                ${d.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">身高</div><div class="font-bold">${d.height}</div></div>` : ''}
                ${d.weight ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">体重</div><div class="font-bold">${d.weight}</div></div>` : ''}
                ${d.jersey ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">球衣</div><div class="font-bold">#${d.jersey}</div></div>` : ''}
            </div>
        </div>`;
    }
    
    function renderPlayerEnhanced(d) {
        const getFormColor = (form) => {
            switch(form) {
                case 'excellent': return 'text-green-400';
                case 'good': return 'text-blue-400';
                case 'average': return 'text-yellow-400';
                case 'poor': return 'text-red-400';
                default: return 'text-gray-400';
            }
        };
        const getTrendIcon = (trend) => {
            switch(trend) {
                case 'rising': return '📈';
                case 'stable': return '➡️';
                case 'declining': return '📉';
                default: return '➡️';
            }
        };
        const formatMarketValue = (value) => {
            if (value >= 10000000) return `€${(value / 10000000).toFixed(1)}千万`;
            if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}百万`;
            if (value >= 1000) return `€${(value / 1000).toFixed(0)}千`;
            return `€${value}`;
        };
        const nameZh = translatePlayerName(d.name, d.nameZh);
        return `
        <div class="space-y-3">
            <!-- Header -->
            <div class="flex items-center gap-3">
                ${d.headshot ? `<img src="${d.headshot}" class="w-16 h-16 rounded-full object-cover bg-white/10" onerror="this.style.display='none'">` : '<div class="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl">⚽</div>'}
                <div>
                    <h3 class="font-bold text-lg">${nameZh}</h3>
                    ${nameZh !== d.name ? `<div class="text-xs text-gray-500">${d.name}</div>` : ''}
                    <div class="text-xs text-gray-400">${d.position || ''} · <span class="text-blue-400">${d.club || d.team || ''}</span></div>
                    <div class="text-[11px] text-gray-500">${d.nationality || ''} · #${d.jersey || '?'} · ${d.age || '?'}${tx('岁','')}</div>
                </div>
            </div>
            <!-- Basic Info -->
            <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
                ${d.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('身高','Height')}</div><div class="font-bold">${d.height}</div></div>` : ''}
                ${d.weight ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('体重','Weight')}</div><div class="font-bold">${d.weight}</div></div>` : ''}
                ${d.dob ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('生日','DOB')}</div><div class="font-bold">${d.dob}</div></div>` : ''}
            </div>
            <!-- Club Stats this season -->
            ${d.clubStats && d.clubStats.dataQuality === 'live' ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-blue-400 mb-2">🏟️ ${d.clubStats.season || tx('本赛季数据','Season Stats')}</div>
                <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
                    ${d.clubStats.appearances != null ? `<div><div class="text-gray-500">${tx('出场','Apps')}</div><div class="font-bold">${d.clubStats.appearances}</div></div>` : ''}
                    ${d.clubStats.goals != null ? `<div><div class="text-gray-500">${tx('进球','Goals')}</div><div class="font-bold text-green-400">${d.clubStats.goals}</div></div>` : ''}
                    ${d.clubStats.assists != null ? `<div><div class="text-gray-500">${tx('助攻','Assists')}</div><div class="font-bold text-yellow-400">${d.clubStats.assists}</div></div>` : ''}
                </div>
            </div>
            ` : ''}
            <!-- Traits -->
            ${d.traits?.length > 0 ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">⭐ ${tx('球员特色', 'Player Traits')}</div>
                <div class="space-y-1">
                    ${d.traits.map(trait => `
                    <div class="flex items-center justify-between text-[11px]">
                        <span>${trait.name}</span>
                        <span class="font-bold text-blue-400">${trait.score}</span>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            <!-- Recent Form -->
            ${d.recentForm ? `
            <div class="glass-light rounded-lg p-2">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-gray-400">📊 ${tx('近期表现', 'Recent Form')}</span>
                    <span class="text-xs ${getFormColor(d.recentForm.form)}">
                        ${getTrendIcon(d.recentForm.trend)} ${d.recentForm.form === 'excellent' ? tx('出色', 'Excellent') : d.recentForm.form === 'good' ? tx('良好', 'Good') : d.recentForm.form === 'average' ? tx('一般', 'Average') : tx('低迷', 'Poor')}
                    </span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                        <span class="text-gray-500">${tx('出场', 'Appearances')}</span>
                        <span class="font-bold ml-1">${d.recentForm.matches}${tx('场', '')}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx('进球', 'Goals')}</span>
                        <span class="font-bold ml-1 text-green-400">${d.recentForm.goals}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx('助攻', 'Assists')}</span>
                        <span class="font-bold ml-1 text-blue-400">${d.recentForm.assists}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx('评分', 'Rating')}</span>
                        <span class="font-bold ml-1">${d.recentForm.rating}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            <!-- Club Stats -->
            ${d.clubStats ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">🏟️ 俱乐部数据</div>
                <div class="text-[11px] text-gray-500 mb-1">${d.clubStats.team} · ${d.clubStats.league} · ${d.clubStats.season}</div>
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                        <span class="text-gray-500">出场</span>
                        <span class="font-bold ml-1">${d.clubStats.appearances}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">进球</span>
                        <span class="font-bold ml-1 text-green-400">${d.clubStats.goals}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">助攻</span>
                        <span class="font-bold ml-1 text-blue-400">${d.clubStats.assists}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">评分</span>
                        <span class="font-bold ml-1">${d.clubStats.rating}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            <!-- National Stats -->
            ${d.nationalStats ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">🇺🇸 国家队数据</div>
                <div class="text-[11px] text-gray-500 mb-1">${d.nationalStats.team}</div>
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                        <span class="text-gray-500">出场</span>
                        <span class="font-bold ml-1">${d.nationalStats.caps}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">进球</span>
                        <span class="font-bold ml-1 text-green-400">${d.nationalStats.goals}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">助攻</span>
                        <span class="font-bold ml-1 text-blue-400">${d.nationalStats.assists}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">大赛进球</span>
                        <span class="font-bold ml-1 text-yellow-400">${d.nationalStats.tournamentGoals}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            <!-- Injury History -->
            ${d.injuryHistory?.length > 0 ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">🏥 伤病历史</div>
                ${d.injuryHistory.map(injury => `
                <div class="text-[11px] py-1 border-b border-white/5">
                    <div class="flex items-center justify-between">
                        <span>${injury.type}</span>
                        <span class="text-gray-600">${injury.date}</span>
                    </div>
                    <div class="text-gray-500">${injury.duration} · ${injury.status}</div>
                </div>
                `).join('')}
            </div>
            ` : ''}
        </div>`;
    }
    
    window.WorldCup.PlayerDetail = { openPlayerDetail, renderPlayerBasic, renderPlayerEnhanced };
    Object.assign(window, { openPlayerDetail });
})();