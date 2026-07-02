# P4-3 洲际强度修正接入约束

## 结论

洲际强度修正已接成独立 probability head，但保持默认关闭：

- 生产闸门：`CONTINENTAL_STRENGTH_SIGNAL_ENABLED=false`
- 回测候选：`compareBaseline({ continentalStrengthSignal: { enabled: true } })`
- 默认权重：`continentalStrength=0.04`

## 信号形态

参考 hjjbh1314/worldcup-predictor 的跨洲 Elo 头部修正值：

| Confederation | Elo head |
| --- | ---: |
| UEFA | +117 |
| CONMEBOL | +104 |
| AFC | +18 |
| CONCACAF | -27 |
| CAF | -40 |
| OFC | -171 |

实现约束：

- 同洲比赛不注入信号。
- 只作为独立 probability head 注入，不直接改 Elo rating，不作为普通 ML 特征。
- 缺球队洲际映射时返回 `null`，不影响基线。
- 默认权重保持弱信号，避免压过 Elo/Poisson/市场赔率。

## compareBaseline 结果

2026-07-03 在 964 场历史世界杯样本上验收：

```json
{
  "accepted": true,
  "baseline": {
    "brier": 0.5708,
    "accuracy": 0.5788
  },
  "proposed": {
    "brier": 0.5707,
    "accuracy": 0.5799
  }
}
```

判读：通过闸门，但 Brier/accuracy 的 95% CI 均重叠，不能宣称显著提升。上线前仍需更多跨洲样本或独立校准层复验。
