# PitchSignal 学术发表执行计划

更新日期：2026-07-10（Asia/Shanghai）

本计划把已经讨论过的发表路线、校准分析、reproducibility artifact、Dixon-Coles paired test、BibTeX、以及一篇论文的正文结构，拆成可并行派工的 workstream。目标是让多人可以同时开 worktree 开始做，不互相覆盖文件。

## 已确认决策

1. **只写一篇论文。**  
   论文不是拆成“评估论文”和“系统论文”两篇，而是一篇里同时讲清：
   - evaluated forecasting core：Elo + Poisson + Dixon-Coles + warm-start walk-forward evaluation。
   - gated multi-signal architecture：odds、coach、venue/travel、Pressure Index、Track A/B、AI post-match learning loop 如何被使用、隔离、验证和升级。

2. **MathSport Asia 2026 摘要不用等全部数据分析完成。**  
   摘要先走，截止 2026-08-03。它可以写成：历史评估覆盖核心概率引擎，系统架构贡献是把已验证概率信号和未验证上下文信号分层治理。

3. **正式期刊稿不删除 odds/coach/venue/AI loop。**  
   它们是设计创新。要做的是给每个信号标证据等级，而不是把所有模块都伪装成已经历史回测通过。

4. **期刊前必须补校准和 artifact。**  
   reliability diagram、ECE、分箱校准表、逐场预测 CSV/JSON、固定 bootstrap seed、数据版本说明、Dixon-Coles paired bootstrap 是正式稿的硬前置。

## 总顺序

```text
S0 规划冻结
  ↓
S1 MathSport 摘要先行，不等 artifact
  ↓
S2 研究 artifact：逐场预测、seeded bootstrap、校准表
  ↓
S3 Dixon-Coles paired bootstrap
  ↓
S4 图表与数据说明
  ↓
S5 一篇论文 manuscript v1
  ↓
S6 arXiv/JQAS 投稿包
```

并行策略：

- S1 可以立刻开始。
- S2 是数据分析主干，越早越好。
- S5 可以先搭骨架，但 Results/Calibration/Paired Test 要等 S2/S3 输出。
- S4 依赖 S2/S3 的 CSV/JSON。

## Worktree 总规则

建议先把当前计划类文档合并到主分支或一个 coordination 分支，再从同一基线创建 worktree。不要多人同时改同一个文件。

推荐目录：

```bash
cd /Users/zbbb/Documents/Projects

git -C pitch-signal worktree add ../pitch-signal-mathsport codex/research-mathsport-abstract
git -C pitch-signal worktree add ../pitch-signal-artifacts codex/research-artifacts
git -C pitch-signal worktree add ../pitch-signal-manuscript codex/research-manuscript-v1
git -C pitch-signal worktree add ../pitch-signal-bibtex codex/research-bibtex
```

如果分支不存在，用：

```bash
git -C pitch-signal worktree add -b codex/research-artifacts ../pitch-signal-artifacts
```

不要在多个 worktree 同时编辑：

- `lib/backtest.js`
- `scripts/run-backtest.js`
- `docs/prediction-model-methodology.md`
- `README.md`
- `README.zh.md`

## Workstream A - MathSport Asia 2026 摘要

优先级：P0，马上做。  
建议 worktree：`../pitch-signal-mathsport`  
建议分支：`codex/research-mathsport-abstract`

边界：

- 只写提交材料，不改代码。
- 不等 S2/S3。
- 不声称 odds/coach/venue/AI loop 已经全部历史验证。

文件：

- 新增 `docs/submissions/mathsport-asia-2026-abstract.md`
- 可选新增 `docs/submissions/mathsport-asia-2026-submission-notes.md`

摘要结构：

```text
Title
Background
Methods
Results
Architecture contribution
Keywords
```

必须包含：

- 964 World Cup finals matches, 1930-2022。
- walk-forward evaluation with same-day leakage isolation。
- warm-start Elo snapshots。
- 57.88% accuracy, 95% CI 54.8-61.1%, Brier 0.5708, log loss 0.9644。
- Dixon-Coles low-score correction currently shows no material outcome gain; paired test pending if not ready。
- Multi-signal governance: hard facts and validated signals can move probability; pressure/AI/context signals remain gated until validated。

验收标准：

- 500 words 以内。
- 3-5 keywords。
- 不超过 1 张表或图；建议先无图。
- 读完能看出“不是新算法，是评估纪律 + 信号准入机制”。

