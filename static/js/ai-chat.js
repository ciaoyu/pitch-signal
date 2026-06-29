/**
 * ai-chat.js — AI chat component for match detail
 * Extracted from app.js lines 4012-4098
 */
(function () {
    'use strict';
    const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
    const { tx } = window.WorldCup.Utils;
    const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);

    function renderAIChat(matchId, homeId, awayId, homeName, awayName) {
        const chatId = `ai-chat-${matchId}`;
        return `<div class="glass rounded-xl p-3"><h4 class="text-xs font-bold text-purple-400 mb-2">🤖 ${tx('AI 战术分析', 'AI Tactical Analysis')}</h4><div id="${attr(chatId)}-messages" class="space-y-2 max-h-48 overflow-y-auto mb-2"><div class="text-[11px] text-gray-500 text-center py-2">${tx('询问 AI 关于这场比赛的任何问题...', 'Ask AI anything about this match...')}</div></div><div class="flex gap-2"><input type="text" id="${attr(chatId)}-input" placeholder="${tx('例：谁会赢？关键对位？战术分析？', 'Example: who will win? key matchups? tactics?')}" class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500" data-key-action="send-ai-message" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}"><button data-action="send-ai-message" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" class="bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-500/30">${tx('发送', 'Send')}</button></div><div class="mt-2 flex flex-wrap gap-1"><button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx('谁会赢？', 'Who will win?'))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx('谁会赢？', 'Who wins?')}</button><button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx('关键对位分析', 'Key matchup analysis'))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx('关键对位', 'Key matchups')}</button><button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx('战术风格对比', 'Tactical style comparison'))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx('战术对比', 'Tactics')}</button></div></div>`;
    }

    function appendChatMessage(messages, text, align, spanClass, id) {
        const row = document.createElement('div');
        row.className = align;
        if (id) row.id = id;
        const span = document.createElement('span');
        span.className = spanClass;
        span.textContent = text;
        row.appendChild(span);
        messages.appendChild(row);
        return row;
    }

    async function sendAIMessage(chatId, matchId, homeId, awayId) {
        const input = document.getElementById(`${chatId}-input`);
        const messages = document.getElementById(`${chatId}-messages`);
        const question = input.value.trim();
        if (!question) return;
        appendChatMessage(messages, question, 'text-right', 'text-[11px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg inline-block');
        input.value = '';
        messages.scrollTop = messages.scrollHeight;
        const loadingId = 'loading-' + Date.now();
        appendChatMessage(messages, tx('AI 思考中...', 'AI is thinking...'), 'text-left', 'text-[11px] text-gray-500', loadingId);
        messages.scrollTop = messages.scrollHeight;
        try {
            const response = await api('/api/bot/ask', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, matchId, homeId, awayId, context: 'worldcup-matchup', uiLang: window.WorldCup.State?.uiLang || 'zh' })
            });
            document.getElementById(loadingId)?.remove();
            const answer = response?.answer || response?.error || tx('抱歉，暂时无法回答这个问题。', 'Sorry, I cannot answer that right now.');
            appendChatMessage(messages, answer, 'text-left', 'text-[11px] bg-white/5 text-gray-300 px-2 py-1 rounded-lg inline-block');
        } catch (err) {
            document.getElementById(loadingId)?.remove();
            appendChatMessage(messages, `${tx('请求失败', 'Request failed')}: ${err.message}`, 'text-left', 'text-[11px] text-red-400 px-2 py-1');
        }
        messages.scrollTop = messages.scrollHeight;
    }

    function askAIPreset(chatId, matchId, homeId, awayId, question) {
        const input = document.getElementById(`${chatId}-input`);
        input.value = question;
        sendAIMessage(chatId, matchId, homeId, awayId);
    }

    window.WorldCup.AIChat = { renderAIChat, appendChatMessage, sendAIMessage, askAIPreset };
    Object.assign(window, { renderAIChat, appendChatMessage, sendAIMessage, askAIPreset });
})();
