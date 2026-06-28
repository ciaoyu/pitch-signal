// ========== app.js — Thin Orchestrator ==========
// All feature logic lives in separate modules (scores.js, schedule.js, etc.).
// This file only wires: tab routing, event delegation, clock, and init.
(function () {
    'use strict';

    const state = window.WorldCup.State;
    const { tab } = state; // shorthand; state.tab is mutated via switchTab

    // ========== Tab + URL Routing ==========
    // Max-width per tab (design spec): Live 720, Schedule 720, Prediction 1080, Standings 960, Teams 1080
    const TAB_MAX_WIDTHS = { live: '720px', schedule: '720px', prediction: '1080px', standings: '960px', teams: '1080px' };

    function switchTab(newTab) {
        state.tab = newTab;
        // Hide all tab content AND any match detail overlay
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('tab-on'));
        // Close match detail / spatial matchup overlay if open
        const detailOverlay = document.querySelector('.match-detail-overlay, .spatial-matchup-panel');
        if (detailOverlay) detailOverlay.remove();
        // Close match modal if open
        document.getElementById('match-modal').classList.add('hidden');

        const target = document.getElementById('tab-' + state.tab);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('fade-in');
        }
        document.querySelector(`[data-tab="${state.tab}"]`)?.classList.add('tab-on');

        // Dynamic max-width for main content + bottom bar
        const w = TAB_MAX_WIDTHS[state.tab] || '720px';
        const main = document.getElementById('main-content');
        if (main) main.style.maxWidth = w;
        const bb = document.getElementById('bottom-bar-inner');
        if (bb) bb.style.maxWidth = w;

        if (state.tab === 'schedule' && !state.scheduleCache.length) loadSchedule();
        if (state.tab === 'standings') loadStandings();
        if (state.tab === 'teams') {
            document.getElementById('team-detail').classList.add('hidden');
            document.getElementById('teams-grid').classList.remove('hidden');
            loadTeams();
        }
        if (state.tab === 'prediction') loadPrediction();
        history.replaceState(null, '', '#' + state.tab);
    }

    // ========== Refresh ==========
    function togglePredDetail(id) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden');
    }

    function refreshAll() {
        const btn = document.getElementById('refresh-btn');
        btn.style.animation = 'spin 0.5s linear';
        setTimeout(() => (btn.style.animation = ''), 500);
        loadScores();
        if (state.tab === 'schedule') loadSchedule();
        if (state.tab === 'standings') loadStandings();
    }

    // ========== Clock ==========
    function tick() {
        const time = new Date().toLocaleTimeString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false,
        });
        const el = document.getElementById('clock');
        if (el) el.textContent = time + (state.uiLang === 'en' ? ' CST' : '');
    }

    // ========== Global AI Chat ==========
    function _appendChatBubble(container, role, text) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:12px;' +
            (role === 'user' ? 'align-items:flex-end' : 'align-items:flex-start');
        const label = document.createElement('span');
        label.style.cssText = 'font:400 9px/1 \'Inter\';color:rgba(248,250,252,.3)';
        label.textContent = role === 'user' ? 'You' : 'AI Assistant';
        const bubble = document.createElement('div');
        bubble.style.cssText = role === 'user'
            ? 'background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.15);border-radius:16px 16px 4px 16px;padding:10px 14px;font:400 13px/1.5 \'Inter\';color:#f8fafc;max-width:85%;word-break:break-word'
            : 'background:rgba(255,255,255,.06);border-radius:16px 16px 16px 4px;padding:10px 14px;font:400 13px/1.5 \'Inter\';color:rgba(248,250,252,.7);max-width:85%;word-break:break-word';
        bubble.textContent = text || '';
        wrap.appendChild(label);
        wrap.appendChild(bubble);
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
        return bubble;
    }

    function _typewriterEffect(el, text, speed) {
        speed = speed || 18;
        return new Promise(resolve => {
            let i = 0;
            const scroll = () => { el.parentElement.parentElement.scrollTop = el.parentElement.parentElement.scrollHeight; };
            (function type() {
                if (i < text.length) { el.textContent += text.charAt(i); i++; scroll(); setTimeout(type, speed); }
                else resolve();
            })();
        });
    }

    async function sendGlobalChatMessage(question) {
        const input = document.getElementById('global-chat-input');
        const msg = question || input.value.trim();
        if (!msg) return;
        if (!question) input.value = '';
        const container = document.getElementById('global-chat-messages');
        _appendChatBubble(container, 'user', msg);
        const aiBubble = _appendChatBubble(container, 'ai', '');
        aiBubble.style.opacity = '0.5';
        try {
            const res = await fetch('/api/bot/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: msg, context: 'global-feedback', uiLang: state.uiLang }),
            });
            const data = await res.json();
            aiBubble.style.opacity = '1';
            await _typewriterEffect(aiBubble, data.answer || data.error || 'No response', 15);
        } catch (e) {
            aiBubble.style.opacity = '1';
            aiBubble.style.color = 'rgba(248,113,113,.7)';
            aiBubble.textContent = window.t('发送失败，请稍后再试。', 'Send failed. Please try again later.');
        }
    }

    // ========== Event Delegation: Nav Tabs ==========
    document.getElementById('nav')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        switchTab(btn.dataset.tab);
    });

    // ========== Event Delegation: data-action ==========
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        if (action === 'set-lang') return window.setLanguage(target.dataset.lang);
        if (action === 'refresh-all') return refreshAll();
        if (action === 'close-team-modal') return window.closeTeamModal();
        if (action === 'close-modal') return window.closeModal();
        if (action === 'open-match') return window.openMatch(target.dataset.matchId);
        if (action === 'open-match-from-bracket') return window.openMatch(target.dataset.matchId);
        if (action === 'open-pre-match') {
            return window.openPreMatch(
                target.dataset.matchId,
                target.dataset.homeId || '',
                target.dataset.awayId || '',
                target.dataset.homeName || '',
                target.dataset.awayName || '',
                target.dataset.venueName || ''
            );
        }
        if (action === 'filter-date') return window.filterDate(target.dataset.date);
        if (action === 'open-team-detail') {
            e.stopPropagation();
            return window.openTeamDetail(target.dataset.teamId, target.dataset.teamName || '', target.dataset.group || '');
        }
        if (action === 'toggle-pred-detail') return togglePredDetail(target.dataset.target);
        if (action === 'open-player-detail') {
            const ds = target.dataset;
            const inline = ds.playerName
                ? { name: ds.playerName, pos: ds.playerPos, jersey: ds.playerJersey, age: ds.playerAge, height: ds.playerHeight, nationality: ds.playerNationality }
                : null;
            return window.openPlayerDetail(ds.playerId, inline, ds.teamId);
        }
        if (action === 'switch-detail-tab') return window.switchDetailTab(target.dataset.detailTab, target);
        if (action === 'switch-standings-tab') return window.switchStandingsSubTab(target.dataset.standingsTab, target);
        if (action === 'switch-standings-sub-tab') return window.switchStandingsSubTab(target.dataset.standingsTab, target);
        if (action === 'set-pitch-view') return window.setPitchView(target.dataset.view, target);
        if (action === 'send-ai-message') {
            return window.sendAIMessage(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId);
        }
        if (action === 'ask-ai-preset') {
            return window.askAIPreset(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId, target.dataset.question);
        }
        if (action === 'close-global-chat') {
            e.stopPropagation();
            document.getElementById('global-chat-modal')?.classList.add('hidden');
            document.body.style.overflow = '';
            return;
        }
        if (action === 'send-global-chat') return sendGlobalChatMessage();
        if (action === 'ask-global-preset') {
            const q = target.dataset.question;
            if (q) sendGlobalChatMessage(q);
            return;
        }
    });

    // ========== Event Delegation: Player Tooltips ==========
    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-action="show-player-tip"]');
        if (target) window.showTipFromDataset(target);
    });
    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-action="show-player-tip"]');
        if (target) window.hideTip();
    });

    // ========== Event Delegation: Keyboard ==========
    document.addEventListener('keydown', (e) => {
        const target = e.target.closest('[data-key-action]');
        if (!target || e.key !== 'Enter') return;
        if (target.dataset.keyAction === 'send-ai-message') {
            window.sendAIMessage(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId);
        }
    });

    // ========== Global AI Chat — Enter key in input ==========
    const globalChatInput = document.getElementById('global-chat-input');
    if (globalChatInput) {
        globalChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendGlobalChatMessage();
        });
    }

    // ========== Tab from URL Hash ==========
    window.addEventListener('DOMContentLoaded', () => {
        const hash = location.hash.slice(1);
        if (hash && document.getElementById('tab-' + hash)) switchTab(hash);
    });
    window.addEventListener('popstate', () => {
        const hash = location.hash.slice(1);
        if (hash && document.getElementById('tab-' + hash)) switchTab(hash);
    });

    // ========== Expose for HTML onclick handlers ==========
    window.switchTab = switchTab;
    window.togglePredDetail = togglePredDetail;
    window.refreshAll = refreshAll;

    // ========== Init ==========
    tick();
    setInterval(tick, 1000);
    window.applyLanguage();
    loadScores().then(() => {
        // Pre-fill scheduleCache with live data so HUD lookups work without visiting Schedule tab
        const liveMatches = window.WorldCup.State._lastScoresMatches || [];
        if (liveMatches.length) {
            const cache = window.WorldCup.State.scheduleCache;
            const existingIds = new Set(cache.map(m => String(m.id)));
            for (const m of liveMatches) { if (!existingIds.has(String(m.id))) cache.push(m); }
        }
    });
    const autoRefresh = setInterval(() => {
        if (document.hidden) return;
        loadScores();
    }, 120000);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.tab === 'live') loadScores();
    });

    // ========== Service Worker (PWA) ==========
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js?v=20260629').catch(() => {});
    }
})();
