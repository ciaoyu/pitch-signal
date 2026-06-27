# PitchSignal UI 设计走查报告

**项目**: PitchSignal — 2026 FIFA 世界杯实时赛事分析平台
**走查日期**: 2026-06-27
**走查方法**: 设计稿 (.dc.html + UI-DESIGNER-HANDOFF.md) vs 当前实现 (index.html + JS/CSS) 逐项对比
**走查人**: Codex

---

## 一、走查范围

| 设计稿文件 | 对应功能模块 |
|-----------|-------------|
| PitchSignal Live.dc.html | 比分 Tab（实时比分） |
| PitchSignal Schedule.dc.html | 赛程 Tab（日期滚动 + 比赛列表） |
| PitchSignal Prediction.dc.html | 预测 Tab（Elo 排名 + 赛事预测） |
| PitchSignal Standings.dc.html | 积分 Tab（小组积分表） |
| PitchSignal HUD.dc.html | 比赛详情沉浸式 HUD |
| PitchSignal Teams.dc.html | 球队 Tab |
| PitchSignal Directions.dc.html | 淘汰赛 Bracket |
| PitchSignal AI Chat.dc.html | AI 聊天面板 |
| UI-DESIGNER-HANDOFF.md | 设计规范文档 |
| README.md | 项目总览 |

---

## 二、问题清单

### 2.1 导航栏 (Nav Bar)

| # | 问题 | 设计稿 | 当前实现 | 严重度 | 涉及文件 |
|---|------|--------|----------|--------|----------|
| 1 | Tab 字号偏小 | font:500 11px/1 DM Sans | font:500 10px/1 DM Sans | P1 | templates/index.html nav 区域 |
| 2 | Tab 内边距偏窄 | padding:7px 16px | padding:7px 13px | P1 | templates/index.html nav 区域 |
| 3 | Logo 字号偏小 | font:600 14px/1 DM Sans | font:600 13px/1 DM Sans | P2 | templates/index.html nav 区域 |
| 4 | Logo 透明度过低 | color:rgba(248,250,252,.6) | color:rgba(248,250,252,.45) | P2 | templates/index.html nav 区域 |
| 5 | 导航栏内边距偏窄 | padding:14px 28px | padding:10px 20px | P1 | templates/index.html nav 区域 |
| 6 | Tab 文案缺少英文后缀 | 赛程 Schedule / 预测 Predict / 积分 Table / 球队 Teams | 赛程 / 预测 / 积分 / 球队 | P1 | templates/index.html nav 区域 |
| 7 | 多出实时时钟元素 | 设计稿无 #clock | 实现有 span id=clock | P2 | templates/index.html nav 区域 |
| 8 | 多出刷新按钮 | 设计稿无刷新按钮 | 实现有 #refresh-btn | P2 | templates/index.html nav 区域 |

### 2.2 比分 Tab (Live)

| # | 问题 | 设计稿 | 当前实现 | 严重度 | 涉及文件 |
|---|------|--------|----------|--------|----------|
| 9 | 进行中比赛卡片国旗尺寸 | 40x40, 圆角 12px | 40x40, 圆角 12px | OK | — |
| 10 | 已结束比赛卡片缺少 stats strip | 有控球/射门/xG 数据条 | 需验证 JS 是否渲染 .stats-strip-dim | P1 | static/js/scores.js |
| 11 | 进行中比赛缺少 score-flash 动画 | 比分数字有呼吸光效 animation:score-flash 4s | CSS 已定义，需验证 JS 是否应用 | P1 | static/js/scores.js |
| 12 | 胜率概率条标签 | 68% WIN / 18% DRAW / 14% WIN 格式 | CSS 类已定义，需验证 JS 渲染 | P1 | static/js/scores.js |
| 13 | 未开始比赛缺少 Elo 信息 | 设计稿显示 ELO 1962 / ELO 1856 | 需验证 JS 是否渲染 | P2 | static/js/scores.js |
| 14 | 未开始比赛缺少场地信息 | 设计稿显示 AT&T Stadium, Dallas · 190m | 需验证 JS 是否渲染 | P2 | static/js/scores.js |

### 2.3 赛程 Tab (Schedule)

| # | 问题 | 设计稿 | 当前实现 | 严重度 | 涉及文件 |
|---|------|--------|----------|--------|----------|
| 15 | 比赛卡片国旗尺寸偏大 | 36x36, 圆角 10px | 40x40, 圆角 12px (与 Live 一致) | P2 | static/js/schedule.js |
| 16 | 日期头部信息缺失 | Thursday + June 26, 2026 + 3 MATCHES | 需验证 JS 是否渲染日期标题和场次计数 | P1 | static/js/schedule.js |
| 17 | 选中日期高亮样式 | 翡翠绿边框 rgba(52,211,153,.15) + 绿色数字 | 需验证 JS 渲染 | P1 | static/js/schedule.js |
| 18 | 已结束比赛统计格式 | Poss 54% - 46% / Shots 14 - 11 | 需验证 JS 渲染格式 | P2 | static/js/schedule.js |

