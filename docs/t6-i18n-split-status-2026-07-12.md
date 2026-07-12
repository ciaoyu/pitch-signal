# T6 — i18n.js 词典外置拆分 状态/交接（2026-07-12）

> 派工单来源：`docs/remediation-dispatch-2026-07.md` → P2 / T6
> 分支：`t6/i18n-split`（基于 `main`，HEAD `901deb3`）
> 工作树：`pitch-signal-worktrees/active/t6-i18n-split`
> 纪律：未 push / 未触发部署；合并前 `npm test` 全绿（见下）。
> 采纳状态：**✅ 已采纳（2026-07-12）**。代码改动已 commit（`t6/i18n-split` 分支，不 push）。

## 结论

T6 已完成并被采纳，**零行为回归**。核心发现：`static/js/i18n.js` 里 1558 行硬编码的 `ZH_NAMES` 词典，经核对与已提交的 `data/player_name_zh.json`（1549 条）**逐条完全一致**（0 差集、0 值不一致、0 重复键）。也就是说"外部 JSON 数据源"**本来就存在**，只是长期有人把它的内容又手敲进 i18n.js（即派工单说的"每次派工增量堆积"）。因此本次改造不需要新建数据源，只需让 i18n.js **import** 现成的 JSON，去掉内联副本。

## 改动清单（4 文件 + 1 新测试）

| 文件 | 变化 | 说明 |
|------|------|------|
| `static/js/i18n.js` | 1711 → **161 行**（-1554） | 删除内联 `const ZH_NAMES = {...}` 字面量；顶部加 `import ZH_NAMES from '../../data/player_name_zh.json';`；查表/语言切换逻辑**一字未改**（含大小写归一化正则、模糊回退等）。 |
| `static/js/bundle.js` | 重建（esbuild） | `player_name_zh_default` 内联为 1549 条对象的完整拷贝，`Lionel Messi → 莱昂内尔·梅西` 等映射、大写回退键 `RODRI` 全部保留。esbuild 把中文写成 `\uXXXX` 转义（运行时等价，浏览器解码后正确）。 |
| `templates/index.html` | 1 行（bundle hash） | `build-js.js` 自动把 `?v=` 换成新 hash `3f67c7e1`。 |
| `scripts/test-runner.js` | +1 行 | 注册 `test-i18n-dictionary.js`。 |
| `scripts/test-i18n-dictionary.js` | **新增** | 防回归测试，13 断言（见下）。 |

## 验收对照（派工单原话 → 结果）

- **i18n.js ≤ ~300 行** → ✅ 实测 **161 行**。
- **中英切换在比赛页/球队页/球员页人工验证无回归** → ⚠️ **本环境无法闭环，列为此项未收口**：`preview_start` 起的开发服务器绑定的是**老 checkout 目录**，无法对准 `t6-i18n-split` 这个 worktree 做真实浏览器验证。数据层面已证明等价（见下）；**页面实际显示效果需在其它环境由人工点一遍确认**。

  > 环境限制说明（采纳时由采用方确认）：本环境的 `preview_start` 开发服务器绑定老 checkout 目录，执行者无法对 worktree 做浏览器冒烟。采用方判定"数据层已证明正确，采纳 T6"，但要求页面显示效果由采用方本人或换环境的人手动确认。

  **为何数据层可信、仍建议人工点一遍**：本次是纯数据搬迁，移除的字面量与 import 的 JSON 经程序核对逐字节等价（1549 条键、值、大写回退键全部一致），运行期 `ZH_NAMES` 指向的对象内容与改造前完全相同，行为由构造保证一致。人工点的价值在于确认"bundle 正确加载 + 展示层无 CSS/渲染耦合"，属防御性确认而非逻辑修复。
- **npm test 绿** → ✅ 全量 **94 套件 / 1101 断言 / 0 失败**（基线 93/1090，净增 1 套件 +11 断言来自新测试）。
- **新增防回归测试（词典文件完整性/键覆盖）** → ✅ `test-i18n-dictionary.js`，覆盖：
  1. JSON 可加载、条目 ≥1000（实测 1549）；
  2. 全部键/值均为非空字符串；
  3. 抽样映射幸存（Messi、Mbappé、大写键 `RODRI`）；
  4. **无重复键**（逐字扫描，1549 键 1549 唯一）；
  5. `i18n.js` **不再内联**词典字面量、确实 `import` 了 JSON、行数 ≤320、无 `"英文":"中文"` 内联行。

## 后续约定（防再次堆积）

- 新增球员/球队译名 → **只改 `data/player_name_zh.json`**，不要再往 `i18n.js` 贴字面量。i18n.js 现在只是查表壳。
- `data/player_name_zh.json` 已在 `data/`（repository-layout 白名单）下，无需改文档。本卡未改动任何文档（纯内部重构，无受影响文档）。

## 给总控的裁决点（已裁决）

1. ✅ **已采纳**：复用现成 `data/player_name_zh.json`，不新建 `data/i18n/zh.json`（零新增文件、零重复数据）。
2. ⚠️ **浏览器三点人工冒烟 = 未收口**：本环境 `preview_start` 绑定老 checkout，无法对准 worktree 验证；采用方判定数据层已证明正确、采纳 T6，但页面显示效果须在**其它环境**由人工点一遍确认（见上"验收对照"第 2 项）。

## 未做（明确边界）

- 未碰 `window.WorldCup.I18N`（UI 文案字典，在 `static/js/state.js`）——那是另一个东西，不在 T6 范围。
- 未碰 `lib/translate.js` 的 `SOURCE_I18N`（服务端翻译，独立）。
- 未 push / 未触发部署（纪律保持）。
- 已 commit 到 `t6/i18n-split` 分支（本环境内收口，等待采用方在其它环境人工确认页面后，再决定 merge/push 流程）。
