# Owner H — 教练历史与教练增值研究（README）

独立 worktree：`pitch-signal-worktrees/coach-effect-research`
分支：`codex/coach-effect-research`　基线：`78da1b5`

## 范围

只做 **数据、DAG、覆盖率、OOS 系数**。不修改 `lib/prediction.js`、生产概率或公开 API。
F/G 结果只读引用，不整体合入其分支。当前生产教练信号（中文关键词）保持移除。

## 研究设计

- 目标：控制球队 Elo、球员质量、对手、赛事、场地、休息后，估计国家队教练的
  **相对 xG 残差增值**（value-added），用分层收缩避免短任期被误判为"神帅"。
- 战术风格只来自**可观测行为**（阵型、压迫、推进、换人），不来自中文形容词。
- 时间滚动 OOS（walk-forward）检验 LogLoss / Brier / 校准 / 增量。
- 未通过 OOS → 维持 `usedInModel:false`，仅展示或 shadow。

## 目录

```
docs/research/
  coach-dag.md                因果/共线 DAG、分层收缩、共线性处理
  coach-data-dictionary.md    数据字典、来源与许可、缺失机制
  coach-leakage-guard.md      as-of 防泄漏证明（验收重点）
  coach-deliverables.md       6 项交付物映射 + 入模门槛
data/research/coach/
  manifest.json              来源清单（含许可、外部只读、缺失变量）
  coverage-report.json       真实覆盖审计产出
  oos-report.json            OOS 骨架状态（仅骨架：即便有输入也只 RUNNABLE，系数/后验/VIF/指标待实现+待数据）
scripts/
  research-coach-coverage.js 覆盖审计（真实，可复算）
  research-coach-oos.js      OOS 系数骨架（缺数据诚实 BLOCKED）
```

## 运行

```bash
# 覆盖审计（无需外部数据，真实产出）
node scripts/research-coach-coverage.js

# OOS 系数估计（需外部只读输入；缺数据时 BLOCKED，不伪造）
# 注意：当前脚本仅是骨架——即便上述输入存在，也只报告 RUNNABLE，
# 尚未真正生成系数/后验/VIF/OOS 指标（估计代码待实现 + 待数据）。
export COACH_RESEARCH_TENURE_DIR=/path/to/readonly/tenure-history
export COACH_RESEARCH_POOL_DIR=/path/to/readonly/international-results
export COACH_RESEARCH_XG_REF=/path/to/F/xg-artifact   # 可选，作 xg 残差
node scripts/research-coach-oos.js
```

## 当前状态

- 6 项交付物中 5 项已文档化/真实产出；OOS 估计**尚未实现（仅骨架）**——外部输入存在时也只报 RUNNABLE，系数/后验/VIF/指标**待实现 + 待数据**，文档称"待实现/待数据"，不称 OOS 已就绪。
- **教练效应当前不允许进入生产概率**（usedInModel:false），待稳定 OOS 正增量证明。
- 按治理：本地提交，**不合并、不推送、不部署**。
