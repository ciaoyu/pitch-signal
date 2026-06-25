// ========== WorldCup Namespace ==========
window.WorldCup = window.WorldCup || {};
// Mount shared modules (loaded from separate files)
if (typeof Fmt !== 'undefined') window.WorldCup.Formatters = Fmt;
if (typeof API !== 'undefined') window.WorldCup.ApiClient = API;
// State will be populated after definition
window.WorldCup.State = {};
// Utils will be populated after helper definitions
window.WorldCup.Utils = {};

// ========== State ==========
let tab = 'live';
let scheduleCache = [];
let uiLang = localStorage.getItem('worldcup_lang') || 'zh';
// Mount state
window.WorldCup.State = { tab, scheduleCache, uiLang };

const I18N = {
    zh: {
        navLive: '比分',
        navSchedule: '赛程',
        navPrediction: '预测',
        navStandings: '积分',
        navTeams: '球队',
        noMatchesToday: '今天暂无比赛',
        loadingPredictions: '加载预测数据...',
        team: '球队',
        played: '赛',
        wins: '胜',
        draws: '平',
        losses: '负',
        goalsFor: '进',
        goalsAgainst: '失',
        goalDifference: '净',
        points: '分',
        matchesSuffix: '场',
        updatePrefix: '更新 ',
        pointsLabel: '积分',
        teamsLoading: '球队数据加载中...',
        赛前预测: '赛前预测',
        加载赛前预测: '加载赛前预测...',
        'Elo 实力对比': 'Elo 实力对比',
        'Elo 差值': 'Elo 差值',
        胜平负概率: '胜平负概率',
        '进球期望值 (λ)': '进球期望值 (λ)',
        场均进球: '场均进球',
        预测数据加载失败: '预测数据加载失败',
        dataQualityTitle: '📊 数据质量说明',
        dataQualityRealtimeTitle: '✓ 实时数据',
        dataQualityRealtimeDesc: '比赛进程、即时比分（ESPN 延迟 ~5 分钟）',
        dataQualityPrematchTitle: '✓ 赛前数据',
        dataQualityPrematchDesc: '推测阵容（基于历史首发）、概率预测',
        dataQualityDevTitle: '⏳ 规划支持',
        dataQualityDevDesc: '官方首发、历史替补与换人',
        dataQualityPendingTitle: '⚠️ 暂不支持',
        dataQualityPendingDesc: '历史天气、完整 H2H 库',
        dataQualityFooter: '缺失数据不会被推测填充；页面会清晰注明"暂无"或"尚未同步"。',
        dataQualityBtn: '数据质量说明',
    },
    en: {
        navLive: 'Live',
        navSchedule: 'Schedule',
        navPrediction: 'Prediction',
        navStandings: 'Table',
        navTeams: 'Teams',
        noMatchesToday: 'No matches today',
        loadingPredictions: 'Loading predictions...',
        team: 'Team',
        played: 'P',
        wins: 'W',
        draws: 'D',
        losses: 'L',
        goalsFor: 'GF',
        goalsAgainst: 'GA',
        goalDifference: 'GD',
        points: 'Pts',
        matchesSuffix: 'matches',
        updatePrefix: 'Updated ',
        pointsLabel: 'Pts',
        teamsLoading: 'Loading teams...',
        '赛前预测': 'Pre-Match',
        '加载赛前预测...': 'Loading pre-match prediction...',
        'Elo 实力对比': 'Elo Comparison',
        'Elo 差值': 'Elo Diff',
        '胜平负概率': 'W/D/L Probability',
        '进球期望值 (λ)': 'Expected Goals (λ)',
        '场均进球': 'Avg Goals',
        '预测数据加载失败': 'Prediction data unavailable',
        dataQualityTitle: '📊 Data Quality Notice',
        dataQualityRealtimeTitle: '✓ Live Data',
        dataQualityRealtimeDesc: 'Match progress, live scores (ESPN delay ~5 mins)',
        dataQualityPrematchTitle: '✓ Pre-Match Data',
        dataQualityPrematchDesc: 'Projected lineups (based on history), probability predictions',
        dataQualityDevTitle: '⏳ Planned Features',
        dataQualityDevDesc: 'Official lineups, historical substitutes & substitutions',
        dataQualityPendingTitle: '⚠️ Not Supported',
        dataQualityPendingDesc: 'Historical weather, complete H2H database',
        dataQualityFooter: 'Missing data will not be speculatively filled; pages will clearly indicate "N/A" or "Not Synced".',
        dataQualityBtn: 'Data Quality Notice',
    },
};

// Match centre stats are deliberately kept in one place: this is both the
// presentation order and the mapping from ESPN's camelCase stat keys.
const MATCH_STAT_GROUPS = {
    attack: {
        label: { zh: '进攻', en: 'Attack' },
        icon: '⚔️',
        stats: {
            possessionPct: { zh: '控球率', en: 'Possession' },
            wonCorners: { zh: '角球', en: 'Corners' },
            offsides: { zh: '越位', en: 'Offsides' },
        },
    },
    shooting: {
        label: { zh: '射门', en: 'Shooting' },
        icon: '🎯',
        stats: {
            shotsSummary: { zh: '射门（射正）', en: 'Shots (on target)' },
            totalShots: { zh: '总射门', en: 'Total shots' },
            shotsOnTarget: { zh: '射正', en: 'Shots on target' },
            shotPct: { zh: '射门转化率', en: 'Shot conversion' },
            blockedShots: { zh: '封堵射门', en: 'Blocked shots' },
            penaltyKickGoals: { zh: '点球得分', en: 'Penalty goals' },
            penaltyKickShots: { zh: '点球数', en: 'Penalty shots' },
        },
    },
    passing: {
        label: { zh: '传球', en: 'Passing' },
        icon: '🧭',
        stats: {
            accuratePasses: { zh: '准确传球', en: 'Accurate passes' },
            totalPasses: { zh: '总传球', en: 'Total passes' },
            passPct: { zh: '传球成功率', en: 'Pass accuracy' },
            accurateCrosses: { zh: '准确传中', en: 'Accurate crosses' },
            totalCrosses: { zh: '总传中', en: 'Total crosses' },
            crossPct: { zh: '传中成功率', en: 'Cross accuracy' },
            accurateLongBalls: { zh: '准确长传', en: 'Accurate long balls' },
            totalLongBalls: { zh: '总长传', en: 'Total long balls' },
            longballPct: { zh: '长传成功率', en: 'Long-ball accuracy' },
        },
    },
    defending: {
        label: { zh: '防守', en: 'Defending' },
        icon: '🛡️',
        stats: {
            saves: { zh: '扑救', en: 'Saves' },
            effectiveTackles: { zh: '成功抢断', en: 'Successful tackles' },
            totalTackles: { zh: '总抢断', en: 'Total tackles' },
            tacklePct: { zh: '抢断成功率', en: 'Tackle success' },
            interceptions: { zh: '拦截', en: 'Interceptions' },
            effectiveClearance: { zh: '有效解围', en: 'Effective clearances' },
            totalClearance: { zh: '总解围', en: 'Total clearances' },
        },
    },
    discipline: {
        label: { zh: '纪律', en: 'Discipline' },
        icon: '🟨',
        stats: {
            foulsCommitted: { zh: '犯规', en: 'Fouls committed' },
            yellowCards: { zh: '黄牌', en: 'Yellow cards' },
            redCards: { zh: '红牌', en: 'Red cards' },
        },
    },
};

// ========== i18n Helpers ==========
function tx(zh, en) {
    return uiLang === 'zh' ? zh : en;
}
// Mount utils
window.WorldCup.Utils.tx = tx;

function matchStatHasValue(value) {
    const parts = String(value ?? '').match(/\d+(?:\.\d+)?/g);
    return Boolean(parts?.some(part => Number(part) !== 0));
}

function matchStatMagnitude(value) {
    const firstNumber = String(value ?? '').match(/\d+(?:\.\d+)?/);
    return firstNumber ? Number(firstNumber[0]) : 0;
}

function renderMatchStatComparison(stat, label) {
    const homeValue = String(stat.home ?? '0');
    const awayValue = String(stat.away ?? '0');
    const homeMagnitude = matchStatMagnitude(homeValue);
    const awayMagnitude = matchStatMagnitude(awayValue);
    const total = homeMagnitude + awayMagnitude;
    const homeWidth = total ? Math.round(homeMagnitude / total * 100) : 0;
    const awayWidth = total ? Math.round(awayMagnitude / total * 100) : 0;

    return `<div class="py-2.5 border-b border-white/5 last:border-b-0">
        <div class="flex items-center gap-2 mb-1.5">
            <span class="flex-1 text-xs font-mono font-bold tabular-nums">${esc(homeValue)}</span>
            <span class="w-32 shrink-0 text-center text-[11px] font-medium text-gray-400">${esc(i18nText(label))}</span>
            <span class="flex-1 text-right text-xs font-mono font-bold tabular-nums">${esc(awayValue)}</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5" aria-label="${attr(i18nText(label))}">
            <div class="elo-bar flex justify-end"><div class="elo-bar-fill" style="width:${homeWidth}%"></div></div>
            <div class="elo-bar"><div class="elo-bar-fill" style="width:${awayWidth}%"></div></div>
        </div>
    </div>`;
}

function renderMatchStats(teamStats) {
    const statsByName = new Map(teamStats.map(stat => [stat.name, stat]));
    const groups = Object.values(MATCH_STAT_GROUPS).map(group => {
        const rows = Object.entries(group.stats)
            .map(([name, label]) => ({ stat: statsByName.get(name), label }))
            .filter(({ stat }) => stat && (matchStatHasValue(stat.home) || matchStatHasValue(stat.away)));
        if (!rows.length) return '';

        return `<section class="pred-section mb-3 last:mb-0">
            <h4 class="pred-section-title text-blue-400">${group.icon} ${esc(i18nText(group.label))}</h4>
            ${rows.map(({ stat, label }) => renderMatchStatComparison(stat, label)).join('')}
        </section>`;
    }).join('');

    return groups || `<div class="text-gray-600 text-sm py-2">${tx('暂无技术统计', 'No match statistics')}</div>`;
}

function i18nText(i18nObj, fallback = '') {
    if (!i18nObj) return fallback;
    return uiLang === 'zh' ? (i18nObj.zh || fallback) : (i18nObj.en || fallback);
}

const ZH_NAMES = {
    // ===== 球员中文名 =====
    // 阿根廷
    'Lionel Messi': '莱昂内尔·梅西', 'Emiliano Martínez': '埃米利亚诺·马丁内斯',
    'Cristian Romero': '克里斯蒂安·罗梅罗', 'Nicolás Otamendi': '尼古拉斯·奥塔门迪',
    'Rodrigo De Paul': '罗德里戈·德保罗', 'Enzo Fernández': '恩佐·费尔南德斯',
    'Alexis Mac Allister': '阿历克斯·麦卡利斯特', 'Julián Álvarez': '胡连·阿尔瓦雷斯',
    'Lautaro Martínez': '劳塔罗·马丁内斯', 'Paulo Dybala': '保罗·迪巴拉',
    'Ángel Di María': '安赫尔·迪马利亚', 'Leandro Paredes': '莱安德罗·帕雷德斯',
    'Nahuel Molina': '纳韦尔·莫利纳', 'Nicolás Tagliafico': '尼古拉斯·塔利亚菲科',
    // 法国
    'Kylian Mbappé': '基利安·姆巴佩', 'Antoine Griezmann': '安托万·格列兹曼',
    'Ousmane Dembélé': '乌斯曼·登贝莱', 'Aurélien Tchouaméni': '奥雷连·丘阿梅尼',
    'Raphaël Varane': '拉斐尔·瓦拉内', 'Mike Maignan': '迈克·迈尼昂',
    'Marcus Thuram': '马库斯·图拉姆', 'Eduardo Camavinga': '爱德华多·卡马文加',
    'William Saliba': '威廉·萨利巴', 'Jules Koundé': '朱尔斯·昆德',
    'Theo Hernández': '特奥·埃尔南德斯', 'Adrien Rabiot': '阿德里安·拉比奥',
    // 英格兰
    'Harry Kane': '哈里·凯恩', 'Jude Bellingham': '贾德·贝林厄姆',
    'Phil Foden': '菲尔·福登', 'Bukayo Saka': '布卡约·萨卡',
    'Declan Rice': '德克兰·赖斯', 'Jordan Pickford': '乔丹·皮克福德',
    'Trent Alexander-Arnold': '特伦特·亚历山大-阿诺德', 'John Stones': '约翰·斯通斯',
    'Marcus Rashford': '马库斯·拉什福德', 'Jack Grealish': '杰克·格里利什',
    'Kyle Walker': '凯尔·沃克', 'Luke Shaw': '卢克·肖',
    // 巴西
    'Vinicius Junior': '维尼修斯·儒尼奥尔', 'Rodrygo': '罗德里戈',
    'Alisson Becker': '阿利松·贝克尔', 'Casemiro': '卡塞米罗',
    'Marquinhos': '马尔基尼奥斯', 'Thiago Silva': '蒂亚戈·席尔瓦',
    'Raphinha': '拉菲尼亚', 'Bruno Guimarães': '布鲁诺·吉马良斯',
    'Lucas Paquetá': '卢卡斯·帕奎塔', 'Gabriel Martinelli': '加布里埃尔·马丁内利',
    'Richarlison': '里查利森', 'Endrick': '恩德里克',
    // 西班牙
    'Lamine Yamal': '拉明·亚马尔', 'Pedri': '佩德里',
    'Gavi': '加维', 'Dani Olmo': '达尼·奥尔莫',
    'Álvaro Morata': '阿尔瓦罗·莫拉塔', 'Unai Simón': '乌纳伊·西蒙',
    'Aymeric Laporte': '艾梅里克·拉波尔特', 'Rodri': '罗德里',
    'Ferran Torres': '费兰·托雷斯', 'Nico Williams': '尼科·威廉姆斯',
    'Fabián Ruiz': '法比安·鲁伊斯', 'Dani Carvajal': '达尼·卡瓦哈尔',
    'Mikel Oyarzabal': '米克尔·奥亚尔萨瓦尔',
    // 德国
    'Manuel Neuer': '曼努埃尔·诺伊尔', 'Thomas Müller': '托马斯·穆勒',
    'Joshua Kimmich': '约书亚·基米希', 'Kai Havertz': '凯·哈弗茨',
    'Florian Wirtz': '弗洛里安·维尔茨', 'Leroy Sané': '莱罗伊·萨内',
    'Ilkay Gündogan': '伊尔卡伊·君多安', 'Toni Kroos': '托尼·克罗斯',
    'Antonio Rüdiger': '安东尼奥·吕迪格', 'Jamal Musiala': '贾马尔·穆西亚拉',
    // 荷兰
    'Virgil van Dijk': '维吉尔·范戴克', 'Cody Gakpo': '科迪·加科波',
    'Frenkie de Jong': '弗伦基·德容', 'Memphis Depay': '孟菲斯·德佩',
    'Xavi Simons': '哈维·西蒙斯', 'Denzel Dumfries': '邓泽尔·杜姆弗里斯',
    'Nathan Aké': '内森·阿克', 'Steven Bergwijn': '史蒂文·博格韦恩',
    'Wout Weghorst': '沃特·韦霍斯特', 'Tijjani Reijnders': '蒂贾尼·雷恩德斯',
    // 葡萄牙
    'Cristiano Ronaldo': '克里斯蒂亚诺·罗纳尔多', 'Bruno Fernandes': '布鲁诺·费尔南德斯',
    'Rafael Leão': '拉菲尔·莱昂', 'João Félix': '若昂·费利克斯',
    'Rúben Dias': '鲁本·迪亚斯', 'Bernardo Silva': '贝尔纳多·席尔瓦',
    'João Cancelo': '若昂·坎塞洛', 'Diogo Jota': '迪奥戈·若塔',
    'Nuno Mendes': '努诺·门德斯', 'Gonçalo Ramos': '贡萨洛·拉莫斯',
    // 比利时
    'Kevin De Bruyne': '凯文·德布劳内', 'Romelu Lukaku': '罗梅卢·卢卡库',
    'Thibaut Courtois': '蒂博·库尔图瓦', 'Axel Witsel': '阿克塞尔·维特塞尔',
    'Toby Alderweireld': '托比·阿尔德维雷尔德', 'Jan Vertonghen': '扬·维尔通亨',
    'Eden Hazard': '伊甸·阿扎尔', 'Yannick Carrasco': '亚尼克·卡拉斯科',
    'Leandro Trossard': '莱安德罗·特罗萨尔', 'Charles De Ketelaere': '查尔斯·德凯特拉尔',
    // 哥伦比亚
    'James Rodríguez': '哈梅斯·罗德里格斯', 'Luis Díaz': '路易斯·迪亚斯',
    'Falcao': '法尔考', 'Juan Cuadrado': '胡安·夸德拉多',
    'Davinson Sánchez': '达文森·桑切斯', 'Radamel Falcao': '法尔考',
    'Johan Mojica': '约翰·莫希卡', 'Richard Ríos': '理查德·里奥斯',
    'Jhon Arias': '约翰·阿里亚斯',
    // 摩洛哥
    'Achraf Hakimi': '阿什拉夫·哈基米', 'Hakim Ziyech': '哈基姆·齐耶赫',
    'Yassine Bounou': '亚辛·布努', 'Romain Saïss': '罗曼·赛斯',
    'Noussair Mazraoui': '努萨伊尔·马兹劳伊', 'Sofiane Boufal': '索菲安·布法尔',
    'Youssef En-Nesyri': '尤素福·恩纳西里', 'Nayef Aguerd': '纳耶夫·阿盖尔德',
    // 日本
    'Takumi Minamino': '南野拓实', 'Daichi Kamada': '镰田大地',
    'Wataru Endo': '远藤航', 'Takehiro Tomiyasu': '冨安健洋',
    'Ritsu Doan': '堂安律', 'Junya Ito': '伊东纯也',
    'Kaoru Mitoma': '三笘薫', 'Hiroki Ito': '伊藤洋辉',
    'Ayase Ueda': '上田绮世', 'Shuichi Gonda': '权田修一',
    // 克罗地亚
    'Luka Modrić': '卢卡·莫德里奇', 'Ivan Perišić': '伊万·佩里西奇',
    'Mateo Kovačić': '马特奥·科瓦契奇', 'Marcelo Brozović': '马尔切洛·布罗佐维奇',
    'Joško Gvardiol': '约什科·瓜尔迪奥尔', 'Dominik Livaković': '多米尼克·利瓦科维奇',
    'Ante Budimir': '安特·布迪米尔',
    // 乌拉圭
    'Luis Suárez': '路易斯·苏亚雷斯', 'Edinson Cavani': '爱丁森·卡瓦尼',
    'Federico Valverde': '费德里科·巴尔韦德', 'Rodrigo Bentancur': '罗德里戈·本坦库尔',
    'José María Giménez': '何塞·马利亚·吉门尼斯', 'Darwin Núñez': '达尔文·努涅斯',
    'Ronald Araújo': '罗纳德·阿劳霍', 'Facundo Pellistri': '法孔多·佩利斯特里',
    // 韩国
    'Son Heung-min': '孙兴慜', 'Kim Min-jae': '金珉哉',
    'Lee Kang-in': '李康仁', 'Hwang Hee-chan': '黄喜灿',
    'Cho Gue-sung': '赵圭成', 'Hwang In-beom': '黄仁范',
    // 美国
    'Christian Pulisic': '克里斯蒂安·普利西奇', 'Tyler Adams': '泰勒·亚当斯',
    'Weston McKennie': '韦斯顿·麦肯尼', 'Gio Reyna': '乔·雷纳',
    'Tim Weah': '蒂姆·韦亚', 'Sergiño Dest': '塞尔吉尼奥·德斯特',
    'Matt Turner': '马特·特纳', 'Yunus Musah': '尤努斯·穆萨',
    // 墨西哥
    'Hirving Lozano': '伊尔文·洛萨诺', 'Raúl Jiménez': '劳尔·希门尼斯',
    'Guillermo Ochoa': '吉列尔莫·奥乔亚', 'Edson Álvarez': '埃德森·阿尔瓦雷斯',
    'Alexis Vega': '阿历克西斯·维加', 'César Montes': '塞萨尔·蒙特斯',
    // 澳大利亚
    'Mathew Ryan': '马修·瑞安', 'Awer Mabil': '阿韦尔·马比尔',
    'Martin Boyle': '马丁·博伊尔', 'Mitchell Duke': '米切尔·杜克',
    'Ajdin Hrustic': '阿杰丁·鲁斯蒂奇', 'Harry Souttar': '哈里·萨塔',
    'Mat Leckie': '马特·莱基',
    // 加拿大
    'Alphonso Davies': '阿方索·戴维斯', 'Jonathan David': '乔纳森·大卫',
    'Cyle Larin': '赛尔·拉林', 'Tajon Buchanan': '塔容·布坎南',
    'Stephen Eustáquio': '斯蒂芬·欧斯塔基奥', 'Atiba Hutchinson': '阿蒂巴·哈钦森',
    // 塞内加尔
    'Sadio Mané': '萨迪奥·马内', 'Edouard Mendy': '爱德华·门迪',
    'Kalidou Koulibaly': '卡利杜·库利巴利', 'Idrissa Gueye': '伊德里萨·格耶',
    'Ismaïla Sarr': '伊斯梅拉·萨尔', 'Bamba Dieng': '班巴·迪恩',
    // 伊朗
    'Mehdi Taremi': '迈赫迪·塔雷米', 'Sardar Azmoun': '萨尔达尔·阿兹蒙',
    'Alireza Jahanbakhsh': '阿里雷扎·贾汉巴赫什', 'Ali Gholizadeh': '阿里·戈利扎德',
    // 瑞士
    'Granit Xhaka': '格拉尼特·扎卡', 'Xherdan Shaqiri': '谢尔丹·沙奇里',
    'Yann Sommer': '扬·索默', 'Manuel Akanji': '曼努埃尔·阿坎吉',
    'Breel Embolo': '布雷尔·恩博洛', 'Remo Freuler': '雷莫·弗洛伊勒',
    // 厄瓜多尔
    'Enner Valencia': '恩纳·瓦伦西亚', 'Piero Hincapié': '皮耶罗·辛卡皮耶',
    'Moisés Caicedo': '莫伊塞斯·凯塞多', 'Gonzalo Plata': '冈萨洛·普拉塔',
    'Ángel Mena': '安赫尔·梅纳',
    // 尼日利亚
    'Victor Osimhen': '维克托·奥辛梅', 'Samuel Chukwueze': '塞缪尔·丘克韦泽',
    'Alex Iwobi': '亚历克斯·伊沃比', 'Wilfred Ndidi': '威尔弗雷德·恩迪迪',
    'Calvin Bassey': '卡尔文·巴西', 'Taiwo Awoniyi': '泰沃·阿沃尼义',
    // 加纳
    'André Ayew': '安德烈·阿尤', 'Jordan Ayew': '乔丹·阿尤',
    'Thomas Partey': '托马斯·帕尔泰', 'Mohammed Kudus': '穆罕默德·库杜斯',
    'Inaki Williams': '伊纳基·威廉姆斯', 'Antoine Semenyo': '安托万·塞梅尼奥',
    // 沙特阿拉伯
    'Salem Al-Dawsari': '萨利姆·阿尔道萨里', 'Mohammed Al-Deayea': '穆罕默德·阿尔达雅',
    'Yasser Al-Shahrani': '亚瑟·阿尔沙赫拉尼', 'Saleh Al-Shehri': '萨利赫·阿尔谢赫里',
    // ===== 教练中文名 =====
    'Gregg Berhalter': '格雷格·贝哈尔特',
    'Dorival Júnior': '多里瓦尔·儒尼奥尔',
    'Thierry Henry': '蒂埃里·亨利',
    'Vincenzo Montella': '文森佐·蒙特拉',
    'Steve Clarke': '史蒂夫·克拉克',
    'Graham Arnold': '格拉汉姆·阿诺德',
    'Didier Deschamps': '迪迪埃·德尚',
    'Gareth Southgate': '加雷斯·索斯盖特',
    'Lionel Scaloni': '利昂内尔·斯卡洛尼',
    'Julian Nagelsmann': '朱利安·纳格尔斯曼',
    'Luis de la Fuente': '路易斯·德拉富恩特',
    'Roberto Martínez': '罗伯托·马丁内斯',
    'Marcelo Bielsa': '马塞洛·贝尔萨',
    'Luciano Spalletti': '卢西亚诺·斯帕莱蒂',
    'Ronald Koeman': '罗纳德·科曼',
    'Marco Rose': '马尔科·罗泽',
    'Hajime Moriyasu': '森保一',
    'Jürgen Klinsmann': '尤尔根·克林斯曼',
    'Hervé Renard': '埃尔韦·勒纳尔',
    'Walid Regragui': '瓦利德·雷格拉吉',
    'Aliou Cissé': '阿利乌·西塞',
    'Carlos Queiroz': '卡洛斯·奎罗斯',
    'Felix Sánchez': '费利克斯·桑切斯',
    'Dragan Stojković': '德拉甘·斯托伊科维奇',
    'Murat Yakin': '穆拉特·雅金',
    'Kasper Hjulmand': '卡斯帕·尤尔曼德',
    'Rob Page': '罗伯·佩奇',
    'Michał Probierz': '米哈乌·普罗别日',
    'Serhiy Rebrov': '谢尔盖·雷布罗夫',
    'Willy Sagnol': '威利·萨尼奥尔',
    'Edward Iordănescu': '爱德华·约尔德内斯库',
    'Ivan Hašek': '伊万·哈谢克',
    'Ralf Rangnick': '拉尔夫·朗尼克',
    'Matjaž Kek': '马蒂亚兹·凯克',
    'Sylvinho': '西尔维尼奥',
    'Zlatko Dalić': '兹拉特科·达利奇',
    'Fernando Diniz': '费尔南多·迪尼兹',
    'Gregg Berhalter (Interim)': '格雷格·伯哈尔特 (代理)',
    'United States': '美国',
    'Brazil': '巴西',
    'France': '法国',
    'Qatar': '卡塔尔',
    'Turkey': '土耳其',
    'Scotland': '苏格兰',
    'Australia': '澳大利亚',
    'England': '英格兰',
    'Argentina': '阿根廷',
    'Germany': '德国',
    'Spain': '西班牙',
    'Portugal': '葡萄牙',
    'Uruguay': '乌拉圭',
    'Italy': '意大利',
    'Netherlands': '荷兰',
    'Croatia': '克罗地亚',
    'Belgium': '比利时',
    'Colombia': '哥伦比亚',
    'Mexico': '墨西哥',
    'Switzerland': '瑞士',
    'Morocco': '摩洛哥',
    'Senegal': '塞内加尔',
    'Japan': '日本',
    'South Korea': '韩国',
    'Iran': '伊朗',
    'Saudi Arabia': '沙特阿拉伯',
    'Denmark': '丹麦',
    'Serbia': '塞尔维亚',
    'Poland': '波兰',
    'Wales': '威尔士',
    'Ukraine': '乌克兰',
    'Georgia': '格鲁吉亚',
    'Romania': '罗马尼亚',
    'Czech Republic': '捷克',
    'Austria': '奥地利',
    'Slovenia': '斯洛文尼亚',
    'Albania': '阿尔巴尼亚',
    'Balanced': '均衡型',
    'Attacking': '进攻型',
    'Defensive': '防守型',
    'Possession': '控球型',
    'Counter Attack': '防守反击',
    'High Press': '高位压迫',
    'Wing Play': '边路进攻',
    'Direct': '长传冲吊',
    'Possession + Attacking': '控球+进攻足球',
    'Defensive + Counter': '防守反击',
    'High Press + Direct': '高压逼抢+快速冲击',
    'years': '年',
    'year': '年',
    'months': '个月',
    'month': '个月'
};

