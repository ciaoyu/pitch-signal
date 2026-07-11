# PitchSignal 投稿前模拟审查

更新日期：2026-07-10（Asia/Shanghai）

审查对象：

- `docs/prediction-model-methodology.md`
- `docs/prediction-methodology-review.md`
- `docs/research-publication-roadmap.md`
- `lib/backtest.js`
- `lib/backtest-calibration.js`
- `scripts/run-backtest.js`
- `scripts/test-calibration-report.js`

审查口径：假装我是 JQAS / PLOS ONE / Journal of Sports Analytics 的投稿前内部审稿人，不评价产品体验，只判断这篇工作论文离可投稿学术论文还有多远。

## 总体裁决

**当前不建议直接投期刊全文。**

适合状态：

- **MathSport Asia 2026 500-word abstract：可以准备提交**，需要轻量压缩和重写摘要。
- **arXiv v1：可以在补齐 reproducibility statement 后提交**，但最好先补 1 张校准图。
- **JQAS / JSA / PLOS ONE 正式期刊：需要 major revision**，主要缺口是校准证据、可复现包、引用规范、以及论文/产品边界。

一句话判断：

> 研究主张是可发表的，但当前稿件仍像一份高质量内部工作论文；要变成期刊论文，必须把“我做了一个系统”改写成“我提出并验证了一套评估协议和信号准入机制”。

## 主要问题

### P0 - 校准证据不足，Brier 差距会成为第一审稿风险

位置：

- `docs/prediction-model-methodology.md` 127-134：主结果表报告 Brier 0.5708，参考基线 0.5137。
- `docs/prediction-model-methodology.md` 155-157：承认 Brier 落后，并解释为 draw floor 与多信号方差。
- `docs/research-publication-roadmap.md` 144：已把 reliability diagram 列为投稿前缺口。

问题：

当前论文主动承认 Brier 落后，但没有提供校准曲线、分箱表、ECE、分概率区间的失败模式。审稿人会追问：这是方向准确但概率不可用，还是只是轻度过/欠校准？如果没有图，解释会显得像事后辩护。

已有资产：

- `lib/backtest-calibration.js` 已能生成 top-pick calibration buckets、ECE、Platt 拟合雏形。
- 但它读取的是 `prediction_snapshots + post_match_reviews`，不是 964 场 World Cup historical backtest 的预测逐场输出，因此不能直接作为论文 Figure。

必须补：

- 让 `lib/backtest.js` 或新脚本导出 964 场逐场预测结果：match id/year/date、home/away、p_home/p_draw/p_away、actual outcome、top confidence、correct、Brier、log loss。
- 生成 reliability diagram：
  - top-pick confidence vs empirical accuracy。
  - 最好再补 one-vs-rest outcome calibration：home/draw/away 三条或三张小图。
- 在 Results 里新增 Calibration subsection，不能只放 Future Work。

期刊前置条件：**必须完成。**

### P0 - 可复现包还不够像论文 artifact

位置：

- `scripts/run-backtest.js` 只有 4 行，只能打印结果。
- `lib/backtest.js` 281-289 返回 aggregate metrics，没有导出逐场预测和随机种子。
- `lib/backtest.js` 401-426 bootstrap 使用 `Math.random()`，没有固定 seed。

问题：

`node scripts/run-backtest.js` 可以复现主数字，我已在 2026-07-10 运行确认：

```text
Full history 1930-2022 + Elo hot-start:
964 matches, accuracy 57.88%, Brier 0.5708, log loss 0.9644
```

但对期刊来说，“能打印同样数字”还不够。审稿人/编辑需要知道：

- 数据怎么下载或锁定版本？
- 中间预测结果在哪里？
- bootstrap 是否可重复？
- 964 场具体排除哪一场，为什么？
- 运行命令是否能输出机器可读 artifact？

必须补：

- 增加 `scripts/run-backtest.js --json out/backtest-results.json --csv out/backtest-predictions.csv`。
- bootstrap 加 seed，或至少让脚本接收 `--seed`。
- 增加 `docs/research-reproducibility.md`，写清数据来源、版本、生成命令、许可、预期输出 hash 或摘要。

期刊前置条件：**必须完成。**

### P1 - 当前 Methods 需要分清 evaluated core 与 architecture contribution

位置：

- `docs/prediction-model-methodology.md` 82-86：pre-match fusion 写到 market odds、coach、venue 等生产信号。
- `docs/prediction-model-methodology.md` 108-112：post-match AI learning loop。
- `docs/prediction-model-methodology.md` 159-166：limitations 中解释 live ESPN 和 AI bias。

问题：

这部分不是要删。odds、coach、venue、AI loop、Track A/B 正是 PitchSignal 的设计创新，正式论文应当更详细地解释它们如何组合、如何被治理、如何防止未经验证的信号污染概率。

风险在于证据等级必须清楚。论文的历史实证核心是 964 场 World Cup finals backtest；完整系统贡献是多信号预测系统的准入机制和治理架构。如果 Methods 直接把所有模块写成同等实证结论，审稿人会认为 contribution scope 不清：

