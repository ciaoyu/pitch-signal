/**
 * AI 智能反馈与问答 Bot 客户端逻辑
 */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('ai-bot-root');
  if (!root) return;

  function currentLang() {
    const lang = window.uiLang || localStorage.getItem('worldcup_lang') || document.documentElement.lang || 'zh';
    return lang === 'en' ? 'en' : 'zh';
  }

  function tx(zh, en) {
    return currentLang() === 'en' ? en : zh;
  }

  root.innerHTML = `
    <div id="ai-bot-fab" class="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300 cursor-pointer z-[9999] text-2xl" title="${tx('提问与反馈', 'Ask & Feedback')}">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
    </div>
    <div id="ai-bot-panel" class="fixed bottom-24 right-6 w-[350px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-7.5rem)] bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 rounded-2xl shadow-2xl flex flex-col z-[9998] opacity-0 pointer-events-none translate-y-5 transition-all duration-300 overflow-hidden">
      <div class="bot-header flex justify-between items-center px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 text-white shadow-sm flex-shrink-0">
        <span id="ai-bot-title" class="font-semibold tracking-wide">${tx('AI 智能助理', 'AI Assistant')}</span>
        <span class="cursor-pointer text-2xl leading-none hover:text-blue-200 transition-colors" id="ai-bot-close">&times;</span>
      </div>
      <div class="flex border-b border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 flex-shrink-0">
        <button id="bot-tab-ask" class="bot-tab flex-1 py-2.5 text-xs font-medium transition-all duration-200 border-b-2 border-blue-500 text-blue-600 dark:text-blue-400">${tx('问问题', 'Ask')}</button>
        <button id="bot-tab-msg" class="bot-tab flex-1 py-2.5 text-xs font-medium transition-all duration-200 border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">${tx('留言 / 意见', 'Leave a note')}</button>
      </div>
      <div class="bot-messages flex-1 p-5 overflow-y-auto flex flex-col gap-4 scroll-smooth" id="bot-messages">
        <div class="bot-msg ai self-start max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-100 dark:border-slate-700/50" id="ai-bot-greeting"></div>
      </div>
      <div class="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 flex gap-3 items-end flex-shrink-0">
        <textarea id="bot-input-el" rows="1" class="flex-1 px-4 py-2.5 bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-2xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner resize-none overflow-hidden leading-snug" style="min-height:40px;max-height:120px" autocomplete="off"></textarea>
        <button id="bot-send-btn" class="bg-blue-600 hover:bg-blue-700 text-white border-none rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
          <svg class="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
        </button>
      </div>
    </div>
  `;

  const fab       = document.getElementById('ai-bot-fab');
  const panel     = document.getElementById('ai-bot-panel');
  const closeBtn  = document.getElementById('ai-bot-close');
  const msgs      = document.getElementById('bot-messages');
  const inputEl   = document.getElementById('bot-input-el');
  const sendBtn   = document.getElementById('bot-send-btn');
  const tabAsk    = document.getElementById('bot-tab-ask');
  const tabMsg    = document.getElementById('bot-tab-msg');
  const greeting  = document.getElementById('ai-bot-greeting');

  let chatHistory = [];
  let mode = 'ask'; // 'ask' | 'message'

  const GREETINGS = {
    ask: {
      zh: '您好！我是赛事分析助理。如果您对预测逻辑有疑问，或发现任何数据错误，请随时告诉我。',
      en: 'Hi! I am the match analysis assistant. Ask me about prediction logic or report any data issues here.',
    },
    message: {
      zh: '欢迎留言！您对赛事预测、数据展示或产品体验有任何想法，都可以在这里告诉我们。留言会被汇总供团队参考，不会有 AI 实时回复。',
      en: 'Welcome! Feel free to leave any thoughts about predictions, data, or the product. Messages are collected for the team — there is no live AI reply here.',
    },
  };

  function setGreeting() {
    greeting.textContent = GREETINGS[mode][currentLang()];
  }

  function setTabActive(activeTab, inactiveTab) {
    activeTab.classList.add('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
    activeTab.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400', 'hover:text-slate-700', 'dark:hover:text-slate-200');
    inactiveTab.classList.remove('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
    inactiveTab.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400', 'hover:text-slate-700', 'dark:hover:text-slate-200');
  }

  function switchMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    chatHistory = [];
    msgs.innerHTML = '';
    msgs.appendChild(greeting);
    setGreeting();
    updatePlaceholder();
    if (mode === 'ask') {
      setTabActive(tabAsk, tabMsg);
    } else {
      setTabActive(tabMsg, tabAsk);
    }
  }

  tabAsk.addEventListener('click', () => switchMode('ask'));
  tabMsg.addEventListener('click', () => switchMode('message'));

  function updatePlaceholder() {
    if (mode === 'ask') {
      inputEl.placeholder = tx('输入您的问题…', 'Type your question…');
    } else {
      inputEl.placeholder = tx('留下您的想法或意见…', 'Share your thoughts or feedback…');
    }
  }

  function syncBotLanguage() {
    fab.title = tx('提问与反馈', 'Ask & Feedback');
    document.getElementById('ai-bot-title').textContent = tx('AI 智能助理', 'AI Assistant');
    tabAsk.textContent = tx('问问题', 'Ask');
    tabMsg.textContent = tx('留言 / 意见', 'Leave a note');
    setGreeting();
    updatePlaceholder();
  }

  fab.addEventListener('click', () => {
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) inputEl.focus();
  });

  closeBtn.addEventListener('click', () => panel.classList.remove('active'));

  // Auto-grow textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  function getPageContext() {
    const hash = window.location.hash;
    const ctx = { currentRoute: hash, uiLang: currentLang() };
    if (hash.startsWith('#predict/')) {
      ctx.matchId = hash.split('/')[1];
      const home = document.querySelector('#pred-home-team .pred-team-name');
      const away = document.querySelector('#pred-away-team .pred-team-name');
      if (home && away) ctx.teams = `${home.textContent} vs ${away.textContent}`;
    }
    return ctx;
  }

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = role === 'user'
      ? 'bot-msg user self-end max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed bg-blue-600 text-white shadow-sm'
      : 'bot-msg ai self-start max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-100 dark:border-slate-700/50';
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'bot-msg ai typing-indicator self-start px-4 py-3.5 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-1';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  async function sendAsk(text) {
    chatHistory.push({ role: 'user', content: text });
    const tid = showTyping();
    try {
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, context: getPageContext() }),
      });
      removeTyping(tid);
      if (!res.ok) throw new Error('network');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addMessage(data.response, 'ai');
      chatHistory.push({ role: 'assistant', content: data.response });
    } catch (err) {
      removeTyping(tid);
      console.error('Chat error:', err);
      addMessage(tx(
        'AI 助理暂不可用，公测期间智能问答功能尚未开放。',
        'AI assistant is temporarily unavailable during public beta.'
      ), 'ai');
    }
  }

  async function sendLeaveMessage(text) {
    const tid = showTyping();
    try {
      const res = await fetch('/api/bot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          uiLang: currentLang(),
          pageUrl: window.location.href,
          context: getPageContext(),
        }),
      });
      removeTyping(tid);
      const data = res.ok ? await res.json() : null;
      addMessage(data?.response || tx('感谢您的留言，我们已收到！', 'Thanks! Your message has been received.'), 'ai');
    } catch (err) {
      removeTyping(tid);
      console.error('Message error:', err);
      addMessage(tx('留言发送失败，请稍后再试。', 'Failed to send. Please try again.'), 'ai');
    }
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    inputEl.disabled = true;
    sendBtn.disabled = true;
    addMessage(text, 'user');
    try {
      if (mode === 'ask') {
        await sendAsk(text);
      } else {
        await sendLeaveMessage(text);
      }
    } finally {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener('click', handleSend);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Init
  setGreeting();
  updatePlaceholder();
  window.addEventListener('storage', syncBotLanguage);
  document.addEventListener('click', () => setTimeout(syncBotLanguage, 0));
});
