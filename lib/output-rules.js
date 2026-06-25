'use strict';

/**
 * 输出规则层 — 概率融合、AI 评分、竞品信号的"最强大脑"策略层
 *
 * 设计原则：
 *   - 不修改 PredictionEngine 的核心预测逻辑（纯加法 / 装饰器模式）
 *   - 只在 predictMatch 输出的最后一步调用，附加 outputMeta 字段
 *   - 所有外部信号（Polymarket / Pundit / 自动校准）当前处于禁用状态
 *   - 准确性声明以实测 walk-forward 指标为准，不展示旧 Brier 0.5516
 */

// ============================================================
// 1. 概率融合规则
// ============================================================

/**
 * 当前版本：单源输出（只有 PredictionEngine，外部源全禁用）
 * 将来启用外部源时，在此定义融合策略（加权平均、贝叶斯更新等）
 *
 * @param {object} primary   PredictionEngine 输出的概率 { homeWin, draw, awayWin }
 * @param {object|null} external   外部信号（Polymarket / Odds API 等）
 * @returns {{ homeWin, draw, awayWin, fusionStrategy, externalUsed }}
 */
function fuseProbabilities(primary, external = null) {
  // 外部信号当前恒为 null（Gate 1 闸门关闭）
  if (!external || process.env.POLYMARKET_ENABLED === 'true') {
    return {
      homeWin: primary.homeWin ?? primary.homeWinProb,
      draw:    primary.draw    ?? primary.drawProb,
      awayWin: primary.awayWin ?? primary.awayWinProb,
      fusionStrategy: 'single_source',
      externalUsed: false,
    };
  }

  // 预留：两源加权（将来需要 OOS 验证后才能开启权重）
  const W_PRIMARY  = 0.80;
  const W_EXTERNAL = 0.20;
  const h = primary.homeWin * W_PRIMARY + external.homeWin * W_EXTERNAL;
  const d = primary.draw    * W_PRIMARY + external.draw    * W_EXTERNAL;
  const a = primary.awayWin * W_PRIMARY + external.awayWin * W_EXTERNAL;
  const total = h + d + a;
  return {
    homeWin: Math.round((h / total) * 1000) / 1000,
    draw:    Math.round((d / total) * 1000) / 1000,
    awayWin: Math.round((a / total) * 1000) / 1000,
    fusionStrategy: 'weighted_avg_80_20',
    externalUsed: true,
  };
}

// ============================================================
// 2. AI 评分规则（置信度评分）
// ============================================================

/**
 * 基于内部信号质量生成 0-100 置信度分数。
 * 注意：这是"我们对自己预测有多确定"，不是"胜率有多高"。
 *
 * @param {object} result   PredictionEngine 完整输出
 * @returns {{ score, band, factors }}
 */
function scoreConfidence(result) {
  let score = 50; // 基础分
  const factors = [];

  // 信号覆盖：有几个组件
  const comps = result.components || {};
  const componentCount = Object.keys(comps).filter(k => comps[k] != null).length;
  score += Math.min(20, componentCount * 4);
  if (componentCount >= 3) factors.push('multi_signal');

  // Elo 差距明显（差 > 100 点）
  const eloDiff = Math.abs((comps.elo?.homeWin || 0) - (comps.elo?.awayWin || 0));
  if (eloDiff > 0.15) { score += 10; factors.push('elo_clear_edge'); }

  // 赔率一致（如果有）
  if (result.components?.odds) { score += 10; factors.push('odds_aligned'); }

  // Polymarket 关闭 → 外部验证缺失 → 扣分
  if (process.env.POLYMARKET_ENABLED !== 'true') { score -= 5; factors.push('no_market_signal'); }

  // 概率分布集中度（最大概率 > 50% → 更自信）
  const maxProb = Math.max(
    result.homeWin ?? 0,
    result.draw    ?? 0,
    result.awayWin ?? 0
  );
  if (maxProb > 0.55) { score += 5; factors.push('concentrated_prob'); }
  if (maxProb < 0.40) { score -= 5; factors.push('flat_prob'); }

  score = Math.max(10, Math.min(90, Math.round(score)));

  const band =
    score >= 70 ? 'high' :
    score >= 50 ? 'medium' : 'low';

  return { score, band, factors };
}

// ============================================================
// 3. 竞品信号处理（当前禁用占位）
// ============================================================

/**
 * 竞品信号汇总（Polymarket / 专家 Pundit / 自动校准）
 * Phase 3 接入真实数据后在此定义采纳规则。
 * 当前全部返回 null，不影响主预测。
 *
 * 规则草案（未来）：
 *   - Polymarket 只作参考展示，不进融合（OOS 验证前）
 *   - Pundit 共识 > 70% 可纳入 fuseProbabilities 的 external 参数（权重 0.10）
 *   - 自动校准调整幅度上限 ±5%，且需要 30 场 OOS 样本支撑
 */
function gatherExternalSignals(matchId) {
  return {
    polymarket: null,   // Gate 1: POLYMARKET_ENABLED=false
    pundit: null,       // 未接入
    autoCalibration: null, // 未接入
    _note: '外部信号当前全部禁用（公测 Beta 阶段）',
  };
}

// ============================================================
// 4. 准确性声明生成
// ============================================================

// 在受控公开 Beta 阶段，公测预测响应中不返回任何模型历史回测和聚合准确率指标（Brier/Accuracy）。
// 仅保留一个统一的静态安全提示文案。

// ============================================================
// 5. 完整输出规则应用（在 PredictionService 中调用）
// ============================================================

/**
 * 将输出规则层应用于 PredictionEngine 的原始输出。
 * 返回的对象直接附加到 API 响应（不改动 result 内部字段）。
 *
 * @param {object} result   PredictionEngine.predictWithAI() 的输出
 * @param {string} matchId
 * @returns {object} outputMeta - 附加到响应
 */
function applyOutputRules(result, matchId) {
  const externalSignals = gatherExternalSignals(matchId);
  const fusion = fuseProbabilities(result, null); // 外部信号当前为 null
  const confidence = scoreConfidence(result);
  const disclaimer = '实验性足球概率模型，非投注建议。';

  return {
    outputMeta: {
      fusion,
      confidence,
      externalSignals,
      accuracyDisclaimer: disclaimer,
      _gate: {
        polymarket: false,   // Gate 1: 已关闭
        pundit: false,       // 未接入
        autoCalibration: false, // 未接入
        aiProbabilityEdit: false, // AI 不改概率
      },
    },
  };
}

module.exports = {
  fuseProbabilities,
  scoreConfidence,
  gatherExternalSignals,
  applyOutputRules,
};
