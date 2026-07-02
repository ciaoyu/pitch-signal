'use strict';

const { db, getRetrospectivePrediction } = require('./db');
const fs = require('fs');
const path = require('path');

const REVIEW_SCHEMA_VERSION = 'post_match_review_v1';

// 赛后复盘 AI 归因的指令 + 输出契约(单一事实源,供 buildPostMatchReview 与批处理 worker 共用)
const AI_POSTMORTEM_INSTRUCTION = `As an AI Postmortem Assessor, analyze this match.

You MUST use Chain-of-Thought reasoning and strictly return a JSON object.

## CRITICAL RULE — null prediction
When the PREDICTION section is null or absent, there was no pre-match forecast to evaluate.
In that case you MUST NOT:
- claim the prediction was correct, accurate, or successful;
- use words like "correctly", "accurately", "rightly", "hit", "nailed", "命中", "预判准", or any synonym implying success;
- set failureCategory to a non-null value.

Instead: set failureCategory to null, leave whyRight/whyWrong empty, and explain in headline and processNotes that no pre-match prediction existed — so the match can only be described, not assessed for forecast accuracy. It is CORRECT to say the prediction is missing.

## CRITICAL RULE — retrospective prediction
When the PREDICTION has "predictionSource": "retrospective" or "_source": "retrospective", this is NOT a pre-match forecast. It is a post-match model simulation using current model parameters.
In that case you MUST:
- clearly state in headline and processNotes that this is a retrospective simulation, not a pre-match prediction;
- NOT evaluate it as if it were a real pre-match forecast;
- NOT use phrases like "our prediction" or "赛前预测" — use "retrospective simulation" or "赛后回溯模拟" instead;
- still analyze the model's output vs actual result, but frame it as "model calibration analysis" rather than "forecast accuracy".

## When a prediction IS provided (pre-match only)
Categorize the match outcome (if the prediction missed) into ONE of the following 7 categories:
1. Tactical Mismatch (e.g., heavily countered)
2. Missing Injury (e.g., pre-match star player injury we didn't know)
3. Missing Weather (e.g., heavy rain affecting playstyle)
4. Missing Referee Effect (e.g., strict referee altering game flow)
5. Missing Tactical Deception (e.g., fake lineups, unexpected formation)
6. Black Swan (e.g., early red card, bizarre own goal)
7. Statistical Variance (e.g., xG was high but just didn't finish)
You MUST extract 'teamSpecificLessons' (for the specific teams to use next match) and a 'globalModelLessons' (to tweak the math engine).

## Generating lessonsLearned — teamSpecificLessons and globalModelLessons

Your lessons MUST be grounded in observable match evidence, not generic football wisdom.
The examples below are illustrative only. Do NOT mention these teams or players unless they appear in the current match evidence.

### teamSpecificLessons
For each team, write 1-3 concrete, actionable observations drawn from THIS match. Prioritize:
- Score-state dynamics: did the team's behavior change after going ahead/behind/equalizing? (e.g. "After going 1-0 down at 46', Canada shifted to direct play and generated 4 shots on target in 20 minutes — the model should reprice comeback probability earlier when a trailing favorite stacks on-target shots.")
- Substitution impact: did a specific substitute change the match trajectory? (e.g. "Promise David scored 1 minute after coming on at 75' — late substitute introductions by trailing teams deserve a live probability bump.")
- Segment-level threat vs scoreboard gap: was there a period where shot quality/xG diverged from the scoreline? (e.g. "Switzerland had 70% possession but only 3 shots in 45 minutes while Canada hit the post twice — possession dominance without shot creation is a model weakness signal.")
- Set-piece / transition patterns: specific dead-ball or counter-attack patterns that the model underweighted.
- Fatigue / card accumulation effects: yellow cards forcing tactical changes, visible tiredness after 70'.

Do NOT write vague platitudes like "team needs to improve defense" or "attacking efficiency must increase." Every lesson must contain a specific minute range, statistic, or event reference.

### globalModelLessons
Write 1-2 observations about the prediction ENGINE (Elo, Poisson, live repricing logic) that this match exposed. These should be things the model could mechanically improve, not scouting opinions. Examples:
- "The live repricing model does not reprice when a trailing team accumulates 3+ on-target shots without scoring — it should, because sustained on-target pressure correlates with imminent goals."
- "Poisson xG-based final-score simulation underestimates comeback probability when the trailing team has >60% of second-half shots on target."
- "The model treats all goals equally — it should weight goals scored in the 75-90' window as more match-defining than early goals because less time remains for the opponent to respond."

Do NOT repeat failureCategory explanations in globalModel. failureCategory describes WHY the prediction was wrong; globalModel describes HOW the model should change to be less wrong next time.

### Live-analysis integration (when live snapshots are available)
If the review contains a 'momentum' field with 15-minute buckets or live snapshots, use that data:
- Reference specific 15-minute windows where momentum shifted (e.g. "45-60' window: Canada generated 4 shots to Switzerland's 1 — this was the structural precursor to the 76' goal.")
- Identify "pre-scoreline" danger signals: shots on target accumulation, corner surges, substitution patterns that preceded goals.
- Note when the live model should have repriced BEFORE the goal happened, not after.

### Human real-time analysis (evidence.humanNotes)
If evidence.humanNotes is present, it is a first-hand real-time match report written by a human analyst who watched the match live. Treat it as your MOST reliable source — more reliable than generic commentary or news — and ground whyRight/whyWrong/lessonsLearned in its specific observations (turning points, tactical patterns, player performances) instead of restating generic commentary.

### Known recurring patterns (evidence.knownPatterns)
If evidence.knownPatterns is present, it is a library of signal patterns a human analyst has distilled from watching many matches in this tournament (e.g. hydration-break → substitution → goal within 1-3 minutes; the shot/corner/possession escalation sequence a trailing team shows as they build pressure; sustained pressure-index surges without a goal). Check whether THIS match's evidence matches one of these known patterns. If it does, name the pattern explicitly in your analysis instead of describing the same phenomenon generically — this is how the model's pattern library gets validated and reinforced across matches. If none apply, don't force a match.

LANGUAGE: Every user-facing field MUST be provided in BOTH Simplified Chinese (zh) and English (en) via the bilingual *I18n fields in the schema (headlineI18n, whyRightI18n, whyWrongI18n, processNotesI18n). The zh text must read as natural, native Chinese football analysis — not a word-for-word translation of the English.`;