## Workstream B - 研究 artifact 与校准分析

优先级：P0。  
建议 worktree：`../pitch-signal-artifacts`  
建议分支：`codex/research-artifacts`

边界：

- 可以改 `lib/backtest.js` 和 `scripts/run-backtest.js`。
- 不改模型参数，不调权重，不追求提高准确率。
- 只增加导出、seed、校准、统计输出。

核心任务：

1. 让 walk-forward 输出逐场预测 rows。
2. 给 bootstrap 加固定 seed。
3. 导出 CSV/JSON artifact。
4. 生成 calibration buckets、ECE、reliability diagram 所需数据。

建议命令目标：

```bash
node scripts/run-backtest.js \
  --seed 20260710 \
  --json outputs/research/backtest-summary.json \
  --csv outputs/research/backtest-predictions.csv \
  --calibration outputs/research/calibration-buckets.csv
```

逐场 CSV 字段：

```text
year
date
stage
home
away
homeScore
awayScore
actualOutcome
pHome
pDraw
pAway
predictedOutcome
topConfidence
correct
brier
logLoss
rho
methodology
```

summary JSON 字段：

```text
seed
generatedAt
nodeVersion
methodology
dataSources
exclusionRules
evaluatedCount
accuracy
accuracyCI
brier
brierCI
logLoss
logLossCI
calibration
```

calibration buckets：

- top-label calibration：
  - `binLower`
  - `binUpper`
  - `count`
  - `avgConfidence`
  - `empiricalAccuracy`
  - `gap`
  - `absGap`
- ECE：
  - `sum(count / n * absGap)`

推荐 bin：

```text
0.30-0.40
0.40-0.50
0.50-0.60
0.60-0.70
0.70-0.80
0.80-0.90
0.90-1.00
```

也可以保留 0.0-1.0 十等分，但足球三分类 top confidence 通常不会低于 1/3，论文图里建议从 0.30 开始更清楚。

额外建议：

- 同时生成 classwise one-vs-rest 校准数据：
  - `home probability vs actual home win`
  - `draw probability vs actual draw`
  - `away probability vs actual away win`

验收标准：

- 同一 seed 重跑，summary 数值和 CI 完全一致。
- 默认命令仍能打印当前报告中的三组主结果。
- CSV 行数为 964。
- ECE 有明确数值。
- 不改变现有模型输出。
- 运行：

```bash
node scripts/run-backtest.js --seed 20260710 --json /tmp/backtest-summary.json --csv /tmp/backtest-predictions.csv --calibration /tmp/calibration-buckets.csv
node scripts/test-calibration-report.js
npm test
```

## Workstream C - Dixon-Coles paired bootstrap

优先级：P0/P1，依赖 B 的逐场导出能力。  
建议 worktree：可以和 B 同一个 worktree；若分开，必须等 B merge 后再开。  
建议分支：`codex/research-paired-tests`

边界：

- 不讨论是否删除 Dixon-Coles。
- 不改默认 `rho=-0.13`。
- 只比较 `rho=-0.13` 与 `rho=0` 在同一批 964 场上的 paired delta。

解释：

当前报告只说两个配置的 confidence intervals overlap，这不够严谨。两个模型预测的是同一批比赛，所以应该比较每场的差值：

```text
delta_accuracy_i = correct_rho0_i - correct_rhoNeg013_i
delta_brier_i = brier_rho0_i - brier_rhoNeg013_i
```

然后对 964 场 match rows 做有放回抽样，重复 10,000 次，得到：

```text
mean_delta_accuracy
95% CI for delta_accuracy
mean_delta_brier
95% CI for delta_brier
```

建议输出文件：

- `outputs/research/dixon-coles-paired-test.json`
- `outputs/research/dixon-coles-paired-test.csv`

建议命令：

```bash
node scripts/run-backtest.js \
  --seed 20260710 \
  --paired-dc outputs/research/dixon-coles-paired-test.json
```

论文可用句式：

```text
Disabling the Dixon-Coles correction changed accuracy by X percentage points
(95% paired bootstrap CI [L, U]) and Brier score by Y
(95% paired bootstrap CI [L, U]). We therefore found no evidence of a
material difference in 1x2 outcome performance.
```

验收标准：

