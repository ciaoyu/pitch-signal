# PitchSignal UI 设计交接文档

**项目**: 2026 FIFA 世界杯实时赛事分析平台
**技术栈**: Node.js 后端 + Vanilla JS SPA 前端 + Tailwind CSS v3
**当前分支**: `ui-immersive-v2`
**更新日期**: 2026-06-26

---

## 一、产品概述

### 1.1 PitchSignal 是什么？

一个 2026 FIFA 世界杯的实时数据分析仪表盘。用数学模型做赛前预测，用实时数据做赛中追踪。

**核心价值**：
- **Elo + Poisson 预测模型**：基于球队评分 + 泊松分布计算每场比赛的胜/平/负概率和预期比分
- **场地因子分析**：海拔、草皮类型、温度、湿度对比赛的量化影响
- **战术板**：球场 SVG 上的 11v11 站位 + 逐位置对抗连线
- **AI 助手**：用 Claude Haiku 回答赛事问题

**目标用户**：球迷、数据分析爱好者、体育媒体

### 1.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Node.js (纯原生 http) | 零框架依赖，`server.js` 单文件路由 |
| 数据库 | SQLite | WAL 模式，19 张表 |
| 前端 | Vanilla JS SPA | 无 React/Vue，纯 DOM 操作 |
| CSS | Tailwind CSS v3.4 | 预编译到 `tailwind-output.css` |
| 图表 | Chart.js (CDN) | 雷达图、趋势图 |
| 部署 | Railway | 持久化卷在 `/data/` |
| 数据源 | ESPN API | 实时比分/赛程/球员 |

### 1.3 项目文件结构（前端相关）

```
pitch-signal/
├── templates/
│   └── index.html              # 主 HTML（234 行）
├── static/
│   ├── js/
│   │   ├── app.js              # 主控制器（4305 行，218KB）
│   │   ├── match-renderers.js  # 比赛详情渲染器（1080 行）
│   │   ├── api-client.js       # API 封装（221 行）
│   │   ├── formatters.js       # 工具函数（314 行）
│   │   ├── bot.js              # AI 聊天 UI（258 行）
│   │   └── bracket.js          # 淘汰赛树（330 行）
│   ├── css/
│   │   ├── tailwind-output.css # 编译后 Tailwind（32KB）
│   │   ├── bot.css             # 聊天动画（42 行）
│   │   ├── bracket.css         # 淘汰赛样式（84 行）
│   │   └── schedule.css        # 日期选择器样式（60 行）
│   └── design-system.html      # 设计 token 预览（可浏览器打开）
└── server.js                   # 后端入口
```

---

## 二、功能模块地图

### 2.1 宏观层（Layer 3）— 5 个主 Tab

| Tab | 功能 | 数据来源 | 渲染函数 |
|-----|------|----------|----------|
| 比分 Live | 实时比分，比赛状态（进行中/已结束/未开始） | `GET /api/scores` | `loadScores()` |
| 赛程 Schedule | 日期滚动条 + 比赛卡片列表 | `GET /api/schedule` | `loadSchedule()` |
| 预测 Prediction | 所有比赛的胜/平/负概率、Elo 排名 | `GET /api/elo/rankings` | `loadPrediction()` |
| 积分 Standings | 小组积分表 + 淘汰赛 bracket 树 | `GET /api/standings` | `loadStandings()` |
| 球队 Teams | 球队卡片网格 → 点击展开详情 | `GET /api/team/:id` | `loadTeams()` |

### 2.2 沉浸层（Layer 4 HUD）— 比赛详情视图

点击赛程卡片 → 触发 `openMatch(id)` → 切入沉浸式 HUD：

```
┌─────────────────────────────────────────────────┐
│  [← Back]        HUD-Score (比分)        [⚙️]  │  ← 顶部控制栏
├──────────┬──────────────────────┬────────────────┤
│ HUD-Left │     Pitch Layer 0   │   HUD-Right    │
│ ┌──────┐ │  (全屏球场 SVG +    │ ┌────────────┐ │
│ │Stats │ │   球员站位 +        │ │ 预测概率   │ │
│ │ H2H  │ │   战术连线)         │ │ 场地天气   │ │
│ │ News │ │                     │ └────────────┘ │
│ └──────┘ │                     │                │
├──────────┴──────────────────────┴────────────────┤
│              Bottom Dock (替补席分析)             │  ← 底部固定栏
└─────────────────────────────────────────────────┘
```

