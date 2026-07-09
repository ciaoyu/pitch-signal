// ========== Venue Impact Analysis ==========
// Extracted from server.js (2026-06-26 refactor)
// Pure functions — no external dependencies, no side effects

function calculateVenueImpact(venue, weather) {
  let impact = {
    overall: 0,        // -100 to +100
    attack: 0,         // Attack impact
    defense: 0,        // Defense impact
    possession: 0,     // Possession impact
    physical: 0,       // Physical impact
    details: []
  };
  
  // 1. Pitch type impact (35%)
  const grassImpact = analyzeGrassImpact(venue.grass);
  impact.attack += grassImpact.attack * 0.35;
  impact.defense += grassImpact.defense * 0.35;
  impact.possession += grassImpact.possession * 0.35;
  
  // 2. Altitude impact (20%)
  const altitudeImpact = analyzeAltitudeImpact(venue.altitude);
  impact.physical += altitudeImpact.physical * 0.20;
  impact.attack += altitudeImpact.attack * 0.20;
  
  // 3. Weather impact (if available)
  if (weather) {
    // Temperature impact (20%)
    const tempImpact = analyzeTemperatureImpact(weather.temp);
    impact.physical += tempImpact.physical * 0.20;
    
    // Humidity impact (15%)
    const humidityImpact = analyzeHumidityImpact(weather.humidity);
    impact.physical += humidityImpact.physical * 0.15;
    
    // Wind impact (10%)
    const windImpact = analyzeWindImpact(weather.windSpeed);
    impact.attack += windImpact.attack * 0.10;
  }
  
  // Calculate overall score
  impact.overall = Math.round((impact.attack + impact.defense + impact.possession + impact.physical) / 4);
  
  // Generate details
  if (venue.grass.includes('人工')) {
    impact.details.push('人工草皮球速快，适合快速反击');
  } else if (venue.grass.includes('混合')) {
    impact.details.push('混合草皮兼顾球速和舒适度');
  } else {
    impact.details.push('天然草皮技术发挥好');
  }
  
  if (venue.altitude > 1000) {
    impact.details.push(`海拔${venue.altitude}m，球速加快，体能消耗增加`);
  }
  
  if (weather) {
    if (weather.temp > 30) {
      impact.details.push('高温环境，体能消耗大');
    } else if (weather.temp < 10) {
      impact.details.push('低温环境，肌肉僵硬风险增加');
    }
    if (weather.humidity > 70) {
      impact.details.push('高湿度，闷热难耐');
    }
    if (weather.windSpeed > 20) {
      impact.details.push('风速较大，影响长传和射门');
    }
  }
  
  return impact;
}

function analyzeGrassImpact(grass) {
  if (grass.includes('人工')) {
    return { attack: 15, defense: -5, possession: -10, physical: 5 };
  } else if (grass.includes('混合')) {
    return { attack: 5, defense: 0, possession: 5, physical: 0 };
  } else {
    return { attack: 0, defense: 5, possession: 10, physical: -5 };
  }
}

function analyzeAltitudeImpact(altitude) {
  if (altitude > 2000) {
    return { attack: 20, physical: -25 };
  } else if (altitude > 1000) {
    return { attack: 10, physical: -15 };
  } else if (altitude > 500) {
    return { attack: 5, physical: -5 };
  }
  return { attack: 0, physical: 0 };
}

function analyzeTemperatureImpact(temp) {
  if (temp > 35) return { physical: -30 };
  if (temp > 30) return { physical: -20 };
  if (temp > 25) return { physical: -5 };
  if (temp < 5) return { physical: -15 };
  if (temp < 10) return { physical: -5 };
  return { physical: 0 };
}

function analyzeHumidityImpact(humidity) {
  if (humidity > 80) return { physical: -20 };
  if (humidity > 70) return { physical: -10 };
  if (humidity < 30) return { physical: -5 };
  return { physical: 0 };
}

function analyzeWindImpact(windSpeed) {
  if (windSpeed > 30) return { attack: -20 };
  if (windSpeed > 20) return { attack: -10 };
  if (windSpeed > 10) return { attack: -5 };
  return { attack: 0 };
}

function analyzeStyleFit(venue, weather, style) {
  const fits = {
    '控球型': {
      grass: '天然草 > 混合草 > 人工草',
      altitude: '低海拔优先',
      temp: '10-25°C 最佳',
      humidity: '<70% 最佳',
      fit: venue.grass.includes('天然') ? 'good' : venue.grass.includes('混合') ? 'medium' : 'poor'
    },
    '快速反击': {
      grass: '人工草 > 混合草 > 天然草',
      altitude: '高海拔有利',
      temp: '任何温度',
      humidity: '影响小',
      fit: venue.grass.includes('人工') ? 'good' : venue.grass.includes('混合') ? 'medium' : 'poor'
    },
    '高压逼抢': {
      grass: '任何草皮',
      altitude: '低海拔优先',
      temp: '<25°C 优先',
      humidity: '<60% 最佳',
      fit: venue.altitude < 500 ? 'good' : venue.altitude < 1000 ? 'medium' : 'poor'
    }
  };
  
  return fits[style] || fits['控球型'];
}

module.exports = {
  calculateVenueImpact,
  analyzeGrassImpact,
  analyzeAltitudeImpact,
  analyzeTemperatureImpact,
  analyzeHumidityImpact,
  analyzeWindImpact,
  analyzeStyleFit
};
