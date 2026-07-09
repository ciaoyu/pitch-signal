/**
 * Knockout Tactical Scenarios Library (KO-14)
 *
 * Expands knockout match simulation scenarios (8-10 bilingual scenarios across match phases).
 * Dynamically matches top 3 scenarios based on team style tags (KO-12) and penalty shoot-out skills.
 * Falls back gracefully to default top 3 scenarios when no intelligence card or tags are available.
 */
(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.WorldCup = root.WorldCup || {};
    root.WorldCup.TacticalScenarios = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  const KNOCKOUT_SCENARIOS = [
    {
      id: 'draw_90',
      phase: '90m_draw',
      priority: 10,
      tags: ['possession', 'default'],
      title: {
        zh: '常规时间 90 分钟平局局势',
        en: '90-Minute Regulation Draw Scenario'
      },
      condition: {
        zh: '若双方在 90 分钟常规时间内无法分出胜负进入加时',
        en: 'If regulation ends in a draw forcing extra time'
      },
      deduction: {
        zh: '体能储备更有优势且板凳深度充裕的一方将在加时赛掌管比赛节奏，控球方需警惕因前压导致的防线漏洞',
        en: 'The team with superior stamina and bench depth will dictate extra time pace; possession side must guard against counter-attacks'
      }
    },
    {
      id: 'et_behind',
      phase: 'et_trailing',
      priority: 9,
      tags: ['low_block', 'counter_fast', 'default'],
      title: {
        zh: '加时赛先失球强攻反扑',
        en: 'Extra Time Trailing & Counter-Push'
      },
      condition: {
        zh: '若一方在加时赛上半场比分落后',
        en: 'If a team falls behind in the first half of extra time'
      },
      deduction: {
        zh: '落后方被迫放弃稳守策略全线压上，防反极速型球队有望利用身后巨大空挡完成致命锁定',
        en: 'Trailing team is forced to abandon low block; counter-attack specialists can exploit exposed spaces to seal the match'
      }
    },
    {
      id: 'penalty_fatigue',
      phase: 'penalty_prep',
      priority: 8,
      tags: ['penalty', 'default'],
      title: {
        zh: '点球大战前体能与心理心理博弈',
        en: 'Penalty Shootout Stamina & Nerves'
      },
      condition: {
        zh: '若 120 分钟鏖战未决胜负进入点球大战',
        en: 'If 120 minutes fail to separate sides heading to penalties'
      },
      deduction: {
        zh: '门将扑救成功率及主罚队员在极度疲劳下的射门稳定性成为决定晋级归属的核心钥匙',
        en: 'Goalkeeper save percentage and penalty taker poise under extreme fatigue become decisive'
      }
    },
    {
      id: 'et_red_card',
      phase: 'et_disadvantage',
      priority: 7,
      tags: ['high_press'],
      title: {
        zh: '加时赛少打一人收缩防线',
        en: 'Extra Time 10-Man Low Block Defense'
      },
      condition: {
        zh: '若一方在加时赛遭遇红牌减员',
        en: 'If a team suffers a red card dismissal during extra time'
      },
      deduction: {
        zh: '10 人被动方将转为禁区低位密集防守，多打一人方需通过肋部连续穿插和二次进攻破局',
        en: '10-man side drops into tight penalty-box low block; numerical advantage side must overload half-spaces to break through'
      }
    },
    {
      id: 'low_block_break',
      phase: 'regulation',
      priority: 6,
      tags: ['low_block', 'possession'],
      title: {
        zh: '面对密集防守攻坚推演',
        en: 'Breaking the Low Block Siege'
      },
      condition: {
        zh: '控球方长时间面对 5 后卫低位防线且未能首开纪录',
        en: 'Possession side facing a deep 5-man defense without early opener'
      },
      deduction: {
        zh: '比赛进入下半场后，禁区外定位球及两翼下底倒三角传中将是打破死局的最关键选择',
        en: 'In the second half, set-pieces outside the box and cutbacks from flanks become vital keys to breaking the deadlock'
      }
    },
    {
      id: 'high_press_fatigue',
      phase: 'late_regulation',
      priority: 5,
      tags: ['high_press'],
      title: {
        zh: '高位逼抢队 70 分钟后体能拐点',
        en: 'High-Press 70th-Minute Fitness Pivot'
      },
      condition: {
        zh: '采用持续高位逼抢队在比赛最后 20 分钟体能下滑',
        en: 'High-pressing unit experiencing stamina drop in final 20 minutes'
      },
      deduction: {
        zh: '对手可利用其前中后三条线脱节造成的腹地空间，实施换人爆点针对性冲击',
        en: 'Opponent can exploit disconnected midfield-defense gaps with impact sub runners'
      }
    },
    {
      id: 'counter_speed_trap',
      phase: 'transition',
      priority: 6,
      tags: ['counter_fast'],
      title: {
        zh: '反击决胜边路直插局势',
        en: 'Counter-Attack Flank Breakout Scenario'
      },
      condition: {
        zh: '压上进攻方丢球后瞬间进入防守过渡阶段',
        en: 'Attacking side losing possession during defensive transition'
      },
      deduction: {
        zh: '拥有极速边路快马的球队将在攻守转换的 6 秒窗内创造绝佳面对门将单挑机会',
        en: 'Side with elite flank speed will generate 1v1 chances within a 6-second transition window'
      }
    },
    {
      id: 'late_set_piece',
      phase: 'clutch_time',
      priority: 5,
      tags: ['crossing'],
      title: {
        zh: '补时定点绝杀角球/任意球',
        en: 'Stoppage Time Set-Piece Decider'
      },
      condition: {
        zh: '比分咬紧进入全场补时阶段赢得禁区边缘定位球或角球',
        en: 'Close match in stoppage time earning late corner or danger-zone free kick'
      },
      deduction: {
        zh: '拥有高空争顶制空权及精湛传中主罚手的球队争夺战局的主动终结概率提升',
        en: 'Team with aerial dominance and elite delivery specialist gains elevated match-ending probability'
      }
    },
    {
      id: 'penalty_specialist_edge',
      phase: 'penalty_shootout',
      priority: 6,
      tags: ['penalty'],
      title: {
        zh: '点球大战历史心理心理压制',
        en: 'Penalty Shootout Historical Pedigree'
      },
      condition: {
        zh: '两队历史点球胜率差异显著，进入点球大局后',
        en: 'Teams with contrasting shootout history enter penalties'
      },
      deduction: {
        zh: '点球经验丰富的大赛强队将在罚球心理和门将预判干扰上占据压倒性上风',
        en: 'Experienced tournament side holds strong psychological and goalkeeper gamesmanship advantage'
      }
    }
  ];

  /**
   * Retrieves relevant tactical scenarios sorted by relevance score, capped at `limit` (default 3).
   * Works with or without knockoutIntel / style tags (graceful fallback).
   */
  function getRelevantScenarios({ homeTags = [], awayTags = [], penaltySkill = {}, limit = 3 } = {}) {
    const allTags = new Set([...homeTags, ...awayTags]);
    if (penaltySkill.home || penaltySkill.away) {
      allTags.add('penalty');
    }

    const scored = KNOCKOUT_SCENARIOS.map(sc => {
      let score = sc.priority || 0;
      for (const tag of sc.tags) {
        if (allTags.has(tag)) {
          score += 15;
        }
      }
      return { scenario: sc, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(item => item.scenario);
  }

  return {
    KNOCKOUT_SCENARIOS,
    getRelevantScenarios,
  };
});