| 区域 | 内容 | API | 容器 ID |
|------|------|-----|---------|
| HUD-Score | 比分 + 队名 + 状态 | `GET /api/match/:id` | `#hud-score` |
| HUD-Left | Mini tabs: Stats/H2H/News | 多个端点 | `#hud-left` |
| HUD-Right | 预测概率 + 场地天气 | `/api/venue/:id` | `#hud-right` |
| Pitch | 球场 SVG + 球员 + 连线 | `/api/matchup/:id/formation` | `#pitch-players-container` |
| Bottom Dock | 替补席对比 | `/api/match/:id/bench` | `#hud-bottom-content` |

### 2.3 其他浮层

| 组件 | 触发方式 | z-index | 容器 ID |
|------|----------|---------|---------|
| 球队详情 Modal | 点击球队卡片 | z-50 | `#team-modal` |
| AI 聊天面板 | 点击右下角 FAB | z-50 | `#global-chat-modal` |

---

## 三、用户交互流程

### 3.1 主流程

```
App 启动
  → 加载赛程 Tab（默认）
  │
  ├─ 切换 Tab ──→ Live / Prediction / Standings / Teams
  │                 各自独立加载数据并渲染
  │
  ├─ 点击比赛卡片 ──→ 进入 HUD 详情
  │     │
  │     ├─ Layer 3 加 blur + fade-out（背景虚化）
  │     ├─ Layer 0 pitch 加 view-focus（球场清晰化）
  │     ├─ Layer 4 HUD fade-in（浮层出现）
  │     │
  │     ├─ HUD-Left: 默认显示 Stats tab
  │     │     └─ 可切换到 H2H / News tab
  │     │
  │     ├─ HUD-Right: 预测 + 场地天气
  │     ├─ Pitch: 球员站位 + 对抗连线
  │     ├─ Bottom Dock: 替补席
  │     │
  │     └─ 点 "← Back" ──→ 关闭 HUD，恢复宏观层
  │
  ├─ 点击球队 ──→ 弹出球队详情 modal
  │     └─ 阵容列表 / 雷达图 / 近期比赛
  │
  └─ 点击 AI FAB ──→ 弹出聊天面板
        └─ 输入问题 → Claude Haiku 回答
```

### 3.2 状态切换动画

| 转场 | CSS 类 | 效果 |
|------|--------|------|
| 宏观 → 沉浸 | `.view-blur` on Layer 3 | `filter: blur(32px) brightness(0.6); scale(0.98)` |
| 沉浸 → 宏观 | `.view-focus` on Layer 0 | `filter: none; scale(1)` |
| 面板出现 | `.fade-in` | `opacity: 1; pointer-events: auto` |
| 面板隐藏 | `.fade-out` | `opacity: 0; pointer-events: none` |

---

## 四、视觉设计系统

> **预览文件**：浏览器打开 `static/design-system.html` 可看到实际颜色和毛玻璃效果

### 4.1 色彩系统

| 用途 | 值 | 说明 |
|------|------|------|
| 主背景 | `#0f172a` → `#1e293b` | 深靛蓝径向渐变 |
| 球场背景 | `#102a1c` → `#163a24` | 深绿线性渐变 |
| 主文字 | `#f8fafc` | 白色 |
| 次要文字 | `rgba(255,255,255,0.5)` | 50% 透明白 |
| 弱文字 | `rgba(255,255,255,0.3)` | 30% 透明白 |
| 强调绿 | `#34d399` (emerald-400) | 评分、标题 |
| 交互蓝 | `#3b82f6` (blue-500) | 按钮、链接 |
| 客队红 | `#f87171` (red-400) | 客队标识 |
| 警告橙 | `#fb923c` (orange-400) | 提示信息 |
| 高评分 | `#10b981` | 绿色徽章 |
| 中评分 | `#f59e0b` | 琥珀徽章 |
| 低评分 | `#ef4444` | 红色徽章 |

### 4.2 面板系统（Glassmorphism 毛玻璃）

