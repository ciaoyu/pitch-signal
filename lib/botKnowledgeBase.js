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
  // prediction-system-report
  '预测体系设计理念': ['预测体系','设计理念','预测原则','怎么设计的','预测系统','四层','prediction system','design','如何预测','prediction philosophy','ai预测','ai概率'],
  '赛前预测：贝叶斯框架': ['贝叶斯','bayesian','赛前预测','赛前','pre-match','先验','prior','后验','posterior','慢先验','快速证据','xg融合','xg blend'],
  '盘中重定价：Track A 与 Track B 严格分离': ['track a','track b','盘中','live repricing','重定价','盘中预测','盘中概率','动态概率','live probability','比赛中预测','压力信号','soft signal'],
  'Pressure Index（压力指数）': ['压力指数','pressure index','surge','surge检测','射正','角球压力','持续压力','持续告警','jordan algeria','约旦','阿尔及利亚','surge alert'],
  '赛后学习回路': ['学习回路','learning loop','赛后复盘','教训','lesson','teamspecificlessons','globalmodellessons','复盘','postmatch','赛后','lesson验证','模型改进'],
  'Match Moment 触发点体系': ['match moment','触发点','关键时刻','补水','hydration','半场','halftime','进球时刻','moment','比赛节点','关键节点','重要时刻'],
  '数据源与可靠性': ['数据来源','data source','espn','fifa api','api football','worldcupjson','数据可靠','数据详情','xg数据','数据稳定','置信区间','confidence interval'],
  '预测系统常见问题': ['为什么概率','faq','常见问题','胜率区间','为什么是区间','压力大但胜率没变','ai改变概率','ai不改概率'],
  // MATCH_DAY_REPORTS
  '比赛日回顾：I/J 组第一轮（阿根廷、法国首战告捷）': ['i组第一轮','j组第一轮','阿根廷奥地利','法国伊拉克','挪威塞内加尔','约旦阿尔及利亚','梅西进球纪录','梅西第一射手','克洛泽','哈兰德双响','姆巴佩首轮','第一比赛日','首轮比赛'],
  '比赛日回顾：K/L 组第二轮（C罗爆发，英格兰受阻）': ['c罗乌兹别克斯坦','葡萄牙大胜','英格兰加纳','0比0','英格兰平局','c罗梅开二度','第二轮k组','第二轮l组'],
  '比赛日回顾：A/B/C 组最后一轮（瑞士头名晋级，巴西锁定第一）': ['瑞士加拿大','波黑卡塔尔','阿拉伊贝戈维奇世界波','哲科150场','巴西苏格兰','加拿大历史首次淘汰赛','abc组收官','墨西哥晋级','韩国晋级'],
  '比赛日回顾：D/E/F 组最后一轮（厄瓜多尔爆冷德国，日本荷兰携手晋级）': ['厄瓜多尔德国','普拉塔制胜球','安古洛扳平','var取消点球','德国出局','日本瑞典','荷兰突尼斯','def组收官','美国晋级','厄瓜多尔爆冷'],
  '比赛日回顾：G/H/I 组最后一轮（法国三战全胜，登贝莱帽子戏法）': ['登贝莱帽子戏法','法国挪威4:1','塞内加尔5:0','西班牙头名','比利时5:1','特罗萨德','ghi组收官','法国全胜','登贝莱三球','最快帽子戏法'],
  '比赛日回顾：J/K/L 组最后一轮（英格兰头名晋级，阿尔及利亚逆超阿根廷）': ['英格兰巴拿马','克罗地亚加纳','弗拉希奇绝杀','莫德里奇角球','阿尔及利亚奥地利3:3','马赫雷斯','刚果金晋级','维萨梅开二度','哥伦比亚葡萄牙','jkl组收官','小组赛结束','32强产生','阿根廷小组第二'],
  '比赛日回顾：32强淘汰赛 — 加拿大点球晋级（加拿大 vs 南非）': ['加拿大南非','点球大战加拿大','南非首次淘汰赛','48队首场淘汰赛','乔纳森戴维','首场淘汰赛'],
  '比赛日回顾：32强淘汰赛 — 巴西险胜日本，巴拉圭点球淘汰德国': ['巴西日本','巴拉圭德国','德国淘汰赛出局','巴拉圭门将点球','巴西2:1日本','维尼修斯淘汰赛','巴拉圭冷门','德国淘汰'],
  '比赛日回顾：32强淘汰赛 — 摩洛哥点球淘汰荷兰': ['摩洛哥荷兰','布努扑救','迪奥普扳平','加克波','荷兰出局','摩洛哥晋级16强','摩洛哥加拿大','亚辛布努','补水换人进球','荷兰换人','加克波72分钟','摩洛哥追分','控球率压力'],
  '战术规律：比赛节点信号模式': ['比赛节点','match moment','补水暂停','补水换人','水暂停','教练干预','换人进球','换人后进球','立即进球','追分压力曲线','射门增加信号','角球信号','jordan algeria','surge模式','高压未进球','持续高压','压迫转化','控球率但没射门','控球不射门','追分方信号','实时压力信号'],
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
