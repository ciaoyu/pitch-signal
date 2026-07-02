# P4-2 阵容身价信号调研与接入约束

日期：2026-07-03

## 结论

可用数据源优先级：

1. `dcaribou/transfermarkt-datasets`
   - 公开仓库，CC0-1.0 license。
   - README 标注数据每周刷新，包含 `players.market_value_in_eur`、`player_valuations`、`national_teams`，且 2026 World Cup 数据已开始更新。
   - 支持 DuckDB 文件或远程 CSV 查询，适合作为离线导入源。
2. 不直接爬 Transfermarkt 页面。
   - P4-2 只接收导出的本地 JSON/CSV/DB 派生数据，避免生产服务运行时触碰网页抓取和 ToS 风险。

当前实现选择：`scripts/import-market-values.js` 从 `national_teams.csv.gz` 生成本地 JSON `data/market-values.json`（或运行时用 `MARKET_VALUES_PATH` 指向其他文件），默认不开闸、不影响概率。

## 本地 JSON 合约

最小格式：

```json
{
  "source": "dcaribou/transfermarkt-datasets",
  "updatedAt": "2026-07-03",
  "teams": {
    "Brazil": {
      "squadValueEur": 1260000000
    },
    "Morocco": {
      "squadValueEur": 410000000
    }
  }
}
```

也支持每队 `players[].marketValueEur`，服务会求和。

## 导入命令

```bash
node scripts/import-market-values.js
```

该脚本只下载 `national_teams.csv.gz`，读取 `total_market_value`，并用 `data/id_map_center.json` 尽量映射到 `ratings.json` 使用的国家名。

## 上线闸门

- `MARKET_VALUE_SIGNAL_ENABLED=false` 为默认值。
- 未开闸时，即使文件存在，也不会进入 `PredictionService`。
- 开闸且数据存在时，信号作为 `components.marketValue` 进入预测融合。
- 正式上线前必须用 `BacktestRunner.compareBaseline()` 验收；不达标则保持关闭。

## 信号数学

- 阵容总身价为长尾分布，不能直接线性相减。
- 当前实现用 `log(homeValue / awayValue)` 转为 Elo 等价差，再映射成三结果概率。
- 置信度由数据覆盖、更新时间、身价差距共同决定，上限 0.78，避免压过 Elo/Poisson/市场赔率。
