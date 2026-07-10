# Owner E — 环境 / 旅行 / 休息 研究：数据字典与来源/许可

> 分支：`codex/environment-research`（基线 `78da1b5`，不修改生产概率）
> 验收要求：明确变量可用起始年份、覆盖率与缺失机制；提交数据字典、来源/许可、泄漏审计。

## 1. 仓库内可用数据源（第一方 / 已授权）

| 源文件 | 内容 | 环境相关字段 | 许可 |
|--------|------|--------------|------|
| `data/venues.json` | 2026 世界杯 16 个场馆 | `altitude`(m)、`grass`(人工/天然)、`timezone`、`coordinates`、`country`、`city` | 仓库内（项目数据） |
| `data/history/worldcup_*.json` | 1930–2022 共 22 届世界杯赛果 | `date,home,away,homeScore,awayScore,stage,venue`；**无**环境暴露字段 | `openfootball/worldcup.json` (CC0) |
| `data/team_meta.json` | 球队排名 / 市值 / 雷达 | `worldRanking,fifaPoints,marketValue`；**无** baseCamp 海拔 / 时区 | 仓库内（项目数据） |
| `data/elo-seed.json` | 各届世界杯开赛前 Elo 快照 | 球队实力先验 | 仓库内（martj42/international_results 口径，CC0/公开） |
| `data/match_snapshot_schedule.json` | 2026 赛程（含 stage、matchId） | 赛程 → 可推算 `Rest`（间隔日）、`ET`（上一场） | 仓库内 |

## 2. 外部只读输入（D 的 artifact / 研究数据，仅读，不得带入研究代码）

| 数据源 | 内容 | 许可 | 使用方式 |
|--------|------|------|----------|
| `martj42/international_results`（49,487 场国际比赛） | 更大的国际比赛池，用于估计环境效应 | GitHub 公开（CC0 / 公开数据集） | **只读输入**；世界杯保持 held-out；通过 `ENV_RESEARCH_POOL_DIR` 指向本地副本 |
| D 的 artifact（`codex/research-artifacts-v2` 等） | 回测 / 配对 delta 等 | 由 D 声明 | **只读**消费契约；E 不得修改 D 文件 |

> 治理红线：E 工作区**不整体带入 D 的研究代码或其他负责人分支**。只引用其 artifact 作为只读输入。

## 2b. 49k 池只读适配器（数据采集阶段新增 · 真实产出）

- **源**：`martj42/international_results` 的 `results.csv`（**CC0**），本地只读副本位于**仓库外**（`ENV_RESEARCH_POOL_DIR`），**绝不提交本分支**。
- **已采集真实副本**：SHA-256 `5ddddc5ab73edb08bf65829d48f2a13b54b873b6abd29eea879086c12f977687`，年份 **1872–2026**，共 **49,505** 行（列：`date,home_team,away_team,home_score,away_score,tournament,city,country,neutral`）。
- **适配器**（`scripts/research-environment-pool-lib.js` + `research-environment-pool-adapter.js`）解析并 **join 可推导的环境候选特征**（绝不伪造）：
  - `rest_days_home` / `rest_days_away`：每队上一场到本场间隔天数（按日期排序、as-of 严格只用更早比赛）。
  - `neutral`：来自数据列。
  - `tournament_type`：`world_cup` / `qualifier` / `continental` / `friendly` / `other`。
  - `confederation`（每队）：as-of 取该队**最早出现的洲际特定赛事**推断（UEFA/CONMEBOL/CAF/AFC/CONCACAF/OFC；泛称 `FIFA World Cup qualification` 无洲联词，不推断）。
  - `cross_confederation`：双方洲联已知且不同（旅行 / 气候压力代理，对双方对称）。
  - `altitude_2026`：仅 2026 世界杯，由仓库内 `data/venues.json` join（别名 `Dallas→Arlington`、`Guadalupe→Monterrey`、`Zapopan→Guadalajara`），**100% join**。
- **诚实不可得**（标注 0% 覆盖，不伪造）：历史（非 2026）比赛场馆海拔（无 city→altitude 表）、天气 / WBGT（历史未记录）。
- **WC held-out**：精确 `"FIFA World Cup"` 决赛 **1,064** 场（1930–2026；其中 2026 共 100 场）排除出估计池，写入 `wc-heldout-manifest.json` 供后续 OOS；资格赛照常进入估计池。

