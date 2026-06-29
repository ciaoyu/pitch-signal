module.exports = function createVenueRoutes(deps) {
  const { espn, fetchJSON, parseEvent, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, COACHES, TEAM_NAMES_ZH, getCached, setCache, routes, rosterCache, PLAYER_RATINGS, RATINGS, TEAM_NAMES, getPlayerRatingData, assignLineupCoords, matchupAPI, matchupSpatial, loader, calculateVenueImpact, analyzeStyleFit } = deps;
  const fs = require('fs');
  const fsPromises = require('fs').promises;
  const path = require('path');
  const DATA_DIR = path.join(__dirname, '..', '..', 'data');
  const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

  // venue_meta.json lazy singleton with TTL (5 minutes)
  const VENUE_META_TTL_MS = 5 * 60 * 1000;
  let _venueMeta = null;
  let _venueMetaTimestamp = 0;
  
  function getVenueMeta() {
    const now = Date.now();
    if (_venueMeta && (now - _venueMetaTimestamp) < VENUE_META_TTL_MS) {
      return _venueMeta;
    }
    try {
      _venueMeta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'venue_meta.json'), 'utf8'));
      _venueMetaTimestamp = now;
    } catch { _venueMeta = _venueMeta || {}; }
    return _venueMeta;
  }
  
  async function getVenueMetaAsync() {
    const now = Date.now();
    if (_venueMeta && (now - _venueMetaTimestamp) < VENUE_META_TTL_MS) {
      return _venueMeta;
    }
    try {
      const filePath = path.join(DATA_DIR, 'venue_meta.json');
      const content = await fsPromises.readFile(filePath, 'utf8');
      _venueMeta = JSON.parse(content);
      _venueMetaTimestamp = now;
    } catch { _venueMeta = _venueMeta || {}; }
    return _venueMeta;
  }

  return {
  'GET /api/venue/:id': async (params) => {
    const v = loader.getVenue(params.id, params.name);
    if (!v) return { id: params.id, note: 'Venue data not yet populated', name: params.name || params.id, city: '', country: '', capacity: 0, altitude: 0, grass: '未知', timezone: '', weather: null };

    // Try to get weather (OpenWeatherMap free tier)
    let weather = null;
    try {
      const OWMApiKey = process.env.OWM_API_KEY;
      if (OWMApiKey && v.coordinates) {
        // OpenWeatherMap requires appid as query param (no header-based auth for free tier)
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${v.coordinates.lat}&lon=${v.coordinates.lng}&appid=${OWMApiKey}&units=metric`;
        const weatherData = await fetchJSON(weatherUrl);
        weather = {
          temp: weatherData.main?.temp,
          feelsLike: weatherData.main?.feels_like,
          humidity: weatherData.main?.humidity,
          windSpeed: weatherData.wind?.speed ? weatherData.wind.speed * 3.6 : null,
          condition: weatherData.weather?.[0]?.main,
          description: weatherData.weather?.[0]?.description
        };
      }
    } catch (e) {
      // Weather fetch failed, continue without weather
    }
    if (!weather && v.coordinates) {
      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${v.coordinates.lat}&longitude=${v.coordinates.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;
        const current = (await fetchJSON(weatherUrl)).current || {};
        weather = {
          temp: current.temperature_2m,
          feelsLike: current.apparent_temperature,
          humidity: current.relative_humidity_2m,
          windSpeed: current.wind_speed_10m,
          condition: current.weather_code,
          description: 'Open-Meteo current conditions',
        };
      } catch {}
    }

    // Wikipedia summary (thumbnail + extract) with 24h TTL cache
    let wikiThumb = null;
    let wikiExtract = null;
    try {
      const wikiTitle = v.wiki?.title || v.name;
      if (wikiTitle) {
        const cacheKey = `wiki_thumb_${wikiTitle}`;
        const cached = getCached(cacheKey);
        if (cached) {
          wikiThumb = cached.thumb;
          wikiExtract = cached.extract;
        } else {
          const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
          const wikiData = await fetchJSON(wikiUrl, { timeout: 5000 });
          wikiThumb = wikiData.thumbnail?.source || null;
          wikiExtract = wikiData.extract || null;
          setCache(cacheKey, { thumb: wikiThumb, extract: wikiExtract }, 24 * 3600 * 1000);
        }
      }
    } catch (e) {
      // Wikipedia fetch failed, continue without thumbnail
    }

    // venue_meta.json enrichment
    const meta = v ? (getVenueMeta()[v.id] || null) : null;

    // Calculate venue impact
    const impact = calculateVenueImpact(v, weather);
    
    return { id: params.id, ...v, weather, impact, wikiThumb, wikiExtract, meta };
  },
  
  // === Venue Weather Analysis ===
  'GET /api/venue/:id/weather': async (params) => {
    const v = loader.getVenue(params.id);
    if (!v) return { error: 'Venue not found' };

    // Get weather from OpenWeatherMap
    let weather = null;
    try {
      const OWMApiKey = process.env.OWM_API_KEY;
      if (OWMApiKey && v.coordinates) {
        // OpenWeatherMap requires appid as query param (no header-based auth for free tier)
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${v.coordinates.lat}&lon=${v.coordinates.lng}&appid=${OWMApiKey}&units=metric`;
        const weatherData = await fetchJSON(weatherUrl);
        weather = {
          temp: weatherData.main?.temp,
          feelsLike: weatherData.main?.feels_like,
          humidity: weatherData.main?.humidity,
          windSpeed: weatherData.wind?.speed ? weatherData.wind.speed * 3.6 : null,
          windDirection: weatherData.wind?.deg,
          precipitation: weatherData.rain?.['1h'] || 0,
          cloudCover: weatherData.clouds?.all,
          visibility: weatherData.visibility,
          condition: weatherData.weather?.[0]?.main,
          description: weatherData.weather?.[0]?.description
        };
      }
    } catch (e) {
      // Weather fetch failed
    }

    // Calculate impact
    const impact = calculateVenueImpact(v, weather);
    
    return {
      venueId: params.id,
      venue: v,
      weather,
      impact,
      meta: getVenueMeta()[params.id] || null,
      styleFit: {
        possession: analyzeStyleFit(v, weather, '控球型'),
        counterAttack: analyzeStyleFit(v, weather, '快速反击'),
        highPress: analyzeStyleFit(v, weather, '高压逼抢')
      }
    };
  },

  // === Coach Comparison ===
  };
};