- 报告 baseline `rho=-0.13` 和 candidate `rho=0` 的 accuracy/Brier/log loss。
- 报告 paired deltas 和 95% CI。
- seed 固定。
- 结论不夸大：如果 CI 跨 0，只说 no evidence of material difference。

## Workstream D - 图表资产

优先级：P1，依赖 B/C。  
建议 worktree：`../pitch-signal-figures`  
建议分支：`codex/research-figures`

边界：

- 优先用 B/C 输出的 CSV/JSON。
- 不重新跑或改模型逻辑。
- 图表必须可再生成。

建议文件：

- `scripts/render-research-figures.js`
- `outputs/research/figures/reliability-diagram.svg`
- `outputs/research/figures/classwise-calibration.svg`
- `outputs/research/figures/evaluation-pipeline.svg`
- `outputs/research/figures/signal-gate-architecture.svg`

图 1：Evaluation pipeline and leakage guard。

必须表达：

- historical results input。
- pre-tournament Elo snapshot。
- same-day prediction batch。
- update only after all same-day predictions。
- metrics and bootstrap。

图 2：Gated multi-signal architecture。

必须表达：

- probability movers：Elo、Poisson/DC、validated signals。
- display/shadow signals：Pressure Index、AI lessons、unvalidated context。
- promotion gate：backtest beats base rate。
- output：probability + explanation + uncertainty。

图 3：Reliability diagram。

必须表达：

- x = average predicted confidence。
- y = empirical accuracy。
- diagonal perfect calibration line。
- point size or labels = bin count。
- ECE in caption。

验收标准：

- SVG 或 PDF 矢量图。
- 可由命令重生成。
- captions 草稿写在 `docs/research-figure-captions.md`。

## Workstream E - BibTeX 与正式引用

优先级：P1，可并行。  
建议 worktree：`../pitch-signal-bibtex`  
建议分支：`codex/research-bibtex`

边界：

- 不改代码。
- 不重写主文，只准备 references 和 citation keys。

文件：

- 新增 `docs/references/pitchsignal-references.bib`
- 新增 `docs/references/reference-notes.md`

必须包含：

- Maher 1982。
- Dixon & Coles 1997。
- Karlis & Ntzoufras 2003。
- Groll et al. 2018。
- arXiv:2408.08331。
- Shin 1993。
- FIFA ranking procedure。
- openfootball/worldcup.json。
- martj42/international_results。
- peer GitHub projects as software references, not primary academic literature。

说明：

BibTeX 是引用数据格式，不是正文格式。它让 LaTeX / Pandoc 按期刊格式自动生成 references。

验收标准：

- 每个学术条目有 title、author、journal/conference、year；能查到 DOI 的补 DOI。
- GitHub/software 条目用 `@misc`，包含 URL、访问日期、license 如可得。
- citation keys 稳定，如 `dixon1997modelling`。

## Workstream F - 一篇论文 manuscript v1

优先级：P1，S2/S3 输出前可先搭结构。  
建议 worktree：`../pitch-signal-manuscript`  
建议分支：`codex/research-manuscript-v1`

边界：

- 不直接覆盖 `docs/prediction-model-methodology.md`。
- 新稿放 `docs/manuscript/`。
- 先写 Markdown，后续再转 LaTeX。

文件：

- 新增 `docs/manuscript/pitchsignal-worldcup-forecasting.md`
- 新增 `docs/manuscript/outline.md`
- 新增 `docs/manuscript/signal-evidence-table.md`

一篇论文结构：

```text
Title
Abstract
1. Introduction
2. Related Work
3. System Overview: Gated Forecasting Architecture
4. Evaluated Forecasting Core
5. Evaluation Protocol
6. Results
7. Calibration and Reliability
8. Dixon-Coles Ablation and Paired Test
9. Multi-Signal Governance: odds, coach, venue, pressure, AI loop
10. Limitations
11. Conclusion
```

核心写法：

- 不是“产品介绍”。
- 不是“新算法”。
- 是“一套世界杯预测系统的可复现评估 + 多信号准入治理架构”。

信号证据等级表必须放入正文或 Appendix：

| Signal | Source | Current role | Can move probability? | Validation gate | Current evidence |
|---|---|---|---|---|---|
| Elo | historical results | prior | yes | walk-forward | 964-match backtest |
| Poisson/DC | score model | score distribution/probability | yes | ablation | paired test |
| odds | licensed odds API | benchmark or future fusion | not by default | de-vig + backtest | future |
| coach | structured metadata | contextual prior | gated | ablation | not yet historical |
| venue/travel | location/weather/rest | contextual prior | gated | ablation | not yet historical |
| pressure index | live stats | display only | no | future-goal-rate test | not yet |
| AI loop | explanations/lessons | shadow mode | no | lesson verification | not yet |

