# Owner H — 教练历史与教练增值研究：DAG 与因果/共线结构

> Worktree：`pitch-signal-worktrees/coach-effect-research`（分支 `codex/coach-effect-research`，基线 `78da1b5`）
> 范围：**只做数据、DAG、覆盖率、OOS 系数；不修改 `lib/prediction.js`、生产概率或公开 API。**
> F/G 结果只读引用；当前生产教练信号保持移除（展示隔离）。

## 1. 研究问题

在国家队层面，教练是否对「相对预期进球 / xG 残差」有可识别的增值效应？
估计量 = 控制球队实力、球员质量、对手、赛事、场地、休息后，某教练任期内球队的 **每场 xG 差（team_xg_diff）残差**。

```
residual_{i,t} = xg_diff_{i,t} - E[xg_diff | Elo_i, Elo_opp, playerQuality_i, playerQuality_opp,
                                          competition_i, venue_i, rest_i, opponent_i, date_i]
coach_effect_c = mean_or_shrunk_posterior( residual over matches under coach c )
```

## 2. DAG（因果图）

```
                       (Confounder block — 必须控制)
Elo_home ──┐
Elo_away ──┤
playerQuality_home ──┤
playerQuality_away ──┤
opponent_strength ──┤
competition_type ──┤
venue/home_factor ─┤
rest_days ──────────┼──► xg_diff ──► match_outcome
                   │        ▲
                   │        │
coach_tenure_c ────┼────────┘ (target causal path: coach -> residual)
   (start,end)     │
        │          │
        └── selection_bias ◄── team_form / board_pressure (unobserved)
                   │
tactics_style ─────┤ (observed behavior: formation/press/progressions/subs)
        │          │
        └── mediator between coach and xg_diff (NOT a confounder to control away)
```

### 2.1 边说明

| 边 | 类型 | 处理 |
|----|------|------|
| Elo / playerQuality / opponent / competition / venue / rest → xg_diff | 混杂（confounder） | **必须控制**（作为设计矩阵基准项） |
| coach_tenure → residual(xg_diff) | 目标因果边 | 估计对象 |
| team_form / board_pressure → coach_tenure | 选择偏差（未观测） | 见 §3 共线性处理 |
| tactics_style → xg_diff | **中介**（mediator） | 不把战术风格当混杂控制掉；战术风格只作**可观测行为特征**（阵型/压迫/推进/换人），不来自中文形容词 |
| coach_tenure ↔ playerQuality | 双向 | 换帅常伴随阵容换血 → §3 共线 |

### 2.2 关键不变量（与治理一致）

- **战术风格不来自形容词**：`data/coaches.json` 的 `style`（如"控球+高位压迫"）、`adjustment`（如"积极，敢于使用年轻球员"）、`flexibility` 是中文关键词，**禁止**进入概率或任何研究特征。只接受阵型、压迫强度、推进次数、换人时机等可观测衍生量。
- 教练效应只能作为**增值残差**，不能是任期线性加分（旧生产信号已移除，不恢复）。

## 3. 共线性与选择偏差处理（验收重点）

### 3.1 与球员更替的共线性
换帅与阵容换血高度同步（新帅带来新核心、弃用老将）。若同时放 `coach_effect` 与 `playerQuality`，两者方差会被互相吸收，短任期教练系数会被球员质量"吃掉"或"放大"。
- 处理：在残差模型里**先扣除球员质量基准**（playerQuality 作为固定/随机效应项），coach_effect 估计的是"在给定球员质量下"的额外残差；报告 coach_effect 与 playerQuality 的相关与 VIF。

### 3.2 换帅选择偏差（endogeneity）
弱队/低谷期更可能换帅；新帅接手时球队可能处于"反弹周期"或"结构性低谷"，并非教练能力。
- 处理：
  - 在任期层面做**分层收缩**（hierarchical shrinkage，§4），短任期向总体均值收缩，避免把"接手即反弹"误判为"神帅"。
  - 加入**任期起始状态控制**：用上任前 N 场 xg_diff 滑动均值作为协变量，剥离"接手时球队本就在变好"的成分。
  - 在 OOS 中检验：仅用"非换帅触发型低谷"的子样本做稳健性。

### 3.3 多重共线性诊断
- 对所有协变量（Elo差、playerQuality差、competition dummies、venue、rest、coach_effect）报告 VIF；VIF>5 的变量进入强正则化（Ridge / Bayesian prior）。
- 正则化强度按 §4 分层先验设定，避免短任期过拟合。

## 4. 分层收缩（hierarchical shrinkage）

```
coach_effect_c ~ N(mu_global, tau^2)            # 教练层随机效应
mu_global ~ N(0, sigma_mu^2)                    # 总体均值（先验近 0）
tau^2 ~ HalfCauchy(0, sigma_tau)               # 教练间异质
residual_{c,m} ~ N(coach_effect_c, sigma_e^2)  # 场次级
```

- 短任期教练（match 数 < K，如 < 10 场）的后验被强收缩到 `mu_global`，后验区间宽 → 明确标注"证据不足"。
- 后验分布（采样/MCMC 或经验 Bayes）必须随 OOS 报告一起交付（验收要求：后验/采样分布）。

## 5. 进入模型的门槛（governance）

- 仅当滚动 OOS 在 LogLoss / Brier / 校准上显示**稳定正增量**（且跨届稳定、短任期区间不退化）时，coach_effect 才允许从 `usedInModel:false` 转为候选进入；否则**保持 `usedInModel:false`**，仅作展示/ shadow。
- 当前生产教练信号（中文关键词）**保持移除**，本研究的任何中间产物不写回 `lib/prediction.js`。

## 6. 文件边界

| 允许 | 禁止 |
|------|------|
| `docs/research/coach-*`、`data/research/coach/*`、`scripts/research-coach-*` | 修改 `lib/prediction.js` / 公开 API |
| 读 `data/coaches.json`（仅作展示级现状描述） | 把 `coaches.json` 的 style/adjustment 当特征 |
| F/G artifact 只读引用 | 合入 F/G 分支 |
