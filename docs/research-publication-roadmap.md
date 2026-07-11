# PitchSignal 研究发表路线与投稿规范

更新日期：2026-07-10（Asia/Shanghai）

本文把 `docs/prediction-model-methodology.md` 这篇工作论文，从内部方法论说明转化为可投稿研究论文的路线、要求和准备清单。当前判断基于仓库已有 964 场 walk-forward 回测、`docs/prediction-methodology-review.md` 的外部证据台账，以及 2026-07-10 重新核对过的官方投稿页面。

## 结论

最合适的路线不是先冲机器学习期刊，而是先走体育量化社区反馈，再投体育统计/开放科学期刊：

1. **立即准备 MathSport Asia 2026 摘要**，截止 **2026-08-03**。这是最近的真实窗口，500 词摘要即可进入反馈循环。
2. **同时准备 arXiv 预印本**，主类目建议 `stat.AP`，可交叉到 `cs.LG` 或 `cs.CE`，但不要把叙事写成“新 ML 算法”。
3. **期刊主投 JQAS**。它是体育量化分析的最对口期刊，PitchSignal 的“评估纪律 + 可复现协议 + 信号闸门”比“新算法”更适合这里。
4. **备投 PLOS ONE 或 Journal of Sports Analytics (JSA)**。PLOS ONE 适合方法可靠、负结果诚实、可复现的稿件；JSA 比 PLOS ONE 更垂直，但需要把工程应用价值写得更强。
5. **SSAC27 可作为曝光型冲刺**，摘要截止 **2026-10-01**。它要求开源数据仓库链接，评审看 novelty、rigor、reproducibility、application；可投，但不应作为唯一主线。

## 论文定位

PitchSignal 的可发表贡献应表述为：

> We do not claim a new predictive algorithm. We contribute a leak-checked, reproducible evaluation protocol for World Cup outcome forecasting and an engineering architecture that prevents unvalidated live signals from silently moving reported probabilities.

中文核心叙事：

> 这篇论文的价值不是“预测更准”，而是“知道什么时候不能让一个信号影响概率”。它把体育预测系统中常见的自我欺骗点，变成可审计的评估协议和工程约束。

不要主张：

- “显著超越文献基线”
- “AI 提高预测准确率”
- “Dixon-Coles 带来明确收益”
- “压力指数已经能提前预测进球”

应该主张：

- 964 场 World Cup finals walk-forward backtest
- same-day leakage isolation
- warm-start Elo 修复冷启动偏差
- bootstrap 95% CI
- Dixon-Coles 负结果照实披露
- Track A/B live repricing gate：硬事实进概率，软信号先验证再升级

## 推荐渠道

| 优先级 | 渠道 | 当前适配度 | 为什么适合 | 主要风险 |
|---|---:|---|---|---|
| 1 | MathSport Asia 2026 | 高 | 主题列表明确包含 match outcome models、statistics/probability models、sports analytics and AI、betting and sports；只需 500 词英文摘要，最近窗口可行动 | 是会议反馈，不是最终期刊发表 |
| 2 | arXiv | 高 | 免费、快速、建立时间戳；适合先发布完整方法论稿和补充代码链接 | 不是同行评审；首次提交可能需要 endorsement |
| 3 | JQAS | 最高 | JQAS 是 ASA 官方期刊，范围包含 game outcome models、within-game strategy、ranking methods；读者正是体育统计/OR/ML 社区 | 需要更强的“original approach”表述，不能像内部工程报告 |
| 4 | PLOS ONE | 中高 | 接受 sound science、负结果、方法/软件/数据库/工具类研究；不按“影响力是否轰动”做编辑判断 | APC 高；体育分析垂直能见度低于 JQAS |
| 5 | Journal of Sports Analytics | 中高 | 体育分析垂直，接受 Original Research，强调 practical applications | APC；需要把应用和行业价值写得更清楚 |
| 6 | SSAC27 | 中 | 影响力高，要求开源与应用价值；足球 track 对口 | 竞争强、偏新颖/行业冲击，独立研究者要用演示和可复现性补强 |
| 7 | JRSS Series C / The American Statistician | 中低 | 如果把论文重写成“统计实践/评估纪律案例”，有理论上的契合 | 当前稿件方法创新不足，作为第一目标风险偏高 |
| 暂不建议 | ML 主刊/KDD 主会 | 低 | 当前负结果是“复杂 ML 未必有帮助”，不符合多数主线期待 | 需要新算法或显著性能增益 |

