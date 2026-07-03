# Third-Party Data & Copyright

PitchSignal's code is licensed under [ISC](LICENSE). This file inventories the third-party data and licensing terms that apply to the underlying World Cup data, separate from the code license.

## 26worldcup/26worldcup.github.io

Several seed data files under `resources/seed/wc2026/` (`teams.json`, `squads.json`, `lineups.json`, `venues.json`, `weather.json`, `wc-history.json`) are synced from the [2026 World Cup Open Source Companion](https://github.com/26worldcup/26worldcup.github.io) project via `scripts/sync-fifa-data.js`. See `resources/seed/wc2026/README.md` for the full file-by-file breakdown.

```
MIT License

Copyright (c) Tom Chen (tomchen.org)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```

## FIFA Public API

Match, team, and squad data is fetched from FIFA's public API (`api.fifa.com`). Used per FIFA's Terms of Service §6.4(b). PitchSignal is an unofficial fan project, not affiliated with, endorsed by, or connected to FIFA.

## Open-Meteo

Venue weather data is provided by [Open-Meteo](https://open-meteo.com), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: "Weather data by Open-Meteo.com".

## Wikipedia

Venue and squad records (`venues.json`, `squads.json`) carry `wiki` reference fields pointing to Wikipedia articles, sourced via the 26worldcup pipeline. Only uncopyrightable facts (names, dates, links) are extracted — no article prose is reproduced. Wikipedia content is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## ESPN API

Live fixtures, scores, and standings are fetched from the ESPN API. PitchSignal does not own this data; availability and accuracy depend entirely on ESPN as the upstream source.
