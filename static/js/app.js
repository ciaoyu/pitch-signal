// ========== app.js — Thin Orchestrator ==========
// All feature logic lives in separate modules (scores.js, schedule.js, etc.).
// This file only wires: tab routing, event delegation, clock, and init.
(function () {
    'use strict';

    const state = window.WorldCup.State;
    const { tab } = state; // shorthand; state.tab is mutated via switchTab

    // ========== Tab + URL Routing ==========
    function switchTab(newTab) {
        state.tab = newTab;
        // Hide all tab content AND any match detail overlay
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('tab-on'));
        // Close match detail / spatial matchup overlay if open
        const detailOverlay = document.querySelector('.match-detail-overlay, .spatial-matchup-panel');
        if (detailOverlay) detailOverlay.remove();
        document.getElementById('tab-' + state.tab).classList.remove('hidden');
        document.getElementById('tab-' + state.tab).classList.add('fade-in');
        document.querySelector(`[data-tab="${state.tab}"]`)?.classList.add('tab-on');
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

    // ========== Global AI Chat (compatibility guard) ==========
    function _appendGlobalBubble(container, label, labelClass, bodyClass, text) {
        const wrap = document.createElement('div');
        wrap.className = 'flex flex-col gap-1 ' + (labelClass.includes('mr-') ? 'items-end' : 'items-start');
        const lbl = document.createElement('span');
        lbl.className = labelClass;
        lbl.textContent = label;
        const body = document.createElement('div');
        body.className = bodyClass;
        const parts = String(text || '').split('\n');
        parts.forEach((part, i) => {
            if (i > 0) body.appendChild(document.createElement('br'));
            body.appendChild(document.createTextNode(part));
        });
        wrap.appendChild(lbl);
        wrap.appendChild(body);
        container.appendChild(wrap);
        return wrap;
    }

    async function sendGlobalChatMessage() {
        const input = document.getElementById('global-chat-input');
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        const container = document.getElementById('global-chat-messages');
        _appendGlobalBubble(container, 'You', 'text-[9px] text-gray-500 mr-1',
            'bg-purple-600 rounded-2xl rounded-tr-sm px-4 py-2 text-sm text-white', msg);
        const loadingId = 'loading-' + Date.now();
        const loadingWrap = _appendGlobalBubble(container, 'AI Assistant', 'text-[9px] text-gray-500 ml-1',
            'bg-white/10 rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-gray-400 italic', '...');
        loadingWrap.id = loadingId;
        container.scrollTop = container.scrollHeight;
        try {
            const res = await fetch('/api/bot/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: msg, context: 'global-feedback', uiLang: state.uiLang }),
            });
            const data = await res.json();
            document.getElementById(loadingId)?.remove();
            _appendGlobalBubble(container, 'AI Assistant', 'text-[9px] text-gray-500 ml-1',
                'bg-white/10 rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-gray-200', data.answer || 'Error');
        } catch (e) {
            document.getElementById(loadingId)?.remove();
            _appendGlobalBubble(container, 'Error', 'text-[9px] text-red-400 ml-1',
                'bg-red-500/20 border border-red-500/50 text-red-200 rounded-2xl rounded-tl-sm px-4 py-2 text-sm',
                window.t('发送失败，请稍后再试。', 'Send failed. Please try again later.'));
        }
        container.scrollTop = container.scrollHeight;
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
            return window.openPlayerDetail(ds.playerId, inline);
        }
        if (action === 'switch-detail-tab') return window.switchDetailTab(target.dataset.detailTab, target);
        if (action === 'set-pitch-view') return window.setPitchView(target.dataset.view, target);
        if (action === 'send-ai-message') {
            return window.sendAIMessage(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId);
        }
        if (action === 'ask-ai-preset') {
            return window.askAIPreset(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId, target.dataset.question);
        }
        if (action === 'close-global-chat') {
            document.getElementById('global-chat-modal')?.classList.add('hidden');
            document.body.style.overflow = '';
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

    // ========== Global AI Chat Button (compatibility guard) ==========
    const globalChatToggle = document.getElementById('ai-chat-toggle');
    const globalChatSend = document.getElementById('global-chat-send');
    const globalChatInput = document.getElementById('global-chat-input');
    if (globalChatToggle && globalChatSend && globalChatInput) {
        globalChatToggle.addEventListener('click', () => {
            document.getElementById('global-chat-modal')?.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        });
        globalChatSend.addEventListener('click', sendGlobalChatMessage);
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
    loadScores();
    const autoRefresh = setInterval(loadScores, 120000);

    // ========== Service Worker (PWA) ==========
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js?v=20260629').catch(() => {});
    }
})();
