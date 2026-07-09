/**
 * Key Match Events bilingual translation and importance filtering service.
 * Supports English -> Chinese translation for match commentary and structured event items.
 */

function translateFootballCommentaryToZh(text) {
  if (!text) return '';
  if (/[\u4e00-\u9fa5]/.test(text)) return text;
  let zh = text;

  const penaltyConcededMatch = zh.match(/Penalty conceded by\s+([^,.]+)(?:[\s\S]*)/i);
  if (penaltyConcededMatch) {
    return `点球判罚：${penaltyConcededMatch[1].trim()} 禁区内犯规送出点球。`;
  }

  const penaltyDrawsMatch = zh.match(/Penalty\s+([^,.]+)\.\s*([^,.]+)\s+draws a foul in the penalty area\.?/i);
  if (penaltyDrawsMatch) {
    return `${penaltyDrawsMatch[1].trim()} 获得点球：${penaltyDrawsMatch[2].trim()} 在禁区内造点成功。`;
  }

  const varPenaltyMatch = zh.match(/VAR Decision:\s*Penalty(?:\s+for)?\s*([^.,]+)\.?/i);
  if (varPenaltyMatch) {
    return `VAR 视频助理裁判判罚：确认 ${varPenaltyMatch[1].trim()} 获得点球。`;
  }

  const varNoPenaltyMatch = zh.match(/VAR Decision:\s*No Penalty\b[\s\S]*/i);
  if (varNoPenaltyMatch) {
    return 'VAR 视频助理裁判判罚：确认未判罚点球。';
  }

  const varDecisionGeneralMatch = zh.match(/VAR Decision:\s*(.+?)\.?$/i);
  if (varDecisionGeneralMatch) {
    return `VAR 视频助理裁判判罚：${varDecisionGeneralMatch[1].trim()}。`;
  }

  const drawsFoulMatch = zh.match(/([A-Za-z\u00C0-\u024F\s.'-]+?)\s+draws a foul in the penalty area\.?/i);
  if (drawsFoulMatch) {
    return `${drawsFoulMatch[1].trim()} 在禁区内制造对方犯规获得点球。`;
  }

  zh = zh.replace(/Own Goal!/ig, '乌龙进球！')
         .replace(/Goal \(Penalty\)!/ig, '点球破门！')
         .replace(/Goal!/ig, '进球！')
         .replace(/Penalty saved[!.]?/ig, '主罚点球被门将扑出。')
         .replace(/Penalty missed[!.]?/ig, '主罚点球偏出。')
         .replace(/Penalty shootout/ig, '点球大战')
         .replace(/Red Card!/ig, '红牌罚下！')
         .replace(/Yellow Card!/ig, '黄牌警告！')
         .replace(/Substitution,/ig, '换人调整：')
         .replace(/replaces/ig, '替补换下')
         .replace(/Attempt saved\./ig, '射门被门将扑出。')
         .replace(/Attempt missed\./ig, '射门偏出立柱。')
         .replace(/Attempt blocked\./ig, '射门防守队员封堵。')
         .replace(/Corner,/ig, '角球机会：')
         .replace(/Foul by/ig, '犯规球员：')
         .replace(/Hand ball by/ig, '手球犯规：')
         .replace(/Offside,/ig, '越位判罚：')
         .replace(/right footed shot/ig, '右脚射门')
         .replace(/left footed shot/ig, '左脚射门')
         .replace(/header/ig, '头球攻门')
         .replace(/assisted by/ig, '助攻：')
         .replace(/from the centre of the box/ig, '禁区中央')
         .replace(/from outside the box/ig, '禁区外围远射')
         .replace(/to the bottom left corner/ig, '直奔球门左下角')
         .replace(/to the bottom right corner/ig, '直奔球门右下角')
         .replace(/to the top left corner/ig, '直奔球门左上角')
         .replace(/to the top right corner/ig, '直奔球门右上角');

  if (zh === text && !/[\u4e00-\u9fa5]/.test(zh)) {
    return `赛场动态：${text}`;
  }
  return zh;
}

function translateEventToBilingual(item) {
  const rawText = item?.text || item?.description || item?.detail || '';
  const existingI18n = item?.textI18n;
  if (existingI18n && existingI18n.zh && existingI18n.zh !== rawText && /[\u4e00-\u9fa5]/.test(existingI18n.zh)) {
    return existingI18n;
  }
  const typeStr = String(item?.type?.text || item?.type || '').toLowerCase();
  const enText = rawText;

  if (typeStr.includes('goal') || /^goal!/i.test(rawText)) {
    if (/own goal/i.test(rawText) || typeStr.includes('own')) {
      return { zh: `乌龙进球！${translateFootballCommentaryToZh(rawText)}`, en: enText };
    }
    if (/penalty/i.test(rawText)) {
      return { zh: `点球破门！${translateFootballCommentaryToZh(rawText)}`, en: enText };
    }
    return { zh: `进球！${translateFootballCommentaryToZh(rawText)}`, en: enText };
  }
  if (typeStr.includes('red card') || /red card/i.test(rawText)) {
    return { zh: `红牌罚下！${translateFootballCommentaryToZh(rawText)}`, en: enText };
  }
  if (typeStr.includes('yellow card') || /yellow card/i.test(rawText)) {
    return { zh: `黄牌警告！${translateFootballCommentaryToZh(rawText)}`, en: enText };
  }
  if (typeStr.includes('substitution') || /substitution/i.test(rawText)) {
    const subMatch = rawText.match(/Substitution(?:,\s*([^.]+))?\.\s*([^\s]+(?:\s+[^\s]+)*?)\s+replaces\s+([^.]+)/i);
    if (subMatch) {
      const team = subMatch[1] ? ` (${subMatch[1]})` : '';
      return { zh: `换人调整${team}：${subMatch[2]} 换下 ${subMatch[3]}。`, en: enText };
    }
    return { zh: `换人调整：${translateFootballCommentaryToZh(rawText)}`, en: enText };
  }
  if (typeStr.includes('var') || /var/i.test(rawText)) {
    const zhTrans = translateFootballCommentaryToZh(rawText);
    if (zhTrans !== rawText && !zhTrans.startsWith('赛场动态：')) {
      return { zh: zhTrans, en: enText };
    }
    return { zh: `VAR 视频助理裁判介入审核：${zhTrans}`, en: enText };
  }
  if (typeStr.includes('penalty') || /penalty/i.test(rawText)) {
    const zhTrans = translateFootballCommentaryToZh(rawText);
    if (zhTrans !== rawText && !zhTrans.startsWith('赛场动态：')) {
      return { zh: zhTrans, en: enText };
    }
    return { zh: `点球判罚：${zhTrans}`, en: enText };
  }
  if (typeStr.includes('offside') || /offside/i.test(rawText)) {
    return { zh: `越位判罚：${translateFootballCommentaryToZh(rawText)}`, en: enText };
  }

  const zhText = translateFootballCommentaryToZh(rawText);
  return { zh: zhText, en: enText };
}

function computeEventImportance(item) {
  const typeStr = String(item?.type?.text || item?.type || '').toLowerCase();
  const rawText = String(item?.text || item?.description || '').toLowerCase();
  const minuteVal = parseInt(String(item?.time?.displayValue || item?.minute || '0'), 10) || 0;
  const late = minuteVal >= 70;

  if (typeStr.includes('goal') || /^goal!/.test(rawText)) return 90 + (late ? 10 : 0);
  if (typeStr.includes('red') || /red card/.test(rawText)) return 85 + (late ? 10 : 0);
  if (typeStr.includes('penalty') || /penalty/.test(rawText)) return 80;
  if (typeStr.includes('var') || /var/.test(rawText)) return 70;
  if (typeStr.includes('woodwork') || /post|bar/.test(rawText)) return 65;
  if (typeStr.includes('yellow') || /yellow card/.test(rawText)) return 50;
  if (typeStr.includes('substitution') || /substitution/.test(rawText)) return 45 + (late ? 10 : 0);
  if (/attempt (saved|missed|blocked)/.test(rawText) || /corner/.test(rawText)) return 35;
  return 20;
}

function extractKeyEvents(commentary) {
  if (!Array.isArray(commentary)) return null;
  const validItems = commentary.filter((item) => {
    if (!item) return false;
    if (typeof item === 'string') return item.trim().length > 0;
    const text = item?.text || item?.description || item?.detail || '';
    return Boolean(text);
  });

  const scoredItems = validItems.map((item) => {
    if (typeof item === 'string') {
      return {
        raw: item,
        minute: '',
        minuteVal: 0,
        type: 'commentary',
        importance: 20,
        textI18n: { zh: translateFootballCommentaryToZh(item), en: item },
      };
    }
    const minuteStr = String(item?.time?.displayValue || item?.minute || '');
    const minuteVal = parseInt(minuteStr, 10) || 0;
    const typeStr = item?.type?.text || item?.type || 'commentary';
    const textI18n = translateEventToBilingual(item);
    return {
      raw: item,
      minute: minuteStr,
      minuteVal,
      type: typeStr,
      importance: computeEventImportance(item),
      textI18n,
      text: textI18n.zh,
    };
  });

  scoredItems.sort((a, b) => b.importance - a.importance || b.minuteVal - a.minuteVal);
  const selected = scoredItems.slice(0, 12);
  selected.sort((a, b) => a.minuteVal - b.minuteVal);

  return selected.map((item) => {
    if (typeof item.raw === 'string') return item.textI18n.zh;
    return {
      minute: item.minute,
      type: item.type,
      text: item.text,
      textI18n: item.textI18n,
    };
  });
}

module.exports = {
  translateFootballCommentaryToZh,
  translateEventToBilingual,
  computeEventImportance,
  extractKeyEvents,
};
