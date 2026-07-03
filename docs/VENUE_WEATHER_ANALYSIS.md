# 场地 & 天气分析系统

## 一、系统概述

场地和天气分析系统为世界杯比赛提供环境因素的量化分析，帮助用户理解场地条件对比赛的潜在影响。

### 核心功能

1. **场馆信息展示** - 16座世界杯场馆的详细信息
2. **实时天气数据** - 比赛日的天气状况（温度、湿度、风速、降水）
3. **场地影响分析** - 草皮类型 × 天气条件 → 比赛风格影响
4. **历史数据对比** - 各场馆的历史比赛数据统计

---

## 二、场馆数据结构

### 2.1 场馆基础信息

```json
{
  "id": "sofi",
  "name": "SoFi Stadium",
  "city": "洛杉矶",
  "country": "美国",
  "capacity": 70240,
  "altitude": 71,           // 米
  "grass": "天然草+人工纤维混合",
  "timezone": "PST",
  "coordinates": {
    "lat": 33.9534,
    "lng": -118.3391
  },
  "roof": "closed",         // closed/open/retractable
  "surfaceAge": "2020",     // 草皮更换年份
  "dimensions": "105m x 68m" // 球场尺寸
}
```

### 2.2 16座世界杯场馆

| 场馆 | 城市 | 容量 | 海拔 | 草皮 | 屋顶 |
|------|------|------|------|------|------|
| SoFi Stadium | 洛杉矶 | 70,240 | 71m | 混合草 | 封闭 |
| 阿兹特克球场 | 墨西哥城 | 87,000 | 2,240m | 天然草 | 开放 |
| MetLife Stadium | 纽约 | 82,500 | 3m | 天然草 | 开放 |
| BC Place | 温哥华 | 54,500 | 0m | 人工草 | 封闭 |
| AT&T Stadium | 达拉斯 | 80,000 | 168m | 人工草 | 可伸缩 |
| Mercedes-Benz Stadium | 亚特兰大 | 71,000 | 320m | 人工草 | 封闭 |
| NRG Stadium | 休斯顿 | 72,220 | 15m | 人工草 | 封闭 |
| Gillette Stadium | 波士顿 | 65,878 | 30m | 天然草 | 开放 |
| Levi's Stadium | 旧金山 | 68,500 | 12m | 天然草 | 开放 |
| Hard Rock Stadium | 迈阿密 | 65,326 | 2m | 天然草 | 开放 |
| Lincoln Financial Field | 费城 | 69,176 | 12m | 天然草 | 开放 |
| Lumen Field | 西雅图 | 68,740 | 0m | 人工草 | 开放 |
| Arrowhead Stadium | 堪萨斯城 | 76,416 | 277m | 天然草 | 开放 |
| BMO Stadium | 洛杉矶 | 22,000 | 71m | 天然草 | 开放 |
| BBVA Stadium | 蒙特雷 | 53,500 | 520m | 天然草 | 开放 |
| 阿克伦球场 | 瓜达拉哈拉 | 49,850 | 1,566m | 天然草 | 开放 |

---

## 三、天气数据集成

### 3.1 数据来源

**OpenWeatherMap API (Free Tier)**
- 端点: `https://api.openweathermap.org/data/2.5/weather`
- 参数: `lat`, `lon`, `appid`, `units=metric`
- 免费额度: 60 calls/min, 1,000,000 calls/month

### 3.2 天气数据结构

```json
{
  "matchId": "401581705",
  "venueId": "sofi",
  "timestamp": "2026-06-15T18:00:00Z",
  "weather": {
    "temp": 28.5,           // 温度 (°C)
    "feelsLike": 30.2,      // 体感温度
    "humidity": 65,         // 湿度 (%)
    "windSpeed": 12.3,      // 风速 (km/h)
    "windDirection": 180,   // 风向 (度)
    "precipitation": 0,     // 降水量 (mm)
    "precipProb": 0.1,      // 降水概率
    "cloudCover": 30,       // 云覆盖 (%)
    "visibility": 10000,    // 能见度 (m)
    "uvIndex": 6,           // UV 指数
    "condition": "partly_cloudy",
    "description": "局部多云"
  },
  "forecast": {
    "hourly": [...],        // 未来24小时预报
    "daily": [...]          // 未来7天预报
  }
}
```

### 3.3 获取天气的流程

```
1. 从比赛数据获取 venueId
2. 从场馆数据获取 coordinates (lat, lng)
3. 调用 OpenWeatherMap API
4. 缓存结果 (TTL: 1小时)
5. 返回天气数据
```

---

## 四、场地影响分析

### 4.1 影响因素矩阵

| 因素 | 影响维度 | 权重 |
|------|----------|------|
| 草皮类型 | 传球/控球/射门/伤病风险 | 35% |
| 海拔高度 | 体能/球速/长传 | 20% |
| 温度 | 体能/节奏/补水暂停 | 20% |
| 湿度 | 体能/技术发挥 | 15% |
| 风速 | 长传/角球/任意球 | 10% |

