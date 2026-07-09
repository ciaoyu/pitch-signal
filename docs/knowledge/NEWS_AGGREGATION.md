# 新闻聚合系统

## 一、系统概述

新闻聚合系统为世界杯比赛提供实时新闻搜索、AI摘要、重要性分级等功能，帮助用户快速了解比赛相关的最新动态。

### 核心功能

1. **新闻搜索** - 基于球队、球员、教练的新闻搜索
2. **AI摘要** - 自动生成新闻摘要
3. **重要性分级** - 🔴重大 / 🟡中等 / 🟢一般
4. **新闻来源** - 多个权威体育媒体
5. **实时更新** - 赛前、赛中、赛后新闻

---

## 二、新闻分类

### 2.1 按比赛阶段分类

#### 赛前新闻 (Pre-match)
- 阵容消息
- 伤病/停赛
- 教练发言
- 战术分析
- 历史交锋

#### 赛中新闻 (In-match)
- 进球/红牌
- 伤病事件
- 战术调整
- 实时统计

#### 赛后新闻 (Post-match)
- 赛后总结
- 最佳球员
- 教练评论
- 数据分析

### 2.2 按重要性分级

| 等级 | 标记 | 说明 | 示例 |
|------|------|------|------|
| 重大 | 🔴 | 影响比赛结果 | 核心球员伤病、停赛、首发变动 |
| 中等 | 🟡 | 战术相关 | 战术变化、教练发言、阵型调整 |
| 一般 | 🟢 | 背景信息 | 训练、氛围、历史回顾 |

### 2.3 按内容类型分类

- **伤病消息** 🏥
- **阵容消息** 📋
- **战术消息** 🧠
- **教练消息** 👔
- **球员消息** 👤
- **历史数据** 📊
- **场外新闻** 🎭

---

## 三、搜索策略

### 3.1 搜索关键词

#### 基础关键词
- 球队名 (英文/中文)
- 球员名 (英文/中文)
- 教练名 (英文/中文)
- 比赛对阵 (如 "USA vs Paraguay")

#### 组合关键词
- 球队 + "preview" (赛前分析)
- 球队 + "lineup" (阵容消息)
- 球队 + "injury" (伤病消息)
- 教练 + "press conference" (教练发言)
- 球员 + "transfer" (转会消息)

#### 时间限定
- "today" (今天)
- "this week" (本周)
- "before match" (赛前)
- "after match" (赛后)

### 3.2 搜索流程

```
1. 提取比赛信息 (球队、球员、教练)
2. 生成搜索关键词列表
3. 调用 Tavily API 搜索
4. 过滤和去重
5. AI摘要生成
6. 重要性分级
7. 返回结果
```

### 3.3 搜索示例

**比赛**: 美国 vs 巴拉圭

**搜索关键词**:
1. "USA vs Paraguay preview"
2. "USMNT lineup news"
3. "Pulisic injury update"
4. "Berhalter press conference"
5. "Paraguay team news"

---

## 四、AI摘要生成

### 4.1 摘要策略

#### 摘要长度
- 短摘要: 50-100字 (卡片显示)
- 中摘要: 100-200字 (详情展开)
- 长摘要: 200-300字 (完整分析)

#### 摘要要素
- **核心事件**: 发生了什么
- **影响分析**: 对比赛有什么影响
- **来源可信度**: 消息来源的可靠性
- **时间信息**: 什么时候发生

### 4.2 摘要模板

```
[重要性标记] [事件类型]
[核心事件]
[影响分析]
[来源] · [时间]
```

**示例**:
```
🔴 伤病消息
Pulisic 在周三训练中扭伤脚踝，队医正在评估其出场可能性。
如果 Pulisic 缺阵，美国队的进攻威胁将大幅下降。
The Athletic · 3小时前
```

### 4.3 摘要算法