## 3. 变量定义（目标模型，见 `environment-dag.md` §1）

| 变量 | 定义 | 单位 | 对称进入方式 |
|------|------|------|--------------|
| `alt` | 场馆海拔 | m | `β_alt·(A_i − A_opp)`，A=本队近期比赛平均海拔 |
| `wbgt` | 湿球黑球温度 | °C | `β_heat·(H_i − H_opp)` |
| `turf` | 草坪：人工=1 / 天然=0 | 0/1 | `β_turf·(S_i − S_opp)` |
| `travel` | 基地→场馆累计旅行距离 | km | `β_travel·(T_i − T_opp)` |
| `tz` | 基地时区→场馆时区偏移 | h | `β_tz·(Z_i − Z_opp)` |
| `rest` | 上一场到本场间隔天数 | d | `β_rest·(R_i − R_opp)` |
| `et` | 上一场加时分钟 | min | `β_et·(ET_i − ET_opp)` |

## 4. 缺失机制（必须显式说明）

- **缺失类型**：结构缺失（MCAR/非随机）——1930–2022 历史届**完全没有**环境暴露字段；2026 仅场馆级海拔/草坪/时区可得，无 WBGT/旅行/休息/加时/球员分钟。
- **缺失即缺失**：不创建中性三元组填充；在展示与模型中对缺失变量标记 `missing_reason`（方法学笔记 §7.5）。
- **早期退化**：1930–1960 退化为基础模型（无环境协变量），不得用国家平均海拔伪装成同等精度。
- **非随机缺失**：仅当 OOS 证明缺失指示本身含信息时才可作为 missingness 特征（融合层约束，Owner A learned core 阶段处理，不在 E 阶段入模）。

## 5. 覆盖率小结（真实产出，详见 `coverage-report.json` / `pool-coverage.json`）

**仓库内**：
- 世界杯历史赛果：**22 届 / 1930–2022 共 964 场全可得**，但环境暴露覆盖率 **0%**（需外部池补全）。
- 2026 场馆级环境：**100%**（海拔/草坪/时区），但缺 WBGT/旅行/休息/加时/球员级。

**外部 49k 只读池（真实采集，SHA-256 `5ddddc5a…`）**——非 WC 估计池 48,441 场，WC held-out 1,064 场：

| 特征类别 | 字段 | 真实覆盖率（非 WC 池） |
|----------|------|------------------------|
| 休息 (rest) | `rest_days_home` / `rest_days_away` | **99.7% / 99.6%**（每队首场前为 null） |
| 旅行 (travel) | `neutral` | **100%** |
| 旅行 (travel) | `cross_confederation` 可解析 | **97.3%**（双方洲联已知且不同=跨洲压力代理） |
| 旅行 (travel) | 洲联解析 `confed_home/away` | **97.9% / 97.8%** |
| 场馆 (venue) | `altitude_2026`（2026 WC join） | **100%**（16 城别名全部命中） |
| 场馆 (venue) | `altitude` 历史（非 2026） | **0%**（无 city→altitude 表，诚实缺失） |
| 天气 (weather) | `wbgt` | **0%**（历史未记录，诚实缺失） |
| 赛事类型 | `tournament_type` | **100%** |

> 边界：E **不**只拿到 49k 赛果就结束——已做环境字段 join（休息/旅行/2026 海拔）；历史海拔与天气缺失属结构缺失，缺失≠中性，退化为基础模型。下一步：基于 WC held-out 跑 walk-forward OOS（Ridge / 层级贝叶斯 + VIF + 后验），通过增益才允许入模。

> 数据不足**也算完成**（reviewer 验收口径）：必须给出可展示事实与"不能入模"的边界。

## 6. OOS 系数估计结果（真实，2026-07-10 实跑 · CC0 池 SHA-256 `5ddddc5a…`）