### 4.2 草皮类型影响

#### 天然草
- **传球**: 球速适中，弹跳正常
- **控球**: 停球舒适，技术发挥好
- **射门**: 球速稳定，弹道可预测
- **伤病**: 风险较低
- **适合风格**: 控球型、技术型球队

#### 人工草
- **传球**: 球速快，弹跳低
- **控球**: 停球需适应，球速快
- **射门**: 球速快，弹道低平
- **伤病**: 风险较高（关节压力）
- **适合风格**: 快速反击、直接打法

#### 混合草
- **特点**: 兼具两者优点
- **传球**: 球速适中偏快
- **控球**: 停球舒适
- **射门**: 球速稳定
- **伤病**: 风险较低

### 4.3 海拔高度影响

| 海拔范围 | 影响程度 | 具体影响 |
|----------|----------|----------|
| 0-500m | 低 | 正常比赛条件 |
| 500-1500m | 中 | 球速略快，体能消耗增加5-10% |
| 1500-2500m | 高 | 球速明显加快，体能消耗增加15-25% |
| 2500m+ | 极高 | 球速快，体能消耗增加30%+ |

**示例**: 墨西哥城 (2,240m)
- 球速增加约8%
- 长传距离增加10-15%
- 球员体能消耗增加20%
- 适合：体能好的球队、快速反击

### 4.4 天气条件影响

#### 温度影响
| 温度范围 | 影响 | 建议 |
|----------|------|------|
| <10°C | 肌肉僵硬，伤病风险↑ | 充分热身 |
| 10-25°C | 最佳比赛温度 | 正常发挥 |
| 25-30°C | 体能消耗增加 | 补水暂停 |
| >30°C | 体能严重消耗 | 轮换策略 |

#### 湿度影响
| 湿度范围 | 影响 |
|----------|------|
| <40% | 干燥，技术发挥好 |
| 40-70% | 适宜 |
| >70% | 闷热，体能消耗大 |

#### 风速影响
| 风速 | 影响 |
|------|------|
| <10km/h | 无明显影响 |
| 10-20km/h | 长传/角球受影响 |
| >20km/h | 显著影响传球/射门 |

---

## 五、影响分析算法

### 5.1 综合影响评分

```javascript
function calculateVenueImpact(venue, weather) {
  let impact = {
    overall: 0,        // -100 到 +100
    attack: 0,         // 进攻影响
    defense: 0,        // 防守影响
    possession: 0,     // 控球影响
    physical: 0,       // 体能影响
    details: []
  };
  
  // 1. 草皮类型影响 (35%)
  const grassImpact = analyzeGrassImpact(venue.grass);
  impact.attack += grassImpact.attack * 0.35;
  impact.defense += grassImpact.defense * 0.35;
  impact.possession += grassImpact.possession * 0.35;
  
  // 2. 海拔影响 (20%)
  const altitudeImpact = analyzeAltitudeImpact(venue.altitude);
  impact.physical += altitudeImpact.physical * 0.20;
  impact.attack += altitudeImpact.attack * 0.20;
  
  // 3. 温度影响 (20%)
  const tempImpact = analyzeTemperatureImpact(weather.temp);
  impact.physical += tempImpact.physical * 0.20;
  
  // 4. 湿度影响 (15%)
  const humidityImpact = analyzeHumidityImpact(weather.humidity);
  impact.physical += humidityImpact.physical * 0.15;
  
  // 5. 风速影响 (10%)
  const windImpact = analyzeWindImpact(weather.windSpeed);
  impact.attack += windImpact.attack * 0.10;
  
  // 计算综合分
  impact.overall = (impact.attack + impact.defense + impact.possession + impact.physical) / 4;
  
  return impact;
}
```

### 5.2 风格适配分析

```javascript
function analyzeStyleFit(venue, weather, teamStyle) {
  const fits = {
    '控球型': {
      grass: '天然草 > 混合草 > 人工草',
      altitude: '低海拔优先',
      temp: '10-25°C 最佳',
      humidity: '<70% 最佳'
    },
    '快速反击': {
      grass: '人工草 > 混合草 > 天然草',
      altitude: '高海拔有利',
      temp: '任何温度',
      humidity: '影响小'
    },
    '高压逼抢': {
      grass: '任何草皮',
      altitude: '低海拔优先',
      temp: '<25°C 优先',
      humidity: '<60% 最佳'
    }
  };
  
  return fits[teamStyle] || fits['均衡型'];
}
```

---

## 六、前端展示设计

### 6.1 场地天气卡片

