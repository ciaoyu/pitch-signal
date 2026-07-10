# 决赛周九分支整合验收（2026-07-10）

## 范围与边界

- worktree：`/Users/zbbb/Documents/Projects/pitch-signal-worktrees/integration-final-week`
- 分支：`codex/integration-final-week`
- 基线：`33e278d`（C v2，含 A+B+C）
- 本验收未 push、未合并 `main`、未部署。

## 合并顺序

1. `codex/research-artifacts-v2`：`e6860a9`
2. `codex/environment-research`：`5ab194c`
3. `player-lineup-xg-research`：`794fc0f`
4. `codex/coach-effect-research`：`6171172`
5. `codex/market-shadow-ledger`：`104786f`

## 冲突裁决

- G 合并时，`scripts/test-eval-baselines.js` 与 `scripts/test-w1d-pipeline-audit.js` 出现预审的 add/add 内容冲突。两处均保留 D（research-artifacts-v2）版本：模型 Brier `0.57018207`、LogLoss `0.966225`，以及 decay-run Brier `0.5714954`。
- `scripts/test-runner.js` 自动合并；B、D、G 的测试注册均保留（分别为 `test-prediction-model-ledger.js`、`test-research-artifacts-v2.js`、`test-market-shadow-ledger.js`）。
- G 的 `lib/prediction.js` 版本已按 T0 裁决收编：Polymarket 融合物理移除，保持 shadow-only；该文件后续独占权仍归 A。

## 聚焦验证

| 分支 | 命令/验证 | 结果 |
|---|---|---|
| D | `test-research-artifacts-v2.js`、`test-eval-baselines.js`、`test-w1d-pipeline-audit.js` | 4 sections、15、24 通过 |
| E | environment OOS/pool helpers、eval baseline、pipeline audit | 全部通过 |
| F | `backfill-player-events.js` 后 `test-f-data-audit.js` | 90 通过、0 失败；457 events / 83 matches / 83 officials |
| H | eval baseline、pipeline audit | 15、24 通过 |
| G | `test-market-shadow-ledger.js`、eval baseline、pipeline audit | 45、15、24 通过 |

全量 `npm test` 已执行；runner 当前注册 81 个套件，账本套件、市场账本和 P0 隔离回归均通过。为让账本套件在统一 runner 下使用它设计的可重开磁盘临时数据库，`test-prediction-model-ledger.js` 清除了 runner 注入的 `TEST_MODE=1`；这不改变生产数据库、概率或业务逻辑。

## 契约抽查

1. **公开信号**：P0 回归确认 `activeSignals = ['elo', 'poisson']`；Coach/Venue/Fatigue 不在 components 或 weights 中。
2. **市场隔离**：G6 确认注入 odds 与 Polymarket 前后 `homeWin/draw/awayWin` 逐值相同，候选均为 `usedInModel: false`。
3. **淘汰赛语义**：P0 回归 96/96、KO wiring 21/21；`regulation` 是归一的 90 分钟 H/D/A，`advance` 为独立、不可用时返回 null 的显示目标，未伪造 50/50 或混入公开概率。

## 前端 NaN 收尾

- `static/js/elo-prediction.js` 不再读取已删除的 `components.coach` 概率，改为“已隔离，不参与模型”占位。
- 权重行仅渲染 API 实际给出的有限数值键，避免不存在的 odds/coach/venue 显示 NaN。
- 已运行 `npm run build:js`；`static/js/bundle.js` 已重建，`templates/index.html` 更新为 `bundle.js?v=1504f802`。
- 前端修复提交：`b658408`；测试隔离修复提交：`ea673b1`。

补充：JSDOM UI 冒烟成功加载 bundle 并收到预测 API 的 200 响应，但在异步预测请求完成前即以“Prediction tab empty or malformed”退出；同时外网 Google Fonts 加载发生 TLS reset。此项未计为通过，且没有修改其测试时序。T0 用真实浏览器打开预测页独立复核：数据正常渲染、教练卡显示“已隔离，不参与模型”、权重行仅显示 `Elo 44% · Poisson 56%`，确认 JSDOM 失败是收尾时机问题，不是真实回归。

## T0 用户验收发现的三个问题（07-11，push 前修复）

用户直接在本 worktree 的预览环境里试用，发现三处问题，T0 逐一排查：

1. **教练因素卡多余**：既然 Coach 已不入模，详情展开区仍保留一张只显示"已隔离，不参与模型"占位文案的卡片，没有信息量。**修复**：删除该卡片，Elo 预测 / Poisson 预测 / 可能比分 改为 3 列一行（原 2×2 网格，第四格常年空着）。提交 `8970d9d`，含 `elo-prediction.js` 源码、`npm run build:js` 重建的 `bundle.js`、`index.html` 版本号更新（`v=c6e1abdc`）。真实浏览器验证：三卡并排，无教练卡。

2. **淘汰赛对阵图部分队名中英混杂**：用户截图显示 R32 阶段"Sweden"、"South ..."、"Canada"、"Bosnia..."显示英文，其余队伍（德国、法国等）显示中文。**根因排查**：`lib/bracket-updater.js` 的 `teamFromScheduleOrCode()` 从原始 ESPN 赛程解析队伍 `name`/`id`（该数据源本身不带 `nameI18n` 字段），因此硬编码 `nameI18n: null`；随后的 `Object.assign` 会用这个 `null` 覆盖掉 `resolveSlot()` 已经从 `posMapI18n` 正确解析出的中文名。实际表现为：晋级的队伍会在下一轮被"胜者传递"逻辑重新赋值（带正确 `nameI18n`），而被淘汰的队伍永久停留在这个 `null` 状态——这不是"数据缺失"，是查找键丢失。**修复**：在 `buildResolvedBracket` 循环里，若 `nameI18n` 仍缺失但 `id`（数字 ESPN ID）存在，用已注入的 `getTeamNameI18n(id)` 回填。提交 `87601df`。已用 `/api/bracket` 直接验证 Sweden/South Africa/Canada/Bosnia-Herzegovina 均返回正确 `{zh, en}`，并在真实浏览器的淘汰赛对阵图（R32 列）确认瑞典、南非、加拿大、波黑均已正确显示中文。

3. **点开比赛显示"加载失败"**：T0 用 `window.openMatch()` 直接测试了多场真实比赛（已完赛小组赛、点球大战淘汰赛、今日 QF），均正常加载，未能复现。用户后续确认该问题不再出现。判定为一次性/环境性问题，不追加代码改动；如后续复现需报具体 matchId。

以上两处代码修复后已重跑全量 `npm test`：**81 suites / 1071 asserts 全绿**，与合并后的基线一致，未引入回归。