**方法**（详见 `scripts/research-environment-oos.js` → `oos-report.json` / `oos-joined-contract.json`）：
- **输入契约**：脚本实时从只读池重建 joined dataset（真实、无伪造），列出于 `oos-joined-contract.json`。
- **Elo 控制（as-of，仅非 WC 比赛更新）**：保证 env 系数估计不泄漏任何世界杯结果；WC 仅以开赛前（非 WC 派生）Elo 快照评分。
- **对称进入**：`rest_diff = rest_home − rest_away`；`cross` / `cross_unknown` 对双方对称。进球模型 Poisson + Ridge（IRLS + 步长折半，标准化特征后回归、系数反变换）。
- **基准对比**：`base` = Elo+Poisson（无 env 系数）；`env` = Elo+Poisson + rest_diff + cross + cross_unknown。指标：LogLoss / Brier / ECE（3 类赛果）；WC held-out（1930–2022 已发生评估；2026 已发生作前瞻、未完赛排除）；系数 bootstrap + VIF + walk-forward + cluster bootstrap Δ。
  - **口径澄清**：`base` 是**研究用 Elo+Poisson 代理**（同 as-of Elo 控制、env 系数强制为 0），**并非生产 Owner A v4 管线**（后者有更大特征集与独立校准）。本 OOS 只对比研究基准，**不衡量与线上生产模型的 delta**。

**估计与结果**（非 WC 估计 48,139 场；WC held-out 1,064 场，其中 1930–2022 已发生 964 场）：

| 变量 | 系数 | bootstrap 95% CI | 符号稳定 | 入模候选 |
|------|------|------------------|----------|----------|
| `rest_diff` | −3e-5 | [−6e-5, 0] | 是 | 否（量级可忽略） |
| `cross`（跨洲） | −0.050 | [−0.065, −0.032] | 是 | 否（方向合理但增量增益不足） |
| `cross_unknown` | +0.39 | [+0.34, +0.44] | 是 | **否（联盟解析缺失产物，非环境暴露）** |

**OOS 增益判定**：
- WC 1930–2022：`ΔLogLoss(env−base) = −0.00089`（env 略优但极小）。
- cluster bootstrap ΔLogLoss 95% CI = **[−0.00197, +0.00012]（seed 固定、按世界杯届次有放回重采样，可复现）含 0** → 无稳定增益。
- walk-forward 6 折 ΔLogLoss 在 0 附近振荡（−0.0007 ~ +0.0028），无一致改善。
- VIF = 1.00（eloDiff 1.002、restDiff 1.002、cross 1.005、crossUnknown 1.005；辅助回归**含截距** → VIF≥1 恒成立）：无共线性问题。
- **cross / cross_unknown 分离重跑**：单独去掉 `cross_unknown`（缺失机制标志）再拟合，`cross` 系数仍 ≈ −0.050，证明跨洲旅行代理并非联盟解析缺失的产物，二者物理含义独立。

**裁决（治理口径）**：符号稳定 ≠ 真实增益。OOS 无稳定增益前不得进入生产概率 → `enterModel = false`，env 系数保持 shadow / `usedInModel:false`。

**未估计**（按指令，训练期覆盖不足）：`altitude_2026`（历史训练 0%，仅 2026 held-out 有 → 拟合即泄漏 held-out）、`wbgt/weather`（0%）、`neutral`（100% 无有效变异）。均 `usedInModel:false`。

**合成数据纪律**：所有单元测试（`test-research-environment-pool-lib.js`、`test-research-environment-oos-lib.js`）仅用合成数据验证数学/逻辑，**不写入任何 research artifact**。

**E v2 统计实现修正（2026-07-11）**：相对 v1，本轮修正了统计实现缺陷，但仍保持相同方向性结论与生产裁决：
1. **cluster bootstrap 现按世界杯届次有放回重采样**：v1 用 `Math.random()` 按球队独立抽样、未固定 seed，不可复现；v2 以届次（year）为 cluster、有放回重采样、`seed=20260711`，CI 可复现（重跑一致）。
2. **系数 bootstrap 也固定 seed**：使用同一 `mulberry32` 种子 RNG。
3. **VIF 修复**：辅助回归原缺截距导致 R² 可为负、VIF<1（v1：cross=0.840、cross_unknown=0.975，违反标准 VIF≥1）；v2 辅助回归含截距 → VIF≥1 恒成立，并加 `VIF>=1` 回归断言（单元测试捕获该 bug）。
4. **cross 物理旅行代理与 cross_unknown 缺失机制分离重跑**（见上）。
5. **基准口径澄清**：明确 `base` 是研究 Elo+Poisson 代理，非生产 A v4。
> 统计实现已定稿且可复现（固定 seed、届次有放回重采样、VIF≥1 断言、cross/cross_unknown 分离重跑、固定 seed 重跑一致性断言）。本版可作为正式方向性证据。生产裁决不变：`enterModel=false`、`usedInModel:false`；环境信号继续 shadow，绝不进入公开概率。