```
┌─────────────────────────────────────────┐
│  🏟️ 场地 & 天气                         │
│                                         │
│  SoFi Stadium · 洛杉矶 · 美国           │
│  容量: 70,240 · 海拔: 71m               │
│  草皮: 天然草+人工纤维混合               │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ☀️ 天气预报                     │    │
│  │                                 │    │
│  │  🌡️ 28°C (体感 30°C)            │    │
│  │  💧 湿度: 65%                   │    │
│  │  💨 风速: 12 km/h               │    │
│  │  ☁️ 局部多云                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📊 场地影响分析                 │    │
│  │                                 │    │
│  │  进攻: ↗️ +12% (球速快)          │    │
│  │  控球: ↘️ -8% (弹跳低)           │    │
│  │  体能: ↘️ -15% (闷热)            │    │
│  │                                 │    │
│  │  🎯 适合: 快速反击型球队         │    │
│  │  ⚠️ 注意: 补水暂停可能增加       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  🔵 美国: 控球型 → ⚠️ 需适应           │
│  🔴 巴拉圭: 反击型 → ✅ 有利           │
└─────────────────────────────────────────┘
```

### 6.2 比赛详情中的位置

场地天气信息应放在比赛详情 Modal 的 **🏟️ 场地 & 天气** Tab 中，位于对位阵型图下方。

---

## 七、API 端点设计

### 7.1 获取场地天气

```
GET /api/match/:id/venue-weather
```

**响应:**
```json
{
  "venue": {
    "id": "sofi",
    "name": "SoFi Stadium",
    "city": "洛杉矶",
    "country": "美国",
    "capacity": 70240,
    "altitude": 71,
    "grass": "天然草+人工纤维混合"
  },
  "weather": {
    "temp": 28.5,
    "humidity": 65,
    "windSpeed": 12.3,
    "condition": "partly_cloudy"
  },
  "impact": {
    "overall": -5,
    "attack": 12,
    "defense": -3,
    "possession": -8,
    "physical": -15,
    "details": [
      "球速略快，适合快速反击",
      "湿度较高，体能消耗增加",
      "建议增加补水暂停"
    ]
  },
  "styleFit": {
    "home": {
      "style": "控球型",
      "fit": "⚠️ 需适应",
      "reason": "人工草皮不利于控球"
    },
    "away": {
      "style": "快速反击",
      "fit": "✅ 有利",
      "reason": "球速快利于反击"
    }
  }
}
```

### 7.2 获取场馆历史数据

```
GET /api/venue/:id/history
```

**响应:**
```json
{
  "venueId": "sofi",
  "totalMatches": 12,
  "avgGoals": 2.8,
  "avgCorners": 10.2,
  "homeWinRate": 0.45,
  "drawRate": 0.25,
  "awayWinRate": 0.30,
  "recentMatches": [...]
}
```

---

## 八、实现计划

### Phase 1: 基础数据 (1天)
- [ ] 完善场馆静态数据
- [ ] 实现天气 API 集成
- [ ] 添加缓存机制

### Phase 2: 影响分析 (1天)
- [ ] 实现草皮影响算法
- [ ] 实现海拔影响算法
- [ ] 实现天气影响算法
- [ ] 综合评分计算

### Phase 3: 前端展示 (1天)
- [ ] 设计场地天气卡片
- [ ] 实现影响分析图表
- [ ] 集成到比赛详情

### Phase 4: 优化完善 (0.5天)
- [ ] 添加历史数据
- [ ] 优化缓存策略
- [ ] 测试和调试

---

## 九、技术要点

### 9.1 缓存策略

- **场馆数据**: 永久缓存（静态数据）
- **天气数据**: 1小时 TTL（每小时更新）
- **影响分析**: 计算结果缓存，与天气数据同步过期

### 9.2 错误处理

- 天气 API 失败: 返回场馆静态数据 + 默认天气
- 场馆数据缺失: 返回通用场馆数据
- 计算异常: 返回中性影响评分

### 9.3 性能优化

- 并行获取场馆和天气数据
- 预计算常见组合的影响
- 使用 CDN 缓存场馆图片

---

## 十、数据来源

| 数据 | 来源 | 更新频率 |
|------|------|----------|
| 场馆信息 | 静态录入 | 不更新 |
| 天气数据 | OpenWeatherMap | 每小时 |
| 历史比赛 | ESPN API | 每日 |
| 草皮状态 | 官方报道 | 赛前 |

---

## 十一、已知限制

1. **天气预报准确性**: 比赛日天气可能与预报有偏差
2. **草皮状态**: 无法获取实时草皮状况
3. **室内场馆**: 封闭场馆的天气影响较小
4. **历史数据**: 部分场馆比赛数据不足

---

## 十二、参考资料

- [OpenWeatherMap API 文档](https://openweathermap.org/api)
- [FIFA 2026 世界杯场馆](https://www.fifa.com/worldcup/)
- [球场草皮类型影响研究](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC...)
- [海拔对足球比赛的影响](https://www.sciencedirect.com/...)

---

_文档版本：v1.0 | 2026-06-13 | by AI Coding Engineer_