```javascript
function generateSummary(article, matchContext) {
  // 1. 提取关键信息
  const keyInfo = extractKeyInfo(article);
  
  // 2. 分析重要性
  const importance = analyzeImportance(keyInfo, matchContext);
  
  // 3. 生成摘要
  const summary = formatSummary({
    importance: importance,
    event: keyInfo.event,
    impact: keyInfo.impact,
    source: article.source,
    time: article.publishedAt
  });
  
  return summary;
}
```

---

## 五、新闻来源

### 5.1 优先级来源

| 来源 | 类型 | 可信度 | 说明 |
|------|------|--------|------|
| ESPN | 综合 | ⭐⭐⭐⭐⭐ | 官方合作伙伴 |
| The Athletic | 深度分析 | ⭐⭐⭐⭐⭐ | 高质量长文 |
| BBC Sport | 综合 | ⭐⭐⭐⭐⭐ | 权威媒体 |
| Sky Sports | 综合 | ⭐⭐⭐⭐ | 英国权威 |
| Marca | 西班牙 | ⭐⭐⭐⭐ | 西语权威 |
| Bild | 德国 | ⭐⭐⭐⭐ | 德语权威 |
| L'Equipe | 法国 | ⭐⭐⭐⭐ | 法语权威 |

### 5.2 来源筛选

```javascript
function filterSources(articles) {
  const trustedSources = [
    'ESPN', 'The Athletic', 'BBC Sport', 
    'Sky Sports', 'Marca', 'Bild', 'L\'Equipe',
    'Goal.com', 'Sports Illustrated', 'Fox Sports'
  ];
  
  return articles.filter(article => 
    trustedSources.some(source => 
      article.source.toLowerCase().includes(source.toLowerCase())
    )
  );
}
```

---

## 六、前端展示设计

### 6.1 新闻卡片

```
┌─────────────────────────────────────────┐
│  📰 赛前新闻                             │
│                                         │
│  🔴 Pulisic 训练中脚踝不适，出场存疑     │
│     The Athletic · 3小时前              │
│     "Pulisic 在周三训练中扭伤脚踝，      │
│      队医正在评估其出场可能性..."         │
│                                         │
│  🟡 巴拉圭主教练暗示变阵 3-5-2           │
│     ESPN Deportes · 6小时前             │
│     "主教练表示可能采用三后卫阵型..."     │
│                                         │
│  🟢 美国队全员合练，阵容齐整             │
│     US Soccer · 1天前                   │
│     "球队在训练基地进行了完整合练..."     │
│                                         │
│  🟢 巴拉圭抵达比赛城市                   │
│     AP · 2天前                          │
│     "球队已抵达洛杉矶，进行适应性训练..." │
└─────────────────────────────────────────┘
```

### 6.2 新闻详情展开

```
┌─────────────────────────────────────────┐
│  📰 新闻详情                             │
│                                         │
│  🔴 Pulisic 训练中脚踝不适，出场存疑     │
│     The Athletic · 3小时前              │
│                                         │
│  Christian Pulisic 在周三的训练中扭伤    │
│  了脚踝，目前美国队医团队正在评估他的    │
│  出场可能性。                           │
│                                         │
│  据知情人士透露，Pulisic 在训练的最后    │
│  阶段与队友发生碰撞，随后一瘸一拐地      │
│  离开了训练场。队医将在赛前做出最终      │
│  决定。                                 │
│                                         │
│  如果 Pulisic 无法出场，预计 Brenden    │
│  Aaronson 将顶替他的位置。这将对美国     │
│  队的进攻组织产生重大影响。              │
│                                         │
│  来源: The Athletic                      │
│  链接: https://theathletic.com/...       │
│  发布: 2026-06-13 15:30 UTC             │
└─────────────────────────────────────────┘
```

### 6.3 比赛详情中的位置

新闻应放在比赛详情 Modal 的 **📰 新闻** Tab 中，以及赛程卡片下方显示摘要。

---

## 七、API 端点设计

### 7.1 获取比赛新闻

```
GET /api/match/:id/news
```

