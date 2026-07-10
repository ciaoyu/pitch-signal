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