```css
/* HUD 浮层面板（比赛详情用） */
.hud-panel {
    background-color: rgba(15, 23, 42, 0.4);    /* 半透明深蓝 */
    backdrop-filter: blur(24px);                  /* 毛玻璃模糊 */
    border: 1px solid rgba(255, 255, 255, 0.1);  /* 微白边框 */
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);   /* 深阴影 */
}

/* 宏观面板（赛程/积分主内容用） */
.macro-panel {
    background-color: rgba(0, 0, 0, 0.5);        /* 半透明黑 */
    backdrop-filter: blur(40px);                  /* 更重的模糊 */
    border: 1px solid rgba(255, 255, 255, 0.08);  /* 更淡的边框 */
}
```

### 4.3 字体

| 用途 | Tailwind 类 | 示例 |
|------|-------------|------|
| 大数据值 | `text-5xl font-light tracking-tight` | "2.14 xG" |
| 区块标题 | `text-xs font-medium tracking-widest uppercase` | "PLAYER RATINGS" |
| 球员名 | `text-base font-normal text-white/90` | "Martin Odegaard" |
| 辅助说明 | `text-xs text-white/40` | "Updated 5 min ago" |
| 导航按钮 | `text-sm font-medium` | "比分" / "Schedule" |

**字体族**：`Inter, system-ui, -apple-system, sans-serif`

### 4.4 间距与圆角

| 组件 | 圆角 | 内边距 |
|------|------|--------|
| 宏观面板 | `rounded-3xl` (24px) | `p-8` |
| HUD 面板 | `rounded-2xl` (16px) | `p-5` |
| 导航条 | `rounded-full` | `p-1` |
| 比赛卡片 | `rounded-xl` (12px) | `p-4` |
| 头像 | `rounded-full` (50%) | — |
| Bottom Dock | `rounded-t-[2rem]` (顶部圆角) | `px-12` |

---

## 五、设计约束清单

### 5.1 代码约束（必读！）

> **前端是 Vanilla JS，不是 React/Vue。没有组件系统，没有虚拟 DOM。**

| 规则 | 说明 | 错误示例 | 正确示例 |
|------|------|----------|----------|
| API 调用 | 用裸 `API.get(url)` | `window.api('/api/...')` | `API.get('/api/scores')` |
| API 响应 | 返回 `{ok, data, error}` 需解包 | `const data = API.get(...)` | `const r = API.get(...); const data = r.data` |
| API 命名空间 | `const API` 不在 window 上 | `window.API.get()` | `API.get()` |
| DOM 引用 | 删 HTML 元素前 grep JS 有无引用 | 直接删 `#clock` 元素 | 先搜索 `getElementById('clock')` |
| 脚本顺序 | 固定加载顺序不可变 | 随意调整 script 标签顺序 | formatters → api-client → app → match-renderers |
| 渲染依赖 | match-renderers 依赖 app.js 初始化 | 在 app.js 之前引用 Utils.esc | 保持 match-renderers.js 在 app.js 之后 |

### 5.2 i18n 约束

- 所有用户可见文字必须双语支持
- 行内使用：`tx('中文文本', 'English text')`
- HTML 属性：`data-i18n="keyName"` + 字典在 app.js 顶部（~130 个 key）
- 语言切换按钮在 header 右上角：`中` / `EN`
- 当前语言存 `localStorage.worldcup_lang`

### 5.3 响应式约束

| 场景 | 移动端 (< 768px) | 桌面端 (>= 768px) |
|------|-------------------|---------------------|
| HUD 面板排列 | `flex-col`（纵向堆叠） | `md:flex-row`（左右分列） |
| HUD 面板宽度 | `w-full` | `md:w-80`（320px） |
| HUD 面板高度 | `max-h-[50vh]` | `md:max-h-[60vh]` |
| 间距 | `px-2`, `gap-4` | `md:px-6`, `md:gap-0` |
| 球队网格 | 2 列 `grid-cols-2` | 3-4 列 `sm:grid-cols-3 md:grid-cols-4` |
| Bottom Dock | 固定 `h-28` | 同左 |

### 5.4 视觉约束

