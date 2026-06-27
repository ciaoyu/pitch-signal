# Handoff: PitchSignal — 2026 FIFA World Cup Dashboard UI

## Overview

PitchSignal 是 2026 FIFA 世界杯实时赛事分析平台的前端 UI 设计交接包。本包包含所有主要页面的高保真设计稿，供 Claude Code 对照实现到现有 Vanilla JS + Tailwind CSS v3 项目中。

**请注意**：本包中的 `.dc.html` 文件是 **设计参考原型**，不是可直接上线的生产代码。开发任务是将这些 HTML 设计稿「翻译」到现有项目的 Vanilla JS + DOM 渲染架构中，沿用已有的 `app.js` / `match-renderers.js` 等文件结构，**不要直接复制 HTML 文件替换现有前端**。

---

## 项目背景 & 技术约束

详见 `UI-DESIGNER-HANDOFF.md`（原始开发者交接文档，包含完整 API 参考、JS 架构、已知 Bug 等）。关键约束：

- 前端是 **Vanilla JS SPA**，无 React/Vue
- CSS 用 **Tailwind CSS v3.4**（预编译到 `tailwind-output.css`）
- API 调用用 `API.get(url)`，返回 `{ok, data, error}`
- 所有可见文字必须双语：`tx('中文', 'English')`
- 保持现有 JS 文件加载顺序不变

---

## Fidelity（设计保真度）

**高保真（High-fidelity）**：所有配色、字体、间距、动效均为最终确认版本。开发应尽量像素级还原，在 Tailwind 类名与精确数值之间选近似值即可。

---

## 视觉设计系统

### 色彩

| 用途 | 值 |
|---|---|
| 主背景 | `#0f172a`（深靛蓝）→ `#1e293b` 径向渐变 |
| 球场绿背景 glow | `rgba(16,42,28,.3)` |
| 主文字 | `#f8fafc` |
| 次要文字 | `rgba(248,250,252,.5)` |
| 弱文字 | `rgba(248,250,252,.2)` |
| 强调绿（主色）| `#34d399`（emerald-400） |
| 交互蓝（主队） | `rgba(59,130,246,…)`（blue-500 系） |
| 客队红 | `rgba(248,113,113,…)`（red-400 系） |
| 警告橙 | `rgba(251,146,60,…)`（orange-400 系） |
| 高评分 | `#10b981` |
| 中评分 | `#f59e0b` |

### 字体

| 用途 | 字体 | 示例用法 |
|---|---|---|
| 导航、标题、标签 | `DM Sans` | `font: 600 14px/1 'DM Sans', sans-serif` |
| 正文、说明 | `Inter` | `font: 400 12px/1.5 'Inter', sans-serif` |
| 数字、代码、计时 | `JetBrains Mono` | `font: 300 36px/1 'JetBrains Mono', monospace` |

Google Fonts 引入：
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### 毛玻璃面板（Glassmorphism）

所有主要卡片/面板的基础样式：
```css
background: rgba(0,0,0,.30);
backdrop-filter: blur(48px);
-webkit-backdrop-filter: blur(48px);
border: 1px solid rgba(255,255,255,.06);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04);
```

### 关键动画

```css
@keyframes pulse-live { 0%,100%{ opacity:.45 } 50%{ opacity:1 } }
@keyframes breath    { 0%,100%{ opacity:.03 } 50%{ opacity:.07 } }
```

`pulse-live`：用于直播状态绿点，`animation: pulse-live 1.8s ease-in-out infinite`  
`breath`：用于球场背景 glow，`animation: breath 10s ease-in-out infinite`

### 间距 & 圆角

| 组件 | 圆角 | 内边距 |
|---|---|---|
| 主导航栏 | — | `14px 28px` |
| 比赛卡片 | `16px` | `18px 22px` |
| HUD 面板 | `16–18px` | `16px 18px` |
| 球队 Modal | `22px` | `20px 24px` |
| 导航 Tab 胶囊 | `8px`（容器）/ `6px`（单项） | `3px`（容器）/ `7px 16px`（单项） |

