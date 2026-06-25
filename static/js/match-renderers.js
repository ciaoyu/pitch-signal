/**
 * Match Detail Renderers for PitchSignal
 * 
 * Contains rendering functions for match details, formation, bench, H2H, etc.
 * 
 * Usage:
 *   <script src="/static/js/formatters.js"></script>
 *   <script src="/static/js/api-client.js"></script>
 *   <script src="/static/js/app.js"></script>
 *   <script src="/static/js/match-renderers.js"></script>
 */

window.WorldCup = window.WorldCup || {};
window.WorldCup.MatchRenderers = (() => {
    // Access shared dependencies
    const { Formatters, ApiClient, State, Utils } = window.WorldCup;
    
    // Helper to get current language
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
    
    // Safe helper: get team label with i18n + fallback chain
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
    
    // renderFormation function (full implementation)
    function renderFormation(matchupData, isFinishedMatch = false) {
        if (!matchupData || !matchupData.home || !matchupData.away) {
            return `<div class="text-gray-500 text-xs text-center py-8">${isFinishedMatch
                ? tx('官方历史首发尚未同步；不以推测阵容替代实际首发。', 'Official historical lineups are not synced; estimates are not shown as actual starters.')
                : tx('暂无官方首发，以下为根据历史首发生成的推测阵容', 'No official lineups; showing projected lineups based on history')}</div>`;
        }
        const home = matchupData.home;
        const away = matchupData.away;
        const pairs = matchupData.pairs || [];
        const summary = matchupData.summary || {};
        const rc = r => r >= 75 ? 'rating-high' : r >= 68 ? 'rating-mid' : 'rating-low';

        // Calculate composite score for display
        const composite = matchupData.composite || {};
        const homeScore = composite.home || 50;
        const awayScore = composite.away || 50;
        
        let html = `
        <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-bold text-blue-300 flex items-center gap-1.5">🔵 ${teamFlagHtml(home, 'bg-blue-600')} ${teamLabel(home)} (${home.formation || '4-3-3'})</div>
            <div class="flex gap-1">
                <button data-action="set-pitch-view" data-view="both" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">${tx('全部', 'All')}</button>
                <button data-action="set-pitch-view" data-view="home" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('主队', 'Home')}</button>
                <button data-action="set-pitch-view" data-view="away" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('客队', 'Away')}</button>
            </div>
            <div class="text-xs font-bold text-red-300 flex items-center gap-1.5 justify-end">${teamLabel(away)} (${away.formation || '4-3-3'}) ${teamFlagHtml(away, 'bg-red-600')} 🔴</div>
        </div>
        
        <!-- Composite Score Bar -->
        <div class="glass-light rounded-lg p-2 mb-2">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-blue-400">${teamLabel(home)}</span>
                <span class="text-xs text-gray-500">${tx('综合评分', 'Composite')}</span>
                <span class="text-xs font-bold text-red-400">${teamLabel(away)}</span>
            </div>
            <div class="relative h-4 bg-white/5 rounded-full overflow-hidden">
                <div class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-blue-400 rounded-l-full transition-all duration-700" style="width:${homeScore}%"></div>
                <div class="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-red-500 to-red-400 rounded-r-full transition-all duration-700" style="width:${awayScore}%"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-[11px] font-bold text-white">${homeScore} : ${awayScore}</span>
                </div>
            </div>
            <div class="flex items-center justify-between mt-1 text-[11px]">
                <span class="text-gray-500">${summary.homeAdvantagePairs || 0} ${tx('优势', 'edges')}</span>
                <span class="text-gray-400">${summary.evenPairs || 0} ${tx('均势', 'even')}</span>
                <span class="text-gray-500">${summary.awayAdvantagePairs || 0} ${tx('优势', 'edges')}</span>
            </div>
        </div>
        
        <div class="pitch w-full" style="height:500px;position:relative;" id="pitch-canvas">`;

        // SVG matchup lines layer - Enhanced version
        html += `<svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style="pointer-events:none;z-index:1;">`;
        
        // Define gradients for lines
        html += `
        <defs>
            <linearGradient id="grad-home" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#22c55e;stop-opacity:0.6" />
                <stop offset="50%" style="stop-color:#22c55e;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#22c55e;stop-opacity:0.6" />
            </linearGradient>
            <linearGradient id="grad-away" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ef4444;stop-opacity:0.6" />
                <stop offset="50%" style="stop-color:#ef4444;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#ef4444;stop-opacity:0.6" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>`;
        
        // Draw matchup lines with improved visuals
        for (const p of pairs) {
            const color = p.advantage === 'home' ? '#22c55e' : p.advantage === 'away' ? '#ef4444' : '#9ca3af';
            const gradient = p.advantage === 'home' ? 'url(#grad-home)' : p.advantage === 'away' ? 'url(#grad-away)' : color;
            const opacity = p.advantage === 'even' ? 0.25 : 0.5;
            const lineWidth = p.advantage === 'even' ? '0.3' : '0.6';
            const dashArray = p.advantage === 'even' ? '0.4 0.3' : '0.8 0.3';
            
            // Draw main line with gradient
            html += `<line class="pitch-pair" x1="${p.home.x}" y1="${p.home.y}" x2="${p.away.x}" y2="${p.away.y}" stroke="${gradient}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-dasharray="${dashArray}" stroke-linecap="round"/>`;
            
            // Add glow effect for non-even matchups
            if (p.advantage !== 'even') {
                html += `<line class="pitch-pair" x1="${p.home.x}" y1="${p.home.y}" x2="${p.away.x}" y2="${p.away.y}" stroke="${color}" stroke-width="${parseFloat(lineWidth) * 2}" opacity="${opacity * 0.3}" stroke-dasharray="${dashArray}" filter="url(#glow)"/>`;
            }
            
            // Add midpoint indicator
            const mx = (p.home.x + p.away.x) / 2;
            const my = (p.home.y + p.away.y) / 2;
            
            // Background circle for label with glow
            html += `<circle class="pitch-pair" cx="${mx}" cy="${my}" r="3" fill="${color}" opacity="0.2" filter="url(#glow)"/>`;
            html += `<circle class="pitch-pair" cx="${mx}" cy="${my}" r="2" fill="${color}" opacity="0.3"/>`;
            
            // Label with advantage indicator
            const labelColor = p.advantage === 'home' ? '#4ade80' : p.advantage === 'away' ? '#f87171' : '#d1d5db';
            html += `<text class="pitch-pair" x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="2" font-weight="bold" fill="${labelColor}" opacity="0.9">${p.label}</text>`;
            
            // Small advantage arrow
            if (p.advantage !== 'even') {
                const arrowX = p.advantage === 'home' ? mx + 2.5 : mx - 2.5;
                const arrowDir = p.advantage === 'home' ? '→' : '←';
                html += `<text class="pitch-pair" x="${arrowX}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="1.8" fill="${labelColor}" opacity="0.8">${arrowDir}</text>`;
            }
        }
        html += `</svg>`;

        // Home team — top half
        html += '<div class="absolute top-0 left-0 right-0 h-[49%]" style="z-index:2;">';
        if (home.players && home.players.length > 0) {
            for (const p of home.players) {
                if (!p) continue;
                const r = p.rating || 70;
                const ns = p.name.replace(/'/g, "\\'");
                const ratingColor = r >= 75 ? 'border-green-400' : r >= 68 ? 'border-yellow-400' : 'border-red-400';
                const ratingGlow = r >= 75 ? 'shadow-green-500/50' : r >= 68 ? 'shadow-yellow-500/50' : 'shadow-red-500/50';
                const { x, y } = playerCoords(p);
                html += `<div class="pitch-player player-dot pitch-home" style="left:${x}%;top:${y}%"
                    data-action="show-player-tip"
                    data-player-name="${attr(p.name)}"
                    data-pos="${attr(p.pos)}"
                    data-rating="${(r/10).toFixed(1)}"
                    data-team="${attr(teamLabel(home))}"
                    data-status="首发">
                    <div class="avatar bg-blue-600/80 border-blue-400">
                        <span>${p.jersey||'?'}</span>
                        <span class="rating-badge ${rc(r)}">${(r/10).toFixed(1)}</span>
                    </div>
                    <div class="name text-blue-200">${p.name.split(' ').pop()}</div>
                </div>`;
            }
        } else {
            html += `<div class="absolute inset-0 flex items-center justify-center">
                <div class="text-gray-400 text-[11px] text-center px-4 py-2 glass-light rounded-lg">
                    ${isFinishedMatch
                        ? tx('官方首发尚未同步，不以推测阵容替代实际首发。', 'Official lineups not synced; estimates are not shown as actual starters.')
                        : tx('推测阵容未生成，请等待官方首发公布。', 'Projected lineup not yet generated; please wait for official announcement.')}
                </div>
            </div>`;
        }
        html += '</div>';

        // Center divider with animation
        html += '<div class="absolute top-[49%] left-0 right-0 h-[2%] flex items-center justify-center" style="z-index:3;">';
        html += '<div class="w-24 h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded animate-pulse"></div>';
        html += '</div>';

        // Away team — bottom half
        html += '<div class="absolute bottom-0 left-0 right-0 h-[49%]" style="z-index:2;">';
        if (away.players && away.players.length > 0) {
            for (const p of away.players) {
                if (!p) continue;
                const r = p.rating || 70;
                const ns = p.name.replace(/'/g, "\\'");
                const ratingColor = r >= 75 ? 'border-green-400' : r >= 68 ? 'border-yellow-400' : 'border-red-400';
                const ratingGlow = r >= 75 ? 'shadow-green-500/50' : r >= 68 ? 'shadow-yellow-500/50' : 'shadow-red-500/50';
                const { x, y } = playerCoords(p);
                html += `<div class="pitch-player player-dot pitch-away" style="left:${x}%;top:${y}%"
                    data-action="show-player-tip"
                    data-player-name="${attr(p.name)}"
                    data-pos="${attr(p.pos)}"
                    data-rating="${(r/10).toFixed(1)}"
                    data-team="${attr(teamLabel(away))}"
                    data-status="首发">
                    <div class="avatar bg-red-600/80 border-red-400">
                        <span>${p.jersey||'?'}</span>
                        <span class="rating-badge ${rc(r)}">${(r/10).toFixed(1)}</span>
                    </div>
                    <div class="name text-red-200">${p.name.split(' ').pop()}</div>
                </div>`;
            }
        } else {
            html += `<div class="absolute inset-0 flex items-center justify-center">
                <div class="text-gray-400 text-[11px] text-center px-4 py-2 glass-light rounded-lg">
                    ${isFinishedMatch
                        ? tx('官方首发尚未同步，不以推测阵容替代实际首发。', 'Official lineups not synced; estimates are not shown as actual starters.')
                        : tx('推测阵容未生成，请等待官方首发公布。', 'Projected lineup not yet generated; please wait for official announcement.')}
                </div>
            </div>`;
        }
        html += '</div>';

        html += '</div>'; // close pitch

        // Key matchups list
        const keyPairs = pairs.filter(p => Math.abs(p.gap) >= 8).slice(0, 4);
        if (keyPairs.length) {
            html += '<div class="mt-2 space-y-0.5">';
            for (const p of keyPairs) {
                const cls = p.advantage === 'home' ? 'text-green-400' : p.advantage === 'away' ? 'text-red-400' : 'text-gray-400';
                html += `<div class="text-[11px] ${cls} flex items-center gap-1">
                    ${p.advantage === 'home' ? '🟢' : '🔴'}
                    ${p.home.name.split(' ').pop()} (${(p.home.rating/10).toFixed(1)}) vs ${p.away.name.split(' ').pop()} (${(p.away.rating/10).toFixed(1)})
                    <span class="font-bold">${p.gap > 0 ? '+' : ''}${(p.gap/10).toFixed(1)}</span>
                </div>`;
            }
            html += '</div>';
        }  // end if keyPairs.length

        return html;
    }
    
    // Translate player name helper
    const translatePlayerName = (name) => Utils.translatePlayerName ? Utils.translatePlayerName(name) : name;
    
    // renderBenchAnalysis function
    function renderBenchAnalysis(data, isFinishedMatch) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('数据暂无', 'No data')}</div>`;
        
        const home = data.homeTeam;
        const away = data.awayTeam;
        const comparison = data.comparison;
        
        // Bench strength color
        const getStrengthColor = (score) => {
            if (score >= 80) return 'text-green-400';
            if (score >= 60) return 'text-yellow-400';
            return 'text-red-400';
        };
        
        // Impact type icon
        const getImpactIcon = (type) => {
            switch(type) {
                case 'creative': return '🎨';
                case 'defensive': return '🛡️';
                case 'physical': return '💪';
                default: return '⚖️';
            }
        };
        
        // Appearance probability color
        const getProbColor = (prob) => {
            if (prob >= 0.7) return 'text-green-400';
            if (prob >= 0.5) return 'text-yellow-400';
            return 'text-red-400';
        };
        
        // Render bench player card
        const renderBenchPlayer = (player, teamColor, teamNameStr) => {
            const playerNameZh = translatePlayerName(player.name);
            
            // Find if this player actually played
            let playedStr = '';
            if (data.realSubstitutions && data.realSubstitutions.length > 0) {
                const subEvent = data.realSubstitutions.find(s => {
                    const matchName = s.playerIn.toLowerCase();
                    const pName = (player.name || '').toLowerCase();
                    return matchName === pName || pName.includes(matchName) || matchName.includes(pName);
                });
                if (subEvent) {
                    playedStr = `<span class="font-bold ml-1 text-green-400">🔽 ${subEvent.minute} ${tx('出场', 'In')}</span>`;
                } else if (isFinishedMatch) {
                    playedStr = `<span class="font-bold ml-1 text-gray-600">${tx('未出场', 'Unused')}</span>`;
                }
            }
            
            return `
            <div class="glass-light rounded-lg p-2 mb-2 cursor-pointer hover:bg-white/10 transition-colors"
                 data-action="open-player-detail"
                 data-player-id="${attr(player.id || '')}"
                 data-player-name="${attr(player.name || '')}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold ${teamColor}">${player.jersey || '?'}</span>
                        <span class="text-xs font-bold">${esc(playerNameZh)}</span>
                        <span class="text-[11px] text-gray-500">${esc(player.pos) || '?'}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[11px] text-gray-500">${getImpactIcon(player.impactType)}</span>
                        <span class="text-xs font-bold ${getStrengthColor(player.rating)}">${esc(player.rating) || '-'}</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 text-[11px] mb-1">
                    <span class="text-gray-500">${tx('特色:', 'Traits:')}</span>
                    ${player.traits?.map(t => `<span class="bg-white/5 px-1.5 py-0.5 rounded">${esc(t)}</span>`).join('') || '<span class="text-gray-600">-</span>'}
                </div>
                
                <div class="flex items-center justify-between text-[11px]">
                    <div>
                        <span class="text-gray-500">${tx('替代:', 'Sub for:')}</span>
                        <span class="ml-1">${esc(player.substituteFor?.join(', ')) || '-'}</span>
                    </div>
                    <div>
                        ${playedStr ? `
                            <span class="text-gray-500">${tx('状态:', 'Status:')}</span>
                            ${playedStr}
                        ` : `
                            <span class="text-gray-500">${tx('出场概率:', 'Sub Prob:')}</span>
                            <span class="font-bold ml-1 ${getProbColor(player.appearanceProb)}">${Math.round(player.appearanceProb * 100)}%</span>
                        `}
                    </div>
                </div>
            </div>
            `;
        };
        
        return `
        <div class="space-y-3">
            <!-- Comparison Overview -->
            <div class="glass-light rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-gray-400">🔄 替补席对比</span>
                    <span class="text-[11px] text-gray-500">板凳深度</span>
                </div>
                
                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="text-sm font-bold ${getStrengthColor(comparison.homeStrength)}">🔵 ${teamLabel(home)}</div>
                        <div class="text-lg font-bold ${getStrengthColor(comparison.homeStrength)}">${comparison.homeStrength || '-'}</div>
                    </div>
                    
                    <div class="text-center">
                        <div class="text-xs text-gray-500">VS</div>
                        <div class="text-[11px] font-bold ${comparison.advantage === 'home' ? 'text-blue-400' : comparison.advantage === 'away' ? 'text-red-400' : 'text-gray-400'}">${comparison.advantage === 'home' ? '🔵 优势' : comparison.advantage === 'away' ? '🔴 优势' : '⚖️ 均势'}</div>
                    </div>
                    
                    <div class="flex-1 text-right">
                        <div class="text-sm font-bold ${getStrengthColor(comparison.awayStrength)}">${teamLabel(away)} 🔴</div>
                        <div class="text-lg font-bold ${getStrengthColor(comparison.awayStrength)}">${comparison.awayStrength || '-'}</div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-[11px] mt-2">
                    <div>
                        <span class="text-gray-500">超级替补:</span>
                        <span class="font-bold ml-1">${home.superSubCount || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">超级替补:</span>
                        <span class="font-bold ml-1">${away.superSubCount || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">防守选项:</span>
                        <span class="font-bold ml-1">${home.defensiveOptions || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">防守选项:</span>
                        <span class="font-bold ml-1">${away.defensiveOptions || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">进攻选项:</span>
                        <span class="font-bold ml-1">${home.attackingOptions || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">进攻选项:</span>
                        <span class="font-bold ml-1">${away.attackingOptions || 0}</span>
                    </div>
                </div>
            </div>
            
            <!-- Home Bench -->
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-blue-400 mb-2">🔵 ${esc(teamLabel(home))} ${tx('替补席', 'Bench')}</div>
                ${home.bench?.map(p => renderBenchPlayer(p, 'text-blue-400', teamLabel(home))).join('') || `<div class="text-gray-500 text-xs">${tx('暂无替补数据', 'No bench data')}</div>`}
            </div>
            
            <!-- Away Bench -->
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-red-400 mb-2">🔴 ${esc(teamLabel(away))} ${tx('替补席', 'Bench')}</div>
                ${away.bench?.map(p => renderBenchPlayer(p, 'text-red-400', teamLabel(away))).join('') || `<div class="text-gray-500 text-xs">${tx('暂无替补数据', 'No bench data')}</div>`}
            </div>
            
            <!-- Substitution Matrix -->
            ${home.substitutionMatrix && Object.keys(home.substitutionMatrix).length > 0 ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-gray-400 mb-2">🔄 ${teamLabel(home)} ${tx('替代关系', 'Substitution Relations')}</div>
                ${Object.entries(home.substitutionMatrix).map(([starter, subs]) => `
                <div class="flex items-center justify-between text-[11px] py-1 border-b border-white/5">
                    <span class="font-bold">${esc(starter)}</span>
                    <div class="flex items-center gap-1">
                        <span class="text-gray-500">→</span>
                        <span class="text-green-400">${esc(subs.primary) || '-'}</span>
                        ${subs.secondary ? `<span class="text-gray-600">/ ${esc(subs.secondary)}</span>` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${away.substitutionMatrix && Object.keys(away.substitutionMatrix).length > 0 ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-gray-400 mb-2">🔄 ${teamLabel(away)} ${tx('替代关系', 'Substitution Relations')}</div>
                ${Object.entries(away.substitutionMatrix).map(([starter, subs]) => `
                <div class="flex items-center justify-between text-[11px] py-1 border-b border-white/5">
                    <span class="font-bold">${esc(starter)}</span>
                    <div class="flex items-center gap-1">
                        <span class="text-gray-500">→</span>
                        <span class="text-green-400">${esc(subs.primary) || '-'}</span>
                        ${subs.secondary ? `<span class="text-gray-600">/ ${esc(subs.secondary)}</span>` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
        `;
    }
    
    // applySubstitutionsToFormation function
    function applySubstitutionsToFormation(realSubstitutions) {
        if (!realSubstitutions || !realSubstitutions.length) return;
        
        // Find all player elements on the pitch
        const playerEls = document.querySelectorAll('.pitch-player');
        
        realSubstitutions.forEach(sub => {
            // Try to match playerOut with starters
            let outMatched = false;
            playerEls.forEach(el => {
                const elName = el.getAttribute('data-player-name') || '';
                const subName = sub.playerOut || '';
                if (elName && subName && (elName.toLowerCase() === subName.toLowerCase() || elName.toLowerCase().includes(subName.toLowerCase()) || subName.toLowerCase().includes(elName.toLowerCase()))) {
                    outMatched = true;
                    // Add substitution badge
                    const subBadge = document.createElement('div');
                    subBadge.className = 'absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900/80 text-[8px] px-1 py-0.5 rounded text-gray-300 font-bold shadow-sm z-10 scale-90 border border-white/10';
                    subBadge.innerHTML = `🔽 ${sub.minute}`;
                    el.appendChild(subBadge);
                    
                    // Add gray-out effect to player number/circle to indicate they left
                    const circle = el.querySelector('.avatar');
                    if (circle) circle.classList.add('opacity-50');
                }
            });
        });
    }
    
    // renderCoachPanel function
    function renderCoachPanel(coachData, isFinishedMatch) {
        // No data at all → placeholder
        if (!coachData || (!coachData.coachA && !coachData.coachB)) {
            return `<div class="glass-light rounded-lg p-6 text-center">
                <div class="text-4xl mb-3">🧠</div>
                <div class="text-sm font-bold text-gray-300 mb-2">${tx('教练数据', 'Coach Data')}</div>
                <div class="text-xs text-gray-500">${tx('教练数据将在后续版本中开放，敬请期待。', 'Coach data will be available in a future release. Stay tuned.')}</div>
            </div>`;
        }

        // Both coaches available (with or without comparison)
        const coachA = coachData.coachA;
        const coachB = coachData.coachB;
        const comp = coachData.comparison;

        const renderCoachCard = (coach, side) => {
            if (!coach || coach.error) {
                return `<div class="glass-light rounded-lg p-4 text-center">
                    <div class="text-2xl mb-1">🤷</div>
                    <div class="text-xs text-gray-500">${tx('教练数据暂未同步', 'Coach data not synced')}</div>
                </div>`;
            }
            const name = coach.name || '?';
            const style = coach.style || tx('未知', 'Unknown');
            const winRate = coach.winRate || '?';
            const tenure = coach.tenure || '?';
            const nationality = coach.nationality || '';
            const flag = coach.flag || '';
            const sideColor = side === 'home' ? 'border-l-blue-500' : 'border-l-red-500';
            return `<div class="glass-light rounded-lg p-4 border-l-2 ${sideColor}">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-lg">${esc(flag || '')}</span>
                    <span class="text-sm font-bold text-gray-200">${esc(name)}</span>
                </div>
                ${nationality ? `<div class="text-[11px] text-gray-500 mb-1">${esc(nationality)}</div>` : ''}
                <div class="grid grid-cols-3 gap-2 text-[11px]">
                    <div><span class="text-gray-600">${tx('风格', 'Style')}</span><br><span class="text-gray-300">${esc(style)}</span></div>
                    <div><span class="text-gray-600">${tx('胜率', 'Win %')}</span><br><span class="text-gray-300 font-mono">${esc(winRate)}</span></div>
                    <div><span class="text-gray-600">${tx('执教', 'Tenure')}</span><br><span class="text-gray-300 font-mono">${esc(tenure)}</span></div>
                </div>
            </div>`;
        };

        let html = '<div class="grid grid-cols-2 gap-3 mb-3">';
        html += renderCoachCard(coachA, 'home');
        html += renderCoachCard(coachB, 'away');
        html += '</div>';

        // Style comparison analysis
        if (comp) {
            html += `<div class="glass-light rounded-lg p-4">
                <div class="text-xs font-bold text-gray-400 mb-2">⚔️ ${tx('战术对位分析', 'Tactical Matchup')}</div>
                <div class="space-y-2 text-xs">`;

            if (comp.styleMatchupI18n) {
                html += `<div class="flex items-start gap-2">
                    <span class="text-gray-500">📋</span>
                    <span class="text-gray-300">${esc(i18nText(comp.styleMatchupI18n))}</span>
                </div>`;
            } else if (comp.styleMatchup) {
                html += `<div class="flex items-start gap-2">
                    <span class="text-gray-500">📋</span>
                    <span class="text-gray-300">${esc(comp.styleMatchup)}</span>
                </div>`;
            }

            if (comp.experienceGapI18n) {
                html += `<div class="flex items-start gap-2">
                    <span class="text-gray-500">⏳</span>
                    <span class="text-gray-300">${esc(i18nText(comp.experienceGapI18n))}</span>
                </div>`;
            } else if (comp.experienceGap) {
                html += `<div class="flex items-start gap-2">
                    <span class="text-gray-500">⏳</span>
                    <span class="text-gray-300">${esc(comp.experienceGap)}</span>
                </div>`;
            }

            if (comp.adjustmentEdgeI18n) {
                html += `<div class="flex items-start gap-2">
                    <span class="text-gray-500">🎯</span>
                    <span class="text-gray-300">${esc(i18nText(comp.adjustmentEdgeI18n))}</span>
                </div>`;
            } else if (comp.adjustmentEdge) {
                html += `<div class="flex items-start gap-2">
                    <span class="text-gray-500">🎯</span>
                    <span class="text-gray-300">${esc(comp.adjustmentEdge)}</span>
                </div>`;
            }

            // Overall scores
            if (comp.overallScore) {
                const scores = comp.overallScore;
                html += `<div class="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                    <span class="text-gray-500 text-[11px]">${tx('综合评分', 'Overall')}</span>`;
                for (const [name, score] of Object.entries(scores)) {
                    html += `<span class="text-[11px] font-mono font-bold text-gray-200">${esc(name)}: ${esc(String(score))}</span>`;
                }
                html += `</div>`;
            }

            html += `</div></div>`;
        } else if (coachA && coachB && !coachData._fallback) {
            html += `<div class="glass-light rounded-lg p-4 text-center">
                <div class="text-xs text-gray-500">${tx('教练对阵分析暂未生成', 'Coach matchup analysis not yet generated')}</div>
            </div>`;
        }

        return html;
    }
    
    // Export functions
    return {
        renderFormation,
        renderBenchAnalysis,
        applySubstitutionsToFormation,
        renderCoachPanel,
    };
})();