注意：这张表不是弱化创新，而是强化“治理机制”。它告诉审稿人：我们知道哪些信号可以进概率，哪些还不能。

验收标准：

- 摘要 250-300 words。
- Introduction 明确 4 个 research questions。
- Results 数字来自 S2/S3 artifact。
- Calibration section 引用 reliability diagram 和 ECE。
- Architecture section 详细说明 odds/coach/venue/AI loop 的使用方式和升级门槛。
- 不声称未验证信号已经提高概率表现。

## Workstream G - Reproducibility / data statement / ethics / AI disclosure

优先级：P1，依赖 B，但可先起草。  
建议 worktree：可与 F 同一个，或单独 `codex/research-statements`。

文件：

- 新增 `docs/research-reproducibility.md`
- 新增 `docs/manuscript/statements.md`

必须包含：

```text
Data availability
Code availability
Ethics statement
AI use disclosure
Funding statement
Competing interests
License notes
```

AI use disclosure 重点：

- AI explanation layer exists in the system。
- AI does not directly compute or alter reported probabilities。
- Historical backtest results do not depend on AI-generated outputs。
- Any AI assistance in manuscript drafting, if used, will be disclosed according to journal policy。

验收标准：

- PLOS ONE/JSA 可直接复用。
- arXiv README 可复用。

## 合并顺序

推荐 merge 顺序：

1. Planning docs：`docs/research-publication-roadmap.md`、`docs/research-pre-submission-review.md`、本计划。
2. Workstream A：MathSport abstract。
3. Workstream B：artifact and calibration export。
4. Workstream C：paired DC test。
5. Workstream D：figures。
6. Workstream E：BibTeX。
7. Workstream G：statements/reproducibility。
8. Workstream F：manuscript v1。

原因：

- B/C/D 给 F 提供真实结果和图。
- A 不依赖任何人，不能等。
- E/G 可并行，但最终要被 F 引用。

## 不要做的事

- 不要为了论文临时调模型权重。
- 不要把 market odds 接入主结果，除非另开验证专题。
- 不要让 AI loop 改概率。
- 不要把 Pressure Index 写成已验证预测信号。
- 不要多个 worktree 同时改 `lib/backtest.js`。
- 不要把 generated outputs 大量塞进 git，除非先决定哪些 artifact 需要版本化。

## 当前可以立刻派出的任务

### 给写作负责人

任务：Workstream A。  
输入：`docs/research-publication-roadmap.md`、`docs/prediction-model-methodology.md`。  
输出：`docs/submissions/mathsport-asia-2026-abstract.md`。  
期限：越快越好，不等 artifact。

### 给数据分析负责人

任务：Workstream B + C。  
输入：`lib/backtest.js`、`scripts/run-backtest.js`、`lib/backtest-calibration.js`。  
输出：逐场 CSV/JSON、calibration buckets、ECE、paired DC test。  
边界：不改模型参数。

### 给图表负责人

任务：Workstream D。  
输入：等 B/C 输出。  
输出：reliability diagram、pipeline diagram、signal gate diagram。  
边界：只读 artifact，不改模型。

### 给文献负责人

任务：Workstream E。  
输入：当前 references 和 related work。  
输出：BibTeX + reference notes。  
边界：不重写正文。

### 给 manuscript 负责人

任务：Workstream F + G。  
输入：当前 methodology、review、publication roadmap、本计划。  
输出：一篇论文 v1。  
边界：保留 odds/coach/venue/AI loop 作为系统创新，但标清证据等级。

## 完成定义

到可以投 arXiv v1：

- MathSport abstract 已完成或已提交。
- `run-backtest` 可导出逐场 artifact。
- reliability diagram 和 ECE 已生成。
- DC paired bootstrap 已生成。
- manuscript v1 有 data/code/ethics/AI disclosure。
- references 至少有 BibTeX 草案。

到可以投 JQAS：

- arXiv v1 已稳定。
- 所有 figures 是 publication-ready。
- paired tests 和 calibration analysis 写入 Results。
- multi-signal architecture 有证据等级表。
- cover letter、statements、supplementary reproducibility package 完成。