---

## 全局组件

### 顶部导航栏（所有页面共用）

结构：`Logo左 | Tab导航居中 | 语言切换右`

```
[●] PitchSignal   [比分 Live] [赛程] [预测] [积分] [球队]   [中] [EN]
```

- 背景：`rgba(15,23,42,.5)` + `backdrop-filter: blur(40px)`
- 下边框：`1px solid rgba(255,255,255,.06)`
- 激活 Tab：`background: rgba(255,255,255,.06); color: #f8fafc`
- 非激活 Tab：`color: rgba(248,250,252,.3)`

实现提示：对应 `app.js` 中的 Tab 切换逻辑，只需修改激活 Tab 的 class。

### 球场背景层（Layer 0）

每个页面固定在视口底层的球场 SVG，始终可见：

```html
<div style="position:fixed;inset:0;z-index:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
  <!-- SVG 球场线条，opacity 0.04–0.07，带 breath 动画 -->
</div>
```

现有项目中 `#pitch-players-container` 即对应此层，HUD 模式下清晰化，宏观模式下模糊。

### AI 聊天 FAB（右下角悬浮按钮）

固定定位，所有页面右下角：`position:fixed; bottom:24px; right:24px; z-index:50`  
圆形 44×44px，点击触发 `#global-chat-modal`。

---

## 页面详情

---

### 1. 比分 Live Tab（`PitchSignal Live.dc.html`）

**对应函数**：`loadScores()` · **API**：`GET /api/scores`

**布局**：单列，最大宽度 720px，居中，`padding: 20px 24px 40px`

**结构**（从上到下）：

```
页面标题区（"实时比分" + 日期 + Live 计数徽章）
├── IN PROGRESS 分区标题
│   ├── 直播比赛卡 × N
├── FINISHED TODAY 分区标题
│   ├── 已结束比赛卡 × N
└── COMING UP 分区标题
    └── 即将开始比赛卡 × N
```

**比赛卡片——直播状态**：
- 顶部 2px 渐变线：`linear-gradient(90deg, transparent, rgba(52,211,153,.3), transparent)`
- 左上：`GROUP X · MATCHDAY X`（9px JetBrains Mono，opacity 0.2）
- 右上：绿点 + 分钟数（`pulse-live` 动画）
- 中间：`[国旗 40px] [队名 + 进球者]  [分数 40px JetBrains Mono]  [进球者 + 队名] [国旗]`
- 分数字体：`font: 300 40px/1 'JetBrains Mono', monospace; letter-spacing: -2px`
- 分隔符 `:`：`color: rgba(248,250,252,.12); font-size: 20px`
- 下方数据条：控球率迷你双色柱 + 射门 + xG
- 底部 3px 三段胜负概率条 + 百分比标注

**比赛卡片——已结束**：
- 整体透明度降低：`background: rgba(0,0,0,.22); border: rgba(255,255,255,.05)`
- 分数颜色：`rgba(248,250,252,.35)`
- 右上：`FT`（字符）
- 下方展示最终比赛数据（控球、射门、xG）

**比赛卡片——即将开始**：
- 右上：开球时间（`21:00 CST` 格式）
- 分数区：`— : —`，颜色 `rgba(248,250,252,.15)`
- 下方：Elo 胜负概率三段条
- 最底部：场地名 + 海拔信息

---

### 2. 赛程 Schedule Tab（`PitchSignal Schedule.dc.html`）

**对应函数**：`loadSchedule()` · **API**：`GET /api/schedule`

**布局**：单列，最大宽度 720px，居中

**结构**：

```
日期滚动条（横向滚动，active 日高亮绿色）
日标题（星期 + 完整日期 + 比赛数量）
比赛卡片列表（同 Live Tab 格式，含即将/进行中/已结束三态）
```