**参数:**
- `type`: 新闻类型 (pre/in/post)
- `limit`: 返回数量 (默认10)
- `importance`: 重要性过滤 (red/yellow/green)

**响应:**
```json
{
  "matchId": "401581705",
  "news": [
    {
      "id": "news1",
      "title": "Pulisic 训练中脚踝不适，出场存疑",
      "summary": "Pulisic 在周三训练中扭伤脚踝，队医正在评估其出场可能性。",
      "content": "...",
      "importance": "red",
      "type": "injury",
      "source": "The Athletic",
      "url": "https://theathletic.com/...",
      "publishedAt": "2026-06-13T15:30:00Z",
      "relatedPlayers": ["Pulisic"],
      "relatedTeams": ["USA"],
      "tags": ["injury", "doubtful", "training"]
    },
    {
      "id": "news2",
      "title": "巴拉圭主教练暗示变阵 3-5-2",
      "summary": "主教练表示可能采用三后卫阵型对抗美国。",
      "content": "...",
      "importance": "yellow",
      "type": "tactical",
      "source": "ESPN Deportes",
      "url": "https://espn.com/...",
      "publishedAt": "2026-06-13T12:00:00Z",
      "relatedTeams": ["PAR"],
      "tags": ["formation", "tactics", "coach"]
    }
  ],
  "total": 15,
  "lastUpdated": "2026-06-13T18:00:00Z"
}
```

### 7.2 搜索新闻

```
GET /api/news/search
```

**参数:**
- `query`: 搜索关键词
- `team`: 球队ID
- `player`: 球员ID
- `from`: 开始时间
- `to`: 结束时间

**响应:**
```json
{
  "query": "USA Paraguay preview",
  "results": [...],
  "total": 25,
  "page": 1
}
```

---

## 八、实现计划

### Phase 1: Tavily集成 (1天)
- [ ] 配置Tavily API Key
- [ ] 实现基础搜索功能
- [ ] 添加结果缓存

### Phase 2: AI摘要 (1天)
- [ ] 实现摘要生成算法
- [ ] 添加重要性分级
- [ ] 优化摘要质量

### Phase 3: 前端展示 (1天)
- [ ] 设计新闻卡片
- [ ] 实现新闻详情展开
- [ ] 集成到比赛详情

### Phase 4: 优化完善 (0.5天)
- [ ] 添加更多新闻源
- [ ] 优化搜索算法
- [ ] 测试和调试

---

## 九、技术要点

### 9.1 Tavily API集成

```javascript
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

async function searchNews(query, options = {}) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: options.depth || 'basic',
      include_answer: true,
      include_raw_content: false,
      max_results: options.limit || 10
    })
  });
  
  return await response.json();
}
```

### 9.2 缓存策略

- **搜索结果**: 1小时 TTL
- **新闻详情**: 24小时 TTL
- **摘要**: 长期缓存

### 9.3 错误处理

- API调用失败: 返回缓存结果
- 摘要生成失败: 返回原文前200字
- 搜索无结果: 返回默认新闻

---

## 十、数据来源

| 数据 | 来源 | 更新频率 |
|------|------|----------|
| 新闻内容 | Tavily API | 实时 |
| 摘要生成 | AI模型 | 实时 |
| 重要性分级 | 规则引擎 | 实时 |
| 新闻来源 | 预定义列表 | 每月 |

---

## 十一、已知限制

1. **新闻时效性**: 搜索结果可能有延迟
2. **来源质量**: 部分来源可能不可靠
3. **摘要准确性**: AI摘要可能有偏差
4. **语言支持**: 主要支持英文新闻

---

## 十二、参考资料

- [Tavily API 文档](https://tavily.com/)
- [ESPN 新闻](https://www.espn.com/soccer/)
- [The Athletic](https://theathletic.com/)
- [BBC Sport](https://www.bbc.com/sport)

---

_文档版本：v1.0 | 2026-06-13 | by AI Coding Engineer_
