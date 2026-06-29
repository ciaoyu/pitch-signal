# PitchSignal 架构与代码审计 — 2026-06-28

## 总体评价

项目整体结构清晰、模块拆分合理。预测引擎（Elo + Poisson + 融合）设计扎实，有 walk-forward 回测验证基线。43 个测试全部通过，feature gate 安全机制到位。核心问题集中在**配置腐化、死代码堆积、DI 契约破损**三个方面。

## P0 — 无

没有发现阻塞级问题。

## P1 — 配置/模块腐化

### 1. 三个配置模块并存，仅一个生效

| 文件 | 状态 | 说明 |
|------|------|------|
| `lib/app.js` | ✅ 生产使用 | `server.js` 唯一调用的创建路径 |
| `lib/config.js` | ❌ 死代码 | 完整的配置对象，**没有任何文件 import 它** |
| `lib/container.js` | ❌ 死代码 | DI 容器包装 `app.js`，**也没有被 import** |

**根因**：重构过程中保留了旧实现，新实现上线后旧文件未被清理。`config.js` 包含重复的配置逻辑（port、ESPN URL、cache TTL 等），与 `app.js` 内容高度重叠但值不一致（如 `config.js` 写死了 `rateLimit.max=240`，而 `.env` 走 `RATE_LIMIT_MAX` 环境变量）。

**建议**：删除 `lib/config.js` 和 `lib/container.js`（如果确定未使用），或在 `container.js` 上加 `@deprecated` 注释并设删除期限。

### 2. `db/` 目录与 `data/` 目录数据重复且混乱

```
db/
├── groups.json           ← 0 bytes (空文件)
├── matches.json          ← 0 bytes (空文件)
├── player-id-mapping.json← 0 bytes (空文件)
├── rankings.json         ← 0 bytes (空文件)
├── ratings.json          ← 84KB (与 data/ratings.json 重复?)
├── teams.json            ← 0 bytes (空文件)
```

- 5 个文件是空占位文件，无任何作用
- `db/ratings.json` 是 `data/ratings.json` 的老副本，可能已过期
- 项目已迁移到 SQLite（`data/predictions.db`），`db/` 目录是**遗留产物**

**建议**：删除整个 `db/` 目录，或只保留 `ratings.json` 用于数据迁移参考后删除。

### 3. 多个 0-byte/空文件残留

| 文件 | 说明 |
|------|------|
| `data/pitchsignal.db` | 0 bytes — 从未被写入的空 SQLite 文件 |
| `scratch/matchup-patch.js` | 0 bytes — 空的临时文件 |

### 4. `scratch/` 目录应被 gitignore

25 个文件（116KB）包含开发临时脚本、截图、设计原型：
- `rewrite-app.py`、`build_static_html.js` — 一次性工具
- `test-espn.js`、`test_backtest_sort.js` 等 — `scripts/` 下已有正式测试
- `design-system.html`、`tactical-board-preview.html` — 原型文件
- `lessons_learned.md` — 应该归档到 `docs/` 或在 git 历史中

**建议**：将 `scratch/` 加入 `.gitignore`，或把有价值的文件移到 `docs/archive/`。

### 5. `.workbuddy/` 应被 gitignore

1.2MB 的截图和内存文件来自另一个 AI 工具，不应出现在仓库中。

## P2 — 技术债/不一致

### 6. DI 契约被多处违反

CLAUDE.md 声明：
> Modules don't require() across boundaries freely. lib/routes/index.js receives all deps via a single deps object.

但实际有 **7 处违反**：

```js
// lib/routes/bot.js:8 — 直接 cross-require db
dbInstance = require('../db').db;

// lib/routes/bot.js:12 — 直接 cross-require security
const { constantTimeEqual } = require('../security');

// lib/routes/entities.js:7 — 直接 cross-require teamResolver
const teamResolver = require('../team_resolver');

// lib/routes/prediction.js:5-6 — 直接 cross-require 核心逻辑
const PredictionEngine = require('../prediction');
const QualificationSimulator = require('../qualification');

// lib/routes/matchup.js:7-8 — 直接 cross-require
const lineupsSource = require('../lineups-source');
const playerNameZh = require('../player-name-zh');
```

这些模块通过 deps 对象实际上也拿到了依赖（`lib/routes/index.js` 统一注入了），但路由文件内部又直接 `require`，导致**两份引用不一定指向同一实例**。对于 singleton 模块（如 db）这恰好是同一个，但对于有状态的模块则可能不一致。

**建议**：要么统一走 DI（所有 deps 从 `deps` 参数获取），要么接受 CommonJS 的模块缓存特性并更新 CLAUDE.md 的描述。混合模式是最差选择。

### 7. 运行时 lazy require 增加故障盲区

```js
// lib/routes/entities.js:193 — 在请求处理函数内 require
const { espnAthlete, espnAthleteGamelog } = require('../../services/espn');

// lib/routes/matchup.js:531
const { FORM_COORDS } = require('../lineup-coords');

// lib/routes/odds.js:112
const BallDontLieAPI = require('../balldontlie');

// lib/services/PredictionService.js:172
const { buildFinalRoundContext } = require('../finalRoundContext');
```

好处是避免循环依赖、缩短冷启动。坏处是 require 失败不会在启动时暴露，而是在**首次命中路由时才发现**，问题发现窗口被后移。