**日期滚动条**：
- 每个日期项：`text-align:center; padding: 8px 14–16px; border-radius: 8px`
- 数字：`font: 500–600 16px/1 'JetBrains Mono'`
- 月份：`font: 400–500 9px/1 'Inter'; margin-top: 3px`
- Active 态：`background: rgba(52,211,153,.08); border: 1px solid rgba(52,211,153,.15); color: #34d399`
- 非 active：`color: rgba(248,250,252,.25–.3)`

**日标题**：
- 星期：`font: 500 13px/1 'DM Sans'; color: rgba(248,250,252,.5)`
- 日期：`font: 600 20px/1 'DM Sans'; color: #f8fafc; margin-top: 4px`
- 比赛数：`font: 400 9px/1 'JetBrains Mono'; color: rgba(52,211,153,.35)`

**与 Live Tab 的区别**：Schedule 卡片额外展示场地信息（已结束卡片展示最终统计摘要）。

---

### 3. 预测 Prediction Tab（`PitchSignal Prediction.dc.html`）

**对应函数**：`loadPrediction()` · **API**：`GET /api/elo/rankings` + `GET /api/qualification-probabilities`

**布局**：两列，左右并排，最大宽度 1080px，`gap: 20px`

```
左列（flex:1）              右列（width:380px）
Elo 实力排名表              赛事预测卡列表
```

**左列——Elo 排名表**：

表头列宽：`grid-template-columns: 36px 1fr 70px 80px`  
列：`# | Team | Elo | 出线概率`

每行数据：
- 排名数字：JetBrains Mono，#1 用 `rgba(52,211,153,.5)`
- 队旗 emoji 16px + 队名 13px Inter
- Elo 值：14px JetBrains Mono
- 出线概率：40px 迷你进度条（高度 4px，圆角 2px） + 百分比数字
- 进度条颜色：`rgba(52,211,153,.4)` 渐变至低概率（低于 70% 改为橙色系）

**右列——预测卡**：

每张卡片：`border-radius: 14px; padding: 16px 18px`

卡片内部：
- 顶部：`GROUP X · MATCHDAY X`（8px JetBrains Mono letter-spacing 1px）
- 队名行：`[国旗 18px] [队名]  vs  [队名] [国旗]`，两端对齐
- 胜负概率三段可视化条（高度 28px，圆角 8px）：
  - 主队胜：`rgba(59,130,246,.2)` 背景，蓝色百分比
  - 平局：`rgba(255,255,255,.04)`，低亮度文字
  - 客队胜：`rgba(248,113,113,.08)`，红色百分比
- 底部分割线 + `预期比分 Expected [主队分] : [客队分]`（14px JetBrains Mono）

底部模型说明卡：`background: rgba(52,211,153,.03); border: rgba(52,211,153,.06)`

---

### 4. 积分 Standings Tab（`PitchSignal Standings.dc.html`）

**对应函数**：`loadStandings()` · **API**：`GET /api/standings`

**布局**：`max-width: 960px`，内容区 2 列网格，`grid-template-columns: 1fr 1fr; gap: 16px`

**子 Tab 切换**：小组赛 / 淘汰赛（对应现有 bracket.js）

Active 子 Tab：`background: rgba(52,211,153,.08); border: rgba(52,211,153,.12); color: #f8fafc`

**小组积分卡**（每个 Group 一张）：
- 圆角 16px，overflow hidden
- 卡头：`GROUP X` + `MD X/3`（右对齐，JetBrains Mono 8px）
- 表头列：`grid-template-columns: 1fr 28px 28px 28px 28px 36px`（Team | W | D | L | GD | Pts）
- 每行：
  - 国旗 14px emoji + 队名 12px Inter
  - 数字列：11px JetBrains Mono，居中
  - GD 列：正数用 `rgba(52,211,153,.5)`，负数用 `rgba(248,113,113,.3)`
  - Pts 列：12px bold JetBrains Mono；晋级队用 `#34d399`
  - 左侧晋级状态条：`border-left: 2px solid`
    - 已晋级：`rgba(52,211,153,.4)`
    - 有望晋级：`rgba(52,211,153,.25)`
    - 出局：`transparent`

