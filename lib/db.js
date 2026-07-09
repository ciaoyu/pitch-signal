/**
 * SQLite Database Module - World Cup prediction data layer
 * Using better-sqlite3 synchronous API
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Gate 3: Support persistent volume mounting (Railway / Docker)
// Gate 4: Force :memory: in testing, avoiding production DB pollution
// Priority: TEST_MODE > TEST_DB_PATH > DB_PATH > DATA_PATH/predictions.db > local default
const DB_PATH =
  process.env.TEST_MODE === '1'
    ? ':memory:'
    : (
      process.env.TEST_DB_PATH ||   // For testing (:memory: or temporary path)
      process.env.DB_PATH ||        // Exact path override
      (process.env.DATA_PATH
        ? path.join(process.env.DATA_PATH, 'predictions.db')
        : null) ||
      (process.env.NODE_ENV === 'test'
        ? path.join(__dirname, '..', 'data', 'test.db') // Auto-use temp DB when NODE_ENV=test
        : path.join(__dirname, '..', 'data', 'predictions.db'))
    );

const DB_DIR = DB_PATH === ':memory:' ? null : path.dirname(DB_PATH);

if (DB_DIR && !fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

if (DB_PATH !== ':memory:') console.log(`📦 DB: ${DB_PATH}`);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const ALLOWED_TABLES = new Set([
  'historical_matches',
  'elo_ratings',
  'team_features',
  'poisson_params',
  'predictions',
  'prediction_snapshots',
  'post_match_reviews',
  'team_name_map',
  'groups',
  'group_standings',
  'matches',
  'user_feedback',
  'user_predictions',
  'push_subscriptions',
  'retrospective_predictions',
  'match_moments',
  'match_live_stats',
  'match_odds_benchmark',
  'team_xg_stats',
  'fifa_match_bridge',
]);
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeIdentifier(value, label) {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

function assertSafeTable(table) {
  assertSafeIdentifier(table, 'table');
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Unsupported table: ${table}`);
  }
  return table;
}

function assertSafeColumns(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('Columns must be a non-empty array');
  }
  return columns.map((column) => assertSafeIdentifier(column, 'column'));
}

// ========== Create Tables ==========
db.exec(`
  -- Historical matches data
  -- P2-3: Model vs market odds divergence benchmark table
  CREATE TABLE IF NOT EXISTS match_odds_benchmark (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id     TEXT    NOT NULL UNIQUE,
    model_home_prob  REAL,
    model_draw_prob REAL,
    model_away_prob  REAL,
    market_home_prob REAL,
    market_draw_prob REAL,
    market_away_prob REAL,
    delta_home   REAL,
    delta_draw   REAL,
    delta_away   REAL,
    divergence_flag INTEGER DEFAULT 0,
    odds_source  TEXT,
    model_version TEXT,
    computed_at  TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS historical_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_date TEXT,
    home_team TEXT,
    away_team TEXT,
    home_score INTEGER,
    away_score INTEGER,
    tournament TEXT,
    stage TEXT,
    venue TEXT,
    source TEXT
  );

  -- Elo ratings
  CREATE TABLE IF NOT EXISTS elo_ratings (
    team_id TEXT PRIMARY KEY,
    team_name TEXT,
    rating REAL DEFAULT 1500,
    peak_rating REAL DEFAULT 1500,
    matches_played INTEGER DEFAULT 0,
    last_updated TEXT
  );

  -- Team features (attack/defense strength, etc.)
  CREATE TABLE IF NOT EXISTS team_features (
    team_id TEXT PRIMARY KEY,
    team_name TEXT,
    attack_strength REAL DEFAULT 1.0,
    defense_strength REAL DEFAULT 1.0,
    home_advantage REAL DEFAULT 1.0,
    form_rating REAL DEFAULT 50.0,
    last_updated TEXT
  );

  -- Poisson model parameters
  CREATE TABLE IF NOT EXISTS poisson_params (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    global_avg_goals REAL DEFAULT 2.5,
    home_advantage REAL DEFAULT 1.2,
    tournament_factor REAL DEFAULT 1.0,
    last_updated TEXT
  );

  -- Prediction records
  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT,
    home_win_prob REAL,
    draw_prob REAL,
    away_win_prob REAL,
    predicted_home_goals REAL,
    predicted_away_goals REAL,
    confidence REAL,
    model_version TEXT,
    created_at TEXT
  );

  -- Pre-match prediction snapshot: used for post-match review, immutable against future model changes
  CREATE TABLE IF NOT EXISTS prediction_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    home_team_id TEXT,
    away_team_id TEXT,
    home_team_name TEXT,
    away_team_name TEXT,
    predicted_score TEXT,
    home_win_prob REAL,
    draw_prob REAL,
    away_win_prob REAL,
    home_expected_goals REAL,
    away_expected_goals REAL,
    payload_json TEXT NOT NULL,
    source TEXT DEFAULT 'prediction-route',
    created_at TEXT NOT NULL,
    UNIQUE(match_id, created_at)
  );

  -- Post-match retrospective prediction: backtested simulation for finished matches, explicitly marked as non-pre-match snapshot
  CREATE TABLE IF NOT EXISTS retrospective_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    home_win_prob REAL,
    draw_prob REAL,
    away_win_prob REAL,
    predicted_score TEXT,
    home_expected_goals REAL,
    away_expected_goals REAL,
    payload_json TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    UNIQUE(match_id)
  );

  -- Post-match review cache: pre-match prediction vs actual result + evidence + AI postmortem
  CREATE TABLE IF NOT EXISTS post_match_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    prediction_snapshot_id INTEGER,
    actual_home_score INTEGER,
    actual_away_score INTEGER,
    review_json TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(match_id),
    FOREIGN KEY (prediction_snapshot_id) REFERENCES prediction_snapshots(id)
  );

  -- P2-4: User predictions (single choice: home / draw / away)
  CREATE TABLE IF NOT EXISTS user_predictions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id      TEXT    NOT NULL,
    user_id       TEXT    NOT NULL DEFAULT 'anonymous',
    choice        TEXT    NOT NULL CHECK(choice IN ('home','draw','away')),
    confidence    REAL    DEFAULT NULL,
    notes         TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    UNIQUE(match_id, user_id)
  );

  -- P2-2: Web Push browser/device subscriptions
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL DEFAULT 'anonymous',
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1,
    failure_count   INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    last_success_at TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(active);

  -- User feedback and AI Q&A record
  CREATE TABLE IF NOT EXISTS user_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_query TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    match_context TEXT,
    created_at TEXT NOT NULL
  );

  -- Team name mapping (ESPN ID <-> FIFA code)
  CREATE TABLE IF NOT EXISTS team_name_map (
    espn_id TEXT PRIMARY KEY,
    fifa_code TEXT,
    full_name TEXT,
    short_name TEXT,
    flag_url TEXT
  );

  -- Groups table
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    tournament TEXT DEFAULT '2026 FIFA World Cup',
    UNIQUE(group_name, tournament)
  );

  -- Group standings
  CREATE TABLE IF NOT EXISTS group_standings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    team_id TEXT NOT NULL,
    team_name TEXT,
    played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    goal_difference INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    UNIQUE(group_id, team_id)
  );

  -- Match Moments: structured trigger points (goal/sub/cooling break/HT/etc.)
  CREATE TABLE IF NOT EXISTS match_moments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    type TEXT NOT NULL,
    minute INTEGER NOT NULL DEFAULT 0,
    minute_added INTEGER NOT NULL DEFAULT 0,
    team_id TEXT,
    importance INTEGER NOT NULL DEFAULT 50,
    source TEXT NOT NULL DEFAULT 'unknown',
    score_state_json TEXT,
    raw_json TEXT,
    -- Track A live probability snapshot after each moment
    prob_home_win REAL,
    prob_draw REAL,
    prob_away_win REAL,
    -- Probability drift relative to pre-match snapshot
    delta_home_win REAL,
    delta_draw REAL,
    delta_away_win REAL,
    detected_at TEXT NOT NULL,
    UNIQUE(match_id, type, minute, minute_added, team_id)
  );
  CREATE INDEX IF NOT EXISTS idx_moments_match ON match_moments(match_id, minute);

  -- Team xG stats (API-Football match data)
  CREATE TABLE IF NOT EXISTS team_xg_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_id INTEGER NOT NULL,
    match_date TEXT,
    team_id TEXT NOT NULL,
    team_name TEXT,
    opp_id TEXT,
    opp_name TEXT,
    xg REAL NOT NULL,
    is_home INTEGER DEFAULT 0,
    UNIQUE(fixture_id, team_id)
  );
  CREATE INDEX IF NOT EXISTS idx_xg_team ON team_xg_stats(team_id, match_date);

  -- Live stats snapshot + Pressure Index (written on each moment-sync tick)
  CREATE TABLE IF NOT EXISTS match_live_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    minute INTEGER NOT NULL,
    home_shots INTEGER DEFAULT 0,
    away_shots INTEGER DEFAULT 0,
    home_sot INTEGER DEFAULT 0,
    away_sot INTEGER DEFAULT 0,
    home_corners INTEGER DEFAULT 0,
    away_corners INTEGER DEFAULT 0,
    home_poss REAL DEFAULT 0,
    away_poss REAL DEFAULT 0,
    home_crosses INTEGER DEFAULT 0,
    away_crosses INTEGER DEFAULT 0,
    pressure_home REAL,
    pressure_away REAL,
    pressure_dominant TEXT,
    captured_at TEXT NOT NULL,
    UNIQUE(match_id, minute)
  );
  CREATE INDEX IF NOT EXISTS idx_livestats_match ON match_live_stats(match_id, minute);

  -- FIFA <-> ESPN match ID bridge table
  CREATE TABLE IF NOT EXISTS fifa_match_bridge (
    espn_id TEXT PRIMARY KEY,
    fifa_match_id TEXT,
    fifa_stage_id TEXT,
    home_fifa_code TEXT,
    away_fifa_code TEXT,
    match_date TEXT,
    updated_at TEXT
  );

  -- Schedule table
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    match_number INTEGER,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    played INTEGER DEFAULT 0,
    match_date TEXT,
    venue TEXT,
    stage TEXT DEFAULT 'Group',
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );
`);

// ========== Schema Migrations ==========
// Idempotent ADD COLUMN for SQLite ALTER TABLE: ignore error if column already exists
(function runMigrations() {
  const migrations = [
    `ALTER TABLE user_feedback ADD COLUMN type TEXT DEFAULT 'question'`,
    `ALTER TABLE user_feedback ADD COLUMN page_url TEXT`,
    `ALTER TABLE match_moments ADD COLUMN prob_home_win REAL`,
    `ALTER TABLE match_moments ADD COLUMN prob_draw REAL`,
    `ALTER TABLE match_moments ADD COLUMN prob_away_win REAL`,
    `ALTER TABLE match_moments ADD COLUMN delta_home_win REAL`,
    `ALTER TABLE match_moments ADD COLUMN delta_draw REAL`,
    `ALTER TABLE match_moments ADD COLUMN delta_away_win REAL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_group_num ON matches(group_id, match_number)`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* Column already exists, ignore */ }
  }
})();