### 2.4 预测 Tab (Prediction) — 差异最大

| # | 问题 | 设计稿 | 当前实现 | 严重度 | 涉及文件 |
|---|------|--------|----------|--------|----------|
| 19 | 布局完全不对 | 双栏：左 Elo 排名表 + 右预测卡片，max-width:1080px | 单栏堆叠，max-width:720px | P0 | static/js/elo-prediction.js + templates/index.html |
| 20 | Elo 排名样式错误 | 表格式 grid 36px 1fr 70px 80px，有排名渐变色 | 卡片式 .elo-card，左侧紫色渐变条 | P0 | static/js/elo-prediction.js |
| 21 | 预测卡片概率条高度 | 28px 高，渐变背景 + 百分比文字在条内 | 28px 但背景渐变不同 | P1 | static/js/elo-prediction.js |
| 22 | 预期比分展示 | 独立行 预期比分 Expected + 大号 Elo 风格数字 | 需验证是否渲染 | P1 | static/js/elo-prediction.js |
| 23 | 最大内容宽度 | 1080px (双栏需要更宽空间) | 720px (全局统一) | P0 | templates/index.html |

### 2.5 积分 Tab (Standings)

| # | 问题 | 设计稿 | 当前实现 | 严重度 | 涉及文件 |
|---|------|--------|----------|--------|----------|
| 24 | 缺少子 Tab 切换 | 小组赛 Groups / 淘汰赛 Knockout | 需验证是否有子 Tab | P0 | static/js/standings.js |
| 25 | 表格列定义 | 1fr 28px 28px 28px 28px 36px (Team/W/D/L/GD/Pts) | 需验证列宽是否匹配 | P1 | static/js/standings.js |
| 26 | 出线标识 | 左边框 2px solid rgba(52,211,153,.4) 标记出线队伍 | 需验证 JS 渲染 | P1 | static/js/standings.js |
| 27 | 最大内容宽度 | 960px | 720px (全局统一) | P0 | templates/index.html |
| 28 | 积分表布局 | 2 列 grid 并排显示各组 | 需验证布局 | P1 | static/js/standings.js |

### 2.6 比赛详情 HUD — 架构差异

| # | 问题 | 设计稿 | 当前实现 | 严重度 | 涉及文件 |
|---|------|--------|----------|--------|----------|
| 29 | 架构完全不同 | 全屏沉浸式 HUD 覆盖层，Layer 3 背景 blur | 底部弹出 sheet modal (modal-sheet) | P0 | static/js/match-detail.js + templates/index.html |
| 30 | 比分字号偏小 | font:300 52px/1 JetBrains Mono | modal 内较小 | P0 | static/js/match-detail.js |
| 31 | 三栏布局缺失 | 左 Stats/H2H/News 中 Pitch 右 Prediction/Venue | 底部 sheet 内容，非三栏 | P0 | static/js/match-detail.js |
| 32 | Logo 字体不同 | HUD 内用 Instrument Serif 衬线体 | 全局用 DM Sans | P2 | templates/index.html |
| 33 | 返回按钮位置 | 导航栏左侧 返回，与 Group/Matchday 标签并排 | sheet 顶部拖拽条 | P1 | static/js/match-detail.js |
| 34 | 战术板详细程度 | SVG 球场含禁区弧、角球弧、草地条纹 + 球员编号圆点 + 对抗虚线 | 依赖 JS 渲染，基础 SVG 较简 | P1 | static/js/match-detail.js / static/js/spatial-matchup.js |
| 35 | Poisson 预期得分 | 左面板底部显示 xG 对比 (1.8 vs 0.9) | 需验证是否渲染 | P1 | static/js/match-detail.js |
| 36 | 球员编号圆点样式 | 28px 圆形，蓝色/红色半透明背景，编号居中 | 依赖 JS 渲染 | P1 | static/js/match-detail.js |
| 37 | 进球球员高亮 | 进球球员名后加足球标记，文字颜色更亮 | 需验证 JS 渲染 | P2 | static/js/match-detail.js |

### 2.7 球队 Tab (Teams)

| # | 问题 | 设计稿 | 当前实现 | 严重度 | 涉及文件 |
|---|------|--------|----------|--------|----------|
| 38 | 球队详情弹出方式 | 全屏覆盖层 z-100 | 底部 sheet modal | P1 | static/js/team-detail.js |

### 2.8 全局样式问题