## 各渠道硬性要求

### MathSport Asia 2026

- 日期地点：2026-12-08 至 2026-12-10，IIM Kozhikode, Kerala, India。
- 摘要截止：**2026-08-03**。
- 决定通知：2026-08-18。
- 完整论文截止：2027-02-28。
- 摘要要求：英文，最多 500 words，3-5 keywords，经 Microsoft CMT 提交。
- 推荐摘要结构：
  - Background: football prediction tools often report probabilities without leak-checked evaluation.
  - Methods: Elo + independent Poisson + Dixon-Coles, 964-match walk-forward World Cup finals backtest.
  - Results: 57.88% accuracy, 95% CI 54.8-61.1%, Brier 0.5708, Dixon-Coles ablation null.
  - Contribution: gate architecture for live signals; unvalidated pressure signals displayed but excluded from probability.
  - Relevance: match outcome models, sports analytics and AI, betting/market benchmark discipline.

### arXiv

- 成本：免费。
- 账号：必须由注册作者提交；新用户或新类目可能需要 endorsement。
- 推荐主类目：`stat.AP`（Applications）。
- 可选交叉类目：`cs.LG`（如果强调 ML 对比/负结果）、`cs.CE`（如果强调工程计算系统）。
- 格式：优先 LaTeX source；PDF 也可，但 arXiv 明确偏好 TeX/LaTeX。
- 文件要求：文件名只用 `a-z A-Z 0-9 _ + - . , =`，不要空格；图必须随稿件打包，不能只给外链。
- 预印本标题建议：
  - `Gated Probability Updates for Football Match Forecasting: A Leak-Checked Evaluation of a World Cup Prediction System`
  - 或 `When Not to Move the Number: Evaluation Discipline in World Cup Match Forecasting`

### JQAS

- 全名：Journal of Quantitative Analysis in Sports。
- 地位：American Statistical Association 官方期刊，De Gruyter Brill 出版。
- 范围契合点：game outcome models、within-game strategy、player/team ranking methods、sports analytics methods。
- 当前开放获取提示：页面显示 current volume 通过 Subscribe to Open 开放，accepted articles under Creative Commons at no cost to authors；同页也列出 De Gruyter OA option `US$2,450`，因此提交前必须再次确认费用口径。
- 投稿系统：ScholarOne。
- 论文改写重点：
  - 把“工程项目说明”压缩成“可复现研究设计”。
  - Related Work 要更学术化，减少 GitHub 项目篇幅，保留它们作为 reproducibility/peer-project evidence。
  - Methods 要公式化：Elo update、Poisson λ、Dixon-Coles τ、walk-forward protocol、same-day batching。
  - Results 必须补 calibration/reliability diagram，否则 Brier 讨论说服力不足。

### PLOS ONE

- 范围：原创研究、研究方法、软件/数据库/工具；明确接受 negative/null results。
- 评审标准：不以 perceived significance or impact 决定，重点是技术标准、细节充分、结论由数据支持、数据可用性和研究诚信。
- 费用：PLOS 当前费用页列出 PLOS ONE “All other articles”为 **US$2,477**，按提交日费率计。
- 格式：
  - 英文。
  - Word: DOC/DOCX/RTF；LaTeX 需要提交 PDF。
  - 无字数、图表、补充材料数量上限，但要求简洁。
  - title page、abstract、introduction、materials and methods、results、discussion/conclusion、references。
  - abstract 最多 300 words。
  - cover letter 单独上传，最多 1 页。
