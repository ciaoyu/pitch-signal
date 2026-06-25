module.exports = function createVenueRoutes(deps) {
  const { espn, fetchJSON, parseEvent, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, COACHES, TEAM_NAMES_ZH, getCached, setCache, routes, rosterCache, PLAYER_RATINGS, RATINGS, TEAM_NAMES, getPlayerRatingData, assignLineupCoords, matchupAPI, matchupSpatial, loader, calculateVenueImpact, analyzeStyleFit } = deps;
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, '..', '..', 'data');
  const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

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

    // Calculate venue impact
    const impact = calculateVenueImpact(v, weather);
    
    return { id: params.id, ...v, weather, impact };
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