- 你到底评估的是 Elo+Poisson+DC 核心，还是完整 PitchSignal 产品？
- market odds 在未来工作里说没集成，但 Methods 3.3 又说 pre-match number 包含 market odds 0.20。
- AI learning loop 没有实证评估，放在主 Methods 会扩大审稿攻击面。

建议：

- 期刊稿采用“一篇论文、两层贡献”的结构，而不是删减产品层：
  - `evaluated forecasting core`：Elo + Poisson + Dixon-Coles + warm-start protocol + 964-match historical evaluation。
  - `gated multi-signal architecture`：odds、coach、venue/travel、Pressure Index、AI post-match loop、Track A/B live repricing。
- 对每个信号列证据等级：
  - `validated in historical backtest`
  - `implemented but not yet historically validated`
  - `display-only / shadow-mode`
  - `future validation track`
- 把重点写成“多信号系统的治理机制”：信号可以采集、展示、解释和审计，但只有通过预注册回测门槛后才允许进入概率融合。
- 明确区分：
  - `evaluated model`：Elo + Poisson + Dixon-Coles + warm-start protocol。
  - `deployed system architecture`：Track A/B、AI post-match loop、odds/coach/venue signals。

期刊前置条件：**必须完成。**

### P1 - 文献综述有证据价值，但还不是期刊引用格式

位置：

- `docs/prediction-model-methodology.md` 43-53：大量 GitHub peer-project table。
- `docs/prediction-model-methodology.md` 184-198：References 只有简略条目。

问题：

JQAS/JSA 可以接受开源项目作为补充证据，但主 Related Work 不能主要靠 GitHub 项目和 marketing pages。现在的综述很好用来制定工程方向，但期刊审稿会要求：

- 经典 football forecasting / scoring model 文献更完整。
- 每条论文引用有 DOI / venue / full title。
- GitHub 项目应作为 “open-source benchmark context” 或 Supplement，不应压过 Maher/Dixon-Coles/Karlis/Groll 等学术线。

必须补：

- BibTeX。
- 把 references 改成正式格式。
- Related Work 改成三段：
  - statistical score models；
  - Elo/rating and tournament forecasting；
  - evaluation leakage / calibration / reproducibility；
  - open-source 2026 peer projects 放最后，作为 practical context。

期刊前置条件：**必须完成。**

### P1 - 负结果写法是优势，但统计检验表述还不够严谨

位置：

- `docs/prediction-model-methodology.md` 136-145：Dixon-Coles ablation。
- `docs/prediction-methodology-review.md` 93-102：DC 裁决。

问题：

当前写法说 “confidence intervals overlap; difference is not statistically distinguishable”。这作为内部结论可以，但期刊里最好更严谨：

- CIs overlap 不等于正式 paired test。
- ρ=-0.13 与 ρ=0 是同一 964 场上的成对预测，应该用 paired bootstrap 或 permutation test。
- Brier 和 accuracy 应分别报告 delta 和 CI。

必须补：

- 对 DC ablation 生成 paired bootstrap：
  - Δaccuracy = +0.21pp for rho=0 或类似；
  - ΔBrier = -0.0016；
  - 95% CI。
- 文案改成 “we found no evidence of a material difference under a paired bootstrap”。

期刊前置条件：**建议完成；JQAS 必须完成。**

### P1 - 研究问题和贡献需要更像论文

位置：

- `docs/prediction-model-methodology.md` 11-15：Introduction。
- `docs/prediction-model-methodology.md` 178-180：Conclusion。

问题：

目前 Introduction 可读，但没有明确列出 research questions / contributions。投稿稿建议明确写：

RQ1. 在 leak-checked walk-forward protocol 下，Elo+Poisson+DC 在 World Cup finals 上达到什么水平？  
RQ2. warm-start Elo 修复冷启动后，性能变化有多大？  
RQ3. Dixon-Coles correction 对 1x2 outcome probability 是否提供可测收益？  
RQ4. 如何设计 live signal gate，避免未经验证信号影响概率？

然后贡献写成 3 条：

- a reproducible 964-match evaluation protocol；
- empirical results and ablations, including a null DC result；
- a gated live-forecasting architecture separating probability movers from descriptive signals。

期刊前置条件：**必须完成。**

### P2 - 题目、摘要和口吻仍偏工作论文

位置：

- `docs/prediction-model-methodology.md` 3-9。

问题：

题目 “The PitchSignal Prediction Model” 对学术期刊太产品化。摘要一句非常长，信息密度高但不符合期刊摘要节奏。建议改成：

`Gated Probability Updates for Football Match Forecasting: A Leak-Checked Evaluation of World Cup Outcome Predictions`

摘要改成 structured/unstructured 皆可，但应分清：

- Background
- Methods
- Results
- Contribution
- Limitations

期刊前置条件：**arXiv 前建议完成；MathSport 摘要另写。**

### P2 - 图表资产不足

位置：