function translatePlayerName(name) {
    if (!name) return name;
    if (uiLang === 'en') return name;
    return ZH_NAMES[name] || name;
}
window.WorldCup.Utils.translatePlayerName = translatePlayerName;

function translateCoachField(val, type) {
    if (!val) return val;
    if (uiLang === 'zh') {
        if (type === 'tenure') return val;
        return ZH_NAMES[val] || val;
    } else {
        if (type === 'tenure') {
            return String(val).replace('年', ' years').replace('个月', ' months');
        }
        if (type === 'style' || type === 'nationality') {
            const revDict = Object.fromEntries(Object.entries(ZH_NAMES).map(([k,v])=>[v,k]));
            return revDict[val] || val;
        }
        return val;
    }
}

function t(key) {
    return I18N[uiLang]?.[key] || I18N.zh[key] || key;
}


function displayTeamName(name) {
    const raw = String(name || '').trim();
    const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
    if (!bilingual) return raw;
    return uiLang === 'en' ? bilingual[2].trim() : bilingual[1].trim();
}

function displayMaybeTeamName(name) {
    if (name && typeof name === 'object') {
        const i18n = name.nameI18n || name;
        if (i18n && (i18n.zh || i18n.en)) {
            return uiLang === 'en' ? (i18n.en || i18n.zh || '') : (i18n.zh || i18n.en || '');
        }
        return displayTeamName(name.name || name.displayName || name.shortName || '');
    }
    return displayTeamName(name);
}

function i18nText(value, fallback = '') {
    if (value && typeof value === 'object' && (value.zh || value.en)) {
        return uiLang === 'en' ? (value.en || value.zh || fallback) : (value.zh || value.en || fallback);
    }
    return value || fallback;
}

function displayGroupName(name) {
    const group = String(name || '').match(/([A-L])$/)?.[1] || '';
    if (!group) return name || '';
    return uiLang === 'en' ? `Group ${group}` : `小组 ${group}`;
}

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        const active = btn.dataset.lang === uiLang;
        btn.classList.toggle('bg-white/15', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('text-gray-500', !active);
    });
}

function setLanguage(lang) {
    if (!I18N[lang] || lang === uiLang) return;
    uiLang = lang;
    localStorage.setItem('worldcup_lang', uiLang);
    applyLanguage();
    if (tab === 'live') loadScores();
    if (tab === 'schedule') {
        const selectedDate = document.querySelector('.date-btn.tab-on')?.dataset.date;
        if (selectedDate) filterDate(selectedDate);
        else loadSchedule();
    }
    if (tab === 'standings') loadStandings();
    if (tab === 'teams') {
        allTeams = [];
        loadTeams();
    }
    if (tab === 'prediction') loadPrediction();
}
let autoRefresh = null;

// ========== Tab + URL Routing ===========
function switchTab(newTab) {
    tab = newTab;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('tab-on'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('fade-in');
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('tab-on');
    if (tab === 'schedule' && !scheduleCache.length) loadSchedule();
    if (tab === 'standings') loadStandings();
    if (tab === 'teams') { document.getElementById('team-detail').classList.add('hidden'); document.getElementById('teams-grid').classList.remove('hidden'); loadTeams(); }
    if (tab === 'prediction') loadPrediction();
    history.replaceState(null, '', '#' + tab);
}

document.getElementById('nav').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    switchTab(btn.dataset.tab);
});

document.addEventListener('click', e => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    if (action === 'set-lang') return setLanguage(target.dataset.lang);
    if (action === 'refresh-all') return refreshAll();
    if (action === 'close-team-modal') return closeTeamModal();
    if (action === 'close-modal') return closeModal();
    if (action === 'open-match') return openMatch(target.dataset.matchId);
    if (action === 'open-pre-match') {
        return openPreMatch(target.dataset.matchId, target.dataset.homeId || '', target.dataset.awayId || '', target.dataset.homeName || '', target.dataset.awayName || '', target.dataset.venueName || '');
    }
    if (action === 'filter-date') return filterDate(target.dataset.date);
    if (action === 'open-team-detail') {
        e.stopPropagation();
        return openTeamDetail(target.dataset.teamId, target.dataset.teamName || '', target.dataset.group || '');
    }
    if (action === 'toggle-pred-detail') return togglePredDetail(target.dataset.target);
    if (action === 'open-player-detail') {
        const ds = target.dataset;
        const inline = ds.playerName ? { name: ds.playerName, pos: ds.playerPos, jersey: ds.playerJersey, age: ds.playerAge, height: ds.playerHeight, nationality: ds.playerNationality } : null;
        return openPlayerDetail(ds.playerId, inline);
    }
    if (action === 'switch-detail-tab') return switchDetailTab(target.dataset.detailTab, target);
    if (action === 'set-pitch-view') return setPitchView(target.dataset.view, target);
    if (action === 'send-ai-message') {
        return sendAIMessage(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId);
    }
    if (action === 'ask-ai-preset') {
        return askAIPreset(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId, target.dataset.question);
    }
    if (action === 'close-global-chat') {
        document.getElementById('global-chat-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }
});

// Event delegation for player tip tooltips
document.addEventListener('mouseover', e => {
    const target = e.target.closest('[data-action="show-player-tip"]');
    if (target) {
        showTipFromDataset(target);
    }
});

document.addEventListener('mouseout', e => {
    const target = e.target.closest('[data-action="show-player-tip"]');
    if (target) {
        hideTip();
    }
});

// The global AI chat is not rendered in public beta. Keep this compatibility
// guard so a future authenticated internal build can opt in without breaking
// the public page.
const globalChatToggle = document.getElementById('ai-chat-toggle');
const globalChatSend = document.getElementById('global-chat-send');
const globalChatInput = document.getElementById('global-chat-input');
if (globalChatToggle && globalChatSend && globalChatInput) {
    globalChatToggle.addEventListener('click', () => {
        document.getElementById('global-chat-modal')?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });
    globalChatSend.addEventListener('click', sendGlobalChatMessage);
    globalChatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') sendGlobalChatMessage();
    });
}

// Safe DOM helper: append a chat bubble using textContent (no innerHTML).
// Supports multiline text via newline → <br> conversion.
function _appendGlobalBubble(container, label, labelClass, bodyClass, text) {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col gap-1 ' + (labelClass.includes('mr-') ? 'items-end' : 'items-start');
    const lbl = document.createElement('span');
    lbl.className = labelClass;
    lbl.textContent = label;
    const body = document.createElement('div');
    body.className = bodyClass;
    // Split on \n and interleave <br> for multiline rendering
    const parts = String(text || '').split('\n');
    parts.forEach((part, i) => {
        if (i > 0) body.appendChild(document.createElement('br'));
        body.appendChild(document.createTextNode(part));
    });
    wrap.appendChild(lbl);
    wrap.appendChild(body);
    container.appendChild(wrap);
    return wrap;
}

async function sendGlobalChatMessage() {
    const input = document.getElementById('global-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    const container = document.getElementById('global-chat-messages');

    // Add user message (safe: textContent, no innerHTML)
    _appendGlobalBubble(container, 'You',
        'text-[9px] text-gray-500 mr-1',
        'bg-purple-600 rounded-2xl rounded-tr-sm px-4 py-2 text-sm text-white',
        msg);
    
    // Add loading indicator
    const loadingId = 'loading-' + Date.now();
    const loadingWrap = _appendGlobalBubble(container, 'AI Assistant',
        'text-[9px] text-gray-500 ml-1',
        'bg-white/10 rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-gray-400 italic',
        '...');
    loadingWrap.id = loadingId;
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch('/api/bot/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: msg, context: 'global-feedback', uiLang })
        });
        const data = await res.json();
        
        document.getElementById(loadingId).remove();
        
        // Add AI message (safe: textContent, no innerHTML)
        _appendGlobalBubble(container, 'AI Assistant',
            'text-[9px] text-gray-500 ml-1',
            'bg-white/10 rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-gray-200',
            data.answer || 'Error');
    } catch (e) {
        document.getElementById(loadingId).remove();
        _appendGlobalBubble(container, 'Error',
            'text-[9px] text-red-400 ml-1',
            'bg-red-500/20 border border-red-500/50 text-red-200 rounded-2xl rounded-tl-sm px-4 py-2 text-sm',
            tx('发送失败，请稍后再试。', 'Send failed. Please try again later.'));
    }
    container.scrollTop = container.scrollHeight;
}

document.addEventListener('keydown', e => {
    const target = e.target.closest('[data-key-action]');
    if (!target || e.key !== 'Enter') return;
    if (target.dataset.keyAction === 'send-ai-message') {
        sendAIMessage(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId);
    }
});

// Restore tab from URL hash on load
window.addEventListener('DOMContentLoaded', () => {
    const hash = location.hash.slice(1);
    if (hash && document.getElementById('tab-' + hash)) switchTab(hash);
});
window.addEventListener('popstate', () => {
    const hash = location.hash.slice(1);
    if (hash && document.getElementById('tab-' + hash)) switchTab(hash);
});

// ========== Clock ==========
function tick() {
    document.getElementById('clock').textContent =
        new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
tick(); setInterval(tick, 1000);
applyLanguage();

// ========== Fetch ==========
// Backward-compatible wrapper: returns raw data on success, null on failure.
// All existing callers work unchanged. Prefer API.get() / API.post() for new code.
async function api(url, options = {}) {
    return API.legacy(url, options);
}

function withClientTimeout(promise, ms = 8000) {
    // Kept for compatibility; API.get() already handles timeout internally.
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(null), ms))
    ]);
}

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}
// Mount utils
window.WorldCup.Utils.esc = esc;

function attr(value) {
    return esc(value);
}

function safeUrl(url) {
    if (!url) return '';
    const str = String(url).trim();
    if (str.startsWith('http://') || str.startsWith('https://')) {
        return esc(str);
    }
    return '';
}

// ========== Scores ==========
async function loadScores() {
    const res = await API.get('/api/scores');
    const d = res.data;
    const el = document.getElementById('live-list');
    if (!res.ok) {
        el.innerHTML = `<div class="text-center py-20"><div class="text-5xl mb-3">⚠️</div><p class="text-gray-500">${res.isFailure ? tx('加载失败，请稍后重试', 'Failed to load, please retry') : esc(res.error || '')}</p></div>`;
        return;
    }
    // This tab may include upcoming fixtures for today, but completed matches
    // belong in Schedule / match review rather than the Live view.
    const visibleMatches = (d.matches || []).filter(m =>
        m.state !== 'post' && m.sClass !== 'finished'
    );

    if (!visibleMatches.length) {
        el.innerHTML = `<div class="text-center py-20"><div class="text-5xl mb-3">😴</div><p class="text-gray-500">${esc(t('noMatchesToday'))}</p></div>`;
        return;
    }

    el.innerHTML = visibleMatches.map(m => card(m)).join('');
    document.getElementById('update-time').textContent = t('updatePrefix') + new Date().toLocaleTimeString(uiLang === 'zh' ? 'zh-CN' : 'en-US', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' });
}

function card(m) {
    const live = m.state === 'in';
    const done = m.state === 'post';
    const statusCls = live ? 'text-red-400' : done ? 'text-gray-500' : 'text-blue-400';
    const score = m.state !== 'pre' ? `${esc(m.home.score)} : ${esc(m.away.score)}` : 'vs';
    const scoreCls = live ? 'text-white' : done ? 'text-gray-400' : 'text-gray-600';

    let minute = '';
    if (live && m.status) {
        const minMatch = m.status.match(/(\d+)/);
        if (minMatch) minute = esc(minMatch[1]) + "'";
    }

    const action = 'open-match';

    return `
    <div class="schedule-row" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || '')}" data-away-id="${attr(m.away.id || '')}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || '')}">
        <div class="schedule-time">${esc(m.timeBJT?.split(' ')[1]?.substring(0,5) || '')}</div>
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
            ${logo(m.home)}
            <span class="font-bold text-xs truncate">${esc(displayMaybeTeamName(m.home))}</span>
        </div>
        <div class="flex flex-col items-center px-2">
            <span class="${scoreCls} text-sm font-bold tabular-nums">${score}</span>
            ${live ? `<span class="text-[9px] text-red-400 font-bold animate-pulse">LIVE ${minute}</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 flex-1 min-w-0 justify-end text-right">
            <span class="font-bold text-xs truncate">${esc(displayMaybeTeamName(m.away))}</span>
            ${logo(m.away)}
        </div>
        <span class="text-[11px] ${statusCls} font-bold min-w-[40px] text-right">${esc(m.status)}</span>
    </div>`;
}


function logo(t) {
    if (t.logo) return `<img src="${attr(t.logo)}" class="w-7 h-7 object-contain shrink-0" loading="lazy" onerror="this.style.display='none'">`;
    if (t.flag) return `<span class="text-lg shrink-0">${esc(t.flag)}</span>`;
    return '';
}

// ========== Schedule ==========
async function loadSchedule() {
    const res = await API.get('/api/schedule');
    if (!res.ok || !res.data?.matches) {
        document.getElementById('schedule-list').innerHTML = `<div class="text-center py-10 text-gray-500">${tx('赛程加载失败', 'Failed to load schedule')}</div>`;
        return;
    }
    scheduleCache = res.data.matches;

    const byDate = {};
    scheduleCache.forEach(m => {
        const dt = m.dateBJT?.split(' ')[0] || '?';
        (byDate[dt] ??= []).push(m);
    });

    const dates = Object.keys(byDate).sort();
    
    // Determine Today and Yesterday strings in Asia/Shanghai
    const nowMs = Date.now();
    const tzStr = { timeZone: 'Asia/Shanghai' };
    const getMMDD = ms => {
        const parts = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', ...tzStr }).formatToParts(new Date(ms));
        return `${parts.find(p=>p.type==='month').value}/${parts.find(p=>p.type==='day').value}`;
    };
    const todayStr = getMMDD(nowMs);
    const yesterdayStr = getMMDD(nowMs - 86400000);

    let defaultDate = dates[dates.length - 1]; // fallback

    document.getElementById('date-bar').innerHTML = dates.map((d, i) => {
        const n = byDate[d].length;
        
        let label = esc(d); // e.g., "06/20"
        let extraCls = 'bg-white/5 hover:bg-white/10 text-gray-300';
        let specialIcon = '';
        
        if (d === todayStr) {
            label = uiLang === 'zh' ? '今天 ' + label : 'Today';
            extraCls = 'bg-blue-600/30 text-blue-400 border border-blue-500/50';
            specialIcon = '📍';
            defaultDate = d; // Set default to today
        } else if (d === yesterdayStr) {
            label = uiLang === 'zh' ? '昨天 ' + label : 'Yest.';
            extraCls = 'bg-gray-600/30 text-gray-400 border border-gray-500/50';
            if (!dates.includes(todayStr)) defaultDate = d; // fallback to yesterday if today has no matches
        }
        
        return `<button data-d="${attr(d)}" data-action="filter-date" data-date="${attr(d)}"
            class="date-btn snap-center shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-bold transition
            ${extraCls}">
            ${specialIcon} ${label} <span class="opacity-50 text-[10px] ml-1">${n}${uiLang === 'zh' ? '' : ' '}${esc(t('matchesSuffix'))}</span></button>`;
    }).join('');

    if (dates.length) {
        // If yesterday is available, set it as default selection just to "第一个昨天, 第二个今天" 
        // Actually user said: "默认位置：第一个是昨天，第二个是今天", meaning yesterday and today are the first VISIBLE elements when scrolling.
        // We will scroll the container to make Yesterday the first element visible, but select Today if it has matches.
        
        const selectionDate = dates.includes(todayStr) ? todayStr : defaultDate;
        filterDate(selectionDate);

        setTimeout(() => {
            const db = document.getElementById('date-bar');
            const targetBtn = db.querySelector(`[data-d="${yesterdayStr}"]`) || db.querySelector(`[data-d="${todayStr}"]`);
            if (targetBtn && db) {
                const targetLeft = targetBtn.offsetLeft - db.offsetLeft - 10;
                db.scrollTo({ left: targetLeft, behavior: 'smooth' });
            }
        }, 100);
    }

    const db = document.getElementById('date-bar');
    if (db && !db.dataset.wheelBound) {
        db.dataset.wheelBound = 'true';
        db.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                db.scrollLeft += e.deltaY;
            }
        });
        
        document.getElementById('date-scroll-left')?.addEventListener('click', () => {
            db.scrollBy({ left: -150, behavior: 'smooth' });
        });
        document.getElementById('date-scroll-right')?.addEventListener('click', () => {
            db.scrollBy({ left: 150, behavior: 'smooth' });
        });
    }
}

function filterDate(d) {
    document.querySelectorAll('.date-btn').forEach(b => {
        // Reset base classes, but keep the special border/bg for today/yesterday if needed
        // Actually, we can use an active state class that overrides
        b.classList.remove('ring-2', 'ring-white', 'text-white', 'scale-105');
        b.classList.add('opacity-70');
    });
    const activeBtn = document.querySelector(`[data-d="${CSS.escape(d)}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('opacity-70');
        activeBtn.classList.add('ring-2', 'ring-white', 'text-white', 'scale-105');
    }
    const list = scheduleCache.filter(m => m.dateBJT?.startsWith(d));
    document.getElementById('schedule-list').innerHTML = list.map(m => card(m)).join('');
}

// ========== Standings ==========
async function loadStandings() {
    const el = document.getElementById('groups-container');
    el.innerHTML = `<div class="text-center py-10 text-gray-500">${uiLang === 'zh' ? '加载积分榜...' : 'Loading table...'}</div>`;
    const res = await API.get('/api/standings');
    if (!res.ok || !res.data?.groups) {
        el.innerHTML = `<div class="text-center py-10 text-red-400">${uiLang === 'zh' ? '积分榜加载失败' : 'Table failed to load'}</div>`;
        return;
    }
    const d = res.data;
    let html = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">` + d.groups.map(g => `
        <div class="glass rounded-xl overflow-hidden">
            <div class="px-3 py-1.5 bg-white/5 text-[11px] font-bold">${esc(displayGroupName(g.name))}</div>
            <table class="w-full table-fixed text-[11px]">
                <colgroup>
                    <col style="width:20px">
                    <col>
                    <col style="width:26px">
                    <col style="width:26px">
                    <col style="width:26px">
                    <col style="width:26px">
                    <col style="width:30px">
                    <col style="width:32px">
                </colgroup>
                <thead><tr class="text-[10px] text-gray-500 border-b border-white/5">
                    <th class="text-left pl-2 py-1">#</th>
                    <th class="text-left py-1">${esc(t('team'))}</th>
                    <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('played'))}</th>
                    <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('wins'))}</th>
                    <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('draws'))}</th>
                    <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('losses'))}</th>
                    <th class="text-right py-1 pr-0.5 tabular-nums">${esc(t('goalDifference'))}</th>
                    <th class="text-right pr-2 py-1 font-bold tabular-nums">${esc(t('points'))}</th>
                </tr></thead>
                <tbody>${g.standings.map((t, i) => `
                    <tr class="border-b border-white/[0.03] hover:bg-white/[0.03] transition">
                        <td class="pl-2 py-1.5 text-gray-600">${i+1}</td>
                        <td class="py-1.5"><div class="flex items-center gap-1">
                            ${t.logo ? `<img src="${attr(t.logo)}" class="w-3.5 h-3.5 object-contain flex-shrink-0" onerror="this.style.display='none'">` : ''}
                            <span class="font-medium truncate cursor-pointer hover:text-blue-400 transition max-w-full" data-action="open-team-detail" data-team-id="${attr(t.id)}" data-team-name="${attr(t.name)}" data-group="${attr(g.name)}">${esc(displayMaybeTeamName(t))}</span>
                        </div></td>
                        <td class="text-right py-1.5 text-gray-500 tabular-nums pr-0.5">${t.played}</td>
                        <td class="text-right py-1.5 tabular-nums pr-0.5">${t.wins}</td>
                        <td class="text-right py-1.5 tabular-nums pr-0.5">${t.draws}</td>
                        <td class="text-right py-1.5 tabular-nums pr-0.5">${t.losses}</td>
                        <td class="text-right py-1.5 tabular-nums pr-0.5 ${+t.gd>0?'text-green-400':+t.gd<0?'text-red-400':''}">${t.gd}</td>
                        <td class="text-right pr-2 py-1.5 font-bold text-blue-400 tabular-nums">${t.pts}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `).join('') + `</div>`;

    // Append Knockout Stage placeholder
    html += `<div class="mt-4 glass rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-3 text-orange-400 font-bold text-xs">
            <span>🏆</span>
            <span>${tx('后期淘汰赛', 'Knockout Stage')}</span>
        </div>
        <div id="bracket-container-standings" class="w-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide text-center flex justify-center min-h-[200px]">
            <div class="text-gray-500 py-10">${tx('加载对阵图...', 'Loading bracket...')}</div>
        </div>
    </div>`;

    el.innerHTML = html;
    
    // Load bracket
    fetch('/static/bracket-data.json').then(r=>r.json()).then(data => {
        const container = document.getElementById('bracket-container-standings');
        if (container) {
            container.innerHTML = '';
            renderBracket(data, container);
            // Auto-scroll to center (Final match) after render
            setTimeout(() => {
                const wrap = container.querySelector('#bk-wrap');
                if (wrap) container.scrollLeft = (wrap.scrollWidth - container.clientWidth) / 2;
            }, 100);
        }
    }).catch(e => {
        const container = document.getElementById('bracket-container-standings');
        if (container) container.innerHTML = `<div class="text-gray-500 py-10">${tx('淘汰赛对阵图将在小组赛结束后生成', 'Knockout bracket will be generated after group stage.')}</div>`;
    });
}