- 适配写法：
  - 强调 original research + research method，而不是产品发布。
  - 把“负结果”写成有效科学发现：Dixon-Coles 对 1x2 outcome accuracy 无显著效果；ML/复杂度不是可靠增益来源。

### Journal of Sports Analytics

- 范围：sports analytics research 的 practical applications，面向 team owners、GMs、coaches、fans、academics。
- 评审：double anonymized。
- 费用：APC **US$1,600**；无投稿费。
- 预印本：接受。
- 摘要：unstructured abstract，200 words。
- 关键词：4-5 个。
- 格式：Word preferred；LaTeX accepted。
- 数据政策：鼓励公开数据仓库和 data availability statement。
- 适配写法：
  - 比 JQAS 更强调“实际系统如何避免错误使用 live signals”。
  - 题目可以更应用化：`A Gated Live-Forecasting Architecture for Football Match Probabilities`。

### SSAC27 Research Paper Competition

- 摘要截止：**2026-10-01 11:59 p.m. EST**。
- 完整论文邀请通知：2026-10 下旬。
- 完整论文截止（若入选）：2026-12-04。
- Soccer track 对口。
- 摘要要求：少于 500 words，可包含最多两张图/表；必须有 Introduction、Methods、Results、Conclusion。
- 开源要求：提交 GitHub 或其他 open-source repository 链接，包含用于研究的数据；代码不强制但鼓励。
- 评审要点：novelty、academic rigor、reproducibility、application、impact。
- PitchSignal 的 SSAC 版本必须更尖锐：
  - “Most live football prediction products mix pressure narratives into probabilities without evidence; we demonstrate a gated alternative.”
  - 增加一个可视化 demo：同一比赛里 Track A 概率与 Track B Pressure Index 分离展示。

## 投稿前缺口清单

| 缺口 | 为什么重要 | 最小交付 |
|---|---|---|
| Calibration / reliability diagram | Brier gap 是当前最大审稿风险，必须证明知道概率校准问题在哪里 | 1 张 reliability diagram，按预测概率分箱；附 bootstrap CI |
| Reproducibility package | JQAS、PLOS、SSAC 都会追问可复现性 | `scripts/run-backtest.js` 的一键命令、固定数据版本、README、输出 CSV |
| Data availability statement | 所有主投渠道都会要求或强烈鼓励 | 写清 martj42/openfootball CC0 数据、ESPN live data 不进入历史回测、仓库代码许可 |
| Anonymized manuscript variant | JSA double anonymized；其他期刊也可能要求匿名评审 | 去掉 PitchSignal 仓库名、作者名、URL；把 repo 链接放补充材料或 after-review |
| AI use disclosure | 论文涉及 AI post-match loop，也可能使用 AI 辅助写作 | 明确 AI 不作为作者；说明 AI layer 不改变概率；如使用 AI 辅助润色，在致谢/cover letter 披露 |
| Ethics statement | 数据非人体实验，但期刊仍常要求 statement | `This study uses publicly available aggregate match records and does not involve human participants or personal data.` |
| Figures as publication assets | 现有内部文档表格足够，但期刊需要图 | 系统架构图、walk-forward protocol 图、results table、DC ablation table、reliability diagram |

## 推荐论文结构

### Title

推荐主标题：

`Gated Probability Updates for Football Match Forecasting: A Leak-Checked Evaluation of a World Cup Prediction System`

备选：

- `When Not to Move the Number: Evaluation Discipline in World Cup Match Forecasting`
- `A Reproducible Evaluation Protocol for World Cup Match Outcome Forecasting`

### Abstract

按 5 句写，不要宣传：

1. Problem: public football forecasting tools often blend unverified live signals into reported probabilities.
2. Method: evaluate an Elo-plus-Poisson-plus-Dixon-Coles system using 964 World Cup finals matches in walk-forward order.
3. Leakage control: same-day batching and warm-start Elo snapshots prevent future information from entering historical predictions.
4. Results: accuracy, CI, Brier, log loss, Dixon-Coles null ablation.
5. Contribution: a gated architecture where hard facts can move probabilities and soft live signals remain descriptive until backtested.