---

### 5. 球队 Teams Tab（`PitchSignal Teams.dc.html`）

**对应函数**：`loadTeams()` · **API**：`GET /api/team/:id`

**布局**：`max-width: 1080px`；卡片网格 `grid-template-columns: repeat(4, 1fr); gap: 12px`

**搜索/筛选栏**：
- 搜索框（装饰性，最大宽 280px）：`background: rgba(255,255,255,.03); border: rgba(255,255,255,.05); border-radius: 8px`
- Group 筛选按钮：Active 用绿色系，非 active 透明

**球队卡片**：
- `border-radius: 14–16px; padding: 20px 16px; text-align: center`
- 国旗 emoji 36px
- 队名 14px Inter 500
- ELO · 排名：9px JetBrains Mono，颜色 `rgba(52,211,153,.4)` 或 `rgba(248,250,252,.2)`
- W / D / L 徽章：小 badge，`padding: 3px 8px; border-radius: 4px; font: 400 9px JetBrains Mono`
  - W：`background: rgba(52,211,153,.06); color: rgba(52,211,153,.4)`
  - D：`background: rgba(245,158,11,.05); color: rgba(245,158,11,.35)`
  - L：`background: rgba(248,113,113,.05); color: rgba(248,113,113,.3)`
- 组别 + 排名：8px Inter，底部

**球队详情 Modal**（点击卡片触发，对应 `#team-modal`）：

- 遮罩：`background: rgba(0,0,0,.6); backdrop-filter: blur(8px)`
- Modal 尺寸：`width: 600px; max-height: 80vh; border-radius: 22px`
- 面板背景：`rgba(15,23,42,.75)` + `backdrop-filter: blur(60px)`
- Modal 头部：大国旗 32px + 队名 18px 600 + ELO + 组别
- 关闭按钮：右上角 `×`，28×28px，`border-radius: 6px; background: rgba(255,255,255,.04)`
- 内容区（可滚动）：
  1. 主教练信息条（圆形 avatar 首字母 + 姓名 + 阵型）
  2. 关键球员 2 列网格（每格：首字母 avatar + 姓名 + 位置 + 评分徽章）
  3. 近期比赛列表（W/D/L 色标 + 比赛结果 + 日期）
  4. 球队雷达图（SVG，Chart.js 占位，5 维度）

---

### 6. HUD 比赛详情（`PitchSignal HUD.dc.html`）

**触发方式**：点击赛程/比分卡片 → `openMatch(id)` → Layer 3 blur + Layer 4 HUD 出现

**布局**：全屏沉浸式，3 列

```
顶部控制栏（← 返回 | Group/Matchday | PitchSignal logo | 语言）
比分大标题区（主队 | 分数+计时 | 客队）
├── 左列 300px（Stats/H2H/News 小 Tab + 内容）
├── 中列 flex:1（战术板 SVG + 球员站位）
└── 右列 280px（胜率面板 + 场地面板 + 评分面板）
底部 Dock（替补席对比）
```

**顶部控制栏**：
- 背景：`rgba(15,23,42,.5)` + `backdrop-filter: blur(40px)`
- 下边框：`1px solid rgba(255,255,255,.06)`
- 返回按钮：`← 返回`，带左箭头 SVG

**比分大标题区**：
- 主队侧：队名 22px Inter 500 + ELO + 阵型 + 进球者（斜体 11px Inter）
- 队徽区域：`52×52px border-radius:14px`，主队蓝 `rgba(59,130,246,.08)`，客队红 `rgba(248,113,113,.06)`
- 分数：`font: 300 52px/1 'JetBrains Mono'; letter-spacing: -3px`
- 计时徽章：绿点 `pulse-live` + `font: 500 9px JetBrains Mono; color: #34d399`