const AI_POSTMORTEM_OUTPUT_FORMAT = {
  "failureCategory": "Tactical Mismatch | Missing Injury | Missing Weather | Missing Referee Effect | Missing Tactical Deception | Black Swan | Statistical Variance | null (if prediction was correct)",
  "lessonsLearned": {
    "teamSpecific": {
      "HOME_TEAM_NAME": "string",
      "AWAY_TEAM_NAME": "string"
    },
    "globalModel": "string"
  },
  "headlineI18n": { "zh": "string", "en": "string" },
  "whyRightI18n": { "zh": ["string"], "en": ["string"] },
  "whyWrongI18n": { "zh": ["string"], "en": ["string"] },
  "processNotesI18n": { "zh": ["string"], "en": ["string"] },
  "expertCommentaryNotes": ["string"]
};

function roundPct(value) {
  return Math.round((Number(value) || 0) * 1000) / 10;
}

function parseScore(score) {
  const [home, away] = String(score || '').split('-').map((n) => Number.parseInt(n, 10));
  return {
    home: Number.isFinite(home) ? home : null,
    away: Number.isFinite(away) ? away : null,
  };
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function predictedResultFromSnapshot(snapshot) {
  if (!snapshot) return null;
  const homeWin = Number(snapshot.homeWin ?? snapshot.home_win_prob ?? 0);
  const draw = Number(snapshot.draw ?? snapshot.draw_prob ?? 0);
  const awayWin = Number(snapshot.awayWin ?? snapshot.away_win_prob ?? 0);
  if (homeWin > draw && homeWin > awayWin) return 'home';
  if (awayWin > draw && awayWin > homeWin) return 'away';
  return 'draw';
}

function actualResult(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

function normalizeScore(value, label) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return score;
}

function resultLabel(result, homeName, awayName) {
  if (result === 'home') return `${homeName}胜`;
  if (result === 'away') return `${awayName}胜`;
  if (result === 'draw') return '平局';
  return '未知';
}

function i18n(zh, en) {
  return { zh, en };
}

function resultLabelI18n(result, homeName, awayName) {
  if (result === 'home') return i18n(`${homeName}胜`, `${homeName} win`);
  if (result === 'away') return i18n(`${awayName}胜`, `${awayName} win`);
  if (result === 'draw') return i18n('平局', 'draw');
  return i18n('未知', 'unknown');
}

function normalizeSnapshot(row) {
  if (!row) return null;
  const payload = safeJsonParse(row.payload_json, {});
  return {
    id: row.id,
    matchId: row.match_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    predictedScore: row.predicted_score,
    homeWin: row.home_win_prob,
    draw: row.draw_prob,
    awayWin: row.away_win_prob,
    homeExpectedGoals: row.home_expected_goals,
    awayExpectedGoals: row.away_expected_goals,
    source: row.source,
    createdAt: row.created_at,
    payload,
  };
}

function getScheduledKickoff(matchId) {
  try {
    // T07: 尊重DATA_PATH环境变量，使用运行时数据目录
    const dataDir = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
    const schedulePath = path.join(dataDir, 'match_snapshot_schedule.json');
    const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    return schedule.matches?.find((match) => String(match.matchId) === String(matchId))?.kickoffUtc || null;
  } catch {
    return null;
  }
}

function savePredictionSnapshot(matchId, prediction, options = {}) {
  if (!matchId || !prediction || prediction.error) return null;

  const kickoffUtc = getScheduledKickoff(matchId);
  const snapshotAt = Date.parse(options.createdAt || new Date().toISOString());
  if (kickoffUtc && Number.isFinite(snapshotAt) && snapshotAt >= Date.parse(kickoffUtc)) {
    return null;
  }

  const match = prediction.match || {};
  const now = options.createdAt || new Date().toISOString();
  const existing = db.prepare(`
    SELECT * FROM prediction_snapshots
    WHERE match_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(String(matchId));

  if (existing) return normalizeSnapshot(existing);

  const payload = JSON.stringify(prediction);
  const values = [
    String(matchId),
    match.homeId || options.homeTeamId || null,
    match.awayId || options.awayTeamId || null,
    match.homeName || options.homeTeamName || null,
    match.awayName || options.awayTeamName || null,
    prediction.likelyScore || null,
    prediction.homeWin ?? null,
    prediction.draw ?? null,
    prediction.awayWin ?? null,
    prediction.goals?.homeExpected ?? null,
    prediction.goals?.awayExpected ?? null,
    payload,
    options.source || 'prediction-route',
    now,
  ];

  const result = db.prepare(`
    INSERT INTO prediction_snapshots (
      match_id, home_team_id, away_team_id, home_team_name, away_team_name,
      predicted_score, home_win_prob, draw_prob, away_win_prob,
      home_expected_goals, away_expected_goals, payload_json, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(...values);

  return normalizeSnapshot(db.prepare('SELECT * FROM prediction_snapshots WHERE id = ?').get(result.lastInsertRowid));
}

function getPredictionSnapshot(matchId) {
  return normalizeSnapshot(db.prepare(`
    SELECT * FROM prediction_snapshots
    WHERE match_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(String(matchId)));
}

// 实盘复盘笔记(docs/MATCH_DAY_REPORTS.md)按主客队名双重匹配注入 evidence，
// 供 AI 复盘参考人工第一手观察，而不是只有 ESPN 文字直播。惰性加载+缓存，找不到就返回 null。
let _matchDayReportSections = null;

function loadMatchDayReportSections() {
  if (_matchDayReportSections) return _matchDayReportSections;
  const sections = [];
  try {
    const filePath = path.join(__dirname, '..', 'docs', 'MATCH_DAY_REPORTS.md');
    const raw = fs.readFileSync(filePath, 'utf8');
    let title = null;
    let lines = [];
    for (const line of raw.split('\n')) {
      const h2 = line.match(/^##\s+(.+)/);
      if (h2) {
        if (title) sections.push({ title, content: lines.join('\n').trim() });
        title = h2[1].trim();
        lines = [];
      } else if (title) {
        lines.push(line);
      }
    }
    if (title) sections.push({ title, content: lines.join('\n').trim() });
  } catch {
    // 文件不存在也不影响复盘生成，静默降级
  }
  _matchDayReportSections = sections;
  return _matchDayReportSections;
}

// getTeamNameZh() 返回 "西班牙 Spain" 这种 "中文 英文" 拼接形式；
// docs/MATCH_DAY_REPORTS.md 里只写纯中文队名，所以匹配前先取空格前的中文部分。
function zhTeamName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

const SCORE_LINE_RE = /\d+\s*[:\-]\s*\d+/;

function getMatchDayReportNote(homeName, awayName) {
  const home = zhTeamName(homeName);
  const away = zhTeamName(awayName);
  if (!home || !away) return null;
  // 要求主客队名 + 比分同现在同一行(标题，或结果表格行)——
  // 多场次汇总节(如"比赛日回顾：...")在同一节里会提到当天所有球队，散文叙述段落
  // 经常把好几场比赛、好几个数字(比分/出场次数/年龄...)写在同一段里，仅"同行+
  // 有数字"仍会把没有交手的球队误配在一起(如同段提到瑞士、加拿大、卡塔尔、波黑，
  // 却只有瑞士vs加拿大、波黑vs卡塔尔是真实对阵)。所以多场汇总节只信表格行(以 | 开头)，
  // 不信散文段落；单场"实盘复盘"类小节标题本身就唯一对应一场比赛，直接信整节内容。
  const TABLE_ROW_RE = /^\s*\|/;
  const hits = loadMatchDayReportSections().filter((s) => {
    if (s.title.includes(home) && s.title.includes(away) && SCORE_LINE_RE.test(s.title)) return true;
    return s.content
      .split('\n')
      .some((line) => TABLE_ROW_RE.test(line) && line.includes(home) && line.includes(away) && SCORE_LINE_RE.test(line));
  });
  if (!hits.length) return null;
  return hits.map((s) => `【${s.title}】\n${s.content}`).join('\n\n---\n\n');
}

// "战术规律：..." 开头的节是从多场比赛里归纳出的通用信号模式(换人后立即进球、
// 追分压力曲线、高压未进球告警等)，不针对某一场具体比赛，所以不做队名匹配——
// 每一场复盘都应该带着这份"已知模式清单"去对照，而不是只有恰好写过复盘的那几场才有。
let _generalPatternNotes;

function getGeneralPatternNotes() {
  if (_generalPatternNotes !== undefined) return _generalPatternNotes;
  const hits = loadMatchDayReportSections().filter((s) => s.title.startsWith('战术规律'));
  _generalPatternNotes = hits.length ? hits.map((s) => `【${s.title}】\n${s.content}`).join('\n\n---\n\n') : null;
  return _generalPatternNotes;
}

function summarizeEvidence(evidence = {}) {
  // Filter for high impact events to save tokens and focus Gemini
  const impactTypes = ['goal', 'card', 'substitution', 'injury', 'var'];
  const events = Array.isArray(evidence.events) 
    ? evidence.events.filter(e => e && impactTypes.includes(String(e.type || '').toLowerCase())).slice(0, 20) 
    : [];
  const news = Array.isArray(evidence.news) ? evidence.news.filter(Boolean).slice(0, 8) : [];
  const commentary = Array.isArray(evidence.commentary) ? evidence.commentary.filter(Boolean).slice(0, 12) : [];

  return {
    events,
    news: news.map((item) => ({
      title: item.title || item.headline || '',
      titleI18n: item.titleI18n || item.headlineI18n || null,
      summary: item.summary || item.description || item.content || '',
      summaryI18n: item.summaryI18n || item.descriptionI18n || item.contentI18n || null,
      contentI18n: item.contentI18n || null,
      source: item.source || '',
      sourceI18n: item.sourceI18n || null,
      importance: item.importance || '',
      type: item.type || '',
      url: item.url || '',
      publishedAt: item.publishedAt || item.published_at || '',
      tags: item.tags || [],
      translatedBy: item.translatedBy || null,
      translatedAt: item.translatedAt || null,
    })),
    commentary,
    hasExternalOpinion: news.length > 0 || commentary.length > 0,
  };
}

function buildPostMatchReview(input) {
  const {
    matchId,
    match,
    snapshot: preMatchSnapshot = getPredictionSnapshot(matchId),
    evidence = {},
    generatedBy = 'framework',
  } = input;

  // 当没有赛前快照时，回退到 retrospective_predictions 表
  let snapshot = preMatchSnapshot;
  let predictionSource = 'pre_match';
  let predictionSnapshotNote = null;

  if (!snapshot) {
    const retro = getRetrospectivePrediction(matchId);
    if (retro) {
      // 将 retrospective 预测转换为 snapshot 兼容格式
      snapshot = {
        matchId: String(matchId),
        homeTeamId: retro.match?.homeId || null,
        awayTeamId: retro.match?.awayId || null,
        homeTeamName: retro.match?.homeName || null,
        awayTeamName: retro.match?.awayName || null,
        predictedScore: retro.likelyScore || null,
        homeWin: retro.homeWin ?? null,
        draw: retro.draw ?? null,
        awayWin: retro.awayWin ?? null,
        homeExpectedGoals: retro.goals?.homeExpected ?? null,
        awayExpectedGoals: retro.goals?.awayExpected ?? null,
        source: 'retrospective',
        createdAt: retro._retrospectiveGeneratedAt || null,
        payload: retro,
      };
      predictionSource = 'retrospective';
      predictionSnapshotNote = i18n(
        '⚠️ 本预测为赛后当前模型回溯模拟（非赛前快照），仅供复盘分析参考，不代表赛前预测能力。',
        '⚠️ This is a post-match retrospective model simulation (NOT a pre-match snapshot), for post-match analysis reference only — it does not represent pre-match forecasting ability.'
      );
    }
  }

  const homeName = match.homeName || snapshot?.homeTeamName || match.homeId || 'Home';
  const awayName = match.awayName || snapshot?.awayTeamName || match.awayId || 'Away';
  const homeScore = normalizeScore(match.homeScore, 'homeScore');
  const awayScore = normalizeScore(match.awayScore, 'awayScore');
  const predictedScore = parseScore(snapshot?.predictedScore);
  const predictedResult = predictedResultFromSnapshot(snapshot);
  const actual = actualResult(homeScore, awayScore);
  const resultCorrect = predictedResult === actual;
  const scoreExact = predictedScore.home === homeScore && predictedScore.away === awayScore;
  const homeGoalError = predictedScore.home == null ? null : homeScore - predictedScore.home;
  const awayGoalError = predictedScore.away == null ? null : awayScore - predictedScore.away;
  const xgHomeError = snapshot?.homeExpectedGoals == null ? null : Math.round((homeScore - snapshot.homeExpectedGoals) * 10) / 10;
  const xgAwayError = snapshot?.awayExpectedGoals == null ? null : Math.round((awayScore - snapshot.awayExpectedGoals) * 10) / 10;
  const normalizedEvidence = summarizeEvidence(evidence);
  const humanNotes = getMatchDayReportNote(homeName, awayName);
  if (humanNotes) normalizedEvidence.humanNotes = humanNotes;
  const knownPatterns = getGeneralPatternNotes();
  if (knownPatterns) normalizedEvidence.knownPatterns = knownPatterns;

  const factors = [];
  if (!snapshot) {
    factors.push({
      key: 'missing_pre_match_snapshot',
      factor: '缺少赛前快照',
      factorI18n: i18n('缺少赛前快照', 'Missing pre-match snapshot'),
      impact: 'high',
      detail: '没有找到赛前预测快照，只能生成赛后占位复盘。',
      detailI18n: i18n('没有找到赛前预测快照，只能生成赛后占位复盘。', 'No pre-match prediction snapshot was found, so only a placeholder post-match review can be generated.'),
    });
  } else if (predictionSource === 'retrospective') {
    // retrospective prediction exists but note it explicitly
    if (!resultCorrect) {
      const predictedLabel = resultLabelI18n(predictedResult, homeName, awayName);
      const actualLabel = resultLabelI18n(actual, homeName, awayName);
      factors.push({
        key: 'retrospective_result_miss',
        factor: '赛后回溯模拟方向偏差',
        factorI18n: i18n('赛后回溯模拟方向偏差', 'Retrospective simulation result miss'),
        impact: 'medium',
        detail: `赛后回溯模拟倾向 ${resultLabel(predictedResult, homeName, awayName)}，实际为 ${resultLabel(actual, homeName, awayName)}（注意：非赛前预测）`,
        detailI18n: i18n(`赛后回溯模拟倾向 ${predictedLabel.zh}，实际为 ${actualLabel.zh}（注意：非赛前预测）`, `Retrospective simulation leaned ${predictedLabel.en}, actual was ${actualLabel.en} (note: not a pre-match forecast)`),
      });
    }
  } else if (!resultCorrect) {
    const predictedLabel = resultLabelI18n(predictedResult, homeName, awayName);
    const actualLabel = resultLabelI18n(actual, homeName, awayName);
    factors.push({
      key: 'result_direction_miss',
      factor: '赛果方向偏差',
      factorI18n: i18n('赛果方向偏差', 'Result direction miss'),
      impact: 'high',
      detail: `赛前倾向 ${resultLabel(predictedResult, homeName, awayName)}，实际为 ${resultLabel(actual, homeName, awayName)}。`,
      detailI18n: i18n(`赛前倾向 ${predictedLabel.zh}，实际为 ${actualLabel.zh}。`, `The pre-match lean was ${predictedLabel.en}, but the actual result was ${actualLabel.en}.`),
    });
  } else if (!scoreExact) {
    factors.push({
      key: 'scoreline_detail_miss',
      factor: '比分细节偏差',
      factorI18n: i18n('比分细节偏差', 'Scoreline detail miss'),
      impact: 'medium',
      detail: `赛果方向正确，但预测比分 ${snapshot.predictedScore || '?-?'} 与实际 ${homeScore}-${awayScore} 不一致。`,
      detailI18n: i18n(`赛果方向正确，但预测比分 ${snapshot.predictedScore || '?-?'} 与实际 ${homeScore}-${awayScore} 不一致。`, `The result direction was correct, but the predicted score ${snapshot.predictedScore || '?-?'} differed from the actual ${homeScore}-${awayScore}.`),
    });
  }

  if (xgHomeError != null && Math.abs(xgHomeError) >= 1.2) {
    factors.push({
      key: 'home_expected_goal_error',
      factor: `${homeName}进球表现偏离`,
      factorI18n: i18n(`${homeName}进球表现偏离`, `${homeName} goal output variance`),
      impact: Math.abs(xgHomeError) >= 2 ? 'high' : 'medium',
      detail: `${homeName}实际 ${homeScore} 球，赛前期望 ${snapshot.homeExpectedGoals} 球，偏差 ${xgHomeError > 0 ? '+' : ''}${xgHomeError}。`,
      detailI18n: i18n(`${homeName}实际 ${homeScore} 球，赛前期望 ${snapshot.homeExpectedGoals} 球，偏差 ${xgHomeError > 0 ? '+' : ''}${xgHomeError}。`, `${homeName} scored ${homeScore}; pre-match expected goals were ${snapshot.homeExpectedGoals}, a variance of ${xgHomeError > 0 ? '+' : ''}${xgHomeError}.`),
    });
  }
  if (xgAwayError != null && Math.abs(xgAwayError) >= 1.2) {
    factors.push({
      key: 'away_expected_goal_error',
      factor: `${awayName}进球表现偏离`,
      factorI18n: i18n(`${awayName}进球表现偏离`, `${awayName} goal output variance`),
      impact: Math.abs(xgAwayError) >= 2 ? 'high' : 'medium',
      detail: `${awayName}实际 ${awayScore} 球，赛前期望 ${snapshot.awayExpectedGoals} 球，偏差 ${xgAwayError > 0 ? '+' : ''}${xgAwayError}。`,
      detailI18n: i18n(`${awayName}实际 ${awayScore} 球，赛前期望 ${snapshot.awayExpectedGoals} 球，偏差 ${xgAwayError > 0 ? '+' : ''}${xgAwayError}。`, `${awayName} scored ${awayScore}; pre-match expected goals were ${snapshot.awayExpectedGoals}, a variance of ${xgAwayError > 0 ? '+' : ''}${xgAwayError}.`),
    });
  }

  const isRetro = predictionSource === 'retrospective';
  const accuracy = scoreExact ? 'exact_score' : resultCorrect ? 'result_correct_score_wrong' : 'wrong_result';
  const summary = scoreExact
    ? (isRetro ? '赛后回溯模拟命中精确比分，模型判断和比赛走势高度吻合。' : '赛前预测命中精确比分，模型判断和比赛走势高度吻合。')
    : resultCorrect
      ? (isRetro ? '赛后回溯模拟命中赛果方向，但比分和过程仍需要结合比赛事件解释。' : '赛前预测命中赛果方向，但比分和过程仍需要结合比赛事件解释。')
      : (isRetro ? '赛后回溯模拟未命中赛果方向，需要结合临场事件、阵容变化和舆论信息解释偏差。' : '赛前预测未命中赛果方向，需要结合临场事件、阵容变化和舆论信息解释偏差。');
  const summaryI18n = scoreExact
    ? i18n(summary, isRetro ? 'The retrospective simulation hit the exact score, and the model aligned closely with the match flow.' : 'The pre-match forecast hit the exact score, and the model aligned closely with the match flow.')
    : resultCorrect
      ? i18n(summary, isRetro ? 'The retrospective simulation got the result direction right, but the scoreline and process still need match-event context.' : 'The pre-match forecast got the result direction right, but the scoreline and process still need match-event context.')
      : i18n(summary, isRetro ? 'The retrospective simulation missed the result direction and needs match events, lineup changes, and commentary to explain the variance.' : 'The pre-match forecast missed the result direction and needs match events, lineup changes, and commentary to explain the variance.');
  const matchTypeI18n = scoreExact
    ? i18n('精准命中', 'Exact hit')
    : resultCorrect
      ? i18n('方向命中', 'Direction hit')
      : i18n('预测偏差', 'Forecast miss');
  const overview = `${homeName} ${homeScore}-${awayScore} ${awayName}。${summary}`;

  const review = {
    matchId: String(matchId),
    schemaVersion: REVIEW_SCHEMA_VERSION,
    status: match.completed ? 'ready_for_ai' : 'pending_final',
    generatedBy,
    generatedAt: new Date().toISOString(),
    predictionSource,
    predictionSnapshotNote,
    match: {
      home: { id: match.homeId || snapshot?.homeTeamId, name: homeName, score: homeScore },
      away: { id: match.awayId || snapshot?.awayTeamId, name: awayName, score: awayScore },
      homeName,
      awayName,
      homeScore,
      awayScore,
      status: match.status || '',
      date: match.date || '',
      venue: match.venue || '',
      result: actual,
    },
    predictionSnapshot: snapshot,
    aiPrediction: snapshot ? {
      homeWin: roundPct(snapshot.homeWin),
      draw: roundPct(snapshot.draw),
      awayWin: roundPct(snapshot.awayWin),
      predictedScore: snapshot.predictedScore,
      homeExpectedGoals: snapshot.homeExpectedGoals,
      awayExpectedGoals: snapshot.awayExpectedGoals,
      createdAt: snapshot.createdAt,
    } : null,
    matchSummary: {
      matchTypeKey: scoreExact ? 'exact_score' : resultCorrect ? 'direction_hit' : 'forecast_miss',
      matchType: matchTypeI18n.zh,
      matchTypeI18n,
      overview,
      overviewI18n: i18n(overview, `${homeName} ${homeScore}-${awayScore} ${awayName}. ${summaryI18n.en}`),
      upsetText: '',
      upsetTextI18n: null,
    },
    biasAnalysis: {
      predictedResult,
      actualResult: actual,
      resultCorrect,
      scoreExact,
      accuracy,
      summary,
      summaryI18n,
      homeGoalError,
      awayGoalError,
      expectedGoalError: { home: xgHomeError, away: xgAwayError },
      predictedConfidence: snapshot ? roundPct(Math.max(snapshot.homeWin || 0, snapshot.draw || 0, snapshot.awayWin || 0)) : 0,
      factors,
    },
    evidence: normalizedEvidence,
    aiPostmortem: {
      status: 'pending_provider',
      failureCategory: null,
      lessonsLearned: {
        teamSpecific: {}, // e.g. { "ARG": "...", "KSA": "..." }
        globalModel: null // e.g. "Adjust knockout defense shrinkage"
      },
      headlineI18n: { zh: '', en: '' },
      whyRightI18n: { zh: [], en: [] },
      whyWrongI18n: { zh: [], en: [] },
      processNotesI18n: { zh: [], en: [] },
      expertCommentaryNotes: [],
      promptVersion: REVIEW_SCHEMA_VERSION,
    },
    aiPromptContext: {
      instruction: AI_POSTMORTEM_INSTRUCTION,
      match: { homeName, awayName, homeScore, awayScore },
      prediction: snapshot,
      evidence: normalizedEvidence,
      requiredOutputFormat: AI_POSTMORTEM_OUTPUT_FORMAT,
    },
  };

  return review;
}

function scoresMatch(review, match) {
  if (!review?.match || !match) return false;
  return Number(review.match.homeScore) === Number(match.homeScore)
    && Number(review.match.awayScore) === Number(match.awayScore);
}

function shouldUseSavedPostMatchReview(review, match) {
  if (!review) return false;
  if (review.schemaVersion !== REVIEW_SCHEMA_VERSION) return false;
  if (review.status === 'pending_final') return false;
  if (match?.completed && !scoresMatch(review, match)) return false;
  // 若旧 review 没有预测（无快照无回溯），但现在 retrospective_predictions 表有了数据，应重新生成
  if (!review.predictionSnapshot && !review.aiPrediction) {
    const retro = getRetrospectivePrediction(review.matchId);
    if (retro) return false; // 有新的回溯预测，需重新生成
  }
  return true;
}

function savePostMatchReview(matchId, review) {
  const now = new Date().toISOString();
  const snapshotId = review.predictionSnapshot?.id || null;
  const stmt = db.prepare(`
    INSERT INTO post_match_reviews (
      match_id, prediction_snapshot_id, actual_home_score, actual_away_score,
      review_json, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(match_id) DO UPDATE SET
      prediction_snapshot_id = excluded.prediction_snapshot_id,
      actual_home_score = excluded.actual_home_score,
      actual_away_score = excluded.actual_away_score,
      review_json = excluded.review_json,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  const args = [
    String(matchId),
    snapshotId,
    review.match?.homeScore ?? null,
    review.match?.awayScore ?? null,
    JSON.stringify(review),
    review.status || 'draft',
    now,
    now,
  ];
  try {
    stmt.run(...args);
  } catch (e) {
    if (e.message?.includes('FOREIGN KEY')) {
      // Snapshot reference is stale — retry with null FK
      args[1] = null;
      stmt.run(...args);
    } else {
      throw e;
    }
  }
  return review;
}

function getSavedPostMatchReview(matchId) {
  const row = db.prepare('SELECT * FROM post_match_reviews WHERE match_id = ?').get(String(matchId));
  if (!row) return null;
  return safeJsonParse(row.review_json, null);
}

module.exports = {
  REVIEW_SCHEMA_VERSION,
  AI_POSTMORTEM_INSTRUCTION,
  AI_POSTMORTEM_OUTPUT_FORMAT,
  savePredictionSnapshot,
  getPredictionSnapshot,
  buildPostMatchReview,
  savePostMatchReview,
  getSavedPostMatchReview,
  shouldUseSavedPostMatchReview,
  getMatchDayReportNote,
  getGeneralPatternNotes,
};