### Sections

1. Introduction
2. Related Work
3. Model Architecture
4. Evaluation Protocol
5. Results
6. Ablations and Negative Results
7. Live Signal Gate: Track A / Track B
8. Limitations
9. Conclusion

## 封面信要点

JQAS/JSA 版本：

```text
Dear Editors,

We submit this manuscript as an original research article on football match outcome forecasting and evaluation methodology. The paper does not claim a new predictive algorithm. Its contribution is a reproducible, leak-checked evaluation protocol for World Cup forecasting and a gated live-forecasting architecture that prevents unvalidated in-match signals from affecting reported probabilities.

Using 964 FIFA World Cup finals matches from 1930-2022, we evaluate an Elo-plus-independent-Poisson model with a Dixon-Coles low-score correction under a walk-forward protocol with same-day leakage isolation and warm-start Elo snapshots. The model reaches 57.88% outcome accuracy with a 95% bootstrap confidence interval of 54.8-61.1%, consistent with independent Elo-family baselines. We also report a null result: disabling the Dixon-Coles correction does not produce a statistically distinguishable change in outcome accuracy.

We believe this contribution fits [journal name] because it addresses game outcome modeling, reproducibility, and the responsible use of live sports signals. The broader lesson is methodological: in sports forecasting, deciding which signals are not yet allowed to move the number can be as important as adding another model component.
```

PLOS ONE 版本要把 “fits journal” 改成 “meets publication criteria through rigorous methods, complete reporting, reproducible data/code, and transparent negative results”。

## 立即执行计划

### 2026-07-10 至 2026-07-20

- 冻结一版英文论文：从 `docs/prediction-model-methodology.md` 拆成正式 manuscript。
- 补 calibration/reliability diagram。
- 整理 reproducibility package：一键回测命令、数据下载说明、输出样例。
- 写 MathSport Asia 500-word abstract。

### 2026-07-21 至 2026-08-03

- 提交 MathSport Asia 2026 摘要。
- 提交 arXiv v1，若 endorsement 卡住，先解决账号/背书。
- 准备 JQAS 投稿包：manuscript、figures、cover letter、data/code availability statement。

### 2026-08-04 至 2026-10-01

- 根据 MathSport Asia 结果修改。
- 若想冲 SSAC27，准备 500-word abstract + GitHub/open-source evidence page。
- 若 JQAS 不投或被 desk reject，转投 JSA；若目标是快速正式发表，转 PLOS ONE。

## 决策点

需要作者最终决定三件事：

1. **是否接受开放获取费用风险**：PLOS ONE 约 US$2,477，JSA US$1,600，JQAS 当前 S2O 可能无作者费用但需提交前确认。
2. **是否公开完整代码仓库**：SSAC 强依赖开源；JQAS/PLOS/JSA 至少需要可复现代码和数据说明。
3. **是否把 PitchSignal 品牌写进论文**：会议/SSAC 可保留品牌演示；双匿名期刊稿应先匿名化为 “the forecasting system”。

## 来源

- JQAS official page: https://www.degruyterbrill.com/journal/key/jqas/html
- MathSport International official page: https://mathsportinternational.com/
- MathSport Asia 2026 Call for Papers PDF: https://mathsportinternational.com/MathSport%20Asia%202026%20CfP.pdf
- PLOS ONE Submission Guidelines: https://journals.plos.org/plosone/s/submission-guidelines
- PLOS ONE Criteria for Publication: https://journals.plos.org/plosone/s/criteria-for-publication
- PLOS Publication Fees: https://plos.org/fees/
- arXiv Submission Guidelines: https://info.arxiv.org/help/submit/index.html
- arXiv Category Taxonomy: https://arxiv.org/category_taxonomy
- Journal of Sports Analytics homepage: https://journals.sagepub.com/home/san
- Journal of Sports Analytics submission guidelines: https://journals.sagepub.com/author-instructions/SAN
- SSAC Research Paper Competition: https://www.sloansportsconference.com/research-paper-competition