**左列——Stats 面板**：
- 面板：`border-radius: 18px; background: rgba(15,23,42,.4); backdrop-filter: blur(48px)`
- 小 Tab 栏：Stats | H2H | News，active 下边 `border-bottom: 2px solid #34d399`
- 每个 stat 行：`[主队数值 16px Mono] [标签 9px Inter 居中] [客队数值 16px Mono]`
- 双向进度条：高度 4px，主队蓝 `rgba(59,130,246,.5)` / 客队红 `rgba(248,113,113,.15)`
- 底部 Poisson 期望比分区块

**中列——战术板**：
- 容器：`max-width: 540px; aspect-ratio: 1.45/1`
- 背景：`linear-gradient(180deg, rgba(16,42,28,.25), rgba(22,58,36,.2))`，`border-radius: 12px`
- 内层 SVG 球场线条：`opacity: .15; stroke: #34d399`
- 球员圆点：主队蓝 `rgba(59,130,246,…)` / 客队红 `rgba(248,113,113,…)`
  - 普通球员：28×28px，`border-radius: 50%`
  - 关键球员（进球）：30×30px，轻微 glow，数字白色
  - 标注名字：7px Inter，`color: rgba(248,250,252,.35)`，`white-space: nowrap`
- 对抗连线：SVG `<line>` 虚线，`stroke-dasharray: 3,4`，主队蓝 `rgba(59,130,246,.12–.15)`

**右列——三个面板**：

胜率面板：
- SVG 半圆弧图（`r=75, stroke-width=10`）：背景弧 `rgba(255,255,255,.04)` + 主队进度弧 `rgba(59,130,246,.35)`
- 中央文字：26px Mono 百分比 + 8px 标注
- 三段概率条（同其他页面格式）
- 预测比分区块

场地面板：
- 场馆名（斜体 15px Inter）+ 城市
- 2×2 数据格：海拔 / 温度 / 草皮 / 湿度
  - 每格：`padding: 10px; border-radius: 8px`，大数字 18px Mono
  - 海拔高时：橙色 `rgba(251,146,60,.6)` + 警告小标
- 场地因子进度条区块

评分面板（TOP RATED）：
- 球员列表（头像首字母圆圈 + 姓名 + 位置 + 评分徽章）

**底部 Dock**：
- `border-radius: 24px 24px 0 0; background: rgba(15,23,42,.5)`
- 内容：两队替补席并排，中间竖线分隔
- 每个替补球员：首字母 24px 圆形 + 姓名 + 位置 + 评分

---

### 7. AI 聊天面板（`PitchSignal AI Chat.dc.html`）

**触发方式**：点击右下角 FAB → `#global-chat-modal` 出现

**容器**：
- `position: fixed; bottom: 24px; right: 24px; z-index: 60`
- `width: 400px; max-height: 600px`
- `border-radius: 22px; background: rgba(15,23,42,.75); backdrop-filter: blur(60px)`
- 入场动画：`slide-up .3s ease-out`（`opacity:0; translateY(12px)` → `opacity:1; translateY(0)`）

**结构**（从上到下）：

```
聊天头部（logo + 标题 + 最小化/关闭按钮）
快速提示条（横向滚动，preset 问题 pill）
消息滚动区
└── AI 消息（左对齐，圆角 4px 14px 14px 14px）
└── 用户消息（右对齐，圆角 14px 14px 4px 14px，蓝色背景）
└── AI 打字指示器（3 点弹跳）
输入区（文本框 + 麦克风 + 发送按钮）
```

**AI 消息气泡**：`background: rgba(255,255,255,.04); border: rgba(255,255,255,.06); font: 400 12px/1.6 Inter`

**用户消息气泡**：`background: rgba(59,130,246,.1); border: rgba(59,130,246,.18)`

