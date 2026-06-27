const { fuzzyMatchPlayer } = require('./fuzzy-match');
const playerIdResolver = require('./player-id-resolver');
const playerNameZh = require('./player-name-zh');

/**
 * Spatial Matchup Algorithm & Coordinators
 */
module.exports = function initMatchupSpatial(deps) {
  const { teamResolver, PLAYER_RATINGS, TEAM_FLAGS, getTeamNameZh, idBridge } = deps;

  function resolveTeam(input) {
    const raw = String(input || '');
    let nameOfficial = null;
    let code = null;
    let fallbackEspnId = null;

    if (idBridge) {
      const entry = idBridge[raw] ? [raw, idBridge[raw]] : Object.entries(idBridge).find(([k, v]) => String(v.espn_id) === raw || v.name_official === raw || v.name_zh === raw);
      if (entry) {
        code = entry[0];
        nameOfficial = entry[1].name_official;
        fallbackEspnId = entry[1].espn_id || `Est_${code}`;
      }
    }

    const resolved = teamResolver.resolve(raw);
    return {
      requestedId: raw,
      ratingsId: nameOfficial || resolved?.ratings_id || raw,
      espnId: fallbackEspnId || resolved?.espn_id || raw,
      nameOfficial,
      resolved,
    };
  }

  function getPlayerRatingData(input) {
    const info = resolveTeam(input);
    return {
      ...info,
      team: PLAYER_RATINGS?.data?.[info.ratingsId] || PLAYER_RATINGS?.data?.[info.espnId] || PLAYER_RATINGS?.data?.[info.requestedId] || null,
    };
  }

  function parseFormation(f) {
    const parts = f.split('-').map(Number);
    if (parts.length === 3) return { def: parts[0], mid: parts[1], fwd: parts[2] };
    if (parts.length === 4) return { def: parts[0], midDM: parts[1], midAM: parts[2], fwd: parts[3], mid: parts[1] + parts[2] };
    return { def: 4, mid: 3, fwd: 3 };
  }

  function pickLineup(players, formation, count, posKey, usedIds) {
    let candidates = Object.entries(players)
      .filter(([id, p]) => {
        if (usedIds.has(id)) return false;
        if (posKey === 'G') return p.pos === 'GK';
        if (posKey === 'D') return ['RB','RCB','LCB','LB','CB','RWB','LWB','D','DF'].includes(p.pos);
        if (posKey === 'M') return ['CDM','CM','RCM','LCM','CAM','LM','RM','M','AM','MF'].includes(p.pos);
        if (posKey === 'F') return ['LW','RW','ST','CF','F','FW'].includes(p.pos);
        return false;
      })
      .sort((a, b) => (b[1].rating || 70) - (a[1].rating || 70));
    
    let selected = candidates.slice(0, count);
    
    // Fallback if not enough players of this position
    if (selected.length < count && posKey !== 'G') {
      const needed = count - selected.length;
      const fallbackCandidates = Object.entries(players)
        .filter(([id, p]) => {
          if (usedIds.has(id)) return false;
          if (selected.some(sel => sel[0] === id)) return false;
          return p.pos !== 'GK';
        })
        .sort((a, b) => (b[1].rating || 70) - (a[1].rating || 70));
      
      const fallbackSelected = fallbackCandidates.slice(0, needed);
      selected = [...selected, ...fallbackSelected];
    }
    
    selected.forEach(([id]) => usedIds.add(id));
    return selected.map(([id, p]) => ({ id, name: p.name, pos: p.pos, rating: p.rating || 70, jersey: p.jersey || 0 }));
  }

  function calcFormationCoords(formation, isHome, lineup) {
    const f = parseFormation(formation);
    const result = { gk: [], def: [], mid: [], fwd: [] };
    const yBase = isHome
      ? { gk: 6, def: 22, mid: 45, fwd: 74 }
      : { gk: 94, def: 78, mid: 55, fwd: 26 };

    if (lineup.length > 0) result.gk.push({ ...lineup[0], x: 50, y: yBase.gk });
    lineup.slice(1, 1 + f.def).forEach((p, i) => {
      result.def.push({ ...p, x: Math.round(f.def === 1 ? 50 : 20 + (60 / (f.def - 1)) * i), y: yBase.def });
    });
    
    if (f.midDM && f.midAM) {
      const dmCount = f.midDM;
      const amCount = f.midAM;
      const dmLineup = lineup.slice(1 + f.def, 1 + f.def + dmCount);
      const amLineup = lineup.slice(1 + f.def + dmCount, 1 + f.def + dmCount + amCount);
      
      const yDm = isHome ? 44 : 56;
      const yAm = isHome ? 66 : 34;
      

      dmLineup.forEach((p, i) => {
        result.mid.push({ ...p, x: Math.round(dmCount === 1 ? 50 : 40 + (20 / (dmCount - 1)) * i), y: yDm });
      });
      amLineup.forEach((p, i) => {
        result.mid.push({ ...p, x: Math.round(amCount === 1 ? 50 : 20 + (60 / (amCount - 1)) * i), y: yAm });
      });
    } else {
      const midCount = f.mid;
      lineup.slice(1 + f.def, 1 + f.def + midCount).forEach((p, i) => {
        result.mid.push({ ...p, x: Math.round(midCount === 1 ? 50 : 20 + (60 / (midCount - 1)) * i), y: yBase.mid });
      });
    }

    const midCountTotal = f.mid;
    lineup.slice(1 + f.def + midCountTotal, 1 + f.def + midCountTotal + f.fwd).forEach((p, i) => {
      result.fwd.push({ ...p, x: Math.round(f.fwd === 1 ? 50 : 20 + (60 / (f.fwd - 1)) * i), y: yBase.fwd });
    });
    return result;
  }

  function resolveRealLineup(lineupInput, squadPlayersArray, formation, isHome) {
    const resolvedPlayers = lineupInput.map(p => {
      let rating = p.rating;
      let matchedName = p.name;
      let matchedJersey = p.jersey;
      if (!rating) {
        const searchTarget = { ...p, num: p.jersey || p.num };
        const searchSquad = squadPlayersArray.map(sp => ({ ...sp, num: sp.jersey || sp.num }));
        const match = fuzzyMatchPlayer(searchTarget, searchSquad);
        if (match) {
          rating = match.rating || 70;
          matchedName = match.name || p.name;
          matchedJersey = match.jersey || p.jersey;
        } else {
          rating = 70;
        }
      }
      const zh = playerNameZh.lookup(matchedName) || playerNameZh.lookup(p.name) || null;
      return { ...p, rating, name: matchedName, jersey: matchedJersey, nameZh: zh };
    });

    const gk = resolvedPlayers.filter(p => p.pos === 'GK');
    const def = resolvedPlayers.filter(p => ['RB','RCB','LCB','LB','CB','RWB','LWB','D','DF'].includes(p.pos));
    const mid = resolvedPlayers.filter(p => ['CDM','CM','RCM','LCM','CAM','LM','RM','M','AM','MF'].includes(p.pos));
    const fwd = resolvedPlayers.filter(p => ['LW','RW','ST','CF','F','FW'].includes(p.pos));

    const flatLineup = [...gk, ...def, ...mid, ...fwd];

    const hasCoords = flatLineup.length > 0 && flatLineup.every(p => p.x !== undefined && p.y !== undefined);
    if (hasCoords) {
      return { gk, def, mid, fwd };
    } else {
      return calcFormationCoords(formation, isHome, flatLineup);
    }
  }

  function pairPlayers(home, away) {
    const pairs = [];
    function getZone(y, isHome) {
      if (isHome) { if (y <= 15) return '门将'; if (y <= 35) return '防守三区'; if (y <= 60) return '中场'; return '进攻三区'; }
      else { if (y >= 85) return '门将'; if (y >= 65) return '防守三区'; if (y >= 40) return '中场'; return '进攻三区'; }
    }
    function makePair(h, a, zone) {
      const gap = h.rating - a.rating;
      const homeZh = h.nameZh || playerNameZh.lookup(h.name) || null;
      const awayZh = a.nameZh || playerNameZh.lookup(a.name) || null;
      return {
        home: { name: h.name, nameZh: homeZh, x: h.x, y: h.y, rating: h.rating, playerId: h.playerId || null, photo: h.photo || null },
        away: { name: a.name, nameZh: awayZh, x: a.x, y: a.y, rating: a.rating, playerId: a.playerId || null, photo: a.photo || null },
        diff: gap, zone,
        color: gap > 0 ? '#4CAF50' : gap < 0 ? '#F44336' : '#9E9E9E',
        advantage: gap > 0 ? 'home' : gap < 0 ? 'away' : 'even',
        key: Math.abs(gap) >= 5
      };
    }

    if (home.gk.length && away.gk.length) pairs.push(makePair(home.gk[0], away.gk[0], '门将'));

    const hDef = [...home.def].sort((a, b) => b.rating - a.rating);
    const aFwd = [...away.fwd].sort((a, b) => b.rating - a.rating);
    if (hDef.length && aFwd.length) {
      for (let i = 0; i < Math.max(hDef.length, aFwd.length); i++)
        pairs.push(makePair(hDef[i % hDef.length], aFwd[i % aFwd.length], getZone(hDef[i % hDef.length].y, true)));
    }

    const hMid = [...home.mid].sort((a, b) => b.rating - a.rating);
    const aMid = [...away.mid].sort((a, b) => b.rating - a.rating);
    if (hMid.length && aMid.length) {
      for (let i = 0; i < Math.max(hMid.length, aMid.length); i++)
        pairs.push(makePair(hMid[i % hMid.length], aMid[i % aMid.length], '中场'));
    }

    const hFwd = [...home.fwd].sort((a, b) => b.rating - a.rating);
    const aDef = [...away.def].sort((a, b) => b.rating - a.rating);
    if (hFwd.length && aDef.length) {
      for (let i = 0; i < Math.max(hFwd.length, aDef.length); i++)
        pairs.push(makePair(hFwd[i % hFwd.length], aDef[i % aDef.length], getZone(hFwd[i % hFwd.length].y, true)));
    }

    return pairs;
  }

  function buildSpatialMatchup(homeId, awayId, ratingsData, options = {}) {
    if (!ratingsData) return { error: 'ratings.json not loaded' };
    const homeLookup = getPlayerRatingData(homeId);
    const awayLookup = getPlayerRatingData(awayId);
    const homeData = homeLookup.team;
    const awayData = awayLookup.team;
    if (!homeData) return { error: `Team ${homeId} not found`, homeId, awayId, resolvedHome: homeLookup };
    if (!awayData) return { error: `Team ${awayId} not found`, homeId, awayId, resolvedAway: awayLookup };

    const homeFormation = options.homeFormation || homeData.formation || '4-3-3';
    const awayFormation = options.awayFormation || awayData.formation || '4-3-3';
    
    let homeCoords, awayCoords;

    if (options.homeLineup && options.homeLineup.length > 0) {
      homeCoords = resolveRealLineup(options.homeLineup, Object.values(homeData.players), homeFormation, true);
    } else {
      const homeUsed = new Set();
      const homeLineup = [
        ...pickLineup(homeData.players, homeFormation, 1, 'G', homeUsed),
        ...pickLineup(homeData.players, homeFormation, parseFormation(homeFormation).def, 'D', homeUsed),
        ...pickLineup(homeData.players, homeFormation, parseFormation(homeFormation).mid, 'M', homeUsed),
        ...pickLineup(homeData.players, homeFormation, parseFormation(homeFormation).fwd, 'F', homeUsed),
      ];
      homeCoords = calcFormationCoords(homeFormation, true, homeLineup);
    }

    if (options.awayLineup && options.awayLineup.length > 0) {
      awayCoords = resolveRealLineup(options.awayLineup, Object.values(awayData.players), awayFormation, false);
    } else {
      const awayUsed = new Set();
      const awayLineup = [
        ...pickLineup(awayData.players, awayFormation, 1, 'G', awayUsed),
        ...pickLineup(awayData.players, awayFormation, parseFormation(awayFormation).def, 'D', awayUsed),
        ...pickLineup(awayData.players, awayFormation, parseFormation(awayFormation).mid, 'M', awayUsed),
        ...pickLineup(awayData.players, awayFormation, parseFormation(awayFormation).fwd, 'F', awayUsed),
      ];
      awayCoords = calcFormationCoords(awayFormation, false, awayLineup);
    }

    const pairs = pairPlayers(homeCoords, awayCoords);

    let homeAdv = 0, awayAdv = 0, even = 0;
    for (const p of pairs) {
      if (p.advantage === 'home') homeAdv++;
      else if (p.advantage === 'away') awayAdv++;
      else even++;
    }
    const composite = pairs.length > 0 ? (homeAdv / pairs.length * 100) : 50;

    const homeElo = ratingsData?.teams?.[homeLookup.ratingsId]?.rating || 1500;
    const awayElo = ratingsData?.teams?.[awayLookup.ratingsId]?.rating || 1500;
    const eloWinProb = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
    const compositeScore = composite * 0.35 + eloWinProb * 100 * 0.50 + 50 * 0.15;

    const toPlayer = (p) => {
      // 确定球员 ID（slug 或 ESPN athlete ID）
      const playerId = p.id || p.fifaPlayerId || null;
      
      // 解析头像 URL
      let photo = null;
      if (playerId) {
        // 如果是 ESPN athlete ID（数字字符串），直接获取头像
        if (/^\d{6,7}$/.test(String(playerId))) {
          photo = playerIdResolver.getPhotoByEspnId(playerId);
        } else {
          // 如果是 slug，通过 resolver 解析
          const resolved = playerIdResolver.resolveBySlug(playerId);
          photo = resolved?.photo || null;
        }
      }
      
      const zh = p.nameZh || playerNameZh.lookup(p.name) || null;
      
      return { 
        name: p.name,
        nameZh: zh,
        pos: p.pos, 
        rating: p.rating, 
        x: p.x, 
        y: p.y, 
        jersey: p.jersey || 0,
        playerId,
        photo
      };
    };

    return {
      matchId: `${homeId}_vs_${awayId}`,
      home: { name: getTeamNameZh(homeLookup.espnId), flag: homeLookup.resolved?.flag || TEAM_FLAGS[homeLookup.ratingsId] || TEAM_FLAGS[homeLookup.espnId] || '', formation: homeFormation, players: [...homeCoords.gk, ...homeCoords.def, ...homeCoords.mid, ...homeCoords.fwd].map(toPlayer) },
      away: { name: getTeamNameZh(awayLookup.espnId), flag: awayLookup.resolved?.flag || TEAM_FLAGS[awayLookup.ratingsId] || TEAM_FLAGS[awayLookup.espnId] || '', formation: awayFormation, players: [...awayCoords.gk, ...awayCoords.def, ...awayCoords.mid, ...awayCoords.fwd].map(toPlayer) },
      pairs,
      summary: { homeAdvantages: homeAdv, awayAdvantages: awayAdv, evenPairs: even, avgGap: pairs.length > 0 ? Math.round(pairs.reduce((s, p) => s + Math.abs(p.diff), 0) / pairs.length * 10) / 10 : 0 },
      composite: { home: Math.round(compositeScore * 10) / 10, away: Math.round((100 - compositeScore) * 10) / 10, confidence: Math.abs(compositeScore - 50) > 15 ? 'high' : Math.abs(compositeScore - 50) > 5 ? 'medium' : 'low' },
      // T3 集成：阵型/XI/换人数据源
      source: options.source || 'projected',
      publishedAt: options.publishedAt || null,
      substitutions: options.substitutions || [],
      hasRealLineups: Boolean(options.homeLineup?.length || options.awayLineup?.length)
    };
  }

  return {
    buildSpatialMatchup,
    resolveTeam,
    getPlayerRatingData,
  };
};
