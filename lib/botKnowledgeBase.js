/**
 * Bot 知识库 — PitchSignal
 * 
 * 启动时加载 matchup-rating/*.md + docs/*.md，按 ## 小节建立关键词索引。
 * 提供 search(query, lang) 返回匹配的 markdown 段落。
 */
const fs = require('fs');
const path = require('path');

// ── 配置 ─────────────────────────────────────────────────
const KB_DIRS = [
  path.join(__dirname, '..', 'matchup-rating'),
  path.join(__dirname, '..', 'docs'),
];

// 每个 ## 节的关键词 manually curated map（节标题 → 自然语言提问关键词）
// 未在此 map 中的节按标题自动分词做索引。

const CURATED_KEYWORDS = {
  // SCORING_SYSTEM_DESIGN
  '综合胜率预测': ['综合胜率','胜率预测','composite','composite score','怎么算胜率','胜率怎么来的'],
  '球员对位评分': ['对位评分','球员评分','rating','对位','matchup rating','打分','评分系统','球员对位','对位怎么算'],
  '教练差异分': ['教练','coach','教练差异','教练影响','主帅','coach impact','教练怎么影响'],
  '风格克制矩阵': ['风格克制','style matrix','战术风格','风格相克','战术克制','tactical clash'],
  '位置系数': ['位置系数','position coefficient','位置权重'],
  // FORMATION_MATCHUP_TECH
  '对位阵型图': ['阵型图','formation diagram','formation chart','对位阵型','战术板'],
  '对位匹配算法': ['对位匹配','matchup algorithm','如何对位','什么是对位','对位算法','对位图','连线','对位连线是什么意思'],
  '位置等价表': ['位置等价','position mapping','4-3-3 vs 4-4-2','阵型映射','不同阵型怎么对位'],
  // VENUE_WEATHER_ANALYSIS
  '场地影响分析': ['场地','venue','球场','stadium','海拔','altitude','场地影响'],
  '天气数据集成': ['天气','weather','温度','temp','湿度','humidity','气候','climate'],
  '场馆数据结构': ['场馆','场馆信息','stadium info','球场数据'],
  // PLAYER_ENHANCED_DATA
  '球员增强数据': ['球员数据','player data','player enhanced','球员统计','球员信息'],
  '球员特色描述': ['球员特色','player traits','球员特点'],
  '近10场表现': ['近期表现','recent form','最近比赛'],
  // BENCH_ANALYSIS
  '替补分析': ['替补','bench','板凳','替补席','substitution','换人','轮换'],
  '替补深度': ['板凳深度','bench depth','替补实力'],
  // TEAM_DETAIL_ENHANCED
  '球队深度数据': ['球队数据','team data','球队详情'],
  '世界杯历史': ['世界杯历史','world cup history','历史战绩','historical results'],
  // NEWS_AGGREGATION
  '新闻聚合': ['新闻','news','最新消息','最新动态'],
  // CORNER_PREDICTION_MODEL
  '角球预测': ['角球','corner','corner kick','角球模型'],
  // ODDS_ANALYSIS_ENGINE
  '盘口分析': ['盘口','odds','赔率','betting','市场信号','market'],
  // prediction_model_explanation
  'Elo 实力引擎': ['elo','elo rating','实力评分','排名系统','elo ranking','elo 是什么'],
  'Poisson 进球引擎': ['poisson','泊松','泊松分布','进球期望','expected goals','lambda','λ','poisson model','进球模型'],
  'Dixon-Coles 修正': ['dixon-coles','低比分修正','0-0','平局修正'],
  '最可能比分': ['最可能比分','poisson mode','most likely score','比分预测'],
  '动态权重分配': ['动态权重','dynamic weights','权重','weight allocation'],
  '偏差分析': ['偏差','bias','测错','为什么测错','error analysis','预测不准'],
  // API
  'API 端点': ['api','endpoint','接口','数据来源'],
  // Default
  'default': ['帮助','help','能做什么','你能回答什么','功能'],
};

// ── 单索引结构 ───────────────────────────────────────────
let _sections = []; // [{ id, source, title, content, keywords:[] }]
let _initialized = false;

// 反向索引：关键词 → 节 id 列表
let _keywordIndex = new Map();

// ── 分词 ─────────────────────────────────────────────────
function tokenize(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  // 提取中文单字+英文单词
  const tokens = [];
  // 英文单词
  const enWords = lower.match(/[a-z0-9]+/g) || [];
  tokens.push(...enWords);
  // 中文双字/三字组合
  const cn = lower.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i < cn.length - 1; i++) tokens.push(cn.slice(i, i + 2));
  // 英文短词也独立索引
  return [...new Set(tokens)];
}