// ========== Helper Functions ==========
const helpers = {
  run: (sql, ...params) => db.prepare(sql).run(...params),
  get: (sql, ...params) => db.prepare(sql).get(...params),
  all: (sql, ...params) => db.prepare(sql).all(...params),
  prepare: (sql) => db.prepare(sql),

  // Bulk insert
  insertMany: (table, columns, rows) => {
    const safeTable = assertSafeTable(table);
    const safeColumns = assertSafeColumns(columns);
    const placeholders = safeColumns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${safeTable} (${safeColumns.join(', ')}) VALUES (${placeholders})`;
    const stmt = db.prepare(sql);
    const insert = db.transaction((rows) => {
      for (const row of rows) stmt.run(...row);
    });
    insert(rows);
    return rows.length;
  },

  // Get table row count
  count: (table) => {
    const safeTable = assertSafeTable(table);
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${safeTable}`).get();
    return row.cnt;
  },

  // Get all table names
  tables: () => {
    return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
  },

  // Close database
  close: () => db.close(),
};

// ========== Retrospective Predictions ==========
const saveRetrospectivePrediction = (matchId, prediction) => {
  if (!matchId || !prediction || prediction.error) return null;
  const now = new Date().toISOString();
  const payload = JSON.stringify(prediction);
  const values = [
    String(matchId),
    prediction.homeWin ?? null,
    prediction.draw ?? null,
    prediction.awayWin ?? null,
    prediction.likelyScore || null,
    prediction.goals?.homeExpected ?? null,
    prediction.goals?.awayExpected ?? null,
    payload,
    now,
  ];
  db.prepare(`
    INSERT INTO retrospective_predictions (
      match_id, home_win_prob, draw_prob, away_win_prob,
      predicted_score, home_expected_goals, away_expected_goals,
      payload_json, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(match_id) DO UPDATE SET
      home_win_prob = excluded.home_win_prob,
      draw_prob = excluded.draw_prob,
      away_win_prob = excluded.away_win_prob,
      predicted_score = excluded.predicted_score,
      home_expected_goals = excluded.home_expected_goals,
      away_expected_goals = excluded.away_expected_goals,
      payload_json = excluded.payload_json,
      generated_at = excluded.generated_at
  `).run(...values);
  return { matchId, generatedAt: now };
};