- **只有深色主题**，没有浅色模式
- **Glassmorphism 风格**：所有面板半透明 + backdrop-filter blur
- **球场永远是 Layer 0 背景**，任何面板不能完全遮挡球场
- **球员头像**来自 ESPN CDN，格式：`https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/{espnId}.png&w=72&h=72`，需要 fallback 为圆形首字母
- **Tab 激活态**：底部 2px `border-bottom: 2px solid #38bdf8` + 白色文字 + 10% 白背景

### 5.5 性能约束

- `app.js` 已经 218KB / 4305 行，**不要再增加体积**
- 实时比分通过 HTTP 轮询（非 WebSocket），前端 `setInterval` 1-5 秒
- ESPN API 后端缓存 60-300 秒，UI 不要期待"毫秒级"实时
- Chart.js 从 CDN 加载（`cdn.jsdelivr.net`），用于雷达图和趋势图
- 图片懒加载：球员头像较多时注意性能

---

## 六、API 端点参考（前端会调用的）

### 核心

| 方法 | 路径 | 返回 | 用途 |
|------|------|------|------|
| GET | `/api/scores` | 比赛数组 | Live tab 实时比分 |
| GET | `/api/scores/:date` | 比赛数组 | 历史日期比分 |
| GET | `/api/schedule` | 比赛数组 | Schedule tab |
| GET | `/api/match/:id` | 比赛详情 | HUD 基础数据 |
| GET | `/api/standings` | 积分表 | Standings tab |

### 预测

| 方法 | 路径 | 返回 | 用途 |
|------|------|------|------|
| GET | `/api/elo/rankings` | Elo 排名 | Prediction tab |
| GET | `/api/qualification-probabilities` | 出线概率 | Prediction tab |
| GET | `/api/match-review/:matchId` | 赛前分析 | 预测详情 |

### 比赛详情

| 方法 | 路径 | 返回 | 用途 |
|------|------|------|------|
| GET | `/api/matchup/:id/formation` | 阵型 + 阵容 | 战术板 |
| GET | `/api/matchup-spatial/:home/:away` | 位置对抗 | 战术连线 |
| GET | `/api/match/:id/head-to-head` | 交锋记录 | H2H tab |
| GET | `/api/match/:id/news` | 赛事新闻 | News tab |
| GET | `/api/match/:id/bench` | 替补数据 | Bottom Dock |
| GET | `/api/venue/:id` | 场地信息 | HUD-Right |

### 球队

| 方法 | 路径 | 返回 | 用途 |
|------|------|------|------|
| GET | `/api/team/:id` | 球队基本信息 | Teams tab |
| GET | `/api/team/:id/enhanced` | 增强分析 | 球队 modal |
| GET | `/api/team/:id/lineup` | 首发 XI | 球队阵容 |
| GET | `/api/player/:id` | 球员信息 | 球员卡片 |
| GET | `/api/coach/:teamId` | 教练信息 | 教练对比 |

