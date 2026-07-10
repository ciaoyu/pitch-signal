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