const getRetrospectivePrediction = (matchId) => {
  const row = db.prepare('SELECT * FROM retrospective_predictions WHERE match_id = ?').get(String(matchId));
  if (!row) return null;
  let payload = {};
  try { payload = JSON.parse(row.payload_json); } catch { console.warn('db.getRetrospectivePrediction: invalid JSON for', matchId); }
  return {
    ...payload,
    _retrospectiveId: row.id,
    _retrospectiveGeneratedAt: row.generated_at,
    _source: 'retrospective',
  };
};

const clearRetrospectivePredictions = () => {
  db.prepare('DELETE FROM retrospective_predictions').run();
};

// ========== Groups & Matches CRUD ==========
const initGroupsTables = () => {
  // Tables are created via CREATE TABLE IF NOT EXISTS on require
  return true;
};

const insertGroup = (groupName, tournament = '2026 FIFA World Cup') => {
  const existing = db.prepare('SELECT id FROM groups WHERE group_name = ? AND tournament = ?').get(groupName, tournament);
  if (existing) return existing.id;
  const result = db.prepare('INSERT INTO groups (group_name, tournament) VALUES (?, ?)').run(groupName, tournament);
  return result.lastInsertRowid;
};

const insertStanding = (group_id, team_id, team_name, played = 0, wins = 0, draws = 0, losses = 0, goals_for = 0, goals_against = 0) => {
  const gd = goals_for - goals_against;
  const pts = wins * 3 + draws;
  db.prepare(`
    INSERT INTO group_standings (group_id, team_id, team_name, played, wins, draws, losses, goals_for, goals_against, goal_difference, points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(group_id, team_id) DO UPDATE SET
      played = excluded.played,
      wins = excluded.wins,
      draws = excluded.draws,
      losses = excluded.losses,
      goals_for = excluded.goals_for,
      goals_against = excluded.goals_against,
      goal_difference = excluded.goal_difference,
      points = excluded.points
  `).run(group_id, team_id, team_name, played, wins, draws, losses, goals_for, goals_against, gd, pts);
};