### AI

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/bot/chat` | AI 聊天（发送问题，返回回答） |

---

## 七、组件优先级

### P0 — 必须正常工作（上线门槛）

1. **赛程列表 (Schedule tab)** — 用户入口页，最高频使用
2. **比赛详情 HUD** — 产品核心差异化功能
3. **积分表 (Standings tab)** — 世界杯基本功能
4. **中/英语言切换** — 双语用户基本需求
5. **Tab 导航** — 5 个 Tab 切换流畅

### P1 — 重要功能

6. **预测面板 (Prediction tab)** — 产品核心价值
7. **HUD Stats/H2H/News tabs** — 详情页内容丰富度
8. **球队详情 modal** — 球队维度分析
9. **战术板 (Pitch Layer 0)** — 视觉亮点（SVG 球场 + 球员站位 + 对抗连线）

### P2 — 锦上添花

10. **替补席分析 (Bottom Dock)**
11. **AI 聊天 (Bot FAB)**
12. **淘汰赛 Bracket 树**
13. **赔率趋势图**

---

## 八、三种 UI 处理方案

### 方案 A：修复现有 UI（推荐）

**做什么**：在当前 HUD 架构上修 bug，保留沉浸式设计方向

| 利 | 弊 |
|----|----|
| 工作量最小（主要 bug 已修完） | 4305 行 app.js 需要理解代码结构 |
| 保留沉浸式 HUD（差异化亮点） | 移动端布局仍需打磨 |
| 后端对接已全通，283 个测试绿 | |
| 有 git tag 可随时回退 | |

**适合**：设计师只做样式/布局调整，不动 JS 逻辑

### 方案 B：恢复到 HUD 之前的版本

**做什么**：用 git tag `pre-v2-consolidation` 回退前端文件

| 利 | 弊 |
|----|----|
| 回到验证过的 modal 架构 | 丢掉沉浸式 HUD 的所有进展 |
| 旧版功能完整稳定 | match-renderers.js 已更新，可能接口不匹配 |
| 设计师可渐进改进 | session 3 修的 bug fix 全部作废 |
| | 需验证旧代码与新后端 API 的兼容性 |

**适合**：想要最安全的起点，不介意重做 HUD

### 方案 C：删除前端，完全重做

**做什么**：只保留后端 API + 数据层，前端从零设计

| 利 | 弊 |
|----|----|
| 最干净，无历史包袱 | 工作量最大（40+ 渲染函数要重写） |
| 可选 React/Vue 等现代框架 | 130+ i18n key 要重建 |
| 设计师不需理解旧代码 | SVG 战术板逻辑复杂，重写成本高 |
| | 后端 API 对接全部重做 |

**适合**：想彻底换技术栈，或现有代码完全不可救

### 推荐

**选方案 A**。理由：
1. 最严重的 5 个集成 bug 已修完，所有测试绿
2. 功能已完整，只需视觉/布局打磨
3. 有 git tag 保底，随时可退回方案 B
4. 最节省时间

**给设计 agent 的核心指令**：
> 只改 HTML 结构 + CSS 样式 + Tailwind 类名。
> 不要改 JS 逻辑。如果必须改 JS，先说明改什么、为什么改，等确认后再动。
> 删除任何 HTML 元素前，必须搜索 JS 文件中是否有 `getElementById` 引用该元素。

---

## 九、已知问题 & 避坑指南

### 9.1 已修复的 Bug（不要再踩）

| Bug | 原因 | 修复方式 |
|-----|------|----------|
| `window.api()` undefined | 前端没有 `window.api` 函数 | 改用 `API.get()` |
| `window.API` undefined | `const API` 不挂在 window 上 | 裸用 `API` |
| `#clock` null crash | 删了 `#clock` HTML 但 JS 还在引用 | 加 null guard |
| H2H/News 永远"加载中" | API 返回错误时没有 fallback | 加 graceful degradation |
| `scheduleCache` undefined | 直接进 HUD 时缓存未初始化 | `(window.scheduleCache \|\| [])` |

### 9.2 待修问题

| 问题 | 说明 |
|------|------|
| venueFactor `applied:false` | 所有比赛的场地因子未生效，等 match ID bridge 修复 |
| 温度单位 bug | 后端把 °C 当 °F 处理，影响温度衰减因子 |

### 9.3 初始化顺序陷阱

JS 文件加载顺序决定初始化链：

```
formatters.js  →  定义 safeNum, pct, esc 等工具函数
api-client.js  →  定义 const API（IIFE，立即执行）
app.js         →  初始化 WorldCup.Utils.esc = esc（在 ~line 875）
match-renderers.js  →  IIFE 闭包捕获 Utils.esc（必须已赋值）
```

**关键**：如果 app.js 中任何代码在 `Utils.esc = esc` 之前崩溃，match-renderers.js 的所有渲染函数都会失败（因为 `esc` 是 undefined）。这是 session 3 中 `#clock` bug 的根源。

---

## 十、设计参考

### 竞品/风格参考

- **Apple Sports App**：简洁的比分卡片 + 深色主题
- **FotMob**：数据密度高的比赛详情页
- **SofaScore**：多 Tab 切换的比赛分析视图
- **F1 Timing Screen**：沉浸式 HUD 覆盖在赛道上的设计灵感

### 本项目风格关键词

- **Glassmorphism Dark**：毛玻璃 + 深色
- **Data-Dense HUD**：信息密度高但不杂乱
- **Immersive Pitch**：球场作为永久背景层
- **Minimal Chrome**：最少的装饰，让数据说话
