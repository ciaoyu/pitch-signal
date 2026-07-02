/**
 * 世界杯轮次名归一化
 *
 * openfootball 数据集的轮次命名跨年份不统一（2010 用 "Quarterfinals"/
 * "Third-place play-off"，2022 用 "Quarter-finals"/"Match for third place"），
 * 这里统一成 data/history/worldcup_*.json 既有的规范词表：
 *   Group X / Round of 32 / Round of 16 / Quarter-finals / Semi-finals /
 *   Third place / Final / Final Round / First round
 *
 * 被 scripts/fetch-worldcup-history.js（转换时写入 stage 字段）和
 * lib/backtest.js（判断淘汰赛轮次）共用。
 */

/**
 * 归一化轮次名
 * @param {string} round - 原始轮次名（如 "Matchday 3"、"Quarterfinals"）
 * @param {string} [group] - 分组名（如 "Group A"、"Group 1"），小组赛时优先使用
 * @returns {string} 规范 stage 名
 */
function normalizeStage(round, group) {
  if (group) return group;
  const r = String(round || '').toLowerCase();

  if (/round of 32/.test(r)) return 'Round of 32';
  if (/round of 16|eighth.?finals?/.test(r)) return 'Round of 16';
  if (/quarter.?finals?/.test(r)) return 'Quarter-finals';
  if (/semi.?finals?/.test(r)) return 'Semi-finals';
  if (/third.?place|match for third/.test(r)) return 'Third place';
  // 1950 年决赛轮是 4 队单循环（"Final Round"），不是单场决赛
  if (/final round/.test(r)) return 'Final Round';
  if (/^finals?$/.test(r)) return 'Final';

  // 其余（Matchday N 无 group、First round、Preliminary round 等）原样保留
  return round || '';
}

/**
 * 从规范 stage 名判断淘汰赛轮次
 * 语义与 lib/backtest.js 原有内联逻辑一致：季军战按 SF 处理
 * @param {string} stage
 * @returns {{ isKnockout: boolean, knockoutRound: string|null }}
 */
function detectKnockout(stage) {
  const s = String(stage || '').toLowerCase();

  // "Final Round"（1950 循环赛）不是淘汰赛，需要先于 "final" 排除
  if (/final round/.test(s)) return { isKnockout: false, knockoutRound: null };

  if (/round of 32/.test(s)) return { isKnockout: true, knockoutRound: 'R32' };
  if (/round of 16/.test(s)) return { isKnockout: true, knockoutRound: 'R16' };
  if (/quarter.?finals?/.test(s)) return { isKnockout: true, knockoutRound: 'QF' };
  if (/semi.?finals?|third.?place/.test(s)) return { isKnockout: true, knockoutRound: 'SF' };
  if (/^finals?$/.test(s)) return { isKnockout: true, knockoutRound: 'F' };

  return { isKnockout: false, knockoutRound: null };
}

module.exports = { normalizeStage, detectKnockout };