// ========== Match Detail ==========
async function openMatch(id) {
    const modal = document.getElementById('match-modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="py-10 text-center text-gray-500">${tx('加载中...', 'Loading...')}</div>`;

    // Fetch match + formation in parallel using API client
    const [matchData, matchupData] = await API.allData([
        '/api/match/' + id,
        '/api/matchup/' + id + '/formation',
    ]);

    if (!matchData) { content.innerHTML = `<div class="py-10 text-center text-red-400">${tx('加载失败', 'Failed to load')}</div>`; return; }
    const scheduledMatch = scheduleCache.find(m => String(m.id) === String(id)) || {};
    const isFinishedMatch = scheduledMatch.state === 'post' || matchData.state === 'post';

    let html = `<h3 class="font-bold text-base mb-4">${tx('比赛详情', 'Match Details')}</h3>`;

    // === ⚔️ 对位阵型图（第一位） ===
    html += `<div class="mb-4">${window.WorldCup.MatchRenderers.renderFormation(matchupData, isFinishedMatch)}</div>`;

    // === 🏟️ 场地 & 天气 ===
    html += `<div id="detail-content-venue" class="detail-content">
        <div class="flex items-center gap-2 mb-3">
            <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <span class="text-xs text-gray-500">${tx('加载场地天气数据...', 'Loading venue and weather...')}</span>
        </div>
    </div>`;
    
    // Prefer the schedule's venue name: upstream venue IDs differ from local IDs.
    const knownVenue = scheduledMatch.venue || matchData.venue || '';
    const loadVenue = () => {
        const venueEl = document.getElementById('detail-content-venue');
        if (venueEl && knownVenue) venueEl.innerHTML = `<div class="text-gray-500 text-xs py-2">🏟️ ${tx('已知场馆', 'Known venue')}: ${esc(knownVenue)} · ${tx('加载场地资料...', 'Loading venue details...')}</div>`;
        if (knownVenue) {
            api('/api/venue/' + encodeURIComponent(knownVenue)).then(venueData => {
                const el = document.getElementById('detail-content-venue');
                if (el && venueData && !venueData.error && !venueData.note) el.innerHTML = renderVenueWeather(venueData);
                else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('场地资料未同步；不以当前天气替代比赛时段天气。', 'Venue details are not synced; current weather is not substituted for match-time weather.')}</div>`;
            }).catch(() => {
                const el = document.getElementById('detail-content-venue');
                if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('场地资料暂不可用；不以当前天气替代比赛时段天气。', 'Venue details are unavailable; current weather is not substituted for match-time weather.')}</div>`;
            });
        } else if (venueEl) {
            venueEl.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('场馆信息未随比赛数据返回。', 'Venue information was not returned with match data.')}</div>`;
        }
    };
    
    // === 🔄 替补席分析 ===
    html += `<div id="detail-content-bench" class="detail-content hidden">
        <div class="flex items-center gap-2 mb-3">
            <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <span class="text-xs text-gray-500">${tx('加载替补席数据...', 'Loading bench data...')}</span>
        </div>
    </div>`;
    
    // Load bench data async
    api('/api/match/' + id + '/bench').then(benchData => {
        const el = document.getElementById('detail-content-bench');
        if (el && benchData && !benchData.error) {
            el.innerHTML = window.WorldCup.MatchRenderers.renderBenchAnalysis(benchData, isFinishedMatch);
            // Apply real substitutions to the formation pitch if available
            if (benchData.realSubstitutions && benchData.realSubstitutions.length > 0) {
                window.WorldCup.MatchRenderers.applySubstitutionsToFormation(benchData.realSubstitutions);
            }
        }
        else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${isFinishedMatch ? tx('官方替补与换人数据尚未同步；不使用评分估计冒充实际换人。', 'Official bench and substitution data is not synced; estimates are not shown as actual substitutions.') : tx('替补席数据暂无', 'No bench data')}</div>`;
    });
    
    // === 📰 新闻 ===
    html += `<div id="detail-content-news" class="detail-content hidden">
        <div class="flex items-center gap-2 mb-3">
            <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <span class="text-xs text-gray-500">${tx('加载新闻数据...', 'Loading news...')}</span>
        </div>
    </div>`;
    
    // Load news data async
    api('/api/match/' + id + '/news').then(newsData => {
        const el = document.getElementById('detail-content-news');
        if (el && newsData && !newsData.error) el.innerHTML = renderNewsList(newsData);
        else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('新闻数据暂无', 'No news data')}</div>`;
    });
    
    // === ⚔️ 历史交锋 ===
    html += `<div id="detail-content-h2h" class="detail-content hidden">
        <div class="flex items-center gap-2 mb-3">
            <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <span class="text-xs text-gray-500">${tx('加载历史交锋数据...', 'Loading head-to-head data...')}</span>
        </div>
    </div>`;
    
    // Load head-to-head data async
    withClientTimeout(api('/api/h2h/' + id), 8000).then(h2hData => {
        const el = document.getElementById('detail-content-h2h');
        if (el && h2hData && !h2hData.error) el.innerHTML = renderHeadToHead(h2hData);
        else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('ESPN 暂无历史交锋样本，或请求暂时超时', 'No ESPN head-to-head sample, or the request timed out')}</div>`;
    });

    // === 📊 数据 Tab 区 ===
    const showPreMatch = !isFinishedMatch && (scheduledMatch.state === 'pre' || (matchData.status?.type?.name || '').includes('SCHEDULED'));
    html += `<div class="mt-4">
        <div class="flex gap-1.5 mb-3 overflow-x-auto" id="detail-tabs">
            ${showPreMatch ? `<button data-action="switch-detail-tab" data-detail-tab="pre-match" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white transition">🧠 ${tx('赛前预测', 'Pre-Match')}</button>` : ''}
            <button data-action="switch-detail-tab" data-detail-tab="review" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold ${showPreMatch ? 'bg-white/5 text-gray-400' : 'bg-white/10 text-white'} transition">📋 ${tx('回顾', 'Review')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="venue" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">🏟️ ${tx('场地', 'Venue')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="bench" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">🔄 ${tx('替补', 'Bench')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="news" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">📰 ${tx('新闻', 'News')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="h2h" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">⚔️ ${tx('交锋', 'H2H')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="stats" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">📊 ${tx('统计', 'Stats')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="corners" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">📐 ${tx('角球', 'Corners')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="coach" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition">🧠 ${tx('教练', 'Coach')}</button>
        </div>
        ${showPreMatch ? `<div id="detail-content-pre-match" class="detail-content">
            <div class="flex items-center gap-2 mb-3">
                <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                <span class="text-xs text-gray-500">${tx('加载赛前预测...', 'Loading pre-match prediction...')}</span>
            </div>
        </div>` : ''}
        <!-- Review Tab (match review + bias analysis) -->
        <div id="detail-content-review" class="detail-content">
            <div class="flex items-center gap-2 mb-3">
                <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                <span class="text-xs text-gray-500">${tx('加载比赛回顾...', 'Loading match review...')}</span>
            </div>
        </div>
        <div id="detail-content-stats" class="detail-content">`;

    // Stats tab — 进球 + 技术统计
    if (matchData.goals?.length) {
        html += `<h4 class="text-xs font-bold text-gray-500 mb-2">⚽ ${tx('进球', 'Goals')}</h4>`;
        html += matchData.goals.map(g => `
            <div class="flex items-center gap-2 text-xs py-1">
                <span class="text-gray-500 w-10">${esc(g.minute)}</span>
                <span class="font-medium">${esc(g.player)}</span>
                <span class="text-gray-600">(${esc(g.team)})</span>
            </div>
        `).join('');
    } else { html += `<div class="text-gray-600 text-sm mb-2">${tx('暂无进球数据', 'No goal data')}</div>`; }

    if (matchData.teamStats?.length) {
        html += `<h4 class="text-xs font-bold text-gray-500 mb-2 mt-3">📊 ${tx('技术统计', 'Match Stats')}</h4>`;
        html += renderMatchStats(matchData.teamStats);
    }

    html += `</div>`;  // close stats

    // Corners tab
    html += `<div id="detail-content-corners" class="detail-content hidden">
        <div class="flex items-center gap-2 mb-3">
            <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <span class="text-xs text-gray-500">${tx('加载角球数据...', 'Loading corner data...')}</span>
        </div>
    </div>`;

    // Coach tab
    html += `<div id="detail-content-coach" class="detail-content hidden">
        <div class="text-gray-500 text-xs py-4 text-center">${tx('教练数据加载中...', 'Loading coach data...')}</div>
    </div>`;

    html += '</div>'; // close detail tabs

    content.innerHTML = html;
    loadVenue();

    // Load pre-match prediction async (only for pre/scheduled matches)
    if (showPreMatch) {
        api('/api/predict/' + id).then(pred => {
            const el = document.getElementById('detail-content-pre-match');
            if (el && pred && !pred.error && pred.homeWin !== undefined) {
                el.innerHTML = renderPreMatchPrediction(pred);
            } else if (el) {
                el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction data unavailable')}</div>`;
            }
        }).catch(() => {
            const el = document.getElementById('detail-content-pre-match');
            if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction data unavailable')}</div>`;
        });
    }

    // Load corner analysis async
    api('/api/corner-analysis/' + id).then(corner => {
        const el = document.getElementById('detail-content-corners');
        if (el && corner) el.innerHTML = renderCornerAnalysis(corner);
        else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('角球数据暂无', 'No corner data')}</div>`;
    });

    // Load match review (for finished/post matches) async
    // Use schedule data for team IDs and scores (more reliable than /api/match/:id)
    const schedMatch = scheduledMatch;
    const isFinished = schedMatch.state === 'post' || matchData.state === 'post' || matchData.status?.type === 'STATUS_FINAL';
    const mHomeId = schedMatch.home?.id || matchData.home?.id || matchData.homeId;
    const mAwayId = schedMatch.away?.id || matchData.away?.id || matchData.awayId;
    const mHomeScore = parseInt(schedMatch.home?.score ?? matchData.home?.score ?? matchData.homeScore ?? '0');
    const mAwayScore = parseInt(schedMatch.away?.score ?? matchData.away?.score ?? matchData.awayScore ?? '0');
    if (isFinished && mHomeId && mAwayId && mHomeScore >= 0 && mAwayScore >= 0) {
        // T05: 只读取review，不自动生成。如果不存在，显示诚实的空状态。
        fetch('/api/post-match-review/' + id)
        .then(r => r.json())
        .then(async review => {
            if (review && !review.error) {
                // Review存在，补充预测数据（如果缺失）
                if (!review.aiPrediction) {
                    const pred = await api('/api/predict/' + id);
                    if (pred && !pred.error && pred.homeWin !== undefined) {
                        review.aiPrediction = {
                            homeWin: Math.round((pred.homeWin || 0) * 1000) / 10,
                            draw: Math.round((pred.draw || 0) * 1000) / 10,
                            awayWin: Math.round((pred.awayWin || 0) * 1000) / 10,
                            predictedScore: pred.likelyScore || '',
                            homeExpectedGoals: pred.goals?.homeExpected ?? null,
                            awayExpectedGoals: pred.goals?.awayExpected ?? null,
                            source: 'current_model',
                        };
                        review.predictionSourceNote = tx(
                            '赛前预测快照缺失，以下为当前模型参考',
                            'Pre-match snapshot missing; showing current model reference'
                        );
                    }
                }
                const el = document.getElementById('detail-content-review');
                if (el) el.innerHTML = renderMatchReview(review);
            } else {
                // T05: Review不存在，显示诚实的空状态，不尝试生成
                const el = document.getElementById('detail-content-review');
                if (el) {
                    el.innerHTML = `<div class="review-unavailable">
                        <p>${tx('赛后复盘暂未生成', 'Post-match review not yet available')}</p>
                        <p class="text-muted">${tx('该比赛的赛后复盘尚未生成，请稍后再试', 'The post-match review for this match has not been generated yet. Please try again later.')}</p>
                    </div>`;
                }
            }
        }).catch(() => {
            const el = document.getElementById('detail-content-review');
            if (el) el.innerHTML = '<div class="text-gray-500 text-xs py-4 text-center">比赛回顾暂不可用</div>';
        });
    } else {
        const el = document.getElementById('detail-content-review');
        if (el) el.innerHTML = '<div class="text-gray-500 text-xs py-4 text-center">⏳ 比赛结束后自动生成回顾</div>';
    }
    // Load coach data async
    // Will be populated when team IDs are available
}

function switchDetailTab(tab, btn) {
    document.querySelectorAll('.detail-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.detail-tab').forEach(el => { el.classList.remove('bg-white/10', 'text-white'); el.classList.add('bg-white/5', 'text-gray-400'); });
    document.getElementById('detail-content-' + tab)?.classList.remove('hidden');
    if (btn) { btn.classList.remove('bg-white/5', 'text-gray-400'); btn.classList.add('bg-white/10', 'text-white'); }
}

function renderPreMatchPrediction(pred) {
    if (!pred || pred.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('预测数据加载失败', 'Prediction data unavailable')}</div>`;

    const homeName = displayMaybeTeamName(pred.match?.homeNameI18n || pred.match?.homeName || '主队');
    const awayName = displayMaybeTeamName(pred.match?.awayNameI18n || pred.match?.awayName || '客队');

    // Elo scores (from components.elo)
    const eloHome = Fmt.safeNum(pred.components?.elo?.home, 0);
    const eloAway = Fmt.safeNum(pred.components?.elo?.away, 0);
    const eloTotal = eloHome + eloAway || 1;
    const eloHomePct = Math.round((eloHome / eloTotal) * 100);
    const eloAwayPct = 100 - eloHomePct;
    const eloDiff = Math.abs(eloHome - eloAway).toFixed(3);

    // Win/Draw/Away probabilities
    const hw = Fmt.pctBar(pred.homeWin);
    const dr = Fmt.pctBar(pred.draw);
    const aw = Fmt.pctBar(pred.awayWin);

    // Poisson λ
    const homeLambda = Fmt.safeNum(pred.goals?.homeExpected || pred.components?.poisson?.homeLambda, 0).toFixed(2);
    const awayLambda = Fmt.safeNum(pred.goals?.awayExpected || pred.components?.poisson?.awayLambda, 0).toFixed(2);

    let html = `<div class="space-y-3">
        <!-- Elo Comparison -->
        <div class="pred-section">
            <div class="pred-section-title text-purple-400">
                <span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">⚡</span>
                ${tx('Elo 实力对比', 'Elo Comparison')}
            </div>
            <div class="space-y-2">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold w-20 truncate">${esc(homeName)}</span>
                    <div class="elo-bar flex-1">
                        <div class="elo-bar-fill" style="width:${eloHomePct}%"></div>
                    </div>
                    <span class="text-xs font-mono font-bold text-purple-400 w-12 text-right">${eloHomePct}%</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold w-20 truncate">${esc(awayName)}</span>
                    <div class="elo-bar flex-1">
                        <div class="elo-bar-fill" style="width:${eloAwayPct}%"></div>
                    </div>
                    <span class="text-xs font-mono font-bold text-purple-400 w-12 text-right">${eloAwayPct}%</span>
                </div>
                <div class="text-[10px] text-gray-500 text-center mt-1.5">
                    ${tx('Elo 差值', 'Elo Diff')}: ${eloDiff}
                </div>
            </div>
        </div>

        <!-- Win/Draw/Loss Probability Bar -->
        <div class="pred-section">
            <div class="pred-section-title text-blue-400">
                <span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">🎯</span>
                ${tx('胜平负概率', 'W/D/L Probability')}
            </div>
            <div class="prob-bar mb-2">
                <div class="prob-bar-home" style="width:${hw}%">${hw > 12 ? hw + '%' : ''}</div>
                <div class="prob-bar-draw" style="width:${dr}%">${dr > 10 ? dr + '%' : ''}</div>
                <div class="prob-bar-away" style="width:${aw}%">${aw > 12 ? aw + '%' : ''}</div>
            </div>
            <div class="flex justify-between text-[11px]">
                <span class="text-green-400 font-bold">${tx('主胜', 'Home')} ${hw}%</span>
                <span class="text-yellow-400 font-bold">${tx('平局', 'Draw')} ${dr}%</span>
                <span class="text-red-400 font-bold">${tx('客胜', 'Away')} ${aw}%</span>
            </div>
        </div>

        <!-- Poisson Expected Goals -->
        <div class="pred-section">
            <div class="pred-section-title text-emerald-400">
                <span class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">📊</span>
                ${tx('进球期望值 (λ)', 'Expected Goals (λ)')}
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div class="elo-card">
                    <div class="text-xs font-bold mb-1.5 text-emerald-300">${esc(homeName)}</div>
                    <div class="text-sm font-mono font-bold text-emerald-400">${homeLambda}</div>
                    <div class="text-[10px] text-gray-500 mt-0.5">${tx('场均进球', 'Avg Goals')}</div>
                </div>
                <div class="elo-card">
                    <div class="text-xs font-bold mb-1.5 text-red-300">${esc(awayName)}</div>
                    <div class="text-sm font-mono font-bold text-red-400">${awayLambda}</div>
                    <div class="text-[10px] text-gray-500 mt-0.5">${tx('场均进球', 'Avg Goals')}</div>
                </div>
            </div>
        </div>
        ${pred.tacticalScenario && pred.tacticalScenario.applicable ? renderTacticalScenario(pred.tacticalScenario) : ''}
    </div>`;

    return html;
}

// 末轮战略情境面板:出线场景 + 同时进行的另一场 + 下轮避强对阵(确定性,非概率)
function renderTacticalScenario(ts) {
    const L = (o) => esc(i18nText(o, ''));
    const focusIds = Object.keys(ts.teams || {});

    // 当前积分榜(高亮本场两队)
    const standings = (ts.standings || []).map(s => {
        const focus = focusIds.includes(s.id);
        return `<div class="flex items-center gap-2 text-[10px] py-0.5 ${focus ? 'text-white font-semibold' : 'text-gray-400'}">
            <span class="w-4 text-gray-500">${s.rank}</span>
            <span class="flex-1 truncate">${L(s.name)}</span>
            <span class="w-7 text-right font-mono">${s.pts}</span>
            <span class="w-8 text-right font-mono text-gray-500">${s.gd >= 0 ? '+' : ''}${s.gd}</span>
        </div>`;
    }).join('');

    const row = (label, sc) => {
        if (!sc) return '';
        const dep = sc.gdDependent;
        return `<div class="flex justify-between text-[10px] py-0.5">
            <span class="text-gray-500">${label}</span>
            <span class="font-semibold ${dep ? 'text-amber-400' : 'text-gray-200'}">${L(sc.status)}</span>
        </div>`;
    };

    const oppLine = (label, info) => (info && info.opponent) ? `<div class="flex justify-between text-[10px]">
            <span class="text-gray-500">${label}</span>
            <span class="text-gray-300 text-right">${L(info.opponent.label)}${info.opponent.elo ? ` <span class="text-gray-500">Elo ${info.opponent.elo}</span>` : ''}</span>
        </div>` : '';

    const teamCards = Object.values(ts.teams || {}).map(t => {
        const locked = t.locked
            ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">${L(t.locked)}</span>`
            : '';
        const br = t.bracket || {};
        const inc = br.incentive
            ? `<div class="text-[10px] text-amber-300/90 mt-1 leading-snug">⚠ ${L(br.incentive.note)}</div>`
            : '';
        return `<div class="elo-card">
            <div class="flex items-center justify-between mb-1 gap-1">
                <span class="text-xs font-bold truncate">${L(t.name)}</span>
                ${locked}
            </div>
            ${row(tx('胜', 'Win'), t.ifWin)}
            ${row(tx('平', 'Draw'), t.ifDraw)}
            ${row(tx('负', 'Lose'), t.ifLose)}
            <div class="border-t border-white/5 mt-1.5 pt-1.5 space-y-0.5">
                <div class="text-[9px] text-gray-500 mb-0.5">${tx('下一轮对阵 (R32)', 'Next round (R32)')}</div>
                ${oppLine(tx('若第一', 'If 1st'), br.asFirst)}
                ${oppLine(tx('若第二', 'If 2nd'), br.asSecond)}
                ${inc}
            </div>
        </div>`;
    }).join('');

    const notes = (ts.notes || []).map(n => `<div class="text-[10px] text-amber-300/90 leading-snug">• ${L(n)}</div>`).join('');

    return `<div class="pred-section">
        <div class="pred-section-title text-amber-400">
            <span class="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs">🎲</span>
            ${tx('末轮战略情境', 'Final-Round Scenario')}
            <span class="text-[9px] text-gray-500 font-normal ml-1">${tx('情境推演·非比分预测', 'scenario · not a forecast')}</span>
        </div>
        <div class="glass-light rounded-lg p-2 mb-2">
            <div class="text-[9px] text-gray-500 mb-1">${tx('小组', 'Group')} ${esc(ts.groupLetter || '')} · ${tx('当前积分榜', 'current table')}</div>
            ${standings}
            <div class="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-white/5">
                ${tx('同时进行', 'Simultaneous')}: ${L(ts.parallelMatch && ts.parallelMatch.homeName)} vs ${L(ts.parallelMatch && ts.parallelMatch.awayName)}
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2">${teamCards}</div>
        ${notes ? `<div class="mt-2 space-y-1">${notes}</div>` : ''}
        <div class="text-[9px] text-gray-600 mt-2 leading-snug">${L(ts.disclaimer)}</div>
    </div>`;
}

