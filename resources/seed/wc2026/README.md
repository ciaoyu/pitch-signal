# WC2026 数据文件说明

本目录包含从 [26worldcup/26worldcup.github.io](https://github.com/26worldcup/26worldcup.github.io) 同步的 2026 年世界杯数据文件。

本目录是版本控制内的只读基线。应用读取时优先使用
`$DATA_PATH/wc2026/` 中的运行数据，文件不存在时才回退到这里。同步和构建脚本
只能写入运行目录，不得直接修改本目录。

## 数据来源

- **GitHub 仓库**: `26worldcup/26worldcup.github.io`
- **同步脚本**: `scripts/sync-fifa-data.js`
- **最后同步**: 2026-06-25

## 文件列表

### 1. teams.json (48 支球队)

**来源**: `public/data/teams.json`
**大小**: ~55 KB

球队基本信息，按 FIFA 三字母代码索引。

```json
{
  "teams": {
    "ALG": {
      "code": "ALG",           // FIFA 三字母代码
      "fifaId": "43843",       // FIFA 官方 ID
      "iso2": "DZ",            // ISO 3166-1 alpha-2 国家代码
      "group": "J",            // 小组赛分组
      "name": {
        "en": "Algeria",       // 英文名
        "zh": "阿尔及利亚",    // 中文名
        "fr": "Algérie",       // 法文名
        // ... 其他语言
      },
      "ranking": 28,           // FIFA 排名
      "rankingPrev": 28,       // 上期排名
      "baseCamp": {
        "city": "Lawrence",
        "facility": "University of Kansas",
        "country": "US",
        "lat": 38.97167,
        "lon": -95.23525
      },
      "colors": ["#00792c", "#FFFFFF"],  // 球队颜色
      "nickname": "الأفناك",             // 昵称
      "web": "faf.dz",                   // 官网
      "flag": "https://api.fifa.com/api/v3/picture/flags-sq-3/ALG"
    }
  }
}
```

### 2. squads.json (球员名单)

**来源**: `public/data/squads.json`
**大小**: ~616 KB

各球队的球员名单，按 FIFA 代码索引。

```json
{
  "ALG": {
    "coach": "Miroslav Koubek",           // 主教练
    "coachWiki": "https://...",           // 教练维基
    "wiki": { "title": "...", "url": "..." }, // 球队维基
    "players": [
      {
        "id": "matej-kovar",              // 球员 ID
        "no": 1,                          // 球衣号码
        "pos": "GK",                      // 位置 (GK/DF/MF/FW)
        "name": "Matěj Kovář",            // 姓名
        "dob": "2000-05-17",              // 出生日期
        "caps": 20,                       // 国家队出场次数
        "goals": 0,                       // 国家队进球数
        "club": "PSV Eindhoven",          // 俱乐部
        "clubNat": "NED",                 // 俱乐部国家
        "captain": false,                 // 是否队长
        "wiki": "https://...",            // 维基链接
        "wcApps": 3,                      // 世界杯出场次数
        "wcGoals": 0,                     // 世界杯进球数
        "wcYellow": 0,                    // 世界杯黄牌数
        "wcRed": 0                        // 世界杯红牌数
      }
    ]
  }
}
```

### 3. lineups.json (比赛阵容)

**来源**: `public/data/lineups.json`
**大小**: ~798 KB

比赛阵容信息，按比赛 ID 索引。

```json
{
  "400021440": {                         // 比赛 ID
    "home": {                            // 主队
      "tactics": "3-5-2",                // 阵型
      "xi": [                            // 首发阵容
        {
          "id": "484012",                // 球员 ID
          "name": "Matej KOVAR",         // 姓名
          "number": 1,                   // 球衣号码
          "captain": false,              // 是否队长
          "gk": true,                    // 是否门将
          "start": true,                 // 是否首发
          "fieldPos": 0,                 // 场上位置
          "x": null,                     // 场上 X 坐标
          "y": null                      // 场上 Y 坐标
        }
      ],
      "subs": [...]                      // 替补阵容
    },
    "away": { ... }                      // 客队 (同结构)
  }
}
```

### 4. probs.json (比赛概率)

**来源**: `public/data/probs.json`
**大小**: ~4 KB

比赛胜平负概率，按比赛 ID 索引。

```json
{
  "400021440": {                         // 比赛 ID
    "h": 48,                             // 主队胜率 (%)
    "d": 28,                             // 平局概率 (%)
    "a": 24                              // 客队胜率 (%)
  }
}
```

### 5. venues.json (比赛场馆)

**来源**: `public/data/venues.json`
**大小**: ~85 KB

比赛场馆信息，按场馆 ID 索引。

```json
{
  "venues": {
    "400017978": {                       // 场馆 ID
      "id": "400017978",
      "realName": "SoFi Stadium",        // 实际名称
      "city": "Inglewood (Los Angeles)", // 城市
      "country": "US",                   // 国家
      "lat": 33.9535,                    // 纬度
      "lon": -118.3392,                  // 经度
      "tz": "America/Los_Angeles",       // 时区
      "capacity": 70000,                 // 容量
      "roof": "canopy",                  // 屋顶类型 (open/retractable/canopy/closed)
      "wiki": { "title": "...", "url": "..." },
      "note": "...",                     // 备注
      "fifaName": {                      // FIFA 官方名称
        "en": "Los Angeles Stadium",
        "zh": "Los Angeles Stadium",
        // ... 其他语言
      },
      "cityName": {                      // 城市名称
        "en": "Los Angeles",
        "zh": "洛杉矶",
        // ... 其他语言
      }
    }
  }
}
```

### 6. weather.json (比赛天气)

**来源**: `public/data/weather.json`
**大小**: ~16 KB

比赛天气预报，按比赛 ID 索引。

```json
{
  "400021440": {                         // 比赛 ID
    "tC": 26.9,                          // 温度 (摄氏度)
    "feelsC": 31.8,                      // 体感温度
    "pp": 17,                            // 降水概率 (%)
    "code": 95,                          // 天气代码
    "windKmh": 13.9,                     // 风速 (km/h)
    "rh": 82,                            // 相对湿度 (%)
    "fetchedAt": "2026-06-20T22:55:02.227Z" // 获取时间
  }
}
```

### 7. wc-history.json (世界杯历史)

**来源**: `public/data/wc-history.json`
**大小**: ~347 KB

各球队世界杯历史成绩，按 FIFA 代码索引。

```json
{
  "ALG": {
    "history": [
      {
        "year": 2022,                    // 年份
        "host": [{ "iso": "QA", "name": "Qatar" }], // 主办国
        "played": false,                 // 是否参赛
        "finish": null,                  // 最终名次 (null/R32/R16/QF/SF/F/W)
        "reason": "dnq",                 // 未参赛原因 (dnq/did not exist)
        "p": 0,                          // 比赛场次
        "w": 0,                          // 胜场
        "d": 0,                          // 平场
        "l": 0,                          // 负场
        "gf": 0,                         // 进球数
        "ga": 0                          // 失球数
      }
    ]
  }
}
```

### 8. climate.json (场馆气候)

**来源**: `scripts/curated/climate.json`
**大小**: ~48 KB

各场馆的气候数据，按场馆 ID 索引。

```json
{
  "venues": {
    "400017978": {                       // 场馆 ID
      "jun": {                           // 6 月数据
        "highC": 22,                     // 最高温 (摄氏度)
        "lowC": 15                       // 最低温 (摄氏度)
      },
      "jul": {                           // 7 月数据
        "highC": 24,
        "lowC": 17
      },
      "rainNote": {                      // 降雨说明
        "en": "Dry season, virtually no rain...",
        "zh": "旱季，几乎无降雨...",
        // ... 其他语言
      },
      "roof": "canopy"                   // 屋顶类型
    }
  }
}
```

### 9. fifa-ranking.json (FIFA 排名)

**来源**: `scripts/curated/fifa-ranking.json`
**大小**: ~5 KB

FIFA 官方排名数据。

```json
{
  "_meta": {
    "description": "Official FIFA men's world ranking published 2026-06-11",
    "date": "2026-06-11",               // 排名日期
    "dateId": "FRS_Male_Football_20260401",
    "source": "https://inside.fifa.com/fifa-world-ranking/men",
    "teams": 48                          // 球队数量
  },
  "ranking": {
    "ALG": {                             // FIFA 代码
      "rank": 28,                        // 排名
      "prev": 28,                        // 上期排名
      "pts": 1571.03,                    // 积分
      "prevPts": 1564.26                 // 上期积分
    }
  }
}
```

### 10. id_bridge.json (ID 映射桥)

**来源**: 由 `scripts/build-id-bridge.js` 生成
**大小**: ~8 KB

连接 FIFA code/id ↔ ESPN id ↔ 国家名的映射文件。

```json
{
  "ALG": {                             // FIFA 代码
    "fifa_code": "ALG",                // FIFA 三字母代码
    "fifa_id": "43843",                // FIFA 官方 ID
    "espn_id": "624",                  // ESPN ID
    "iso2": "DZ",                      // ISO 3166-1 alpha-2
    "name_en": "Algeria",              // 英文名
    "name_zh": "阿尔及利亚",           // 中文名
    "name_official": "Algeria",        // 官方名称
    "group": "J",                      // 小组
    "ranking": 28                      // FIFA 排名
  }
}
```

**匹配统计**: 47/48 支球队成功匹配，1 支球队 (Cabo Verde) 无法匹配。

### 11. unmatched.txt (未匹配球队)

**来源**: 由 `scripts/build-id-bridge.js` 生成

无法匹配 ESPN ID 的球队列表，包含 FIFA 代码、名称和原因。

## 数据更新

### 自动同步

运行以下命令同步最新数据：

```bash
node scripts/sync-fifa-data.js
```

### 重建 ID Bridge

运行以下命令重建 id_bridge.json：

```bash
node scripts/build-id-bridge.js
```

## 使用示例

### 获取球队信息

```javascript
const teams = require('./teams.json');

// 获取阿根廷队信息
const argentina = teams.teams['ARG'];
console.log(argentina.name.zh); // "阿根廷"
console.log(argentina.ranking); // 1
```

### 获取比赛阵容

```javascript
const lineups = require('./lineups.json');

// 获取比赛 400021440 的主队阵容
const match = lineups['400021440'];
console.log(match.home.tactics); // "3-5-2"
console.log(match.home.xi[0].name); // "Matej KOVAR"
```

### 获取场馆天气

```javascript
const weather = require('./weather.json');

// 获取比赛 400021440 的天气
const matchWeather = weather['400021440'];
console.log(matchWeather.tC); // 26.9
console.log(matchWeather.feelsC); // 31.8
```

## 注意事项

1. **数据来源**: 所有数据来自 26worldcup 项目，非官方 FIFA 数据
2. **更新频率**: 数据可能不是实时更新，建议定期同步
3. **ID 映射**: id_bridge.json 中的 ESPN ID 匹配基于名称匹配，可能存在误差
4. **编码**: 所有 JSON 文件使用 UTF-8 编码
5. **时区**: 天气数据使用 UTC 时区，场馆时区信息在 venues.json 中

## 相关文件

- `scripts/sync-fifa-data.js` - 数据同步脚本
- `scripts/build-id-bridge.js` - ID 桥构建脚本
- `data/id_map_center.json` - ESPN ID 映射源数据
- `sync-log.json` - 同步日志