**建议**：对于稳定的依赖（如 `espn`、`lineup-coords`），移回文件顶部。仅对 optional/条件依赖保留 lazy require。

### 8. console vs logger 混用

- `server.js` 和 `lib/app.js` 全部使用 `logger` 模块（结构化 JSON 日志）
- 但 **~65 个文件** 中存在直接 `console.log/warn/error` 调用：
  - `lib/roster_cache.js`: 11 处
  - `lib/backtest.js`: 17 处
  - `lib/routes/bot.js`: 8 处
  - `lib/services/PredictionService.js`: 7 处
  - `lib/routes/index.js`: 5 处（路由注册时的 log）

结果是生产日志混合了结构化 JSON 和裸文本，排查问题时要读两种格式。

**建议**：渐进替换 — 至少把 `lib/routes/` 和 `lib/services/` 下的 `console.log` 替换为 `logger`；`scripts/` 下保留 console 无所谓。

### 9. 硬编码 CDN 依赖

`middleware/cors.js` 的 CSP 策略硬编码了 Tailwind CDN：
```
script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com
```

这意味着：
- CDN 不可用 → 整个应用白屏
- Tailwind 是通过 CDN 在浏览器端编译的（`templates/index.html` 加载），不是预编译的 CSS

**建议**：生产部署使用已构建的 `tailwind-output.css`（`npm run build:css`），去掉 CDN 的 script-src。CSP 中移除 `cdn.tailwindcss.com`。

### 10. 存储文件数据库遗漏

`data/test-post-match-review.db`（2.8MB）存放在生产数据目录中，虽然是测试数据库但文件名不明显。建议移到 `data/test/` 子目录或在 `.gitignore` 中明确排除。

## P3 — 轻量改进

### 11. ARCHITECTURE.md 数据严重过期

- 写 `server.js` ~2390 行 → 实际 ~200 行
- 写 `static/js/app.js` 4297 行 → 实际 265 行（`bundle.js` 才是 6500 行）
- 写 `scripts/` 9 个测试脚本 → 实际 20 个
- 写 `路由 42+ API 端点` — 未验证

文档不准确的危害比没有文档更大。

### 12. 备份文件残留

```
static/bracket-data.backup.json
static/css/tailwind-input.css.bak
templates/index.html.bak
```

`.bak` 文件应被 `.gitignore` 覆盖或直接删除。

### 13. 无 TypeScript / JSDoc 类型

对于预测引擎这种数学密集型代码，缺乏类型约束增加了重构风险。`prediction.js` 的函数签名（如 `predict(params)`）接收松散对象，字段名拼写错误不会被捕获。

**建议**：至少在 `lib/elo.js`、`lib/poisson.js`、`lib/prediction.js` 上添加 JSDoc `@param` / `@returns` 类型注解，配合 VS Code 的 checkJs 使用。

### 14. Tailwind v3 版本陈旧

`package.json` 指定 `tailwindcss: ^3.4.19`（最新是 v4）。v3 → v4 的 CSS 配置语法完全不同，如果将来升级需较大改动。如果团队只有你一人短期不升问题不大。

## 正向亮点 ✅

1. **Feature Gate 机制扎实** — `assertFeatureGates()` 在启动时强制覆盖环境变量，公测阶段安全
2. **预测引擎数学严谨** — Elo + Poisson 双路融合，动态置信度加权，Sigmoid 贝叶斯融合（避开了硬阈值跳变），walk-forward 回测基线
3. **测试覆盖良好** — 20 个测试文件，43 个测试全部通过
4. **优雅启停** — `SIGTERM`/`SIGINT` 处理、DB 关闭、后台任务停止、10 秒超时强制退出
5. **SQL 安全** — `db.js` 有白名单表名校验 + 标识符正则校验 + 参数化绑定（`?`），无注入风险
6. **安全头齐全** — `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`、CSP Report-Only
7. **限流有上限保护** — `rate-limit.js` 的 `MAX_BUCKETS` 防止 Map 内存泄漏
8. **环境变量 .env parser 支持引号** — 细节到位
9. **CLAUDE.md 文档质量高** — 对 AI 协作者友好
10. **架构文档承认局限** — 明确标注 SQLite 不支持并发写入、"Never run more than one instance"

## 优先级行动清单

| 优先级 | 行动 | 预计工时 |
|--------|------|---------|
| P1 | 删除 `lib/config.js` + `lib/container.js`（确认未使用后） | 5 min |
| P1 | 删除 `db/` 目录（确认 ratings.json 无引用后） | 5 min |
| P1 | `.gitignore` 加入 `scratch/` 和 `.workbuddy/` | 2 min |
| P2 | 统一 DI：路由文件不直接 require 跨域模块 | 30 min |
| P2 | Top-level require 替代 lazy require（非 optional 的） | 15 min |
| P2 | 替换 `lib/routes/` `lib/services/` 下 console→logger | 30 min |
| P2 | 生产部署切到预编译 CSS，移除 CDN CSP | 确认 build 流程后修改 |
| P3 | 更新 ARCHITECTURE.md 数据 | 15 min |
| P3 | 删除 .bak 文件 | 1 min |
| P3 | 为核心引擎加 JSDoc 类型 | 1-2 h |
| P3 | 清理 `scratch/` 中有价值文件→`docs/archive/` | 10 min |

**总预计工时**：P1-P2 约 2h，P3 额外 2-3h。