const insertMatch = (group_id, home_team_id, away_team_id, match_number, home_score = null, away_score = null, played = 0, match_date = null, venue = null) => {
  db.prepare(`
    INSERT OR IGNORE INTO matches (group_id, match_number, home_team_id, away_team_id, home_score, away_score, played, match_date, venue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(group_id, match_number, home_team_id, away_team_id, home_score, away_score, played, match_date, venue);
};

const getGroup = (groupName) => {
  return db.prepare('SELECT * FROM groups WHERE group_name = ?').get(groupName);
};

const getAllGroups = () => {
  return db.prepare('SELECT * FROM groups ORDER BY group_name').all();
};

const getStandings = (group_id) => {
  return db.prepare('SELECT * FROM group_standings WHERE group_id = ? ORDER BY points DESC, goal_difference DESC, goals_for DESC').all(group_id);
};

const getGroupMatches = (group_id) => {
  return db.prepare('SELECT * FROM matches WHERE group_id = ? ORDER BY match_number').all(group_id);
};

const getFinishedMatches = () => {
  return db.prepare("SELECT m.*, g.group_name FROM matches m JOIN groups g ON m.group_id = g.id WHERE m.played = 1 ORDER BY m.match_date").all();
};

const seedRealGroups = () => {
  // Idempotent protection: skip INSERT if matches table already has seeded data to avoid duplicate entries
  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM matches').get().cnt;
  if (existing > 0) return 0;

  // Real World Cup group data (based on ESPN API)
  const groupData = [
    { name: 'A', teams: ['Czechia', 'Mexico', 'South Africa', 'South Korea'] },
    { name: 'B', teams: ['Bosnia-Herzegovina', 'Canada', 'Qatar', 'Switzerland'] },
    { name: 'C', teams: ['Brazil', 'Haiti', 'Morocco', 'Scotland'] },
    { name: 'D', teams: ['Australia', 'Paraguay', 'Türkiye', 'USA'] },
    { name: 'E', teams: ['Curaçao', 'Ecuador', 'Germany', 'Ivory Coast'] },
    { name: 'F', teams: ['Japan', 'Netherlands', 'Sweden', 'Tunisia'] },
    { name: 'G', teams: ['Belgium', 'Egypt', 'Iran', 'New Zealand'] },
    { name: 'H', teams: ['Cape Verde', 'Saudi Arabia', 'Spain', 'Uruguay'] },
    { name: 'I', teams: ['France', 'Iraq', 'Norway', 'Senegal'] },
    { name: 'J', teams: ['Algeria', 'Argentina', 'Austria', 'Jordan'] },
    { name: 'K', teams: ['Colombia', 'Congo DR', 'Portugal', 'Uzbekistan'] },
    { name: 'L', teams: ['Croatia', 'England', 'Ghana', 'Panama'] },
  ];

  // Load team name map from ratings.json
  let ratings = {};
  try {
    ratings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ratings.json'), 'utf8')).teams;
  } catch (e) { /* ignore */ }

  const groupInsert = db.transaction(() => {
    for (const g of groupData) {
      const groupId = insertGroup(g.name);
      for (const teamName of g.teams) {
        const rating = ratings[teamName] || {};
        insertStanding(groupId, teamName, rating.name || teamName);
      }
    }

    // Seed match schedule (simple round-robin for 7 match-days×6 groups × 2 matches per day = ~36 matches)
    const pairings = [
      [0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]
    ];
    
    for (const g of groupData) {
      const groupId = getGroup(g.name).id;
      let matchNum = 1;
      for (const [hIdx, aIdx] of [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]]) {
        insertMatch(groupId, g.teams[hIdx], g.teams[aIdx], matchNum);
        matchNum++;
      }
    }
  });

  groupInsert();
  return groupData.length;
};

// Groups API exposure
const groups = {
  initGroupsTables,
  insertGroup,
  insertStanding,
  insertMatch,
  getGroup,
  getAllGroups,
  getStandings,
  getGroupMatches,
  getFinishedMatches,
  seedRealGroups,
};

module.exports = { db, ...helpers, groups, saveRetrospectivePrediction, getRetrospectivePrediction, clearRetrospectivePredictions };