| # | 问题 | 说明 | 严重度 | 涉及文件 |
|---|------|------|--------|----------|
| 39 | 底部固定栏多余 | 设计稿无底部 disclaimer 栏，实现在底部有固定 footer | P2 | templates/index.html |
| 40 | Instrument Serif 字体未引入 | HUD 设计稿引入了该字体，index.html 的 Google Fonts 链接中没有 | P2 | templates/index.html head |
| 41 | .fade-out display none !important | 可能导致 fade 动画缺失，直接隐藏 | P2 | templates/index.html style |
| 42 | 内容区最大宽度不统一 | Live/Schedule: 720px, Prediction: 1080px, Standings: 960px, HUD: 全屏 | 全局统一为 720px | P0 | templates/index.html main |

---

## 三、严重度定义

| 级别 | 含义 | 处理建议 |
|------|------|----------|
| P0 | 核心功能/布局与设计稿严重不符 | 上线前必须修 |
| P1 | 视觉细节偏差，影响设计一致性 | 优先修 |
| P2 | 微小差异或锦上添花 | 可延后 |

---

## 四、优先修复清单

### P0 — 必须修（6 项）

1. 预测 Tab 改双栏布局 — Elo 排名表 + 预测卡片左右并排，max-width 改为 1080px
2. 比赛详情 HUD 改沉浸式全屏 — 从底部 sheet 改为全屏覆盖，背景 Layer 3 blur
3. 积分 Tab 宽布局 + 子 Tab — 添加 Groups/Knockout 切换，2 列 grid，max-width 960px
4. 内容区最大宽度动态化 — 不同 Tab 使用不同 max-width（720/960/1080px）
5. Elo 排名表样式重做 — 从卡片式改为表格式 grid
6. HUD 三栏布局 — 左 Stats/H2H/News + 中 Pitch + 右 Prediction/Venue

### P1 — 重要（11 项）

7. 导航栏 Tab 字号 10px 改 11px
8. 导航栏 Tab padding 13px 改 16px
9. 导航栏内边距 10px 20px 改 14px 28px
10. Tab 文案补英文后缀
11. 验证 Live Tab 的 stats strip / score-flash / 概率条标签渲染
12. 验证 Schedule Tab 的日期头部 / 选中高亮渲染
13. 验证 Standings Tab 的出线标识 / 列宽 / 2 列 grid 渲染
14. HUD 比分字号改为 52px
15. HUD 返回按钮移到导航栏左侧
16. 战术板 SVG 丰富化（禁区弧、角球弧、草地条纹）
17. 验证 Poisson xG / 进球球员标记渲染

### P2 — 锦上添花（6 项）

18. Logo 字号 13px 改 14px，透明度 0.45 改 0.6
19. 引入 Instrument Serif 字体
20. Schedule 卡片国旗改为 36x36
21. 评估是否保留 clock / refresh 按钮
22. 移除或隐藏底部 disclaimer 栏
23. 评估 .fade-out display:none 对动画的影响

---

## 五、修改约束（来自 UI-DESIGNER-HANDOFF.md 5.1）

前端是 Vanilla JS，不是 React/Vue。没有组件系统，没有虚拟 DOM。

- 只改 HTML 结构 + CSS 样式 + Tailwind 类名
- 不改 JS 逻辑（如必须改，先说明原因等确认）
- 删 HTML 元素前必须搜索 JS 中 getElementById 引用
- app.js 已 218KB / 4305 行，不要再增加体积
- JS 加载顺序不可变：formatters -> api-client -> state -> i18n -> utils -> ... -> app
- API 调用用 API.get()，不用 window.API.get()

---

## 六、验收标准

修复完成后，按以下步骤验收：

1. 逐项对照本报告 P0/P1 清单，确认每项已修复或有合理说明
2. 在浏览器中打开各 Tab，与对应 .dc.html 设计稿视觉对比
3. 点击比赛卡片进入 HUD，确认沉浸式全屏 + 三栏布局
4. 切换到 Prediction Tab，确认双栏布局 + Elo 表格式
5. 切换到 Standings Tab，确认子 Tab + 2 列 grid
6. 检查移动端响应式（< 768px），确认 HUD 纵向堆叠
7. 确认无 JS 控制台报错

---

## 附录：设计稿 vs 实现对照表

| 设计稿文件 | 实现文件 | 状态 |
|-----------|----------|------|
| PitchSignal Live.dc.html | static/js/scores.js + CSS in index.html | 基本一致，细节待验证 |
| PitchSignal Schedule.dc.html | static/js/schedule.js | 基本一致，细节待验证 |
| PitchSignal Prediction.dc.html | static/js/elo-prediction.js | 差异大，需重做 |
| PitchSignal Standings.dc.html | static/js/standings.js | 差异大，需调整 |
| PitchSignal HUD.dc.html | static/js/match-detail.js | 架构不同，需重做 |
| PitchSignal Teams.dc.html | static/js/team-detail.js | 差异中等 |
| PitchSignal Directions.dc.html | static/js/bracket.js | 未详查 |
| PitchSignal AI Chat.dc.html | static/js/ai-chat.js + static/js/bot.js | 未详查 |