**AI 内联数据卡**（回复中可嵌入）：
- `background: rgba(0,0,0,.2); border: rgba(255,255,255,.04); border-radius: 8px; padding: 10px 12px`
- 可展示实时比赛数据、胜率条等

**打字指示器**：3 个点，`animation: typing-bounce 1.2s ease-in-out infinite`，延迟 0 / 0.2s / 0.4s

**输入框**：`background: rgba(255,255,255,.03); border: rgba(255,255,255,.05); border-radius: 12px`

**发送按钮**：`background: rgba(52,211,153,.1); border: rgba(52,211,153,.2); border-radius: 10px`

**API 调用**：`POST /api/bot/chat`，需传当前比赛上下文

---

## 交互 & 状态切换

### 宏观 → 沉浸（HUD）转场

| 阶段 | 目标元素 | 效果 |
|---|---|---|
| 进入 HUD | Layer 3（主内容层） | `filter: blur(32px) brightness(0.6); transform: scale(0.98)` |
| 进入 HUD | Layer 0（球场层） | 清晰化（无 blur） |
| 进入 HUD | Layer 4 HUD | `opacity: 1; pointer-events: auto` |
| 退出 HUD | 反向 | 恢复原态 |

过渡时长建议：`300ms ease-in-out`

### Tab 切换

- 当前：切换时直接替换内容（`innerHTML` 更新）
- 建议加 `opacity: 0 → 1` 200ms fade

### 直播数据轮询

- `setInterval` 每 5 秒：`GET /api/scores`
- 比分变化时：触发 `score-flash` 动画（1 次）

---

## 设计参考文件

| 文件 | 用途 |
|---|---|
| `PitchSignal Directions.dc.html` | 3 个视觉方向探索（供参考，已选定当前风格） |
| `PitchSignal Live.dc.html` | 比分 Live Tab 高保真稿 |
| `PitchSignal Schedule.dc.html` | 赛程 Schedule Tab 高保真稿 |
| `PitchSignal Prediction.dc.html` | 预测 Prediction Tab 高保真稿 |
| `PitchSignal Standings.dc.html` | 积分 Standings Tab 高保真稿 |
| `PitchSignal Teams.dc.html` | 球队 Teams Tab + Modal 高保真稿 |
| `PitchSignal HUD.dc.html` | 沉浸式比赛详情 HUD 高保真稿 |
| `PitchSignal AI Chat.dc.html` | AI 聊天面板高保真稿 |
| `UI-DESIGNER-HANDOFF.md` | 原始开发者交接文档（API、架构、约束） |

---

## 给 Claude Code 的实施建议

1. **优先实现顺序（P0 → P2）**：按 `UI-DESIGNER-HANDOFF.md` 第七章优先级，先 Tab 导航 → Live 比分 → Schedule → HUD Stats 面板 → Standings → Teams → AI Chat

2. **HTML 设计稿的用法**：在浏览器中打开各 `.dc.html` 文件，通过 DevTools 检查精确的 padding/color/font 值，按照 Tailwind 的等价类名或内联 style 实现。

3. **Tailwind 类映射参考**：
   - `border-radius: 16px` → `rounded-2xl`
   - `border-radius: 22px` → `rounded-[22px]`
   - `backdrop-filter: blur(48px)` → `backdrop-blur-[48px]`
   - `font: 300 36px JetBrains Mono` → 需自定义 font-family class

4. **不要改动的 JS 逻辑**：只改 HTML class/结构和 CSS。JS 渲染函数（`loadScores`、`renderMatch` 等）的内部逻辑保持不变，只在 `match-renderers.js` 里更新对应的 HTML 模板字符串。

5. **动画实现**：`@keyframes` 在 `tailwind-output.css` 之外单独维护（已有 `bot.css`、`schedule.css`，可类似新增 `animations.css`），或用 Tailwind 的 `animate-` + 自定义 keyframes。