// ── 加载 ─────────────────────────────────────────────────
function init() {
  if (_initialized) return;
  
  _sections = [];
  const newKeywordIndex = new Map();

  for (const dir of KB_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const source = file.replace(/\.md$/, '');
      const lines = raw.split('\n');
      
      let currentSection = null;
      let contentLines = [];
      
      for (const line of lines) {
        const h2Match = line.match(/^##\s+(.+)/);
        const h1Match = line.match(/^#\s+(.+)/);
        
        if (h2Match || h1Match) {
          // 保存上一个节
          if (currentSection && contentLines.length > 0) {
            const content = contentLines.join('\n').trim();
            if (content.length > 20) {
              const title = currentSection.title;
              const curated = CURATED_KEYWORDS[title] || [];
              const autoTokens = tokenize(title);
              const keywords = [...new Set([...curated, ...autoTokens])];
              const id = `kb_${source}_${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 40)}`;
              
              _sections.push({ id, source, title, content, keywords });
              
              // 反向索引
              for (const kw of keywords) {
                if (!newKeywordIndex.has(kw)) newKeywordIndex.set(kw, new Set());
                newKeywordIndex.get(kw).add(id);
              }
            }
          }
          
          currentSection = { title: (h2Match || h1Match)[1].trim(), level: h2Match ? 2 : 1 };
          contentLines = [];
        } else if (currentSection) {
          contentLines.push(line);
        }
      }
      
      // 最后一个节
      if (currentSection && contentLines.length > 0) {
        const content = contentLines.join('\n').trim();
        if (content.length > 20) {
          const title = currentSection.title;
          const curated = CURATED_KEYWORDS[title] || [];
          const autoTokens = tokenize(title);
          const keywords = [...new Set([...curated, ...autoTokens])];
          const id = `kb_${source}_${title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 40)}`;
          
          _sections.push({ id, source, title, content, keywords });
          
          for (const kw of keywords) {
            if (!newKeywordIndex.has(kw)) newKeywordIndex.set(kw, new Set());
            newKeywordIndex.get(kw).add(id);
          }
        }
      }
    }
  }
  
  _keywordIndex = newKeywordIndex;
  _initialized = true;
  console.log(`🧠 Bot Knowledge Base loaded: ${_sections.length} sections from ${new Set(_sections.map(s => s.source)).size} docs`);
}

// ── 搜索 ─────────────────────────────────────────────────
/**
 * @param {string} query - 用户提问
 * @param {string} lang - 'zh' | 'en'
 * @returns {{ sections: Array, isExact: boolean }} 匹配的节列表
 */
function search(query, lang = 'zh') {
  if (!_initialized) init();
  if (!query) return { sections: [], isExact: false };
  
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    // 兜底：返回核心概念
    return { sections: _sections.filter(s => s.title.includes('综合胜率') || s.title.includes('对位匹配') || s.title.includes('预测')).slice(0, 3), isExact: false };
  }
  
  // 按命中关键词数打分
  const scored = new Map(); // id → score
  const matchedTokens = new Set();
  
  for (const token of tokens) {
    const ids = _keywordIndex.get(token);
    if (ids) {
      matchedTokens.add(token);
      for (const id of ids) {
        scored.set(id, (scored.get(id) || 0) + 1);
      }
    }
  }
  
  // 也做一次标题模糊匹配（用户可能写了相似但不完全相同的词）
  const qLower = query.toLowerCase();
  for (const s of _sections) {
    if (s.title.toLowerCase().includes(qLower) || qLower.includes(s.title.toLowerCase())) {
      scored.set(s.id, (scored.get(s.id) || 0) + 3);
    }
  }
  
  if (scored.size === 0) {
    // 空 key 兜底：返回 default 节
    const defaults = _sections.filter(s => s.title === 'default' || s.title.includes('帮助你'));
    if (defaults.length > 0) return { sections: defaults, isExact: false };
    // 否则返回前几个核心节
    return { sections: _sections.filter(s => s.source === 'prediction_model_explanation').slice(0, 3), isExact: false };
  }
  
  // 排序取 top 3
  const ranked = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  const sections = ranked.map(([id]) => _sections.find(s => s.id === id)).filter(Boolean);
  
  const isExact = matchedTokens.size >= 2 || ranked[0]?.[1] >= 3;
  
  return { sections, isExact };
}

/**
 * 将搜索结果组装成 system prompt 使用的长文本。
 */
function buildContextText(sections, lang) {
  if (!sections || sections.length === 0) {
    return lang === 'en'
      ? 'No relevant knowledge base entries found. Answer based on your general football knowledge.'
      : '未找到相关知识库内容。请基于通用的足球知识回答。';
  }
  
  const parts = [];
  for (const s of sections) {
    // 截断过长内容
    const content = s.content.length > 800 ? s.content.slice(0, 800) + '...(truncated)' : s.content;
    parts.push(`### ${s.title} (from ${s.source})\n${content}`);
  }
  
  return parts.join('\n\n---\n\n');
}

module.exports = { init, search, buildContextText, getSections: () => _sections };