- 当前报告以文字和 Markdown 表格为主。

问题：

正式论文至少需要 4 张图/表：

- Figure 1: evaluated pipeline and leakage guard。
- Figure 2: Track A / Track B signal gate architecture。
- Table 1: evaluation sets and metrics。
- Table 2: DC ablation with paired CI。
- Figure 3: reliability diagram。

目前只有表格，没有 publication-ready figures。

期刊前置条件：**JQAS/JSA/PLOS 前必须完成；MathSport 摘要可不完成。**

### P2 - 数据伦理、AI 使用、代码许可声明缺失

位置：

- `docs/prediction-model-methodology.md` 159-166 有 limitations，但没有 formal statements。

问题：

PLOS ONE 和 JSA 会要求或强烈期待：

- Data availability statement。
- Code availability statement。
- Ethics statement。
- Competing interests。
- AI use disclosure。
- Funding statement。

必须补：

```text
Data availability: Historical match data are from martj42/international_results and openfootball/worldcup.json under CC0-compatible terms...
Code availability: Code will be archived at [repository/Zenodo DOI]...
Ethics: This study uses publicly available aggregate match records and does not involve human participants or personal data...
AI use: The system includes an AI explanation layer, but no AI-generated outputs are used to compute the reported probabilities...
```

期刊前置条件：**必须完成。**

## 当前强项

这些是可以保留并强化的部分：

- 主叙事清楚：未经验证信号不得影响概率。
- 回测纪律强：walk-forward、same-day batching、warm-start Elo。
- 负结果诚实：Dixon-Coles 没有硬说有效。
- 不夸大：明确说没有超越文献基线。
- 与代码绑定：报告直接指向 `lib/backtest.js`、`lib/prediction.js`、`lib/poisson.js`。
- 核心数字可复现：2026-07-10 运行 `node scripts/run-backtest.js`，结果与报告一致。

## 分渠道 readiness

| 渠道 | 当前可投状态 | 裁决 |
|---|---|---|
| MathSport Asia 2026 abstract | 70% | 可以马上写 500-word abstract；不需要等所有期刊缺口补完 |
| arXiv v1 | 60% | 可发，但建议先补 reproducibility statement 和 calibration figure |
| JQAS | 45% | 主线适合，但当前稿件需要 major revision |
| Journal of Sports Analytics | 50% | 比 JQAS 更能容纳系统工程，但仍需补 figures 和 artifact |
| PLOS ONE | 55% | sound science 匹配；但格式、data/code availability、ethics/AI disclosure 必须补齐 |
| SSAC27 abstract | 55% | 需要更强应用叙事和 demo 图；不应先于 MathSport |

## 建议执行顺序

### 第 1 步：先写 MathSport 摘要

原因：截止 2026-08-03，且 500 words 不依赖完整期刊改稿。

交付：

- `docs/submissions/mathsport-asia-2026-abstract.md`
- 500 words 以内。
- 3-5 keywords。
- 结构：Background / Methods / Results / Contribution / Relevance。

### 第 2 步：做论文级回测 artifact

交付：

- `outputs/research/backtest-predictions.csv`
- `outputs/research/backtest-summary.json`
- `outputs/research/calibration-buckets.csv`
- `outputs/research/reliability-diagram.png` 或 `.pdf`
- `docs/research-reproducibility.md`

注意：`outputs/` 是否纳入 git 需要另行决定；期刊 artifact 可以在 release/Zenodo 中保存，不一定直接提交全部生成物。

### 第 3 步：重写 manuscript v1

交付：

- `docs/manuscript/pitchsignal-worldcup-forecasting.md` 或 LaTeX 版本。
- 从产品报告改成论文结构。
- 引用转 BibTeX。
- Methods 收窄到 evaluated model。
- Product architecture 放 Appendix。

### 第 4 步：arXiv v1

交付：

- PDF。
- source bundle。
- data/code availability。
- public repository 或 archived artifact 链接。

### 第 5 步：JQAS 投稿包

交付：

- manuscript。
- cover letter。
- figures。
- supplementary reproducibility package。
- conflict/funding/ethics/AI statements。

## 我建议先不做的事

- 不要现在重写算法。
- 不要现在接入市场赔率作为主结果；这会把论文从“评估纪律”拖到“又一个 ensemble 系统”。
- 不要为了冲击准确率去调参，除非每个改动都过 `compareBaseline` 和 paired test。
- 不要把 AI post-match loop 放在主贡献第一位；它现在还没有审计证据。
- 不要先花时间做 PLOS ONE 格式细节；当前更紧急的是 MathSport 摘要和校准 artifact。

## 审查结论

这篇工作具备发表潜力，但目前不是 “minor edits then submit”。正确判断是：

> Core contribution is publishable; manuscript and artifacts need major revision before journal submission.

最短行动路径：

1. MathSport 摘要先投出去，占住反馈窗口。
2. 同步把 964 场逐场预测导出和 reliability diagram 做出来。
3. 再把工作论文重写成正式 manuscript。