function renderCornerAnalysis(data) {
    if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('数据暂无', 'No data')}</div>`;
    const p = data.predicted;
    const o = data.odds;
    const r = data.realtime;
    const h = data.historical;
    const trend = r.trend || 'neutral';
    const trendEmoji = trend === 'over_strong' ? '🔴' : trend === 'over_slight' ? '🟠' : trend === 'under_strong' ? '🔵' : trend === 'under_slight' ? '🟤' : '⚪';
    const conf = r.confidence === 'high' ? '🟢' : r.confidence === 'medium' ? '🟡' : '⚪';
    
    // Enhanced progress bar with real-time tracking
    const progressPct = Math.min(100, ((r.current?.total || 0) / (o?.line || 9.5)) * 100);
    const expectedPct = r.progress?.expected || 0;
    const paceStatus = r.pace === 'above' ? `⚡${tx('节奏快', 'Fast pace')}` : r.pace === 'below' ? `• ${tx('节奏慢', 'Slow pace')}` : `✓${tx('正常', 'Normal')}`;
    const paceColor = r.pace === 'above' ? 'text-yellow-400' : r.pace === 'below' ? 'text-blue-400' : 'text-green-400';
    
    return `
    <div class="space-y-3">
        <!-- Main Prediction Card -->
        <div class="glass-light rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-400">📐 ${tx('角球预测', 'Corner Forecast')}</span>
                <span class="text-xs text-gray-500">${tx('盘口线', 'Line')} <span class="font-bold text-white">${o?.line || 9.5}</span></span>
            </div>
            
            <!-- Prediction vs Actual -->
            <div class="flex items-center gap-3 mb-3">
                <div class="text-center">
                    <div class="text-2xl font-bold text-white">${p?.total || '-'}</div>
                    <div class="text-[11px] text-gray-500">${tx('预测总角球', 'Projected Corners')}</div>
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-1 mb-1">
                        <span class="text-xs">${trendEmoji}</span>
                        <span class="text-xs font-bold ${trend.includes('over') ? 'text-red-400' : trend.includes('under') ? 'text-blue-400' : 'text-gray-400'}">${esc(trend.replace('_', ' ').toUpperCase())}</span>
                        <span class="ml-auto">${conf}</span>
                    </div>
                    <div class="text-[11px] text-gray-500">
                        ${tx('实际', 'Actual')} <span class="font-bold text-white">${r.current?.total || 0}</span> / ${o?.line || 9.5}
                    </div>
                </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="relative h-4 bg-white/5 rounded-full overflow-hidden mb-2">
                <!-- Expected progress line -->
                <div class="absolute top-0 bottom-0 w-0.5 bg-yellow-500/50" style="left:${expectedPct}%"></div>
                <!-- Actual progress -->
                <div class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700" style="width:${progressPct}%"></div>
                <!-- Labels -->
                <div class="absolute inset-0 flex items-center justify-between px-2 text-[9px]">
                    <span class="text-white font-bold">${r.current?.total || 0}</span>
                    <span class="text-gray-400">${Math.round(progressPct)}%</span>
                </div>
            </div>
            
            <!-- Pace Indicator -->
            <div class="flex items-center justify-between text-[11px]">
                <span class="text-gray-500">${esc(translateCoachField(h?.homeStyle, 'style') || tx('均衡型', 'Balanced'))} ${tx('对阵', 'vs')} ${esc(translateCoachField(h?.awayStyle, 'style') || tx('均衡型', 'Balanced'))}</span>
                <span class="${paceColor} font-bold">${paceStatus}</span>
            </div>
            
            <!-- Projection -->
            ${r.projection ? `
            <div class="mt-2 pt-2 border-t border-white/5">
                <div class="flex items-center justify-between text-[11px]">
                    <span class="text-gray-500">${tx('全场投影', 'Full-time Projection')}</span>
                    <span class="font-bold ${r.projection > (o?.line || 9.5) ? 'text-red-400' : 'text-blue-400'}">${r.projection}</span>
                </div>
                <div class="text-[11px] text-gray-600 mt-1">
                    ${r.projection > (o?.line || 9.5) ? `🔴 ${tx('倾向大球', 'Lean over')}` : `🔵 ${tx('倾向小球', 'Lean under')}`} (${tx('差值', 'Diff')}: ${r.vsOddsLine > 0 ? '+' : ''}${r.vsOddsLine})
                </div>
            </div>
            ` : ''}
        </div>
        
        <!-- Team Stats -->
        <div class="grid grid-cols-2 gap-2">
            <div class="glass-light rounded-lg p-2">
                <div class="text-[11px] text-gray-500 mb-1">🔵 ${tx('主队', 'Home')}</div>
                <div class="text-sm font-bold">${h?.homeAvg || '-'} ${tx('场均', 'avg')}</div>
                <div class="text-[11px] text-gray-600">${esc(translateCoachField(h?.homeStyle, 'style') || tx('均衡型', 'Balanced'))} (${esc(h?.homeStyleCoeff) || 1}x)</div>
            </div>
            <div class="glass-light rounded-lg p-2">
                <div class="text-[11px] text-gray-500 mb-1">🔴 ${tx('客队', 'Away')}</div>
                <div class="text-sm font-bold">${h?.awayAvg || '-'} ${tx('场均', 'avg')}</div>
                <div class="text-[11px] text-gray-600">${esc(translateCoachField(h?.awayStyle, 'style') || tx('均衡型', 'Balanced'))} (${esc(h?.awayStyleCoeff) || 1}x)</div>
            </div>
        </div>
        
        <!-- Verdict -->
        ${data.verdict?.reason || data.verdict?.reasonI18n ? `
        <div class="glass-light rounded-lg p-2">
            <div class="text-[11px] text-gray-500 mb-1">📊 ${tx('分析结论', 'Verdict')}</div>
            <div class="text-xs text-gray-300">${esc(i18nText(data.verdict.reasonI18n, data.verdict.reason || ''))}</div>
        </div>
        ` : ''}
    </div>`;
}

function renderVenueWeather(data) {
    if (!data) return '<div class="text-gray-500 text-xs py-4 text-center">数据暂无</div>';
    const v = data;
    const w = v.weather;
    const impact = v.impact;
    
    // Weather icon
    const weatherIcon = w ? (
        w.condition === 'Clear' ? '☀️' :
        w.condition === 'Clouds' ? '☁️' :
        w.condition === 'Rain' ? '🌧️' :
        w.condition === 'Snow' ? '❄️' :
        w.condition === 'Thunderstorm' ? '⛈️' :
        '🌤️'
    ) : '🌤️';
    
    // Impact color
    const impactColor = impact?.overall > 10 ? 'text-green-400' : 
                        impact?.overall < -10 ? 'text-red-400' : 'text-yellow-400';
    const impactEmoji = impact?.overall > 10 ? '✅' : 
                        impact?.overall < -10 ? '⚠️' : '➡️';
    
    // Grass type icon
    const grassIcon = v.grass?.includes('人工') ? '🟢' : 
                      v.grass?.includes('混合') ? '🟡' : '🌿';
    
    // Roof status
    const roofIcon = v.roof === 'closed' ? '🏟️' : 
                     v.roof === 'retractable' ? '🔄' : '☁️';
    
    return `
    <div class="space-y-3">
        <!-- Venue Info -->
        <div class="glass-light rounded-lg p-3">
            <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">${roofIcon}</span>
                <div>
                    <div class="font-bold text-sm">${esc(v.name) || '未知场馆'}</div>
                    <div class="text-[11px] text-gray-500">${esc(v.city) || ''}, ${esc(v.country) || ''}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">容量</span>
                    <span class="font-bold ml-1">${v.capacity?.toLocaleString() || '-'}</span>
                </div>
                <div>
                    <span class="text-gray-500">海拔</span>
                    <span class="font-bold ml-1">${v.altitude || 0}m</span>
                </div>
                <div>
                    <span class="text-gray-500">草皮</span>
                    <span class="ml-1">${grassIcon} ${esc(v.grass) || '未知'}</span>
                </div>
                <div>
                    <span class="text-gray-500">屋顶</span>
                    <span class="ml-1">${v.roof === 'closed' ? '封闭' : v.roof === 'retractable' ? '可伸缩' : '开放'}</span>
                </div>
            </div>
        </div>
        
        <!-- Weather Info -->
        ${w ? `
        <div class="glass-light rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-400">${weatherIcon} 天气状况</span>
                <span class="text-[11px] text-gray-500">${esc(w.description) || ''}</span>
            </div>
            
            <div class="grid grid-cols-3 gap-3 text-center">
                <div>
                    <div class="text-xl font-bold">${esc(w.temp) || '-'}°C</div>
                    <div class="text-[11px] text-gray-500">温度</div>
                    <div class="text-[11px] text-gray-600">体感 ${esc(w.feelsLike) || '-'}°C</div>
                </div>
                <div>
                    <div class="text-xl font-bold">${esc(w.humidity) || '-'}%</div>
                    <div class="text-[11px] text-gray-500">湿度</div>
                </div>
                <div>
                    <div class="text-xl font-bold">${w.windSpeed ? esc(Math.round(w.windSpeed)) : '-'}</div>
                    <div class="text-[11px] text-gray-500">风速 km/h</div>
                </div>
            </div>
        </div>
        ` : `
        <div class="glass-light rounded-lg p-3">
            <div class="text-center text-gray-500 text-xs">
                <div class="mb-1">🌤️ 天气数据</div>
                <div>暂无实时天气 (需配置 OWM API Key)</div>
            </div>
        </div>
        `}
        
        <!-- Impact Analysis -->
        ${impact ? `
        <div class="glass-light rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-400">📊 场地影响分析</span>
                <span class="text-xs ${impactColor} font-bold">${impactEmoji} ${impact.overall > 0 ? '+' : ''}${esc(impact.overall)}</span>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-[11px] mb-2">
                <div>
                    <span class="text-gray-500">进攻</span>
                    <span class="font-bold ml-1 ${impact.attack > 0 ? 'text-green-400' : impact.attack < 0 ? 'text-red-400' : ''}">${impact.attack > 0 ? '+' : ''}${esc(impact.attack)}%</span>
                </div>
                <div>
                    <span class="text-gray-500">防守</span>
                    <span class="font-bold ml-1 ${impact.defense > 0 ? 'text-green-400' : impact.defense < 0 ? 'text-red-400' : ''}">${impact.defense > 0 ? '+' : ''}${esc(impact.defense)}%</span>
                </div>
                <div>
                    <span class="text-gray-500">控球</span>
                    <span class="font-bold ml-1 ${impact.possession > 0 ? 'text-green-400' : impact.possession < 0 ? 'text-red-400' : ''}">${impact.possession > 0 ? '+' : ''}${esc(impact.possession)}%</span>
                </div>
                <div>
                    <span class="text-gray-500">体能</span>
                    <span class="font-bold ml-1 ${impact.physical > 0 ? 'text-green-400' : impact.physical < 0 ? 'text-red-400' : ''}">${impact.physical > 0 ? '+' : ''}${esc(impact.physical)}%</span>
                </div>
            </div>
            
            ${impact.details?.length ? `
            <div class="border-t border-white/5 pt-2">
                ${impact.details.map(d => `<div class="text-[11px] text-gray-400 mb-1">• ${esc(d)}</div>`).join('')}
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Style Fit Analysis -->
        ${data.styleFit ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-gray-400 mb-2">🎯 战术适配分析</div>
            
            <div class="space-y-2">
                <div class="flex items-center justify-between text-[11px]">
                    <span>控球型</span>
                    <span class="font-bold ${data.styleFit.possession?.fit === 'good' ? 'text-green-400' : data.styleFit.possession?.fit === 'medium' ? 'text-yellow-400' : 'text-red-400'}">${data.styleFit.possession?.fit === 'good' ? '✅ 有利' : data.styleFit.possession?.fit === 'medium' ? '⚠️ 一般' : '❌ 不利'}</span>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                    <span>快速反击</span>
                    <span class="font-bold ${data.styleFit.counterAttack?.fit === 'good' ? 'text-green-400' : data.styleFit.counterAttack?.fit === 'medium' ? 'text-yellow-400' : 'text-red-400'}">${data.styleFit.counterAttack?.fit === 'good' ? '✅ 有利' : data.styleFit.counterAttack?.fit === 'medium' ? '⚠️ 一般' : '❌ 不利'}</span>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                    <span>高压逼抢</span>
                    <span class="font-bold ${data.styleFit.highPress?.fit === 'good' ? 'text-green-400' : data.styleFit.highPress?.fit === 'medium' ? 'text-yellow-400' : 'text-red-400'}">${data.styleFit.highPress?.fit === 'good' ? '✅ 有利' : data.styleFit.highPress?.fit === 'medium' ? '⚠️ 一般' : '❌ 不利'}</span>
                </div>
            </div>
        </div>
        ` : ''}
    </div>`;
}



function renderNewsList(data) {
    if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('数据暂无', 'No data')}</div>`;
    
    const news = data.news || [];
    const source = data.source || 'unknown';
    
    // Importance icon
    const getImportanceIcon = (importance) => {
        switch(importance) {
            case 'red': return '🔴';
            case 'yellow': return '🟡';
            case 'green': return '🟢';
            default: return '⚪';
        }
    };
    
    // Importance color
    const getImportanceColor = (importance) => {
        switch(importance) {
            case 'red': return 'border-red-500/30';
            case 'yellow': return 'border-yellow-500/30';
            case 'green': return 'border-green-500/30';
            default: return 'border-white/10';
        }
    };
    
    // Type icon
    const getTypeIcon = (type) => {
        switch(type) {
            case 'injury': return '🏥';
            case 'lineup': return '📋';
            case 'tactical': return '🧠';
            case 'coach': return '👔';
            case 'transfer': return '💰';
            case 'history': return '📊';
            default: return '📰';
        }
    };
    
    // Format time
    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffHours < 1) return tx('刚刚', 'Just now');
        if (diffHours < 24) return uiLang === 'en' ? `${diffHours}h ago` : `${diffHours}小时前`;
        if (diffDays < 7) return uiLang === 'en' ? `${diffDays}d ago` : `${diffDays}天前`;
        return date.toLocaleDateString(uiLang === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' });
    };
    
    return `
    <div class="space-y-3">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-lg">📰</span>
                <div>
                    <div class="text-sm font-bold">${tx('比赛相关新闻', 'Match News')}</div>
                    <div class="text-[11px] text-gray-500">${esc(displayMaybeTeamName(data.homeNameI18n || data.homeTeam || ''))} ${tx('对阵', 'vs')} ${esc(displayMaybeTeamName(data.awayNameI18n || data.awayTeam || ''))}</div>
                </div>
            </div>
            <div class="text-[11px] text-gray-600">
                ${tx('来源', 'Source')}: ${source === 'tavily' ? 'Tavily AI' : tx('模拟数据', 'Mock data')}
            </div>
        </div>
        
        <!-- News List -->
        ${news.length > 0 ? news.map((item, index) => `
        <div class="glass-light rounded-lg p-3 border-l-2 ${getImportanceColor(item.importance)}">
            <div class="flex items-start gap-2">
                <span class="text-sm mt-0.5">${getImportanceIcon(item.importance)}</span>
                <div class="flex-1">
                    <div class="flex items-center gap-1 mb-1">
                        <span class="text-[11px] text-gray-500">${getTypeIcon(item.type)} ${esc(item.type) || 'general'}</span>
                        <span class="text-[11px] text-gray-600 ml-auto">${formatTime(item.publishedAt)}</span>
                    </div>
                    
                    <div class="font-bold text-xs mb-1">${esc(i18nText(item.titleI18n, item.title || ''))}</div>
                    
                    <div class="text-[11px] text-gray-400 mb-2">${esc(i18nText(item.summaryI18n, item.summary || ''))}</div>
                    
                    <div class="flex items-center justify-between">
                        <div class="text-[11px] text-gray-600">
                            ${tx('来源', 'Source')}: ${esc(i18nText(item.sourceI18n, item.source || tx('未知', 'Unknown')))}
                        </div>
                        ${item.url ? `
                        <a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-blue-400 hover:underline">
                            ${tx('阅读全文', 'Read full article')} →
                        </a>
                        ` : ''}
                    </div>
                    
                    ${item.tags?.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${item.tags.map(tag => `
                        <span class="bg-white/5 px-1.5 py-0.5 rounded text-[11px] text-gray-500">${esc(tag)}</span>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
        `).join('') : `
        <div class="glass-light rounded-lg p-4 text-center">
            <div class="text-gray-500 text-xs">${tx('暂无相关新闻', 'No related news')}</div>
            <div class="text-[11px] text-gray-600 mt-1">${tx('配置 Tavily API Key 以获取实时新闻', 'Configure a Tavily API key for live news')}</div>
        </div>
        `}
        
        <!-- Footer -->
        <div class="text-[11px] text-gray-600 text-center">
            ${tx('共', 'Total')} ${news.length} ${tx('条新闻', 'news items')} · ${tx('更新时间', 'Updated')}: ${new Date(data.lastUpdated).toLocaleString(uiLang === 'en' ? 'en-US' : 'zh-CN')}
        </div>
    </div>`;
}

function renderHeadToHead(data) {
    if (!data || data.dataQuality === "unavailable") {
        return '<div class="text-gray-500 text-xs py-4 text-center">' + tx('ESPN 暂无历史交锋样本', 'No historical H2H data from ESPN') + '</div>';
    }

    const homeTeam = data.homeTeam || tx("主队", "Home");
    const awayTeam = data.awayTeam || tx("客队", "Away");
    const grouped = data.grouped || {};
    const summary = data.summary || {};
    const homeSummary = (summary.home || {});
    const awaySummary = (summary.away || {});
    const recentMatches = data.recentMatches || [];
    const statistics = data.statistics || {};

    let html = '<div class="space-y-3">';

    // 1. Summary (streak)
    html += '<div class="glass-light rounded-lg p-3">' +
        '<div class="text-xs font-bold text-gray-400 mb-2">' + tx('交锋走势', 'H2H Trend') + '</div>' +
        '<div class="space-y-2">' +
            '<div class="flex items-center gap-2">' +
                '<span class="text-blue-400">●</span>' +
                '<span class="text-sm">' + esc(homeSummary.summaryText || homeTeam + tx(" 数据不足", " Insufficient data")) + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
                '<span class="text-red-400">●</span>' +
                '<span class="text-sm">' + esc(awaySummary.summaryText || awayTeam + tx(" 数据不足", " Insufficient data")) + '</span>' +
            '</div>' +
        '</div>' +
    '</div>';

    // 2. Grouped head-to-head
    html += '<div class="glass-light rounded-lg p-3">' +
        '<div class="text-xs font-bold text-gray-400 mb-2">' + tx('对阵记录', 'H2H History') + '</div>';

    // World Cup
    const wc = grouped.worldCup;
    if (wc && wc.matches && wc.matches.length) {
        html += '<div class="mb-3">' +
            '<div class="flex items-center gap-2 mb-1">' +
                '<span>🏆</span>' +
                '<span class="text-sm font-bold">' + esc(wc.label || tx("世界杯", "World Cup")) + '</span>' +
                '<span class="text-[11px] text-gray-500">' + tx('共 ', 'Total ') + esc(wc.stats?.total || 0) + tx(' 场', ' matches') + '</span>' +
            '</div>' +
            renderH2HMatchList(wc.matches) +
        '</div>';
    }

    // Other competitions
    const other = grouped.other;
    if (other && other.subGroups) {
        for (const [subType, sub] of Object.entries(other.subGroups)) {
            if (sub.matches && sub.matches.length) {
                html += '<div class="mb-3">' +
                    '<div class="flex items-center gap-2 mb-1">' +
                        '<span>📁</span>' +
                        '<span class="text-sm font-bold">' + esc(sub.label || subType) + '</span>' +
                        '<span class="text-[11px] text-gray-500">' + tx('共 ', 'Total ') + esc(sub.stats?.total || 0) + tx(' 场', ' matches') + '</span>' +
                    '</div>' +
                    renderH2HMatchList(sub.matches) +
                '</div>';
            }
        }
    }

    // Fallback
    if (!wc?.matches?.length && !other?.subGroups) {
        if (recentMatches.length > 0) {
            html += '<div class="text-[11px] text-gray-500 mb-1">' + tx('近期交锋', 'Recent Meetings') + '</div>' + renderH2HMatchList(recentMatches);
        } else {
            html += '<div class="text-gray-500 text-xs">' + tx('暂无对阵记录', 'No H2H history') + '</div>';
        }
    }

    html += '</div>';

    // 3. Statistics (legacy)
    if (summary.totalMatches > 0) {
        html += '<div class="glass-light rounded-lg p-3">' +
            '<div class="text-xs font-bold text-gray-400 mb-2">' + tx('交锋统计', 'H2H Stats') + '</div>' +
            '<div class="grid grid-cols-3 gap-2 text-center">' +
                '<div><div class="text-xs text-blue-400">' + esc(homeTeam) + '</div><div class="text-lg font-bold">' + esc(summary.homeWins || 0) + tx(' 胜', ' Wins') + '</div><div class="text-[11px] text-gray-500">' + esc(summary.homeWinRate || "0%") + '</div></div>' +
                '<div><div class="text-xs text-gray-500">' + tx('平局', 'Draws') + '</div><div class="text-lg font-bold text-yellow-400">' + esc(summary.draws || 0) + '</div><div class="text-[11px] text-gray-500">' + esc(summary.drawRate || "0%") + '</div></div>' +
                '<div><div class="text-xs text-red-400">' + esc(awayTeam) + '</div><div class="text-lg font-bold">' + esc(summary.awayWins || 0) + tx(' 胜', ' Wins') + '</div><div class="text-[11px] text-gray-500">' + esc(summary.awayWinRate || "0%") + '</div></div>' +
            '</div>' +
        '</div>';
    }

    // 「近期交锋」(legacy) 已移除：与上方「对阵记录」展示同一批 H2H 数据，属重复展示。

    html += '</div>';
    return html;
}

// Helper: render a match list
function renderH2HMatchList(matches) {
    if (!matches || !matches.length) return '<div class="text-gray-600 text-xs">' + tx('暂无比赛', 'No matches') + '</div>';
    return '<div class="space-y-1">' + matches.map(m => {
        const score = m.score || (m.homeScore !== undefined ? m.homeScore + "-" + m.awayScore : "0-0");
        const [hs, as] = score.split("-").map(Number);
        let cls = "text-yellow-400";
        if (hs > as) cls = "text-blue-400";
        else if (hs < as) cls = "text-red-400";
        const teams = [m.homeTeamName, m.awayTeamName].filter(Boolean).join(' vs ');
        return '<div class="flex items-center justify-between text-[11px] py-1 border-b border-white/5">' +
            '<span class="text-gray-600">' + esc((m.date || "").substring(0, 10)) + '</span>' +
            '<span class="text-gray-500 truncate px-2">' + esc(teams || m.competition || "") + '</span>' +
            '<span class="font-bold ' + cls + '">' + esc(score) + '</span>' +
        '</div>';
    }).join("") + '</div>';
}

function closeModal() {
    document.getElementById('match-modal').classList.add('hidden');
}

// ========== Teams Grid ==========
let allTeams = [];
async function refreshTeamsFromStandings() {
    const d = await api('/api/standings');
    if (d?.groups) {
        allTeams = [];
        for (const g of d.groups) {
            for (const t of g.standings) {
                allTeams.push({ ...t, group: g.name });
            }
        }
    }
    return allTeams;
}

function findTeamStanding(teamId) {
    return allTeams.find(team => String(team.id) === String(teamId)) || null;
}

function groupRecordFromStanding(team) {
    if (!team) return null;
    return {
        w: Number(team.wins) || 0,
        d: Number(team.draws) || 0,
        l: Number(team.losses) || 0,
        gf: Number(team.gf) || 0,
        ga: Number(team.ga) || 0,
        gd: Number(team.gd) || 0,
        pts: Number(team.pts) || 0,
    };
}

async function loadTeams() {
    if (!allTeams.length) await refreshTeamsFromStandings();
    const el = document.getElementById('teams-grid');
    el.innerHTML = allTeams.map(team => `
        <div class="card glass rounded-xl p-3 cursor-pointer" data-action="open-team-detail" data-team-id="${attr(team.id)}" data-team-name="${attr(team.name)}" data-group="${attr(team.group)}">
            <div class="flex items-center gap-2 mb-2">
                ${team.logo ? `<img src="${attr(team.logo)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">` : ''}
                <div>
                    <div class="font-bold text-sm">${esc(displayMaybeTeamName(team))}</div>
                    <div class="text-[11px] text-gray-500">${esc(displayGroupName(team.group))}</div>
                </div>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-gray-500">
                <span>${esc(t('pointsLabel'))} <span class="text-blue-400 font-bold tabular-nums">${esc(team.pts)}</span></span>
                <span class="tabular-nums">${esc(team.wins)}-${esc(team.draws)}-${esc(team.losses)}</span>
            </div>
        </div>
    `).join('') || `<div class="col-span-full text-center text-gray-500 py-10">${esc(t('teamsLoading'))}</div>`;
}

async function openTeamDetail(teamId, teamName, group) {
    const modal = document.getElementById('team-modal');
    const content = document.getElementById('team-modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = '<div class="py-10 text-center text-gray-500">加载中...</div>';

    // Refresh the computed standings before opening the team modal. ESPN's
    // team endpoint often reports an empty record while /api/standings already
    // has the live group table, so the modal must use the same source as the
    // Standings page.
    await refreshTeamsFromStandings();
    const standingTeam = findTeamStanding(teamId);
    const liveGroup = standingTeam?.group || group;
    const liveGroupRecord = groupRecordFromStanding(standingTeam);

    // Fetch enhanced data + WC match record in parallel using API client
    const [enhancedData, wcMatches] = await API.allData([
        '/api/team/' + teamId + '/enhanced',
        '/api/team/' + teamId + '/recent-matches',
    ]);

    if (enhancedData && !enhancedData.error) {
        if (liveGroupRecord) {
            enhancedData.overview ||= {};
            enhancedData.overview.group = liveGroup;
            enhancedData.overview.groupRecord = liveGroupRecord;
        }
        content.innerHTML = renderTeamEnhanced(enhancedData, liveGroup, wcMatches);

        // Initialize radar chart after render — prefer real radar data from team_meta
        setTimeout(() => {
            const r = enhancedData.radar;
            if (r) {
                renderTeamRadarChart('team-radar-chart', {
                    attack: r.attack,
                    defense: r.defense,
                    possession: r.possession,
                    physical: Math.round((r.pace + r.stamina) / 2),
                    discipline: r.tactics
                });
            } else if (enhancedData.recentForm) {
                renderTeamRadarChart('team-radar-chart', {
                    attack: parseFloat(enhancedData.recentForm.attack?.avgGoals || 1.5) * 40,
                    defense: 100 - parseFloat(enhancedData.recentForm.defense?.avgConceded || 1.0) * 40,
                    possession: parseFloat(enhancedData.recentForm.possession?.avgPossession || 50),
                    physical: 70,
                    discipline: 70
                });
            }
        }, 100);
    } else {
        // Fallback to basic data
        const [teamData, coachData] = await API.allData([
            '/api/team/' + teamId,
            '/api/coach/' + teamId,
        ]);
        if (teamData && liveGroupRecord) teamData.groupRecord = liveGroupRecord;
        content.innerHTML = renderTeamBasic(teamData, coachData, teamName, liveGroup);
    }
}

function renderTeamWCMatches(data) {
    const matches = data?.matches;
    if (!matches || !matches.length) return '';

    const resultBadge = r => {
        if (r === 'W') return `<span class="text-[11px] font-bold text-green-400 w-5 text-center">${tx('胜','W')}</span>`;
        if (r === 'D') return `<span class="text-[11px] font-bold text-yellow-400 w-5 text-center">${tx('平','D')}</span>`;
        if (r === 'L') return `<span class="text-[11px] font-bold text-red-400 w-5 text-center">${tx('负','L')}</span>`;
        return `<span class="text-[11px] text-gray-600 w-5 text-center">-</span>`;
    };

    const stateLabel = s => s === 'post'
        ? `<span class="text-[10px] text-gray-600">FT</span>`
        : s === 'in'
        ? `<span class="text-[10px] text-red-400 animate-pulse">LIVE</span>`
        : `<span class="text-[10px] text-blue-400">${tx('待赛','TBD')}</span>`;

    const rows = matches.map(m => {
        const opp = m.opponent;
        const oppName = opp ? (opp.name || opp.abbreviation || '?') : '?';
        const score = (m.state === 'post' || m.state === 'in')
            ? `${m.score?.home ?? '-'} : ${m.score?.away ?? '-'}`
            : 'vs';
        const dateStr = m.dateBJT ? m.dateBJT.split(' ')[0].replace(/\//g, '-') : (m.date ? m.date.slice(0, 10) : '');
        const homeAwayLabel = m.isHome
            ? `<span class="text-[10px] text-blue-400/70">${tx('主','H')}</span>`
            : `<span class="text-[10px] text-gray-500">${tx('客','A')}</span>`;

        return `
        <div class="flex items-center gap-2 py-1.5 px-2 glass-light rounded-lg text-xs cursor-pointer hover:bg-white/10 transition-colors"
             data-action="open-match" data-match-id="${attr(m.matchId)}">
            ${resultBadge(m.result)}
            ${homeAwayLabel}
            <span class="flex-1 truncate font-medium">${esc(oppName)}</span>
            <span class="tabular-nums text-gray-300 font-bold">${esc(score)}</span>
            ${stateLabel(m.state)}
            <span class="text-gray-600 text-[10px] min-w-[54px] text-right">${esc(dateStr)}</span>
        </div>`;
    }).join('');

    const completedCount = matches.filter(m => m.state === 'post').length;
    const totalCount = matches.length;
    const note = completedCount > 0
        ? tx(`本届世界杯 · 共 ${totalCount} 场 · ${completedCount} 场已结束`, `World Cup · ${totalCount} matches · ${completedCount} completed`)
        : tx(`本届世界杯 · 共 ${totalCount} 场赛程`, `World Cup · ${totalCount} scheduled`);

    return `
    <div class="glass-light rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-cyan-400">📅 ${tx('本届赛程', 'WC Record')}</span>
            <span class="text-[11px] text-gray-600">${esc(note)}</span>
        </div>
        <div class="space-y-1">${rows}</div>
        <div class="mt-2 text-[10px] text-gray-700">ESPN 实时 · 仅含本届世界杯比赛</div>
    </div>`;
}

function renderTeamEnhanced(d, group, wcMatchData) {
    // Win rate color
    const getWinRateColor = (winRate) => {
        if (winRate >= 0.6) return 'text-green-400';
        if (winRate >= 0.4) return 'text-yellow-400';
        return 'text-red-400';
    };
    
    // Ranking color
    const getRankingColor = (ranking) => {
        if (ranking <= 10) return 'text-green-400';
        if (ranking <= 30) return 'text-yellow-400';
        return 'text-red-400';
    };
    
    return `
    <div class="space-y-3">
        <!-- Header -->
        <div class="flex items-center gap-3">
            ${d.logo ? `<img src="${d.logo}" class="w-12 h-12 object-contain">` : ''}
            <div>
                <h3 class="font-bold text-lg">${displayMaybeTeamName(d)}</h3>
                <div class="text-xs text-gray-500">${displayGroupName(group)} · ${d.shortName || ''}</div>
            </div>
        </div>
        
        <!-- Overview -->
        ${d.overview ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-gray-400 mb-2">📊 ${tx('球队概况', 'Team Overview')}</div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">${tx('世界排名', 'World Rank')}</span>
                    <span class="font-bold ml-1 ${getRankingColor(d.overview.worldRanking)}">#${d.overview.worldRanking || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('FIFA积分', 'FIFA Points')}</span>
                    <span class="font-bold ml-1">${d.overview.fifaPoints || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('市值', 'Market Value')}</span>
                    <span class="font-bold ml-1 text-green-400">${d.overview.marketValue || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('平均年龄', 'Avg Age')}</span>
                    <span class="font-bold ml-1">${d.overview.avgAge || '?'}${tx('岁', '')}</span>
                </div>
            </div>
            
            ${d.overview.groupRecord ? `
            <div class="mt-2 pt-2 border-t border-white/5">
                <div class="text-[11px] text-gray-500 mb-1">${tx('小组赛战绩', 'Group Record')}</div>
                <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div>
                        <div class="font-bold text-green-400">${d.overview.groupRecord.w || 0}${tx('胜', 'W')}</div>
                    </div>
                    <div>
                        <div class="font-bold text-yellow-400">${d.overview.groupRecord.d || 0}${tx('平', 'D')}</div>
                    </div>
                    <div>
                        <div class="font-bold text-red-400">${d.overview.groupRecord.l || 0}${tx('负', 'L')}</div>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center text-[11px] mt-1">
                    <div>
                        <span class="text-gray-500">${tx('进球', 'GF')}</span>
                        <span class="font-bold ml-1">${d.overview.groupRecord.gf || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx('失球', 'GA')}</span>
                        <span class="font-bold ml-1">${d.overview.groupRecord.ga || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx('积分', 'Pts')}</span>
                        <span class="font-bold ml-1 text-blue-400">${d.overview.groupRecord.pts || 0}</span>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Radar Chart -->
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-gray-400 mb-2">📊 ${tx('能力雷达图', 'Ability Radar')}</div>
            <div style="height: 200px;">
                <canvas id="team-radar-chart"></canvas>
            </div>
        </div>
        
        <!-- Recent Form -->
        ${d.recentForm ? `
        <div class="glass-light rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-400">📈 ${tx('近期表现', 'Recent Form')}</span>
                <span class="text-xs ${getWinRateColor(parseFloat(d.recentForm.winRate))}">
                    ${tx('胜率', 'Win Rate')} ${Math.round(parseFloat(d.recentForm.winRate) * 100)}%
                </span>
            </div>
            
            <div class="grid grid-cols-3 gap-2 text-center text-[11px] mb-2">
                <div>
                    <div class="font-bold text-green-400">${d.recentForm.last10?.w || 0}${tx('胜', 'W')}</div>
                </div>
                <div>
                    <div class="font-bold text-yellow-400">${d.recentForm.last10?.d || 0}${tx('平', 'D')}</div>
                </div>
                <div>
                    <div class="font-bold text-red-400">${d.recentForm.last10?.l || 0}${tx('负', 'L')}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">${tx('场均进球', 'Avg Goals')}</span>
                    <span class="font-bold ml-1 text-green-400">${d.recentForm.attack?.avgGoals || '-'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('场均失球', 'Avg Conceded')}</span>
                    <span class="font-bold ml-1 text-red-400">${d.recentForm.defense?.avgConceded || '-'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('控球率', 'Possession')}</span>
                    <span class="font-bold ml-1">${d.recentForm.possession?.avgPossession || '-'}%</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('传球成功率', 'Pass Accuracy')}</span>
                    <span class="font-bold ml-1">${d.recentForm.possession?.passAccuracy ? Math.round(parseFloat(d.recentForm.possession.passAccuracy) * 100) + '%' : '-'}</span>
                </div>
            </div>
            
            <div class="mt-2 text-[11px] text-gray-600">
                ${tx('趋势', 'Trend')}: ${d.recentForm.trend || tx('表现稳定', 'Stable')}
            </div>
        </div>
        ` : ''}
        
        <!-- Coach -->
        ${d.coach ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-purple-400 mb-2">🧠 ${tx('教练', 'Coach')}</div>
            <div class="text-sm font-bold mb-1">${translateCoachField(d.coach.name, 'name')} <span class="text-gray-500 text-xs">${translateCoachField(d.coach.nationality, 'nationality')}</span></div>
            <div class="text-xs text-gray-400 mb-2">${translateCoachField(d.coach.style, 'style') || ''}</div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">${tx('执教时长', 'Tenure')}</span>
                    <span class="font-bold ml-1">${d.coach.tenure || d.coach.since || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('胜率', 'Win Rate')}</span>
                    <span class="font-bold ml-1 text-green-400">${d.coach.winRate || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('常用阵型', 'Formation')}</span>
                    <span class="font-bold ml-1">${(d.coach.formation || []).join(' / ') || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('大赛经验', 'Tournament Exp.')}</span>
                    <span class="font-bold ml-1">${d.coach.bigTournament ? '✓' : '?'}</span>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Squad Changes -->
        ${d.squadChanges ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-yellow-400 mb-2">🔄 ${tx('球队动态', 'Team News')}</div>
            
            ${d.squadChanges.injuries?.length > 0 ? `
            <div class="mb-2">
                <div class="text-[11px] text-gray-500 mb-1">🏥 ${tx('伤病', 'Injuries')}</div>
                ${d.squadChanges.injuries.map(inj => `
                <div class="text-[11px] text-red-400">• ${inj.player || '?'} (${inj.pos || '?'}) - ${inj.issue || '?'}</div>
                `).join('')}
            </div>
            ` : ''}
            
            ${d.squadChanges.suspended?.length > 0 ? `
            <div class="mb-2">
                <div class="text-[11px] text-gray-500 mb-1">🚫 ${tx('停赛', 'Suspensions')}</div>
                ${d.squadChanges.suspended.map(sus => `
                <div class="text-[11px] text-yellow-400">• ${sus.player || '?'} (${sus.pos || '?'}) - ${sus.reason || '?'}</div>
                `).join('')}
            </div>
            ` : ''}
            
            ${d.squadChanges.watchPoints?.length > 0 ? `
            <div>
                <div class="text-[11px] text-gray-500 mb-1">⚠️ ${tx('关注点', 'Watch Points')}</div>
                ${d.squadChanges.watchPoints.map(wp => `
                <div class="text-[11px] text-orange-400">• ${wp}</div>
                `).join('')}
            </div>
            ` : ''}
            
            ${!d.squadChanges.injuries?.length && !d.squadChanges.suspended?.length && !d.squadChanges.watchPoints?.length ? `
            <div class="text-[11px] text-gray-600">${tx('暂无重大动态', 'No major updates')}</div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Tournament History -->
        ${d.tournamentHistory ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-blue-400 mb-2">🏆 ${tx('大赛历史', 'Tournament History')}</div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">${tx('参赛次数', 'Appearances')}</span>
                    <span class="font-bold ml-1">${d.tournamentHistory.worldCupApps || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('最佳成绩', 'Best Finish')}</span>
                    <span class="font-bold ml-1 text-green-400">${d.tournamentHistory.bestResult || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('上届成绩', 'Last Edition')}</span>
                    <span class="font-bold ml-1">${d.tournamentHistory.lastEdition || '?'}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('累计战绩', 'All-time Record')}</span>
                    <span class="font-bold ml-1">${d.tournamentHistory.allTimeRecord ? `${d.tournamentHistory.allTimeRecord.w}${tx('胜', 'W')} ${d.tournamentHistory.allTimeRecord.d}${tx('平', 'D')} ${d.tournamentHistory.allTimeRecord.l}${tx('负', 'L')}` : '?'}</span>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Roster -->
        ${d.roster?.length > 0 ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-blue-400 mb-2">👥 ${tx('大名单', 'Roster')} (${d.roster.length}${tx('人', '')})</div>
            ${renderRosterGroup(tx('门将', 'Goalkeepers'), '🧤', d.roster.filter(p => p.pos === 'G' || p.pos === 'GK'), 'GK')}
            ${renderRosterGroup(tx('后卫', 'Defenders'), '🛡️', d.roster.filter(p => ['D','CB','LB','RB','LWB','RWB'].includes(p.pos)), 'DF')}
            ${renderRosterGroup(tx('中场', 'Midfielders'), '🎯', d.roster.filter(p => ['M','CM','CDM','CAM','LM','RM'].includes(p.pos)), 'MF')}
            ${renderRosterGroup(tx('前锋', 'Forwards'), '⚡', d.roster.filter(p => ['F','FW','ST','LW','RW','CF'].includes(p.pos)), 'FW')}
        </div>
        ` : ''}

        <!-- WC Match Record -->
        ${renderTeamWCMatches(wcMatchData)}
    </div>`;
}

function getRosterRole(p, posGroup, rankInGroup) {
    const apps = p.appearances || 0;
    const subs = p.subIns || 0;
    // If we have real appearance data, use it
    if (apps > 0) {
        // Started at least one match (appearances > subIns means they weren't always a sub)
        if (apps > subs) return 'starter';
        return 'keySub';
    }
    // Fallback: slot-based on sorted position rank (pre-tournament or no data)
    if (posGroup === 'GK') {
        return rankInGroup === 0 ? 'starter' : rankInGroup === 1 ? 'keySub' : 'reserve';
    }
    if (posGroup === 'DF') {
        return rankInGroup < 4 ? 'starter' : rankInGroup < 6 ? 'keySub' : 'reserve';
    }
    if (posGroup === 'MF') {
        return rankInGroup < 4 ? 'starter' : rankInGroup < 6 ? 'keySub' : 'reserve';
    }
    if (posGroup === 'FW') {
        return rankInGroup < 3 ? 'starter' : rankInGroup < 5 ? 'keySub' : 'reserve';
    }
    return 'reserve';
}

function renderRosterGroup(label, emoji, players, posGroup) {
    if (!players.length) return '';
    const hasRealData = players.some(p => (p.appearances || 0) > 0);
    // If real data: sort by appearances desc, then subIns asc (starters first)
    // If no data: sort by jersey number
    const sorted = [...players].sort((a, b) => {
        if (hasRealData) {
            const appsDiff = (b.appearances || 0) - (a.appearances || 0);
            if (appsDiff !== 0) return appsDiff;
            return (a.subIns || 0) - (b.subIns || 0);
        }
        return (parseInt(a.jersey) || 999) - (parseInt(b.jersey) || 999);
    });
    return `
    <div class="mb-2">
        <div class="text-[11px] font-bold text-gray-500 mb-1">${emoji} ${label} (${players.length})</div>
        <div class="grid grid-cols-1 gap-1">
            ${sorted.map((p, idx) => {
                const role = getRosterRole(p, posGroup || p.pos, idx);
                const roleBadge = role === 'starter'
                    ? `<span class="text-[10px] text-yellow-400 font-bold">⭐${tx('主力', 'Start')}</span>`
                    : role === 'keySub'
                    ? `<span class="text-[10px] text-blue-400 font-bold">🔄${tx('替补', 'Sub')}</span>`
                    : '';
                const encodedName = encodeURIComponent(p.name || '');
                return `
                <div class="flex items-center gap-2 text-xs py-1.5 px-2 glass-light rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                     data-action="open-player-detail"
                     data-player-id="${p.id}"
                     data-player-name="${p.name || ''}"
                     data-player-pos="${p.pos || ''}"
                     data-player-jersey="${p.jersey || ''}"
                     data-player-age="${p.age || ''}"
                     data-player-height="${p.height || ''}"
                     data-player-nationality="${p.nationality || ''}">
                    <span class="w-6 text-center text-gray-500 font-mono text-[11px]">#${p.jersey || '?'}</span>
                    <span class="font-medium flex-1">${translatePlayerName(p.name)}</span>
                    ${roleBadge}
                    <span class="text-gray-600 text-[11px]">${p.pos}</span>
                    ${p.age ? `<span class="text-gray-600 text-[11px]">${p.age}${tx('岁', '')}</span>` : ''}
                    <span class="text-gray-700 text-[11px]">›</span>
                </div>`;
            }).join('')}
        </div>
    </div>
    `;
}

function renderTeamRadarChart(canvasId, data) {
    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvasId);
    if (existingChart) existingChart.destroy();
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Extract data for radar chart
    const labels = uiLang === 'en' ? ['Attack', 'Defense', 'Possession', 'Physical', 'Discipline'] : ['进攻', '防守', '控球', '体能', '纪律'];
    const values = [
        data.attack || 70,
        data.defense || 70,
        data.possession || 70,
        data.physical || 70,
        data.discipline || 70
    ];
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: tx('球队能力', 'Team Ability'),
                data: values,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 2,
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(59, 130, 246)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        display: false,
                        stepSize: 20
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    pointLabels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

function renderPlayerRadarChart(canvasId, data) {
    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvasId);
    if (existingChart) existingChart.destroy();
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Extract data for radar chart
    const labels = uiLang === 'en' ? ['Attack', 'Defense', 'Physical', 'Form', 'Experience'] : ['进攻', '防守', '身体', '状态', '经验'];
    const values = [
        data.attack || 70,
        data.defense || 70,
        data.physical || 70,
        data.form || 70,
        data.experience || 70
    ];
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: tx('球员能力', 'Player Ability'),
                data: values,
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                borderColor: 'rgb(168, 85, 247)',
                borderWidth: 2,
                pointBackgroundColor: 'rgb(168, 85, 247)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(168, 85, 247)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        display: false,
                        stepSize: 20
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    pointLabels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

function renderTeamBasic(teamData, coachData, teamName, group) {
    let html = '';

    // Header
    html += `<div class="flex items-center gap-3 mb-4">
        ${teamData?.logo ? `<img src="${teamData.logo}" class="w-12 h-12 object-contain">` : ''}
        <div>
            <h3 class="font-bold text-lg">${teamName}</h3>
            <div class="text-xs text-gray-500">${group} · ${teamData?.record || '战绩未知'}</div>
        </div>
    </div>`;

    // Coach section
    if (coachData && !coachData.error) {
        html += `<div class="glass rounded-xl p-3 mb-3">
            <h4 class="text-xs font-bold text-purple-400 mb-2">🧠 ${tx('教练', 'Coach')}</h4>
            <div class="text-sm font-bold mb-1">${translateCoachField(coachData.name, 'name')} <span class="text-gray-500 text-xs">${translateCoachField(coachData.nationality, 'nationality')}</span></div>
            <div class="text-xs text-gray-400 mb-2">${translateCoachField(coachData.style, 'style')} · ${coachData.styleDetail || ''}</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="glass-light rounded-lg p-2">
                    <div class="text-gray-500">${tx('执教时长', 'Tenure')}</div>
                    <div class="font-bold">${translateCoachField(coachData.tenure || coachData.since, 'tenure')}</div>
                </div>
                <div class="glass-light rounded-lg p-2">
                    <div class="text-gray-500">${tx('胜率', 'Win Rate')}</div>
                    <div class="font-bold text-green-400">${coachData.winRate}</div>
                </div>
                <div class="glass-light rounded-lg p-2">
                    <div class="text-gray-500">${tx('常用阵型', 'Formation')}</div>
                    <div class="font-bold">${(coachData.formation||[]).join(' / ')}</div>
                </div>
                <div class="glass-light rounded-lg p-2">
                    <div class="text-gray-500">${tx('临场调整', 'In-game Adjustments')}</div>
                    <div class="font-bold">${coachData.adjustment?.substring(0,20) || tx('中等', 'Medium')}...</div>
                </div>
            </div>
            <div class="mt-2 text-[11px] text-gray-500">
                <span class="text-gray-600">${tx('大赛', 'Tournaments')}: </span>${coachData.bigTournament || tx('暂无', 'None')}
            </div>
            <div class="mt-1 text-[11px] text-gray-500">
                <span class="text-gray-600">${tx('特点', 'Notes')}: </span>${coachData.notes || ''}
            </div>
        </div>`;
    }

    // Roster
    const roster = teamData?.roster || [];
    if (roster.length) {
        // Group by position
        const gk = roster.filter(p => p.pos === 'G' || p.pos === 'GK');
        const def = roster.filter(p => p.pos === 'D' || p.pos === 'CB' || p.pos === 'LB' || p.pos === 'RB');
        const mid = roster.filter(p => p.pos === 'M' || p.pos === 'CM' || p.pos === 'CDM' || p.pos === 'CAM');
        const fwd = roster.filter(p => p.pos === 'F' || p.pos === 'FW' || p.pos === 'ST' || p.pos === 'LW' || p.pos === 'RW');
        const other = roster.filter(p => ![...gk,...def,...mid,...fwd].includes(p));

        html += `<div class="glass rounded-xl p-3">
            <h4 class="text-xs font-bold text-blue-400 mb-2">👥 ${tx('大名单', 'Roster')} (${roster.length}${tx('人', '')})</h4>
            ${renderRosterGroup(tx('门将', 'Goalkeepers'), '🧤', gk)}
            ${renderRosterGroup(tx('后卫', 'Defenders'), '🛡️', def)}
            ${renderRosterGroup(tx('中场', 'Midfielders'), '🎯', mid)}
            ${renderRosterGroup(tx('前锋', 'Forwards'), '⚡', fwd)}
            ${renderRosterGroup(tx('其他', 'Other'), '📋', other)}
        </div>`;
    } else {
        html += `<div class="text-gray-500 text-sm text-center py-4">${tx('阵容数据暂未公布', 'Roster data has not been released')}</div>`;
    }

    return html;
}

function closeTeamModal() {
    document.getElementById('team-modal').classList.add('hidden');
}

// ========== Analysis Tab ==========
async function loadPrediction() {
    const el = document.getElementById('prediction-content');
    el.innerHTML = `<div class="text-center py-10 text-gray-500">🧠 ${esc(t('loadingPredictions'))}</div>`;

    // Fetch all data in parallel using API client
    const [rankings, schedule, qualiData] = await API.allData([
        '/api/elo/rankings',
        '/api/schedule',
        '/api/qualification-probabilities',
    ]);

    let html = `<div class="border border-amber-400/30 bg-amber-400/10 rounded-xl px-3 py-2.5 text-xs text-amber-100">
        ⚠️ ${tx('本页面为实验性足球概率模型，仅供产品体验参考，不构成任何投注建议。预测基于 Elo 评分与 Poisson 进球预期模型，不接入实时市场赔率。', 'This page provides an experimental football probability model for product evaluation only. It is not betting advice. Predictions are based on Elo ratings and Poisson goal expectations, without live market odds.')}
    </div>`;

    // Detect knockout stage — hide Elo Top10 (group-stage rankings are less relevant)
    const allMatches = schedule?.matches || [];
    const isKnockoutStage = allMatches.some(m => m.stage && m.stage !== 'group');

    // ========================================
    // === Elo 实力排名 Rankings Top 10 ===
    // ========================================
    if (!isKnockoutStage && Array.isArray(rankings) && rankings.length) {
        html += `<div class="pred-section">
            <div class="pred-section-title text-purple-400">
                <span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">⚡</span>
                ${tx('Elo 实力排名 Top 10', 'Elo Rankings Top 10')}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">`;

        rankings.slice(0, 10).forEach((t, i) => {
            const bar = Math.min(100, Math.max(5, Math.round((t.rating - 1400) / 6)));
            const rankCls = i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : 'rank-default';
            const prevRank = t.previousRank || t.prevRank || null;
            let changeHtml = '<span class="rank-change rank-same">—</span>';
            if (prevRank && prevRank !== t.rank) {
                const diff = prevRank - t.rank;
                if (diff > 0) changeHtml = `<span class="rank-change rank-up">▲${diff}</span>`;
                else changeHtml = `<span class="rank-change rank-down">▼${Math.abs(diff)}</span>`;
            } else if (t.change > 0) {
                changeHtml = `<span class="rank-change rank-up">▲${t.change}</span>`;
            } else if (t.change < 0) {
                changeHtml = `<span class="rank-change rank-down">▼${Math.abs(t.change)}</span>`;
            }

            html += `<div class="elo-card flex items-center gap-3">
                <div class="elo-rank-badge ${rankCls}">${t.rank}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-bold truncate">${displayMaybeTeamName(t)}</span>
                        <div class="flex items-center gap-1.5">
                            ${changeHtml}
                            <span class="text-xs font-mono font-bold text-purple-400">${t.rating}</span>
                        </div>
                    </div>
                    <div class="elo-bar">
                        <div class="elo-bar-fill" style="width:${bar}%"></div>
                    </div>
                </div>
            </div>`;
        });
        html += '</div></div>';
    }

    // ========================================
    // === 出线形势 Qualification Probabilities ===
    // ========================================
    if (qualiData && typeof qualiData === 'object' && !Array.isArray(qualiData)) {
        // 新 API 格式: {"Group A": {group, results}, "Group B": {group, results}, ...}
        const qualiGroups = Object.values(qualiData);
        if (qualiGroups.length) {
        html += `<div class="pred-section">
            <div class="pred-section-title text-emerald-400">
                <span class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">🎯</span>
                ${tx('出线形势', 'Qualification Probabilities')}
            </div>`;

        qualiGroups.forEach(g => {
            const groupName = displayGroupName(g.group || tx('未知小组', 'Unknown Group'));
            html += `<div class="mb-3 last:mb-0">
                <div class="text-[11px] font-bold text-gray-400 mb-1.5">${esc(groupName)}</div>
                <div class="space-y-1.5">`;

            (g.results || []).forEach(t => {
                const pct = Math.round((t.probability || t.qualifyProb || 0) * 100);
                const barCls = pct >= 70 ? 'quali-high' : pct >= 40 ? 'quali-mid' : 'quali-low';
                const flagEmoji = t.flag || '🏳️';
                html += `<div class="quali-card flex items-center gap-2.5">
                    <div class="team-flag">${flagEmoji}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[11px] font-bold truncate">${displayMaybeTeamName(t.name)}</span>
                            <span class="text-[11px] font-mono font-bold ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}">${pct}%</span>
                        </div>
                        <div class="quali-bar">
                            <div class="quali-bar-fill ${barCls}" style="width:${pct}%"></div>
                        </div>
                    </div>
                </div>`;
            });

            html += '</div></div>';
        });
        html += '</div>';
        }  // end if qualiGroups.length
    }  // end if qualiData

    // ========================================
    // === 后期淘汰赛 Knockout Bracket ===
    // ========================================
    html += `<div class="pred-section mt-4">
        <div class="pred-section-title text-orange-400">
            <span class="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center text-xs">🏆</span>
            ${tx('后期淘汰赛', 'Knockout Stage')}
        </div>
        <div id="bracket-container-pred" class="w-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide text-center flex justify-center min-h-[200px]">
            <div class="text-gray-500 py-10">${tx('加载对阵图...', 'Loading bracket...')}</div>
        </div>
    </div>`;

    // ========================================
    // === 今日比赛预测 Today's Predictions ===
    // ========================================
    const matches = schedule?.matches || [];
    const upcoming = matches.filter(m => m.state === 'pre').slice(0, 6);

    if (upcoming.length) {
        html += `<div class="pred-section">
            <div class="pred-section-title text-blue-400">
                <span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">🎯</span>
                ${tx('今日比赛预测', "Today's Predictions")}
            </div>`;

        // Fetch predictions in parallel
        const predPromises = upcoming.map(m => api(`/api/predict/${m.id}`).catch(() => null));
        const predictions = await Promise.all(predPromises);

        for (let i = 0; i < upcoming.length; i++) {
            const m = upcoming[i];
            const pred = predictions[i];

            // API returns flat {homeWin, draw, awayWin, ...} not nested
            if (pred && !pred.error && pred.homeWin !== undefined) {
                const p = pred;
                const hw = Fmt.pctBar(p.homeWin);
                const dr = Fmt.pctBar(p.draw);
                const aw = Fmt.pctBar(p.awayWin);
                // confidence: avg of component confidences, or defaults to 65
                const comps = p.components || {};
                const compConfs = [comps.elo, comps.poisson, comps.coach, comps.venue, comps.odds].filter(Boolean).map(c=>Fmt.safeNum(c.confidence, 0));
                const conf = compConfs.length ? Math.round(compConfs.reduce((a,b)=>a+b,0)/compConfs.length*100) : 65;
                const homeName = displayMaybeTeamName(pred.match?.homeNameI18n || pred.match?.homeName || m.home);
                const awayName = displayMaybeTeamName(pred.match?.awayNameI18n || pred.match?.awayName || m.away);
                const homeFlag = m.home.flag || pred.match?.homeFlag || '🏳️';
                const awayFlag = m.away.flag || pred.match?.awayFlag || '🏳️';
                const score = pred.likelyScore != null && pred.likelyScore !== '' ? pred.likelyScore : '? - ?';
                const confCls = conf > 70 ? 'bg-green-500/20 text-green-400' : conf > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400';
                // Detail data — API uses 'components' not 'details'
                const eloPred = p.components?.elo || {home:0,draw:0,away:0};
                const poissonPred = p.components?.poisson || {home:0,draw:0,away:0};
                const coachPred = p.components?.coach || {};
                const weights = pred.weights || {elo:0.3,poisson:0.25,coach:0.15,venue:0.10,odds:0.20};
                const topScores = p.likelyScore != null && p.likelyScore !== '' ? `${p.likelyScore} ${Fmt.pct(p.likelyScoreProb)}` : '?';
                const confLabel = conf > 70 ? tx('高', 'High') : conf > 50 ? tx('中', 'Medium') : tx('低', 'Low');

                html += `<div class="pred-card mb-2.5">
                    <!-- Header: Teams + Score -->
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <div class="team-flag">${homeFlag}</div>
                            <span class="text-sm font-exbold truncate">${homeName}</span>
                        </div>
                        <div class="flex flex-col items-center px-3">
                            <div class="score-badge">${score}</div>
                            <span class="text-[9px] text-gray-500 mt-0.5">${tx('预测比分', 'Predicted Score')}</span>
                        </div>
                        <div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
                            <span class="text-sm font-extrabold truncate text-right">${awayName}</span>
                            <div class="team-flag">${awayFlag}</div>
                        </div>
                    </div>

                    <!-- Probability Bar -->
                    <div class="prob-bar mb-2">
                        <div class="prob-bar-home" style="width:${hw}%">${hw > 12 ? hw + '%' : ''}</div>
                        <div class="prob-bar-draw" style="width:${dr}%">${dr > 10 ? dr + '%' : ''}</div>
                        <div class="prob-bar-away" style="width:${aw}%">${aw > 12 ? aw + '%' : ''}</div>
                    </div>

                    <!-- Labels -->
                    <div class="flex justify-between text-[11px] mb-2">
                        <span class="text-green-400 font-bold">${tx('主胜', 'Home')} ${hw}%</span>
                        <span class="text-yellow-400 font-bold">${tx('平局', 'Draw')} ${dr}%</span>
                        <span class="text-red-400 font-bold">${tx('客胜', 'Away')} ${aw}%</span>
                    </div>

                    <!-- Confidence + Toggle -->
                    <div class="flex justify-between items-center">
                        <button data-action="toggle-pred-detail" data-target="pred-detail-${i}" class="text-[11px] text-blue-400 hover:text-blue-300 transition">📊 ${tx('详情', 'Details')} ▾</button>
                        <span class="confidence-pill ${confCls}">
                            <span>📊</span> ${tx('置信度', 'Confidence')}: ${confLabel} ${conf}%
                        </span>
                    </div>

                    <!-- Detail Panel (hidden by default) -->
                    <div id="pred-detail-${i}" class="hidden mt-3 pt-3 border-t border-white/5">
                        <div class="grid grid-cols-2 gap-2 text-[11px]">
                            <div class="bg-white/3 rounded-lg p-2">
                                <div class="text-purple-400 font-bold mb-1">⚡ ${tx('Elo 预测', 'Elo Forecast')}</div>
                                <div>${tx('主胜', 'Home')} ${(eloPred.home*100).toFixed(0)}%  ${tx('平', 'Draw')} ${(eloPred.draw*100).toFixed(0)}%  ${tx('客', 'Away')} ${(eloPred.away*100).toFixed(0)}%</div>
                            </div>
                            <div class="bg-white/3 rounded-lg p-2">
                                <div class="text-blue-400 font-bold mb-1">📐 ${tx('Poisson 预测', 'Poisson Forecast')}</div>
                                <div>${tx('主胜', 'Home')} ${(poissonPred.home*100).toFixed(0)}%  ${tx('平', 'Draw')} ${(poissonPred.draw*100).toFixed(0)}%  ${tx('客', 'Away')} ${(poissonPred.away*100).toFixed(0)}%</div>
                            </div>
                            <div class="bg-white/3 rounded-lg p-2">
                                <div class="text-green-400 font-bold mb-1">👔 ${tx('教练因素', 'Coach Factor')}</div>
                                <div>${tx('主胜', 'Home')} ${(coachPred.home*100).toFixed(0)}%  ${tx('平', 'Draw')} ${(coachPred.draw*100).toFixed(0)}%  ${tx('客', 'Away')} ${(coachPred.away*100).toFixed(0)}%</div>
                            </div>
                            <div class="bg-white/3 rounded-lg p-2">
                                <div class="text-yellow-400 font-bold mb-1">🎯 ${tx('最可能比分', 'Most Likely Score')}</div>
                                <div>${topScores}</div>
                            </div>
                        </div>
                        <div class="text-[9px] text-gray-500 mt-2">
                            ${tx('权重', 'Weights')}: Elo ${(weights.elo*100).toFixed(0)}% · Poisson ${(weights.poisson*100).toFixed(0)}% · ${tx('赔率', 'Odds')} ${(weights.odds*100).toFixed(0)}% · ${tx('教练', 'Coach')} ${(weights.coach*100).toFixed(0)}% · ${tx('场馆', 'Venue')} ${(weights.venue*100).toFixed(0)}%
                        </div>
                        <div class="text-[9px] text-gray-600 mt-1.5 border-t border-white/5 pt-1.5 leading-relaxed">
                            ${tx(
                                '五路融合说明：Elo 评分（30%）衡量球队实力与历史胜率；Poisson 模型（25%）基于预期进球模拟比赛结果；赛前赔率（20%）反映市场共识；教练能力（15%）评估战术部署与临场调整；场馆因素（10%）考虑主客场与场地影响。各权重乘以对应数据置信度后动态重新归一，确保预测结果综合反映多方信息。',
                                'Fusion: Elo (30%) measures team strength; Poisson (25%) simulates expected goals; Pre-match odds (20%) reflect market consensus; Coach rating (15%) evaluates tactics; Venue factor (10%) accounts for home/away advantage. Each weight is multiplied by its data confidence and dynamically re-normalized.'
                            )}
                        </div>
                    </div>
                </div>`;
            } else {
                html += `<div class="pred-card mb-2.5 opacity-60">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="team-flag">${m.home.flag || '🏳️'}</div>
                            <span class="text-xs font-bold">${displayMaybeTeamName(m.home)}</span>
                        </div>
                        <span class="text-[11px] text-gray-500">VS</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold">${displayMaybeTeamName(m.away)}</span>
                            <div class="team-flag">${m.away.flag || '🏳️'}</div>
                        </div>
                    </div>
                    <div class="text-center text-[11px] text-gray-500 mt-2">${tx('预测暂不可用', 'Prediction unavailable')}</div>
                </div>`;
            }
        }
        html += '</div>';
    }  // end if keyPairs.length

    el.innerHTML = html || `<div class="text-gray-500 text-center py-10">${tx('暂无预测数据', 'No prediction data available')}</div>`;
    
    // Load bracket
    fetch('/static/bracket-data.json').then(r=>r.json()).then(data => {
        const container = document.getElementById('bracket-container-pred');
        if (container) {
            container.innerHTML = '';
            renderBracket(data, container);
            // Auto-scroll to center (Final match) after render
            setTimeout(() => {
                const wrap = container.querySelector('#bk-wrap');
                if (wrap) container.scrollLeft = (wrap.scrollWidth - container.clientWidth) / 2;
            }, 100);
        }
    }).catch(e => {
        const container = document.getElementById('bracket-container-pred');
        if (container) container.innerHTML = `<div class="text-gray-500 py-10">${tx('淘汰赛对阵图将在小组赛结束后生成', 'Knockout bracket will be generated after group stage.')}</div>`;
    });
}

// ========== Spatial Matchup Tab ==========
let allTeamOptions = [];

function loadSpatialTab() {
    const homeSelect = document.getElementById('spatial-home');
    const awaySelect = document.getElementById('spatial-away');
    if (allTeamOptions.length) { return; }

    // Get teams from ratings
    // Build options from all teams
    const teams = [
        {id:'660',name:'USA'},{id:'210',name:'Paraguay'},
        {id:'206',name:'Canada'},{id:'211',name:'Bosnia-Herzegovina'},
        {id:'204',name:'Mexico'},{id:'214',name:'South Africa'},
        {id:'208',name:'South Korea'},{id:'220',name:'Czech Republic'},
        {id:'448',name:'Germany'},{id:'209',name:'Japan'},
        {id:'473',name:'Spain'},{id:'201',name:'Brazil'},
        {id:'472',name:'France'},{id:'471',name:'England'},
        {id:'476',name:'Argentina'},{id:'475',name:'Portugal'},
        {id:'474',name:'Netherlands'},{id:'477',name:'Belgium'},
        {id:'207',name:'Croatia'},{id:'212',name:'Morocco'},
        {id:'478',name:'Switzerland'},{id:'479',name:'Uruguay'},
        {id:'213',name:'Colombia'},{id:'218',name:'Ecuador'},
    ];
    allTeamOptions = teams;

    const opts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    homeSelect.innerHTML = '<option value="">选择主队...</option>' + opts;
    awaySelect.innerHTML = '<option value="">选择客队...</option>' + opts;

    // Auto-select USA vs PAR
    document.getElementById('spatial-home').value = '660';
    document.getElementById('spatial-away').value = '210';
    loadSelectedSpatial();
}

async function loadSelectedSpatial() {
    const home = document.getElementById('spatial-home').value;
    const away = document.getElementById('spatial-away').value;
    if (!home || !away) { document.getElementById('spatial-result').innerHTML = '<div class="text-gray-500 text-center py-10 text-xs">请选择两支球队</div>'; return; }

    const el = document.getElementById('spatial-result');
    el.innerHTML = '<div class="text-center py-10 text-gray-500">加载中...</div>';

    const data = await loadSpatialMatchup(home, away);
    el.innerHTML = renderSpatialMatchupPanel(data);
}

// ========== Players Tab ==========
let allPlayersCache = [];

function loadAllPlayers() {
    if (allPlayersCache.length) { renderPlayers(allPlayersCache); return; }
    // Collect all players from ratings.json via API
    const grid = document.getElementById('players-grid');
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">加载球员数据...</div>';

    // Fetch all teams lineup data
    const teamIds = ['660','210','206','211','204','214','208','220','448','209','473','201','472','471','476','475','474','477','207','212','478','479','213','218'];
    Promise.all(teamIds.map(id => api(`/api/team/${id}/lineup`).catch(() => null)))
        .then(results => {
            const players = [];
            for (const r of results) {
                if (!r || r.error) continue;
                for (const p of (r.players || [])) {
                    players.push({ ...p, teamName: r.name, teamId: r.teamId });
                }
            }
            allPlayersCache = players;
            renderPlayers(players);
        });
}

function renderPlayers(players) {
    const grid = document.getElementById('players-grid');
    grid.innerHTML = players.map(p => `
        <div class="card glass rounded-xl p-2.5 cursor-pointer" data-action="open-player-detail" data-player-id="${attr(p.id)}">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">${esc(p.jersey || '?')}</div>
                <div class="min-w-0">
                    <div class="text-xs font-bold truncate">${esc(p.name)}</div>
                    <div class="text-[11px] text-gray-500">${esc(p.teamName || '')} · ${esc(p.pos)}</div>
                </div>
            </div>
            <div class="mt-1.5 flex items-center gap-1">
                <span class="text-xs font-bold ${p.rating >= 80 ? 'text-green-400' : p.rating >= 70 ? 'text-yellow-400' : 'text-gray-400'}">${p.rating}</span>
                <div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full ${p.rating >= 80 ? 'bg-green-500' : p.rating >= 70 ? 'bg-yellow-500' : 'bg-gray-600'}" style="width:${p.rating}%"></div>
                </div>
            </div>
            <div class="mt-1 grid grid-cols-3 gap-0.5 text-[10px] text-gray-600">
                <span>攻${p.dims?.attack||0}</span>
                <span>防${p.dims?.defense||0}</span>
                <span>体${p.dims?.physical||0}</span>
            </div>
        </div>
    `).join('') || '<div class="col-span-full text-center text-gray-500 py-10">无球员数据</div>';
}

function searchPlayers(q) {
    if (!q) { renderPlayers(allPlayersCache); return; }
    const lower = q.toLowerCase();
    const filtered = allPlayersCache.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.pos?.toLowerCase().includes(lower) ||
        p.teamName?.toLowerCase().includes(lower)
    );
    renderPlayers(filtered);
}

// ========== Pre-Match Analysis (赛前分析卡) ==========
async function openPreMatch(matchId, homeId, awayId, homeName, awayName, venueName = '') {
    const modal = document.getElementById('match-modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="py-10 text-center text-gray-500">${tx('加载赛前分析...', 'Loading pre-match analysis...')}</div>`;

    const spatialResult = await API.get(`/api/matchup-spatial/${homeId}/${awayId}`, { timeout: API.TIMEOUT_LONG });
    const spatialData = spatialResult.data;

    let html = `<h3 class="font-bold text-base mb-2">📋 ${tx('赛前分析', 'Pre-match Analysis')}</h3>`;

    // === ⚔️ 综合评分条 + 空间对位 ===
    html += `<div class="mb-4">${renderSpatialMatchupPanel(spatialData)}</div>`;

    // === 🏟️ 场地 & 天气 ===
    const scheduledVenue = venueName || scheduleCache.find(m => String(m.id) === String(matchId))?.venue || '';
    html += `<div id="pre-match-venue" class="glass rounded-xl p-3 mb-3 text-xs text-gray-500">🏟️ ${scheduledVenue ? `${tx('已知场馆', 'Known venue')}: ${esc(scheduledVenue)} · ${tx('加载场地条件...', 'Loading venue conditions...')}` : tx('加载场地与天气...', 'Loading venue & weather...')}</div>`;

    // === 📊 数据 Tab 区 ===
    html += `<div class="mt-4">
        <div class="flex gap-1.5 mb-3 overflow-x-auto">
            <button data-action="switch-detail-tab" data-detail-tab="corners" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white">📐 ${tx('角球', 'Corners')}</button>
            <button data-action="switch-detail-tab" data-detail-tab="coach" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400">🧠 ${tx('教练', 'Coach')}</button>
        </div>
        <div id="detail-content-corners" class="detail-content">
            <div class="text-gray-500 text-xs py-4 text-center">${tx('加载角球数据...', 'Loading corner data...')}</div>
        </div>
        <div id="detail-content-coach" class="detail-content hidden">
            <div class="text-gray-500 text-xs py-4 text-center">${tx('教练数据加载中...', 'Loading coach data...')}</div>
        </div>
    </div>`;

    content.innerHTML = html;

    const venueRequest = scheduledVenue
        ? API.get('/api/venue/' + encodeURIComponent(scheduledVenue), { timeout: API.TIMEOUT_LONG }).then(r => r.data)
        : API.get('/api/match/' + matchId).then(r => {
            const match = r.data;
            const fallbackVenue = match?.venue || '';
            return fallbackVenue ? API.get('/api/venue/' + encodeURIComponent(fallbackVenue), { timeout: API.TIMEOUT_LONG }).then(r2 => r2.data) : null;
        });
    venueRequest.then(venue => {
        const el = document.getElementById('pre-match-venue');
        if (!el) return;
        el.innerHTML = venue && !venue.error
            ? renderVenueWeather(venue)
            : `<div class="text-gray-500 text-xs py-2">🏟️ ${tx('场地或实时天气暂不可用；该信息不参与预测。', 'Venue or live weather is unavailable; it is not used in the prediction.')}</div>`;
    }).catch(() => {
        const el = document.getElementById('pre-match-venue');
        if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-2">🏟️ ${tx('场地或实时天气暂不可用；该信息不参与预测。', 'Venue or live weather is unavailable; it is not used in the prediction.')}</div>`;
    });

    // Load corner analysis async
    API.get('/api/corner-analysis/' + matchId).then(res => {
        const el = document.getElementById('detail-content-corners');
        if (el && res.ok && res.data) el.innerHTML = renderCornerAnalysis(res.data);
        else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('角球数据暂无', 'No corner data')}</div>`;
    });

    API.get(`/api/coach-compare/${homeId}/${awayId}`).then(res => {
        const el = document.getElementById('detail-content-coach');
        if (el && res.ok && res.data) el.innerHTML = renderCoachComparison(res.data);
        else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx('教练数据暂无', 'No coach data')}</div>`;
    });
}

// ========== Formation Pitch Renderer ==========
// Formation positions — each team has its own half, attacking toward center
const FORMATIONS = {
    '4-3-3': [
        {x:50,y:8,label:'GK'},
        {x:18,y:22,label:'LB'},{x:38,y:20,label:'CB'},{x:62,y:20,label:'CB'},{x:82,y:22,label:'RB'},
        {x:25,y:38,label:'CM'},{x:50,y:35,label:'CM'},{x:75,y:38,label:'CM'},
        {x:20,y:48,label:'LW'},{x:50,y:46,label:'ST'},{x:80,y:48,label:'RW'},
    ],
    '4-4-2': [
        {x:50,y:8,label:'GK'},
        {x:18,y:22,label:'LB'},{x:38,y:20,label:'CB'},{x:62,y:20,label:'CB'},{x:82,y:22,label:'RB'},
        {x:18,y:38,label:'LM'},{x:38,y:36,label:'CM'},{x:62,y:36,label:'CM'},{x:82,y:38,label:'RM'},
        {x:35,y:47,label:'ST'},{x:65,y:47,label:'ST'},
    ],
    '3-5-2': [
        {x:50,y:8,label:'GK'},
        {x:25,y:20,label:'CB'},{x:50,y:18,label:'CB'},{x:75,y:20,label:'CB'},
        {x:10,y:35,label:'LWB'},{x:35,y:33,label:'CM'},{x:50,y:30,label:'CM'},{x:65,y:33,label:'CM'},{x:90,y:35,label:'RWB'},
        {x:35,y:47,label:'ST'},{x:65,y:47,label:'ST'},
    ],
    '3-4-2-1': [
        {x:50,y:8,label:'GK'},
        {x:25,y:20,label:'CB'},{x:50,y:18,label:'CB'},{x:75,y:20,label:'CB'},
        {x:12,y:35,label:'LWB'},{x:38,y:33,label:'CM'},{x:62,y:33,label:'CM'},{x:88,y:35,label:'RWB'},
        {x:35,y:44,label:'CAM'},{x:65,y:44,label:'CAM'},
        {x:50,y:48,label:'ST'},
    ],
};

let pitchViewMode = 'both';



function openPlayerDetail(id, inlineData) {
    if (!id && !inlineData) return;
    const modal = document.getElementById('match-modal');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = '<div class="py-10 text-center text-gray-500">' + tx('加载球员信息...', 'Loading player...') + '</div>';

    const showInline = () => {
        if (!inlineData) { content.innerHTML = '<div class="text-gray-500 text-center py-10">' + tx('球员数据暂无', 'No player data') + '</div>'; return; }
        const nameZh = translatePlayerName(inlineData.name);
        content.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center gap-3">
                <div class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl">⚽</div>
                <div>
                    <h3 class="font-bold text-lg">${nameZh}</h3>
                    ${nameZh !== inlineData.name ? `<div class="text-xs text-gray-500">${inlineData.name}</div>` : ''}
                    <div class="text-xs text-gray-500">${inlineData.pos || ''} · ${inlineData.nationality || ''}</div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                ${inlineData.jersey ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('球衣号', 'Jersey')}</div><div class="font-bold">#${inlineData.jersey}</div></div>` : ''}
                ${inlineData.age ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('年龄', 'Age')}</div><div class="font-bold">${inlineData.age}${tx('岁', '')}</div></div>` : ''}
                ${inlineData.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('身高', 'Height')}</div><div class="font-bold">${inlineData.height}</div></div>` : ''}
                ${inlineData.pos ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('位置', 'Position')}</div><div class="font-bold">${inlineData.pos}</div></div>` : ''}
            </div>
            <div class="text-[11px] text-gray-600 text-center">${tx('详细数据加载中...', 'Loading stats...')}</div>
        </div>`;
    };

    if (inlineData) showInline();

    if (!id) return;
    api('/api/player/' + id + '/enhanced').then(d => {
        if (!d || d.error) {
            api('/api/player/' + id).then(basic => {
                if (!basic || basic.error) { if (!inlineData) showInline(); return; }
                content.innerHTML = renderPlayerBasic(basic);
            });
            return;
        }
        content.innerHTML = renderPlayerEnhanced(d);
    }).catch(() => { if (!inlineData) showInline(); });
}

function renderPlayerBasic(d) {
    return `
    <div class="space-y-3">
        <!-- Header -->
        <div class="flex items-center gap-3">
            ${d.headshot ? `<img src="${d.headshot}" class="w-16 h-16 rounded-full object-cover bg-white/10">` : ''}
            <div>
                <h3 class="font-bold text-lg">${d.name}</h3>
                <div class="text-xs text-gray-500">${d.position || ''} · ${d.team || ''} · ${d.nationality || ''}</div>
            </div>
        </div>
        
        <!-- Basic Info -->
        <div class="grid grid-cols-2 gap-2 text-xs">
            ${d.age ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">年龄</div><div class="font-bold">${d.age}岁</div></div>` : ''}
            ${d.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">身高</div><div class="font-bold">${d.height}</div></div>` : ''}
            ${d.weight ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">体重</div><div class="font-bold">${d.weight}</div></div>` : ''}
            ${d.jersey ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">球衣</div><div class="font-bold">#${d.jersey}</div></div>` : ''}
        </div>
    </div>`;
}

function renderPlayerEnhanced(d) {
    // Form color
    const getFormColor = (form) => {
        switch(form) {
            case 'excellent': return 'text-green-400';
            case 'good': return 'text-blue-400';
            case 'average': return 'text-yellow-400';
            case 'poor': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };
    
    // Trend icon
    const getTrendIcon = (trend) => {
        switch(trend) {
            case 'rising': return '📈';
            case 'stable': return '➡️';
            case 'declining': return '📉';
            default: return '➡️';
        }
    };
    
    // Market value format
    const formatMarketValue = (value) => {
        if (value >= 10000000) return `€${(value / 10000000).toFixed(1)}千万`;
        if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}百万`;
        if (value >= 1000) return `€${(value / 1000).toFixed(0)}千`;
        return `€${value}`;
    };
    
    const nameZh = translatePlayerName(d.name);
    return `
    <div class="space-y-3">
        <!-- Header -->
        <div class="flex items-center gap-3">
            ${d.headshot ? `<img src="${d.headshot}" class="w-16 h-16 rounded-full object-cover bg-white/10" onerror="this.style.display='none'">` : '<div class="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl">⚽</div>'}
            <div>
                <h3 class="font-bold text-lg">${nameZh}</h3>
                ${nameZh !== d.name ? `<div class="text-xs text-gray-500">${d.name}</div>` : ''}
                <div class="text-xs text-gray-400">${d.position || ''} · <span class="text-blue-400">${d.club || d.team || ''}</span></div>
                <div class="text-[11px] text-gray-500">${d.nationality || ''} · #${d.jersey || '?'} · ${d.age || '?'}${tx('岁','')}</div>
            </div>
        </div>

        <!-- Basic Info -->
        <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
            ${d.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('身高','Height')}</div><div class="font-bold">${d.height}</div></div>` : ''}
            ${d.weight ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('体重','Weight')}</div><div class="font-bold">${d.weight}</div></div>` : ''}
            ${d.dob ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx('生日','DOB')}</div><div class="font-bold">${d.dob}</div></div>` : ''}
        </div>

        <!-- Club Stats this season -->
        ${d.clubStats && d.clubStats.dataQuality === 'live' ? `
        <div class="glass-light rounded-lg p-3">
            <div class="text-xs font-bold text-blue-400 mb-2">🏟️ ${d.clubStats.season || tx('本赛季数据','Season Stats')}</div>
            <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
                ${d.clubStats.appearances != null ? `<div><div class="text-gray-500">${tx('出场','Apps')}</div><div class="font-bold">${d.clubStats.appearances}</div></div>` : ''}
                ${d.clubStats.goals != null ? `<div><div class="text-gray-500">${tx('进球','Goals')}</div><div class="font-bold text-green-400">${d.clubStats.goals}</div></div>` : ''}
                ${d.clubStats.assists != null ? `<div><div class="text-gray-500">${tx('助攻','Assists')}</div><div class="font-bold text-yellow-400">${d.clubStats.assists}</div></div>` : ''}
            </div>
        </div>
        ` : ''}

        <!-- Traits -->
        ${d.traits?.length > 0 ? `
        <div class="glass-light rounded-lg p-2">
            <div class="text-xs font-bold text-gray-400 mb-2">⭐ ${tx('球员特色', 'Player Traits')}</div>
            <div class="space-y-1">
                ${d.traits.map(trait => `
                <div class="flex items-center justify-between text-[11px]">
                    <span>${trait.name}</span>
                    <span class="font-bold text-blue-400">${trait.score}</span>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Recent Form -->
        ${d.recentForm ? `
        <div class="glass-light rounded-lg p-2">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-400">📊 ${tx('近期表现', 'Recent Form')}</span>
                <span class="text-xs ${getFormColor(d.recentForm.form)}">
                    ${getTrendIcon(d.recentForm.trend)} ${d.recentForm.form === 'excellent' ? tx('出色', 'Excellent') : d.recentForm.form === 'good' ? tx('良好', 'Good') : d.recentForm.form === 'average' ? tx('一般', 'Average') : tx('低迷', 'Poor')}
                </span>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">${tx('出场', 'Appearances')}</span>
                    <span class="font-bold ml-1">${d.recentForm.matches}${tx('场', '')}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('进球', 'Goals')}</span>
                    <span class="font-bold ml-1 text-green-400">${d.recentForm.goals}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('助攻', 'Assists')}</span>
                    <span class="font-bold ml-1 text-blue-400">${d.recentForm.assists}</span>
                </div>
                <div>
                    <span class="text-gray-500">${tx('评分', 'Rating')}</span>
                    <span class="font-bold ml-1">${d.recentForm.rating}</span>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Club Stats -->
        ${d.clubStats ? `
        <div class="glass-light rounded-lg p-2">
            <div class="text-xs font-bold text-gray-400 mb-2">🏟️ 俱乐部数据</div>
            <div class="text-[11px] text-gray-500 mb-1">${d.clubStats.team} · ${d.clubStats.league} · ${d.clubStats.season}</div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">出场</span>
                    <span class="font-bold ml-1">${d.clubStats.appearances}</span>
                </div>
                <div>
                    <span class="text-gray-500">进球</span>
                    <span class="font-bold ml-1 text-green-400">${d.clubStats.goals}</span>
                </div>
                <div>
                    <span class="text-gray-500">助攻</span>
                    <span class="font-bold ml-1 text-blue-400">${d.clubStats.assists}</span>
                </div>
                <div>
                    <span class="text-gray-500">评分</span>
                    <span class="font-bold ml-1">${d.clubStats.rating}</span>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- National Stats -->
        ${d.nationalStats ? `
        <div class="glass-light rounded-lg p-2">
            <div class="text-xs font-bold text-gray-400 mb-2">🇺🇸 国家队数据</div>
            <div class="text-[11px] text-gray-500 mb-1">${d.nationalStats.team}</div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                    <span class="text-gray-500">出场</span>
                    <span class="font-bold ml-1">${d.nationalStats.caps}</span>
                </div>
                <div>
                    <span class="text-gray-500">进球</span>
                    <span class="font-bold ml-1 text-green-400">${d.nationalStats.goals}</span>
                </div>
                <div>
                    <span class="text-gray-500">助攻</span>
                    <span class="font-bold ml-1 text-blue-400">${d.nationalStats.assists}</span>
                </div>
                <div>
                    <span class="text-gray-500">大赛进球</span>
                    <span class="font-bold ml-1 text-yellow-400">${d.nationalStats.tournamentGoals}</span>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Injury History -->
        ${d.injuryHistory?.length > 0 ? `
        <div class="glass-light rounded-lg p-2">
            <div class="text-xs font-bold text-gray-400 mb-2">🏥 伤病历史</div>
            ${d.injuryHistory.map(injury => `
            <div class="text-[11px] py-1 border-b border-white/5">
                <div class="flex items-center justify-between">
                    <span>${injury.type}</span>
                    <span class="text-gray-600">${injury.date}</span>
                </div>
                <div class="text-gray-500">${injury.duration} · ${injury.status}</div>
            </div>
            `).join('')}
        </div>
        ` : ''}
    </div>`;
}

function setPitchView(mode, btn) {
    pitchViewMode = mode;
    const panel = btn.closest('.spatial-matchup-panel') || document;
    panel.querySelectorAll('.pitch-view-btn').forEach(b => {
        b.classList.remove('bg-white/10', 'text-white', 'font-bold');
        b.classList.add('bg-white/5', 'text-gray-500');
    });
    btn.classList.remove('bg-white/5', 'text-gray-500');
    btn.classList.add('bg-white/10', 'text-white', 'font-bold');
    panel.querySelectorAll('.pitch-home').forEach(el => el.style.display = mode === 'away' ? 'none' : '');
    panel.querySelectorAll('.pitch-away').forEach(el => el.style.display = mode === 'home' ? 'none' : '');
    panel.querySelectorAll('.pitch-pair').forEach(el => el.style.display = mode === 'both' ? '' : 'none');
}

// Tooltip
function showTip(el, name, pos, rating, team, status) {
    let tip = document.getElementById('player-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'player-tip';
        tip.className = 'player-tip';
        document.body.appendChild(tip);
    }
    const cls = rating >= 7.5 ? 'text-green-400' : rating >= 6.5 ? 'text-yellow-400' : 'text-red-400';
    const st = status || '首发';
    const sCls = st === '首发' ? 'text-green-400' : st === '替补' ? 'text-yellow-400' : 'text-red-400';
    tip.innerHTML = `
        <div class="text-sm font-bold">${esc(name)}</div>
        <div class="text-[11px] text-gray-500 mb-2">${esc(team)} · ${esc(pos)}</div>
        <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-gray-400">状态</span>
            <span class="text-xs font-bold ${sCls}">${esc(st)}</span>
        </div>
        <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-gray-400">评分</span>
            <span class="text-lg font-bold ${cls}">${esc(rating)}</span>
        </div>
        <div class="text-[11px] text-gray-600">点击查看球员详情 →</div>
    `;
    const rect = el.getBoundingClientRect();
    tip.style.left = Math.min(rect.right + 8, window.innerWidth - 200) + 'px';
    tip.style.top = Math.max(rect.top - 20, 8) + 'px';
    tip.classList.add('show');
}
function hideTip() {
    const tip = document.getElementById('player-tip');
    if (tip) tip.classList.remove('show');
}

function showTipFromDataset(el) {
    const name = el.dataset.name || '';
    const pos = el.dataset.pos || '';
    const rating = parseFloat(el.dataset.rating) || 0;
    const team = el.dataset.team || '';
    const status = el.dataset.status || '首发';
    showTip(el, name, pos, rating, team, status);
}

// ========== Spatial Matchup Renderer ==========
async function loadSpatialMatchup(homeId, awayId) {
    const d = await api(`/api/matchup-spatial/${homeId}/${awayId}`);
    if (!d || d.error) return null;
    return d;
}

function renderSpatialPitch(data) {
    if (!data) return '<div class="text-gray-500 text-center py-10">对位数据加载失败</div>';
    
    // SVG dimensions (same as reference: 680x1050)
    const W = 680, H = 1050;
    
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="w-full rounded-xl overflow-hidden" style="max-height:500px;">`;
    
    // === 草坪背景 ===
    svg += `<rect width="${W}" height="${H}" fill="#1a472a" rx="8"/>`;
    
    // === 球场线条 ===
    // 边框
    svg += `<rect x="20" y="20" width="${W-40}" height="${H-40}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>`;
    // 中线
    svg += `<line x1="20" y1="${H/2}" x2="${W-20}" y2="${H/2}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>`;
    // 中圈
    svg += `<circle cx="${W/2}" cy="${H/2}" r="80" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
    svg += `<circle cx="${W/2}" cy="${H/2}" r="4" fill="rgba(255,255,255,0.3)"/>`;
    
    // 上禁区 (客队)
    svg += `<rect x="${W/2-150}" y="20" width="300" height="150" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
    svg += `<rect x="${W/2-90}" y="20" width="180" height="60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
    
    // 下禁区 (主队)
    svg += `<rect x="${W/2-150}" y="${H-170}" width="300" height="150" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
    svg += `<rect x="${W/2-90}" y="${H-80}" width="180" height="60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
    
    // === 对位连线 ===
    for (const p of data.pairs) {
        // 坐标转换: 0-100 → 0-680/1050, y 反转
        const hx = p.home.x * 6.8;
        const hy = (100 - p.home.y) * 10.5;
        const ax = p.away.x * 6.8;
        const ay = (100 - p.away.y) * 10.5;
        
        // 颜色和样式
        let color = '#9E9E9E', width = 1, dash = '4,4';
        if (p.advantage === 'home') { color = '#4CAF50'; width = 2.5; dash = 'none'; }
        else if (p.advantage === 'away') { color = '#F44336'; width = 2; dash = '6,4'; }
        
        svg += `<line class="pitch-pair" x1="${hx}" y1="${hy}" x2="${ax}" y2="${ay}" stroke="${color}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="0.6"/>`;
    }
    
    // === 主队球员 (下半区, 红色) ===
    for (const p of data.home.players) {
        const px = p.x * 6.8;
        const py = (100 - p.y) * 10.5;
        
        // 圆形背景
        svg += `<circle class="pitch-home" cx="${px}" cy="${py}" r="18" fill="#C62828" stroke="#fff" stroke-width="2"/>`;
        // 球衣号
        svg += `<text class="pitch-home" x="${px}" y="${py+4}" text-anchor="middle" font-size="12" font-weight="bold" fill="white">${p.jersey||''}</text>`;
        // 姓名 (下方)
        const localNameHome = translatePlayerName(p.name);
        const shortNameHome = localNameHome.includes('·') ? localNameHome.split('·').pop() : localNameHome.split(' ').pop();
        svg += `<text class="pitch-home" x="${px}" y="${py+32}" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff">${shortNameHome}</text>`;
        // 评分 (更下方, 黄色)
        svg += `<text class="pitch-home" x="${px}" y="${py+44}" text-anchor="middle" font-size="11" font-weight="bold" fill="#FFD600">${p.rating}</text>`;
    }
    
    // === 客队球员 (上半区, 蓝色) ===
    for (const p of data.away.players) {
        const px = p.x * 6.8;
        const py = (100 - p.y) * 10.5;
        
        // 圆形背景
        svg += `<circle class="pitch-away" cx="${px}" cy="${py}" r="18" fill="#1565C0" stroke="#fff" stroke-width="2"/>`;
        // 球衣号
        svg += `<text class="pitch-away" x="${px}" y="${py+4}" text-anchor="middle" font-size="12" font-weight="bold" fill="white">${p.jersey||''}</text>`;
        // 姓名 (上方)
        const localNameAway = translatePlayerName(p.name);
        const shortNameAway = localNameAway.includes('·') ? localNameAway.split('·').pop() : localNameAway.split(' ').pop();
        svg += `<text class="pitch-away" x="${px}" y="${py-24}" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff">${shortNameAway}</text>`;
        // 评分 (更上方, 黄色)
        svg += `<text class="pitch-away" x="${px}" y="${py-36}" text-anchor="middle" font-size="11" font-weight="bold" fill="#FFD600">${p.rating}</text>`;
    }
    
    svg += `</svg>`;
    return svg;
}

function renderSpatialMatchupPanel(data) {
    if (!data) return '';
    const s = data.summary || {};
    const pairs = data.pairs || [];
    
    // Calculate overall scores (weighted average of all player ratings)
    const homeAvg = data.home?.players?.length 
        ? data.home.players.reduce((sum, p) => sum + (p.rating || 70), 0) / data.home.players.length 
        : 70;
    const awayAvg = data.away?.players?.length 
        ? data.away.players.reduce((sum, p) => sum + (p.rating || 70), 0) / data.away.players.length 
        : 70;
    const total = homeAvg + awayAvg;
    const homePct = total > 0 ? (homeAvg / total * 100).toFixed(1) : 50;
    const awayPct = total > 0 ? (awayAvg / total * 100).toFixed(1) : 50;
    
    // Difficulty level
    const avgGap = s.avgGap || 0;
    let difficulty = '低';
    let difficultyColor = 'text-green-400';
    if (avgGap >= 8) { difficulty = '高'; difficultyColor = 'text-red-400'; }
    else if (avgGap >= 5) { difficulty = '中等'; difficultyColor = 'text-yellow-400'; }
    
    return `
    <div class="spatial-matchup-panel glass rounded-xl p-3 mb-3">
        <!-- === 综合评分条 === -->
        <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${data.home?.flag || '🏳️'}</span>
                    <div>
                        <div class="text-sm font-bold text-white">${displayMaybeTeamName(data.home || tx('主队', 'Home'))}</div>
                        <div class="text-[11px] text-gray-500">${tx('推测阵型', 'Estimated formation')} ${data.home?.formation || '?'}</div>
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-[11px] text-gray-500 mb-0.5">${tx('综合评分', 'Composite')}</div>
                    <div class="text-lg font-black ${homePct > awayPct ? 'text-red-400' : 'text-blue-400'}">${homePct} <span class="text-gray-600">vs</span> ${awayPct}</div>
                    <div class="text-[11px] font-bold ${difficultyColor}">${difficulty}</div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="text-right">
                        <div class="text-sm font-bold text-white">${displayMaybeTeamName(data.away || tx('客队', 'Away'))}</div>
                        <div class="text-[11px] text-gray-500">${tx('推测阵型', 'Estimated formation')} ${data.away?.formation || '?'}</div>
                    </div>
                    <span class="text-lg">${data.away?.flag || '🏳️'}</span>
                </div>
            </div>
            
            <!-- Progress bar -->
            <div class="flex h-2.5 rounded-full overflow-hidden bg-white/5 mb-2">
                <div class="bg-red-500 transition-all duration-500" style="width:${homePct}%"></div>
                <div class="bg-blue-500 transition-all duration-500" style="width:${awayPct}%"></div>
            </div>
            
            <!-- Stats row -->
            <div class="flex justify-between text-[11px]">
                <span class="text-red-400 font-bold">${tx('主优', 'Home edges')} ${s.homeAdvantages||0}</span>
                <span class="text-gray-400">${tx('均势', 'Even')} ${s.even||0}</span>
                <span class="text-blue-400 font-bold">${tx('客优', 'Away edges')} ${s.awayAdvantages||0}</span>
                <span class="text-gray-500">${tx('平均差', 'Avg gap')} ${avgGap}</span>
            </div>
        </div>
        
        <!-- === 视图切换按钮 === -->
        <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-bold text-blue-400">⚔️ ${tx('空间对位', 'Spatial Matchups')}</h4>
            <div class="flex gap-1">
                <button data-action="set-pitch-view" data-view="both" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">${tx('全部', 'All')}</button>
                <button data-action="set-pitch-view" data-view="home" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('主队', 'Home')}</button>
                <button data-action="set-pitch-view" data-view="away" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx('客队', 'Away')}</button>
            </div>
        </div>
        
        <!-- === 空间球场 === -->
        ${renderSpatialPitch(data)}
        <p class="mt-2 text-[10px] text-gray-500">${tx('阵型与球员位置基于常用阵型及位置评分的估计，不是官方首发。', 'Formation and player positions are estimates from usual shape and position ratings, not an official lineup.')}</p>
        
        <!-- === 关键对位标签 === -->
        <div class="mt-2 flex flex-wrap gap-1">
            ${pairs.filter(p => p.key).map(p => `
                <span class="pitch-pair text-[11px] px-1.5 py-0.5 rounded ${p.advantage === 'home' ? 'bg-green-500/20 text-green-400' : p.advantage === 'away' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400'}">
                    ${p.home.name.split(' ').pop()}(${p.home.rating}) vs ${p.away.name.split(' ').pop()}(${p.away.rating}) ${p.diff > 0 ? '+' : ''}${p.diff}
                </span>
            `).join('')}
        </div>
    </div>`;
}

// Helper: get flag emoji from team ID (country code)
function getFlagEmoji(teamId) {
    if (!teamId) return '🏳️';
    // Map ESPN team IDs to flag emojis (verified from ESPN API)
    const flagMap = {
        '202': '🇦🇷', // Argentina
        '203': '🇲🇽', // Mexico
        '205': '🇧🇷', // Brazil
        '206': '🇨🇦', // Canada
        '208': '🇨🇴', // Colombia
        '209': '🇪🇨', // Ecuador
        '210': '🇵🇾', // Paraguay
        '212': '🇺🇾', // Uruguay
        '4375': '🇮🇶', // Iraq
        '4398': '🇶🇦', // Qatar
        '4469': '🇬🇭', // Ghana
        '448': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', // England
        '449': '🇳🇱', // Netherlands
        '450': '🇨🇿', // Czechia
        '451': '🇰🇷', // South Korea
        '452': '🇧🇦', // Bosnia-Herzegovina
        '459': '🇧🇪', // Belgium
        '464': '🇳🇴', // Norway
        '465': '🇹🇷', // Türkiye
        '466': '🇸🇪', // Sweden
        '467': '🇿🇦', // South Africa
        '469': '🇮🇷', // Iran
        '472': '🇫🇷', // France
        '474': '🇦🇹', // Austria
        '475': '🇨🇭', // Switzerland
        '477': '🇭🇷', // Croatia
        '478': '🇫🇷', // France (alt)
        '481': '🇩🇪', // Germany
        '482': '🇵🇹', // Portugal
        '580': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', // Scotland
        '624': '🇩🇿', // Algeria
        '627': '🇯🇵', // Japan
        '628': '🇦🇺', // Australia
        '654': '🇸🇳', // Senegal
        '655': '🇸🇦', // Saudi Arabia
        '659': '🇹🇳', // Tunisia
        '660': '🇺🇸', // United States
        '2570': '🇺🇿', // Uzbekistan
        '2597': '🇨🇻', // Cape Verde
        '2620': '🇪🇬', // Egypt
        '2654': '🇭🇹', // Haiti
        '2659': '🇵🇦', // Panama
        '2666': '🇳🇿', // New Zealand
        '2850': '🇨🇩', // Congo DR
        '2869': '🇲🇦', // Morocco
        '2917': '🇯🇴', // Jordan
        '11678': '🇨🇼', // Curaçao
        '4789': '🇨🇮', // Ivory Coast
    };
    return flagMap[String(teamId)] || '🏳️';
}

function renderCoachComparison(data) {
    if (!data || data.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx('教练数据暂无', 'No coach data')}</div>`;
    const a = data.coachA || {};
    const b = data.coachB || {};
    const c = data.comparison || {};
    const score = c.overallScore || {};
    const scoreA = score[a.name] || '-';
    const scoreB = score[b.name] || '-';

    const renderCoach = (coach, accent, scoreValue) => `
        <div class="glass-light rounded-lg p-3">
            <div class="flex items-start justify-between gap-2 mb-2">
                <div>
                    <div class="text-sm font-bold text-white">${translateCoachField(coach.name, 'name') || tx('未知教练', 'Unknown coach')}</div>
                    <div class="text-[11px] text-gray-500">${translateCoachField(coach.nationality, 'nationality') || ''} · ${coach.age || '?'}${tx('岁', '')} · ${translateCoachField(coach.tenure, 'tenure') || ''}</div>
                </div>
                <div class="text-right">
                    <div class="text-[11px] text-gray-500">${tx('评分', 'Rating')}</div>
                    <div class="text-base font-black ${accent}">${scoreValue}</div>
                </div>
            </div>
            <div class="text-xs font-bold ${accent} mb-1">${i18nText(coach.styleI18n, coach.style || tx('战术风格未知', 'Style unknown'))}</div>
            <div class="text-[11px] text-gray-400 leading-relaxed">${i18nText(coach.styleDetailI18n, coach.styleDetail || coach.notes || '')}</div>
            <div class="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                <div><span class="text-gray-500">${tx('胜率', 'Win Rate')}</span> <span class="font-bold">${coach.winRate || '-'}</span></div>
                <div><span class="text-gray-500">${tx('阵型', 'Formation')}</span> <span class="font-bold">${(coach.formation || []).join(' / ') || '-'}</span></div>
            </div>
        </div>`;

    return `<div class="space-y-3">
        <div class="grid sm:grid-cols-2 gap-2">
            ${renderCoach(a, 'text-blue-400', scoreA)}
            ${renderCoach(b, 'text-red-400', scoreB)}
        </div>
        <div class="glass-light rounded-lg p-3 text-[11px] text-gray-300 space-y-1">
            <div><span class="text-gray-500">${tx('风格对位', 'Style matchup')}</span> <span class="font-bold text-white">${i18nText(c.styleMatchupI18n, c.styleMatchup || '-')}</span></div>
            <div><span class="text-gray-500">${tx('经验差距', 'Experience gap')}</span> <span class="font-bold text-white">${i18nText(c.experienceGapI18n, c.experienceGap || '-')}</span></div>
            <div><span class="text-gray-500">${tx('临场优势', 'Adjustment edge')}</span> <span class="font-bold text-white">${i18nText(c.adjustmentEdgeI18n, c.adjustmentEdge || '-')}</span></div>
        </div>
    </div>`;
}
// ========== Odds Trend Renderer ==========
function renderOddsTrend(current, previous) {
    if (!previous) return `<span class="text-gray-600 text-[11px]">${tx('首次数据', 'First sample')}</span>`;
    const diff = current - previous;
    const pct = ((diff / previous) * 100).toFixed(1);
    if (Math.abs(diff) < 0.01) return '<span class="trend-flat">→</span>';
    if (diff > 0) return `<span class="trend-up arrow-bounce">↑ +${pct}%</span>`;
    return `<span class="trend-down arrow-bounce">↓ ${pct}%</span>`;
}

function renderOddsCard(odds) {
    if (!odds || odds.source === 'api_key_not_configured') return '';
    
    // Calculate trends from history
    const hist = odds.history || [];
    const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
    
    const homeTrend = prev ? renderOddsTrend(odds.homeWin, prev.homeWin) : '';
    const drawTrend = prev ? renderOddsTrend(odds.draw, prev.draw) : '';
    const awayTrend = prev ? renderOddsTrend(odds.awayWin, prev.awayWin) : '';

    return `
    <div class="glass rounded-xl p-3 mb-3">
        <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-bold text-yellow-400">💰 ${tx('盘口', 'Odds')}</h4>
            <div class="flex items-center gap-2">
                ${odds._frozen ? `<span class="text-[11px] text-orange-400 font-bold">⚡ ${tx('赛前数据', 'Pre-match data')}</span>` : ''}
                <span class="text-[11px] text-gray-600">${odds.bookmakers?.length || 0}${tx('家博彩', ' books')}</span>
            </div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center mb-2">
            <div class="glass-light rounded-lg p-2">
                <div class="text-[11px] text-gray-500">${tx('主胜', 'Home')}</div>
                <div class="text-base font-bold text-green-400">${odds.homeWin || '-'}</div>
                <div class="text-[11px]">${homeTrend}</div>
            </div>
            <div class="glass-light rounded-lg p-2">
                <div class="text-[11px] text-gray-500">${tx('平局', 'Draw')}</div>
                <div class="text-base font-bold">${odds.draw || '-'}</div>
                <div class="text-[11px]">${drawTrend}</div>
            </div>
            <div class="glass-light rounded-lg p-2">
                <div class="text-[11px] text-gray-500">${tx('客胜', 'Away')}</div>
                <div class="text-base font-bold text-blue-400">${odds.awayWin || '-'}</div>
                <div class="text-[11px]">${awayTrend}</div>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="glass-light rounded-lg p-2 text-center">
                <div class="text-[11px] text-gray-500">${tx('大小球', 'Total')} ${odds.overUnder?.line || 2.5}</div>
                <div>${tx('大', 'Over')} ${odds.overUnder?.over || '-'} / ${tx('小', 'Under')} ${odds.overUnder?.under || '-'}</div>
            </div>
            <div class="glass-light rounded-lg p-2 text-center">
                <div class="text-[11px] text-gray-500">${tx('让球盘', 'Handicap')}</div>
                <div>${odds.asianHandicap?.line > 0 ? tx('主让', 'Home -') + odds.asianHandicap.line : odds.asianHandicap?.line < 0 ? tx('客让', 'Away -') + Math.abs(odds.asianHandicap.line) : tx('平手', 'Level')} ${odds.asianHandicap?.home || '-'}</div>
            </div>
        </div>
    </div>`;
}

// ========== AI Chat Component ==========
function renderAIChat(matchId, homeId, awayId, homeName, awayName) {
    const chatId = `ai-chat-${matchId}`;
    return `
    <div class="glass rounded-xl p-3">
        <h4 class="text-xs font-bold text-purple-400 mb-2">🤖 ${tx('AI 战术分析', 'AI Tactical Analysis')}</h4>
        <div id="${attr(chatId)}-messages" class="space-y-2 max-h-48 overflow-y-auto mb-2">
            <div class="text-[11px] text-gray-500 text-center py-2">${tx('询问 AI 关于这场比赛的任何问题...', 'Ask AI anything about this match...')}</div>
        </div>
        <div class="flex gap-2">
            <input type="text" id="${attr(chatId)}-input" placeholder="${tx('例：谁会赢？关键对位？战术分析？', 'Example: who will win? key matchups? tactics?')}" 
                class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                data-key-action="send-ai-message" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}">
            <button data-action="send-ai-message" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" 
                class="bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-500/30">
                ${tx('发送', 'Send')}
            </button>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
            <button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx('谁会赢？', 'Who will win?'))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx('谁会赢？', 'Who wins?')}</button>
            <button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx('关键对位分析', 'Key matchup analysis'))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx('关键对位', 'Key matchups')}</button>
            <button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx('战术风格对比', 'Tactical style comparison'))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx('战术对比', 'Tactics')}</button>
        </div>
	    </div>`;
}

function appendChatMessage(messages, text, align, spanClass, id) {
    const row = document.createElement('div');
    row.className = align;
    if (id) row.id = id;
    const span = document.createElement('span');
    span.className = spanClass;
    span.textContent = text;
    row.appendChild(span);
    messages.appendChild(row);
    return row;
}

async function sendAIMessage(chatId, matchId, homeId, awayId) {
    const input = document.getElementById(`${chatId}-input`);
    const messages = document.getElementById(`${chatId}-messages`);
    const question = input.value.trim();
    if (!question) return;
    
    // Add user message
    appendChatMessage(messages, question, 'text-right', 'text-[11px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg inline-block');
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
    
    // Show loading
    const loadingId = 'loading-' + Date.now();
    appendChatMessage(messages, tx('AI 思考中...', 'AI is thinking...'), 'text-left', 'text-[11px] text-gray-500', loadingId);
    messages.scrollTop = messages.scrollHeight;
    
    try {
        // Call AI API
        const response = await api('/api/bot/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                matchId: matchId,
                homeId: homeId,
                awayId: awayId,
                context: 'worldcup-matchup',
                uiLang
            })
        });
        
        // Remove loading
        document.getElementById(loadingId)?.remove();
        
	    // Add AI response
	    const answer = response?.answer || response?.error || tx('抱歉，暂时无法回答这个问题。', 'Sorry, I cannot answer that right now.');
	    appendChatMessage(messages, answer, 'text-left', 'text-[11px] bg-white/5 text-gray-300 px-2 py-1 rounded-lg inline-block');
	} catch (err) {
	    document.getElementById(loadingId)?.remove();
	    appendChatMessage(messages, `${tx('请求失败', 'Request failed')}: ${err.message}`, 'text-left', 'text-[11px] text-red-400 px-2 py-1');
	}
    messages.scrollTop = messages.scrollHeight;
}

function askAIPreset(chatId, matchId, homeId, awayId, question) {
    const input = document.getElementById(`${chatId}-input`);
    input.value = question;
    sendAIMessage(chatId, matchId, homeId, awayId);
}

// ========== Refresh ==========
function togglePredDetail(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function refreshAll() {
    const btn = document.getElementById('refresh-btn');
    btn.style.animation = 'spin 0.5s linear';
    setTimeout(() => btn.style.animation = '', 500);
    loadScores();
    if (tab === 'schedule') loadSchedule();
    if (tab === 'standings') loadStandings();
}

// ========== Init ==========
loadScores();
autoRefresh = setInterval(loadScores, 120000);

// ========== Match Review Renderer ==========
function renderMatchReview(review) {
    if (!review || review.error) {
        return `<div class="text-gray-500 text-xs py-4 text-center">${tx('比赛回顾加载失败', 'Match review failed to load')}</div>`;
    }

    const match = review.match || {};
    const ai = review.aiPrediction || {};
    const bias = review.biasAnalysis || {};
    const summary = review.matchSummary || {};
    const eloChange = review.eloChange || {};
    const factors = bias.factors || [];
    const aiPostmortem = review.aiPostmortem || {};
    // \u53cc\u8bed\u5b57\u6bb5\u4f18\u5148\u6309 uiLang \u53d6;\u7f3a\u5931\u65f6\u56de\u843d\u5230\u65e7\u7684\u5355\u8bed\u82f1\u6587\u5b57\u6bb5(\u517c\u5bb9 v1 \u7f13\u5b58\u590d\u76d8)\u3002
    const pmLang = uiLang === 'zh' ? 'zh' : 'en';
    const pmArr = (i18nField, legacy) => (i18nField && Array.isArray(i18nField[pmLang]) ? i18nField[pmLang] : (legacy || []));
    const postmortemItems = [
      ...pmArr(aiPostmortem.whyRightI18n, aiPostmortem.whyRight),
      ...pmArr(aiPostmortem.whyWrongI18n, aiPostmortem.whyWrong),
      ...pmArr(aiPostmortem.processNotesI18n, aiPostmortem.processNotes),
    ].slice(0, 4);
    const pmHeadline = i18nText(aiPostmortem.headlineI18n, aiPostmortem.headline || '');
    const postmortemRaw = [pmHeadline, ...postmortemItems].join(' ');
    // AI-generated content (DeepSeek) always shows when completed, regardless of language.
    const aiGenerated = aiPostmortem.status === 'completed' && (pmHeadline || postmortemItems.length > 0);
    const hasChinesePostmortem = uiLang !== 'zh' || Boolean(aiPostmortem.headlineI18n?.zh) || /[\u4e00-\u9fff]/.test(postmortemRaw) || aiGenerated;
    const evidence = review.evidence || {};
    const predictionSource = review.predictionSource || 'pre_match';   // 'pre_match' | 'retrospective'
    const predictionSnapshotNote = review.predictionSnapshotNote || null;  // { zh, en } or null
    const isRetrospective = predictionSource === 'retrospective';
    const momentum = review.momentum || {};      // filterMatchEvents output
    const momentumBuckets = momentum.buckets || [];
    const momentumScript = momentum.matchScript || 'unknown';
    const momentumNotes = momentum.notes || [];
    const hasValue = (value) => value !== undefined && value !== null && value !== '';
    const displayValue = (value, fallback = '?') => hasValue(value) ? value : fallback;
    const displayPct = (value) => hasValue(value) ? `${value}%` : '—';
    const firstValue = (...values) => {
        const found = values.find(hasValue);
        return found === undefined ? undefined : found;
    };
    const scoreHome = firstValue(match.home?.score, match.homeScore);
    const scoreAway = firstValue(match.away?.score, match.awayScore);
    const matchTypeText = i18nText(summary.matchTypeI18n, summary.matchType || tx('已结束', 'Finished'));
    const overviewText = i18nText(summary.overviewI18n, summary.overview || '');
    const upsetText = i18nText(summary.upsetTextI18n, summary.upsetText || '');
    const biasSummary = i18nText(bias.summaryI18n, bias.summary || '');
    const scoreHomeNum = Number(scoreHome);
    const scoreAwayNum = Number(scoreAway);
    const scoreColor = Number.isFinite(scoreHomeNum) && Number.isFinite(scoreAwayNum)
        ? (scoreHomeNum > scoreAwayNum ? 'green' : scoreHomeNum < scoreAwayNum ? 'red' : 'yellow')
        : 'yellow';
    // Merge keyEvents + evidence.events with dedup by text/minute
    const rawKeyEvents = Array.isArray(review.keyEvents) ? review.keyEvents : [];
    const rawEvidenceEvents = Array.isArray(evidence.events) ? evidence.events : [];
    const seenTexts = new Set(rawKeyEvents.map(e => typeof e === 'string' ? e : (e?.text || '')));
    const events = [...rawKeyEvents, ...rawEvidenceEvents.filter(e => {
        const t = typeof e === 'string' ? e : (e?.text || '');
        if (!t || seenTexts.has(t)) return false;
        seenTexts.add(t);
        return true;
    })];

    let html = '';

    // === 比赛总结卡片 ===
    html += `<div class="glass rounded-xl p-3 mb-2.5">
        <div class="flex items-start gap-2.5">
            <span class="text-lg mt-0.5">📋</span>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-${['dominant_win', 'goal_fest'].includes(summary.matchTypeKey) || summary.matchType === '碾压大胜' || summary.matchType === '进球大战' ? 'yellow' : 'blue'}-400">${matchTypeText}</span>
                    <span class="text-[11px] text-gray-500">${match.group || ''}</span>
                </div>
                <div class="text-xs text-gray-400 leading-relaxed">${overviewText}</div>
                ${upsetText ? `<div class="text-[11px] font-bold text-yellow-400 mt-1">⚡ ${upsetText}</div>` : ''}
            </div>
        </div>
    </div>`;

    // === 赛后参考预测标注 (retrospective) ===
    if (isRetrospective && predictionSnapshotNote) {
        html += `<div class="glass rounded-xl p-3 mb-2.5 border border-yellow-500/20 bg-yellow-500/5">
            <div class="flex items-start gap-2">
                <span class="text-sm mt-0.5">⚠️</span>
                <div class="text-[11px] text-yellow-300 leading-relaxed">${esc(i18nText(predictionSnapshotNote, predictionSnapshotNote.en || ''))}</div>
            </div>
        </div>`;
    }

    // === AI预测 vs 真实结果 ===
    html += `<div class="glass rounded-xl p-3 mb-2.5">
        <div class="text-xs font-bold text-gray-400 mb-2">🤖 ${tx('AI 预测 vs 真实结果', 'AI Forecast vs Actual Result')}${isRetrospective ? ` <span class="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 align-middle">${tx('赛后参考', 'retro')}</span>` : ''}</div>
        <div class="grid grid-cols-2 gap-2">
            <div class="bg-white/5 rounded-lg p-2.5 text-center">
                <div class="text-[11px] text-gray-500 mb-1">${tx('AI 预测', 'AI Forecast')}</div>
                <div class="text-xl font-bold text-blue-400">${ai.predictedScore || tx('缺快照', 'No snapshot')}</div>
                <div class="text-[11px] text-gray-500 mt-1">
                    ${tx('主', 'Home')} ${displayPct(ai.homeWin)} · ${tx('平', 'Draw')} ${displayPct(ai.draw)} · ${tx('客', 'Away')} ${displayPct(ai.awayWin)}
                </div>
                <div class="text-[11px] text-gray-600">
                    xG ${displayValue(ai.homeExpectedGoals, '-')} - ${displayValue(ai.awayExpectedGoals, '-')}
                </div>
                ${review.predictionSourceNote ? `<div class="text-[10px] text-amber-300 mt-1">${esc(review.predictionSourceNote)}</div>` : ''}
            </div>
            <div class="bg-white/5 rounded-lg p-2.5 text-center">
                <div class="text-[11px] text-gray-500 mb-1">${tx('真实结果', 'Actual Result')}</div>
                <div class="text-xl font-bold text-${scoreColor}-400">
                    ${displayValue(scoreHome)} : ${displayValue(scoreAway)}
                </div>
                <div class="text-[11px] text-gray-500 mt-1">
                    ${displayMaybeTeamName(match.homeNameI18n || match.home || '')} vs ${displayMaybeTeamName(match.awayNameI18n || match.away || '')}
                </div>
                <div class="text-[11px] text-gray-600">
                    ${match.date || ''}
                </div>
            </div>
        </div>`;

    // 偏差摘要
    const accCls = bias.accuracy === 'highly_accurate' || bias.accuracy === 'exact_score' ? 'text-green-400 bg-green-500/10' : 
        bias.accuracy === 'result_correct_score_wrong' ? 'text-yellow-400 bg-yellow-500/10' : 
        'text-red-400 bg-red-500/10';
    const accLabel = bias.accuracy === 'highly_accurate' || bias.accuracy === 'exact_score' ? `🟢 ${tx('精准命中', 'Accurate')}` :
        bias.accuracy === 'result_correct_score_wrong' ? `🟡 ${tx('比分偏差', 'Score off')}` :
        bias.accuracy === 'wrong_result' ? `🔴 ${tx('结果错误', 'Wrong result')}` : `⚪ ${tx('未知', 'Unknown')}`;

    html += `<div class="mt-2.5 pt-2.5 border-t border-white/5">
        <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold ${accCls} px-2 py-0.5 rounded-md">${accLabel}</span>
            <span class="text-[11px] text-gray-500">${tx('预测置信', 'Forecast Confidence')} ${bias.predictedConfidence || 0}%</span>
        </div>
        <div class="text-[11px] text-gray-400 mt-1">${biasSummary}</div>
        <div class="text-[9px] text-gray-600 mt-1">${tx('“精准命中 / 比分偏差 / 结果错误”仅为本场预测与结果的对比，不代表模型整体准确率。', '“Accurate / Score off / Wrong result” compares this match only and does not represent overall model accuracy.')}</div>
    </div>`;

    html += '</div>';

    // === 偏差因素 ===
    if (factors.length > 0) {
        html += `<div class="glass rounded-xl p-3 mb-2.5">
            <div class="text-xs font-bold text-gray-400 mb-2">🔍 ${tx('偏差因素分析', 'Bias Factors')}</div>
            <div class="space-y-1.5">`;

        for (const f of factors) {
            const impCls = f.impact === 'high' ? 'border-red-500/20 bg-red-500/5' : f.impact === 'medium' ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-gray-500/20 bg-gray-500/5';
            const dotCls = f.impact === 'high' ? 'bg-red-500' : f.impact === 'medium' ? 'bg-yellow-500' : 'bg-gray-500';
            const factorText = i18nText(f.factorI18n || f.nameI18n, f.factor || f.name || '');
            const detailText = i18nText(f.detailI18n, f.detail || '');
            html += `<div class="border ${impCls} rounded-lg p-2">
                <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full ${dotCls} shrink-0"></span>
                    <span class="text-[11px] font-bold text-gray-300">${factorText}</span>
                    <span class="text-[9px] text-gray-500 ml-auto uppercase">${f.impact || ''}</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5 ml-3">${detailText}</div>
            </div>`;
        }

        html += '</div></div>';
    }

    // === 比赛动量 & 剧本 (Match Moments) ===
    if (momentumScript !== 'unknown' || momentumBuckets.length > 0) {
        const scriptLabels = {
            comeback:    { zh: '逆转', en: 'Comeback',     cls: 'bg-orange-500/15 text-orange-400 border-orange-500/20', icon: '🔄' },
            control_win: { zh: '控场胜', en: 'Control Win',  cls: 'bg-green-500/15 text-green-400 border-green-500/20', icon: '🎯' },
            smash_and_grab: { zh: '偷袭', en: 'Smash & Grab', cls: 'bg-red-500/15 text-red-400 border-red-500/20', icon: '🥷' },
            collapse:    { zh: '崩盘', en: 'Collapse',      cls: 'bg-red-500/15 text-red-400 border-red-500/20', icon: '📉' },
            even:        { zh: '僵持', en: 'Even',          cls: 'bg-gray-500/15 text-gray-400 border-gray-500/20', icon: '⚖️' },
        };
        const script = scriptLabels[momentumScript] || { zh: momentumScript, en: momentumScript, cls: 'bg-gray-500/15 text-gray-400 border-gray-500/20', icon: '❓' };

        html += `<div class="glass rounded-xl p-3 mb-2.5">
            <div class="flex items-center justify-between mb-2.5">
                <div class="text-xs font-bold text-gray-400">📊 ${tx('比赛动量', 'Match Momentum')}</div>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full border ${script.cls}">${script.icon} ${i18nText({zh: script.zh, en: script.en}, script.en)}</span>
            </div>`;

        // Momentum bars — 15-min buckets
        if (momentumBuckets.length > 0) {
            const maxShots = Math.max(1, ...momentumBuckets.map(b => Math.max(b.homeShots || 0, b.awayShots || 0)));
            html += `<div class="space-y-1">`;
            for (const b of momentumBuckets) {
                const homeW = Math.round(((b.homeShots || 0) / maxShots) * 100);
                const awayW = Math.round(((b.awayShots || 0) / maxShots) * 100);
                const goalMarks = (b.goals || 0) > 0 ? ' ⚽'.repeat(b.goals) : '';
                html += `<div class="flex items-center gap-1.5 text-[10px]">
                    <span class="w-10 text-right text-gray-500 shrink-0">${b.window || ''}'</span>
                    <div class="flex-1 flex items-center gap-0.5">
                        <div class="flex justify-end flex-1"><div class="h-3 rounded-sm bg-blue-500/40" style="width:${homeW}%"></div></div>
                        <span class="text-gray-500 w-5 text-center shrink-0">${(b.homeShots || 0)}-${(b.awayShots || 0)}</span>
                        <div class="flex justify-start flex-1"><div class="h-3 rounded-sm bg-red-500/40" style="width:${awayW}%"></div></div>
                    </div>
                    <span class="text-gray-500 w-12 text-left shrink-0">${goalMarks}</span>
                </div>`;
            }
            html += `</div>`;
            html += `<div class="flex justify-between text-[9px] text-gray-600 mt-1.5">
                <span>${tx('主队射门', 'Home shots')}</span>
                <span>H-A</span>
                <span>${tx('客队射门', 'Away shots')}</span>
            </div>`;
        }

        // Match Notes (GK errors, hydration windows, card warnings)
        if (momentumNotes.length > 0) {
            html += `<div class="mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 space-y-0.5">`;
            for (const note of momentumNotes.slice(0, 3)) {
                const noteText = typeof note === 'object' && note !== null ? tx(note.zh, note.en) : String(note);
                html += `<div class="leading-relaxed">💡 ${noteText}</div>`;
            }
            html += `</div>`;
        }

        html += '</div>';
    }

    // === Elo 变化 ===
    if (eloChange.homeBefore != null) {
        const homeDelta = eloChange.homeChange || 0;
        const awayDelta = eloChange.awayChange || 0;
        html += `<div class="glass rounded-xl p-3 mb-2.5">
            <div class="text-xs font-bold text-gray-400 mb-2">⚡ ${tx('Elo 评分变化', 'Elo Rating Change')}</div>
            <div class="grid grid-cols-2 gap-2">
                <div class="bg-white/5 rounded-lg p-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold">${displayMaybeTeamName(match.homeNameI18n || match.home || '')}</span>
                        <span class="text-[11px] font-mono font-bold ${homeDelta > 0 ? 'text-green-400' : homeDelta < 0 ? 'text-red-400' : 'text-gray-400'}">${homeDelta > 0 ? '+' : ''}${homeDelta}</span>
                    </div>
                    <div class="text-[11px] text-gray-500 mt-1">
                        ${eloChange.homeBefore} → <span class="text-white font-bold">${eloChange.homeAfter}</span>
                    </div>
                </div>
                <div class="bg-white/5 rounded-lg p-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold">${displayMaybeTeamName(match.awayNameI18n || match.away || '')}</span>
                        <span class="text-[11px] font-mono font-bold ${awayDelta > 0 ? 'text-green-400' : awayDelta < 0 ? 'text-red-400' : 'text-gray-400'}">${awayDelta > 0 ? '+' : ''}${awayDelta}</span>
                    </div>
                    <div class="text-[11px] text-gray-500 mt-1">
                        ${eloChange.awayBefore} → <span class="text-white font-bold">${eloChange.awayAfter}</span>
                    </div>
                </div>
            </div>
            <div class="text-[11px] text-gray-600 mt-1.5 flex items-center gap-2">
                <span>${tx('预期胜率', 'Expected Win Rate')}: ${Math.round((eloChange.expectedHome || 0) * 100)}% / ${Math.round((eloChange.expectedAway || 0) * 100)}%</span>
                <span>${tx('比分加成', 'Score Multiplier')}: x${(eloChange.goalDiffMultiplier || 1).toFixed(2)}</span>
            </div>
        </div>`;
    }

    // === 关键事件 ===
    if (events.length > 0) {
        html += `<div class="glass rounded-xl p-3 mb-2.5">
            <div class="text-xs font-bold text-gray-400 mb-2">🎬 ${tx('关键事件', 'Key Events')}</div>
            <div class="space-y-1">`;

        for (const evt of events) {
            const normalizedEvt = typeof evt === 'string' ? { text: evt } : (evt || {});
            const evtText = i18nText(normalizedEvt.textI18n, firstValue(normalizedEvt.text, normalizedEvt.description, normalizedEvt.title, normalizedEvt.event, normalizedEvt.summary, ''));
            const evtColor = normalizedEvt.type === 'goal' ? 'bg-green-500/15 text-green-400' :
                normalizedEvt.type === 'highlight' ? 'bg-yellow-500/10 text-yellow-400' :
                'bg-blue-500/10 text-blue-400';
            const evtIcon = normalizedEvt.type === 'goal' ? '⚽' : normalizedEvt.type === 'highlight' ? '⭐' : '💡';
            html += `<div class="flex items-start gap-2 py-1">
                <span class="text-[11px] font-mono text-gray-600 shrink-0 w-8 text-right">${displayValue(normalizedEvt.minute, '')}</span>
                <span class="${evtColor} px-1.5 py-0.5 rounded text-[11px] shrink-0">${evtIcon}</span>
                <span class="text-[11px] text-gray-300">${esc(evtText)}</span>
                ${hasValue(normalizedEvt.score) ? `<span class="text-[11px] font-mono font-bold text-white ml-auto shrink-0">${esc(normalizedEvt.score)}</span>` : ''}
            </div>`;
        }

        html += '</div></div>';
    }

    // === AI 赛后复盘框架 ===
    html += `<div class="glass rounded-xl p-3 mb-2.5">
        <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-bold text-purple-400">🧠 ${tx('AI 赛后复盘（实验性）', 'AI Post-match Review (Experimental)')}</div>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">${aiPostmortem.status || 'pending_provider'}</span>
        </div>
        ${(aiPostmortem.headline || aiPostmortem.headlineI18n) ? `<div class="text-xs font-bold text-white mb-1">${i18nText(aiPostmortem.headlineI18n, aiPostmortem.headline || '')} ${!hasChinesePostmortem ? `<span class="text-[9px] text-yellow-500 font-normal ml-1">(${tx('未返回中文', 'English Only')})</span>` : ''}</div>` : `<div class="text-[11px] text-gray-500 mb-1">${tx('AI 赛后复盘正在生成中...', 'Waiting for expert commentary/news evidence before AI attribution')}</div>`}
        <div class="grid grid-cols-3 gap-1.5 text-[10px] text-gray-500 mb-2">
            <div class="bg-white/5 rounded p-1.5 text-center">${tx('事件', 'Events')} ${evidence.events?.length || 0}</div>
            <div class="bg-white/5 rounded p-1.5 text-center">${tx('新闻', 'News')} ${evidence.news?.length || 0}</div>
            <div class="bg-white/5 rounded p-1.5 text-center">${tx('评论', 'Commentary')} ${evidence.commentary?.length || 0}</div>
        </div>
        ${postmortemItems.length > 0 ? postmortemItems.map(note => `
            <div class="text-[11px] text-gray-300 border-l border-purple-400/30 pl-2 mb-1">${i18nText(note)}</div>
        `).join('') : ''}
    </div>`;

    html += `<div class="text-center text-[9px] text-gray-700 mt-2">${tx('实验性赛后复盘：AI 自动生成内容可能不完整或存在误差，仅供参考。', 'Experimental post-match review: AI-generated content may be incomplete or inaccurate and is for reference only.')}</div>`;

    return html;
}

Object.assign(window, {
    switchTab,
    filterDate,
    openMatch,
    switchDetailTab,
    closeModal,
    openTeamDetail,
    closeTeamModal,
    openPreMatch,
    openPlayerDetail,
    setPitchView,
    sendAIMessage,
    askAIPreset,
    togglePredDetail,
    refreshAll,
});

// ========== Service Worker (PWA) ==========
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js?v=20260627').catch(() => {});
}
