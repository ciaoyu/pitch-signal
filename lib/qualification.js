/**
 * 出线形势分析 - 蒙特卡洛模拟
 * 模拟剩余比赛，计算各队出线概率
 * v2 - 从 DB 加载真实分组 + 用真实 Elo 驱动模拟
 */
const { groups: dbGroups, db } = require('./db');

class QualificationSimulator {
  constructor(options = {}) {
    this.simulations = options.simulations || 10000;
    this.predictionEngine = options.predictionEngine || null;
    // Load Chinese team names
    try {
      this.teamNamesZh = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'team_names_zh.json'), 'utf8'));
    } catch (e) { this.teamNamesZh = {}; }
    try {
      this.idMap = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'id_map_center.json'), 'utf8'));
    } catch (e) { this.idMap = {}; }
    // Load ratings for Elo data
    try {
      this.ratings = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'ratings.json'), 'utf8')).teams;
    } catch (e) { this.ratings = {}; }
  }

  getTeamNameZh(id, fallback) {
    const zh = this.teamNamesZh[id];
    if (zh) return `${zh.zh} ${zh.en}`;
    const mapped = this.idMap[id];
    if (mapped) {
      const en = mapped.official_name || mapped.the_odds_name || fallback || id;
      const mappedZh = mapped.zh_name;
      return mappedZh && mappedZh !== en ? `${mappedZh} ${en}` : en;
    }
    return fallback || id;
  }

  getTeamMeta(id, fallback) {
    const mapped = this.idMap[id] || {};
    const en = mapped.official_name || mapped.the_odds_name || fallback || id;
    const zh = mapped.zh_name && mapped.zh_name !== en ? mapped.zh_name : en;
    return {
      espnId: mapped.espn_id || null,
      flag: mapped.flag || '🏳️',
      nameI18n: { zh, en },
    };
  }

  getTeamRating(teamId) {
    return this.ratings[teamId] || { rating: 1500, attack_strength: 1.0, defense_strength: 1.0 };
  }

  /**
   * 从数据库加载真实分组
   */
  loadGroupsFromDB() {
    const allGroups = dbGroups.getAllGroups();
    const result = [];

    for (const g of allGroups) {
      const standings = db.prepare('SELECT * FROM group_standings WHERE group_id = ? ORDER BY id').all(g.id);
      const dbMatches = db.prepare('SELECT * FROM matches WHERE group_id = ? ORDER BY match_number').all(g.id);

      const teams = standings.map(s => ({
        id: s.team_id,
        name: s.team_name,
        shortName: s.team_name.substring(0, 3).toUpperCase(),
        played: s.played,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        gf: s.goals_for,
        ga: s.goals_against,
        gd: s.goal_difference,
        pts: s.points,
      }));

      const matches = dbMatches.map(m => ({
        homeId: m.home_team_id,
        awayId: m.away_team_id,
        homeName: m.home_team_id,
        awayName: m.away_team_id,
        played: m.played === 1,
        homeScore: m.home_score,
        awayScore: m.away_score,
      }));

      result.push({
        name: `Group ${g.group_name}`,
        teams,
        matches,
      });
    }

    return result;
  }

  /**
   * 蒙特卡洛模拟小组出线
   * @param {object} group - { name, teams, matches }
   * @returns {object} 各队出线概率
   */
  simulateGroup(group) {
    const results = this.createResults(group.teams);

    for (let sim = 0; sim < this.simulations; sim++) {
      const simTable = this.simulateGroupTable(group);
      this.recordGroupResult(results, simTable);
    }

    return this.formatGroupResult(group.name, results);
  }

  /**
   * 同步模拟全部小组，并在每轮中跨组比较 12 个第三名取前 8。
   * 小组前二统计保持独立，最佳第三名通过单独字段返回。
   */
  simulateGroups(groups) {
    const resultsByGroup = new Map(
      groups.map(group => [group.name, this.createResults(group.teams)])
    );

    for (let sim = 0; sim < this.simulations; sim++) {
      const thirdPlaced = [];

      for (const group of groups) {
        const simTable = this.simulateGroupTable(group);
        const results = resultsByGroup.get(group.name);
        this.recordGroupResult(results, simTable, false);

        if (simTable[2]) {
          thirdPlaced.push({
            ...simTable[2],
            group: group.name,
          });
        }
        if (simTable[3]) results[simTable[3].id].eliminatedCount++;
      }

      thirdPlaced.sort(QualificationSimulator.compareStandings);
      const qualifiedThirdIds = new Set(
        thirdPlaced.slice(0, 8).map(team => `${team.group}:${team.id}`)
      );

      for (const team of thirdPlaced) {
        const result = resultsByGroup.get(team.group)[team.id];
        if (qualifiedThirdIds.has(`${team.group}:${team.id}`)) {
          result.thirdPlaceQualifyCount++;
        } else {
          result.eliminatedCount++;
        }
      }
    }

    return Object.fromEntries(
      groups.map(group => [
        group.name,
        this.formatGroupResult(group.name, resultsByGroup.get(group.name)),
      ])
    );
  }

  createResults(teams) {
    const results = {};
    for (const team of teams) {
      const meta = this.getTeamMeta(team.id, team.name);
      results[team.id] = {
        id: team.id,
        teamId: team.id,
        espnId: meta.espnId,
        name: this.getTeamNameZh(team.id, team.name),
        nameI18n: meta.nameI18n,
        flag: meta.flag,
        qualifyCount: 0,
        thirdPlaceQualifyCount: 0,
        championCount: 0,
        runnerUpCount: 0,
        eliminatedCount: 0,
        avgPosition: 0,
        positions: [0, 0, 0, 0],
      };
    }
    return results;
  }

  simulateGroupTable(group) {
    const remaining = group.matches.filter(m => !m.played);
    const simTable = group.teams.map(t => ({
      id: t.id,
      name: t.name,
      pts: t.pts || 0,
      gf: t.gf || 0,
      ga: t.ga || 0,
      gd: Number.isFinite(t.gd) ? t.gd : (t.gf || 0) - (t.ga || 0),
      played: t.played || 0,
    }));

    for (const match of remaining) {
      const home = simTable.find(t => t.id === match.homeId);
      const away = simTable.find(t => t.id === match.awayId);
      if (!home || !away) continue;

      const { homeScore, awayScore } = this.simulateMatch(match, home, away);

      home.played++;
      away.played++;
      home.gf += homeScore;
      home.ga += awayScore;
      home.gd = home.gf - home.ga;
      away.gf += awayScore;
      away.ga += homeScore;
      away.gd = away.gf - away.ga;

      if (homeScore > awayScore) {
        home.pts += 3;
      } else if (homeScore === awayScore) {
        home.pts += 1;
        away.pts += 1;
      } else {
        away.pts += 3;
      }
    }

    simTable.sort(QualificationSimulator.compareStandings);
    return simTable;
  }

  static compareStandings(a, b) {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  }

  recordGroupResult(results, simTable, countLowerPlacesAsEliminated = true) {
    simTable.forEach((team, idx) => {
      results[team.id].positions[idx]++;
      results[team.id].avgPosition += (idx + 1);
      if (idx < 2) results[team.id].qualifyCount++;
      if (idx === 0) results[team.id].championCount++;
      if (idx === 1) results[team.id].runnerUpCount++;
      if (countLowerPlacesAsEliminated && idx >= 2) results[team.id].eliminatedCount++;
    });
  }

  formatGroupResult(groupName, results) {
    for (const id of Object.keys(results)) {
      const r = results[id];
      r.qualifyProb = Math.round(r.qualifyCount / this.simulations * 1000) / 1000;
      r.thirdPlaceQualifyProb = Math.round(r.thirdPlaceQualifyCount / this.simulations * 1000) / 1000;
      r.championProb = Math.round(r.championCount / this.simulations * 1000) / 1000;
      r.runnerUpProb = Math.round(r.runnerUpCount / this.simulations * 1000) / 1000;
      r.eliminatedProb = Math.round(r.eliminatedCount / this.simulations * 1000) / 1000;
      r.avgPosition = Math.round(r.avgPosition / this.simulations * 10) / 10;
    }

    return {
      group: groupName,
      simulations: this.simulations,
      results: Object.values(results).sort((a, b) => b.qualifyProb - a.qualifyProb),
    };
  }

  /**
   * 用真实 Elo 强度模拟比赛
   */
  simulateMatch(match, home, away) {
    if (this.predictionEngine) {
      const homeR = this.getTeamRating(match.homeId);
      const awayR = this.getTeamRating(match.awayId);

      const pred = this.predictionEngine.predict({
        homeId: match.homeId,
        awayId: match.awayId,
        homeRating: homeR,
        awayRating: awayR,
      });

      // 用 expected goals 作为 Poisson 参数
      return {
        homeScore: this.samplePoisson(pred.goals.homeExpected),
        awayScore: this.samplePoisson(pred.goals.awayExpected),
      };
    }

    // Fallback: 基于 Elo 差简单模拟
    const homeR = this.getTeamRating(match.homeId);
    const awayR = this.getTeamRating(match.awayId);
    const eloDiff = (homeR.rating || 1500) - (awayR.rating || 1500);
    
    // Elo 差每 100 分加 0.4 expected goals
    const homeLambda = Math.max(0.3, 1.3 + (eloDiff / 100) * 0.4);
    const awayLambda = Math.max(0.3, 1.0 - (eloDiff / 100) * 0.4);

    return {
      homeScore: this.samplePoisson(homeLambda),
      awayScore: this.samplePoisson(awayLambda),
    };
  }

  samplePoisson(lambda) {
    let L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return Math.min(k - 1, 8);
  }

  /**
   * 从 ratings.json 构建小组数据（保留向后兼容）
   */
  buildGroupsFromRatings(ratings, standings) {
    // 如果 DB 有数据，优先从 DB 加载
    try {
      const dbGrps = this.loadGroupsFromDB();
      if (dbGrps.length > 0) return dbGrps;
    } catch (e) { /* fallback */ }

    const groups = [];

    if (standings?.children?.length) {
      for (const group of standings.children) {
        const groupName = group.name || group.abbreviation || 'Unknown';
        const teams = [];
        const teamIds = [];

        for (const entry of (group.standings?.entries || [])) {
          const teamId = entry.team?.id;
          if (!teamId) continue;
          teamIds.push(teamId);
          const record = entry.records?.find(r => r.type === 'total');
          const stats = record?.stats || [];
          const findStat = (type) => stats.find(s => s.type === type)?.value || 0;

          teams.push({
            id: teamId,
            name: entry.team?.displayName || entry.team?.abbreviation || teamId,
            shortName: entry.team?.shortDisplayName || '',
            logo: entry.team?.logos?.[0]?.href,
            played: findStat('wins') + findStat('ties') + findStat('losses'),
            wins: findStat('wins'),
            draws: findStat('ties'),
            losses: findStat('losses'),
            gf: findStat('pointsFor'),
            ga: findStat('pointsAgainst'),
            gd: findStat('pointDifferential'),
            pts: findStat('points'),
          });
        }

        const matches = [];
        for (let i = 0; i < teamIds.length; i++) {
          for (let j = i + 1; j < teamIds.length; j++) {
            const home = teams[i];
            const away = teams[j];
            const played = home.played > 0 && away.played > 0;
            matches.push({
              homeId: teamIds[i], awayId: teamIds[j],
              homeName: home.name, awayName: away.name,
              played, homeScore: null, awayScore: null,
            });
          }
        }

        groups.push({ name: groupName, teams, matches });
      }
    }

    // Fallback: build from RATINGS
    if (!groups.length && ratings?.teams) {
      const teamEntries = Object.entries(ratings.teams);
      const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      const teamsPerGroup = 4;

      const sorted = teamEntries.map(([id, team]) => {
        const players = team.players || [];
        const avg = players.length ? players.reduce((s, p) => s + (p.rating || 70), 0) / players.length : 70;
        return { id, name: this.getTeamNameZh(id, team.name || id), avg };
      }).sort((a, b) => b.avg - a.avg);

      const numGroups = Math.min(groupNames.length, Math.floor(sorted.length / teamsPerGroup));

      for (let g = 0; g < numGroups; g++) {
        const groupTeams = [];
        const teamIds = [];
        for (let pot = 0; pot < teamsPerGroup; pot++) {
          const idx = pot * numGroups + g;
          if (idx < sorted.length) {
            const team = sorted[idx];
            teamIds.push(team.id);
            groupTeams.push({
              id: team.id, name: team.name,
              shortName: team.name.substring(0, 3).toUpperCase(),
              logo: null, played: 0, wins: 0, draws: 0, losses: 0,
              gf: 0, ga: 0, gd: 0, pts: 0,
            });
          }
        }

        const matches = [];
        for (let i = 0; i < teamIds.length; i++) {
          for (let j = i + 1; j < teamIds.length; j++) {
            matches.push({
              homeId: teamIds[i], awayId: teamIds[j],
              homeName: groupTeams[i].name, awayName: groupTeams[j].name,
              played: false, homeScore: null, awayScore: null,
            });
          }
        }

        groups.push({ name: `Group ${groupNames[g]}`, teams: groupTeams, matches });
      }
    }

    return groups;
  }
}

module.exports = QualificationSimulator;
