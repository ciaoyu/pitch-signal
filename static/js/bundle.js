var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// static/js/state.js
var require_state = __commonJS({
  "static/js/state.js"() {
    window.WorldCup = window.WorldCup || {};
    if (typeof Fmt !== "undefined") window.WorldCup.Formatters = Fmt;
    if (typeof API !== "undefined") window.WorldCup.ApiClient = API;
    window.WorldCup.State = {};
    window.WorldCup.Utils = {};
    var tab = "live";
    var scheduleCache = [];
    var scheduleLoaded = false;
    var scheduleLoadPromise = null;
    var uiLang2 = localStorage.getItem("worldcup_lang") || "zh";
    var pitchViewMode = "both";
    window.WorldCup.State = { tab, scheduleCache, scheduleLoaded, scheduleLoadPromise, uiLang: uiLang2, pitchViewMode };
    var I18N = {
      zh: {
        liveTitle: "\u5B9E\u65F6\u6BD4\u5206",
        headerSubtitle: "\u7F8E\u52A0\u58A8 \xB7 \u8D5B\u4E8B\u5206\u6790",
        navLive: "\u6BD4\u5206",
        navSchedule: "\u8D5B\u7A0B",
        navPrediction: "\u9884\u6D4B",
        navStandings: "\u79EF\u5206",
        navTeams: "\u7403\u961F",
        noMatchesToday: "\u4ECA\u5929\u6682\u65E0\u6BD4\u8D5B",
        loadingPredictions: "\u52A0\u8F7D\u9884\u6D4B\u6570\u636E...",
        team: "\u7403\u961F",
        played: "\u8D5B",
        wins: "\u80DC",
        draws: "\u5E73",
        losses: "\u8D1F",
        goalsFor: "\u8FDB",
        goalsAgainst: "\u5931",
        goalDifference: "\u51C0",
        points: "\u5206",
        matchesSuffix: "\u573A",
        matchSuffix: "\u573A",
        updatePrefix: "\u66F4\u65B0 ",
        pointsLabel: "\u79EF\u5206",
        teamsLoading: "\u7403\u961F\u6570\u636E\u52A0\u8F7D\u4E2D...",
        \u8D5B\u524D\u9884\u6D4B: "\u8D5B\u524D\u9884\u6D4B",
        \u52A0\u8F7D\u8D5B\u524D\u9884\u6D4B: "\u52A0\u8F7D\u8D5B\u524D\u9884\u6D4B...",
        "Elo \u5B9E\u529B\u5BF9\u6BD4": "Elo \u5B9E\u529B\u5BF9\u6BD4",
        "Elo \u5DEE\u503C": "Elo \u5DEE\u503C",
        \u80DC\u5E73\u8D1F\u6982\u7387: "\u80DC\u5E73\u8D1F\u6982\u7387",
        "\u8FDB\u7403\u671F\u671B\u503C (\u03BB)": "\u8FDB\u7403\u671F\u671B\u503C (\u03BB)",
        \u573A\u5747\u8FDB\u7403: "\u573A\u5747\u8FDB\u7403",
        \u9884\u6D4B\u6570\u636E\u52A0\u8F7D\u5931\u8D25: "\u9884\u6D4B\u6570\u636E\u52A0\u8F7D\u5931\u8D25",
        preMatchStatsTitle: "\u8FD1\u671F\u573A\u5747\u7EDF\u8BA1",
        postMatchStatsTitle: "\u672C\u573A\u7EDF\u8BA1",
        postMatchNoStats: "\u8D5B\u540E\u7EDF\u8BA1\u6682\u672A\u540C\u6B65",
        postMatchNoStatsDesc: "ESPN \u6682\u672A\u63D0\u4F9B\u672C\u573A\u6280\u672F\u7EDF\u8BA1\uFF0C\u9875\u9762\u4E0D\u4F1A\u7528\u8D5B\u524D\u5747\u503C\u586B\u5145\u3002",
        preMatchNoStats: "\u8D5B\u524D\u6682\u65E0\u53EF\u7528\u7EDF\u8BA1",
        preMatchNoStatsDesc: "\u7F3A\u4E4F\u8FD1\u671F\u5B8C\u8D5B\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u751F\u6210\u573A\u5747\u7EDF\u8BA1\u3002",
        dataQualityTitle: "\u{1F4CA} \u6570\u636E\u8D28\u91CF\u8BF4\u660E",
        dataQualityRealtimeTitle: "\u2713 \u5B9E\u65F6\u6570\u636E",
        dataQualityRealtimeDesc: "\u6BD4\u8D5B\u8FDB\u7A0B\u3001\u5373\u65F6\u6BD4\u5206\uFF08ESPN \u5EF6\u8FDF ~5 \u5206\u949F\uFF09",
        dataQualityPrematchTitle: "\u2713 \u8D5B\u524D\u6570\u636E",
        dataQualityPrematchDesc: "\u63A8\u6D4B\u9635\u5BB9\uFF08\u57FA\u4E8E\u5386\u53F2\u9996\u53D1\uFF09\u3001\u6982\u7387\u9884\u6D4B",
        dataQualityDevTitle: "\u23F3 \u89C4\u5212\u652F\u6301",
        dataQualityDevDesc: "\u5B98\u65B9\u9996\u53D1\u3001\u5386\u53F2\u66FF\u8865\u4E0E\u6362\u4EBA",
        dataQualityPendingTitle: "\u26A0\uFE0F \u6682\u4E0D\u652F\u6301",
        dataQualityPendingDesc: "\u5386\u53F2\u5929\u6C14\u3001\u5B8C\u6574 H2H \u5E93",
        dataQualityFooter: '\u7F3A\u5931\u6570\u636E\u4E0D\u4F1A\u88AB\u63A8\u6D4B\u586B\u5145\uFF1B\u9875\u9762\u4F1A\u6E05\u6670\u6CE8\u660E"\u6682\u65E0"\u6216"\u5C1A\u672A\u540C\u6B65"\u3002',
        dataQualityBtn: "\u6570\u636E\u8D28\u91CF\u8BF4\u660E",
        footerDisclaimer: "\u5B9E\u9A8C\u6027\u6982\u7387\u6A21\u578B \xB7 \u975E\u6295\u6CE8\u5EFA\u8BAE \xB7 ESPN \u6570\u636E",
        scrollLeft: "\u5411\u5DE6\u6EDA\u52A8\u65E5\u671F",
        scrollRight: "\u5411\u53F3\u6EDA\u52A8\u65E5\u671F",
        tzSuffix: "\u5317\u4EAC\u65F6\u95F4",
        teamsError: "\u7403\u961F\u6570\u636E\u52A0\u8F7D\u5931\u8D25"
      },
      en: {
        liveTitle: "Live Scores",
        headerSubtitle: "USA \xB7 CAN \xB7 MEX \xB7 Match Analysis",
        navLive: "Live",
        navSchedule: "Schedule",
        navPrediction: "Prediction",
        navStandings: "Table",
        navTeams: "Teams",
        noMatchesToday: "No matches today",
        loadingPredictions: "Loading predictions...",
        team: "Team",
        played: "P",
        wins: "W",
        draws: "D",
        losses: "L",
        goalsFor: "GF",
        goalsAgainst: "GA",
        goalDifference: "GD",
        points: "Pts",
        matchesSuffix: "matches",
        matchSuffix: "match",
        updatePrefix: "Updated ",
        pointsLabel: "Pts",
        teamsLoading: "Loading teams...",
        "\u8D5B\u524D\u9884\u6D4B": "Pre-Match",
        "\u52A0\u8F7D\u8D5B\u524D\u9884\u6D4B...": "Loading pre-match prediction...",
        "Elo \u5B9E\u529B\u5BF9\u6BD4": "Elo Comparison",
        "Elo \u5DEE\u503C": "Elo Diff",
        "\u80DC\u5E73\u8D1F\u6982\u7387": "W/D/L Probability",
        "\u8FDB\u7403\u671F\u671B\u503C (\u03BB)": "Expected Goals (\u03BB)",
        "\u573A\u5747\u8FDB\u7403": "Avg Goals",
        "\u9884\u6D4B\u6570\u636E\u52A0\u8F7D\u5931\u8D25": "Prediction data unavailable",
        preMatchStatsTitle: "Recent Avg Stats",
        postMatchStatsTitle: "Match Stats",
        postMatchNoStats: "Post-match stats not synced",
        postMatchNoStatsDesc: "ESPN has not provided match statistics yet.",
        preMatchNoStats: "No pre-match stats",
        preMatchNoStatsDesc: "Insufficient completed matches to generate averages.",
        dataQualityTitle: "\u{1F4CA} Data Quality Notice",
        dataQualityRealtimeTitle: "\u2713 Live Data",
        dataQualityRealtimeDesc: "Match progress, live scores (ESPN delay ~5 mins)",
        dataQualityPrematchTitle: "\u2713 Pre-Match Data",
        dataQualityPrematchDesc: "Projected lineups (based on history), probability predictions",
        dataQualityDevTitle: "\u23F3 Planned Features",
        dataQualityDevDesc: "Official lineups, historical substitutes & substitutions",
        dataQualityPendingTitle: "\u26A0\uFE0F Not Supported",
        dataQualityPendingDesc: "Historical weather, complete H2H database",
        dataQualityFooter: 'Missing data will not be speculatively filled; pages will clearly indicate "N/A" or "Not Synced".',
        dataQualityBtn: "Data Quality Notice",
        footerDisclaimer: "Experimental probability model \xB7 Not betting advice \xB7 ESPN data",
        scrollLeft: "Scroll dates left",
        scrollRight: "Scroll dates right",
        tzSuffix: "CST (UTC+8)",
        teamsError: "Failed to load teams"
      }
    };
    window.WorldCup.I18N = I18N;
  }
});

// static/js/i18n.js
var require_i18n = __commonJS({
  "static/js/i18n.js"() {
    (function() {
      const ZH_NAMES = {
        // AUTO-GENERATED from data/player_name_zh.json
        "Lionel Messi": "\u83B1\u6602\u5185\u5C14\xB7\u6885\u897F",
        "Emiliano Mart\xEDnez": "\u57C3\u7C73\u5229\u4E9A\u8BFA\xB7\u9A6C\u4E01\u5185\u65AF",
        "Cristian Romero": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u7F57\u6885\u7F57",
        "Nicol\xE1s Otamendi": "\u5C3C\u53E4\u62C9\u65AF\xB7\u5965\u5854\u95E8\u8FEA",
        "Rodrigo De Paul": "\u7F57\u5FB7\u91CC\u6208\xB7\u5FB7\u4FDD\u7F57",
        "Enzo Fern\xE1ndez": "\u6069\u4F50\xB7\u8D39\u5C14\u5357\u5FB7\u65AF",
        "Alexis Mac Allister": "\u963F\u5386\u514B\u65AF\xB7\u9EA6\u5361\u5229\u65AF\u7279",
        "Juli\xE1n \xC1lvarez": "\u80E1\u8FDE\xB7\u963F\u5C14\u74E6\u96F7\u65AF",
        "Lautaro Mart\xEDnez": "\u52B3\u5854\u7F57\xB7\u9A6C\u4E01\u5185\u65AF",
        "Paulo Dybala": "\u4FDD\u7F57\xB7\u8FEA\u5DF4\u62C9",
        "\xC1ngel Di Mar\xEDa": "\u5B89\u8D6B\u5C14\xB7\u8FEA\u9A6C\u5229\u4E9A",
        "Leandro Paredes": "\u83B1\u5B89\u5FB7\u7F57\xB7\u5E15\u96F7\u5FB7\u65AF",
        "Nahuel Molina": "\u7EB3\u97E6\u5C14\xB7\u83AB\u5229\u7EB3",
        "Nicol\xE1s Tagliafico": "\u5C3C\u53E4\u62C9\u65AF\xB7\u5854\u5229\u4E9A\u83F2\u79D1",
        "Kylian Mbapp\xE9": "\u57FA\u5229\u5B89\xB7\u59C6\u5DF4\u4F69",
        "Antoine Griezmann": "\u5B89\u6258\u4E07\xB7\u683C\u5217\u5179\u66FC",
        "Ousmane Demb\xE9l\xE9": "\u4E4C\u65AF\u66FC\xB7\u767B\u8D1D\u83B1",
        "Aur\xE9lien Tchouam\xE9ni": "\u5965\u96F7\u8FDE\xB7\u4E18\u963F\u6885\u5C3C",
        "Rapha\xEBl Varane": "\u62C9\u6590\u5C14\xB7\u74E6\u62C9\u5185",
        "Mike Maignan": "\u8FC8\u514B\xB7\u8FC8\u5C3C\u6602",
        "Marcus Thuram": "\u9A6C\u5E93\u65AF\xB7\u56FE\u62C9\u59C6",
        "Eduardo Camavinga": "\u7231\u5FB7\u534E\u591A\xB7\u5361\u9A6C\u6587\u52A0",
        "William Saliba": "\u5A01\u5EC9\xB7\u8428\u5229\u5DF4",
        "Jules Kound\xE9": "\u6731\u5C14\u65AF\xB7\u6606\u5FB7",
        "Theo Hern\xE1ndez": "\u7279\u5965\xB7\u57C3\u5C14\u5357\u5FB7\u65AF",
        "Adrien Rabiot": "\u963F\u5FB7\u91CC\u5B89\xB7\u62C9\u6BD4\u5965",
        "Harry Kane": "\u54C8\u91CC\xB7\u51EF\u6069",
        "Jude Bellingham": "\u8D3E\u5FB7\xB7\u8D1D\u6797\u5384\u59C6",
        "Phil Foden": "\u83F2\u5C14\xB7\u798F\u767B",
        "Bukayo Saka": "\u5E03\u5361\u7EA6\xB7\u8428\u5361",
        "Declan Rice": "\u5FB7\u514B\u5170\xB7\u8D56\u65AF",
        "Jordan Pickford": "\u4E54\u4E39\xB7\u76AE\u514B\u798F\u5FB7",
        "Trent Alexander-Arnold": "\u7279\u4F26\u7279\xB7\u4E9A\u5386\u5C71\u5927-\u963F\u8BFA\u5FB7",
        "John Stones": "\u7EA6\u7FF0\xB7\u65AF\u901A\u65AF",
        "Marcus Rashford": "\u9A6C\u5E93\u65AF\xB7\u62C9\u4EC0\u798F\u5FB7",
        "Jack Grealish": "\u6770\u514B\xB7\u683C\u91CC\u5229\u4EC0",
        "Kyle Walker": "\u51EF\u5C14\xB7\u6C83\u514B",
        "Luke Shaw": "\u5362\u514B\xB7\u8096",
        "Vinicius Junior": "\u7EF4\u5C3C\u4FEE\u65AF\xB7\u5112\u5C3C\u5965\u5C14",
        "Rodrygo": "\u7F57\u5FB7\u91CC\u6208",
        "Alisson Becker": "\u963F\u5229\u677E\xB7\u8D1D\u514B\u5C14",
        "Casemiro": "\u5361\u585E\u7C73\u7F57",
        "Marquinhos": "\u9A6C\u5C14\u57FA\u5C3C\u5965\u65AF",
        "Thiago Silva": "\u8482\u4E9A\u6208\xB7\u5E2D\u5C14\u74E6",
        "Raphinha": "\u62C9\u83F2\u5C3C\u4E9A",
        "Bruno Guimar\xE3es": "\u5E03\u9C81\u8BFA\xB7\u5409\u9A6C\u826F\u65AF",
        "Lucas Paquet\xE1": "\u5362\u5361\u65AF\xB7\u5E15\u594E\u5854",
        "Gabriel Martinelli": "\u52A0\u5E03\u91CC\u57C3\u5C14\xB7\u9A6C\u4E01\u5185\u5229",
        "Richarlison": "\u91CC\u67E5\u5229\u68EE",
        "Endrick": "\u6069\u5FB7\u91CC\u514B",
        "Lamine Yamal": "\u62C9\u660E\xB7\u4E9A\u9A6C\u5C14",
        "Pedri": "\u4F69\u5FB7\u91CC",
        "Gavi": "\u52A0\u7EF4",
        "Dani Olmo": "\u8FBE\u5C3C\xB7\u5965\u5C14\u83AB",
        "\xC1lvaro Morata": "\u963F\u5C14\u74E6\u7F57\xB7\u83AB\u62C9\u5854",
        "Unai Sim\xF3n": "\u4E4C\u7EB3\u4F0A\xB7\u897F\u8499",
        "Aymeric Laporte": "\u827E\u6885\u91CC\u514B\xB7\u62C9\u6CE2\u5C14\u7279",
        "Rodri": "\u7F57\u5FB7\u91CC",
        "Ferran Torres": "\u8D39\u5170\xB7\u6258\u96F7\u65AF",
        "Nico Williams": "\u5C3C\u79D1\xB7\u5A01\u5EC9\u59C6\u65AF",
        "Fabi\xE1n Ruiz": "\u6CD5\u6BD4\u5B89\xB7\u9C81\u4F0A\u65AF",
        "Dani Carvajal": "\u8FBE\u5C3C\xB7\u5361\u74E6\u54C8\u5C14",
        "Mikel Oyarzabal": "\u7C73\u514B\u5C14\xB7\u5965\u4E9A\u5C14\u8428\u74E6\u5C14",
        "Manuel Neuer": "\u66FC\u52AA\u57C3\u5C14\xB7\u8BFA\u4F0A\u5C14",
        "Thomas M\xFCller": "\u6258\u9A6C\u65AF\xB7\u7A46\u52D2",
        "Joshua Kimmich": "\u7EA6\u4E66\u4E9A\xB7\u57FA\u7C73\u5E0C",
        "Kai Havertz": "\u51EF\xB7\u54C8\u5F17\u8328",
        "Florian Wirtz": "\u5F17\u6D1B\u91CC\u5B89\xB7\u7EF4\u5C14\u8328",
        "Leroy San\xE9": "\u83B1\u7F57\u4F0A\xB7\u8428\u5185",
        "Ilkay G\xFCndogan": "\u4F0A\u5C14\u5361\u4F0A\xB7\u541B\u591A\u5B89",
        "Toni Kroos": "\u6258\u5C3C\xB7\u514B\u7F57\u65AF",
        "Antonio R\xFCdiger": "\u5B89\u4E1C\u5C3C\u5965\xB7\u5415\u8FEA\u683C",
        "Jamal Musiala": "\u8D3E\u9A6C\u5C14\xB7\u7A46\u897F\u4E9A\u62C9",
        "Virgil van Dijk": "\u7EF4\u5409\u5C14\xB7\u8303\u6234\u514B",
        "Cody Gakpo": "\u79D1\u8FEA\xB7\u52A0\u79D1\u6CE2",
        "Frenkie de Jong": "\u5F17\u4F26\u57FA\xB7\u5FB7\u5BB9",
        "Memphis Depay": "\u5B5F\u83F2\u65AF\xB7\u5FB7\u4F69",
        "Xavi Simons": "\u54C8\u7EF4\xB7\u897F\u8499\u65AF",
        "Denzel Dumfries": "\u9093\u6CFD\u5C14\xB7\u675C\u59C6\u5F17\u91CC\u65AF",
        "Nathan Ak\xE9": "\u5185\u68EE\xB7\u963F\u514B",
        "Steven Bergwijn": "\u53F2\u8482\u6587\xB7\u535A\u683C\u97E6\u6069",
        "Wout Weghorst": "\u6C83\u7279\xB7\u97E6\u970D\u65AF\u7279",
        "Tijjani Reijnders": "\u8482\u8D3E\u5C3C\xB7\u96F7\u6069\u5FB7\u65AF",
        "Cristiano Ronaldo": "\u514B\u91CC\u65AF\u8482\u4E9A\u8BFA\xB7\u7F57\u7EB3\u5C14\u591A",
        "Bruno Fernandes": "\u5E03\u9C81\u8BFA\xB7\u8D39\u5C14\u5357\u5FB7\u65AF",
        "Rafael Le\xE3o": "\u62C9\u83F2\u5C14\xB7\u83B1\u6602",
        "Jo\xE3o F\xE9lix": "\u82E5\u6602\xB7\u8D39\u5229\u514B\u65AF",
        "R\xFAben Dias": "\u9C81\u672C\xB7\u8FEA\u4E9A\u65AF",
        "Bernardo Silva": "\u8D1D\u5C14\u7EB3\u591A\xB7\u5E2D\u5C14\u74E6",
        "Jo\xE3o Cancelo": "\u82E5\u6602\xB7\u574E\u585E\u6D1B",
        "Diogo Jota": "\u8FEA\u5965\u6208\xB7\u82E5\u5854",
        "Nuno Mendes": "\u52AA\u8BFA\xB7\u95E8\u5FB7\u65AF",
        "Gon\xE7alo Ramos": "\u8D21\u8428\u6D1B\xB7\u62C9\u83AB\u65AF",
        "Kevin De Bruyne": "\u51EF\u6587\xB7\u5FB7\u5E03\u52B3\u5185",
        "Romelu Lukaku": "\u7F57\u6885\u5362\xB7\u5362\u5361\u5E93",
        "Thibaut Courtois": "\u8482\u535A\xB7\u5E93\u5C14\u56FE\u74E6",
        "Axel Witsel": "\u963F\u514B\u585E\u5C14\xB7\u7EF4\u7279\u585E\u5C14",
        "Toby Alderweireld": "\u6258\u6BD4\xB7\u963F\u5C14\u5FB7\u7EF4\u96F7\u5C14\u5FB7",
        "Jan Vertonghen": "\u626C\xB7\u7EF4\u5C14\u901A\u4EA8",
        "Eden Hazard": "\u4F0A\u7538\xB7\u963F\u624E\u5C14",
        "Yannick Carrasco": "\u4E9A\u5C3C\u514B\xB7\u5361\u62C9\u65AF\u79D1",
        "Leandro Trossard": "\u83B1\u5B89\u5FB7\u7F57\xB7\u7279\u7F57\u8428\u5C14",
        "Charles De Ketelaere": "\u67E5\u5C14\u65AF\xB7\u5FB7\u51EF\u7279\u62C9\u5C14",
        "James Rodr\xEDguez": "\u54C8\u6885\u65AF\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "Luis D\xEDaz": "\u8DEF\u6613\u65AF\xB7\u8FEA\u4E9A\u65AF",
        "Falcao": "\u6CD5\u5C14\u8003",
        "Juan Cuadrado": "\u80E1\u5B89\xB7\u5938\u5FB7\u62C9\u591A",
        "Davinson S\xE1nchez": "\u8FBE\u6587\u68EE\xB7\u6851\u5207\u65AF",
        "Radamel Falcao": "\u6CD5\u5C14\u8003",
        "Johan Mojica": "\u7EA6\u7FF0\xB7\u83AB\u5E0C\u5361",
        "Richard R\xEDos": "\u7406\u67E5\u5FB7\xB7\u91CC\u5965\u65AF",
        "Jhon Arias": "\u7EA6\u7FF0\xB7\u963F\u91CC\u4E9A\u65AF",
        "Achraf Hakimi": "\u963F\u4EC0\u62C9\u592B\xB7\u54C8\u57FA\u7C73",
        "Hakim Ziyech": "\u54C8\u57FA\u59C6\xB7\u9F50\u8036\u8D6B",
        "Yassine Bounou": "\u4E9A\u8F9B\xB7\u5E03\u52AA",
        "Romain Sa\xEFss": "\u7F57\u66FC\xB7\u8D5B\u65AF",
        "Noussair Mazraoui": "\u52AA\u8428\u4F0A\u5C14\xB7\u9A6C\u5179\u52B3\u4F0A",
        "Sofiane Boufal": "\u7D22\u83F2\u5B89\xB7\u5E03\u6CD5\u5C14",
        "Youssef En-Nesyri": "\u5C24\u7D20\u798F\xB7\u6069\u7EB3\u897F\u91CC",
        "Nayef Aguerd": "\u7EB3\u8036\u592B\xB7\u963F\u76D6\u5C14\u5FB7",
        "Takumi Minamino": "\u5357\u91CE\u62D3\u5B9E",
        "Daichi Kamada": "\u9570\u7530\u5927\u5730",
        "Wataru Endo": "\u8FDC\u85E4\u822A",
        "Takehiro Tomiyasu": "\u51A8\u5B89\u5065\u6D0B",
        "Ritsu Doan": "\u5802\u5B89\u5F8B",
        "Junya Ito": "\u4F0A\u4E1C\u7EAF\u4E5F",
        "Kaoru Mitoma": "\u4E09\u7B18\u85AB",
        "Hiroki Ito": "\u4F0A\u85E4\u6D0B\u8F89",
        "Ayase Ueda": "\u4E0A\u7530\u7EEE\u4E16",
        "Shuichi Gonda": "\u6743\u7530\u4FEE\u4E00",
        "Luka Modri\u0107": "\u5362\u5361\xB7\u83AB\u5FB7\u91CC\u5947",
        "Ivan Peri\u0161i\u0107": "\u4F0A\u4E07\xB7\u4F69\u91CC\u897F\u5947",
        "Mateo Kova\u010Di\u0107": "\u9A6C\u7279\u5965\xB7\u79D1\u74E6\u5951\u5947",
        "Marcelo Brozovi\u0107": "\u9A6C\u5C14\u5207\u6D1B\xB7\u5E03\u7F57\u4F50\u7EF4\u5947",
        "Jo\u0161ko Gvardiol": "\u7EA6\u4EC0\u79D1\xB7\u74DC\u5C14\u8FEA\u5965\u5C14",
        "Dominik Livakovi\u0107": "\u591A\u7C73\u5C3C\u514B\xB7\u5229\u74E6\u79D1\u7EF4\u5947",
        "Ante Budimir": "\u5B89\u7279\xB7\u5E03\u8FEA\u7C73\u5C14",
        "Luis Su\xE1rez": "\u8DEF\u6613\u65AF\xB7\u82CF\u4E9A\u96F7\u65AF",
        "Edinson Cavani": "\u7231\u4E01\u68EE\xB7\u5361\u74E6\u5C3C",
        "Federico Valverde": "\u8D39\u5FB7\u91CC\u79D1\xB7\u5DF4\u5C14\u97E6\u5FB7",
        "Rodrigo Bentancur": "\u7F57\u5FB7\u91CC\u6208\xB7\u672C\u5766\u5E93\u5C14",
        "Jos\xE9 Mar\xEDa Gim\xE9nez": "\u4F55\u585E\xB7\u9A6C\u5229\u4E9A\xB7\u5409\u95E8\u5C3C\u65AF",
        "Darwin N\xFA\xF1ez": "\u8FBE\u5C14\u6587\xB7\u52AA\u6D85\u65AF",
        "Ronald Ara\xFAjo": "\u7F57\u7EB3\u5FB7\xB7\u963F\u52B3\u970D",
        "Facundo Pellistri": "\u6CD5\u5B54\u591A\xB7\u4F69\u5229\u65AF\u7279\u91CC",
        "Son Heung-min": "\u5B59\u5174\u615C",
        "Kim Min-jae": "\u91D1\u73C9\u54C9",
        "Lee Kang-in": "\u674E\u5EB7\u4EC1",
        "Hwang Hee-chan": "\u9EC4\u559C\u707F",
        "Cho Gue-sung": "\u8D75\u572D\u6210",
        "Hwang In-beom": "\u9EC4\u4EC1\u8303",
        "Christian Pulisic": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u666E\u5229\u897F\u5947",
        "Tyler Adams": "\u6CF0\u52D2\xB7\u4E9A\u5F53\u65AF",
        "Weston McKennie": "\u97E6\u65AF\u987F\xB7\u9EA6\u80AF\u5C3C",
        "Gio Reyna": "\u4E54\xB7\u96F7\u7EB3",
        "Tim Weah": "\u8482\u59C6\xB7\u97E6\u4E9A",
        "Sergi\xF1o Dest": "\u585E\u5C14\u5409\u5C3C\u5965\xB7\u5FB7\u65AF\u7279",
        "Matt Turner": "\u9A6C\u7279\xB7\u7279\u7EB3",
        "Yunus Musah": "\u5C24\u52AA\u65AF\xB7\u7A46\u8428",
        "Hirving Lozano": "\u4F0A\u5C14\u6587\xB7\u6D1B\u8428\u8BFA",
        "Ra\xFAl Jim\xE9nez": "\u52B3\u5C14\xB7\u5E0C\u95E8\u5C3C\u65AF",
        "Guillermo Ochoa": "\u5409\u5217\u5C14\u83AB\xB7\u5965\u4E54\u4E9A",
        "Edson \xC1lvarez": "\u57C3\u5FB7\u68EE\xB7\u963F\u5C14\u74E6\u96F7\u65AF",
        "Alexis Vega": "\u963F\u5386\u514B\u897F\u65AF\xB7\u7EF4\u52A0",
        "C\xE9sar Montes": "\u585E\u8428\u5C14\xB7\u8499\u7279\u65AF",
        "Mathew Ryan": "\u9A6C\u4FEE\xB7\u745E\u5B89",
        "Awer Mabil": "\u963F\u97E6\u5C14\xB7\u9A6C\u6BD4\u5C14",
        "Martin Boyle": "\u9A6C\u4E01\xB7\u535A\u4F0A\u5C14",
        "Mitchell Duke": "\u7C73\u5207\u5C14\xB7\u675C\u514B",
        "Ajdin Hrustic": "\u963F\u6770\u4E01\xB7\u9C81\u65AF\u8482\u5947",
        "Harry Souttar": "\u54C8\u91CC\xB7\u8428\u5854",
        "Mat Leckie": "\u9A6C\u7279\xB7\u83B1\u57FA",
        "Alphonso Davies": "\u963F\u65B9\u7D22\xB7\u6234\u7EF4\u65AF",
        "Jonathan David": "\u4E54\u7EB3\u68EE\xB7\u5927\u536B",
        "Cyle Larin": "\u8D5B\u5C14\xB7\u62C9\u6797",
        "Tajon Buchanan": "\u5854\u5BB9\xB7\u5E03\u574E\u5357",
        "Stephen Eust\xE1quio": "\u65AF\u8482\u82AC\xB7\u6B27\u65AF\u5854\u57FA\u5965",
        "Atiba Hutchinson": "\u963F\u8482\u5DF4\xB7\u54C8\u94A6\u68EE",
        "Sadio Man\xE9": "\u8428\u8FEA\u5965\xB7\u9A6C\u5185",
        "Edouard Mendy": "\u7231\u5FB7\u534E\xB7\u95E8\u8FEA",
        "Kalidou Koulibaly": "\u5361\u5229\u675C\xB7\u5E93\u5229\u5DF4\u5229",
        "Idrissa Gueye": "\u4F0A\u5FB7\u91CC\u8428\xB7\u683C\u8036",
        "Isma\xEFla Sarr": "\u4F0A\u65AF\u6885\u62C9\xB7\u8428\u5C14",
        "Bamba Dieng": "\u73ED\u5DF4\xB7\u8FEA\u6069",
        "Mehdi Taremi": "\u8FC8\u8D6B\u8FEA\xB7\u5854\u96F7\u7C73",
        "Sardar Azmoun": "\u8428\u5C14\u8FBE\u5C14\xB7\u963F\u5179\u8499",
        "Alireza Jahanbakhsh": "\u963F\u91CC\u96F7\u624E\xB7\u8D3E\u6C49\u5DF4\u8D6B\u4EC0",
        "Ali Gholizadeh": "\u963F\u91CC\xB7\u6208\u5229\u624E\u5FB7",
        "Granit Xhaka": "\u683C\u62C9\u5C3C\u7279\xB7\u624E\u5361",
        "Xherdan Shaqiri": "\u8C22\u5C14\u4E39\xB7\u6C99\u5947\u91CC",
        "Yann Sommer": "\u626C\xB7\u7D22\u9ED8",
        "Manuel Akanji": "\u66FC\u52AA\u57C3\u5C14\xB7\u963F\u574E\u5409",
        "Breel Embolo": "\u5E03\u96F7\u5C14\xB7\u6069\u535A\u6D1B",
        "Remo Freuler": "\u96F7\u83AB\xB7\u5F17\u6D1B\u4F0A\u52D2",
        "Enner Valencia": "\u6069\u7EB3\xB7\u74E6\u4F26\u897F\u4E9A",
        "Piero Hincapi\xE9": "\u76AE\u8036\u7F57\xB7\u8F9B\u5361\u76AE\u8036",
        "Mois\xE9s Caicedo": "\u83AB\u4F0A\u585E\u65AF\xB7\u51EF\u585E\u591A",
        "Gonzalo Plata": "\u5188\u8428\u6D1B\xB7\u666E\u62C9\u5854",
        "\xC1ngel Mena": "\u5B89\u8D6B\u5C14\xB7\u6885\u7EB3",
        "Victor Osimhen": "\u7EF4\u514B\u6258\xB7\u5965\u8F9B\u6885",
        "Samuel Chukwueze": "\u585E\u7F2A\u5C14\xB7\u4E18\u514B\u97E6\u6CFD",
        "Alex Iwobi": "\u4E9A\u5386\u514B\u65AF\xB7\u4F0A\u6C83\u6BD4",
        "Wilfred Ndidi": "\u5A01\u5C14\u5F17\u96F7\u5FB7\xB7\u6069\u8FEA\u8FEA",
        "Calvin Bassey": "\u5361\u5C14\u6587\xB7\u5DF4\u897F",
        "Taiwo Awoniyi": "\u6CF0\u6C83\xB7\u963F\u6C83\u5C3C\u4E49",
        "Andr\xE9 Ayew": "\u5B89\u5FB7\u70C8\xB7\u963F\u5C24",
        "Jordan Ayew": "\u4E54\u4E39\xB7\u963F\u5C24",
        "Thomas Partey": "\u6258\u9A6C\u65AF\xB7\u5E15\u5C14\u6CF0",
        "Mohammed Kudus": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u5E93\u675C\u65AF",
        "Inaki Williams": "\u4F0A\u7EB3\u57FA\xB7\u5A01\u5EC9\u59C6\u65AF",
        "Antoine Semenyo": "\u5B89\u6258\u4E07\xB7\u585E\u6885\u5C3C\u5965",
        "Salem Al-Dawsari": "\u8428\u5229\u59C6\xB7\u963F\u5C14\u9053\u8428\u91CC",
        "Mohammed Al-Deayea": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u5C14\u8FBE\u96C5",
        "Yasser Al-Shahrani": "\u4E9A\u745F\xB7\u963F\u5C14\u6C99\u8D6B\u62C9\u5C3C",
        "Saleh Al-Shehri": "\u8428\u5229\u8D6B\xB7\u963F\u5C14\u8C22\u8D6B\u91CC",
        "Gregg Berhalter": "\u683C\u96F7\u683C\xB7\u8D1D\u54C8\u5C14\u7279",
        "Dorival J\xFAnior": "\u591A\u91CC\u74E6\u5C14\xB7\u5112\u5C3C\u5965\u5C14",
        "Thierry Henry": "\u8482\u57C3\u91CC\xB7\u4EA8\u5229",
        "Vincenzo Montella": "\u6587\u68EE\u4F50\xB7\u8499\u7279\u62C9",
        "Steve Clarke": "\u53F2\u8482\u592B\xB7\u514B\u62C9\u514B",
        "Graham Arnold": "\u683C\u62C9\u6C49\u59C6\xB7\u963F\u8BFA\u5FB7",
        "Didier Deschamps": "\u8FEA\u8FEA\u57C3\xB7\u5FB7\u5C1A",
        "Gareth Southgate": "\u52A0\u96F7\u65AF\xB7\u7D22\u65AF\u76D6\u7279",
        "Lionel Scaloni": "\u5229\u6602\u5185\u5C14\xB7\u65AF\u5361\u6D1B\u5C3C",
        "Julian Nagelsmann": "\u6731\u5229\u5B89\xB7\u7EB3\u683C\u5C14\u65AF\u66FC",
        "Luis de la Fuente": "\u8DEF\u6613\u65AF\xB7\u5FB7\u62C9\u5BCC\u6069\u7279",
        "Roberto Mart\xEDnez": "\u7F57\u4F2F\u6258\xB7\u9A6C\u4E01\u5185\u65AF",
        "Marcelo Bielsa": "\u9A6C\u585E\u6D1B\xB7\u8D1D\u5C14\u8428",
        "Luciano Spalletti": "\u5362\u897F\u4E9A\u8BFA\xB7\u65AF\u5E15\u83B1\u8482",
        "Ronald Koeman": "\u7F57\u7EB3\u5FB7\xB7\u79D1\u66FC",
        "Marco Rose": "\u9A6C\u5C14\u79D1\xB7\u7F57\u6CFD",
        "Hajime Moriyasu": "\u68EE\u4FDD\u4E00",
        "J\xFCrgen Klinsmann": "\u5C24\u5C14\u6839\xB7\u514B\u6797\u65AF\u66FC",
        "Herv\xE9 Renard": "\u57C3\u5C14\u97E6\xB7\u52D2\u7EB3\u5C14",
        "Walid Regragui": "\u74E6\u5229\u5FB7\xB7\u96F7\u683C\u62C9\u5409",
        "Aliou Ciss\xE9": "\u963F\u5229\u4E4C\xB7\u897F\u585E",
        "Carlos Queiroz": "\u5361\u6D1B\u65AF\xB7\u594E\u7F57\u65AF",
        "Felix S\xE1nchez": "\u8D39\u5229\u514B\u65AF\xB7\u6851\u5207\u65AF",
        "Dragan Stojkovi\u0107": "\u5FB7\u62C9\u7518\xB7\u65AF\u6258\u4F0A\u79D1\u7EF4\u5947",
        "Murat Yakin": "\u7A46\u62C9\u7279\xB7\u96C5\u91D1",
        "Kasper Hjulmand": "\u5361\u65AF\u5E15\xB7\u5C24\u5C14\u66FC\u5FB7",
        "Rob Page": "\u7F57\u4F2F\xB7\u4F69\u5947",
        "Micha\u0142 Probierz": "\u7C73\u54C8\u4E4C\xB7\u666E\u7F57\u522B\u65E5",
        "Serhiy Rebrov": "\u8C22\u5C14\u76D6\xB7\u96F7\u5E03\u7F57\u592B",
        "Willy Sagnol": "\u5A01\u5229\xB7\u8428\u5C3C\u5965\u5C14",
        "Edward Iord\u0103nescu": "\u7231\u5FB7\u534E\xB7\u7EA6\u5C14\u5FB7\u5185\u65AF\u5E93",
        "Ivan Ha\u0161ek": "\u4F0A\u4E07\xB7\u54C8\u8C22\u514B",
        "Ralf Rangnick": "\u62C9\u5C14\u592B\xB7\u6717\u5C3C\u514B",
        "Matja\u017E Kek": "\u9A6C\u8482\u4E9A\u5179\xB7\u51EF\u514B",
        "Sylvinho": "\u897F\u5C14\u7EF4\u5C3C\u5965",
        "Zlatko Dali\u0107": "\u5179\u62C9\u7279\u79D1\xB7\u8FBE\u5229\u5947",
        "Fernando Diniz": "\u8D39\u5C14\u5357\u591A\xB7\u8FEA\u5C3C\u5179",
        "Gregg Berhalter (Interim)": "\u683C\u96F7\u683C\xB7\u4F2F\u54C8\u5C14\u7279 (\u4EE3\u7406)",
        "United States": "\u7F8E\u56FD",
        "Brazil": "\u5DF4\u897F",
        "France": "\u6CD5\u56FD",
        "Qatar": "\u5361\u5854\u5C14",
        "Turkey": "\u571F\u8033\u5176",
        "Scotland": "\u82CF\u683C\u5170",
        "Australia": "\u6FB3\u5927\u5229\u4E9A",
        "England": "\u82F1\u683C\u5170",
        "Argentina": "\u963F\u6839\u5EF7",
        "Germany": "\u5FB7\u56FD",
        "Spain": "\u897F\u73ED\u7259",
        "Portugal": "\u8461\u8404\u7259",
        "Uruguay": "\u4E4C\u62C9\u572D",
        "Italy": "\u610F\u5927\u5229",
        "Netherlands": "\u8377\u5170",
        "Croatia": "\u514B\u7F57\u5730\u4E9A",
        "Belgium": "\u6BD4\u5229\u65F6",
        "Colombia": "\u54E5\u4F26\u6BD4\u4E9A",
        "Mexico": "\u58A8\u897F\u54E5",
        "Switzerland": "\u745E\u58EB",
        "Morocco": "\u6469\u6D1B\u54E5",
        "Senegal": "\u585E\u5185\u52A0\u5C14",
        "Japan": "\u65E5\u672C",
        "South Korea": "\u97E9\u56FD",
        "Iran": "\u4F0A\u6717",
        "Saudi Arabia": "\u6C99\u7279\u963F\u62C9\u4F2F",
        "Denmark": "\u4E39\u9EA6",
        "Serbia": "\u585E\u5C14\u7EF4\u4E9A",
        "Poland": "\u6CE2\u5170",
        "Wales": "\u5A01\u5C14\u58EB",
        "Ukraine": "\u4E4C\u514B\u5170",
        "Georgia": "\u683C\u9C81\u5409\u4E9A",
        "Romania": "\u7F57\u9A6C\u5C3C\u4E9A",
        "Czech Republic": "\u6377\u514B",
        "Austria": "\u5965\u5730\u5229",
        "Slovenia": "\u65AF\u6D1B\u6587\u5C3C\u4E9A",
        "Albania": "\u963F\u5C14\u5DF4\u5C3C\u4E9A",
        "Balanced": "\u5747\u8861\u578B",
        "Attacking": "\u8FDB\u653B\u578B",
        "Defensive": "\u9632\u5B88\u578B",
        "Possession": "\u63A7\u7403\u578B",
        "Counter Attack": "\u9632\u5B88\u53CD\u51FB",
        "High Press": "\u9AD8\u4F4D\u538B\u8FEB",
        "Wing Play": "\u8FB9\u8DEF\u8FDB\u653B",
        "Direct": "\u957F\u4F20\u51B2\u540A",
        "Possession + Attacking": "\u63A7\u7403+\u8FDB\u653B\u8DB3\u7403",
        "Defensive + Counter": "\u9632\u5B88\u53CD\u51FB",
        "High Press + Direct": "\u9AD8\u538B\u903C\u62A2+\u5FEB\u901F\u51B2\u51FB",
        "years": "\u5E74",
        "year": "\u5E74",
        "months": "\u4E2A\u6708",
        "month": "\u4E2A\u6708",
        "Aaron HICKEY": "\u963F\u9686\xB7\u5E0C\u57FA",
        "Aaron TSHIBOLA": "\u963F\u9686\xB7\u9F50\u535A\u62C9",
        "Aaron WAN-BISSAKA": "\u963F\u9686\xB7\u4E07-\u6BD4\u8428\u5361",
        "Abbosbek FAYZULLAEV": "\u963F\u535A\u65AF\u522B\u514B\xB7\u6CD5\u4F0A\u7956\u62C9\u8036\u592B",
        "ABDALLAH ALFAKHORI": "\u963F\u535C\u675C\u62C9\xB7\u6CD5\u970D\u91CC",
        "ABDALLAH NASIB": "\u963F\u535C\u675C\u62C9\xB7\u7EB3\u897F\u5E03",
        "Abdoulaye SECK": "\u963F\u535C\u675C\u62C9\u8036\xB7\u585E\u514B",
        "Abdukodir KHUSANOV": "\u963F\u535C\u675C\u79D1\u8FEA\u5C14\xB7\u80E1\u8428\u8BFA\u592B",
        "Abdul FATAWU": "\u963F\u535C\u675C\u52D2\xB7\u6CD5\u5854\u6B66",
        "Abdul MUMIN": "\u963F\u535C\u675C\u52D2\xB7\u7A46\u660E",
        "ABDULAZIZ HATEM": "\u963F\u535C\u675C\u52D2\u963F\u9F50\u5179\xB7\u54C8\u7279\u59C6",
        "ABDULELAH ALAMRI": "\u963F\u535C\u675C\u52D2\u62C9\xB7\u963F\u59C6\u91CC",
        "Abdulkerim BARDAKCI": "\u963F\u535C\u675C\u52D2\u51EF\u91CC\u59C6\xB7\u5DF4\u5C14\u8FBE\u514B\u54F2",
        "Abdulla ABDULLAEV": "\u963F\u535C\u675C\u62C9\xB7\u963F\u535C\u675C\u62C9\u8036\u592B",
        "ABDULLAH ALHAMDDAN": "\u963F\u535C\u675C\u62C9\xB7\u54C8\u59C6\u4E39",
        "ABDULLAH ALKHAIBARI": "\u963F\u535C\u675C\u62C9\xB7\u6D77\u5DF4\u91CC",
        "Abduvohid NEMATOV": "\u963F\u535C\u675C\u6C83\u5E0C\u5FB7\xB7\u6D85\u9A6C\u6258\u592B",
        "Achref ABADA": "\u963F\u4EC0\u96F7\u592B\xB7\u963F\u5DF4\u8FBE",
        "Adalberto CARRASQUILLA": "\u963F\u8FBE\u5C14\u8D1D\u6258\xB7\u5361\u62C9\u65AF\u594E\u5229\u4E9A",
        "Adam AROUS": "\u4E9A\u5F53\xB7\u963F\u9C81\u65AF",
        "Adam HLOZEK": "\u4E9A\u5F53\xB7\u8D6B\u6D1B\u6CFD\u514B",
        "Adil BOULBINA": "\u963F\u8FEA\u5C14\xB7\u5E03\u5C14\u6BD4\u7EB3",
        "Agustin CANOBBIO": "\u963F\u53E4\u65AF\u4E01\xB7\u5361\u8BFA\u6BD4\u5965",
        "AHMED ALAAELDIN": "\u827E\u54C8\u8FC8\u5FB7\xB7\u963F\u62C9\u57C3\u5C14\u4E01",
        "AHMED ALGANEHI": "\u827E\u54C8\u8FC8\u5FB7\xB7\u52A0\u5C3C\u5E0C",
        "AHMED ALKASSAR": "\u827E\u54C8\u8FC8\u5FB7\xB7\u5361\u8428\u5C14",
        "AHMED BASIL": "\u827E\u54C8\u8FC8\u5FB7\xB7\u5DF4\u897F\u5C14",
        "AHMED FATHY": "\u827E\u54C8\u8FC8\u5FB7\xB7\u6CD5\u63D0",
        "AHMED FATOUH": "\u827E\u54C8\u8FC8\u5FB7\xB7\u6CD5\u56FE\u8D6B",
        "AHMED MAKNAZI": "\u827E\u54C8\u8FC8\u5FB7\xB7\u9A6C\u514B\u7EB3\u9F50",
        "AHMED QASEM": "\u827E\u54C8\u8FC8\u5FB7\xB7\u5361\u897F\u59C6",
        "Ahmed Reda TAGNAOUTI": "\u827E\u54C8\u8FC8\u5FB7\xB7\u96F7\u8FBE\xB7\u5854\u683C\u8BFA\u63D0",
        "Aiden ONEILL": "\u827E\u767B\xB7\u5965\u5C3C\u5C14",
        "AIMAN YAHYA": "\u827E\u66FC\xB7\u53F6\u6D77\u4E9A",
        "AIMAR SHER": "\u827E\u9A6C\u5C14\xB7\u8C22\u5C14",
        "Aissa MANDI": "\u963F\u4F0A\u8428\xB7\u66FC\u8FEA",
        "AKAM HASHIM": "\u963F\u5361\u59C6\xB7\u54C8\u5E0C\u59C6",
        "Akmal MOZGOVOY": "\u963F\u514B\u9A6C\u5C14\xB7\u83AB\u5179\u6208\u6C83\u4F0A",
        "AKRAM AFIF": "\u963F\u514B\u62C9\u59C6\xB7\u963F\u83F2\u592B",
        "ALA ALHAJJI": "\u963F\u62C9\xB7\u54C8\u5409",
        "Alan FRANCO": "\u963F\u5170\xB7\u5F17\u5170\u79D1",
        "Alan MINDA": "\u963F\u5170\xB7\u660E\u8FBE",
        "Alban LAFONT": "\u963F\u5C14\u73ED\xB7\u62C9\u4E30",
        "Alberto QUINTERO": "\u963F\u5C14\u8D1D\u6258\xB7\u91D1\u7279\u7F57",
        "Alejandro ROMERO GAMARRA": "\u4E9A\u5386\u676D\u5FB7\u7F57\xB7\u7F57\u6885\u7F57\xB7\u52A0\u9A6C\u62C9",
        "Aleksandar PAVLOVIC": "\u4E9A\u5386\u5C71\u5927\xB7\u5E15\u592B\u6D1B\u7EF4\u5947",
        "Alessandro CIRCATI": "\u4E9A\u5386\u5C71\u5FB7\u7F57\xB7\u5947\u5C14\u5361\u8482",
        "Alessandro SCHOEPF": "\u4E9A\u5386\u5C71\u5FB7\u7F57\xB7\u820D\u666E\u592B",
        "Alex ARCE": "\u963F\u83B1\u514B\u65AF\xB7\u963F\u5C14\u585E",
        "Alex BAENA": "\u963F\u83B1\u514B\u65AF\xB7\u5DF4\u57C3\u7EB3",
        "Alex FREEMAN": "\u4E9A\u5386\u514B\u65AF\xB7\u5F17\u91CC\u66FC",
        "Alex GRIMALDO": "\u963F\u83B1\u514B\u65AF\xB7\u683C\u91CC\u9A6C\u5C14\u591A",
        "Alex PAULSEN": "\u4E9A\u5386\u514B\u65AF\xB7\u4FDD\u5C14\u68EE",
        "Alex RUFER": "\u4E9A\u5386\u514B\u65AF\xB7\u9C81\u5F17",
        "ALEX SANDRO": "\u963F\u83B1\u58EB\xB7\u6851\u5FB7\u7F57",
        "Alex ZENDEJAS": "\u4E9A\u5386\u514B\u65AF\xB7\u68EE\u5FB7\u54C8\u65AF",
        "Alexander BERNHARDSSON": "\u4E9A\u5386\u5C71\u5927\xB7\u4F2F\u6069\u54C8\u5FB7\u677E",
        "Alexander ISAK": "\u4E9A\u5386\u5C71\u5927\xB7\u4F0A\u8428\u514B",
        "Alexander NUEBEL": "\u4E9A\u5386\u5C71\u5927\xB7\u7EBD\u8D1D\u5C14",
        "Alexander PRASS": "\u4E9A\u5386\u5C71\u5927\xB7\u666E\u62C9\u65AF",
        "Alexander SCHLAGER": "\u4E9A\u5386\u5C71\u5927\xB7\u65BD\u62C9\u683C",
        "Alexander SORLOTH": "\u4E9A\u5386\u5C71\u5927\xB7\u7D22\u5C14\u6D1B\u7279",
        "Alexandr SOJKA": "\u4E9A\u5386\u5C71\u5927\xB7\u7D22\u4F0A\u5361",
        "Alexandre PIERRE": "\u4E9A\u5386\u5C71\u5927\xB7\u76AE\u57C3\u5C14",
        "Alexandro MAIDANA": "\u4E9A\u5386\u676D\u5FB7\u7F57\xB7\u8FC8\u8FBE\u7EB3",
        "Alexis SAELEMAEKERS": "\u963F\u83B1\u514B\u897F\u65AF\xB7\u8428\u52D2\u9A6C\u514B\u5C14\u65AF",
        "Alfie JONES": "\u963F\u5C14\u83F2\xB7\u743C\u65AF",
        "ALHASHMI ALHUSSEIN": "\u54C8\u5E0C\u7C73\xB7\u4FAF\u8D5B\u56E0",
        "Ali ABDI": "\u963F\u91CC\xB7\u963F\u535C\u8FEA",
        "Ali AHMED": "\u963F\u91CC\xB7\u827E\u54C8\u8FC8\u5FB7",
        "ALI ALHAMADI": "\u963F\u91CC\xB7\u54C8\u9A6C\u8FEA",
        "Ali ALIPOUR": "\u963F\u91CC\xB7\u963F\u91CC\u666E\u5C14",
        "ALI AZAIZEH": "\u963F\u91CC\xB7\u963F\u624E\u4F0A\u6CFD",
        "ALI JASIM": "\u963F\u91CC\xB7\u8D3E\u897F\u59C6",
        "ALI LAJAMI": "\u963F\u91CC\xB7\u62C9\u8D3E\u7C73",
        "ALI MAJRASHI": "\u963F\u91CC\xB7\u9A6C\u6770\u62C9\u5E0C",
        "Ali NEMATI": "\u963F\u91CC\xB7\u5185\u9A6C\u63D0",
        "ALI OLWAN": "\u963F\u91CC\xB7\u5965\u5C14\u4E07",
        "ALI YOUSIF": "\u963F\u91CC\xB7\u4F18\u7D20\u798F",
        "Alidu SEIDU": "\u963F\u5229\u675C\xB7\u585E\u675C",
        "Alireza BEIRANVAND": "\u963F\u91CC\u96F7\u624E\xB7\u8D1D\u5170\u4E07\u5FB7",
        "ALISSON": "\u963F\u5229\u677E",
        "Alistair JOHNSTON": "\u963F\u5229\u65AF\u6CF0\u5C14\xB7\u7EA6\u7FF0\u65AF\u987F",
        "ALMOEZ ALI": "\u963F\u5C14\u83AB\u5179\xB7\u963F\u91CC",
        "Altay BAYINDIR": "\u963F\u5C14\u6CF0\xB7\u5DF4\u56E0\u8FEA\u5C14",
        "Alvaro FIDALGO": "\u963F\u5C14\u74E6\u7F57\xB7\u8FBE\u5C14\u6208",
        "Alvaro MONTERO": "\u963F\u5C14\u74E6\u7F57\xB7\u8499\u7279\u7F57",
        "Amad DIALLO": "\u963F\u9A6C\u5FB7\xB7\u8FEA\u4E9A\u6D1B",
        "Amadou ONANA": "\u963F\u9A6C\u675C\xB7\u5965\u7EB3\u7EB3",
        "Amar DEDIC": "\u963F\u9A6C\u5C14\xB7\u5FB7\u8FEA\u5947",
        "Amar MEMIC": "\u963F\u9A6C\u5C14\xB7\u6885\u7C73\u5947",
        "AMER JAMOUS": "\u963F\u6885\u5C14\xB7\u8D3E\u7A46\u65AF",
        "Amine GOUIRI": "\u963F\u660E\xB7\u53E4\u4F0A\u91CC",
        "Amine SBAI": "\u963F\u660E\xB7\u65AF\u5DF4\u4F0A",
        "AMIR ALAMMARI": "\u963F\u7C73\u5C14\xB7\u963F\u62C9\u9A6C\u91CC",
        "Amir HADZIAHMETOVIC": "\u963F\u7C73\u5C14\xB7\u54C8\u9F50\u4E9A\u8D6B\u6885\u6258\u7EF4\u5947",
        "Amir MURILLO": "\u963F\u7C73\u5C14\xB7\u7A46\u91CC\u7565",
        "Amirhossein HOSSEINZADEH": "\u963F\u7C73\u5C14\u4FAF\u8D5B\u56E0\xB7\u4FAF\u8D5B\u56E0\u624E\u5FB7",
        "Amirmohammad RAZAGHINIA": "\u963F\u7C73\u5C14\u7A46\u7F55\u9ED8\u5FB7\xB7\u62C9\u624E\u5409\u5C3C\u4E9A",
        "ANAS BADAWI": "\u963F\u7EB3\u65AF\xB7\u5DF4\u8FBE\u7EF4",
        "Anass SALAH EDDINE": "\u963F\u7EB3\u65AF\xB7\u8428\u62C9\u8D6B\u4E01",
        "Andreas SCHJELDERUP": "\u5B89\u5FB7\u70C8\u4E9A\u65AF\xB7\u8C22\u5C14\u5FB7\u9C81\u666E",
        "Andrej KRAMARIC": "\u5B89\u5FB7\u70C8\xB7\u514B\u62C9\u9A6C\u91CC\u5947",
        "Andres ANDRADE": "\u5B89\u5FB7\u70C8\u65AF\xB7\u5B89\u5FB7\u62C9\u5FB7",
        "Andres CUBAS": "\u5B89\u5FB7\u70C8\u65AF\xB7\u5E93\u5DF4\u65AF",
        "Andres GOMEZ": "\u5B89\u5FB7\u70C8\u65AF\xB7\u6208\u9EA6\u65AF",
        "Andy ROBERTSON": "\u5B89\u8FEA\xB7\u7F57\u4F2F\u900A",
        "Ange-Yoan BONNY": "\u5B89\u70ED-\u7EA6\u6602\xB7\u535A\u5C3C",
        "Angelo PRECIADO": "\u5B89\u8D6B\u6D1B\xB7\u666E\u96F7\u897F\u4E9A\u591A",
        "Angelo STILLER": "\u5B89\u6770\u6D1B\xB7\u65AF\u8482\u52D2",
        "Angus GUNN": "\u5B89\u683C\u65AF\xB7\u5188\u6069",
        "Anibal GODOY": "\u963F\u5C3C\u74E6\u5C14\xB7\u6208\u591A\u4F0A",
        "Anis HADJ MOUSSA": "\u963F\u5C3C\u65AF\xB7\u54C8\u5409\xB7\u7A46\u8428",
        "Anis SLIMANE": "\u963F\u5C3C\u65AF\xB7\u65AF\u5229\u9A6C\u5185",
        "Anthony ELANGA": "\u5B89\u4E1C\u5C3C\xB7\u57C3\u5170\u52A0",
        "Anthony GORDON": "\u5B89\u4E1C\u5C3C\xB7\u6208\u767B",
        "Anthony RALSTON": "\u5B89\u4E1C\u5C3C\xB7\u62C9\u5C14\u65AF\u987F",
        "Anthony VALENCIA": "\u5B89\u4E1C\u5C3C\u5965\xB7\u5DF4\u4F26\u897F\u4E9A",
        "Antoine MENDY": "\u5B89\u6258\u4E07\xB7\u95E8\u8FEA",
        "Antonee ROBINSON": "\u5B89\u4E1C\u5C3C\xB7\u7F57\u5BBE\u900A",
        "Antonio NUSA": "\u5B89\u4E1C\u5C3C\u5965\xB7\u52AA\u8428",
        "Antonio RUEDIGER": "\u5B89\u4E1C\u5C3C\u5965\xB7\u5415\u8FEA\u683C",
        "Antonio SANABRIA": "\u5B89\u4E1C\u5C3C\u5965\xB7\u8428\u7EB3\u592B\u91CC\u4E9A",
        "Ao TANAKA": "\u7530\u4E2D\u78A7",
        "Arda GULER": "\u963F\u5C14\u8FBE\xB7\u5C45\u83B1\u5C14",
        "Ardon JASHARI": "\u963F\u5C14\u4E1C\xB7\u8D3E\u6C99\u91CC",
        "Arjan MALIC": "\u963F\u5C14\u626C\xB7\u9A6C\u5229\u5947",
        "Arjany MARTHA": "\u963F\u5C14\u4E9A\u5C3C\xB7\u9A6C\u5C14\u5854",
        "Armando GONZALEZ": "\u963F\u66FC\u591A\xB7\u5188\u8428\u96F7\u65AF",
        "Armando OBISPO": "\u963F\u5C14\u66FC\u591A\xB7\u5965\u6BD4\u65AF\u6CE2",
        "Armin GIGOVIC": "\u963F\u5C14\u660E\xB7\u5409\u6208\u7EF4\u5947",
        "Arthur MASUAKU": "\u963F\u56FE\u5C14\xB7\u9A6C\u82CF\u963F\u5E93",
        "Arthur THEATE": "\u963F\u8482\u5C14\xB7\u6CF0\u4E9A\u7279",
        "Arya YOUSEFI": "\u963F\u91CC\u4E9A\xB7\u5C24\u585E\u83F2",
        "Assan OUEDRAOGO": "\u963F\u6851\xB7\u97E6\u5FB7\u62C9\u5965\u6208",
        "Assane DIAO": "\u963F\u8428\u5185\xB7\u8FEA\u5965",
        "ASSIM MADIBO": "\u963F\u897F\u59C6\xB7\u9A6C\u8FEA\u535A",
        "Aubrey MODIBA": "\u5965\u5E03\u91CC\xB7\u83AB\u8FEA\u5DF4",
        "Augustine BOAKYE": "\u5965\u53E4\u65AF\u4E01\xB7\u535A\u963F\u57FA\u8036",
        "Aurele AMENDA": "\u5965\u96F7\u52D2\xB7\u963F\u95E8\u8FBE",
        "Aurelien TCHOUAMENI": "\u5965\u96F7\u8FDE\xB7\u695A\u963F\u6885\u5C3C",
        "Auston TRUSTY": "\u5965\u65AF\u987F\xB7\u7279\u62C9\u65AF\u8482",
        "Avazbek ULMASALIYEV": "\u963F\u74E6\u5179\u522B\u514B\xB7\u4E4C\u5C14\u9A6C\u8428\u5229\u8036\u592B",
        "Axel TUANZEBE": "\u963F\u514B\u585E\u5C14\xB7\u56FE\u5B89\u6CFD\u8D1D",
        "Aymen DAHMEN": "\u827E\u95E8\xB7\u8FBE\u8D6B\u95E8",
        "AYMEN HUSSEIN": "\u827E\u95E8\xB7\u4FAF\u8D5B\u56E0",
        "AYOUB ALOUI": "\u963F\u5C24\u5E03\xB7\u963F\u5362\u7EF4",
        "Ayoub EL KAABI": "\u963F\u5C24\u5E03\xB7\u5361\u6BD4",
        "Ayoube AMAIMOUNI": "\u963F\u5C24\u8D1D\xB7\u963F\u6885\u7A46\u5C3C",
        "Ayumu SEKO": "\u5173\u6839\uFFFD\u7684\u6B65",
        "Ayyoub BOUADDI": "\u963F\u5C24\u5E03\xB7\u5E03\u963F\u8FEA",
        "Azarias LONDONO": "\u963F\u624E\u91CC\u4E9A\u65AF\xB7\u9686\u591A\u5C3C\u5965",
        "Aziz BEHICH": "\u963F\u9F50\u5179\xB7\u8D1D\u5E0C\u5947",
        "Azizbek AMONOV": "\u963F\u5179\u5179\u522B\u514B\xB7\u963F\u83AB\u8BFA\u592B",
        "Azizjon GANIEV": "\u963F\u9F50\u5179\u743C\xB7\u52A0\u5C3C\u8036\u592B",
        "Azzedine OUNAHI": "\u963F\u5179\u4E01\xB7\u4E4C\u7EB3\u5E0C",
        "Baba RAHMAN": "\u5DF4\u5DF4\xB7\u62C9\u8D6B\u66FC",
        "BAE Junho": "\u88F4\u4FCA\u6D69",
        "Bara Sapoko NDIAYE": "\u5DF4\u62C9\xB7\u8428\u6CE2\u79D1\xB7\u6069\u8FEA\u4E9A\u8036",
        "Baris Alper YILMAZ": "\u5DF4\u91CC\u65AF\xB7\u963F\u5C14\u4F69\xB7\u4F0A\u5C14\u9A6C\u5179",
        "Bart VERBRUGGEN": "\u5DF4\u7279\xB7\u8D39\u5E03\u9C81\u4EA8",
        "Bazoumana TOURE": "\u5DF4\u7956\u9A6C\u7EB3\xB7\u56FE\u96F7",
        "Behruzjon KARIMOV": "\u8D1D\u8D6B\u9C81\u5179\u743C\xB7\u5361\u91CC\u83AB\u592B",
        "Ben GANNON-DOAK": "\u672C\xB7\u7518\u519C-\u591A\u514B",
        "Ben OLD": "\u672C\xB7\u5965\u5C14\u5FB7",
        "Ben WAINE": "\u672C\xB7\u97E6\u6069",
        "Benjamin ASARE": "\u672C\u6770\u660E\xB7\u963F\u8428\u96F7",
        "Benjamin NYGREN": "\u672C\u6770\u660E\xB7\u5C3C\u683C\u4F26",
        "Benjamin TAHIROVIC": "\u672C\u6770\u660E\xB7\u5854\u5E0C\u7F57\u7EF4\u5947",
        "Besfort ZENELI": "\u8D1D\u65AF\u798F\u7279\xB7\u6CFD\u5185\u5229",
        "Bilal EL KHANNOUSS": "\u6BD4\u62C9\u5C14\xB7\u6C49\u52AA\u65AF",
        "Borja IGLESIAS": "\u535A\u5C14\u54C8\xB7\u4F0A\u683C\u83B1\u897F\u4E9A\u65AF",
        "Botirali ERGASHEV": "\u535A\u8482\u62C9\u5229\xB7\u57C3\u5C14\u52A0\u820D\u592B",
        "BOUALEM KHOUKHI": "\u5E03\u963F\u83B1\u59C6\xB7\u80E1\u8D6B",
        "Bradley BARCOLA": "\u5E03\u62C9\u5FB7\u5229\xB7\u5DF4\u5C14\u79D1\u62C9",
        "Bradley CROSS": "\u5E03\u62C9\u5FB7\u5229\xB7\u514B\u7F57\u65AF",
        "Brahim DIAZ": "\u5E03\u62C9\u5E0C\u59C6\xB7\u8FEA\u4E9A\u65AF",
        "Braian OJEDA": "\u5E03\u62C9\u626C\xB7\u5965\u8D6B\u8FBE",
        "Brandley KUWAS": "\u5E03\u5170\u5FB7\u5229\xB7\u5E93\u74E6\u65AF",
        "Brandon MECHELE": "\u5E03\u5170\u767B\xB7\u6885\u5207\u52D2",
        "Brandon THOMAS-ASANTE": "\u5E03\u5170\u767B\xB7\u6258\u9A6C\u65AF-\u963F\u6851\u7279",
        "BREMER": "\u5E03\u96F7\u9ED8",
        "Brenden AARONSON": "\u5E03\u4F26\u767B\xB7\u963F\u4F26\u68EE",
        "Brian BROBBEY": "\u5E03\u8D56\u6069\xB7\u5E03\u7F57\u6BD4",
        "Brian CIPENGA": "\u5E03\u83B1\u6069\xB7\u897F\u5F6D\u52A0",
        "Brian GUTIERREZ": "\u5E03\u8D56\u6069\xB7\u53E4\u94C1\u96F7\u65AF",
        "Brian RODRIGUEZ": "\u5E03\u8D56\u6069\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "Brice SAMBA": "\u5E03\u91CC\u65AF\xB7\u6851\u5DF4",
        "BRUNO GUIMARAES": "\u5E03\u9C81\u8BFA\xB7\u5409\u9A6C\u826F\u65AF",
        "Caglar SOYUNCU": "\u6070\u683C\u62C9\u5C14\xB7\u7D22\u4E91\u5E93",
        "Caleb YIRENKYI": "\u5361\u83B1\u5E03\xB7\u5EF6\u4F26\u57FA",
        "Callan ELLIOT": "\u5361\u5170\xB7\u57C3\u5229\u5965\u7279",
        "Callum McCOWATT": "\u5361\u52D2\u59C6\xB7\u9EA6\u8003\u74E6\u7279",
        "Cameron BURGESS": "\u5361\u6885\u9686\xB7\u4F2F\u5409\u65AF",
        "Cameron DEVLIN": "\u5361\u6885\u9686\xB7\u5FB7\u592B\u6797",
        "Camilo VARGAS": "\u5361\u7C73\u6D1B\xB7\u5DF4\u5C14\u52A0\u65AF",
        "Can UZUN": "\u8A79\xB7\u4E4C\u5C0A",
        "Carl SAINTE": "\u5361\u5C14\xB7\u5723\u7279",
        "Carl STARFELT": "\u5361\u5C14\xB7\u65AF\u5854\u8D39\u5C14\u7279",
        "Carlens ARCUS": "\u5361\u4F26\u65AF\xB7\u963F\u5C14\u5E93\u65AF",
        "Carlos ACEVEDO": "\u5361\u6D1B\u65AF\xB7\u963F\u585E\u97E6\u591A",
        "Carlos HARVEY": "\u5361\u6D1B\u65AF\xB7\u54C8\u7EF4",
        "Carney CHUKWUEMEKA": "\u5361\u5C3C\xB7\u695A\u514B\u7EF4\u6885\u5361",
        "CASTROP Jens": "\u5361\u65AF\u7279\u7F57\u666E\xB7\u5EF6\u65AF",
        "Cecilio WATERMAN": "\u585E\u897F\u5229\u5965\xB7\u6C83\u7279\u66FC",
        "Cedric BAKAMBU": "\u585E\u5FB7\u91CC\u514B\xB7\u5DF4\u574E\u5E03",
        "Cedric ITTEN": "\u585E\u5FB7\u91CC\u514B\xB7\u4F0A\u6ED5",
        "Cesar BLACKMAN": "\u585E\u8428\u5C14\xB7\u5E03\u83B1\u514B\u66FC",
        "Cesar HUERTA": "\u585E\u8428\u5C14\xB7\u97E6\u5C14\u5854",
        "Cesar MONTES": "\u585E\u8428\u5C14\xB7\u8499\u7279\u65AF",
        "Cesar SAMUDIO": "\u585E\u8428\u5C14\xB7\u8428\u7A46\u8FEA\u5965",
        "Cesar YANIS": "\u585E\u8428\u5C14\xB7\u4E9A\u5C3C\u65AF",
        "Chadi RIAD": "\u6C99\u8FEA\xB7\u91CC\u4E9A\u5FB7",
        "Chancel MBEMBA": "\u5C1A\u585E\u5C14\xB7\u59C6\u672C\u5DF4",
        "Charles PICKEL": "\u590F\u5C14\xB7\u76AE\u514B\u5C14",
        "Che ADAMS": "\u5207\xB7\u4E9A\u5F53\u65AF",
        "Chemsdine TALBI": "\u8C22\u59C6\u65AF\u4E01\xB7\u5854\u5C14\u6BD4",
        "Cherif NDIAYE": "\u8C22\u91CC\u592B\xB7\u6069\u8FEA\u4E9A\u8036",
        "CHO Guesung": "\u66F9\u572D\u6210",
        "CHO Wije": "\u8D75\u5728\u548C",
        "Chris BRADY": "\u514B\u91CC\u65AF\xB7\u5E03\u96F7\u8FEA",
        "Chris RICHARDS": "\u514B\u91CC\u65AF\xB7\u7406\u67E5\u5179",
        "Chris WOOD": "\u514B\u91CC\u65AF\xB7\u4F0D\u5FB7",
        "Christ Inao OULAI": "\u514B\u91CC\u65AF\u7279\xB7\u4F0A\u7459\xB7\u4E4C\u83B1",
        "Christian FASSNACHT": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u6CD5\u65AF\u7EB3\u8D6B\u7279",
        "Christopher BONSU BAAH": "\u514B\u91CC\u65AF\u6258\u5F17\xB7\u90A6\u82CF\xB7\u5DF4\u963F",
        "Christopher OPERI": "\u514B\u91CC\u65AF\u6258\u5F17\xB7\u5965\u4F69\u91CC",
        "CJ DOS SANTOS": "CJ\xB7\u591A\u65AF\u6851\u6258\u65AF",
        "Connor METCALFE": "\u5EB7\u7EB3\xB7\u6885\u7279\u5361\u592B",
        "Craig GORDON": "\u514B\u96F7\u683C\xB7\u6208\u767B",
        "Cristian MARTINEZ": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u9A6C\u4E01\u5185\u65AF",
        "Cristian ROLDAN": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u7F57\u5C14\u4E39",
        "Cristian VOLPATO": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u6C83\u5C14\u5E15\u6258",
        "Crysencio SUMMERVILLE": "\u514B\u91CC\u68EE\u897F\u5965\xB7\u8428\u9ED8\u7EF4\u5C14",
        "Cucho HERNANDEZ": "\u5E93\u4E54\xB7\u57C3\u5C14\u5357\u5FB7\u65AF",
        "DAILON LIVRAMENTO": "\u6234\u9686\xB7\u5229\u592B\u62C9\u95E8\u6258",
        "Daizen MAEDA": "\u524D\u7530\u5927\u7136",
        "Damian BOBADILLA": "\u8FBE\u7C73\u5B89\xB7\u535A\u74E6\u8FEA\u5229\u4E9A",
        "Dan BURN": "\u4E39\xB7\u4F2F\u6069",
        "Dan NDOYE": "\u4E39\xB7\u6069\u591A\u8036",
        "Danial IRI": "\u8FBE\u5C3C\u5C14\xB7\u4F0A\u91CC",
        "Daniel MUNOZ": "\u4E39\u5C3C\u5C14\xB7\u7A46\u5C3C\u5965\u65AF",
        "Daniel SVENSSON": "\u4E39\u5C3C\u5C14\xB7\u65AF\u6587\u677E",
        "DANILO": "\u8FBE\u5C3C\u6D1B",
        "DANILO SANTOS": "\u8FBE\u5C3C\u6D1B\xB7\u6851\u6258\u65AF",
        "Danley JEAN JACQUES": "\u4E39\u5229\xB7\u8BA9\xB7\u96C5\u514B",
        "Darwin NUNEZ": "\u8FBE\u5C14\u6587\xB7\u52AA\u6D85\u65AF",
        "David AFFENGRUBER": "\u5927\u536B\xB7\u963F\u82AC\u683C\u9C81\u4F2F",
        "David ALABA": "\u5927\u536B\xB7\u963F\u62C9\u5DF4",
        "David DOUDERA": "\u5927\u536B\xB7\u675C\u5FB7\u62C9",
        "David JURASEK": "\u5927\u536B\xB7\u5C24\u62C9\u8C22\u514B",
        "David MOLLER WOLFE": "\u5927\u536B\xB7\u9ED8\u52D2\xB7\u6C83\u5C14\u592B",
        "David OSPINA": "\u5927\u536B\xB7\u5965\u65AF\u76AE\u7EB3",
        "David RAUM": "\u5927\u536B\xB7\u52B3\u59C6",
        "David RAYA": "\u5927\u536B\xB7\u62C9\u4E9A",
        "David ZIMA": "\u5927\u536B\xB7\u9F50\u9A6C",
        "Davinson SANCHEZ": "\u8FBE\u6587\u68EE\xB7\u6851\u5207\u65AF",
        "Dayne ST. CLAIR": "\u6234\u6069\xB7\u5723\u514B\u83B1\u5C14",
        "Dayot UPAMECANO": "\u8FBE\u7EA6\xB7\u4E4C\u5E15\u6885\u5361\u8BFA",
        "Dean HENDERSON": "\u8FEA\u6069\xB7\u4EA8\u5FB7\u68EE",
        "Deiver MACHADO": "\u6234\u5F17\xB7\u9A6C\u67E5\u591A",
        "Dejan LJUBICIC": "\u5FB7\u626C\xB7\u67F3\u6BD4\u5951\u5947",
        "Denil CASTILLO": "\u5FB7\u5C3C\u5C14\xB7\u5361\u65AF\u8482\u7565",
        "Denis VISINSKY": "\u4E39\u5C3C\u65AF\xB7\u7EF4\u8F9B\u65AF\u57FA",
        "Denis ZAKARIA": "\u5FB7\u5C3C\xB7\u624E\u5361\u91CC\u4E9A",
        "Deniz GUL": "\u5FB7\u5C3C\u5179\xB7\u5C45\u5C14",
        "Deniz UNDAV": "\u5FB7\u5C3C\u5179\xB7\u6E29\u8FBE\u592B",
        "Dennis DARGAHI": "\u4E39\u5C3C\u65AF\xB7\u8FBE\u5C14\u52A0\u5E0C",
        "Dennis HADZIKADUNIC": "\u4E39\u5C3C\u65AF\xB7\u54C8\u5409\u5361\u675C\u5C3C\u5947",
        "Derek CORNELIUS": "\u5FB7\u91CC\u514B\xB7\u79D1\u5185\u67F3\u65AF",
        "DEROY DUARTE": "\u5FB7\u7F57\u4F0A\xB7\u675C\u963F\u5C14\u7279",
        "Derrick ETIENNE": "\u5FB7\u91CC\u514B\xB7\u827E\u8482\u5B89",
        "Derrick LUCKASSEN": "\u5FB7\u91CC\u514B\xB7\u5362\u5361\u68EE",
        "Desire DOUE": "\u5FB7\u897F\u96F7\xB7\u675C\u57C3",
        "Deveron FONVILLE": "\u5FB7\u5F17\u9F99\xB7\u4E30\u7EF4\u5C14",
        "Diego GOMEZ": "\u8FED\u6208\xB7\u6208\u9EA6\u65AF",
        "Diego MOREIRA": "\u8FED\u6208\xB7\u83AB\u96F7\u62C9",
        "DINEY BORGES": "\u8FEA\u5185\xB7\u535A\u5C14\u8D6B\u65AF",
        "DIOGO COSTA": "\u8FEA\u5965\u6208\xB7\u79D1\u65AF\u5854",
        "DIOGO DALOT": "\u8FEA\u5965\u6208\xB7\u8FBE\u6D1B\u7279",
        "Djed SPENCE": "\u6770\u5FB7\xB7\u65AF\u5F6D\u65AF",
        "Djibril SOW": "\u5409\u5E03\u91CC\u5C14\xB7\u7D22\u4E4C",
        "Dodi LUKEBAKIO": "\u591A\u8FEA\xB7\u5362\u514B\u5DF4\u57FA\u5965",
        "Dominic HYAM": "\u591A\u7C73\u5C3C\u514B\xB7\u6D77\u59C6",
        "Dominik KOTARSKI": "\u591A\u7C73\u5C3C\u514B\xB7\u79D1\u5854\u5C14\u65AF\u57FA",
        "Dominik LIVAKOVIC": "\u591A\u7C73\u5C3C\u514B\xB7\u5229\u74E6\u79D1\u7EF4\u5947",
        "Dominique SIMON": "\u591A\u7C73\u5C3C\u514B\xB7\u897F\u8499",
        "Donyell MALEN": "\u591A\u5C3C\u5C14\xB7\u9A6C\u4F26",
        "Dostonbek KHAMDAMOV": "\u591A\u65AF\u987F\u522B\u514B\xB7\u54C8\u59C6\u8FBE\u83AB\u592B",
        "DOUGLAS SANTOS": "\u9053\u683C\u62C9\u65AF\xB7\u6851\u6258\u65AF",
        "Duckens NAZON": "\u675C\u80AF\xB7\u7EB3\u5B97",
        "Duje CALETA-CAR": "\u675C\u8036\xB7\u5361\u83B1\u5854-\u5361\u5C14",
        "Dylan BATUBINSIKA": "\u8FEA\u4F26\xB7\u5DF4\u56FE\u5BBE\u897F\u5361",
        "Dylan BRONN": "\u8FEA\u4F26\xB7\u5E03\u9686",
        "Dzenis BURNIC": "\u6770\u5C3C\u65AF\xB7\u5E03\u5C14\u5C3C\u5947",
        "Eberechi EZE": "\u57C3\u8D1D\u96F7\u5E0C\xB7\u57C3\u6CFD",
        "EDERSON": "\u57C3\u5FB7\u68EE",
        "EDERSON SILVA": "\u57C3\u5FB7\u68EE\xB7\u5E2D\u5C14\u74E6",
        "Edgar Yoel BARCENAS": "\u57C3\u5FB7\u52A0\xB7\u7EA6\u57C3\u5C14\xB7\u5DF4\u585E\u7EB3\u65AF",
        "Edgardo FARINA": "\u57C3\u5FB7\u52A0\u591A\xB7\u6CD5\u91CC\u7EB3",
        "Edin DZEKO": "\u57C3\u4E01\xB7\u54F2\u79D1",
        "EDMILSON JUNIOR": "\u57C3\u5FB7\u7C73\u5C14\u677E",
        "Edo KAYEMBE": "\u57C3\u591A\xB7\u5361\u5EF6\u8D1D",
        "Edson ALVAREZ": "\u57C3\u5FB7\u677E\xB7\u963F\u5C14\u74E6\u96F7\u65AF",
        "Egil SELVIK": "\u57C3\u5409\u5C14\xB7\u585E\u5C14\u7EF4\u514B",
        "EHSAN HADDAD": "\u827E\u54C8\u6851\xB7\u54C8\u8FBE\u5FB7",
        "Ehsan HAJISAFI": "\u827E\u54C8\u6851\xB7\u54C8\u5409\u8428\u83F2",
        "El Hadji Malick DIOUF": "\u54C8\u5409\xB7\u9A6C\u5229\u514B\xB7\u8FEA\u4E4C\u592B",
        "Eldor SHOMURODOV": "\u57C3\u5C14\u591A\u5C14\xB7\u8096\u7A46\u7F57\u591A\u592B",
        "Elias ACHOURI": "\u4F0A\u83B1\u4E9A\u65AF\xB7\u963F\u8212\u91CC",
        "Elias SAAD": "\u4F0A\u83B1\u4E9A\u65AF\xB7\u8428\u963F\u5FB7",
        "Elijah JUST": "\u4F0A\u83B1\u8D3E\xB7\u8D3E\u65AF\u7279",
        "Elisha OWUSU": "\u57C3\u5229\u6C99\xB7\u5965\u4E4C\u82CF",
        "Elliot ANDERSON": "\u57C3\u5229\u5965\u7279\xB7\u5B89\u5FB7\u68EE",
        "Elliot STROUD": "\u57C3\u5229\u5965\u7279\xB7\u65AF\u7279\u52B3\u5FB7",
        "Ellyes SKHIRI": "\u57C3\u5229\u4E9A\u65AF\xB7\u65AF\u5E0C\u91CC",
        "Eloy ROOM": "\u57C3\u6D1B\u4F0A\xB7\u7F57\u59C6",
        "Elye WAHI": "\u57C3\u5229\u8036\xB7\u74E6\u5E0C",
        "EMAM ASHOUR": "\u4F0A\u739B\u76EE\xB7\u963F\u8212\u5C14",
        "Emiliano MARTINEZ": "\u57C3\u7C73\u5229\u4E9A\u8BFA\xB7\u9A6C\u4E01\u5185\u65AF",
        "Emmanuel AGBADOU": "\u57C3\u9A6C\u7EBD\u57C3\u5C14\xB7\u963F\u5DF4\u675C",
        "Enzo FERNANDEZ": "\u6069\u4F50\xB7\u8D39\u5C14\u5357\u5FB7\u65AF",
        "EOM Jisung": "\u4E25\u667A\u661F",
        "Eray COEMERT": "\u57C3\u62C9\u4F0A\xB7\u79D1\u9ED8\u7279",
        "Eren ELMALI": "\u57C3\u4F26\xB7\u57C3\u5C14\u9A6C\u52D2",
        "Eric DAVIS": "\u57C3\u91CC\u514B\xB7\u6234\u7EF4\u65AF",
        "Eric GARCIA": "\u57C3\u91CC\u514B\xB7\u52A0\u897F\u4E9A",
        "Eric SMITH": "\u57C3\u91CC\u514B\xB7\u53F2\u5BC6\u65AF",
        "Erik LIRA": "\u57C3\u91CC\u514B\xB7\u5229\u62C9",
        "Erling HAALAND": "\u57C3\u5C14\u6797\xB7\u54C8\u5170\u5FB7",
        "Ermedin DEMIROVIC": "\u57C3\u5C14\u6885\u4E01\xB7\u5FB7\u7C73\u7F57\u7EF4\u5947",
        "Ermin MAHMIC": "\u57C3\u5C14\u660E\xB7\u9A6C\u8D6B\u7C73\u5947",
        "Ernest NUAMAH": "\u6B27\u5185\u65AF\u7279\xB7\u52AA\u963F\u9A6C",
        "Esmir BAJRAKTAREVIC": "\u57C3\u65AF\u7C73\u5C14\xB7\u5DF4\u4F0A\u62C9\u514B\u5854\u96F7\u7EF4\u5947",
        "Evan NDICKA": "\u57C3\u4E07\xB7\u6069\u8FEA\u5361",
        "Evann GUESSAND": "\u57C3\u4E07\xB7\u76D6\u6851",
        "Evidence MAKGOPA": "\u57C3\u7EF4\u767B\u65AF\xB7\u9A6C\u79D1\u5E15",
        "Exequiel PALACIOS": "\u57C3\u585E\u57FA\u8036\u5C14\xB7\u5E15\u62C9\u897F\u5965\u65AF",
        "Ezri KONSA": "\u57C3\u5179\u91CC\xB7\u5B54\u8428",
        "Fabian BALBUENA": "\u6CD5\u6BD4\u5B89\xB7\u5DF4\u5C14\u5E03\u57C3\u7EB3",
        "Fabian RIEDER": "\u6CD5\u6BD4\u5B89\xB7\u91CC\u5FB7\u5C14",
        "Fabian RUIZ": "\u6CD5\u6BD4\u5B89\xB7\u9C81\u4F0A\u65AF",
        "FABINHO": "\u6CD5\u6BD4\u5C3C\u5965",
        "Facundo MEDINA": "\u6CD5\u6606\u591A\xB7\u6885\u8FEA\u7EB3",
        "FAHAD TALIB": "\u6CD5\u8D6B\u5FB7\xB7\u5854\u5229\u5E03",
        "Fares CHAIBI": "\u6CD5\u96F7\u65AF\xB7\u6C99\u4F0A\u6BD4",
        "Fares GHEDJEMIS": "\u6CD5\u96F7\u65AF\xB7\u76D6\u6770\u7C73\u65AF",
        "Farrukh SAYFIEV": "\u6CD5\u9C81\u8D6B\xB7\u8D5B\u83F2\u8036\u592B",
        "Federico VINAS": "\u8D39\u5FB7\u91CC\u79D1\xB7\u6BD4\u5C3C\u4E9A\u65AF",
        "Felix NMECHA": "\u8D39\u5229\u514B\u65AF\xB7\u6069\u6885\u67E5",
        "Felix TORRES": "\u8D39\u5229\u514B\u65AF\xB7\u6258\u96F7\u65AF",
        "FERAS ALBRIKAN": "\u8D39\u62C9\u65AF\xB7\u5E03\u91CC\u574E",
        "Ferdi KADIOGLU": "\u8D39\u5C14\u8FEA\xB7\u5361\u8FEA\u5965\u683C\u5362",
        "Fernando MUSLERA": "\u8D39\u5C14\u5357\u591A\xB7\u7A46\u65AF\u83B1\u62C9",
        "Fidel ESCOBAR": "\u83F2\u5FB7\u5C14\xB7\u57C3\u65AF\u79D1\u74E6\u5C14",
        "Findlay CURTIS": "\u82AC\u5FB7\u5229\xB7\u67EF\u8482\u65AF",
        "Finn SURMAN": "\u82AC\u6069\xB7\u82CF\u5C14\u66FC",
        "Firas CHAOUAT": "\u83F2\u62C9\u65AF\xB7\u6C99\u74E6\u7279",
        "Fiston MAYELE": "\u83F2\u65AF\u987F\xB7\u9A6C\u8036\u83B1",
        "Florian GRILLITSCH": "\u5F17\u6D1B\u91CC\u5B89\xB7\u683C\u91CC\u5229\u5947",
        "Florian WIEGELE": "\u5F17\u6D1B\u91CC\u5B89\xB7\u7EF4\u683C\u52D2",
        "Folarin BALOGUN": "\u798F\u62C9\u6797\xB7\u5DF4\u6D1B\u8D21",
        "Francis DE VRIES": "\u5F17\u6717\u897F\u65AF\xB7\u5FB7\u5F17\u91CC\u65AF",
        "FRANCISCO CONCEICAO": "\u5F17\u6717\u897F\u65AF\u79D1\xB7\u5EB7\u585E\u6851",
        "FRANCISCO TRINCAO": "\u5F17\u6717\u897F\u65AF\u79D1\xB7\u7279\u6797\u5EB7",
        "Franck KESSIE": "\u5F17\u5170\u514B\xB7\u51EF\u897F",
        "FRANS PUTROS": "\u5F17\u5170\u65AF\xB7\u666E\u7279\u7F57\u65AF",
        "Frantzdy PIERROT": "\u5F17\u6717\u8328\u8FEA\xB7\u76AE\u57C3\u7F57",
        "Fredrik Andre BJORKAN": "\u5F17\u96F7\u5FB7\u91CC\u514B\xB7\u5B89\u5FB7\u70C8\xB7\u7EA6\u574E",
        "Fredrik AURSNES": "\u5F17\u96F7\u5FB7\u91CC\u514B\xB7\u5965\u5C14\u65AF\u5185\u65AF",
        "Gabriel AVALOS": "\u52A0\u5E03\u91CC\u57C3\u5C14\xB7\u963F\u74E6\u6D1B\u65AF",
        "Gabriel GUDMUNDSSON": "\u52A0\u5E03\u91CC\u57C3\u5C14\xB7\u53E4\u5FB7\u8499\u5FB7\u677E",
        "GABRIEL MAGALHAES": "\u52A0\u5E03\u91CC\u57C3\u5C14\xB7\u9A6C\u52A0\u826F\u65AF",
        "Gael KAKUTA": "\u76D6\u5C14\xB7\u5361\u5E93\u5854",
        "GARRY RODRIGUES": "\u52A0\u91CC\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "Garven METUSALA": "\u52A0\u6587\xB7\u6885\u56FE\u8428\u62C9",
        "Gaston OLVEIRA": "\u52A0\u65AF\u901A\xB7\u5965\u5C14\u7EF4\u62C9",
        "Gatito FERNANDEZ": "\u52A0\u8482\u6258\xB7\u8D39\u5C14\u5357\u5FB7\u65AF",
        "Gedeon KALULU": "\u70ED\u4EE3\u7FC1\xB7\u5361\u5362\u5362",
        "George HIRST": "\u4E54\u6CBB\xB7\u8D6B\u65AF\u7279",
        "Geronimo RULLI": "\u8D6B\u7F57\u5C3C\u83AB\xB7\u9C81\u5229",
        "Gervane KASTANEER": "\u8D6B\u5C14\u74E6\u5185\xB7\u5361\u65AF\u5854\u5C3C\u5C14",
        "Gessime YASSINE": "\u6770\u897F\u59C6\xB7\u4E9A\u8F9B",
        "Ghislain KONAN": "\u683C\u5170\xB7\u79D1\u5357",
        "Gideon MENSAH": "\u5409\u8FEA\u6069\xB7\u95E8\u8428",
        "Gilberto MORA": "\u5E0C\u5C14\u8D1D\u6258\xB7\u83AB\u62C9",
        "GILSON BENCHIMOL": "\u5409\u5C14\u677E\xB7\u672C\u5E0C\u83AB\u5C14",
        "Giovani LO CELSO": "\u4E54\u74E6\u5C3C\xB7\u6D1B\u585E\u5C14\u7D22",
        "Giovanni REYNA": "\u4E54\u74E6\u5C3C\xB7\u96F7\u7EB3",
        "Giuliano SIMEONE": "\u6731\u5229\u4E9A\u8BFA\xB7\u897F\u8499\u5C3C",
        "Godfried ROEMERATOE": "\u6208\u5FB7\u5F17\u91CC\u5FB7\xB7\u9C81\u9ED8\u62C9\u56FE",
        "GONCALO GUEDES": "\u8D21\u8428\u6D1B\xB7\u683C\u5FB7\u65AF",
        "GONCALO INACIO": "\u8D21\u8428\u6D1B\xB7\u4F0A\u7EB3\u897F\u5965",
        "GONCALO RAMOS": "\u8D21\u8428\u6D1B\xB7\u62C9\u83AB\u65AF",
        "Gonzalo MONTIEL": "\u5188\u8428\u6D1B\xB7\u8499\u94C1\u5C14",
        "Gonzalo VALLE": "\u5188\u8428\u6D1B\xB7\u5DF4\u5217",
        "Grant HANLEY": "\u683C\u5170\u7279\xB7\u6C49\u5229",
        "Gregor KOBEL": "\u683C\u96F7\u6208\u5C14\xB7\u79D1\u8D1D\u5C14",
        "Guela DOUE": "\u683C\u62C9\xB7\u675C\u57C3",
        "Guillermo MARTINEZ": "\u5409\u5217\u5C14\u83AB\xB7\u9A6C\u4E01\u5185\u65AF",
        "Guillermo VARELA": "\u5409\u5217\u5C14\u83AB\xB7\u5DF4\u96F7\u62C9",
        "Gustaf LAGERBIELKE": "\u53E4\u65AF\u5854\u592B\xB7\u62C9\u683C\u6BD4\u5C14\u514B",
        "Gustaf NILSSON": "\u53E4\u65AF\u5854\u592B\xB7\u5C3C\u5C14\u677E",
        "Gustavo CABALLERO": "\u53E4\u65AF\u5854\u6C83\xB7\u5361\u74E6\u5217\u7F57",
        "Gustavo GOMEZ": "\u53E4\u65AF\u5854\u6C83\xB7\u6208\u9EA6\u65AF",
        "Gustavo PUERTA": "\u53E4\u65AF\u5854\u6C83\xB7\u666E\u57C3\u5C14\u5854",
        "Gustavo VELAZQUEZ": "\u53E4\u65AF\u5854\u6C83\xB7\u8D1D\u62C9\u65AF\u514B\u65AF",
        "Guus TIL": "\u80E1\u65AF\xB7\u8482\u5C14",
        "Habib DIARRA": "\u54C8\u6BD4\u535C\xB7\u8FEA\u4E9A\u62C9",
        "HAISSEM HASSAN": "\u6D77\u585E\u59C6\xB7\u54C8\u6851",
        "Haji WRIGHT": "\u54C8\u5409\xB7\u8D56\u7279",
        "Hakan CALHANOGLU": "\u54C8\u574E\xB7\u6070\u5C14\u6C49\u5965\u5362",
        "HAMDY FATHY": "\u54C8\u59C6\u8FEA\xB7\u6CD5\u63D0",
        "HAMZA ABDELKARIM": "\u54C8\u59C6\u624E\xB7\u963F\u535C\u675C\u52D2\u5361\u91CC\u59C6",
        "Hannes DELCROIX": "\u6C49\u5185\u65AF\xB7\u5FB7\u5C14\u514B\u9C81\u74E6",
        "Hannibal MEJBRI": "\u6C49\u5C3C\u5DF4\u5C14\xB7\u6885\u6770\u5E03\u91CC",
        "Hans VANAKEN": "\u6C49\u65AF\xB7\u74E6\u7EB3\u80AF",
        "Haris TABAKOVIC": "\u54C8\u91CC\u65AF\xB7\u5854\u5DF4\u79D1\u7EF4\u5947",
        "HASSAN ALHAYDOS": "\u54C8\u6851\xB7\u6D77\u591A\u65AF",
        "HASSAN ALTAMBAKTI": "\u54C8\u6851\xB7\u5766\u5DF4\u514B\u63D0",
        "HASSAN KADISH": "\u54C8\u6851\xB7\u5361\u8FEA\u4EC0",
        "Hazem MASTOURI": "\u54C8\u5179\u59C6\xB7\u9A6C\u65AF\u56FE\u91CC",
        "HELIO VARELA": "\u57C3\u5229\u5965\xB7\u74E6\u96F7\u62C9",
        "Henrik FALCHENER": "\u4EA8\u91CC\u514B\xB7\u6CD5\u5C14\u5207\u7EB3",
        "Herman JOHANSSON": "\u8D6B\u5C14\u66FC\xB7\u7EA6\u7FF0\u677E",
        "Hernan GALINDEZ": "\u57C3\u5C14\u5357\xB7\u52A0\u6797\u5FB7\u65AF",
        "Hicham BOUDAOUI": "\u5E0C\u6C99\u59C6\xB7\u5E03\u9053\u7EF4",
        "Hjalmar EKDAL": "\u4E9A\u5C14\u9A6C\xB7\u57C3\u514B\u8FBE\u5C14",
        "HOMAM AHMED": "\u80E1\u9A6C\u59C6\xB7\u827E\u54C8\u8FC8\u5FB7",
        "HOSSAM ABDELMAGUID": "\u4FAF\u8428\u59C6\xB7\u963F\u535C\u675C\u52D2\u9A6C\u5409\u5FB7",
        "Hossein HOSSEINI": "\u4FAF\u8D5B\u56E0\xB7\u4FAF\u8D5B\u5C3C",
        "Hossein KANANI": "\u4FAF\u8D5B\u56E0\xB7\u5361\u7EB3\u5C3C",
        "Houssem AOUAR": "\u4FAF\u8428\u59C6\xB7\u5965\u963F\u5C14",
        "Hugo SOCHUREK": "\u80E1\u6208\xB7\u7D22\u80E1\u96F7\u514B",
        "HUSAM ABUDAHAB": "\u80E1\u8428\u59C6\xB7\u963F\u5E03\u8FBE\u54C8\u5E03",
        "HUSSEIN ALI": "\u4FAF\u8D5B\u56E0\xB7\u963F\u91CC",
        "HWANG Heechan": "\u9EC4\u559C\u707F",
        "HWANG Inbeom": "\u9EC4\u4EC1\u8303",
        "IBRAHIM ADEL": "\u6613\u535C\u62C9\u6B23\xB7\u963F\u5FB7\u5C14",
        "IBRAHIM BAYESH": "\u6613\u535C\u62C9\u6B23\xB7\u5DF4\u8036\u4EC0",
        "Ibrahim MAZA": "\u6613\u535C\u62C9\u6B23\xB7\u9A6C\u624E",
        "Ibrahim MBAYE": "\u6613\u535C\u62C9\u6B23\xB7\u59C6\u5DF4\u8036",
        "IBRAHIM SADEH": "\u6613\u535C\u62C9\u6B23\xB7\u8428\u5FB7",
        "Ibrahim SANGARE": "\u6613\u535C\u62C9\u6B23\xB7\u6851\u52A0\u96F7",
        "Ibrahima KONATE": "\u6613\u535C\u62C9\u5E0C\u9A6C\xB7\u79D1\u7EB3\u7279",
        "Idrissa Gana GUEYE": "\u4F0A\u5FB7\u91CC\u8428\xB7\u76D6\u8036",
        "Igor MATANOVIC": "\u4F0A\u6208\u5C14\xB7\u9A6C\u5854\u8BFA\u7EF4\u5947",
        "Igor SERGEEV": "\u4F0A\u6208\u5C14\xB7\u8C22\u5C14\u76D6\u8036\u592B",
        "IGOR THIAGO": "\u4F0A\u6208\u5C14\xB7\u8482\u4E9A\u6208",
        "Iliman NDIAYE": "\u4F0A\u5229\u66FC\xB7\u6069\u8FEA\u4E9A\u8036",
        "Ime OKON": "\u4F0A\u6885\xB7\u5965\u5B54",
        "Iqraam RAYNERS": "\u4F0A\u514B\u62C9\u59C6\xB7\u96F7\u7EB3\u65AF",
        "Irfan Can KAHVECI": "\u4F0A\u5C14\u51E1\xB7\u8A79\xB7\u5361\u8D6B\u7EF4\u5947",
        "Isak HIEN": "\u4F0A\u8428\u514B\xB7\u5E0C\u6069",
        "Isidro PITTA": "\u4F0A\u65AF\u5FB7\u7F57\xB7\u76AE\u5854",
        "Ismael DIAZ": "\u4F0A\u65AF\u6885\u5C14\xB7\u8FEA\u4E9A\u65AF",
        "Ismael GHARBI": "\u4F0A\u65AF\u6885\u5C14\xB7\u52A0\u5C14\u6BD4",
        "Ismael KONE": "\u4F0A\u65AF\u6885\u5C14\xB7\u79D1\u5185",
        "Ismael SAIBARI": "\u4F0A\u65AF\u6885\u5C14\xB7\u8D5B\u5DF4\u91CC",
        "Ismail JAKOBS": "\u4F0A\u65AF\u6885\u5C14\xB7\u96C5\u5404\u5E03\u65AF",
        "Ismail YUKSEK": "\u4F0A\u65AF\u6885\u5C14\xB7\u4E8E\u514B\u585E\u514B",
        "Ismaila SARR": "\u4F0A\u65AF\u6885\u62C9\xB7\u8428\u5C14",
        "Israel REYES": "\u4F0A\u65AF\u62C9\u5C14\xB7\u96F7\u8036\u65AF",
        "Issa DIOP": "\u4F0A\u8428\xB7\u8FEA\u5965\u666E",
        "ISSA LAYE": "\u4F0A\u8428\xB7\u62C9\u8036",
        "Ivan BASIC": "\u4F0A\u4E07\xB7\u5DF4\u5E0C\u5947",
        "Ivan PERISIC": "\u4F0A\u4E07\xB7\u4F69\u91CC\u897F\u5947",
        "Ivan SUNJIC": "\u4F0A\u4E07\xB7\u5B59\u5409\u5947",
        "Ivan TONEY": "\u4F0A\u4E07\xB7\u6258\u5C3C",
        "Ivor PANDUR": "\u4F0A\u6C83\u5C14\xB7\u6F58\u675C\u5C14",
        "Jack HENDRY": "\u6770\u514B\xB7\u4EA8\u5FB7\u91CC",
        "Jackson IRVINE": "\u6770\u514B\u900A\xB7\u6B27\u6587",
        "Jackson POROZO": "\u6770\u514B\u900A\xB7\u6CE2\u7F57\u7D22",
        "Jacob ITALIANO": "\u96C5\u5404\u5E03\xB7\u4F0A\u5854\u5229\u4E9A\u8BFA",
        "Jacob SHAFFELBURG": "\u96C5\u5404\u5E03\xB7\u6C99\u5F17\u5C14\u4F2F\u683C",
        "Jacob WIDELL ZETTERSTROM": "\u96C5\u5404\u5E03\xB7\u7EF4\u5FB7\u5C14\xB7\u6CFD\u7279\u65AF\u7279\u4F26",
        "Jakhongir UROZOV": "\u8D3E\u6D2A\u5409\u5C14\xB7\u4E4C\u7F57\u4F50\u592B",
        "JALAL HASSAN": "\u8D3E\u62C9\u52D2\xB7\u54C8\u6851",
        "James RODRIGUEZ": "\u54C8\u6885\u65AF\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "James TRAFFORD": "\u8A79\u59C6\u65AF\xB7\u7279\u62C9\u798F\u5FB7",
        "Jamie LEWELING": "\u6770\u7C73\xB7\u52D2\u7EF4\u6797",
        "Jaminton CAMPAZ": "\u54C8\u660E\u987F\xB7\u574E\u5E15\u65AF",
        "Jamshid ISKANDEROV": "\u8D3E\u59C6\u5E0C\u5FB7\xB7\u4F0A\u65AF\u574E\u5FB7\u7F57\u592B",
        "Jan KUCHTA": "\u626C\xB7\u5E93\u8D6B\u5854",
        "Jan Paul VAN HECKE": "\u626C\xB7\u4FDD\u7F57\xB7\u8303\u8D6B\u514B",
        "Jaouen HADJAM": "\u96C5\u6587\xB7\u54C8\u8D3E\u59C6",
        "Jarell QUANSAH": "\u8D3E\u96F7\u5C14\xB7\u5BBD\u8428",
        "Jaroslav ZELENY": "\u96C5\u7F57\u65AF\u62C9\u592B\xB7\u6CFD\u83B1\u5C3C",
        "Jason GERIA": "\u6770\u68EE\xB7\u683C\u91CC\u4E9A",
        "JASSEM GABER": "\u8D3E\u897F\u59C6\xB7\u52A0\u8D1D\u5C14",
        "Jayden ADAMS": "\u6770\u767B\xB7\u4E9A\u5F53\u65AF",
        "Jayden NELSON": "\u6770\u767B\xB7\u7EB3\u5C14\u900A",
        "Jean Michael SERI": "\u8BA9\xB7\u7C73\u6B47\u5C14\xB7\u585E\u91CC",
        "Jean-Kevin DUVERNE": "\u8BA9-\u51EF\u6587\xB7\u8FEA\u97E6\u5C14\u5185",
        "Jean-Philippe MATETA": "\u8BA9-\u83F2\u5229\u666E\xB7\u9A6C\u7279\u5854",
        "Jean-Ricner BELLEGARDE": "\u8BA9-\u91CC\u514B\u5185\u5C14\xB7\u8D1D\u52D2\u52A0\u5FB7",
        "Jearl MARGARITHA": "\u8036\u5C14\u52D2\xB7\u9A6C\u52A0\u91CC\u5854",
        "Jefferson LERMA": "\u6770\u5F17\u68EE\xB7\u83B1\u5C14\u9A6C",
        "JEHAD THIKRI": "\u6770\u54C8\u5FB7\xB7\u897F\u514B\u91CC",
        "Jens Petter HAUGE": "\u5EF6\u65AF\xB7\u5F7C\u5F97\xB7\u8C6A\u683C",
        "Jeremy ANTONISSE": "\u6770\u91CC\u7C73\xB7\u5B89\u4E1C\u5C3C\u585E",
        "Jeremy AREVALO": "\u6770\u91CC\u7C73\xB7\u963F\u96F7\u74E6\u6D1B",
        "Jeremy DOKU": "\u6770\u91CC\u7C73\xB7\u591A\u5E93",
        "Jerome OPOKU": "\u6770\u7F57\u59C6\xB7\u5965\u6CE2\u5E93",
        "Jesper KARLSTROM": "\u8036\u65AF\u4F69\u5C14\xB7\u5361\u5C14\u65AF\u7279\u4F26",
        "Jesse RANDALL": "\u6770\u897F\xB7\u5170\u5FB7\u5C14",
        "Jesus GALLARDO": "\u8D6B\u82CF\u65AF\xB7\u52A0\u5229\u4E9A\u591A",
        "Jhon CORDOBA": "\u80E1\u5B89\xB7\u79D1\u5C14\u591A\u74E6",
        "Jhon LUCUMI": "\u80E1\u5B89\xB7\u5362\u5E93\u7C73",
        "Jindrich STANEK": "\u56E0\u5FB7\u65E5\u8D6B\xB7\u65AF\u5854\u5185\u514B",
        "Jiovany RAMOS": "\u970D\u74E6\u5C3C\xB7\u62C9\u83AB\u65AF",
        "JO Hyeonwoo": "\u8D75\u8D24\u7950",
        "Joan GARCIA": "\u970D\u5B89\xB7\u52A0\u897F\u4E9A",
        "JOAO CANCELO": "\u82E5\u6602\xB7\u574E\u585E\u6D1B",
        "JOAO FELIX": "\u82E5\u6602\xB7\u8D39\u5229\u514B\u65AF",
        "JOAO NEVES": "\u82E5\u6602\xB7\u5185\u7EF4\u65AF",
        "JOAO PAULO": "\u82E5\u6602\xB7\u4FDD\u7F57",
        "Joaquin PIQUEREZ": "\u534E\u91D1\xB7\u76AE\u514B\u96F7\u65AF",
        "Joaquin SEYS": "\u534E\u91D1\xB7\u585E\u65AF",
        "Joe BELL": "\u4E54\xB7\u8D1D\u5C14",
        "Joe SCALLY": "\u4E54\xB7\u65AF\u5361\u5229",
        "Joel ORDONEZ": "\u4E54\u5C14\xB7\u5965\u591A\u6D85\u65AF",
        "Joel WATERMAN": "\u4E54\u5C14\xB7\u6C83\u7279\u66FC",
        "Johan MANZAMBI": "\u7EA6\u7FF0\xB7\u66FC\u8D5E\u6BD4",
        "Johan VASQUEZ": "\u7EA6\u7FF0\xB7\u5DF4\u65AF\u514B\u65AF",
        "John McGINN": "\u7EA6\u7FF0\xB7\u9EA6\u91D1",
        "John SOUTTAR": "\u7EA6\u7FF0\xB7\u82CF\u5854\u5C14",
        "John YEBOAH": "\u7EA6\u7FF0\xB7\u8036\u535A\u963F",
        "Johny PLACIDE": "\u7EA6\u7FF0\u5C3C\xB7\u666E\u62C9\u897F\u5FB7",
        "Jonas ADJETEY": "\u4E54\u7EB3\u65AF\xB7\u963F\u6770\u6CF0",
        "Jonathan OSORIO": "\u4E54\u7EB3\u68EE\xB7\u5965\u7D22\u91CC\u5965",
        "Jonathan TAH": "\u82E5\u7EB3\u5766\xB7\u5854",
        "Jordan BOS": "\u4E54\u4E39\xB7\u535A\u65AF",
        "Jordan HENDERSON": "\u4E54\u4E39\xB7\u4EA8\u5FB7\u68EE",
        "Jordy ALCIVAR": "\u7EA6\u5C14\u8FEA\xB7\u963F\u5C14\u897F\u74E6\u5C14",
        "Jordy CAICEDO": "\u7EA6\u5C14\u8FEA\xB7\u51EF\u585E\u591A",
        "Jorge CARRASCAL": "\u8C6A\u8D6B\xB7\u5361\u62C9\u5361\u5C14",
        "Jorge GUTIERREZ": "\u8C6A\u5C14\u8D6B\xB7\u53E4\u94C1\u96F7\u65AF",
        "Jorge SANCHEZ": "\u8C6A\u5C14\u8D6B\xB7\u6851\u5207\u65AF",
        "Jorgen STRAND LARSEN": "\u7EA6\u5C14\u6839\xB7\u65AF\u7279\u5170\u5FB7\xB7\u62C9\u5C14\u68EE",
        "Joris KAYEMBE": "\u82E5\u91CC\u65AF\xB7\u5361\u5EF6\u8D1D",
        "Jorrel HATO": "\u7EA6\u96F7\u5C14\xB7\u54C8\u6258",
        "Jose CANALE": "\u4F55\u585E\xB7\u5361\u7EB3\u83B1",
        "Jose CORDOBA": "\u4F55\u585E\xB7\u79D1\u5C14\u591A\u74E6",
        "Jose FAJARDO": "\u4F55\u585E\xB7\u6CD5\u54C8\u5C14\u591A",
        "Jose Luis RODRIGUEZ": "\u4F55\u585E\xB7\u8DEF\u6613\u65AF\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "Jose Manuel LOPEZ": "\u4F55\u585E\xB7\u66FC\u52AA\u57C3\u5C14\xB7\u6D1B\u4F69\u65AF",
        "Jose Maria GIMENEZ": "\u4F55\u585E\xB7\u739B\u4E3D\u4E9A\xB7\u5E0C\u95E8\u5C3C\u65AF",
        "JOSE SA": "\u82E5\u6CFD\xB7\u8428",
        "Joseph ANANG": "\u7EA6\u745F\u592B\xB7\u963F\u5357",
        "Joshua BRENET": "\u7EA6\u4E66\u4E9A\xB7\u5E03\u96F7\u5185\u7279",
        "Josip STANISIC": "\u7EA6\u897F\u666E\xB7\u65AF\u5854\u5C3C\u5E0C\u5947",
        "Josip SUTALO": "\u7EA6\u897F\u666E\xB7\u8212\u5854\u6D1B",
        "Josko GVARDIOL": "\u7EA6\u4EC0\u79D1\xB7\u683C\u74E6\u8FEA\u5965\u5C14",
        "Josue CASIMIR": "\u82E5\u82CF\u57C3\xB7\u5361\u897F\u7C73\u5C14",
        "Josue DUVERGER": "\u82E5\u82CF\u57C3\xB7\u675C\u97E6\u5C14\u70ED",
        "JOVANE CABRAL": "\u82E5\u74E6\u5185\xB7\u5361\u5E03\u62C9\u5C14",
        "Jovo LUKIC": "\u7EA6\u6C83\xB7\u5362\u57FA\u5947",
        "Juan Jose CACERES": "\u80E1\u5B89\xB7\u4F55\u585E\xB7\u5361\u585E\u96F7\u65AF",
        "Juan Manuel SANABRIA": "\u80E1\u5B89\xB7\u66FC\u52AA\u57C3\u5C14\xB7\u8428\u7EB3\u592B\u91CC\u4E9A",
        "Juan MUSSO": "\u80E1\u5B89\xB7\u7A46\u7D22",
        "Juan PORTILLA": "\u80E1\u5B89\xB7\u6CE2\u8482\u5229\u4E9A",
        "Juan QUINTERO": "\u80E1\u5B89\xB7\u91D1\u7279\u7F57",
        "Juergen LOCADIA": "\u5C24\u5C14\u6839\xB7\u6D1B\u5361\u8FEA\u4E9A",
        "Jules KOUNDE": "\u6731\u5C14\u65AF\xB7\u6606\u5FB7",
        "Julian ALVAREZ": "\u80E1\u5229\u5B89\xB7\u963F\u5C14\u74E6\u96F7\u65AF",
        "Julian QUINONES": "\u80E1\u5229\u5B89\xB7\u57FA\u5C3C\u5965\u5185\u65AF",
        "Julian RYERSON": "\u6731\u5229\u5B89\xB7\u96F7\u5C14\u68EE",
        "Julio ENCISO": "\u80E1\u5229\u5965\xB7\u6069\u897F\u7D22",
        "Juninho BACUNA": "\u6731\u5C3C\u5C3C\u5965\xB7\u5DF4\u5E93\u7EB3",
        "Junior ALONSO": "\u80E1\u5C3C\u5965\u5C14\xB7\u963F\u9686\u7D22",
        "Junnosuke SUZUKI": "\u94C3\u6728\uFFFD\u7684\u987A\u4E5F",
        "Jurien GAARI": "\u6731\u91CC\u6069\xB7\u52A0\u91CC",
        "Justin KLUIVERT": "\u8D3E\u65AF\u6C40\xB7\u514B\u9C81\u4F0A\u7EF4\u7279",
        "Kaan AYHAN": "\u5361\u5B89\xB7\u827E\u6C49",
        "Kai TREWIN": "\u51EF\xB7\u7279\u96F7\u6E29",
        "Kaishu SANO": "\u4F50\u91CE\u6D77\u821F",
        "Kamaldeen SULEMANA": "\u5361\u9A6C\u5C14\u4E01\xB7\u82CF\u83B1\u9A6C\u7EB3",
        "Kamogelo SEBELEBELE": "\u5361\u83AB\u6770\u6D1B\xB7\u585E\u8D1D\u83B1\u8D1D\u83B1",
        "KARIM BOUDIAF": "\u5361\u91CC\u59C6\xB7\u5E03\u8FEA\u4E9A\u592B",
        "KARIM HAFEZ": "\u5361\u91CC\u59C6\xB7\u54C8\u83F2\u5179",
        "Keeto THERMONCY": "\u57FA\u6258\xB7\u6CF0\u5C14\u8499\u897F",
        "Keisuke GOTO": "\u540E\u85E4\u542F\u4ECB",
        "Keisuke OSAKO": "\u5927\u8FEB\u656C\u4ECB",
        "Keito NAKAMURA": "\u4E2D\u6751\u656C\u6597",
        "KELVIN PIRES": "\u51EF\u5C14\u6587\xB7\u76AE\u96F7\u65AF",
        "Ken SEMA": "\u80AF\xB7\u585E\u9A6C",
        "Kenan YILDIZ": "\u514B\u5357\xB7\u4F0A\u5C14\u8FEA\u5179",
        "Kendry PAEZ": "\u80AF\u5FB7\u91CC\xB7\u6D3E\u65AF",
        "Kenji GORRE": "\u8D24\u6CBB\xB7\u6208\u96F7",
        "Kenny McLEAN": "\u80AF\u5C3C\xB7\u9EA6\u514B\u83B1\u6069",
        "Kento SHIOGAI": "\u76D0\u8D1D\u5065\u4EBA",
        "Kerem AKTURKOGLU": "\u51EF\u96F7\u59C6\xB7\u963F\u514B\u56FE\u5C14\u79D1\u683C\u5362",
        "Kerim ALAJBEGOVIC": "\u514B\u91CC\u59C6\xB7\u963F\u62C9\u8D1D\u6208\u7EF4\u5947",
        "Kevin CASTANO": "\u51EF\u6587\xB7\u5361\u65AF\u5854\u5C3C\u5965",
        "Kevin DANSO": "\u51EF\u6587\xB7\u4E39\u7D22",
        "Kevin FELIDA": "\u51EF\u6587\xB7\u8D39\u5229\u8FBE",
        "KEVIN PINA": "\u51EF\u6587\xB7\u76AE\u7EB3",
        "Kevin RODRIGUEZ": "\u51EF\u6587\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "KEVIN YAKOB": "\u51EF\u6587\xB7\u96C5\u5404\u5E03",
        "KHALID ALGHANNAM": "\u54C8\u7ACB\u5FB7\xB7\u7518\u5357\u59C6",
        "Khalil AYARI": "\u54C8\u5229\u52D2\xB7\u963F\u4E9A\u91CC",
        "Khojiakbar ALIJONOV": "\u970D\u5409\u4E9A\u514B\u5DF4\u5C14\xB7\u963F\u5229\u7EA6\u8BFA\u592B",
        "Khuliso MUDAU": "\u5E93\u5229\u7D22\xB7\u7A46\u9053",
        "Khulumani NDAMANE": "\u5E93\u5362\u9A6C\u5C3C\xB7\u6069\u8FBE\u9A6C\u5185",
        "Kieran TIERNEY": "\u57FA\u5170\xB7\u8482\u5C14\u5C3C",
        "KIM Jingyu": "\u91D1\u73CD\u6D19",
        "KIM Minjae": "\u91D1\u739F\u54C9",
        "KIM Moonhwan": "\u91D1\u6587\u7115",
        "KIM Seunggyu": "\u91D1\u627F\u594E",
        "KIM Taehyeon": "\u91D1\u6CF0\u8D24",
        "Kobbie MAINOO": "\u79D1\u6BD4\xB7\u6885\u52AA",
        "Kojo Peprah OPPONG": "\u79D1\u4E54\xB7\u4F69\u666E\u62C9\xB7\u5965\u84EC",
        "Koki OGAWA": "\u5C0F\u5DDD\u822A\u57FA",
        "Koni DE WINTER": "\u79D1\u5C3C\xB7\u5FB7\u6E29\u7279",
        "Konrad LAIMER": "\u5EB7\u62C9\u5FB7\xB7\u83B1\u9ED8\u5C14",
        "Kosta BARBAROUSES": "\u79D1\u65AF\u5854\xB7\u5DF4\u5DF4\u9C81\u585E\u65AF",
        "Kou ITAKURA": "\u677F\u4ED3\u6EC9",
        "Krepin DIATTA": "\u514B\u96F7\u6F58\xB7\u8FEA\u4E9A\u5854",
        "Kristian THORSTVEDT": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u6258\u65AF\u7279\u7EF4\u7279",
        "Kristijan JAKIC": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u4E9A\u57FA\u5947",
        "Kristoffer AJER": "\u514B\u91CC\u65AF\u6258\u5F17\xB7\u963F\u8036\u5C14",
        "Kristoffer NORDFELDT": "\u514B\u91CC\u65AF\u6258\u5F17\xB7\u8BFA\u5FB7\u8D39\u5C14\u7279",
        "Kwasi SIBO": "\u5938\u897F\xB7\u897F\u535A",
        "Kylian MBAPPE": "\u57FA\u5229\u5B89\xB7\u59C6\u5DF4\u4F69",
        "Lachlan BAYLISS": "\u62C9\u514B\u4F26\xB7\u8D1D\u5229\u65AF",
        "Ladislav KREJCI": "\u62C9\u8FEA\u65AF\u62C9\u592B\xB7\u514B\u96F7\u4F0A\u5947",
        "Lamine CAMARA": "\u62C9\u660E\xB7\u5361\u9A6C\u62C9",
        "LAROS DUARTE": "\u62C9\u7F57\u65AF\xB7\u675C\u963F\u5C14\u7279",
        "Lautaro MARTINEZ": "\u52B3\u5854\u7F57\xB7\u9A6C\u4E01\u5185\u65AF",
        "Lawrence Ati ZIGI": "\u52B3\u4F26\u65AF\xB7\u963F\u8482\xB7\u9F50\u5409",
        "Lawrence SHANKLAND": "\u52B3\u4F26\u65AF\xB7\u5C1A\u514B\u5170",
        "Leandro BACUNA": "\u83B1\u5B89\u5FB7\u7F57\xB7\u5DF4\u5E93\u7EB3",
        "LEE Donggyeong": "\u674E\u4E1C\u7085",
        "LEE Gihyuk": "\u674E\u671F\u5955",
        "LEE Hanbeom": "\u674E\u6C49\u8303",
        "LEE Jaesung": "\u674E\u5728\u6210",
        "LEE Kangin": "\u674E\u521A\u4EC1",
        "LEE Taeseok": "\u674E\u6CF0\u7855",
        "Lenny JOSEPH": "\u83B1\u5C3C\xB7\u7EA6\u745F\u592B",
        "Leo OSTIGARD": "\u83B1\u5965\xB7\u5384\u65AF\u8482\u9AD8",
        "LEO PEREIRA": "\u83B1\u5965\xB7\u4F69\u96F7\u62C9",
        "Leon GORETZKA": "\u83B1\u6602\xB7\u6208\u96F7\u8328\u5361",
        "Leroy SANE": "\u52D2\u7F57\u4F0A\xB7\u8428\u5185",
        "Lewis FERGUSON": "\u5218\u6613\u65AF\xB7\u5F17\u683C\u68EE",
        "Liam KELLY": "\u5229\u4E9A\u59C6\xB7\u51EF\u5229",
        "Liam MILLAR": "\u5229\u4E9A\u59C6\xB7\u7C73\u52D2",
        "Liberato CACACE": "\u5229\u8D1D\u62C9\u6258\xB7\u5361\u5361\u65AF",
        "Lionel MPASI": "\u5229\u5965\u5185\u5C14\xB7\u59C6\u5E15\u897F",
        "Lisandro MARTINEZ": "\u5229\u6851\u5FB7\u7F57\xB7\u9A6C\u4E01\u5185\u65AF",
        "Livano COMENENCIA": "\u5229\u74E6\u8BFA\xB7\u79D1\u6885\u5AE9\u897F\u4E9A",
        "LOGAN COSTA": "\u6D1B\u6839\xB7\u79D1\u65AF\u5854",
        "Logan ROGERSON": "\u6D1B\u6839\xB7\u7F57\u6770\u68EE",
        "Louicius DEEDSON": "\u5362\u4F0A\u4FEE\u65AF\xB7\u8FEA\u5FB7\u677E",
        "Luc DE FOUGEROLLES": "\u5362\u514B\xB7\u5FB7\xB7\u5BCC\u70ED\u7F57\u5C14",
        "Luca JAQUEZ": "\u5362\u5361\xB7\u54C8\u514B\u65AF",
        "Luca ZIDANE": "\u5362\u5361\xB7\u9F50\u8FBE\u5185",
        "Lucas BERGVALL": "\u5362\u5361\u65AF\xB7\u8D1D\u91CC\u74E6\u5C14",
        "Lucas DIGNE": "\u5362\u5361\u65AF\xB7\u8FEA\u6D85",
        "Lucas HERNANDEZ": "\u5362\u5361\u65AF\xB7\u57C3\u5C14\u5357\u5FB7\u65AF",
        "Lucas HERRINGTON": "\u5362\u5361\u65AF\xB7\u8D6B\u6797\u987F",
        "LUCAS MENDES": "\u5362\u5361\u65AF\xB7\u95E8\u5FB7\u65AF",
        "LUCAS PAQUETA": "\u5362\u5361\u65AF\xB7\u5E15\u594E\u5854",
        "Luis CHAVEZ": "\u8DEF\u6613\u65AF\xB7\u67E5\u97E6\u65AF",
        "Luis DIAZ": "\u8DEF\u6613\u65AF\xB7\u8FEA\u4E9A\u65AF",
        "Luis MEJIA": "\u8DEF\u6613\u65AF\xB7\u6885\u5E0C\u4E9A",
        "Luis ROMO": "\u8DEF\u6613\u65AF\xB7\u7F57\u83AB",
        "Luis SUAREZ": "\u8DEF\u6613\u65AF\xB7\u82CF\u4E9A\u96F7\u65AF",
        "LUIZ HENRIQUE": "\u8DEF\u6613\u65AF\xB7\u6069\u91CC\u514B",
        "Luka MODRIC": "\u5362\u5361\xB7\u83AB\u5FB7\u91CC\u5947",
        "Luka SUCIC": "\u5362\u5361\xB7\u82CF\u5951\u5947",
        "Luka VUSKOVIC": "\u5362\u5361\xB7\u6B66\u4EC0\u79D1\u7EF4\u5947",
        "Lukas CERV": "\u5362\u5361\u4EC0\xB7\u5207\u5C14\u592B",
        "Lukas HORNICEK": "\u5362\u5361\u4EC0\xB7\u970D\u5C14\u5C3C\u5207\u514B",
        "Lukas PROVOD": "\u5362\u5361\u4EC0\xB7\u666E\u7F57\u6C83\u5FB7",
        "Lutsharel GEERTRUIDA": "\u5362\u7279\u6C99\u96F7\u5C14\xB7\u6D77\u7279\u9C81\u4F0A\u8FBE",
        "Lyle FOSTER": "\u83B1\u5C14\xB7\u798F\u65AF\u7279",
        "Lyndon DYKES": "\u6797\u767B\xB7\u6234\u514B\u65AF",
        "Maghnes AKLIOUCHE": "\u9A6C\u6D85\u65AF\xB7\u963F\u514B\u5229\u4E4C\u4EC0",
        "MAHDY SOLIMAN": "\u9A6C\u8D6B\u8FEA\xB7\u82CF\u83B1\u66FC",
        "MAHMOUD ABUNADA": "\u9A6C\u54C8\u8302\u5FB7\xB7\u963F\u5E03\u7EB3\u8FBE",
        "MAHMOUD ALMARDI": "\u9A6C\u54C8\u8302\u5FB7\xB7\u9A6C\u5C14\u8FEA",
        "MAHMOUD SABER": "\u9A6C\u54C8\u8302\u5FB7\xB7\u8428\u6BD4\u5C14",
        "Malick THIAW": "\u9A6C\u5229\u514B\xB7\u8482\u5965",
        "Malik TILLMAN": "\u9A6C\u5229\u514B\xB7\u8482\u5C14\u66FC",
        "Malo GUSTO": "\u9A6C\u6D1B\xB7\u53E4\u65AF\u6258",
        "Mamadou SARR": "\u9A6C\u9A6C\u675C\xB7\u8428\u5C14",
        "Manu KONE": "\u9A6C\u52AA\xB7\u79D1\u5185",
        "Manuel UGARTE": "\u66FC\u52AA\u57C3\u5C14\xB7\u4E4C\u52A0\u7279",
        "MARAWAN ATTIA": "\u9A6C\u62C9\u4E07\xB7\u963F\u63D0\u4E9A",
        "Marc CUCURELLA": "\u9A6C\u514B\xB7\u5E93\u5E93\u96F7\u5229\u4E9A",
        "Marc GUEHI": "\u9A6C\u514B\xB7\u683C\u4F0A",
        "Marc PUBILL": "\u9A6C\u514B\xB7\u666E\u6BD4\u5C14",
        "Marcel SABITZER": "\u9A6C\u585E\u5C14\xB7\u8428\u6BD4\u7B56",
        "MARCIO ROSA": "\u9A6C\u5C14\u897F\u5965\xB7\u7F57\u8428",
        "Marco FRIEDL": "\u9A6C\u5C14\u79D1\xB7\u5F17\u91CC\u5FB7\u5C14",
        "Marco PASALIC": "\u9A6C\u5C14\u79D1\xB7\u5E15\u6C99\u5229\u5947",
        "Marcos LLORENTE": "\u9A6C\u79D1\u65AF\xB7\u7565\u4F26\u7279",
        "Marcos SENESI": "\u9A6C\u79D1\u65AF\xB7\u585E\u5185\u897F",
        "Marcus HOLMGREN PEDERSEN": "\u9A6C\u5E93\u65AF\xB7\u970D\u5C14\u59C6\u683C\u4F26\xB7\u4F69\u5FB7\u68EE",
        "Marin PONGRACIC": "\u9A6C\u6797\xB7\u5E9E\u683C\u62C9\u5951\u5947",
        "Mario PASALIC": "\u9A6C\u91CC\u5965\xB7\u5E15\u6C99\u5229\u5947",
        "Mark FLEKKEN": "\u9A6C\u514B\xB7\u5F17\u83B1\u80AF",
        "Mark McKENZIE": "\u9A6C\u514B\xB7\u9EA6\u80AF\u9F50",
        "Markhus LACROIX": "\u9A6C\u5E93\u65AF\xB7\u62C9\u514B\u9C81\u74E6",
        "Marko ARNAUTOVIC": "\u9A6C\u5C14\u79D1\xB7\u963F\u7459\u6258\u7EF4\u5947",
        "MARKO FARJI": "\u9A6C\u5C14\u79D1\xB7\u6CD5\u5C14\u5409",
        "Marko STAMENIC": "\u9A6C\u5C14\u79D1\xB7\u65AF\u5854\u6885\u5C3C\u5947",
        "Marten DE ROON": "\u9A6C\u5C14\u6ED5\xB7\u5FB7\u7F57\u6069",
        "Martin BATURINA": "\u9A6C\u4E01\xB7\u5DF4\u56FE\u91CC\u7EB3",
        "Martin ERLIC": "\u9A6C\u4E01\xB7\u57C3\u5C14\u5229\u5947",
        "Martin EXPERIENCE": "\u9A6C\u4E01\xB7\u57C3\u514B\u65AF\u4F69\u91CC\u6602\u65AF",
        "Martin ODEGAARD": "\u9A6C\u4E01\xB7\u5384\u5FB7\u9AD8",
        "Martin ZLOMISLIC": "\u9A6C\u4E01\xB7\u5179\u6D1B\u7C73\u65AF\u5229\u5947",
        "Martin ZUBIMENDI": "\u9A6C\u4E01\xB7\u82CF\u7EF4\u95E8\u8FEA",
        "Marvin KELLER": "\u9A6C\u6587\xB7\u51EF\u52D2",
        "Marvin SENAYA": "\u9A6C\u6587\xB7\u585E\u7EB3\u4E9A",
        "Marwane SAADANE": "\u9A6C\u5C14\u4E07\xB7\u8428\u8FBE\u5185",
        "Matej KOVAR": "\u9A6C\u6377\xB7\u79D1\u74E6\u5C14",
        "Mateo CHAVEZ": "\u9A6C\u7279\u5965\xB7\u67E5\u97E6\u65AF",
        "Mateo KOVACIC": "\u9A6C\u7279\u5965\xB7\u79D1\u74E6\u5951\u5947",
        "MATHEUS CUNHA": "\u9A6C\u7279\u4E4C\u65AF\xB7\u5E93\u5C3C\u4E9A",
        "MATHEUS NUNES": "\u9A6C\u7279\u4E4C\u65AF\xB7\u52AA\u6D85\u65AF",
        "Mathew LECKIE": "\u9A6C\u4FEE\xB7\u83B1\u57FA",
        "Mathias OLIVERA": "\u9A6C\u8482\u4E9A\u65AF\xB7\u5965\u5229\u7EF4\u62C9",
        "Mathieu CHOINIERE": "\u9A6C\u8482\u5384\xB7\u8212\u74E6\u5C3C\u57C3",
        "Matias FERNANDEZ-PARDO": "\u9A6C\u8482\u4E9A\u65AF\xB7\u8D39\u5C14\u5357\u5FB7\u65AF-\u5E15\u5C14\u591A",
        "Matias GALARZA": "\u9A6C\u8482\u4E9A\u65AF\xB7\u52A0\u62C9\u5C14\u8428",
        "Matias VINA": "\u9A6C\u8482\u4E9A\u65AF\xB7\u6BD4\u5C3C\u4E9A",
        "Mats WIEFFER": "\u9A6C\u8328\xB7\u7EF4\u5F17\u5C14",
        "Matt FREESE": "\u9A6C\u7279\xB7\u5F17\u91CC\u65AF",
        "Matthieu EPOLO": "\u9A6C\u8482\u5384\xB7\u57C3\u6CE2\u6D1B",
        "Mattias SVANBERG": "\u9A6C\u8482\u4E9A\u65AF\xB7\u65AF\u4E07\u8D1D\u91CC",
        "MAURICIO": "\u6BDB\u91CC\u897F\u5965",
        "Max ARFSTEN": "\u9A6C\u514B\u65AF\xB7\u963F\u5C14\u592B\u65AF\u6ED5",
        "Max CROCOMBE": "\u9A6C\u514B\u65AF\xB7\u514B\u7F57\u79D1\u59C6",
        "Maxence LACROIX": "\u9A6C\u514B\u6851\u65AF\xB7\u62C9\u514B\u9C81\u74E6",
        "Maxi ARAUJO": "\u9A6C\u514B\u897F\xB7\u963F\u52B3\u970D",
        "Maxim DE CUYPER": "\u9A6C\u514B\u897F\u59C6\xB7\u5FB7\u5E93\u4F0A\u73C0",
        "Maxime CREPEAU": "\u9A6C\u514B\u897F\u59C6\xB7\u514B\u96F7\u6CE2",
        "Maximilian BEIER": "\u9A6C\u514B\u897F\u7C73\u5229\u5B89\xB7\u62DC\u5C14",
        "Mbekezeli MBOKAZI": "\u59C6\u8D1D\u51EF\u6CFD\u5229\xB7\u59C6\u535A\u5361\u9F50",
        "Mehdi GHAYEDI": "\u8FC8\u8D6B\u8FEA\xB7\u52A0\u8036\u8FEA",
        "Mehdi TORABI": "\u8FC8\u8D6B\u8FEA\xB7\u6258\u62C9\u6BD4",
        "Melvin MASTIL": "\u6885\u5C14\u6587\xB7\u9A6C\u65AF\u8482\u5C14",
        "MERCHAS DOSKI": "\u6885\u5C14\u67E5\u65AF\xB7\u591A\u65AF\u57FA",
        "Merih DEMIRAL": "\u6885\u91CC\u8D6B\xB7\u5FB7\u7C73\u62C9\u5C14",
        "Mert GUNOK": "\u6885\u5C14\u7279\xB7\u53E4\u8BFA\u514B",
        "Mert MULDUR": "\u6885\u5C14\u7279\xB7\u7A46\u5C14\u675C\u5C14",
        "Meschack ELIA": "\u6885\u6C99\u514B\xB7\u57C3\u5229\u4E9A",
        "MESHAAL BARSHAM": "\u6885\u6C99\u5C14\xB7\u5DF4\u5C14\u6C99\u59C6",
        "Michael BOXALL": "\u8FC8\u514B\u5C14\xB7\u535A\u514B\u7D22\u5C14",
        "Michael GREGORITSCH": "\u7C73\u590F\u57C3\u5C14\xB7\u683C\u96F7\u6208\u91CC\u5947",
        "Michael OLISE": "\u7C73\u590F\u57C3\u5C14\xB7\u5965\u5229\u585E",
        "Michael SVOBODA": "\u7C73\u590F\u57C3\u5C14\xB7\u65AF\u6C83\u535A\u8FBE",
        "Michael WOUD": "\u8FC8\u514B\u5C14\xB7\u6C83\u5FB7",
        "Michal SADILEK": "\u7C73\u54C8\u5C14\xB7\u8428\u8FEA\u83B1\u514B",
        "Michel AEBISCHER": "\u7C73\u6B47\u5C14\xB7\u57C3\u6BD4\u820D\u5C14",
        "Micky VAN DE VEN": "\u7C73\u5947\xB7\u8303\u5FB7\u82AC",
        "Miguel ALMIRON": "\u7C73\u683C\u5C14\xB7\u963F\u5C14\u7C73\u9686",
        "Mike PENDERS": "\u9EA6\u514B\xB7\u5F6D\u5FB7\u65AF",
        "Mikel MERINO": "\u7C73\u514B\u5C14\xB7\u6885\u91CC\u8BFA",
        "Milad MOHAMMADI": "\u7C73\u62C9\u5FB7\xB7\u7A46\u7F55\u9ED8\u8FEA",
        "Miles ROBINSON": "\u8FC8\u5C14\u65AF\xB7\u7F57\u5BBE\u900A",
        "Milos DEGENEK": "\u7C73\u6D1B\u65AF\xB7\u5FB7\u683C\u5185\u514B",
        "Miro MUHEIM": "\u7C73\u7F57\xB7\u7A46\u6D77\u59C6",
        "Mladen JURKAS": "\u59C6\u62C9\u767B\xB7\u5C24\u5C14\u5361\u65AF",
        "MOHAMED ABDELMONEIM": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u535C\u675C\u52D2\u7A46\u5948\u59C6",
        "MOHAMED ALAA": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u62C9",
        "Mohamed Amine BEN HMIDA": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u660E\xB7\u672C\xB7\u8D6B\u7C73\u8FBE",
        "Mohamed Amine TOUGAI": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u660E\xB7\u56FE\u76D6",
        "Mohamed AMOURA": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u7A46\u62C9",
        "MOHAMED ELSHENAWY": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u8C22\u7EB3\u7EF4",
        "Mohamed HADJ MAHMOUD": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u54C8\u5409\xB7\u9A6C\u54C8\u8302\u5FB7",
        "MOHAMED HANY": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u54C8\u5C3C",
        "MOHAMED KANNO": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u5361\u8BFA",
        "Mohamed KONE": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u79D1\u5185",
        "MOHAMED MANAI": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u9A6C\u5948",
        "MOHAMED SALAH": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u8428\u62C9\u8D6B",
        "Mohamed TOURE": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u56FE\u96F7",
        "MOHAMMAD ABUALNADI": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u5E03\u7EB3\u8FEA",
        "MOHAMMAD ABUGHOUSH": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u5E03\u53E4\u4EC0",
        "MOHAMMAD ABUHASHEESH": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u5E03\u54C8\u5E0C\u4EC0",
        "MOHAMMAD ABUZRAIQ": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u5E03\u5179\u62C9\u514B",
        "MOHAMMAD ALDAOUD": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u9053\u5FB7",
        "Mohammad GHORBANI": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u6208\u5C14\u5DF4\u5C3C",
        "Mohammad MOHEBBI": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u83AB\u8D6B\u6BD4",
        "MOHAMMED ABU ALSHAMAT": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u963F\u5E03\xB7\u6C99\u9A6C\u7279",
        "MOHAMMED ALOWAIS": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u5965\u97E6\u65AF",
        "MOHAMMED MUNTARI": "\u7A46\u7F55\u9ED8\u5FB7\xB7\u8499\u5854\u91CC",
        "MOHANAD ALI": "\u7A46\u54C8\u7EB3\u5FB7\xB7\u963F\u91CC",
        "MOHANAD LASHIN": "\u7A46\u54C8\u7EB3\u5FB7\xB7\u62C9\u8F9B",
        "MOHANNAD ABUTAHA": "\u7A46\u6C49\u7EB3\u5FB7\xB7\u963F\u5E03\u5854\u54C8",
        "Moise BOMBITO": "\u7A46\u74E6\u5179\xB7\u90A6\u6BD4\u6258",
        "Moises CAICEDO": "\u83AB\u4F0A\u585E\u65AF\xB7\u51EF\u585E\u591A",
        "Moises RAMIREZ": "\u83AB\u4F0A\u585E\u65AF\xB7\u62C9\u7C73\u96F7\u65AF",
        "Mojmir CHYTIL": "\u83AB\u4F0A\u7C73\u5C14\xB7\u5947\u8482\u5C14",
        "Montassar TALBI": "\u8499\u5854\u8428\u5C14\xB7\u5854\u5C14\u6BD4",
        "Morgan ROGERS": "\u6469\u6839\xB7\u7F57\u6770\u65AF",
        "Mortadha BEN OUANES": "\u7A46\u5C14\u5854\u8FBE\xB7\u672C\xB7\u74E6\u5185\u65AF",
        "Morten THORSBY": "\u83AB\u6ED5\xB7\u6258\u5C14\u65AF\u6BD4",
        "Mory DIAW": "\u83AB\u91CC\xB7\u8FEA\u4E9A\u592B",
        "MOSTAFA SHOUBIR": "\u7A46\u65AF\u5854\u6CD5\xB7\u8212\u6BD4\u5C14",
        "MOSTAFA ZICO": "\u7A46\u65AF\u5854\u6CD5\xB7\u6D4E\u79D1",
        "MOTEB ALHARBI": "\u7A46\u7279\u535C\xB7\u54C8\u6BD4",
        "Mouhib CHAMAKH": "\u7A46\u5E0C\u5E03\xB7\u6C99\u9A6C\u514B",
        "MOUSA ALTAMARI": "\u7A46\u8428\xB7\u5854\u9A6C\u91CC",
        "Moussa NIAKHATE": "\u7A46\u8428\xB7\u5C3C\u4E9A\u5361\u7279",
        "Moutaz NEFFATI": "\u7A46\u5854\u5179\xB7\u5185\u6CD5\u63D0",
        "MUNAF YOUNUS": "\u7A46\u7EB3\u592B\xB7\u5C24\u52AA\u65AF",
        "Munir EL KAJOUI": "\u7A46\u5C3C\u5C14\xB7\u5361\u7EA6\u7EF4",
        "MUSAB ALJUWAYR": "\u7A46\u8428\u5E03\xB7\u6731\u97E6\u5C14",
        "MUSTAFA SAADOON": "\u7A46\u65AF\u5854\u6CD5\xB7\u8428\u6566",
        "Nabil BENTALEB": "\u7EB3\u6BD4\u5C14\xB7\u672C\u5854\u83B1\u5E03",
        "NABIL DONGA": "\u7EB3\u6BD4\u5C14\xB7\u4E1C\u52A0",
        "Nadhir BENBOUALI": "\u7EB3\u8FEA\u5C14\xB7\u672C\u5E03\u963F\u5229",
        "Nadiem AMIRI": "\u7EB3\u8FEA\u59C6\xB7\u963F\u7C73\u91CC",
        "Nando PIJNAKER": "\u5357\u591A\xB7\u76AE\u7EB3\u514B",
        "NASSER ALDAWSARI": "\u7EB3\u8D5B\u5C14\xB7\u9053\u8428\u91CC",
        "Nathan AKE": "\u5185\u68EE\xB7\u963F\u514B",
        "Nathan NGOY": "\u7EB3\u68EE\xB7\u6069\u6208\u4F0A",
        "Nathan PATTERSON": "\u5185\u68EE\xB7\u5E15\u7279\u68EE",
        "Nathan SALIBA": "\u5185\u68EE\xB7\u8428\u5229\u5DF4",
        "Nathanael MBUKU": "\u7EB3\u6492\u7EB3\u5C14\xB7\u59C6\u5E03\u5E93",
        "Nathaniel BROWN": "\u7EB3\u6492\u5C3C\u5C14\xB7\u5E03\u6717",
        "NAWAF ALAQIDI": "\u7EB3\u74E6\u592B\xB7\u963F\u57FA\u8FEA",
        "NAWAF BU WASHL": "\u7EB3\u74E6\u592B\xB7\u5E03\u74E6\u8C22\u5C14",
        "Neil EL AYNAOUI": "\u5C3C\u5C14\xB7\u827E\u7EB3\u7EF4",
        "NELSON SEMEDO": "\u7EB3\u5C14\u900A\xB7\u585E\u6885\u591A",
        "Nestory IRANKUNDA": "\u5185\u65AF\u6258\u91CC\xB7\u4F0A\u6717\u6606\u8FBE",
        "NEYMAR JR": "\u5185\u9A6C\u5C14",
        "Ngalayel MUKAU": "\u6069\u52A0\u62C9\u8036\u5C14\xB7\u7A46\u8003",
        "Ngolo KANTE": "\u6069\u6208\u6D1B\xB7\u574E\u7279",
        "Nick WOLTEMADE": "\u5C3C\u514B\xB7\u6C83\u5C14\u7279\u9A6C\u5FB7",
        "Nico ELVEDI": "\u5C3C\u79D1\xB7\u57C3\u5C14\u7EF4\u8FEA",
        "Nico GONZALEZ": "\u5C3C\u79D1\xB7\u5188\u8428\u96F7\u65AF",
        "Nico OREILLY": "\u5C3C\u79D1\xB7\u5965\u83B1\u5229",
        "Nico PAZ": "\u5C3C\u79D1\xB7\u5E15\u65AF",
        "Nico SCHLOTTERBECK": "\u5C3C\u79D1\xB7\u65BD\u6D1B\u7279\u8D1D\u514B",
        "Nicolas DE LA CRUZ": "\u5C3C\u53E4\u62C9\u65AF\xB7\u5FB7\u62C9\u514B\u9C81\u65AF",
        "Nicolas JACKSON": "\u5C3C\u53E4\u62C9\u65AF\xB7\u6770\u514B\u900A",
        "Nicolas OTAMENDI": "\u5C3C\u53E4\u62C9\u65AF\xB7\u5965\u5854\u95E8\u8FEA",
        "Nicolas PEPE": "\u5C3C\u53E4\u62C9\u65AF\xB7\u4F69\u4F69",
        "Nicolas RASKIN": "\u5C3C\u53E4\u62C9\u65AF\xB7\u62C9\u65AF\u91D1",
        "Nicolas SEIWALD": "\u5C3C\u53E4\u62C9\u65AF\xB7\u585E\u74E6\u5C14\u5FB7",
        "Nicolas TAGLIAFICO": "\u5C3C\u53E4\u62C9\u65AF\xB7\u5854\u5229\u4E9A\u83F2\u79D1",
        "Nihad MUJAKIC": "\u5C3C\u54C8\u5FB7\xB7\u7A46\u4E9A\u57FA\u5947",
        "Niko SIGUR": "\u5C3C\u79D1\xB7\u897F\u53E4\u5C14",
        "Nikola KATIC": "\u5C3C\u53E4\u62C9\xB7\u5361\u8482\u5947",
        "Nikola MORO": "\u5C3C\u53E4\u62C9\xB7\u83AB\u7F57",
        "Nikola VASILJ": "\u5C3C\u53E4\u62C9\xB7\u74E6\u897F\u5C14",
        "Nikola VLASIC": "\u5C3C\u53E4\u62C9\xB7\u5F17\u62C9\u5E0C\u5947",
        "Nilson ANGULO": "\u5C3C\u5C14\u677E\xB7\u5B89\u53E4\u6D1B",
        "Nishan VELUPILLAY": "\u5C3C\u5C1A\xB7\u97E6\u5362\u76AE\u83B1",
        "NIZAR ALRASHDAN": "\u5C3C\u624E\u5C14\xB7\u62C9\u4EC0\u4E39",
        "Nkosinathi SIBISI": "\u6069\u79D1\u897F\u7EB3\u897F\xB7\u897F\u6BD4\u897F",
        "Noa LANG": "\u8BFA\u4E9A\xB7\u6717",
        "Noah OKAFOR": "\u8BFA\u4E9A\xB7\u5965\u5361\u798F\u5C14",
        "Noah SADIKI": "\u8BFA\u4E9A\xB7\u8428\u8FEA\u57FA",
        "Noni MADUEKE": "\u8BFA\u5C3C\xB7\u9A6C\u675C\u57C3\u51EF",
        "NOOR ALRAWABDEH": "\u52AA\u5C14\xB7\u62C9\u74E6\u5E03\u5FB7",
        "NOUR BANIATEYAH": "\u52AA\u5C14\xB7\u5DF4\u5C3C\u4E9A\u7279\u4E9A",
        "NUNO DA COSTA": "\u52AA\u8BFA\xB7\u8FBE\u79D1\u65AF\u5854",
        "Obed VARGAS": "\u5965\u8D1D\u5FB7\xB7\u5DF4\u5C14\u52A0\u65AF",
        "ODEH FAKHOURY": "\u5965\u5FB7\xB7\u6CD5\u80E1\u91CC",
        "Odiljon XAMROBEKOV": "\u5965\u8FEA\u5C14\u743C\xB7\u54C8\u59C6\u7F57\u522B\u79D1\u592B",
        "Odilon KOSSOUNOU": "\u5965\u8FEA\u9686\xB7\u79D1\u82CF\u52AA",
        "Oguz AYDIN": "\u5965\u53E4\u5179\xB7\u827E\u767B",
        "OH Hyeongyu": "\u5434\u8D24\u63C6",
        "Oliver BAUMANN": "\u5965\u5229\u5F17\xB7\u9C8D\u66FC",
        "Ollie WATKINS": "\u5965\u5229\xB7\u6C83\u7279\u91D1\u65AF",
        "Olwethu MAKHANYA": "\u5965\u5C14\u97E6\u56FE\xB7\u9A6C\u574E\u4E9A",
        "Omar ALDERETE": "\u5965\u9A6C\u5C14\xB7\u963F\u5C14\u5FB7\u96F7\u7279",
        "OMAR MARMOUSH": "\u5965\u9A6C\u5C14\xB7\u9A6C\u5C14\u7A46\u4EC0",
        "Omar REKIK": "\u5965\u9A6C\u5C14\xB7\u96F7\u57FA\u514B",
        "Orbelin PINEDA": "\u5965\u5C14\u8D1D\u6797\xB7\u76AE\u5185\u8FBE",
        "Orjan NYLAND": "\u5965\u5C14\u626C\xB7\u5C3C\u5170",
        "Orkun KOKCU": "\u5965\u5C14\u6606\xB7\u79D1\u514B\u66F2",
        "Orlando GILL": "\u5965\u5170\u591A\xB7\u5409\u5C14",
        "Orlando MOSQUERA": "\u5965\u5170\u591A\xB7\u83AB\u65AF\u514B\u62C9",
        "Oscar BOBB": "\u5965\u65AF\u5361\xB7\u535A\u5E03",
        "Oston URUNOV": "\u5965\u65AF\u901A\xB7\u4E4C\u9C81\u8BFA\u592B",
        "Oswin APPOLLIS": "\u5965\u65AF\u6E29\xB7\u963F\u6CE2\u5229\u65AF",
        "Otabek SHUKUROV": "\u5965\u5854\u522B\u514B\xB7\u8212\u5E93\u7F57\u592B",
        "Oumar DIAKITE": "\u4E4C\u9A6C\u5C14\xB7\u8FEA\u4E9A\u57FA\u7279",
        "Ousmane DEMBELE": "\u4E4C\u65AF\u66FC\xB7\u767B\u8D1D\u83B1",
        "Ousmane DIOMANDE": "\u4E4C\u65AF\u66FC\xB7\u8FEA\u5965\u66FC\u5FB7",
        "Oussama BENBOT": "\u4E4C\u8428\u9A6C\xB7\u672C\u535A\u7279",
        "Owen GOODMAN": "\u6B27\u6587\xB7\u53E4\u5FB7\u66FC",
        "Ozan KABAK": "\u5965\u8D5E\xB7\u5361\u5DF4\u514B",
        "PAIK Seungho": "\u767D\u627F\u6D69",
        "Pape GUEYE": "\u5E15\u666E\xB7\u76D6\u8036",
        "Pape Matar SARR": "\u5E15\u666E\xB7\u9A6C\u5854\u5C14\xB7\u8428\u5C14",
        "Parfait GUIAGON": "\u5E15\u5C14\u8D39\xB7\u5409\u4E9A\u8D21",
        "PARK Jinseob": "\u6734\u9547\u71EE",
        "Pascal GROSS": "\u5E15\u65AF\u5361\u5C14\xB7\u683C\u7F57\u65AF",
        "Pathe CISS": "\u5E15\u7279\xB7\u897F\u65AF",
        "Patrick BEACH": "\u5E15\u7279\u91CC\u514B\xB7\u6BD4\u5947",
        "Patrick BERG": "\u5E15\u7279\u91CC\u514B\xB7\u8D1D\u683C",
        "Patrick PENTZ": "\u5E15\u7279\u91CC\u514B\xB7\u5F6D\u8328",
        "Patrick WIMMER": "\u5E15\u7279\u91CC\u514B\xB7\u7EF4\u9ED8\u5C14",
        "Patrik SCHICK": "\u5E15\u7279\u91CC\u514B\xB7\u5E0C\u514B",
        "Pau CUBARSI": "\u4FDD\xB7\u5E93\u5DF4\u897F",
        "Paul IZZO": "\u4FDD\u7F57\xB7\u4F0A\u4F50",
        "Paul OKON-ENGSTLER": "\u4FDD\u7F57\xB7\u5965\u5B54-\u6069\u683C\u65AF\u7279\u52D2",
        "Paul WANNER": "\u4FDD\u7F57\xB7\u4E07\u7EB3",
        "Pavel SULC": "\u5E15\u7EF4\u5C14\xB7\u82CF\u5C14\u8328",
        "Payam NIAZMAND": "\u5E15\u4E9A\u59C6\xB7\u5C3C\u4E9A\u5179\u66FC\u5FB7",
        "PEDRO MIGUEL": "\u4F69\u5FB7\u7F57\xB7\u7C73\u683C\u5C14",
        "PEDRO NETO": "\u4F69\u5FB7\u7F57\xB7\u5185\u6258",
        "Pedro PORRO": "\u4F69\u5FB7\u7F57\xB7\u6CE2\u7F57",
        "Pedro VITE": "\u4F69\u5FB7\u7F57\xB7\u6BD4\u7279",
        "Pervis ESTUPINAN": "\u4F69\u5C14\u7EF4\u65AF\xB7\u57C3\u65AF\u56FE\u76AE\u5C3C\u5B89",
        "Petar MUSA": "\u5F7C\u5F97\xB7\u7A46\u8428",
        "Petar SUCIC": "\u5F7C\u5F97\xB7\u82CF\u5951\u5947",
        "Philipp LIENHART": "\u83F2\u5229\u666E\xB7\u5229\u6069\u54C8\u7279",
        "Phillip MWENE": "\u83F2\u5229\u666E\xB7\u59C6\u97E6\u5185",
        "PICO LOPES": "\u76AE\u79D1\xB7\u6D1B\u4F69\u65AF",
        "Piero HINCAPIE": "\u76AE\u8036\u7F57\xB7\u56E0\u5361\u76AE\u8036",
        "Prince ADU": "\u666E\u6797\u65AF\xB7\u963F\u675C",
        "Promise DAVID": "\u666E\u7F57\u7C73\u65AF\xB7\u5927\u536B",
        "Quinten TIMBER": "\u6606\u5EF7\xB7\u5EF7\u8D1D\u5C14",
        "Raed CHIKHAOUI": "\u62C9\u4F0A\u5FB7\xB7\u5E0C\u5361\u7EF4",
        "RAFAEL LEAO": "\u62C9\u6590\u5C14\xB7\u83B1\u6602",
        "Rafik BELGHALI": "\u62C9\u83F2\u514B\xB7\u8D1D\u5C14\u52A0\u5229",
        "RAJAEI AYED": "\u62C9\u8D3E\u4F0A\xB7\u963F\u8036\u5FB7",
        "Ramin REZAEIAN": "\u62C9\u660E\xB7\u96F7\u624E\u4F0A\u5B89",
        "Ramiz ZERROUKI": "\u62C9\u7C73\u5179\xB7\u6CFD\u9C81\u57FA",
        "Ramon SOSA": "\u62C9\u8499\xB7\u7D22\u8428",
        "Ramy BENSEBAINI": "\u62C9\u7C73\xB7\u672C\u585E\u62DC\u5C3C",
        "RAMY RABIA": "\u62C9\u7C73\xB7\u62C9\u6BD4\u4E9A",
        "Rani KHEDIRA": "\u62C9\u5C3C\xB7\u8D6B\u8FEA\u62C9",
        "Raul JIMENEZ": "\u52B3\u5C14\xB7\u5E0C\u95E8\u5C3C\u65AF",
        "Raul RANGEL": "\u52B3\u5C14\xB7\u5170\u8D6B\u5C14",
        "RAYAN": "\u62C9\u626C",
        "Rayan AIT-NOURI": "\u8D56\u5B89\xB7\u827E\u7279-\u8BFA\u91CC",
        "Rayan CHERKI": "\u8D56\u5B89\xB7\u5207\u5C14\u57FA",
        "Rayan ELLOUMI": "\u8D56\u5B89\xB7\u5362\u7C73",
        "REBIN SULAKA": "\u96F7\u5BBE\xB7\u82CF\u62C9\u5361",
        "Redouane HALHAL": "\u96F7\u675C\u5B89\xB7\u54C8\u5C14\u54C8\u5C14",
        "Reece JAMES": "\u91CC\u65AF\xB7\u8A79\u59C6\u65AF",
        "Relebohile MOFOKENG": "\u96F7\u83B1\u535A\u5E0C\u83B1\xB7\u83AB\u798F\u80AF",
        "RENATO VEIGA": "\u96F7\u7EB3\u6258\xB7\u7EF4\u57C3\u62C9",
        "Ricardo ADE": "\u91CC\u5361\u591A\xB7\u963F\u5FB7",
        "Ricardo GOSS": "\u91CC\u5361\u591A\xB7\u6208\u65AF",
        "Ricardo PEPI": "\u91CC\u5361\u591A\xB7\u4F69\u76AE",
        "Ricardo RODRIGUEZ": "\u91CC\u5361\u591A\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "Richard RIOS": "\u7406\u67E5\u5FB7\xB7\u91CC\u5965\u65AF",
        "Richie LARYEA": "\u91CC\u5947\xB7\u62C9\u8036\u4E9A",
        "Riechedly BAZOER": "\u91CC\u5207\u5FB7\u5229\xB7\u5DF4\u4F50\u5C14",
        "Riyad MAHREZ": "\u91CC\u4E9A\u5FB7\xB7\u9A6C\u8D6B\u96F7\u65AF",
        "Roberto ALVARADO": "\u7F57\u4F2F\u6258\xB7\u963F\u5C14\u74E6\u62C9\u591A",
        "Robin HRANAC": "\u7F57\u5BBE\xB7\u8D6B\u62C9\u7EB3\u5947",
        "Robin RISSER": "\u7F57\u5BBE\xB7\u91CC\u745F",
        "Robin ROEFS": "\u7F57\u5BBE\xB7\u52D2\u592B\u65AF",
        "Roderick MILLER": "\u7F57\u5FB7\u91CC\u514B\xB7\u7C73\u52D2",
        "Rodrigo AGUIRRE": "\u7F57\u5FB7\u91CC\u6208\xB7\u963F\u5409\u96F7",
        "Rodrigo ZALAZAR": "\u7F57\u5FB7\u91CC\u6208\xB7\u62C9\u8428\u8428\u5C14",
        "ROGER IBANEZ": "\u7F57\u6770\xB7\u4F0A\u5DF4\u6D85\u65AF",
        "Romano SCHMID": "\u7F57\u9A6C\u8BFA\xB7\u65BD\u5BC6\u5FB7",
        "Ronwen WILLIAMS": "\u7F57\u6069\u6587\xB7\u5A01\u5EC9\u59C6\u65AF",
        "Roozbeh CHESHMI": "\u9C81\u5179\u8D1D\u8D6B\xB7\u5207\u4EC0\u7C73",
        "Roshon VAN EIJMA": "\u7F57\u96C4\xB7\u8303\xB7\u57C3\u4F0A\u9A6C",
        "Ross STEWART": "\u7F57\u65AF\xB7\u65AF\u56FE\u5C14\u7279",
        "RUBEN DIAS": "\u9C81\u672C\xB7\u8FEA\u4E9A\u65AF",
        "RUBEN NEVES": "\u9C81\u672C\xB7\u5185\u7EF4\u65AF",
        "Ruben PROVIDENCE": "\u9C81\u672C\xB7\u666E\u7F57\u7EF4\u767B\u65AF",
        "Ruben VARGAS": "\u9C81\u6587\xB7\u5DF4\u5C14\u52A0\u65AF",
        "RUI SILVA": "\u9C81\u4F0A\xB7\u5E2D\u5C14\u74E6",
        "Ruslanbek JIYANOV": "\u9C81\u65AF\u5170\u522B\u514B\xB7\u5409\u4E9A\u8BFA\u592B",
        "Rustam ASHURMATOV": "\u9C81\u65AF\u5854\u59C6\xB7\u963F\u8212\u5C14\u9A6C\u6258\u592B",
        "Ryan CHRISTIE": "\u8D56\u5B89\xB7\u514B\u91CC\u65AF\u8482",
        "Ryan GRAVENBERCH": "\u8D56\u5B89\xB7\u683C\u62C9\u6587\u8D1D\u5C14\u8D6B",
        "RYAN MENDES": "\u745E\u5B89\xB7\u95E8\u5FB7\u65AF",
        "Ryan THOMAS": "\u8D56\u5B89\xB7\u6258\u9A6C\u65AF",
        "Sabri BEN HESSEN": "\u8428\u5E03\u91CC\xB7\u672C\xB7\u8D6B\u68EE",
        "Sadio MANE": "\u8428\u8FEA\u5965\xB7\u9A6C\u5185",
        "SAED ALROSAN": "\u8D5B\u4E49\u5FB7\xB7\u7F57\u6851",
        "Saeid EZATOLAHI": "\u8D5B\u4E49\u5FB7\xB7\u57C3\u624E\u6258\u62C9\u5E0C",
        "SALAH ZAKARIA": "\u8428\u62C9\u8D6B\xB7\u624E\u5361\u91CC\u4E9A",
        "SALEEM OBAID": "\u8428\u5229\u59C6\xB7\u5965\u8D1D\u5FB7",
        "SALEH ALSHEHRI": "\u8428\u5229\u8D6B\xB7\u8C22\u8D6B\u91CC",
        "Saleh HARDANI": "\u8428\u5229\u8D6B\xB7\u54C8\u5C14\u8FBE\u5C3C",
        "SALEM ALDAWSARI": "\u8428\u52D2\u59C6\xB7\u9053\u8428\u91CC",
        "Salih OZCAN": "\u8428\u5229\u8D6B\xB7\u5384\u5179\u8A79",
        "Saman GHODDOS": "\u8428\u66FC\xB7\u6208\u591A\u65AF",
        "Samed BAZDAR": "\u8428\u6885\u5FB7\xB7\u5DF4\u5179\u8FBE\u5C14",
        "Samet AKAYDIN": "\u8428\u6885\u7279\xB7\u963F\u51EF\u4E01",
        "Samir CHERGUI": "\u8428\u7C73\u5C14\xB7\u8C22\u5C14\u5409",
        "Samir EL MOURABET": "\u8428\u7C73\u5C14\xB7\u7A46\u62C9\u6BD4\u7279",
        "SAMU COSTA": "\u8428\u7A46\xB7\u79D1\u65AF\u5854",
        "Samuel MOUTOUSSAMY": "\u585E\u7F2A\u5C14\xB7\u7A46\u56FE\u8428\u7C73",
        "Samukele KABINI": "\u8428\u7A46\u51EF\u52D2\xB7\u5361\u6BD4\u5C3C",
        "Sander BERGE": "\u6851\u5FB7\u5C14\xB7\u8D1D\u683C",
        "Sander TANGVIK": "\u6851\u5FB7\u96F7\xB7\u5510\u7EF4\u514B",
        "Santiago ARIAS": "\u5723\u5730\u4E9A\u54E5\xB7\u963F\u91CC\u4E9A\u65AF",
        "Santiago BUENO": "\u5723\u5730\u4E9A\u54E5\xB7\u5E03\u57C3\u8BFA",
        "Santiago GIMENEZ": "\u5723\u5730\u4E9A\u54E5\xB7\u5E0C\u95E8\u5C3C\u65AF",
        "Santiago MELE": "\u5723\u5730\u4E9A\u54E5\xB7\u6885\u83B1",
        "Sarpreet SINGH": "\u8428\u5C14\u666E\u91CC\u7279\xB7\u8F9B\u683C",
        "Sasa KALAJDZIC": "\u8428\u6C99\xB7\u5361\u62C9\u5B63\u5947",
        "SAUD ABDULHAMID": "\u6C99\u7279\xB7\u963F\u535C\u675C\u52D2\u54C8\u7C73\u5FB7",
        "Scott McKENNA": "\u65AF\u79D1\u7279\xB7\u9EA6\u80AF\u7EB3",
        "Scott McTOMINAY": "\u65AF\u79D1\u7279\xB7\u9EA6\u514B\u6258\u7C73\u5948",
        "Sead KOLASINAC": "\u585E\u4E9A\u5FB7\xB7\u79D1\u62C9\u5E0C\u7EB3\u8328",
        "Sebastian BERHALTER": "\u585E\u5DF4\u65AF\u8482\u5B89\xB7\u8D1D\u5C14\u54C8\u5C14\u7279",
        "Sebastian CACERES": "\u585E\u5DF4\u65AF\u8482\u5B89\xB7\u5361\u585E\u96F7\u65AF",
        "Sebastian TOUNEKTI": "\u585E\u5DF4\u65AF\u8482\u5B89\xB7\u56FE\u5185\u514B\u63D0",
        "Seko FOFANA": "\u585E\u79D1\xB7\u798F\u6CD5\u7EB3",
        "Senne LAMMENS": "\u68EE\u5185\xB7\u62C9\u95E8\u65AF",
        "SEOL Youngwoo": "\u859B\u6C38\u4F51",
        "Sergino DEST": "\u585E\u5C14\u5409\u8BFA\xB7\u5FB7\u65AF\u7279",
        "Sergio ROCHET": "\u585E\u5C14\u5409\u5965\xB7\u7F57\u5207\u7279",
        "Shahriyar MOGHANLOO": "\u6C99\u8D6B\u91CC\u4E9A\u5C14\xB7\u83AB\u7518\u5362",
        "Sherel FLORANUS": "\u8C22\u96F7\u5C14\xB7\u5F17\u6D1B\u62C9\u52AA\u65AF",
        "Sherzod ESANOV": "\u8C22\u5C14\u4F50\u5FB7\xB7\u57C3\u8428\u8BFA\u592B",
        "Sherzod NASRULLAEV": "\u8C22\u5C14\u4F50\u5FB7\xB7\u7EB3\u65AF\u9C81\u62C9\u8036\u592B",
        "Shogo TANIGUCHI": "\u8C37\u53E3\u5F70\u609F",
        "Shoja KHALILZADEH": "\u7ECD\u8D3E\xB7\u54C8\u5229\u52D2\u624E\u5FB7",
        "Shurandy SAMBO": "\u8212\u5170\u8FEA\xB7\u6851\u535A",
        "Shuto MACHINO": "\u753A\u91CE\u4FEE\u6597",
        "SIDNY LOPES CABRAL": "\u897F\u5FB7\u5C3C\xB7\u6D1B\u4F69\u65AF\xB7\u5361\u5E03\u62C9\u5C14",
        "Silvan WIDMER": "\u897F\u5C14\u4E07\xB7\u7EF4\u5FB7\u9ED8",
        "Simon ADINGRA": "\u897F\u8499\xB7\u963F\u4E01\u683C\u62C9",
        "Simon BANZA": "\u897F\u8499\xB7\u73ED\u624E",
        "Sipho CHAINE": "\u897F\u6CE2\xB7\u6C99\u56E0",
        "Sofyan AMRABAT": "\u7D22\u83F2\u5B89\xB7\u963F\u59C6\u62C9\u5DF4\u7279",
        "SON Heungmin": "\u5B59\u5174\u615C",
        "Sondre LANGAS": "\u6851\u5FB7\u96F7\xB7\u6717\u52A0\u65AF",
        "SONG Bumkeun": "\u5B8B\u8303\u6839",
        "Sontje HANSEN": "\u677E\u7279\u8036\xB7\u6C49\u68EE",
        "Soufiane RAHIMI": "\u82CF\u83F2\u5B89\xB7\u62C9\u5E0C\u7C73",
        "Sphephelo SITHOLE": "\u65AF\u4F69\u8D6B\u4F69\u6D1B\xB7\u897F\u7D22\u52D2",
        "Stefan POSCH": "\u65AF\u7279\u51E1\xB7\u6CE2\u65BD",
        "Stepan CHALOUPEK": "\u4EC0\u6377\u6F58\xB7\u54C8\u5362\u4F69\u514B",
        "Stephen EUSTAQUIO": "\u65AF\u8482\u82AC\xB7\u5C24\u65AF\u5854\u57FA\u5965",
        "Steve KAPUADI": "\u53F2\u8482\u592B\xB7\u5361\u666E\u963F\u8FEA",
        "STEVEN MOREIRA": "\u53F2\u8482\u6587\xB7\u83AB\u96F7\u62C9",
        "Stjepan RADELJIC": "\u65AF\u7279\u8036\u6F58\xB7\u62C9\u5FB7\u5229\u5947",
        "STOPIRA": "\u65AF\u6258\u76AE\u62C9",
        "SULTAN ALBRAKE": "\u82CF\u5C14\u5766\xB7\u5E03\u62C9\u514B",
        "SULTAN MANDASH": "\u82CF\u5C14\u5766\xB7\u66FC\u8FBE\u4EC0",
        "Taha ALI": "\u5854\u54C8\xB7\u963F\u91CC",
        "Tahith CHONG": "\u5854\u5E0C\u7279\xB7\u949F",
        "TAHSIN MOHAMMED": "\u5854\u8F9B\xB7\u7A46\u7F55\u9ED8\u5FB7",
        "Takefusa KUBO": "\u4E45\u4FDD\u5EFA\u82F1",
        "Tani OLUWASEYI": "\u5854\u5C3C\xB7\u5965\u5362\u74E6\u585E\u4F0A",
        "TAREK ALAA": "\u5854\u91CC\u514B\xB7\u963F\u62C9",
        "Tarik MUHAREMOVIC": "\u5854\u91CC\u514B\xB7\u7A46\u54C8\u96F7\u83AB\u7EF4\u5947",
        "Teboho MOKOENA": "\u7279\u535A\u970D\xB7\u83AB\u79D1\u57C3\u7EB3",
        "TELMO ARCANJO": "\u7279\u5C14\u83AB\xB7\u963F\u5C14\u574E\u82E5",
        "Tete YENGI": "\u7279\u7279\xB7\u5EF6\u5409",
        "Teun KOOPMEINERS": "\u7279\u6069\xB7\u5E93\u666E\u6885\u7EB3\u65AF",
        "Thabang MATULUDI": "\u5854\u90A6\xB7\u9A6C\u56FE\u5362\u8FEA",
        "Thalente MBATHA": "\u5854\u4F26\u7279\xB7\u59C6\u5DF4\u5854",
        "Thapelo MASEKO": "\u5854\u4F69\u6D1B\xB7\u9A6C\u585E\u79D1",
        "Thelo AASGAARD": "\u585E\u6D1B\xB7\u5965\u65AF\u9AD8",
        "Themba ZWANE": "\u6ED5\u5DF4\xB7\u5179\u74E6\u5185",
        "Theo BONGONDA": "\u6CF0\u5965\xB7\u90A6\u8D21\u8FBE",
        "Theo HERNANDEZ": "\u7279\u5965\xB7\u57C3\u5C14\u5357\u5FB7\u65AF",
        "Thiago ALMADA": "\u8482\u4E9A\u6208\xB7\u963F\u5C14\u9A6C\u8FBE",
        "Thomas MEUNIER": "\u6258\u9A6C\u65AF\xB7\u9ED8\u5C3C\u8036",
        "Tim PAYNE": "\u8482\u59C6\xB7\u4F69\u6069",
        "Tim REAM": "\u8482\u59C6\xB7\u91CC\u59C6",
        "Timothy CASTAGNE": "\u8482\u83AB\u897F\xB7\u5361\u65AF\u5854\u6D85",
        "Timothy FAYULU": "\u8482\u83AB\u897F\xB7\u6CD5\u5C24\u5362",
        "Timothy WEAH": "\u8482\u83AB\u897F\xB7\u7EF4\u963F",
        "TOMAS ARAUJO": "\u6258\u9A6C\u65AF\xB7\u963F\u52B3\u82E5",
        "Tomas CHORY": "\u6258\u9A6C\u65AF\xB7\u970D\u91CC",
        "Tomas HOLES": "\u6258\u9A6C\u65AF\xB7\u970D\u83B1\u4EC0",
        "Tomas RODRIGUEZ": "\u6258\u9A6C\u65AF\xB7\u7F57\u5FB7\u91CC\u683C\u65AF",
        "Tomas SOUCEK": "\u6258\u9A6C\u65AF\xB7\u7ECD\u5207\u514B",
        "Tommy SMITH": "\u6C64\u7C73\xB7\u53F2\u5BC6\u65AF",
        "Tomoki HAYAKAWA": "\u65E9\u5DDD\u53CB\u57FA",
        "Toni FRUK": "\u6258\u5C3C\xB7\u5F17\u9C81\u514B",
        "Torbjorn HEGGEM": "\u6258\u5C14\u6BD4\u7EA6\u6069\xB7\u6D77\u683C\u59C6",
        "Trevoh CHALOBAH": "\u7279\u96F7\u6C83\xB7\u67E5\u6D1B\u5DF4",
        "Trevor DOORNBUSCH": "\u7279\u96F7\u5F17\xB7\u591A\u6069\u5E03\u65BD",
        "TREZEGUET": "\u7279\u96F7\u6CFD\u76D6",
        "Tshepang MOREMI": "\u91C7\u90A6\xB7\u83AB\u96F7\u7C73",
        "Tsuyoshi WATANABE": "\u6E21\u8FB9\u521A",
        "Tyler BINDON": "\u6CF0\u52D2\xB7\u5BBE\u767B",
        "Tyler FLETCHER": "\u6CF0\u52D2\xB7\u5F17\u83B1\u5F7B",
        "Tyrese NOSLIN": "\u8482\u96F7\u65AF\xB7\u8BFA\u65AF\u6797",
        "Tyrick BODAK": "\u8482\u91CC\u514B\xB7\u535A\u8FBE\u514B",
        "Ugurcan CAKIR": "\u4E4C\u5C14\u8A79\xB7\u6070\u514B\u5C14",
        "Umar ESHMURODOV": "\u4E4C\u9A6C\u5C14\xB7\u57C3\u4EC0\u7A46\u7F57\u591A\u592B",
        "Unai SIMON": "\u4E4C\u7EB3\u4F0A\xB7\u897F\u8499",
        "Utkir YUSUPOV": "\u4E4C\u7279\u57FA\u5C14\xB7\u5C24\u82CF\u6CE2\u592B",
        "Valentin BARCO": "\u74E6\u4F26\u4E01\xB7\u5DF4\u5C14\u79D1",
        "Victor LINDELOF": "\u7EF4\u514B\u6258\xB7\u6797\u5FB7\u6D1B\u592B",
        "Victor MUNOZ": "\u7EF4\u514B\u6258\xB7\u7A46\u5C3C\u5965\u65AF",
        "Viktor GYOKERES": "\u7EF4\u514B\u6258\xB7\u7EA6\u51EF\u96F7\u65AF",
        "Viktor JOHANSSON": "\u7EF4\u514B\u6258\xB7\u7EA6\u7FF0\u677E",
        "VITINHA": "\u7EF4\u8482\u5C3C\u4E9A",
        "Vladimir COUFAL": "\u5F17\u62C9\u57FA\u7C73\u5C14\xB7\u5E93\u6CD5\u5C14",
        "Vladimir DARIDA": "\u5F17\u62C9\u57FA\u7C73\u5C14\xB7\u8FBE\u91CC\u8FBE",
        "VOZINHA": "\u6C83\u9F50\u5C3C\u4E9A",
        "WAGNER PINA": "\u74E6\u683C\u7EB3\xB7\u76AE\u7EB3",
        "Waldemar ANTON": "\u74E6\u5C14\u5FB7\u9A6C\u5C14\xB7\u5B89\u4E1C",
        "Warren ZAIRE-EMERY": "\u6C83\u4F26\xB7\u624E\u4F0A\u5C14-\u57C3\u6885\u91CC",
        "WEVERTON": "\u97E6\u5F17\u987F",
        "Wilfried SINGO": "\u7EF4\u5C14\u5F17\u91CC\u5FB7\xB7\u8F9B\u6208",
        "Wilguens PAUGAIN": "\u7EF4\u5C14\u7518\u65AF\xB7\u6CE2\u7518",
        "Willer DITTA": "\u7EF4\u52D2\xB7\u8FEA\u5854",
        "Willian PACHO": "\u7EF4\u5229\u5B89\xB7\u5E15\u4E54",
        "WILLY SEMEDO": "\u7EF4\u5229\xB7\u585E\u6885\u591A",
        "Wilson ISIDOR": "\u5A01\u5C14\u900A\xB7\u4F0A\u897F\u591A\u5C14",
        "Woodensky PIERRE": "\u4F0D\u767B\u65AF\u57FA\xB7\u76AE\u57C3\u5C14",
        "Xaver SCHLAGER": "\u514B\u8428\u7EF4\u5C14\xB7\u65BD\u62C9\u683C",
        "Yahia FOFANA": "\u53F6\u6D77\u4E9A\xB7\u798F\u6CD5\u7EB3",
        "Yaimar MEDINA": "\u4E9A\u4F0A\u9A6C\u5C14\xB7\u6885\u8FEA\u7EB3",
        "Yan DIOMANDE": "\u626C\xB7\u8FEA\u5965\u66FC\u5FB7",
        "Yan VALERY": "\u626C\xB7\u74E6\u83B1\u91CC",
        "YANG Hyunjun": "\u6768\u8D24\u4FCA",
        "YANNICK SEMEDO": "\u96C5\u5C3C\u514B\xB7\u585E\u6885\u591A",
        "Yasin AYARI": "\u4E9A\u8F9B\xB7\u963F\u4E9A\u91CC",
        "YASSER IBRAHIM": "\u4E9A\u897F\u5C14\xB7\u6613\u535C\u62C9\u6B23",
        "Yassin FORTUNE": "\u4E9A\u8F9B\xB7\u798F\u56FE\u5185",
        "Yassine TITRAOUI": "\u4E9A\u8F9B\xB7\u63D0\u7279\u62C9\u7EF4",
        "YAZAN ALARAB": "\u4E9A\u8D5E\xB7\u963F\u62C9\u5E03",
        "YAZEED ABULAILA": "\u4E9A\u9F50\u5FB7\xB7\u963F\u5E03\u83B1\u62C9",
        "Yehvann DIOUF": "\u8036\u4E07\xB7\u8FEA\u4E4C\u592B",
        "Yeremy PINO": "\u8036\u96F7\u7C73\xB7\u76AE\u8BFA",
        "Yerry MINA": "\u8036\u91CC\xB7\u7C73\u7EB3",
        "Yoane WISSA": "\u7EA6\u963F\u5185\xB7\u7EF4\u8428",
        "Youri TIELEMANS": "\u5C24\u91CC\xB7\u8482\u52D2\u66FC\u65AF",
        "YOUSSEF AMYN": "\u4F18\u7D20\u798F\xB7\u963F\u660E",
        "Youssef BELAMMARI": "\u4F18\u7D20\u798F\xB7\u8D1D\u62C9\u9A6C\u91CC",
        "Yuito SUZUKI": "\u94C3\u6728\u552F\u4EBA",
        "Yukinari SUGAWARA": "\uFFFD\u7684\u83C5\u539F\u7531\u52BF",
        "Yunus AKGUN": "\u5C24\u52AA\u65AF\xB7\u963F\u514B\u8D21",
        "YUSUF ABDURISAG": "\u4F18\u7D20\u798F\xB7\u963F\u535C\u675C\u91CC\u8428\u683C",
        "Yuto NAGATOMO": "\u957F\u53CB\u4F51\u90FD",
        "Yvon MVOGO": "\u4F0A\u51AF\xB7\u59C6\u6C83\u6208",
        "ZAID ISMAEL": "\u5BB0\u5FB7\xB7\u4F0A\u65AF\u6885\u5C14",
        "ZAID TAHSEEN": "\u5BB0\u5FB7\xB7\u5854\u8F9B",
        "Zakaria EL OUAHDI": "\u624E\u5361\u91CC\u4E9A\xB7\u74E6\u8D6B\u8FEA",
        "Zeki AMDOUNI": "\u6CFD\u57FA\xB7\u5B89\u675C\u5C3C",
        "Zeki CELIK": "\u6CFD\u57FA\xB7\u5207\u5229\u514B",
        "ZIDANE IQBAL": "\u9F50\u8FBE\u5185\xB7\u4F0A\u514B\u5DF4\u5C14",
        "Zineddine BELAID": "\u9F50\u5185\u4E01\xB7\u8D1D\u83B1\u5FB7",
        "Zion SUZUKI": "\u94C3\u6728\u5F69\u8273",
        "ZIYAD ALJOHANI": "\u9F50\u4E9A\u5FB7\xB7\u6731\u54C8\u5C3C",
        "ZIZO": "\u9F50\u4F50",
        "Achraf HAKIMI": "\u963F\u4EC0\u62C9\u592B\xB7\u54C8\u57FA\u7C73",
        "Adrien RABIOT": "\u963F\u5FB7\u91CC\u5B89\xB7\u62C9\u6BD4\u5965",
        "Ajdin HRUSTIC": "\u963F\u6770\u4E01\xB7\u9C81\u65AF\u8482\u5947",
        "Alexis MAC ALLISTER": "\u963F\u5386\u514B\u65AF\xB7\u9EA6\u5361\u5229\u65AF\u7279",
        "Alexis VEGA": "\u963F\u5386\u514B\u897F\u65AF\xB7\u7EF4\u52A0",
        "Alireza JAHANBAKHSH": "\u963F\u91CC\u96F7\u624E\xB7\u8D3E\u6C49\u5DF4\u8D6B\u4EC0",
        "Alphonso DAVIES": "\u963F\u65B9\u7D22\xB7\u6234\u7EF4\u65AF",
        "Ante BUDIMIR": "\u5B89\u7279\xB7\u5E03\u8FEA\u7C73\u5C14",
        "Antoine SEMENYO": "\u5B89\u6258\u4E07\xB7\u585E\u6885\u5C3C\u5965",
        "Awer MABIL": "\u963F\u97E6\u5C14\xB7\u9A6C\u6BD4\u5C14",
        "Axel WITSEL": "\u963F\u514B\u585E\u5C14\xB7\u7EF4\u7279\u585E\u5C14",
        "Ayase UEDA": "\u4E0A\u7530\u7EEE\u4E16",
        "Aymeric LAPORTE": "\u827E\u6885\u91CC\u514B\xB7\u62C9\u6CE2\u5C14\u7279",
        "Bamba DIENG": "\u73ED\u5DF4\xB7\u8FEA\u6069",
        "BERNARDO SILVA": "\u8D1D\u5C14\u7EB3\u591A\xB7\u5E2D\u5C14\u74E6",
        "Breel EMBOLO": "\u5E03\u96F7\u5C14\xB7\u6069\u535A\u6D1B",
        "BRUNO FERNANDES": "\u5E03\u9C81\u8BFA\xB7\u8D39\u5C14\u5357\u5FB7\u65AF",
        "Bukayo SAKA": "\u5E03\u5361\u7EA6\xB7\u8428\u5361",
        "CASEMIRO": "\u5361\u585E\u7C73\u7F57",
        "Charles DE KETELAERE": "\u67E5\u5C14\u65AF\xB7\u5FB7\u51EF\u7279\u62C9\u5C14",
        "Christian PULISIC": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u666E\u5229\u897F\u5947",
        "Cody GAKPO": "\u79D1\u8FEA\xB7\u52A0\u79D1\u6CE2",
        "Cristian ROMERO": "\u514B\u91CC\u65AF\u8482\u5B89\xB7\u7F57\u6885\u7F57",
        "CRISTIANO RONALDO": "\u514B\u91CC\u65AF\u8482\u4E9A\u8BFA\xB7\u7F57\u7EB3\u5C14\u591A",
        "Cyle LARIN": "\u8D5B\u5C14\xB7\u62C9\u6797",
        "Daichi KAMADA": "\u9570\u7530\u5927\u5730",
        "Dani OLMO": "\u8FBE\u5C3C\xB7\u5965\u5C14\u83AB",
        "Declan RICE": "\u5FB7\u514B\u5170\xB7\u8D56\u65AF",
        "Denzel DUMFRIES": "\u9093\u6CFD\u5C14\xB7\u675C\u59C6\u5F17\u91CC\u65AF",
        "Edouard MENDY": "\u7231\u5FB7\u534E\xB7\u95E8\u8FEA",
        "ENDRICK": "\u6069\u5FB7\u91CC\u514B",
        "Enner VALENCIA": "\u6069\u7EB3\xB7\u74E6\u4F26\u897F\u4E9A",
        "Facundo PELLISTRI": "\u6CD5\u5B54\u591A\xB7\u4F69\u5229\u65AF\u7279\u91CC",
        "Federico VALVERDE": "\u8D39\u5FB7\u91CC\u79D1\xB7\u5DF4\u5C14\u97E6\u5FB7",
        "Ferran TORRES": "\u8D39\u5170\xB7\u6258\u96F7\u65AF",
        "Florian WIRTZ": "\u5F17\u6D1B\u91CC\u5B89\xB7\u7EF4\u5C14\u8328",
        "Frenkie DE JONG": "\u5F17\u4F26\u57FA\xB7\u5FB7\u5BB9",
        "GABRIEL MARTINELLI": "\u52A0\u5E03\u91CC\u57C3\u5C14\xB7\u9A6C\u4E01\u5185\u5229",
        "GAVI": "\u52A0\u7EF4",
        "Gonzalo PLATA": "\u5188\u8428\u6D1B\xB7\u666E\u62C9\u5854",
        "Granit XHAKA": "\u683C\u62C9\u5C3C\u7279\xB7\u624E\u5361",
        "Guillermo OCHOA": "\u5409\u5217\u5C14\u83AB\xB7\u5965\u4E54\u4E9A",
        "Harry KANE": "\u54C8\u91CC\xB7\u51EF\u6069",
        "Harry SOUTTAR": "\u54C8\u91CC\xB7\u8428\u5854",
        "Hiroki ITO": "\u4F0A\u85E4\u6D0B\u8F89",
        "Inaki WILLIAMS": "\u4F0A\u7EB3\u57FA\xB7\u5A01\u5EC9\u59C6\u65AF",
        "Jamal MUSIALA": "\u8D3E\u9A6C\u5C14\xB7\u7A46\u897F\u4E9A\u62C9",
        "JAMIRO MONTEIRO": "\u96C5\u7C73\u7F57\xB7\u8499\u6CF0\u7F57",
        "Jhon ARIAS": "\u7EA6\u7FF0\xB7\u963F\u91CC\u4E9A\u65AF",
        "Johan MOJICA": "\u7EA6\u7FF0\xB7\u83AB\u5E0C\u5361",
        "John STONES": "\u7EA6\u7FF0\xB7\u65AF\u901A\u65AF",
        "Jonathan DAVID": "\u4E54\u7EB3\u68EE\xB7\u5927\u536B",
        "Jordan AYEW": "\u4E54\u4E39\xB7\u963F\u5C24",
        "Jordan PICKFORD": "\u4E54\u4E39\xB7\u76AE\u514B\u798F\u5FB7",
        "Joshua KIMMICH": "\u7EA6\u4E66\u4E9A\xB7\u57FA\u7C73\u5E0C",
        "Jude BELLINGHAM": "\u8D3E\u5FB7\xB7\u8D1D\u6797\u5384\u59C6",
        "Junya ITO": "\u4F0A\u4E1C\u7EAF\u4E5F",
        "Kai HAVERTZ": "\u51EF\xB7\u54C8\u5F17\u8328",
        "Kalidou KOULIBALY": "\u5361\u5229\u675C\xB7\u5E93\u5229\u5DF4\u5229",
        "Kevin DE BRUYNE": "\u51EF\u6587\xB7\u5FB7\u5E03\u52B3\u5185",
        "Lamine YAMAL": "\u62C9\u660E\xB7\u4E9A\u9A6C\u5C14",
        "Leandro PAREDES": "\u83B1\u5B89\u5FB7\u7F57\xB7\u5E15\u96F7\u5FB7\u65AF",
        "Leandro TROSSARD": "\u83B1\u5B89\u5FB7\u7F57\xB7\u7279\u7F57\u8428\u5C14",
        "Lionel MESSI": "\u83B1\u6602\u5185\u5C14\xB7\u6885\u897F",
        "Manuel AKANJI": "\u66FC\u52AA\u57C3\u5C14\xB7\u963F\u574E\u5409",
        "Manuel NEUER": "\u66FC\u52AA\u57C3\u5C14\xB7\u8BFA\u4F0A\u5C14",
        "Marcus RASHFORD": "\u9A6C\u5E93\u65AF\xB7\u62C9\u4EC0\u798F\u5FB7",
        "Marcus THURAM": "\u9A6C\u5E93\u65AF\xB7\u56FE\u62C9\u59C6",
        "MARQUINHOS": "\u9A6C\u5C14\u57FA\u5C3C\u5965\u65AF",
        "Mathew RYAN": "\u9A6C\u4FEE\xB7\u745E\u5B89",
        "Matt TURNER": "\u9A6C\u7279\xB7\u7279\u7EB3",
        "Mehdi TAREMI": "\u8FC8\u8D6B\u8FEA\xB7\u5854\u96F7\u7C73",
        "Memphis DEPAY": "\u5B5F\u83F2\u65AF\xB7\u5FB7\u4F69",
        "Mike MAIGNAN": "\u8FC8\u514B\xB7\u8FC8\u5C3C\u6602",
        "Mikel OYARZABAL": "\u7C73\u514B\u5C14\xB7\u5965\u4E9A\u5C14\u8428\u74E6\u5C14",
        "Nahuel MOLINA": "\u7EB3\u97E6\u5C14\xB7\u83AB\u5229\u7EB3",
        "Nico WILLIAMS": "\u5C3C\u79D1\xB7\u5A01\u5EC9\u59C6\u65AF",
        "Noussair MAZRAOUI": "\u52AA\u8428\u4F0A\u5C14\xB7\u9A6C\u5179\u52B3\u4F0A",
        "NUNO MENDES": "\u52AA\u8BFA\xB7\u95E8\u5FB7\u65AF",
        "PEDRI": "\u4F69\u5FB7\u91CC",
        "RAPHINHA": "\u62C9\u83F2\u5C3C\u4E9A",
        "Remo FREULER": "\u96F7\u83AB\xB7\u5F17\u6D1B\u4F0A\u52D2",
        "Ritsu DOAN": "\u5802\u5B89\u5F8B",
        "RODRI": "\u7F57\u5FB7\u91CC",
        "Rodrigo BENTANCUR": "\u7F57\u5FB7\u91CC\u6208\xB7\u672C\u5766\u5E93\u5C14",
        "Rodrigo DE PAUL": "\u7F57\u5FB7\u91CC\u6208\xB7\u5FB7\u4FDD\u7F57",
        "Romelu LUKAKU": "\u7F57\u6885\u5362\xB7\u5362\u5361\u5E93",
        "Tajon BUCHANAN": "\u5854\u5BB9\xB7\u5E03\u574E\u5357",
        "Takehiro TOMIYASU": "\u51A8\u5B89\u5065\u6D0B",
        "Thibaut COURTOIS": "\u8482\u535A\xB7\u5E93\u5C14\u56FE\u74E6",
        "Thomas PARTEY": "\u6258\u9A6C\u65AF\xB7\u5E15\u5C14\u6CF0",
        "Tijjani REIJNDERS": "\u8482\u8D3E\u5C3C\xB7\u96F7\u6069\u5FB7\u65AF",
        "Tyler ADAMS": "\u6CF0\u52D2\xB7\u4E9A\u5F53\u65AF",
        "VINICIUS JUNIOR": "\u7EF4\u5C3C\u4FEE\u65AF\xB7\u5112\u5C3C\u5965\u5C14",
        "Virgil VAN DIJK": "\u7EF4\u5409\u5C14\xB7\u8303\u6234\u514B",
        "Weston McKENNIE": "\u97E6\u65AF\u987F\xB7\u9EA6\u80AF\u5C3C",
        "William SALIBA": "\u5A01\u5EC9\xB7\u8428\u5229\u5DF4",
        "Wout WEGHORST": "\u6C83\u7279\xB7\u97E6\u970D\u65AF\u7279",
        "Yassine BOUNOU": "\u4E9A\u8F9B\xB7\u5E03\u52AA"
      };
      function getState() {
        return window.WorldCup.State;
      }
      let _zhNamesLower = null;
      function getZhNamesLower() {
        if (!_zhNamesLower) {
          _zhNamesLower = {};
          for (const [k, v] of Object.entries(ZH_NAMES)) {
            const norm = k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
            _zhNamesLower[norm] = v;
          }
        }
        return _zhNamesLower;
      }
      function translatePlayerName(name, nameZh) {
        const state = getState();
        if (!name) return name;
        if (state.uiLang === "en") return name;
        if (nameZh) return nameZh;
        if (ZH_NAMES[name]) return ZH_NAMES[name];
        const norm = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        return getZhNamesLower()[norm] || name;
      }
      function translateCoachField(val, type) {
        const state = getState();
        if (!val) return val;
        if (state.uiLang === "zh") {
          if (type === "tenure") return val;
          return ZH_NAMES[val] || val;
        } else {
          if (type === "tenure") {
            return String(val).replace("\u5E74", " years").replace("\u4E2A\u6708", " months");
          }
          if (type === "style" || type === "nationality") {
            const revDict = Object.fromEntries(Object.entries(ZH_NAMES).map(([k, v]) => [v, k]));
            return revDict[val] || val;
          }
          return val;
        }
      }
      function t(key) {
        const state = getState();
        const { I18N } = window.WorldCup;
        return I18N[state.uiLang]?.[key] || I18N.zh[key] || key;
      }
      function displayTeamName(name) {
        const state = getState();
        const raw = String(name || "").trim();
        const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
        if (!bilingual) {
          if (state.uiLang === "zh" && ZH_NAMES[raw]) return ZH_NAMES[raw];
          return raw;
        }
        return state.uiLang === "en" ? bilingual[2].trim() : bilingual[1].trim();
      }
      function displayMaybeTeamName(name) {
        if (name && typeof name === "object") {
          const i18n = name.nameI18n || name;
          if (i18n && (i18n.zh || i18n.en)) {
            const state = getState();
            return state.uiLang === "en" ? i18n.en || i18n.zh || "" : i18n.zh || i18n.en || "";
          }
          return displayTeamName(name.name || name.displayName || name.shortName || "");
        }
        return displayTeamName(name);
      }
      function i18nText(value, fallback = "") {
        const state = getState();
        if (value && typeof value === "object" && (value.zh || value.en)) {
          return state.uiLang === "en" ? value.en || value.zh || fallback : value.zh || value.en || fallback;
        }
        return value || fallback;
      }
      function displayGroupName(name) {
        const state = getState();
        const group = String(name || "").match(/([A-L])$/)?.[1] || "";
        if (!group) return name || "";
        return state.uiLang === "en" ? `Group ${group}` : `\u5C0F\u7EC4 ${group}`;
      }
      function applyLanguage() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
          el.textContent = t(el.dataset.i18n);
        });
        const scrollLeft = document.getElementById("date-scroll-left");
        if (scrollLeft) scrollLeft.setAttribute("aria-label", t("scrollLeft"));
        const scrollRight = document.getElementById("date-scroll-right");
        if (scrollRight) scrollRight.setAttribute("aria-label", t("scrollRight"));
        document.querySelectorAll(".lang-btn").forEach((btn) => {
          const state = getState();
          const active = btn.dataset.lang === state.uiLang;
          btn.classList.toggle("bg-white/15", active);
          btn.classList.toggle("text-white", active);
          btn.classList.toggle("text-gray-500", !active);
        });
      }
      function setLanguage(lang) {
        const state = getState();
        const { I18N } = window.WorldCup;
        if (!I18N[lang] || lang === state.uiLang) return;
        state.uiLang = lang;
        localStorage.setItem("worldcup_lang", state.uiLang);
        applyLanguage();
        if (window.syncGlobalChatLanguage) window.syncGlobalChatLanguage();
        if (state.tab === "live") loadScores();
        if (state.tab === "schedule") {
          const selectedDate = document.querySelector(".date-btn.tab-on")?.dataset.date;
          if (selectedDate) filterDate(selectedDate);
          else loadSchedule();
        }
        if (state.tab === "standings") loadStandings();
        if (state.tab === "teams") {
          state.allTeams = [];
          loadTeams();
        }
        if (state.tab === "prediction") loadPrediction();
      }
      window.WorldCup.I18n = {
        ZH_NAMES,
        translatePlayerName,
        translateCoachField,
        t,
        displayTeamName,
        displayMaybeTeamName,
        i18nText,
        displayGroupName,
        applyLanguage,
        setLanguage
      };
      window.translatePlayerName = translatePlayerName;
      window.t = t;
      window.displayTeamName = displayTeamName;
      window.displayMaybeTeamName = displayMaybeTeamName;
      window.i18nText = i18nText;
      window.displayGroupName = displayGroupName;
      window.applyLanguage = applyLanguage;
      window.setLanguage = setLanguage;
    })();
  }
});

// static/js/utils.js
var require_utils = __commonJS({
  "static/js/utils.js"() {
    (function() {
      function getState() {
        return window.WorldCup.State;
      }
      function tx(zh, en) {
        const state = getState();
        return state.uiLang === "zh" ? zh : en;
      }
      function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[ch]);
      }
      function attr(value) {
        return esc(value);
      }
      function safeUrl2(url) {
        if (!url) return "";
        const str = String(url).trim();
        if (str.startsWith("http://") || str.startsWith("https://")) {
          return esc(str);
        }
        return "";
      }
      function normalizeCelsius(value, unit) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return unit === "F" || !unit && n > 50 ? (n - 32) * 5 / 9 : n;
      }
      function getWeatherUnit() {
        try {
          return localStorage.getItem("weatherUnit") === "F" ? "F" : "C";
        } catch {
          return "C";
        }
      }
      function formatTemperature(value, sourceUnit = "C", displayUnit = getWeatherUnit()) {
        const celsius = normalizeCelsius(value, sourceUnit);
        if (celsius === null) return "--";
        const converted = displayUnit === "F" ? celsius * 9 / 5 + 32 : celsius;
        return `${Math.round(converted)}\xB0${displayUnit}`;
      }
      function setWeatherUnit(unit) {
        const next = unit === "F" ? "F" : "C";
        try {
          localStorage.setItem("weatherUnit", next);
        } catch {
        }
        document.querySelectorAll("[data-temp-c]").forEach((el) => {
          el.textContent = formatTemperature(el.dataset.tempC, "C", next);
        });
        document.querySelectorAll("[data-weather-unit]").forEach((el) => {
          el.classList.toggle("active", el.dataset.weatherUnit === next);
          el.setAttribute("aria-pressed", String(el.dataset.weatherUnit === next));
        });
      }
      async function api(url, options = {}) {
        const { ApiClient } = window.WorldCup;
        return ApiClient.legacy(url, options);
      }
      function displayMaybeTeamName(...a) {
        return (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
      }
      function displayGroupName(...a) {
        return (window.WorldCup.I18n?.displayGroupName || ((x) => x))(...a);
      }
      const U = window.WorldCup.Utils;
      U.tx = tx;
      U.esc = esc;
      U.attr = attr;
      U.safeUrl = safeUrl2;
      U.api = api;
      U.normalizeCelsius = normalizeCelsius;
      U.getWeatherUnit = getWeatherUnit;
      U.formatTemperature = formatTemperature;
      U.setWeatherUnit = setWeatherUnit;
      U.displayMaybeTeamName = displayMaybeTeamName;
      U.displayGroupName = displayGroupName;
      Object.defineProperty(U, "t", { get() {
        return window.t;
      }, enumerable: true });
      window.tx = tx;
      window.esc = esc;
      window.attr = attr;
      window.safeUrl = safeUrl2;
      window.api = api;
    })();
  }
});

// static/js/api-client.js
var require_api_client = __commonJS({
  "static/js/api-client.js"() {
    var API2 = /* @__PURE__ */ (() => {
      const STATUS = {
        OK: "ok",
        EMPTY: "empty",
        ERROR_HTTP: "error_http",
        ERROR_NETWORK: "error_network",
        ERROR_TIMEOUT: "error_timeout",
        ERROR_PARSE: "error_parse"
      };
      const TIMEOUT_DEFAULT = 8e3;
      const TIMEOUT_LONG = 15e3;
      function makeResult(status, data, error, statusCode, url, elapsed) {
        return {
          ok: status === STATUS.OK || status === STATUS.EMPTY,
          status,
          data: status === STATUS.OK ? data : null,
          error: error || null,
          statusCode: statusCode || null,
          url,
          elapsed,
          // Convenience: true when response has data to render
          hasData: status === STATUS.OK && data != null,
          // Convenience: true when the request failed (not just empty)
          isFailure: status === STATUS.ERROR_HTTP || status === STATUS.ERROR_NETWORK || status === STATUS.ERROR_TIMEOUT || status === STATUS.ERROR_PARSE
        };
      }
      async function request(url, options = {}) {
        const {
          method = "GET",
          body,
          headers = {},
          timeout = TIMEOUT_DEFAULT,
          retries = 0,
          cache = "no-store"
        } = options;
        const start = Date.now();
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            const fetchOpts = {
              method,
              cache,
              signal: controller.signal,
              headers: { ...headers }
            };
            if (body !== void 0 && method !== "GET") {
              fetchOpts.body = JSON.stringify(body);
              if (!fetchOpts.headers["Content-Type"]) {
                fetchOpts.headers["Content-Type"] = "application/json";
              }
            }
            const res = await fetch(url, fetchOpts);
            clearTimeout(timer);
            const elapsed = Date.now() - start;
            if (!res.ok) {
              let errorData = null;
              try {
                errorData = await res.json();
              } catch {
              }
              const msg = errorData?.error || errorData?.message || `HTTP ${res.status}`;
              return makeResult(STATUS.ERROR_HTTP, null, msg, res.status, url, elapsed);
            }
            let data = null;
            try {
              data = await res.json();
            } catch {
              return makeResult(STATUS.ERROR_PARSE, null, "Invalid JSON response", res.status, url, elapsed);
            }
            if (data === null || data === void 0) {
              return makeResult(STATUS.EMPTY, null, null, res.status, url, elapsed);
            }
            if (data && typeof data === "object" && data.error && !data.data) {
              return makeResult(STATUS.ERROR_HTTP, null, data.error, res.status, url, elapsed);
            }
            return makeResult(STATUS.OK, data, null, res.status, url, elapsed);
          } catch (err) {
            const elapsed = Date.now() - start;
            lastError = err;
            if (err.name === "AbortError") {
              return makeResult(STATUS.ERROR_TIMEOUT, null, "Request timed out", null, url, elapsed);
            }
            if (attempt < retries) {
              await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
              continue;
            }
            return makeResult(STATUS.ERROR_NETWORK, null, err.message || "Network error", null, url, elapsed);
          }
        }
        return makeResult(STATUS.ERROR_NETWORK, null, lastError?.message || "Unknown error", null, url, Date.now() - start);
      }
      function get(url, options = {}) {
        return request(url, { ...options, method: "GET" });
      }
      function post(url, body, options = {}) {
        return request(url, { ...options, method: "POST", body });
      }
      async function all(requests) {
        const promises = requests.map((req) => {
          if (typeof req === "string") {
            return get(req).then((result) => ({ url: req, result }));
          }
          return request(req.url, req.options || {}).then((result) => ({ url: req.url, result }));
        });
        return Promise.all(promises);
      }
      async function allData(requests, options = {}) {
        const results = await all(requests);
        return results.map(({ result }) => result.ok ? result.data : null);
      }
      async function legacy(url, options = {}) {
        const result = await request(url, options);
        return result.ok ? result.data : null;
      }
      return {
        STATUS,
        TIMEOUT_DEFAULT,
        TIMEOUT_LONG,
        request,
        get,
        post,
        all,
        allData,
        legacy
      };
    })();
    Object.freeze(API2.STATUS);
    window.API = API2;
    window.WorldCup = window.WorldCup || {};
    window.WorldCup.ApiClient = API2;
  }
});

// static/js/formatters.js
var require_formatters = __commonJS({
  "static/js/formatters.js"() {
    var Fmt2 = /* @__PURE__ */ (() => {
      function safeNum(value, fallback = 0) {
        if (value === null || value === void 0 || value === "") return fallback;
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
      }
      function safeInt(value, fallback = 0) {
        return Math.round(safeNum(value, fallback));
      }
      function pct(prob, fallback = "-") {
        const n = safeNum(prob, null);
        if (n === null) return fallback;
        return Math.round(n * 100) + "%";
      }
      function rawPct(value, fallback = "-") {
        const n = safeNum(value, null);
        if (n === null) return fallback;
        return Math.round(n) + "%";
      }
      function pctPrecise(prob, decimals = 1, fallback = "-") {
        const n = safeNum(prob, null);
        if (n === null) return fallback;
        return (n * 100).toFixed(decimals) + "%";
      }
      function pctBar(prob) {
        const n = safeNum(prob, 0);
        return Math.min(100, Math.max(0, Math.round(n * 100)));
      }
      function score(home, away) {
        const h = safeInt(home, 0);
        const a = safeInt(away, 0);
        return `${h}-${a}`;
      }
      function resultBadge(result, lang = "zh") {
        if (result === "W") return lang === "zh" ? "\u80DC" : "W";
        if (result === "D") return lang === "zh" ? "\u5E73" : "D";
        if (result === "L") return lang === "zh" ? "\u8D1F" : "L";
        return "-";
      }
      function teamName(name, lang) {
        const ui = lang || (typeof uiLang !== "undefined" ? uiLang : "zh");
        const raw = String(name || "").trim();
        const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
        if (!bilingual) return raw;
        return ui === "en" ? bilingual[2].trim() : bilingual[1].trim();
      }
      function teamNameFromObj(nameOrObj, lang) {
        const ui = lang || (typeof uiLang !== "undefined" ? uiLang : "zh");
        if (nameOrObj && typeof nameOrObj === "object") {
          const i18n = nameOrObj.nameI18n || nameOrObj;
          if (i18n && (i18n.zh || i18n.en)) {
            return ui === "en" ? i18n.en || i18n.zh || "" : i18n.zh || i18n.en || "";
          }
          return teamName(nameOrObj.name || nameOrObj.displayName || nameOrObj.shortName || "", lang);
        }
        return teamName(nameOrObj, lang);
      }
      function text(value, fallback = "", lang) {
        const ui = lang || (typeof uiLang !== "undefined" ? uiLang : "zh");
        if (value && typeof value === "object" && (value.zh || value.en)) {
          return ui === "en" ? value.en || value.zh || fallback : value.zh || value.en || fallback;
        }
        return value || fallback;
      }
      function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[ch]);
      }
      function attr(value) {
        return esc(value);
      }
      function safeUrl2(url) {
        if (!url) return "";
        const str = String(url).trim();
        if (str.startsWith("http://") || str.startsWith("https://")) {
          return esc(str);
        }
        return "";
      }
      function emptyState(message, icon = "\u{1F4ED}") {
        return `<div class="text-center py-8"><div class="text-4xl mb-2">${icon}</div><p class="text-gray-500 text-sm">${esc(message)}</p></div>`;
      }
      function errorState(message, icon = "\u26A0\uFE0F") {
        return `<div class="text-center py-8"><div class="text-4xl mb-2">${icon}</div><p class="text-red-400 text-sm">${esc(message)}</p></div>`;
      }
      function loadingState(message) {
        return `<div class="flex items-center justify-center gap-2 py-8">
            <div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            <span class="text-gray-500 text-sm">${esc(message)}</span>
        </div>`;
      }
      function hasValue(value) {
        return value !== void 0 && value !== null && value !== "" && value !== "NaN";
      }
      function displayOr(value, fallback = "-") {
        return hasValue(value) ? value : fallback;
      }
      function confidenceBadge(value, label) {
        const n = safeNum(value, 0);
        const pctVal = Math.round(n * 100);
        const cls = pctVal >= 70 ? "bg-green-500/20 text-green-400" : pctVal >= 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400";
        const text2 = label ? `${label} ${pctVal}%` : `${pctVal}%`;
        return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}">${text2}</span>`;
      }
      function dataQualityBadge(quality) {
        const labels = {
          "live": { zh: "\u2713 \u5B9E\u65F6\u6570\u636E", en: "\u2713 Live Data", cls: "bg-green-500/20 text-green-400" },
          "partial": { zh: "\u26A0 \u90E8\u5206\u6570\u636E", en: "\u26A0 Partial Data", cls: "bg-yellow-500/20 text-yellow-400" },
          "unavailable": { zh: "\u2717 \u6682\u65E0\u6570\u636E", en: "\u2717 No Data", cls: "bg-red-500/20 text-red-400" }
        };
        const info = labels[quality] || labels["unavailable"];
        const lang = typeof uiLang !== "undefined" ? uiLang : "zh";
        const text2 = lang === "en" ? info.en : info.zh;
        return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${info.cls}">${text2}</span>`;
      }
      function eloRankClass(index) {
        if (index === 0) return "rank-gold";
        if (index === 1) return "rank-silver";
        if (index === 2) return "rank-bronze";
        return "rank-default";
      }
      function eloChange(current, previous) {
        if (!previous || previous === current) return '<span class="rank-change rank-same">\u2014</span>';
        const diff = previous - current;
        if (diff > 0) return `<span class="rank-change rank-up">\u25B2${diff}</span>`;
        return `<span class="rank-change rank-down">\u25BC${Math.abs(diff)}</span>`;
      }
      return {
        // Numbers
        safeNum,
        safeInt,
        // Percentages
        pct,
        rawPct,
        pctPrecise,
        pctBar,
        // Scores
        score,
        resultBadge,
        // Names
        teamName,
        teamNameFromObj,
        // i18n
        text,
        // HTML
        esc,
        attr,
        safeUrl: safeUrl2,
        // States
        emptyState,
        errorState,
        loadingState,
        hasValue,
        displayOr,
        // Badges
        confidenceBadge,
        dataQualityBadge,
        // Elo
        eloRankClass,
        eloChange
      };
    })();
    Object.freeze(Fmt2);
    window.Fmt = Fmt2;
  }
});

// static/js/match-stats.js
var require_match_stats = __commonJS({
  "static/js/match-stats.js"() {
    (function() {
      const MATCH_STAT_GROUPS = {
        attack: {
          label: { zh: "\u8FDB\u653B", en: "Attack" },
          icon: "\u2694\uFE0F",
          stats: {
            possessionPct: { zh: "\u63A7\u7403\u7387", en: "Possession" },
            wonCorners: { zh: "\u89D2\u7403", en: "Corners" },
            offsides: { zh: "\u8D8A\u4F4D", en: "Offsides" }
          }
        },
        shooting: {
          label: { zh: "\u5C04\u95E8", en: "Shooting" },
          icon: "\u{1F3AF}",
          stats: {
            shotsSummary: { zh: "\u5C04\u95E8\uFF08\u5C04\u6B63\uFF09", en: "Shots (on target)" },
            totalShots: { zh: "\u603B\u5C04\u95E8", en: "Total shots" },
            shotsOnTarget: { zh: "\u5C04\u6B63", en: "Shots on target" },
            shotPct: { zh: "\u5C04\u95E8\u8F6C\u5316\u7387", en: "Shot conversion" },
            blockedShots: { zh: "\u5C01\u5835\u5C04\u95E8", en: "Blocked shots" },
            penaltyKickGoals: { zh: "\u70B9\u7403\u5F97\u5206", en: "Penalty goals" },
            penaltyKickShots: { zh: "\u70B9\u7403\u6570", en: "Penalty shots" }
          }
        },
        passing: {
          label: { zh: "\u4F20\u7403", en: "Passing" },
          icon: "\u{1F9ED}",
          stats: {
            accuratePasses: { zh: "\u51C6\u786E\u4F20\u7403", en: "Accurate passes" },
            totalPasses: { zh: "\u603B\u4F20\u7403", en: "Total passes" },
            passPct: { zh: "\u4F20\u7403\u6210\u529F\u7387", en: "Pass accuracy" },
            accurateCrosses: { zh: "\u51C6\u786E\u4F20\u4E2D", en: "Accurate crosses" },
            totalCrosses: { zh: "\u603B\u4F20\u4E2D", en: "Total crosses" },
            crossPct: { zh: "\u4F20\u4E2D\u6210\u529F\u7387", en: "Cross accuracy" },
            accurateLongBalls: { zh: "\u51C6\u786E\u957F\u4F20", en: "Accurate long balls" },
            totalLongBalls: { zh: "\u603B\u957F\u4F20", en: "Total long balls" },
            longballPct: { zh: "\u957F\u4F20\u6210\u529F\u7387", en: "Long-ball accuracy" }
          }
        },
        defending: {
          label: { zh: "\u9632\u5B88", en: "Defending" },
          icon: "\u{1F6E1}\uFE0F",
          stats: {
            saves: { zh: "\u6251\u6551", en: "Saves" },
            effectiveTackles: { zh: "\u6210\u529F\u62A2\u65AD", en: "Successful tackles" },
            totalTackles: { zh: "\u603B\u62A2\u65AD", en: "Total tackles" },
            tacklePct: { zh: "\u62A2\u65AD\u6210\u529F\u7387", en: "Tackle success" },
            interceptions: { zh: "\u62E6\u622A", en: "Interceptions" },
            effectiveClearance: { zh: "\u6709\u6548\u89E3\u56F4", en: "Effective clearances" },
            totalClearance: { zh: "\u603B\u89E3\u56F4", en: "Total clearances" }
          }
        },
        discipline: {
          label: { zh: "\u7EAA\u5F8B", en: "Discipline" },
          icon: "\u{1F7E8}",
          stats: {
            foulsCommitted: { zh: "\u72AF\u89C4", en: "Fouls committed" },
            yellowCards: { zh: "\u9EC4\u724C", en: "Yellow cards" },
            redCards: { zh: "\u7EA2\u724C", en: "Red cards" }
          }
        }
      };
      function matchStatHasValue(value) {
        const parts = String(value ?? "").match(/\d+(?:\.\d+)?/g);
        return Boolean(parts?.some((part) => Number(part) !== 0));
      }
      function matchStatMagnitude(value) {
        const firstNumber = String(value ?? "").match(/\d+(?:\.\d+)?/);
        return firstNumber ? Number(firstNumber[0]) : 0;
      }
      function renderMatchStatComparison(stat, label) {
        const { esc, attr } = window.WorldCup.Utils;
        const i18nText = window.WorldCup.I18n?.i18nText || ((v, fb) => typeof v === "string" ? v : v?.zh || v?.en || fb || "");
        const homeValue = String(stat.home ?? "0");
        const awayValue = String(stat.away ?? "0");
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
        const { esc, tx } = window.WorldCup.Utils;
        const i18nText = window.WorldCup.I18n?.i18nText || ((v, fb) => typeof v === "string" ? v : v?.zh || v?.en || fb || "");
        const statsByName = new Map(teamStats.map((stat) => [stat.name, stat]));
        const groups = Object.values(MATCH_STAT_GROUPS).map((group) => {
          const rows = Object.entries(group.stats).map(([name, label]) => ({ stat: statsByName.get(name), label })).filter(({ stat }) => stat && (matchStatHasValue(stat.home) || matchStatHasValue(stat.away)));
          if (!rows.length) return "";
          return `<section class="pred-section mb-3 last:mb-0">
                <h4 class="pred-section-title text-blue-400">${group.icon} ${esc(i18nText(group.label))}</h4>
                ${rows.map(({ stat, label }) => renderMatchStatComparison(stat, label)).join("")}
            </section>`;
        }).join("");
        return groups || `<div class="text-gray-600 text-sm py-2">${tx("\u6682\u65E0\u6280\u672F\u7EDF\u8BA1", "No match statistics")}</div>`;
      }
      function renderRecentAvgComparison(hs, as, hName, aName) {
        const { esc, tx } = window.WorldCup.Utils;
        const i18nText = window.WorldCup.I18n?.i18nText || ((v, fb) => typeof v === "string" ? v : v?.zh || v?.en || fb || "");
        if (!hs && !as) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u8D5B\u524D\u6682\u65E0\u53EF\u7528\u7EDF\u8BA1", "No pre-match stats")}</div>`;
        const statDefs = [
          { key: "possessionPct", label: { zh: "\u63A7\u7403\u7387%", en: "Possession%" }, postfix: "%" },
          { key: "totalShots", label: { zh: "\u603B\u5C04\u95E8", en: "Total Shots" } },
          { key: "shotsOnTarget", label: { zh: "\u5C04\u6B63", en: "Shots on Target" } },
          { key: "passCompletionPct", label: { zh: "\u4F20\u7403\u6210\u529F\u7387%", en: "Pass Acc%" }, postfix: "%" },
          { key: "foulsCommitted", label: { zh: "\u72AF\u89C4", en: "Fouls" }, lowerIsBetter: true },
          { key: "yellowCards", label: { zh: "\u9EC4\u724C", en: "Yellow Cards" }, lowerIsBetter: true },
          { key: "redCards", label: { zh: "\u7EA2\u724C", en: "Red Cards" }, lowerIsBetter: true },
          { key: "offsides", label: { zh: "\u8D8A\u4F4D", en: "Offsides" }, lowerIsBetter: true },
          { key: "corners", label: { zh: "\u89D2\u7403", en: "Corners" } },
          { key: "saves", label: { zh: "\u6251\u6551", en: "Saves" } },
          { key: "tacklesWon", label: { zh: "\u6210\u529F\u62A2\u65AD", en: "Tackles Won" } },
          { key: "crosses", label: { zh: "\u4F20\u4E2D", en: "Crosses" } },
          { key: "goalsAgainst", label: { zh: "\u5931\u7403", en: "Goals Against" }, lowerIsBetter: true }
        ];
        const fmtVal = (key, sideData) => {
          const entry = (sideData?.stats || {})[key];
          if (!entry) return null;
          return { avg: entry.avg, count: entry.count };
        };
        const rows = statDefs.map((def) => {
          const hv = fmtVal(def.key, hs);
          const av = fmtVal(def.key, as);
          return { def, hv, av };
        }).filter((r) => r.hv || r.av);
        if (!rows.length) {
          return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u8D5B\u524D\u6682\u65E0\u53EF\u7528\u7EDF\u8BA1", "No pre-match stats")}</div>`;
        }
        const hSample = hs?.matches || 0;
        const aSample = as?.matches || 0;
        let html = "";
        html += `<div class="flex items-center gap-2 mb-3 text-[10px] text-gray-500">
            <span class="flex-1 truncate text-left font-medium text-gray-300">${esc(hName)} <span class="text-gray-500">(n=${hSample})</span></span>
            <span class="w-24 shrink-0 text-center font-bold text-gray-400">${tx("\u7EDF\u8BA1\u9879", "Stat")}</span>
            <span class="flex-1 truncate text-right font-medium text-gray-300">${esc(aName)} <span class="text-gray-500">(n=${aSample})</span></span>
        </div>`;
        for (const { def, hv, av } of rows) {
          const label = i18nText(def.label);
          const pfx = def.postfix || "";
          const hStr = hv ? hv.avg + pfx : "-";
          const aStr = av ? av.avg + pfx : "-";
          const hNum = hv ? hv.avg : 0;
          const aNum = av ? av.avg : 0;
          const total = hNum + aNum || 1;
          const hPct = Math.round(hNum / total * 100);
          const aPct = 100 - hPct;
          const lib = def.lowerIsBetter;
          html += `<div class="py-2.5 border-b border-white/5 last:border-b-0">
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="flex-1 text-xs font-mono font-bold tabular-nums text-left ${lib && hStr !== "-" ? "text-amber-300" : ""}">${esc(hStr)}</span>
                    <span class="w-24 shrink-0 text-center text-[10px] text-gray-500">${esc(label)}</span>
                    <span class="flex-1 text-right text-xs font-mono font-bold tabular-nums ${lib && aStr !== "-" ? "text-amber-300" : ""}">${esc(aStr)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500/70 rounded-full" style="width:${hPct}%"></div>
                    </div>
                    <div class="w-24 shrink-0"></div>
                    <div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-red-400/70 rounded-full ml-auto" style="width:${aPct}%"></div>
                    </div>
                </div>
            </div>`;
        }
        return html;
      }
      window.WorldCup.MatchStats = {
        MATCH_STAT_GROUPS,
        matchStatHasValue,
        matchStatMagnitude,
        renderMatchStatComparison,
        renderMatchStats,
        renderRecentAvgComparison
      };
      window.MATCH_STAT_GROUPS = MATCH_STAT_GROUPS;
      window.renderMatchStatComparison = renderMatchStatComparison;
      window.renderMatchStats = renderMatchStats;
      window.renderRecentAvgComparison = renderRecentAvgComparison;
    })();
  }
});

// static/js/scores.js
var require_scores = __commonJS({
  "static/js/scores.js"() {
    (function() {
      async function loadScores2() {
        const { tx, esc, displayMaybeTeamName, attr } = window.WorldCup.Utils;
        const t = window.t;
        const state = window.WorldCup.State;
        const res = await window.WorldCup.ApiClient.get("/api/scores");
        const d = res.data;
        const el = document.getElementById("live-list");
        if (!res.ok) {
          el.innerHTML = `<div style="text-align:center;padding:60px 0"><div style="font-size:40px;margin-bottom:10px">&#9888;&#65039;</div><p style="color:rgba(248,250,252,.3)">${res.isFailure ? tx("\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", "Failed to load, please retry") : esc(res.error || "")}</p></div>`;
          return;
        }
        const visibleMatches = d.matches || [];
        state._lastScoresMatches = visibleMatches;
        if (!visibleMatches.length) {
          el.innerHTML = `<div style="text-align:center;padding:60px 0"><div style="font-size:40px;margin-bottom:10px">&#128564;</div><p style="color:rgba(248,250,252,.3)">${esc(t("noMatchesToday"))}</p></div>`;
          const dateEl2 = document.getElementById("live-date");
          if (dateEl2) {
            const now = /* @__PURE__ */ new Date();
            dateEl2.textContent = now.toLocaleDateString(state.uiLang === "zh" ? "zh-CN" : "en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long"
            });
          }
          return;
        }
        const inMatches = visibleMatches.filter((m) => m.state === "in");
        const postMatches = visibleMatches.filter((m) => m.state === "post");
        const preMatches = visibleMatches.filter((m) => m.state === "pre");
        const sections = [];
        if (inMatches.length) {
          sections.push(sectionHeader("in", inMatches.length));
          sections.push(...inMatches.map((m) => liveCard(m)));
        }
        if (postMatches.length) {
          sections.push(sectionHeader("post", postMatches.length));
          sections.push(...postMatches.map((m) => doneCard(m)));
        }
        if (preMatches.length) {
          sections.push(sectionHeader("pre", preMatches.length));
          sections.push(...preMatches.map((m) => preCard(m)));
        }
        el.innerHTML = sections.join("");
        const badge = document.getElementById("live-count-badge");
        if (badge && inMatches.length > 0) {
          badge.querySelector("span").textContent = inMatches.length + " LIVE";
          badge.style.display = "flex";
        } else if (badge) {
          badge.style.display = "none";
        }
        const dateEl = document.getElementById("live-date");
        if (dateEl) {
          const now = /* @__PURE__ */ new Date();
          const dateStr = now.toLocaleDateString(state.uiLang === "zh" ? "zh-CN" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long"
          });
          dateEl.textContent = dateStr + " \xB7 ESPN";
        }
        loadTournamentStats();
        enrichMatchStats(visibleMatches);
        document.getElementById("update-time").textContent = t("updatePrefix") + (/* @__PURE__ */ new Date()).toLocaleTimeString(state.uiLang === "zh" ? "zh-CN" : "en-US", { timeZone: "Asia/Shanghai", hour12: false, hour: "2-digit", minute: "2-digit" });
      }
      function sectionHeader(type, count) {
        const { tx } = window.WorldCup.Utils;
        const labels = {
          in: tx("\u8FDB\u884C\u4E2D", "IN PROGRESS"),
          post: tx("\u4ECA\u65E5\u5DF2\u7ED3\u675F", "FINISHED TODAY"),
          pre: tx("\u5373\u5C06\u5F00\u59CB", "COMING UP")
        };
        const isLive = type === "in";
        return `<div class="section-label${isLive ? " section-label-live" : ""}">${isLive ? '<span class="dot"></span>' : ""}${labels[type]}</div>`;
      }
      function liveCard(m) {
        const { esc, attr, tx, displayMaybeTeamName } = window.WorldCup.Utils;
        const action = "open-match";
        let minute = "";
        if (m.status) {
          const minMatch = m.status.match(/(\d+)/);
          if (minMatch) minute = esc(minMatch[1]) + "'";
        }
        const groupInfo = esc(m.group || "");
        return `
        <div class="match-card-live" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || "")}" data-away-id="${attr(m.away.id || "")}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || "")}">
            <div class="accent-line"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div class="match-meta match-meta-live">${groupInfo}</div>
                <div class="live-badge">
                    <span class="dot"></span>
                    <span class="live-badge-text">${minute}</span>
                </div>
            </div>
            <div style="display:flex;align-items:center">
                <div style="flex:1;display:flex;align-items:center;gap:12px">
                    ${flagBadge(m.home, "home")}
                    <div>
                        <div class="team-name-live">${esc(displayMaybeTeamName(m.home))}</div>
                        <div class="scorer-text scorer-home"></div>
                    </div>
                </div>
                <div style="min-width:90px;text-align:center">
                    <div class="score-jumbo" style="animation:score-flash 4s ease-in-out infinite">${esc(m.home.score)}<span class="score-sep">:</span>${esc(m.away.score)}</div>
                </div>
                <div style="flex:1;display:flex;align-items:center;gap:12px;justify-content:flex-end">
                    <div style="text-align:right">
                        <div class="team-name-live">${esc(displayMaybeTeamName(m.away))}</div>
                        <div class="scorer-text scorer-away"></div>
                    </div>
                    ${flagBadge(m.away, "away")}
                </div>
            </div>
            <div class="stats-strip">
                <div class="stat-item">
                    <span class="stat-label">${tx("\u63A7\u7403", "Poss")}</span>
                    <div class="possession-bar"><div class="possession-home" data-stat="poss-h" style="width:50%"></div><div class="possession-away" data-stat="poss-a" style="width:50%"></div></div>
                    <span class="stat-val" data-stat="poss">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">${tx("\u5C04\u95E8", "Shots")}</span>
                    <span class="stat-val" data-stat="shots">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">xG</span>
                    <span class="stat-val" data-stat="xg">--</span>
                </div>
            </div>
            ${probBarHTML(m)}
        </div>`;
      }
      function doneCard(m) {
        const { esc, attr, tx, displayMaybeTeamName } = window.WorldCup.Utils;
        const action = "open-match";
        const groupInfo = esc(m.group || "");
        return `
        <div class="match-card-done" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || "")}" data-away-id="${attr(m.away.id || "")}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || "")}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div class="match-meta match-meta-done">${groupInfo}</div>
                <div class="ft-badge">FT</div>
            </div>
            <div style="display:flex;align-items:center">
                <div style="flex:1;display:flex;align-items:center;gap:12px">
                    ${flagBadge(m.home, "neutral")}
                    <div>
                        <div class="team-name-dim">${esc(displayMaybeTeamName(m.home))}</div>
                        <div class="scorer-text scorer-dim"></div>
                    </div>
                </div>
                <div style="min-width:90px;text-align:center">
                    <div class="score-jumbo score-dim">${esc(m.home.score)}<span class="score-sep">:</span>${esc(m.away.score)}</div>
                </div>
                <div style="flex:1;display:flex;align-items:center;gap:12px;justify-content:flex-end">
                    <div style="text-align:right">
                        <div class="team-name-dim">${esc(displayMaybeTeamName(m.away))}</div>
                        <div class="scorer-text scorer-dim"></div>
                    </div>
                    ${flagBadge(m.away, "neutral")}
                </div>
            </div>
            <div class="stats-strip-dim" style="justify-content: space-between;">
                <div class="stat-item" style="color:rgba(248,250,252,.35)">
                    <span class="stat-val-dim" data-stat="combined" style="font-size:10px;">Poss -- / Shots --</span>
                </div>
                <div class="stat-item">
                    <span style="font:300 8px/1 'Inter';color:rgba(248,250,252,.1)">${esc(m.venue || "")}</span>
                </div>
            </div>
        </div>`;
      }
      function preCard(m) {
        const { esc, attr, tx, displayMaybeTeamName } = window.WorldCup.Utils;
        const action = "open-match";
        const groupInfo = esc(m.group || "");
        const timeText = (() => {
          const raw = String(m.timeBJT || m.dateBJT || "").trim();
          if (!raw) return "";
          const parts = raw.split(/\s+/);
          return (parts.length > 1 ? parts[1] : parts[0]).substring(0, 5);
        })();
        const homeEloVal = m.home.elo || m.home.rank || "";
        const awayEloVal = m.away.elo || m.away.rank || "";
        const homeRank = homeEloVal ? "ELO " + homeEloVal : "";
        const awayRank = awayEloVal ? "ELO " + awayEloVal : "";
        return `
        <div class="match-card-pre" data-action="${action}" data-match-id="${attr(m.id)}" data-home-id="${attr(m.home.id || "")}" data-away-id="${attr(m.away.id || "")}" data-home-name="${attr(m.home.name)}" data-away-name="${attr(m.away.name)}" data-venue-name="${attr(m.venue || "")}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div class="match-meta match-meta-pre">${groupInfo}</div>
                <div class="time-badge">${esc(timeText)} CST</div>
            </div>
            <div style="display:flex;align-items:center">
                <div style="flex:1;display:flex;align-items:center;gap:12px">
                    ${flagBadge(m.home, "neutral")}
                    <div>
                        <div class="team-name-pre">${esc(displayMaybeTeamName(m.home))}</div>
                        ${homeRank ? `<div class="elo-label">${homeRank}</div>` : ""}
                    </div>
                </div>
                <div style="min-width:90px;text-align:center">
                    <div style="font:300 18px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">&mdash; : &mdash;</div>
                </div>
                <div style="flex:1;display:flex;align-items:center;gap:12px;justify-content:flex-end">
                    <div style="text-align:right">
                        <div class="team-name-pre">${esc(displayMaybeTeamName(m.away))}</div>
                        ${awayRank ? `<div class="elo-label">${awayRank}</div>` : ""}
                    </div>
                    ${flagBadge(m.away, "neutral")}
                </div>
            </div>
            ${probBarHTML(m)}
            ${m.venue ? `
            <div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.03)">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L8 4L5 7" stroke="rgba(248,250,252,.15)" stroke-width=".8"></path><circle cx="5" cy="9" r=".8" fill="rgba(248,250,252,.1)"></circle></svg>
                <span class="venue-text">${esc(m.venue)}</span>
            </div>` : ""}
            <div class="stats-strip-dim h2h-strip" style="justify-content: space-between; margin-top: 10px;">
                <div class="stat-item" style="color:rgba(248,250,252,.35)">
                    <span class="stat-val-dim" data-stat="h2h" data-loaded="false" style="font-size:10px;">${tx("\u4EA4\u950B\u8BB0\u5F55\u52A0\u8F7D\u4E2D...", "Loading H2H...")}</span>
                </div>
            </div>
        </div>`;
      }
      function flagBadge(team, type) {
        const { esc, attr } = window.WorldCup.Utils;
        const cls = type === "home" ? "flag-badge-home" : type === "away" ? "flag-badge-away" : "flag-badge-neutral";
        if (team.logo) {
          return `<div class="flag-badge ${cls}" style="background-image:url(${attr(team.logo)});background-size:contain;background-position:center;background-repeat:no-repeat;background-color:rgba(255,255,255,.05)"></div>`;
        }
        if (team.flag) {
          return `<div class="flag-badge ${cls}">${esc(team.flag)}</div>`;
        }
        const initial = (team.abbr || team.name || "?").charAt(0).toUpperCase();
        return `<div class="flag-badge ${cls}" style="font:500 14px/1 'Inter'">${esc(initial)}</div>`;
      }
      function probBarHTML(m) {
        const hw = m.homeWin || 0, dr = m.draw || 0, aw = m.awayWin || 0;
        if (!hw && !dr && !aw) return "";
        const { tx } = window.WorldCup.Utils;
        return `
            <div class="prob-strip">
                <div class="prob-home" style="width:${hw}%"></div>
                <div class="prob-draw" style="width:${dr}%"></div>
                <div class="prob-away" style="width:${aw}%"></div>
            </div>
            <div class="prob-label-strip">
                <span class="prob-label-home">${hw}% ${tx("\u4E3B\u80DC", "WIN")}</span>
                <span class="prob-label-draw">${dr}% ${tx("\u5E73\u5C40", "DRAW")}</span>
                <span class="prob-label-away">${aw}% ${tx("\u5BA2\u80DC", "WIN")}</span>
            </div>`;
      }
      async function loadTournamentStats() {
        const { tx, esc } = window.WorldCup.Utils;
        const container = document.getElementById("tournament-stats");
        const inner = document.getElementById("tournament-stats-inner");
        if (!container || !inner) return;
        try {
          const res = await window.WorldCup.ApiClient.get("/api/tournament-stats");
          if (!res.ok || !res.data) {
            container.style.display = "none";
            return;
          }
          const d = res.data;
          const played = d.played ?? d.matchesPlayed ?? "--";
          const items = [
            { label: tx("\u5DF2\u8D5B", "Played"), value: played, icon: "\u26BD" },
            { label: tx("\u603B\u8FDB\u7403", "Goals"), value: d.totalGoals ?? "--", icon: "\u{1F945}" },
            { label: tx("\u573A\u5747", "Avg"), value: d.avgGoals != null ? Number(d.avgGoals).toFixed(1) : "--", icon: "\u{1F4CA}" },
            { label: tx("\u9EC4\u724C", "Yellows"), value: d.yellowCards ?? "--", icon: "\u{1F7E8}" },
            { label: tx("\u7EA2\u724C", "Reds"), value: d.redCards ?? "--", icon: "\u{1F7E5}" }
          ];
          inner.innerHTML = items.map((it) => `
                <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:8px;white-space:nowrap;flex-shrink:0">
                    <span style="font-size:12px">${it.icon}</span>
                    <span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.25)">${it.label}</span>
                    <span style="font:600 13px/1 'JetBrains Mono', monospace;color:#f8fafc">${esc(String(it.value))}</span>
                </div>
            `).join("");
          container.style.display = "block";
        } catch {
          container.style.display = "none";
        }
      }
      async function enrichMatchStats(matches) {
        const targets = matches.filter((m) => m.state === "in" || m.state === "post");
        if (!targets.length) return;
        const ids = targets.map((m) => m.id).join(",");
        const res = await window.WorldCup.ApiClient.get("/api/matches/batch?ids=" + ids);
        if (!res.ok || !res.data) return;
        const matchMap = {};
        for (const m of res.data.matches || []) matchMap[m.id] = m;
        targets.forEach((target) => {
          const data = matchMap[target.id];
          if (!data) return;
          const card2 = document.querySelector('[data-match-id="' + target.id + '"]');
          if (!card2) return;
          const stats = {};
          for (const s of data.teamStats || []) {
            const n = (s.name || "").toLowerCase();
            const h = (s.home || "").replace("%", "");
            const a = (s.away || "").replace("%", "");
            if (n.includes("poss")) stats.poss = { h: parseInt(h) || 50, a: parseInt(a) || 50 };
            else if (n.includes("shot") && !n.includes("target") && !n.includes("block")) {
              if (!stats.shots) stats.shots = { h: s.home, a: s.away };
            } else if (n.includes("expect") || n === "xg") stats.xg = { h: s.home, a: s.away };
          }
          if (stats.poss || stats.shots) {
            const combE = card2.querySelector('[data-stat="combined"]');
            if (combE) {
              const possStr = stats.poss ? stats.poss.h + "%-" + stats.poss.a + "%" : "--";
              const shotsStr = stats.shots ? stats.shots.h + "-" + stats.shots.a : "--";
              combE.textContent = `Poss ${possStr} / Shots ${shotsStr}`;
            }
          }
          if (stats.poss) {
            const pe = card2.querySelector('[data-stat="poss"]');
            const ph = card2.querySelector('[data-stat="poss-h"]');
            const pa = card2.querySelector('[data-stat="poss-a"]');
            if (pe) pe.textContent = stats.poss.h + "%-" + stats.poss.a + "%";
            if (ph) ph.style.width = stats.poss.h + "%";
            if (pa) pa.style.width = stats.poss.a + "%";
          }
          if (stats.shots) {
            const se = card2.querySelector('[data-stat="shots"]');
            if (se) se.textContent = stats.shots.h + "-" + stats.shots.a;
          }
          if (stats.xg) {
            const xe = card2.querySelector('[data-stat="xg"]');
            if (xe) xe.textContent = stats.xg.h + ":" + stats.xg.a;
          }
        });
      }
      async function enrichPreMatchStats(matches) {
        const { tx } = window.WorldCup.Utils;
        const targets = matches.filter((m) => m.state === "pre");
        if (!targets.length) return;
        targets.forEach(async (target) => {
          const card2 = document.querySelector(`[data-match-id="${target.id}"]`);
          if (!card2) return;
          const combE = card2.querySelector('[data-stat="h2h"]');
          if (!combE || combE.dataset.loaded === "true") return;
          try {
            const res = await window.WorldCup.ApiClient.get(`/api/h2h/${target.id}`);
            if (!res.ok || !res.data || !res.data.summary) return;
            const s = res.data.summary;
            if (s.totalMatches === 0) {
              combE.textContent = tx("\u65E0\u5386\u53F2\u4EA4\u950B\u8BB0\u5F55", "No Historical H2H");
            } else {
              combE.textContent = tx(`\u5386\u53F2\u6218\u7EE9: ${s.homeWins}\u80DC ${s.draws}\u5E73 ${s.awayWins}\u8D1F`, `H2H: ${s.homeWins}W ${s.draws}D ${s.awayWins}L`);
            }
            combE.dataset.loaded = "true";
          } catch (e) {
            console.error("[H2H] Fetch failed:", e);
          }
        });
      }
      function card(m) {
        if (m.state === "in") return liveCard(m);
        if (m.state === "post") return doneCard(m);
        return preCard(m);
      }
      window.WorldCup.Scores = {
        loadScores: loadScores2,
        loadTournamentStats,
        liveCard,
        doneCard,
        preCard,
        card,
        flagBadge
      };
      window.loadScores = loadScores2;
      window.card = card;
      window.logo = flagBadge;
    })();
  }
});

// static/js/schedule.js
var require_schedule = __commonJS({
  "static/js/schedule.js"() {
    (function() {
      async function loadSchedule2() {
        const { tx, esc, attr } = window.WorldCup.Utils;
        const t = window.t;
        const state = window.WorldCup.State;
        if (state.scheduleLoaded) return;
        if (state.scheduleLoadPromise) {
          try {
            await state.scheduleLoadPromise;
          } catch (e) {
          }
          return;
        }
        const doLoad = async () => {
          const res = await window.WorldCup.ApiClient.get("/api/schedule");
          if (!res.ok || !res.data?.matches) {
            document.getElementById("schedule-list").innerHTML = `<div class="text-center py-10 text-gray-500">${tx("\u8D5B\u7A0B\u52A0\u8F7D\u5931\u8D25", "Failed to load schedule")}</div>`;
            state.scheduleLoaded = false;
            throw new Error("Failed to load schedule");
          }
          const matchMap = /* @__PURE__ */ new Map();
          state.scheduleCache.forEach((m) => matchMap.set(String(m.id), m));
          res.data.matches.forEach((m) => matchMap.set(String(m.id), Object.assign(matchMap.get(String(m.id)) || {}, m)));
          state.scheduleCache = Array.from(matchMap.values());
          state.scheduleLoaded = true;
        };
        state.scheduleLoadPromise = doLoad().finally(() => {
          state.scheduleLoadPromise = null;
        });
        try {
          await state.scheduleLoadPromise;
        } catch (e) {
          return;
        }
        const byDate = {};
        state.scheduleCache.forEach((m) => {
          const dt = m.dateBJT?.split(" ")[0] || "?";
          (byDate[dt] ?? (byDate[dt] = [])).push(m);
        });
        const dates = Object.keys(byDate).sort();
        const nowMs = Date.now();
        const tzStr = { timeZone: "Asia/Shanghai" };
        const getMMDD = (ms) => {
          const parts = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", ...tzStr }).formatToParts(new Date(ms));
          const mVal = parts.find((p) => p.type === "month").value;
          const dVal = parts.find((p) => p.type === "day").value;
          return { mmdd: `${mVal}/${dVal}`, month: mVal, day: dVal };
        };
        const getWeekdayShort = (ms) => {
          return new Intl.DateTimeFormat(state.uiLang === "zh" ? "zh-CN" : "en-US", { weekday: "short", ...tzStr }).format(new Date(ms));
        };
        const todayInfo = getMMDD(nowMs);
        const yesterdayInfo = getMMDD(nowMs - 864e5);
        const todayStr = todayInfo.mmdd;
        const yesterdayStr = yesterdayInfo.mmdd;
        let defaultDate = dates[dates.length - 1];
        document.getElementById("date-bar").innerHTML = dates.map((d, i) => {
          const n = byDate[d].length;
          const parts = d.split("/");
          const month = parts[0] || "";
          const day = parts[1] || "";
          let isToday = d === todayStr;
          let isYesterday = d === yesterdayStr;
          let specialLabel = "";
          let extraCls = "text-slate-500 hover:text-slate-300";
          if (isToday) {
            specialLabel = state.uiLang === "zh" ? "\u4ECA\u5929" : "Today";
            extraCls = "bg-emerald-500/8 text-emerald-400 border border-emerald-500/15";
            defaultDate = d;
          } else if (isYesterday) {
            specialLabel = state.uiLang === "zh" ? "\u6628\u5929" : "Yest.";
            extraCls = "bg-white/5 text-slate-400 border border-white/5";
            if (!dates.includes(todayStr)) defaultDate = d;
          }
          const monthMap = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" };
          const enMonth = monthMap[month] || month;
          const monthStr = state.uiLang === "zh" ? month + "\u6708" : enMonth;
          const matchCountStr = state.uiLang === "zh" ? n + "\u573A" : n + " M";
          return `<button data-d="${attr(d)}" data-action="filter-date" data-date="${attr(d)}"
                class="date-btn snap-center shrink-0 flex flex-col items-center justify-center min-w-[52px] px-2.5 py-2 rounded-lg transition-all duration-150
                ${extraCls}" style="min-width:52px;min-height:44px">
                <span style="font:400 9px/1 'Inter'">${specialLabel ? esc(specialLabel) : monthStr}</span>
                <span style="font:600 16px/1 'JetBrains Mono', monospace">${esc(day)}</span>
                <span style="font:400 8px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">${matchCountStr}</span>
            </button>`;
        }).join("");
        if (dates.length) {
          const selectionDate = dates.includes(todayStr) ? todayStr : defaultDate;
          filterDate2(selectionDate);
          setTimeout(() => {
            const db2 = document.getElementById("date-bar");
            const targetBtn = db2.querySelector(`[data-d="${yesterdayStr}"]`) || db2.querySelector(`[data-d="${todayStr}"]`);
            if (targetBtn && db2) {
              const targetLeft = targetBtn.offsetLeft - db2.offsetLeft - 16;
              db2.scrollTo({ left: targetLeft, behavior: "smooth" });
            }
          }, 100);
        }
        const db = document.getElementById("date-bar");
        if (db && !db.dataset.wheelBound) {
          db.dataset.wheelBound = "true";
          db.addEventListener("wheel", (e) => {
            if (e.deltaY !== 0) {
              e.preventDefault();
              db.scrollLeft += e.deltaY;
            }
          });
          document.getElementById("date-scroll-left")?.addEventListener("click", () => {
            db.scrollBy({ left: -150, behavior: "smooth" });
          });
          document.getElementById("date-scroll-right")?.addEventListener("click", () => {
            db.scrollBy({ left: 150, behavior: "smooth" });
          });
        }
      }
      function filterDate2(d) {
        const state = window.WorldCup.State;
        const { tx } = window.WorldCup.Utils;
        document.querySelectorAll(".date-btn").forEach((b) => {
          b.style.background = "";
          b.style.border = "";
          b.style.color = "";
        });
        const activeBtn = document.querySelector(`[data-d="${CSS.escape(d)}"]`);
        if (activeBtn) {
          activeBtn.style.background = "rgba(52,211,153,.08)";
          activeBtn.style.border = "1px solid rgba(52,211,153,.15)";
          activeBtn.style.color = "#34d399";
        }
        const list = state.scheduleCache.filter((m) => m.dateBJT?.startsWith(d));
        const dateHeaderEl = document.getElementById("date-header");
        if (dateHeaderEl) {
          const parts = d.split("/");
          const month = parseInt(parts[0], 10) - 1;
          const day = parseInt(parts[1], 10);
          const year = (/* @__PURE__ */ new Date()).getFullYear();
          const dateObj = new Date(year, month, day);
          const lang = state.uiLang === "zh" ? "zh-CN" : "en-US";
          const weekday = new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "Asia/Shanghai" }).format(dateObj);
          const fullDate = new Intl.DateTimeFormat(lang, { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Shanghai" }).format(dateObj);
          const n = list.length;
          const matchLabel = state.uiLang === "zh" ? `${n} \u573A\u6BD4\u8D5B` : `${n} MATCH${n !== 1 ? "ES" : ""}`;
          dateHeaderEl.textContent = `${weekday} \xB7 ${fullDate} \xB7 ${matchLabel}`;
        }
        document.getElementById("schedule-list").innerHTML = list.map((m) => window.WorldCup.Scores.card(m)).join("");
      }
      window.WorldCup.Schedule = {
        loadSchedule: loadSchedule2,
        filterDate: filterDate2
      };
      window.loadSchedule = loadSchedule2;
      window.filterDate = filterDate2;
    })();
  }
});

// static/js/standings.js
var require_standings = __commonJS({
  "static/js/standings.js"() {
    (function() {
      let standingsData = null;
      function switchStandingsSubTab(tab, btn) {
        const groupsContent = document.getElementById("standings-sub-groups-content");
        const knockoutContent = document.getElementById("standings-sub-knockout-content");
        const scorersContent = document.getElementById("standings-sub-scorers-content");
        if (groupsContent) groupsContent.classList.add("hidden");
        if (knockoutContent) knockoutContent.classList.add("hidden");
        if (scorersContent) scorersContent.classList.add("hidden");
        document.querySelectorAll('[data-action="switch-standings-sub-tab"]').forEach((b) => {
          b.classList.remove("tab-on");
          b.setAttribute("aria-selected", "false");
          b.style.color = "rgba(248,250,252,.3)";
        });
        if (tab === "knockout") {
          if (knockoutContent) knockoutContent.classList.remove("hidden");
        } else if (tab === "scorers") {
          if (scorersContent) scorersContent.classList.remove("hidden");
        } else {
          if (groupsContent) groupsContent.classList.remove("hidden");
        }
        if (btn) {
          btn.classList.add("tab-on");
          btn.setAttribute("aria-selected", "true");
          btn.style.color = "#f8fafc";
        }
        if (tab === "knockout" && window.WorldCup.Utils) {
          const container = document.getElementById("bracket-container-standings");
          if (container && !container.querySelector("#bk-wrap")) {
            fetch("/api/bracket").then((r) => r.json()).then((data) => {
              if (container && data && !data.error && window.renderBracket) {
                container.innerHTML = "";
                window.renderBracket(data, container);
                setTimeout(() => {
                  const wrap = container.querySelector("#bk-wrap");
                  if (wrap) container.scrollLeft = (wrap.scrollWidth - container.clientWidth) / 2;
                }, 100);
              }
            }).catch(() => {
              const t = window.t;
              if (container) container.innerHTML = `<div class="text-gray-500 py-10">${t ? t("\u6DD8\u6C70\u8D5B\u5BF9\u9635\u56FE\u5C06\u5728\u5C0F\u7EC4\u8D5B\u7ED3\u675F\u540E\u751F\u6210", "Knockout bracket will be generated after group stage.") : "\u6DD8\u6C70\u8D5B\u5BF9\u9635\u56FE\u5C06\u5728\u5C0F\u7EC4\u8D5B\u7ED3\u675F\u540E\u751F\u6210"}</div>`;
            });
          }
        }
        if (tab === "scorers" && scorersContent) {
          if (scorersContent.querySelector(".text-gray-500") || scorersContent.innerHTML.trim() === "") {
            scorersContent.innerHTML = `<div class="text-center py-10 text-gray-500">${window.WorldCup.Utils.tx("\u52A0\u8F7D\u5C04\u624B\u699C...", "Loading scorers...")}</div>`;
            window.WorldCup.ApiClient.get("/api/tournament-stats").then((res) => {
              if (res.ok && res.data?.topScorers) {
                scorersContent.innerHTML = renderTopScorers(res.data.topScorers);
              } else {
                scorersContent.innerHTML = `<div class="text-center py-10 text-gray-500">${window.WorldCup.Utils.tx("\u5C04\u624B\u699C\u6570\u636E\u6682\u65E0", "No scorer data available")}</div>`;
              }
            }).catch(() => {
              scorersContent.innerHTML = `<div class="text-center py-10 text-gray-500">${window.WorldCup.Utils.tx("\u5C04\u624B\u699C\u52A0\u8F7D\u5931\u8D25", "Failed to load scorers")}</div>`;
            });
          }
        }
      }
      function renderTopScorers(scorers) {
        const { esc, tx, attr } = window.WorldCup.Utils;
        const playerZh = (name) => (window.WorldCup.I18n?.translatePlayerName || ((n) => n))(name);
        if (!scorers.length) return `<div class="text-center py-10 text-gray-500">${tx("\u6682\u65E0\u5C04\u624B\u6570\u636E", "No scorer data")}</div>`;
        let html = "";
        scorers.slice(0, 20).forEach((p, i) => {
          const rank = i + 1;
          const nameZh = playerZh(p.name);
          const rankColor = rank <= 3 ? "#34d399" : "rgba(248,250,252,.3)";
          const clickable = p.athleteId || p.teamEspnId ? ` data-action="open-player-detail" data-player-id="${attr(p.athleteId || "")}" data-team-id="${attr(p.teamEspnId || "")}" data-player-name="${attr(p.name)}" style="cursor:pointer"` : "";
          html += `<div class="schedule-row"${clickable}>
                <span style="font:600 13px/1 'JetBrains Mono', monospace;color:${rankColor};min-width:24px;text-align:center">${rank}</span>
                <span style="font-size:18px;flex-shrink:0">${p.flag || "\u{1F3F3}\uFE0F"}</span>
                <div style="flex:1;min-width:0;overflow:hidden">
                    <div style="font:500 12px/1 'Inter';color:rgba(248,250,252,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nameZh)}</div>
                    <div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.3);margin-top:2px">${esc(p.team)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <div style="font:700 18px/1 'JetBrains Mono', monospace;color:#34d399">${p.goals}</div>
                    <div style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.2);margin-top:2px">${tx("\u7403", " goals")}</div>
                </div>
            </div>`;
        });
        return html;
      }
      async function loadStandings2() {
        const { esc, tx, displayGroupName, displayMaybeTeamName, attr } = window.WorldCup.Utils;
        const t = window.t;
        const container = document.getElementById("standings-sub-groups-content");
        container.innerHTML = `<div class="text-center py-10 text-gray-500">${tx("\u52A0\u8F7D\u79EF\u5206\u699C...", "Loading table...")}</div>`;
        const res = await window.WorldCup.ApiClient.get("/api/standings");
        if (!res.ok || !res.data?.groups) {
          container.innerHTML = `<div class="text-center py-10 text-red-400">${tx("\u79EF\u5206\u699C\u52A0\u8F7D\u5931\u8D25", "Table failed to load")}</div>`;
          return;
        }
        const d = res.data;
        let html = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">` + d.groups.map((g) => `
            <div style="background:rgba(15,23,42,.4);backdrop-filter:blur(48px);-webkit-backdrop-filter:blur(48px);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)">
                <div style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:space-between">
                    <span style="font:600 11px/1 'DM Sans',sans-serif;color:rgba(248,250,252,.5);letter-spacing:.5px">${esc(displayGroupName(g.name))}</span>
                    <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">MD ${g.matchday !== void 0 ? g.matchday : 0}/3</span>
                </div>
                <table style="width:100%;table-layout:fixed;font-size:12px;border-collapse:separate;border-spacing:0">
                    <colgroup>
                        <col style="width:26px">
                        <col>
                        <col style="width:28px">
                        <col style="width:28px">
                        <col style="width:28px">
                        <col style="width:30px">
                        <col style="width:36px">
                    </colgroup>
                    <thead><tr style="font:400 8px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.2);border-bottom:1px solid rgba(255,255,255,.04)">
                        <th style="text-align:left;padding:6px 4px 6px 14px">#</th>
                        <th style="text-align:left;padding:6px 4px">${tx("\u7403\u961F", "Team")}</th>
                        <th style="text-align:center;padding:6px 4px">${tx("\u80DC", "W")}</th>
                        <th style="text-align:center;padding:6px 4px">${tx("\u5E73", "D")}</th>
                        <th style="text-align:center;padding:6px 4px">${tx("\u8D1F", "L")}</th>
                        <th style="text-align:center;padding:6px 4px">${tx("\u51C0", "GD")}</th>
                        <th style="text-align:right;padding:6px 12px 6px 4px;font-weight:600">${tx("\u5206", "Pts")}</th>
                    </tr></thead>
                    <tbody>${g.standings.map((row, i) => {
          const isQ1 = i === 0;
          const isQ2 = i === 1;
          const borderColor = isQ1 ? "rgba(52,211,153,.35)" : isQ2 ? "rgba(52,211,153,.18)" : "transparent";
          const ptsColor = isQ1 || isQ2 ? "#34d399" : "rgba(59,130,246,.6)";
          return `
                        <tr style="border-left:2px solid ${borderColor};border-bottom:1px solid rgba(255,255,255,.03)">
                            <td style="padding:6px 4px 6px 12px;font:400 11px/1 'JetBrains Mono', monospace;color:${isQ1 ? "rgba(52,211,153,.5)" : "rgba(248,250,252,.2)"}">${i + 1}</td>
                            <td style="padding:6px 4px"><div style="display:flex;align-items:center;gap:6px;overflow:hidden">
                                ${row.logo ? `<img src="${attr(row.logo)}" style="width:14px;height:14px;object-fit:contain;flex-shrink:0;border-radius:2px" onerror="this.style.display='none'">` : ""}
                                <span style="font:400 11px/1 'Inter';color:rgba(248,250,252,.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" data-action="open-team-detail" data-team-id="${attr(row.id)}" data-team-name="${attr(row.name)}" data-group="${attr(g.name)}">${esc(displayMaybeTeamName(row))}</span>
                            </div></td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.4)">${row.wins}</td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.4)">${row.draws}</td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.4)">${row.losses}</td>
                            <td style="text-align:center;padding:6px 4px;font:400 11px/1 'JetBrains Mono', monospace;color:${+row.gd > 0 ? "rgba(52,211,153,.5)" : +row.gd < 0 ? "rgba(248,113,113,.3)" : "rgba(248,250,252,.2)"}">${+row.gd >= 0 ? "+" : ""}${row.gd}</td>
                            <td style="text-align:right;padding:6px 12px 6px 4px;font:600 12px/1 'JetBrains Mono', monospace;color:${ptsColor}">${row.pts}</td>
                        </tr>`;
        }).join("")}
                    </tbody>
                </table>
            </div>
        `).join("") + `</div>`;
        html += `<div style="display:flex;align-items:center;gap:12px;margin-top:12px;font:400 9px/1 'Inter';color:rgba(248,250,252,.2)">
            <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:2px;border-radius:1px;background:rgba(52,211,153,.35)"></div> ${tx("\u5DF2\u664B\u7EA7", "Qualified")}</div>
            <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:2px;border-radius:1px;background:rgba(52,211,153,.18)"></div> ${tx("\u6709\u671B\u664B\u7EA7", "Likely qualified")}</div>
        </div>`;
        container.innerHTML = html;
      }
      document.addEventListener("click", (e) => {
        const card = e.target.closest('[data-action="open-match-from-bracket"]');
        if (!card) return;
        const matchId = card.dataset.matchId;
        if (!matchId) return;
        const openFn = window.WorldCup.MatchDetail?.open || window.WorldCup.MatchDetail?.openMatch || window.openMatch || window.openMatchDetail;
        if (openFn) {
          openFn(matchId);
        }
      });
      window.WorldCup.Standings = { loadStandings: loadStandings2, switchStandingsSubTab };
      window.loadStandings = loadStandings2;
      window.switchStandingsSubTab = switchStandingsSubTab;
      window.renderTopScorers = renderTopScorers;
    })();
  }
});

// static/js/match-detail.js
var require_match_detail = __commonJS({
  "static/js/match-detail.js"() {
    (function() {
      const { tx, esc, displayMaybeTeamName, attr, api } = window.WorldCup.Utils;
      const t = window.t;
      const state = window.WorldCup.State;
      const MR = () => window.WorldCup.MatchRenderers;
      let _openMatchReqId = 0;
      async function openMatch(id) {
        const myReqId = ++_openMatchReqId;
        const modal = document.getElementById("match-modal");
        const content = document.getElementById("modal-content");
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        content.innerHTML = `<div class="py-10 text-center text-gray-500">${tx("\u52A0\u8F7D\u4E2D...", "Loading...")}</div>`;
        const [matchData2, matchupData] = await window.WorldCup.ApiClient.allData([
          "/api/match/" + id,
          "/api/matchup/" + id + "/formation"
        ]);
        if (!matchData2) {
          content.innerHTML = `<div class="py-10 text-center text-red-400">${tx("\u52A0\u8F7D\u5931\u8D25", "Failed to load")}</div>`;
          return;
        }
        const scheduledMatch = state.scheduleCache.find((m) => String(m.id) === String(id)) || {};
        const isFinishedMatch = scheduledMatch.state === "post" || matchData2.state === "post";
        const isLive = matchData2.state === "in";
        const knownVenue = scheduledMatch.venue || matchData2.venue || "";
        const mHomeId = scheduledMatch.home?.id || matchData2.home?.id || matchData2.homeId;
        const mAwayId = scheduledMatch.away?.id || matchData2.away?.id || matchData2.awayId;
        const homeName = displayMaybeTeamName(scheduledMatch.home?.nameI18n || scheduledMatch.home?.name || matchData2.home?.nameI18n || matchData2.home?.name || "");
        const awayName = displayMaybeTeamName(scheduledMatch.away?.nameI18n || scheduledMatch.away?.name || matchData2.away?.nameI18n || matchData2.away?.name || "");
        const homeScore = matchData2.home?.score ?? "-";
        const awayScore = matchData2.away?.score ?? "-";
        const homeElo = matchData2.home?.elo || matchData2.elo?.home || "";
        const awayElo = matchData2.away?.elo || matchData2.elo?.away || "";
        const homeFormation = matchupData?.home?.formation || "4-3-3";
        const awayFormation = matchupData?.away?.formation || "4-3-3";
        if (matchupData?.home && !matchupData.home.players) {
          matchupData.home.players = [...matchupData.home.gk || [], ...matchupData.home.def || [], ...matchupData.home.mid || [], ...matchupData.home.fwd || []];
        }
        if (matchupData?.away && !matchupData.away.players) {
          matchupData.away.players = [...matchupData.away.gk || [], ...matchupData.away.def || [], ...matchupData.away.mid || [], ...matchupData.away.fwd || []];
        }
        const groupLabel = scheduledMatch.group || matchData2.group || "";
        const mdLabel = scheduledMatch.matchday || matchData2.matchday || "?";
        const topbarInfo = document.getElementById("hud-topbar-info");
        if (topbarInfo) topbarInfo.textContent = groupLabel ? `${groupLabel} \xB7 MD ${mdLabel}/3` : "";
        let html = "";
        const homeLogo = scheduledMatch.home?.logo || matchData2.home?.logo || "";
        const awayLogo = scheduledMatch.away?.logo || matchData2.away?.logo || "";
        const homeFlag = scheduledMatch.home?.flag || "\u{1F3F3}\uFE0F";
        const awayFlag = scheduledMatch.away?.flag || "\u{1F3F3}\uFE0F";
        const st = matchData2.liveState?.state || (isLive ? "match" : isFinishedMatch ? "end" : "pre");
        const stLabel = matchData2.liveState?.label || (st === "end" ? matchData2.hasPenalties ? tx("\u70B9\u7403\u51B3\u51FA", "FT-Pens") : "FT" : st === "match" ? "LIVE" : tx("\u5F85\u8D5B", "TBD"));
        const stBadgeStyles = {
          pre: "font:400 10px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.4);margin-top:8px",
          match: "display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 12px;border-radius:8px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.12);font:500 9px/1 'JetBrains Mono',monospace;color:#34d399",
          ht: "display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 12px;border-radius:8px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.2);font:500 9px/1 'JetBrains Mono',monospace;color:#fbbf24",
          et: "display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 12px;border-radius:8px;background:rgba(168,85,247,.1);border:1px solid rgba(168,85,247,.2);font:500 9px/1 'JetBrains Mono',monospace;color:#c084fc",
          pen: "display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 12px;border-radius:8px;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.2);font:500 9px/1 'JetBrains Mono',monospace;color:#fb7185",
          end: "font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.3);margin-top:8px"
        };
        const stPulse = st === "match" ? '<div style="width:5px;height:5px;border-radius:50%;background:#34d399;animation:pulse-live 1.8s ease-in-out infinite"></div>' : "";
        const scoreBadgeHtml = `<div style="${stBadgeStyles[st] || stBadgeStyles.pre}">${stPulse}<span>${esc(stLabel)}</span></div>`;
        html += `<div id="hud-score" style="display:flex;align-items:center;justify-content:center;padding:24px 24px 16px;gap:20px">
            <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:16px">
                <div style="text-align:right">
                    <div style="font:500 22px/1 'Inter';color:#f8fafc">${esc(homeName)}</div>
                    <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:4px">
                        ${homeElo ? `<span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.45)">ELO ${homeElo}</span><span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.12)">|</span>` : ""}
                        <span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${esc(homeFormation)}</span>
                    </div>
                </div>
                ${homeLogo ? `<img src="${attr(homeLogo)}" style="width:52px;height:52px;border-radius:14px;object-fit:contain;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.12);flex-shrink:0" onerror="this.style.display='none'">` : `<div style="width:52px;height:52px;border-radius:14px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.12);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">${esc(homeFlag)}</div>`}
            </div>
            <div style="min-width:140px;text-align:center;padding:0 20px;flex-shrink:0">
                <div style="font:300 52px/1 'JetBrains Mono',monospace;color:#f8fafc;letter-spacing:-3px">${esc(String(homeScore))} <span style="font-size:22px;color:rgba(248,250,252,.12)">:</span> ${esc(String(awayScore))}</div>
                ${scoreBadgeHtml}
            </div>
            <div style="flex:1;display:flex;align-items:center;justify-content:flex-start;gap:16px">
                ${awayLogo ? `<img src="${attr(awayLogo)}" style="width:52px;height:52px;border-radius:14px;object-fit:contain;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.1);flex-shrink:0" onerror="this.style.display='none'">` : `<div style="width:52px;height:52px;border-radius:14px;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.1);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">${esc(awayFlag)}</div>`}
                <div>
                    <div style="font:500 22px/1 'Inter';color:#f8fafc">${esc(awayName)}</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                        ${awayElo ? `<span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.45)">ELO ${awayElo}</span><span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.12)">|</span>` : ""}
                        <span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${esc(awayFormation)}</span>
                    </div>
                </div>
            </div>
        </div>`;
        if (matchData2.goals?.length) {
          const homeRawName = matchData2.home?.name || "";
          const awayRawName = matchData2.away?.name || "";
          const homeGoals = matchData2.goals.filter((g) => g.team === homeRawName);
          const awayGoals = matchData2.goals.filter((g) => g.team === awayRawName);
          const goalChip = (g) => {
            const icon = g.type && /own.goal|OG|乌龙/i.test(g.type) ? "\u26BD\uFE0F" : g.type && /penalty|PK|点球/i.test(g.type) ? "\u26BDP" : "\u26BD";
            return `<span style="display:inline-flex;align-items:center;gap:3px;font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.55)">${esc(g.player)}<span style="color:rgba(248,250,252,.25)">${esc(g.minute)}</span></span>`;
          };
          html += `<div style="display:flex;align-items:flex-start;justify-content:center;padding:0 24px 10px;gap:20px">
            <div style="flex:1;display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">
              ${homeGoals.map(goalChip).join("")}
            </div>
            <div style="min-width:140px;padding:0 20px;flex-shrink:0"></div>
            <div style="flex:1;display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start">
              ${awayGoals.map(goalChip).join("")}
            </div>
          </div>`;
        }
        if (matchData2.hasPenalties) {
          const pH = matchData2.penaltyHomeScore ?? "?";
          const pA = matchData2.penaltyAwayScore ?? "?";
          const kicks = matchData2.penaltyKicks || [];
          const homeKicks = kicks.filter((k) => k.side === "home");
          const awayKicks = kicks.filter((k) => k.side === "away");
          const kickIcon = (k) => k.result === "scored" ? "\u26BD" : k.result === "saved" ? "\u{1F9E4}" : "\u2717";
          const kickStyle = (k) => k.result === "scored" ? "color:rgba(52,211,153,.9)" : "color:rgba(248,113,113,.7)";
          const kickItem = (k, align) => `<div style="display:flex;align-items:center;gap:4px;justify-content:${align};font:400 10px/1.4 'JetBrains Mono',monospace">
              <span style="${kickStyle(k)}">${kickIcon(k)}</span>
              <span style="color:rgba(248,250,252,.6)">${esc(k.player)}</span>
            </div>`;
          html += `<div style="padding:6px 24px 12px">
            <div style="background:rgba(251,191,36,.05);border:1px solid rgba(251,191,36,.15);border-radius:12px;padding:12px 16px">
              <div style="text-align:center;margin-bottom:10px">
                <span style="font:500 11px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.8)">${tx("\u70B9\u7403\u5927\u6218", "Penalty Shootout")}</span>
                <span style="margin:0 10px;font:800 20px/1 'JetBrains Mono',monospace;color:#f8fafc">${esc(String(pH))} \u2013 ${esc(String(pA))}</span>
              </div>
              <div style="display:flex;gap:16px">
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;align-items:flex-end">
                  ${homeKicks.map((k) => kickItem(k, "flex-end")).join("") || `<span style="color:rgba(248,250,252,.2);font-size:10px">\u2014</span>`}
                </div>
                <div style="width:1px;background:rgba(255,255,255,.06)"></div>
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;align-items:flex-start">
                  ${awayKicks.map((k) => kickItem(k, "flex-start")).join("") || `<span style="color:rgba(248,250,252,.2);font-size:10px">\u2014</span>`}
                </div>
              </div>
            </div>
          </div>`;
        }
        html += `<div id="hud-body" class="hud-container" style="display:flex;gap:12px;padding:8px 24px 0;align-items:flex-start;min-height:360px">`;
        html += `<div id="hud-left" class="hud-left" style="width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:0">
            <div class="hud-glass-panel">
                <div style="display:flex;border-bottom:1px solid rgba(255,255,255,.05);padding:0 4px" id="hud-left-tabs">
                    <button data-action="switch-detail-tab" data-detail-tab="stats" role="tab" aria-selected="true" class="detail-tab flex-1 py-2 text-[10px] font-medium transition-all rounded-lg hud-tab-btn active" style="min-height:44px">${tx("\u7EDF\u8BA1", "Stats")}</button>
                    <button data-action="switch-detail-tab" data-detail-tab="h2h" role="tab" aria-selected="false" class="detail-tab flex-1 py-2 text-[10px] font-medium transition-all rounded-lg hud-tab-btn" style="min-height:44px">${tx("\u4EA4\u950B", "H2H")}</button>
                    <button data-action="switch-detail-tab" data-detail-tab="news" role="tab" aria-selected="false" class="detail-tab flex-1 py-2 text-[10px] font-medium transition-all rounded-lg hud-tab-btn" style="min-height:44px">${tx("\u65B0\u95FB", "News")}</button>
                </div>
                <div id="hud-left-content" style="max-height:calc(100vh - 380px);overflow-y:auto">
                    <div id="detail-content-stats" class="detail-content">${tx("\u52A0\u8F7D\u4E2D...", "Loading...")}</div>
                    <div id="detail-content-h2h" class="detail-content hidden">${tx("\u52A0\u8F7D\u4E2D...", "Loading...")}</div>
                    <div id="detail-content-news" class="detail-content hidden">${tx("\u52A0\u8F7D\u4E2D...", "Loading...")}</div>
                </div>
            </div>
        </div>`;
        html += `<div id="hud-center" class="hud-center" style="flex:1;display:flex;flex-direction:column;align-items:center;padding:0 6px;min-width:0">
            <div id="pitch-canvas" style="width:100%;position:relative;overflow:visible">
                ${MR().renderTacticalBoard(matchupData, matchData2)}
            </div>
            <div style="display:flex;align-items:center;gap:14px;margin-top:6px">
                <div style="display:flex;align-items:center;gap:4px"><div style="width:7px;height:7px;border-radius:50%;background:rgba(59,130,246,.3);border:1px solid rgba(59,130,246,.5)"></div><span style="font:400 8px/1 'Inter';color:rgba(248,250,252,.25)">${esc(homeName)}</span></div>
                <div style="display:flex;align-items:center;gap:4px"><div style="width:7px;height:7px;border-radius:50%;background:rgba(248,113,113,.2);border:1px solid rgba(248,113,113,.4)"></div><span style="font:400 8px/1 'Inter';color:rgba(248,250,252,.25)">${esc(awayName)}</span></div>
            </div>
        </div>`;
        html += `<div id="hud-right" class="hud-right" style="width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:10px">
            <div class="hud-glass-panel" style="padding:14px 16px">
                <div id="hud-winprob">${tx("\u52A0\u8F7D\u9884\u6D4B...", "Loading prediction...")}</div>
                <div id="hud-divergence-hint" style="display:none;margin-top:8px"></div>
            </div>
            <div id="hud-liveprob-wrap" class="hud-glass-panel" style="padding:14px 16px;display:none">
                <div id="hud-liveprob"></div>
            </div>
            <div id="hud-pressure-wrap" class="hud-glass-panel" style="padding:14px 16px;display:none">
                <div id="hud-pressure"></div>
            </div>
            <div class="hud-glass-panel" style="padding:14px 16px">
                <div id="hud-venue">${tx("\u52A0\u8F7D\u573A\u5730...", "Loading venue...")}</div>
            </div>
        </div>`;
        html += `</div>`;
        html += `<div id="hud-bottom" style="margin-top:8px;background:rgba(15,23,42,.5);backdrop-filter:blur(var(--glass-blur-md));-webkit-backdrop-filter:blur(var(--glass-blur-md));border-top:1px solid rgba(255,255,255,.06);border-radius:24px 24px 0 0;padding:14px 32px 18px">
            <div style="display:flex;gap:1.5rem;overflow-x:auto;margin-bottom:10px" id="hud-bottom-tabs">`;
        const showPreMatch = !isFinishedMatch && (scheduledMatch.state === "pre" || (matchData2.status?.type?.name || "").includes("SCHEDULED"));
        if (showPreMatch) html += `<button data-action="switch-detail-tab" data-detail-tab="pre-match" role="tab" aria-selected="true" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white transition whitespace-nowrap" style="min-width:44px;min-height:44px">\u{1F9E0} ${tx("\u8D5B\u524D\u9884\u6D4B", "Pre-Match")}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="review" role="tab" aria-selected="${showPreMatch ? "false" : "true"}" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold ${showPreMatch ? "bg-white/5 text-gray-400" : "bg-white/10 text-white"} transition whitespace-nowrap" style="min-width:44px;min-height:44px">\u{1F4CB} ${tx("\u56DE\u987E", "Review")}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="bench" role="tab" aria-selected="false" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap" style="min-width:44px;min-height:44px">\u{1F504} ${tx("\u66FF\u8865", "Bench")}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="corners" role="tab" aria-selected="false" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap" style="min-width:44px;min-height:44px">\u{1F4D0} ${tx("\u89D2\u7403", "Corners")}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="coach" role="tab" aria-selected="false" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap" style="min-width:44px;min-height:44px">\u{1F9E0} ${tx("\u6559\u7EC3", "Coach")}</button>`;
        html += `<button data-action="switch-detail-tab" data-detail-tab="venue-tab" role="tab" aria-selected="false" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400 transition whitespace-nowrap" style="min-width:44px;min-height:44px">\u{1F3DF}\uFE0F ${tx("\u573A\u5730\u8BE6\u60C5", "Venue")}</button>`;
        html += `</div>`;
        if (showPreMatch) html += `<div id="detail-content-pre-match" class="detail-content"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx("\u52A0\u8F7D\u8D5B\u524D\u9884\u6D4B...", "Loading...")}</span></div></div>`;
        html += `<div id="detail-content-review" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx("\u52A0\u8F7D\u6BD4\u8D5B\u56DE\u987E...", "Loading...")}</span></div></div>`;
        html += `<div id="detail-content-bench" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx("\u52A0\u8F7D\u66FF\u8865\u5E2D\u6570\u636E...", "Loading...")}</span></div></div>`;
        html += `<div id="detail-content-corners" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx("\u52A0\u8F7D\u89D2\u7403\u6570\u636E...", "Loading...")}</span></div></div>`;
        html += `<div id="detail-content-coach" class="detail-content hidden">${MR().renderCoachPanel(matchData2, isFinishedMatch)}</div>`;
        html += `<div id="detail-content-venue-tab" class="detail-content hidden"><div class="flex items-center gap-2 mb-3"><div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><span class="text-xs text-gray-500">${tx("\u52A0\u8F7D\u573A\u5730\u5929\u6C14\u6570\u636E...", "Loading...")}</span></div></div>`;
        html += `</div>`;
        content.innerHTML = html;
        api("/api/predict/" + id).then((predRes) => {
          if (myReqId !== _openMatchReqId) return;
          const pred = predRes?.data || predRes;
          const el = document.getElementById("hud-winprob");
          if (el) el.innerHTML = MR().renderHudWinProbPanel(pred, homeName, awayName);
          const pmEl = document.getElementById("detail-content-pre-match");
          if (pmEl && pred && !pred.error && pred.homeWin !== void 0) pmEl.innerHTML = renderPreMatchPrediction(pred);
          else if (pmEl) pmEl.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u9884\u6D4B\u6570\u636E\u52A0\u8F7D\u5931\u8D25", "Prediction unavailable")}</div>`;
          api("/api/odds-divergence/" + id).then(function(divRes) {
            if (myReqId !== _openMatchReqId) return;
            const div = divRes?.data || divRes;
            if (div && div.divergence && !div.error) {
              const hintEl = document.getElementById("hud-divergence-hint");
              if (hintEl) {
                hintEl.innerHTML = renderOddsDivergenceHint(div);
                hintEl.style.display = "";
              }
            }
          }).catch(function() {
          });
        }).catch((err) => {
          console.error("match-detail: predict load failed:", err);
          if (myReqId !== _openMatchReqId) return;
          const el = document.getElementById("hud-winprob");
          if (el) el.innerHTML = `<div class="text-gray-500 text-xs text-center py-6">${tx("\u9884\u6D4B\u6682\u4E0D\u53EF\u7528", "Prediction unavailable")}</div>`;
        });
        if (knownVenue) {
          api("/api/venue/" + encodeURIComponent(knownVenue)).then((venueData) => {
            if (myReqId !== _openMatchReqId) return;
            const el = document.getElementById("hud-venue");
            if (el && venueData && !venueData.error && !venueData.note) el.innerHTML = MR().renderHudVenuePanel(venueData);
            else if (el) el.innerHTML = matchData2.weather ? renderMatchWeatherBlock(matchData2.weather) : "";
            const vEl = document.getElementById("detail-content-venue-tab");
            if (vEl && venueData && !venueData.error && !venueData.note) vEl.innerHTML = renderVenueWeather(venueData);
            else if (vEl) vEl.innerHTML = matchData2.weather ? renderMatchWeatherBlock(matchData2.weather) : `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u573A\u5730\u8D44\u6599\u6682\u4E0D\u53EF\u7528", "Venue details unavailable")}</div>`;
          }).catch((err) => {
            console.error("match-detail: venue load failed:", err);
            if (myReqId !== _openMatchReqId) return;
            const el = document.getElementById("hud-venue");
            if (el && matchData2.weather) el.innerHTML = renderMatchWeatherBlock(matchData2.weather);
            else if (el) el.innerHTML = "";
          });
        } else if (matchData2.weather) {
          const el = document.getElementById("hud-venue");
          if (el) el.innerHTML = renderMatchWeatherBlock(matchData2.weather);
        }
        if (isLive || isFinishedMatch) {
          let liveProbUrl = "/api/match/" + id + "/live-probability";
          const minute = matchData2.clock?.value != null ? Math.round(matchData2.clock.value / 60) : matchData2.status?.displayClock ? parseInt(matchData2.status.displayClock) : matchData2.liveState?.clock ? parseInt(matchData2.liveState.clock) : 0;
          const params = new URLSearchParams({
            homeScore: String(homeScore !== "-" ? homeScore : 0),
            awayScore: String(awayScore !== "-" ? awayScore : 0),
            minute: String(Math.min(minute || 0, 120)),
            state: matchData2.liveState?.state || (isLive ? "in" : "post"),
            statusName: matchData2.statusName || "",
            displayClock: matchData2.displayClock || "",
            hasPenalties: String(!!matchData2.hasPenalties)
          });
          liveProbUrl += "?" + params.toString();
          api(liveProbUrl).then((lpRes) => {
            if (myReqId !== _openMatchReqId) return;
            const lpd = lpRes?.data || lpRes;
            const wrap = document.getElementById("hud-liveprob-wrap");
            const el = document.getElementById("hud-liveprob");
            if (el && lpd && !lpd.error && lpd.preMatch?.homeWin != null) {
              const rendered = MR().renderLiveProbPanel(lpd, homeName, awayName);
              if (rendered) {
                el.innerHTML = rendered;
                if (wrap) wrap.style.display = "";
              }
            }
          }).catch(() => {
          });
        }
        if (isLive || isFinishedMatch) {
          api("/api/match/" + id + "/pressure").then((pressureRes) => {
            if (myReqId !== _openMatchReqId) return;
            const pd = pressureRes?.data || pressureRes;
            const wrap = document.getElementById("hud-pressure-wrap");
            const el = document.getElementById("hud-pressure");
            if (el && pd && !pd.error && (pd.current || pd.curve && pd.curve.length > 0)) {
              el.innerHTML = MR().renderPressurePanel(pd, homeName, awayName);
              if (wrap) wrap.style.display = "";
            }
          }).catch(() => {
          });
        }
        const statsEl = document.getElementById("detail-content-stats");
        const hId = mHomeId || matchData2.home?.id;
        const aId = mAwayId || matchData2.away?.id;
        if (isLive && matchData2.teamStats?.length) {
          if (statsEl) {
            let statsHtml = "";
            if (matchData2.goals?.length) {
              statsHtml += `<div style="padding:12px 18px 0"><div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;margin-bottom:8px">${tx("\u8FDB\u7403", "GOALS")}</div>`;
              statsHtml += matchData2.goals.map((g) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px"><span style="color:rgba(248,250,252,.3);min-width:28px;font-family:'JetBrains Mono',monospace;font-size:10px">${esc(g.minute)}</span><span style="color:rgba(248,250,252,.7)">${esc(g.player)}</span><span style="color:rgba(248,250,252,.2);font-size:10px">(${esc(g.team)})</span></div>`).join("");
              statsHtml += `</div>`;
            }
            statsHtml += MR().renderHudStatsPanel(matchData2, null);
            statsEl.innerHTML = statsHtml;
          }
        } else if (hId && aId && statsEl) {
          Promise.allSettled([api("/api/team/" + hId + "/recent-stats"), api("/api/team/" + aId + "/recent-stats")]).then(([h, a]) => {
            if (myReqId !== _openMatchReqId) return;
            const hVal = h.value?.data || h.value;
            const aVal = a.value?.data || a.value;
            const hs = h.status === "fulfilled" && hVal?.stats ? hVal : null;
            const as2 = a.status === "fulfilled" && aVal?.stats ? aVal : null;
            if (!hs && !as2) {
              statsEl.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx("\u8D5B\u524D\u6682\u65E0\u53EF\u7528\u7EDF\u8BA1", "No pre-match stats")}</div>`;
              return;
            }
            statsEl.innerHTML = `<div style="padding:16px 18px"><div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;margin-bottom:12px">${tx("\u8FD1\u671F\u573A\u5747", "RECENT AVG")}</div>${window.WorldCup.MatchStats.renderRecentAvgComparison(hs, as2, homeName, awayName)}</div>`;
          }).catch((err) => {
            console.error("match-detail: recent-stats load failed:", err);
            if (myReqId !== _openMatchReqId) return;
            if (statsEl) statsEl.innerHTML = "";
          });
        }
        api("/api/h2h/" + id, { timeout: 8e3 }).then((h2hRes) => {
          if (myReqId !== _openMatchReqId) return;
          const h2hData = h2hRes?.data || h2hRes;
          const el = document.getElementById("detail-content-h2h");
          if (el && h2hData && !h2hData.error) el.innerHTML = `<div style="padding:16px 18px">${renderHeadToHead(h2hData)}</div>`;
          else if (el) el.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx("\u6682\u65E0\u4EA4\u950B\u8BB0\u5F55", "No H2H data")}</div>`;
        }).catch((err) => {
          console.error("match-detail: h2h load failed:", err);
          if (myReqId !== _openMatchReqId) return;
          const el = document.getElementById("detail-content-h2h");
          if (el) el.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx("\u6682\u65E0\u4EA4\u950B\u8BB0\u5F55", "No H2H data")}</div>`;
        });
        api("/api/match/" + id + "/news").then((newsRes) => {
          if (myReqId !== _openMatchReqId) return;
          const newsData = newsRes?.data || newsRes;
          const el = document.getElementById("detail-content-news");
          if (el && newsData && !newsData.error) el.innerHTML = `<div style="padding:16px 18px">${renderNewsList(newsData)}</div>`;
          else if (el) el.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx("\u6682\u65E0\u65B0\u95FB", "No news")}</div>`;
        }).catch((err) => {
          console.error("match-detail: news load failed:", err);
          if (myReqId !== _openMatchReqId) return;
          const el = document.getElementById("detail-content-news");
          if (el) el.innerHTML = `<div style="padding:16px 18px;text-align:center;color:rgba(248,250,252,.3);font-size:11px">${tx("\u6682\u65E0\u65B0\u95FB", "No news")}</div>`;
        });
        api("/api/match/" + id + "/bench").then((benchData) => {
          if (myReqId !== _openMatchReqId) return;
          const el = document.getElementById("detail-content-bench");
          if (el && benchData && !benchData.error) {
            el.innerHTML = MR().renderBenchAnalysis(benchData, isFinishedMatch);
            if (benchData.realSubstitutions?.length > 0) MR().applySubstitutionsToFormation(benchData.realSubstitutions);
          } else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u66FF\u8865\u5E2D\u6570\u636E\u6682\u65E0", "No bench data")}</div>`;
        }).catch((err) => {
          console.error("match-detail: bench load failed:", err);
          if (myReqId !== _openMatchReqId) return;
          const el = document.getElementById("detail-content-bench");
          if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u66FF\u8865\u5E2D\u6570\u636E\u6682\u65E0", "No bench data")}</div>`;
        });
        api("/api/corner-analysis/" + id).then((cornerRes) => {
          if (myReqId !== _openMatchReqId) return;
          const corner = cornerRes?.data || cornerRes;
          const el = document.getElementById("detail-content-corners");
          if (el && corner && !corner.error) el.innerHTML = renderCornerAnalysis(corner);
          else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u89D2\u7403\u6570\u636E\u6682\u65E0", "No corner data")}</div>`;
        }).catch((err) => {
          console.error("match-detail: corner load failed:", err);
          if (myReqId !== _openMatchReqId) return;
          const el = document.getElementById("detail-content-corners");
          if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u89D2\u7403\u6570\u636E\u6682\u65E0", "No corner data")}</div>`;
        });
        if (isFinishedMatch && mHomeId && mAwayId) {
          window.WorldCup.ApiClient.get("/api/post-match-review/" + id, { timeout: 8e3 }).then((r) => r.data).then(async (review) => {
            if (myReqId !== _openMatchReqId) return;
            if (review && !review.error) {
              if (!review.aiPrediction) {
                const pred = await api("/api/predict/" + id);
                if (pred && !pred.error && pred.homeWin !== void 0) {
                  review.aiPrediction = { homeWin: Math.round((pred.homeWin || 0) * 1e3) / 10, draw: Math.round((pred.draw || 0) * 1e3) / 10, awayWin: Math.round((pred.awayWin || 0) * 1e3) / 10, predictedScore: pred.likelyScore || "", source: "current_model" };
                }
              }
              const el = document.getElementById("detail-content-review");
              if (el) el.innerHTML = window.WorldCup.MatchReview.renderMatchReview(review);
            } else {
              const generated = await api("/api/match-review/" + id).catch(() => null);
              const el = document.getElementById("detail-content-review");
              if (el && generated && !generated.error) el.innerHTML = window.WorldCup.MatchReview.renderMatchReview(generated);
              else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u8D5B\u540E\u590D\u76D8\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", "Post-match review generation failed. Please try again.")}</div>`;
            }
          }).catch((err) => {
            console.error("match-detail: review load failed:", err);
            if (myReqId !== _openMatchReqId) return;
            const el = document.getElementById("detail-content-review");
            if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u6BD4\u8D5B\u56DE\u987E\u6682\u4E0D\u53EF\u7528", "Review unavailable")}</div>`;
          });
        } else {
          const el = document.getElementById("detail-content-review");
          if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">\u23F3 ${tx("\u6BD4\u8D5B\u7ED3\u675F\u540E\u81EA\u52A8\u751F\u6210\u56DE\u987E", "Auto-generated after match ends")}</div>`;
        }
        if (mHomeId && mAwayId) {
          window.WorldCup.ApiClient.get("/api/coach-compare/" + mHomeId + "/" + mAwayId, { timeout: 8e3 }).then((res) => {
            if (myReqId !== _openMatchReqId) return;
            const el = document.getElementById("detail-content-coach");
            const coachData = res?.data;
            if (el && coachData && !coachData.error) {
              el.innerHTML = MR().renderCoachPanel(coachData, isFinishedMatch);
            } else if (el) {
              Promise.allSettled([window.WorldCup.ApiClient.get("/api/coach/" + mHomeId, { timeout: 5e3 }), window.WorldCup.ApiClient.get("/api/coach/" + mAwayId, { timeout: 5e3 })]).then(([homeR, awayR]) => {
                if (el) {
                  const homeC = homeR.status === "fulfilled" && homeR.value?.data && !homeR.value.data.error ? homeR.value.data : null;
                  const awayC = awayR.status === "fulfilled" && awayR.value?.data && !awayR.value.data.error ? awayR.value.data : null;
                  el.innerHTML = MR().renderCoachPanel({ coachA: homeC, coachB: awayC, comparison: null, _fallback: true }, isFinishedMatch);
                }
              }).catch((err) => {
                console.error("match-detail: inner coach load failed:", err);
                if (el) el.innerHTML = MR().renderCoachPanel(null, isFinishedMatch);
              });
            }
          }).catch((err) => {
            console.error("match-detail: coach load failed:", err);
            if (myReqId !== _openMatchReqId) return;
            const el = document.getElementById("detail-content-coach");
            if (el) el.innerHTML = MR().renderCoachPanel(null, isFinishedMatch);
          });
        } else {
          const el = document.getElementById("detail-content-coach");
          if (el) el.innerHTML = MR().renderCoachPanel(null, isFinishedMatch);
        }
      }
      const LEFT_TABS = ["stats", "h2h", "news"];
      function switchDetailTab(tab, btn) {
        const isLeft = LEFT_TABS.includes(tab);
        const contents = document.querySelectorAll(".detail-content");
        contents.forEach((el) => el.classList.add("hidden"));
        document.querySelectorAll(".detail-tab").forEach((el) => {
          el.classList.remove("active");
          el.setAttribute("aria-selected", "false");
          el.style.color = "rgba(248,250,252,.35)";
          el.style.borderBottom = "none";
          el.style.background = "transparent";
        });
        const target = document.getElementById("detail-content-" + tab);
        if (target) target.classList.remove("hidden");
        if (btn) {
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
          if (isLeft) {
            btn.style.color = "#f8fafc";
            btn.style.borderBottom = "2px solid #34d399";
            btn.style.background = "rgba(255,255,255,.03)";
          } else {
            btn.style.background = "rgba(255,255,255,.1)";
            btn.style.color = "#f8fafc";
          }
        }
      }
      function closeModal() {
        document.getElementById("match-modal").classList.add("hidden");
        document.body.style.overflow = "";
      }
      function renderNewsList(data) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u6570\u636E\u6682\u65E0", "No data")}</div>`;
        const news = data.news || [];
        const source = data.source || "unknown";
        const getImportanceIcon = (i) => ({ red: "\u{1F534}", yellow: "\u{1F7E1}", green: "\u{1F7E2}" })[i] || "\u26AA";
        const getImportanceColor = (i) => ({ red: "border-red-500/30", yellow: "border-yellow-500/30", green: "border-green-500/30" })[i] || "border-white/10";
        const getTypeIcon = (t2) => ({ injury: "\u{1F3E5}", lineup: "\u{1F4CB}", tactical: "\u{1F9E0}", coach: "\u{1F454}", transfer: "\u{1F4B0}", history: "\u{1F4CA}" })[t2] || "\u{1F4F0}";
        const formatTime = (dateStr) => {
          const d = new Date(dateStr), now = /* @__PURE__ */ new Date(), dh = Math.floor((now - d) / 36e5);
          if (dh < 1) return tx("\u521A\u521A", "Just now");
          if (dh < 24) return state.uiLang === "en" ? `${dh}h ago` : `${dh}\u5C0F\u65F6\u524D`;
          const dd = Math.floor(dh / 24);
          if (dd < 7) return state.uiLang === "en" ? `${dd}d ago` : `${dd}\u5929\u524D`;
          return d.toLocaleDateString(state.uiLang === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric" });
        };
        return `<div class="space-y-3"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="text-lg">\u{1F4F0}</span><div><div class="text-sm font-bold">${tx("\u6BD4\u8D5B\u76F8\u5173\u65B0\u95FB", "Match News")}</div><div class="text-[11px] text-gray-500">${esc(displayMaybeTeamName(data.homeNameI18n || data.homeTeam || ""))} ${tx("\u5BF9\u9635", "vs")} ${esc(displayMaybeTeamName(data.awayNameI18n || data.awayTeam || ""))}</div></div></div><div class="text-[11px] text-gray-600">${tx("\u6765\u6E90", "Source")}: ${source === "tavily" ? "Tavily AI" : tx("\u6682\u65E0\u540C\u6B65", "Not synced")}</div></div>${news.length > 0 ? news.map((item) => `<div class="glass-light rounded-lg p-3 border-l-2 ${getImportanceColor(item.importance)}"><div class="flex items-start gap-2"><span class="text-sm mt-0.5">${getImportanceIcon(item.importance)}</span><div class="flex-1"><div class="flex items-center gap-1 mb-1"><span class="text-[11px] text-gray-500">${getTypeIcon(item.type)} ${esc(item.type) || "general"}</span><span class="text-[11px] text-gray-600 ml-auto">${formatTime(item.publishedAt)}</span></div><div class="font-bold text-xs mb-1">${esc(window.WorldCup.I18n.i18nText(item.titleI18n, item.title || ""))}</div><div class="text-[11px] text-gray-400 mb-2">${esc(window.WorldCup.I18n.i18nText(item.summaryI18n, item.summary || ""))}</div><div class="flex items-center justify-between"><div class="text-[11px] text-gray-600">${tx("\u6765\u6E90", "Source")}: ${esc(window.WorldCup.I18n.i18nText(item.sourceI18n, item.source || tx("\u672A\u77E5", "Unknown")))}</div>${item.url ? `<a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-blue-400 hover:underline">${tx("\u9605\u8BFB\u5168\u6587", "Read full article")} \u2192</a>` : ""}</div>${item.tags?.length > 0 ? `<div class="flex flex-wrap gap-1 mt-2">${item.tags.map((tag) => `<span class="bg-white/5 px-1.5 py-0.5 rounded text-[11px] text-gray-500">${esc(tag)}</span>`).join("")}</div>` : ""}</div></div></div>`).join("") : `<div class="glass-light rounded-lg p-4 text-center"><div class="text-gray-500 text-xs">${tx("\u6682\u65E0\u65B0\u95FB\u540C\u6B65", "No synced news yet")}</div></div>`}<div class="text-[11px] text-gray-600 text-center">${tx("\u5171", "Total")} ${news.length} ${tx("\u6761\u65B0\u95FB", "news items")} \xB7 ${tx("\u66F4\u65B0\u65F6\u95F4", "Updated")}: ${new Date(data.lastUpdated).toLocaleString(state.uiLang === "en" ? "en-US" : "zh-CN")}</div></div>`;
      }
      function renderHeadToHead(data) {
        if (!data || data.dataQuality === "unavailable") return `<div class="text-gray-500 text-xs py-4 text-center">${tx("ESPN \u6682\u65E0\u5386\u53F2\u4EA4\u950B\u6837\u672C", "No historical H2H data from ESPN")}</div>`;
        const homeTeam = data.homeTeam || tx("\u4E3B\u961F", "Home"), awayTeam = data.awayTeam || tx("\u5BA2\u961F", "Away"), grouped = data.grouped || {}, summary = data.summary || {}, homeSummary = summary.home || {}, awaySummary = summary.away || {}, recentMatches = data.recentMatches || [];
        let html = '<div class="space-y-3">';
        const recentHome = data.recent?.home || homeSummary.recent10 || [];
        const recentAway = data.recent?.away || awaySummary.recent10 || [];
        const groupForm = data.groupForm || {};
        const wdl = (r10) => {
          if (!r10.length) return "";
          let w = 0, d = 0, l = 0;
          r10.forEach((m) => {
            if (m.result === "W") w++;
            else if (m.result === "D") d++;
            else l++;
          });
          return ` <span class="font-mono text-[11px] text-white/40">${w}-${d}-${l}</span>`;
        };
        const groupWdl = (form) => form && form.played ? ` <span class="font-mono text-[11px] text-white/60">${form.wins}-${form.draws}-${form.losses}</span>` : "";
        const lang = window.WorldCup?.State?.uiLang || "zh";
        const localSummary = (s) => s?.summaryTextI18n?.(s.summaryTextI18n[lang] || s.summaryTextI18n.zh) || s?.summaryText || "";
        const homeSummaryText = homeSummary.summaryTextI18n ? homeSummary.summaryTextI18n[lang] || homeSummary.summaryTextI18n.zh : homeSummary.summaryText || homeTeam + tx(" \u6570\u636E\u4E0D\u8DB3", " Insufficient data");
        const awaySummaryText = awaySummary.summaryTextI18n ? awaySummary.summaryTextI18n[lang] || awaySummary.summaryTextI18n.zh : awaySummary.summaryText || awayTeam + tx(" \u6570\u636E\u4E0D\u8DB3", " Insufficient data");
        html += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx("\u672C\u5C4A\u5C0F\u7EC4\u8D5B\u6218\u7EE9", "Current Group Record")}</div><div class="space-y-2"><div class="flex items-center gap-2"><span class="text-blue-400">\u25CF</span><span class="text-sm">${esc(homeTeam)}${groupWdl(groupForm.home)}</span></div><div class="flex items-center gap-2"><span class="text-red-400">\u25CF</span><span class="text-sm">${esc(awayTeam)}${groupWdl(groupForm.away)}</span></div></div></div>`;
        if (recentHome.length || recentAway.length) html += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx("\u5386\u53F2\u4EA4\u950B\u8D70\u52BF", "Historical H2H Trend")}</div><div class="space-y-2"><div class="flex items-center gap-2"><span class="text-blue-400">\u25CF</span><span class="text-sm">${esc(homeSummaryText)}${wdl(recentHome)}</span></div><div class="flex items-center gap-2"><span class="text-red-400">\u25CF</span><span class="text-sm">${esc(awaySummaryText)}${wdl(recentAway)}</span></div></div></div>`;
        html += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx("\u5BF9\u9635\u8BB0\u5F55", "H2H History")}</div>`;
        const wc = grouped.worldCup;
        if (wc?.matches?.length) html += `<div class="mb-3"><div class="flex items-center gap-2 mb-1"><span>\u{1F3C6}</span><span class="text-sm font-bold">${esc(wc.labelI18n?.[lang] || wc.label || tx("\u4E16\u754C\u676F", "World Cup"))}</span><span class="text-[11px] text-gray-500">${tx("\u5171 ", "Total ")}${esc(wc.stats?.total || 0)}${tx(" \u573A", " matches")}</span></div>${renderH2HMatchList(wc.matches)}</div>`;
        const other = grouped.other;
        if (other?.subGroups) {
          for (const [subType, sub] of Object.entries(other.subGroups)) if (sub.matches?.length) html += `<div class="mb-3"><div class="flex items-center gap-2 mb-1"><span>\u{1F4C1}</span><span class="text-sm font-bold">${esc(sub.labelI18n?.[lang] || sub.label || subType)}</span><span class="text-[11px] text-gray-500">${tx("\u5171 ", "Total ")}${esc(sub.stats?.total || 0)}${tx(" \u573A", " matches")}</span></div>${renderH2HMatchList(sub.matches)}</div>`;
        }
        if (!wc?.matches?.length && !other?.subGroups) html += recentMatches.length > 0 ? `<div class="text-[11px] text-gray-500 mb-1">${tx("\u8FD1\u671F\u4EA4\u950B", "Recent Meetings")}</div>${renderH2HMatchList(recentMatches)}` : `<div class="text-gray-500 text-xs">${tx("\u6682\u65E0\u5BF9\u9635\u8BB0\u5F55", "No H2H history")}</div>`;
        html += "</div>";
        if (summary.totalMatches > 0) html += `<div class="glass-light rounded-lg p-3"><div class="text-xs font-bold text-gray-400 mb-2">${tx("\u4EA4\u950B\u7EDF\u8BA1", "H2H Stats")}</div><div class="grid grid-cols-3 gap-2 text-center"><div><div class="text-xs text-blue-400">${esc(homeTeam)}</div><div class="text-lg font-bold">${esc(summary.homeWins || 0)}${tx(" \u80DC", " Wins")}</div><div class="text-[11px] text-gray-500">${esc(summary.homeWinRate || "0%")}</div></div><div><div class="text-xs text-gray-500">${tx("\u5E73\u5C40", "Draws")}</div><div class="text-lg font-bold text-yellow-400">${esc(summary.draws || 0)}</div><div class="text-[11px] text-gray-500">${esc(summary.drawRate || "0%")}</div></div><div><div class="text-xs text-red-400">${esc(awayTeam)}</div><div class="text-lg font-bold">${esc(summary.awayWins || 0)}${tx(" \u80DC", " Wins")}</div><div class="text-[11px] text-gray-500">${esc(summary.awayWinRate || "0%")}</div></div></div></div>`;
        html += "</div>";
        return html;
      }
      function renderH2HMatchList(matches) {
        if (!matches?.length) return `<div class="text-gray-600 text-xs">${tx("\u6682\u65E0\u6BD4\u8D5B", "No matches")}</div>`;
        return '<div class="space-y-1">' + matches.map((m) => {
          const score = m.score || (m.homeScore !== void 0 ? m.homeScore + "-" + m.awayScore : "0-0");
          const [hs, as] = score.split("-").map(Number);
          let cls = "text-yellow-400";
          if (hs > as) cls = "text-blue-400";
          else if (hs < as) cls = "text-red-400";
          const teams = [m.homeTeamName, m.awayTeamName].filter(Boolean).join(" vs ");
          return `<div class="flex items-center justify-between text-[11px] py-1 border-b border-white/5"><span class="text-gray-600">${esc((m.date || "").substring(0, 10))}</span><span class="text-gray-500 truncate px-2">${esc(teams || m.competition || "")}</span><span class="font-bold ${cls}">${esc(score)}</span></div>`;
        }).join("") + "</div>";
      }
      function renderMatchWeatherBlock(w) {
        const unit = window.WorldCup.Utils.getWeatherUnit();
        const temp = window.WorldCup.Utils.formatTemperature(w.tC, "C", unit);
        const feels = window.WorldCup.Utils.formatTemperature(w.feelsC, "C", unit);
        if (!w) return "";
        const wmoEmoji = (code) => {
          if (code === 0) return "\u2600\uFE0F";
          if (code <= 3) return ["\u{1F324}\uFE0F", "\u26C5", "\u2601\uFE0F"][Math.min(code - 1, 2)];
          if (code <= 48) return "\u{1F32B}\uFE0F";
          if (code <= 55) return "\u{1F326}\uFE0F";
          if (code <= 65) return "\u{1F327}\uFE0F";
          if (code <= 75) return "\u{1F328}\uFE0F";
          if (code <= 82) return "\u{1F327}\uFE0F";
          if (code >= 95) return "\u26C8\uFE0F";
          return "\u{1F324}\uFE0F";
        };
        const emoji = wmoEmoji(w.code);
        const tempColor = w.tC >= 32 ? "rgba(248,113,113,.6)" : w.tC <= 10 ? "rgba(59,130,246,.6)" : "rgba(248,250,252,.5)";
        return `<div style="background:rgba(15,23,42,.45);backdrop-filter:blur(var(--glass-blur-sm));border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px 18px;box-shadow:0 4px 30px rgba(0,0,0,.4)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx("\u6BD4\u8D5B\u5929\u6C14", "MATCH WEATHER")}</div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                <span style="font-size:28px">${emoji}</span>
                <div>
                    <div data-temp-c="${attr(w.tC)}" style="font:300 28px/1 'JetBrains Mono',monospace;color:${tempColor}">${temp}</div>
                    <div style="font:400 9px/1 'Inter';color:rgba(248,250,252,.2);margin-top:2px">${tx("\u4F53\u611F", "Feels")} <span data-temp-c="${attr(w.feelsC)}">${feels}</span></div>
                    <div style="display:flex;gap:3px;margin-top:8px" aria-label="${tx("\u6E29\u5EA6\u5355\u4F4D", "Temperature unit")}">
                        <button data-action="weather-unit" data-weather-unit="C" aria-pressed="${unit === "C"}" class="${unit === "C" ? "active" : ""}" style="min-width:44px;min-height:44px;border:1px solid rgba(255,255,255,.08);border-radius:6px;color:inherit;background:rgba(255,255,255,.03)">\xB0C</button>
                        <button data-action="weather-unit" data-weather-unit="F" aria-pressed="${unit === "F"}" class="${unit === "F" ? "active" : ""}" style="min-width:44px;min-height:44px;border:1px solid rgba(255,255,255,.08);border-radius:6px;color:inherit;background:rgba(255,255,255,.03)">\xB0F</button>
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);text-align:center">
                    <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">\u{1F4A7} ${tx("\u964D\u6C34\u6982\u7387", "Rain")}</div>
                    <div style="font:400 16px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.5)">${w.pp}<span style="font-size:9px;color:rgba(59,130,246,.3)">%</span></div>
                </div>
                <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);text-align:center">
                    <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">\u{1F4A8} ${tx("\u98CE\u901F", "Wind")}</div>
                    <div style="font:400 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${Math.round(w.windKmh)}<span style="font-size:9px;color:rgba(248,250,252,.2)">km/h</span></div>
                </div>
                <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);text-align:center">
                    <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">\u{1F4A6} ${tx("\u6E7F\u5EA6", "Humidity")}</div>
                    <div style="font:400 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${w.rh}<span style="font-size:9px;color:rgba(248,250,252,.2)">%</span></div>
                </div>
            </div>
        </div>`;
      }
      function renderVenueWeather(data) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u6570\u636E\u6682\u65E0", "No data")}</div>`;
        const v = data, w = v.weather, impact = v.impact, meta = v.meta;
        const weatherIcon = w ? { Clear: "\u2600\uFE0F", Clouds: "\u2601\uFE0F", Rain: "\u{1F327}\uFE0F", Snow: "\u2744\uFE0F", Thunderstorm: "\u26C8\uFE0F" }[w.condition] || "\u{1F324}\uFE0F" : "\u{1F324}\uFE0F";
        const impactColor = impact?.overall > 10 ? "text-green-400" : impact?.overall < -10 ? "text-red-400" : "text-yellow-400";
        const impactEmoji = impact?.overall > 10 ? "\u2705" : impact?.overall < -10 ? "\u26A0\uFE0F" : "\u27A1\uFE0F";
        const grassDisplay = meta?.surface || v.grass || tx("\u672A\u77E5", "N/A");
        const grassIcon = grassDisplay.includes("\u4EBA\u5DE5") ? "\u{1F7E2}" : grassDisplay.includes("\u6DF7\u5408") ? "\u{1F7E1}" : "\u{1F33F}";
        const roofIcon = v.roof === "closed" ? "\u{1F3DF}\uFE0F" : v.roof === "retractable" ? "\u{1F504}" : "\u2601\uFE0F";
        let venueBlock = "";
        if (v.wikiThumb) {
          venueBlock += `<div class="mb-3"><img src="${esc(v.wikiThumb)}" alt="${esc(v.name || "")}" class="w-full h-32 object-cover rounded-lg opacity-85" loading="lazy"></div>`;
        }
        venueBlock += `<div class="flex items-center gap-2 mb-2"><span class="text-lg">${roofIcon}</span><div><div class="font-bold text-sm">${esc(v.name) || tx("\u672A\u77E5\u573A\u9986", "Unknown Venue")}</div><div class="text-[11px] text-gray-500">${esc(v.city) || ""}, ${esc(v.country) || ""}</div></div></div>`;
        const metaCards = [];
        if (v.capacity) metaCards.push({ l: tx("\u5BB9\u91CF", "Capacity"), v: v.capacity.toLocaleString() });
        if (meta?.yearBuilt) metaCards.push({ l: tx("\u5EFA\u9020", "Built"), v: String(meta.yearBuilt) });
        if (meta?.architect) metaCards.push({ l: tx("\u5EFA\u7B51\u5E08", "Architect"), v: meta.architect });
        if (meta?.cost) metaCards.push({ l: tx("\u9020\u4EF7", "Cost"), v: meta.cost });
        if (metaCards.length > 0) {
          const cols = metaCards.length <= 2 ? metaCards.length : 2;
          venueBlock += `<div class="grid gap-2 text-[11px] mb-2" style="grid-template-columns:repeat(${cols},1fr)">`;
          for (const mc of metaCards) {
            venueBlock += `<div><span class="text-gray-500">${mc.l}</span><span class="font-bold ml-1">${esc(mc.v)}</span></div>`;
          }
          venueBlock += `</div>`;
        }
        venueBlock += `<div class="grid grid-cols-2 gap-2 text-[11px]"><div><span class="text-gray-500">${tx("\u6D77\u62D4", "Altitude")}</span><span class="font-bold ml-1">${v.altitude || 0}m</span></div><div><span class="text-gray-500">${tx("\u8349\u76AE", "Surface")}</span><span class="ml-1">${grassIcon} ${esc(grassDisplay)}</span></div><div><span class="text-gray-500">${tx("\u5C4B\u9876", "Roof")}</span><span class="ml-1">${v.roof === "closed" ? tx("\u5C01\u95ED", "Closed") : v.roof === "retractable" ? tx("\u53EF\u4F38\u7F29", "Retractable") : tx("\u5F00\u653E", "Open")}</span></div></div>`;
        return `<div class="space-y-3"><div class="glass-light rounded-lg p-3">${venueBlock}</div>${w ? `<div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-gray-400">${weatherIcon} ${tx("\u5929\u6C14\u72B6\u51B5", "Weather")}</span><span class="text-[11px] text-gray-500">${esc(w.description) || ""}</span></div><div class="grid grid-cols-3 gap-3 text-center"><div><div class="text-xl font-bold">${esc(w.temp) || "-"}\xB0C</div><div class="text-[11px] text-gray-500">${tx("\u6E29\u5EA6", "Temp")}</div><div class="text-[11px] text-gray-600">${tx("\u4F53\u611F", "Feels")} ${esc(w.feelsLike) || "-"}\xB0C</div></div><div><div class="text-xl font-bold">${esc(w.humidity) || "-"}%</div><div class="text-[11px] text-gray-500">${tx("\u6E7F\u5EA6", "Humidity")}</div></div><div><div class="text-xl font-bold">${w.windSpeed ? esc(Math.round(w.windSpeed)) : "-"}</div><div class="text-[11px] text-gray-500">${tx("\u98CE\u901F", "Wind")} km/h</div></div></div></div>` : `<div class="glass-light rounded-lg p-3"><div class="text-center text-gray-500 text-xs"><div class="mb-1">\u{1F324}\uFE0F ${tx("\u5929\u6C14\u6570\u636E", "Weather")}</div><div>${tx("\u6682\u65E0\u5B9E\u65F6\u5929\u6C14", "No weather data")}</div></div></div>`}${impact ? `<div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-gray-400">\u{1F4CA} ${tx("\u573A\u5730\u5F71\u54CD\u5206\u6790", "Venue Impact")}</span><span class="text-xs ${impactColor} font-bold">${impactEmoji} ${impact.overall > 0 ? "+" : ""}${esc(impact.overall)}</span></div><div class="grid grid-cols-2 gap-2 text-[11px] mb-2"><div><span class="text-gray-500">${tx("\u8FDB\u653B", "Attack")}</span><span class="font-bold ml-1 ${impact.attack > 0 ? "text-green-400" : impact.attack < 0 ? "text-red-400" : ""}">${impact.attack > 0 ? "+" : ""}${esc(impact.attack)}%</span></div><div><span class="text-gray-500">${tx("\u9632\u5B88", "Defense")}</span><span class="font-bold ml-1 ${impact.defense > 0 ? "text-green-400" : impact.defense < 0 ? "text-red-400" : ""}">${impact.defense > 0 ? "+" : ""}${esc(impact.defense)}%</span></div><div><span class="text-gray-500">${tx("\u63A7\u7403", "Poss")}</span><span class="font-bold ml-1 ${impact.possession > 0 ? "text-green-400" : impact.possession < 0 ? "text-red-400" : ""}">${impact.possession > 0 ? "+" : ""}${esc(impact.possession)}%</span></div><div><span class="text-gray-500">${tx("\u4F53\u80FD", "Stamina")}</span><span class="font-bold ml-1 ${impact.physical > 0 ? "text-green-400" : impact.physical < 0 ? "text-red-400" : ""}">${impact.physical > 0 ? "+" : ""}${esc(impact.physical)}%</span></div></div>${impact.details?.length ? `<div class="border-t border-white/5 pt-2">${impact.details.map((d) => `<div class="text-[11px] text-gray-400 mb-1">\u2022 ${esc(d)}</div>`).join("")}</div>` : ""}</div>` : ""}</div>`;
      }
      function renderUserVotePanel(pred) {
        const matchId = pred?.match?.id || window._currentMatchId || "";
        if (!matchId) return "";
        const homeName = displayMaybeTeamName(pred?.match?.homeNameI18n || pred?.match?.homeName || "Home");
        const awayName = displayMaybeTeamName(pred?.match?.awayNameI18n || pred?.match?.awayName || "Away");
        var html = '<div class="pred-section" id="user-vote-panel">\n  <div class="pred-section-title text-indigo-400"><span class="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs">\u{1F3C6}</span>' + tx("\u7403\u8FF7\u9884\u6D4B", "Fan Predictions") + '</div>\n  <div class="flex items-center gap-2 mb-2">\n    <button data-choice="home" class="vote-btn flex-1 py-2 rounded-lg text-xs font-bold bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20 transition">' + esc(homeName) + ' \u{1F3C6}</button>\n    <button data-choice="draw" class="vote-btn flex-1 py-2 rounded-lg text-xs font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 hover:bg-yellow-500/20 transition">' + tx("\u5E73\u5C40", "Draw") + '</button>\n    <button data-choice="away" class="vote-btn flex-1 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition">' + esc(awayName) + ' \u{1F3C6}</button>\n  </div>\n  <div id="user-vote-result" class="text-xs text-gray-400 leading-snug">' + tx("\u70B9\u51FB\u6295\u7968\u67E5\u770B\u7403\u8FF7\u9884\u6D4B", "Vote to see fan predictions") + "</div>\n</div>";
        setTimeout(function() {
          loadUserVoteAggregate(matchId);
        }, 200);
        return html;
      }
      function renderPreMatchPrediction(pred) {
        if (!pred || pred.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u9884\u6D4B\u6570\u636E\u52A0\u8F7D\u5931\u8D25", "Prediction data unavailable")}</div>`;
        const homeName = displayMaybeTeamName(pred.match?.homeNameI18n || pred.match?.homeName || "\u4E3B\u961F"), awayName = displayMaybeTeamName(pred.match?.awayNameI18n || pred.match?.awayName || "\u5BA2\u961F");
        const eloHome = Fmt.safeNum(pred.components?.elo?.home, 0), eloAway = Fmt.safeNum(pred.components?.elo?.away, 0), eloTotal = eloHome + eloAway || 1;
        const eloHomePct = Math.round(eloHome / eloTotal * 100), eloAwayPct = 100 - eloHomePct, eloDiff = Math.abs(eloHome - eloAway).toFixed(3);
        const hw = Fmt.pctBar(pred.homeWin), dr = Fmt.pctBar(pred.draw), aw = Fmt.pctBar(pred.awayWin);
        const homeLambda = Fmt.safeNum(pred.goals?.homeExpected || pred.components?.poisson?.homeLambda, 0).toFixed(2);
        const awayLambda = Fmt.safeNum(pred.goals?.awayExpected || pred.components?.poisson?.awayLambda, 0).toFixed(2);
        let html = `<div class="space-y-3"><div class="pred-section"><div class="pred-section-title text-purple-400"><span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs">\u26A1</span>${tx("Elo \u5B9E\u529B\u5BF9\u6BD4", "Elo Comparison")}</div><div class="space-y-2"><div class="flex items-center gap-2"><span class="text-xs font-bold w-20 truncate">${esc(homeName)}</span><div class="elo-bar flex-1"><div class="elo-bar-fill" style="width:${eloHomePct}%"></div></div><span class="text-xs font-mono font-bold text-purple-400 w-12 text-right">${eloHomePct}%</span></div><div class="flex items-center gap-2"><span class="text-xs font-bold w-20 truncate">${esc(awayName)}</span><div class="elo-bar flex-1"><div class="elo-bar-fill" style="width:${eloAwayPct}%"></div></div><span class="text-xs font-mono font-bold text-purple-400 w-12 text-right">${eloAwayPct}%</span></div><div class="text-[10px] text-gray-500 text-center mt-1.5">${tx("Elo \u5DEE\u503C", "Elo Diff")}: ${eloDiff}</div></div></div>`;
        html += `<div class="pred-section"><div class="pred-section-title text-blue-400"><span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">\u{1F3AF}</span>${tx("\u80DC\u5E73\u8D1F\u6982\u7387", "W/D/L Probability")}</div><div class="prob-bar mb-2" role="img" aria-label="${tx("\u80DC\u5E73\u8D1F\u6982\u7387", "Win draw loss probability")}: ${tx("\u4E3B\u80DC", "Home")} ${hw}%, ${tx("\u5E73\u5C40", "Draw")} ${dr}%, ${tx("\u5BA2\u80DC", "Away")} ${aw}%"><div class="prob-bar-home" style="width:${hw}%">${hw > 12 ? hw + "%" : ""}</div><div class="prob-bar-draw" style="width:${dr}%">${dr > 10 ? dr + "%" : ""}</div><div class="prob-bar-away" style="width:${aw}%">${aw > 12 ? aw + "%" : ""}</div></div><div class="flex justify-between text-[11px]"><span class="text-green-400 font-bold">${tx("\u4E3B\u80DC", "Home")} ${hw}%</span><span class="text-yellow-400 font-bold">${tx("\u5E73\u5C40", "Draw")} ${dr}%</span><span class="text-red-400 font-bold">${tx("\u5BA2\u80DC", "Away")} ${aw}%</span></div></div>`;
        html += `<div class="pred-section"><div class="pred-section-title text-emerald-400"><span class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs">\u{1F4CA}</span>${tx("\u8FDB\u7403\u671F\u671B\u503C (\u03BB)", "Expected Goals (\u03BB)")}</div><div class="grid grid-cols-2 gap-2"><div class="elo-card"><div class="text-xs font-bold mb-1.5 text-emerald-300">${esc(homeName)}</div><div class="text-sm font-mono font-bold text-emerald-400">${homeLambda}</div><div class="text-[10px] text-gray-500 mt-0.5">${tx("\u573A\u5747\u8FDB\u7403", "Avg Goals")}</div></div><div class="elo-card"><div class="text-xs font-bold mb-1.5 text-red-300">${esc(awayName)}</div><div class="text-sm font-mono font-bold text-red-400">${awayLambda}</div><div class="text-[10px] text-gray-500 mt-0.5">${tx("\u573A\u5747\u8FDB\u7403", "Avg Goals")}</div></div></div></div>`;
        html += renderUserVotePanel(pred);
        if (pred.tacticalScenario?.applicable) html += renderTacticalScenario(pred.tacticalScenario);
        html += "</div>";
        return html;
      }
      function renderTacticalScenario(ts) {
        const L = (o) => esc(window.WorldCup.I18n.i18nText(o, "")), focusIds = Object.keys(ts.teams || {});
        const standings = (ts.standings || []).map((s) => `<div class="flex items-center gap-2 text-[10px] py-0.5 ${focusIds.includes(s.id) ? "text-white font-semibold" : "text-gray-400"}"><span class="w-4 text-gray-500">${s.rank}</span><span class="flex-1 truncate">${L(s.name)}</span><span class="w-7 text-right font-mono">${s.pts}</span><span class="w-8 text-right font-mono text-gray-500">${s.gd >= 0 ? "+" : ""}${s.gd}</span></div>`).join("");
        const row = (label, sc) => {
          if (!sc) return "";
          return `<div class="flex justify-between text-[10px] py-0.5"><span class="text-gray-500">${label}</span><span class="font-semibold ${sc.gdDependent ? "text-amber-400" : "text-gray-200"}">${L(sc.status)}</span></div>`;
        };
        const oppLine = (label, info) => info?.opponent ? `<div class="flex justify-between text-[10px]"><span class="text-gray-500">${label}</span><span class="text-gray-300 text-right">${L(info.opponent.label)}${info.opponent.elo ? ` <span class="text-gray-500">Elo ${info.opponent.elo}</span>` : ""}</span></div>` : "";
        const teamCards = Object.values(ts.teams || {}).map((t2) => {
          const locked = t2.locked ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">${L(t2.locked)}</span>` : "";
          const br = t2.bracket || {};
          const inc = br.incentive ? `<div class="text-[10px] text-amber-300/90 mt-1 leading-snug">\u26A0 ${L(br.incentive.note)}</div>` : "";
          return `<div class="elo-card"><div class="flex items-center justify-between mb-1 gap-1"><span class="text-xs font-bold truncate">${L(t2.name)}</span>${locked}</div>${row(tx("\u80DC", "Win"), t2.ifWin)}${row(tx("\u5E73", "Draw"), t2.ifDraw)}${row(tx("\u8D1F", "Lose"), t2.ifLose)}<div class="border-t border-white/5 mt-1.5 pt-1.5 space-y-0.5"><div class="text-[9px] text-gray-500 mb-0.5">${tx("\u4E0B\u4E00\u8F6E\u5BF9\u9635 (R32)", "Next round (R32)")}</div>${oppLine(tx("\u82E5\u7B2C\u4E00", "If 1st"), br.asFirst)}${oppLine(tx("\u82E5\u7B2C\u4E8C", "If 2nd"), br.asSecond)}${inc}</div></div>`;
        }).join("");
        const notes = (ts.notes || []).map((n) => `<div class="text-[10px] text-amber-300/90 leading-snug">\u2022 ${L(n)}</div>`).join("");
        return `<div class="pred-section"><div class="pred-section-title text-amber-400"><span class="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs">\u{1F3B2}</span>${tx("\u672B\u8F6E\u6218\u7565\u60C5\u5883", "Final-Round Scenario")}<span class="text-[9px] text-gray-500 font-normal ml-1">${tx("\u60C5\u5883\u63A8\u6F14\xB7\u975E\u6BD4\u5206\u9884\u6D4B", "scenario \xB7 not a forecast")}</span></div><div class="glass-light rounded-lg p-2 mb-2"><div class="text-[9px] text-gray-500 mb-1">${tx("\u5C0F\u7EC4", "Group")} ${esc(ts.groupLetter || "")} \xB7 ${tx("\u5F53\u524D\u79EF\u5206\u699C", "current table")}</div>${standings}<div class="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-white/5">${tx("\u540C\u65F6\u8FDB\u884C", "Simultaneous")}: ${L(ts.parallelMatch?.homeName)} vs ${L(ts.parallelMatch?.awayName)}</div></div><div class="grid grid-cols-2 gap-2">${teamCards}</div>${notes ? `<div class="mt-2 space-y-1">${notes}</div>` : ""}<div class="text-[9px] text-gray-600 mt-2 leading-snug">${L(ts.disclaimer)}</div></div>`;
      }
      function renderCornerAnalysis(data) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u6570\u636E\u6682\u65E0", "No data")}</div>`;
        const p = data.predicted, o = data.odds, r = data.realtime, h = data.historical;
        const trend = r.trend || "neutral", trendEmoji = { over_strong: "\u{1F534}", over_slight: "\u{1F7E0}", under_strong: "\u{1F535}", under_slight: "\u{1F7E4}" }[trend] || "\u26AA";
        const conf = r.confidence === "high" ? "\u{1F7E2}" : r.confidence === "medium" ? "\u{1F7E1}" : "\u26AA";
        const progressPct = Math.min(100, (r.current?.total || 0) / (o?.line || 9.5) * 100), expectedPct = r.progress?.expected || 0;
        const paceStatus = r.pace === "above" ? `\u26A1${tx("\u8282\u594F\u5FEB", "Fast pace")}` : r.pace === "below" ? `\u2022 ${tx("\u8282\u594F\u6162", "Slow pace")}` : `\u2713${tx("\u6B63\u5E38", "Normal")}`;
        const paceColor = r.pace === "above" ? "text-yellow-400" : r.pace === "below" ? "text-blue-400" : "text-green-400";
        return `<div class="space-y-3"><div class="glass-light rounded-lg p-3"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold text-gray-400">\u{1F4D0} ${tx("\u89D2\u7403\u9884\u6D4B", "Corner Forecast")}</span><span class="text-xs text-gray-500">${tx("\u76D8\u53E3\u7EBF", "Line")} <span class="font-bold text-white">${o?.line || 9.5}</span></span></div><div class="flex items-center gap-3 mb-3"><div class="text-center"><div class="text-2xl font-bold text-white">${p?.total || "-"}</div><div class="text-[11px] text-gray-500">${tx("\u9884\u6D4B\u603B\u89D2\u7403", "Projected Corners")}</div></div><div class="flex-1"><div class="flex items-center gap-1 mb-1"><span class="text-xs">${trendEmoji}</span><span class="text-xs font-bold ${trend.includes("over") ? "text-red-400" : trend.includes("under") ? "text-blue-400" : "text-gray-400"}">${esc(trend.replace("_", " ").toUpperCase())}</span><span class="ml-auto">${conf}</span></div><div class="text-[11px] text-gray-500">${tx("\u5B9E\u9645", "Actual")} <span class="font-bold text-white">${r.current?.total || 0}</span> / ${o?.line || 9.5}</div></div></div><div class="relative h-4 bg-white/5 rounded-full overflow-hidden mb-2"><div class="absolute top-0 bottom-0 w-0.5 bg-yellow-500/50" style="left:${expectedPct}%"></div><div class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700" style="width:${progressPct}%"></div><div class="absolute inset-0 flex items-center justify-between px-2 text-[9px]"><span class="text-white font-bold">${r.current?.total || 0}</span><span class="text-gray-400">${Math.round(progressPct)}%</span></div></div><div class="flex items-center justify-between text-[11px]"><span class="text-gray-500">${esc(window.WorldCup.I18n.translateCoachField(h?.homeStyle, "style") || tx("\u5747\u8861\u578B", "Balanced"))} ${tx("\u5BF9\u9635", "vs")} ${esc(window.WorldCup.I18n.translateCoachField(h?.awayStyle, "style") || tx("\u5747\u8861\u578B", "Balanced"))}</span><span class="${paceColor} font-bold">${paceStatus}</span></div></div><div class="grid grid-cols-2 gap-2"><div class="glass-light rounded-lg p-2"><div class="text-[11px] text-gray-500 mb-1">\u{1F535} ${tx("\u4E3B\u961F", "Home")}</div><div class="text-sm font-bold">${h?.homeAvg || "-"} ${tx("\u573A\u5747", "avg")}</div><div class="text-[11px] text-gray-600">${esc(window.WorldCup.I18n.translateCoachField(h?.homeStyle, "style") || tx("\u5747\u8861\u578B", "Balanced"))} (${esc(h?.homeStyleCoeff) || 1}x)</div></div><div class="glass-light rounded-lg p-2"><div class="text-[11px] text-gray-500 mb-1">\u{1F534} ${tx("\u5BA2\u961F", "Away")}</div><div class="text-sm font-bold">${h?.awayAvg || "-"} ${tx("\u573A\u5747", "avg")}</div><div class="text-[11px] text-gray-600">${esc(window.WorldCup.I18n.translateCoachField(h?.awayStyle, "style") || tx("\u5747\u8861\u578B", "Balanced"))} (${esc(h?.awayStyleCoeff) || 1}x)</div></div></div>${data.verdict?.reason || data.verdict?.reasonI18n ? `<div class="glass-light rounded-lg p-2"><div class="text-[11px] text-gray-500 mb-1">\u{1F4CA} ${tx("\u5206\u6790\u7ED3\u8BBA", "Verdict")}</div><div class="text-xs text-gray-300">${esc(window.WorldCup.I18n.i18nText(data.verdict.reasonI18n, data.verdict.reason || ""))}</div></div>` : ""}</div>`;
      }
      function renderOddsDivergenceHint(divData) {
        if (!divData || !divData.divergence) return "";
        var direction = divData.direction || "";
        var delta = divData.delta || {};
        var homeDelta = delta.home != null ? (delta.home > 0 ? "+" : "") + (delta.home * 100).toFixed(1) + "%" : "---";
        var awayDelta = delta.away != null ? (delta.away > 0 ? "+" : "") + (delta.away * 100).toFixed(1) + "%" : "---";
        var maxAbs = divData.maxAbsDelta != null ? (divData.maxAbsDelta * 100).toFixed(1) + "%" : "";
        var directionText = "";
        if (direction === "model_home_lean") directionText = tx("\u6A21\u578B\u6BD4\u5E02\u573A\u66F4\u770B\u597D\u4E3B\u961F", "Model leans home vs market");
        else if (direction === "model_away_lean") directionText = tx("\u6A21\u578B\u6BD4\u5E02\u573A\u66F4\u770B\u597D\u5BA2\u961F", "Model leans away vs market");
        else if (direction === "market_home_lean") directionText = tx("\u6A21\u578B\u6BD4\u5E02\u573A\u66F4\u770B\u4F4E\u4E3B\u961F", "Model lower than market on home");
        else if (direction === "market_away_lean") directionText = tx("\u6A21\u578B\u6BD4\u5E02\u573A\u66F4\u770B\u4F4E\u5BA2\u961F", "Model lower than market on away");
        return `<div style="margin-top:6px;padding:6px 10px;background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.15);border-radius:8px;font:400 9px/1.4 Inter,sans-serif;color:rgba(234,179,8,.7)">
            <span style="font-weight:600">&#9888; ${tx("\u6A21\u578B\u4E0E\u5E02\u573A\u5206\u6B67", "Model-vs-Market")} ${esc(maxAbs)}</span>
            <div style="margin-top:3px;font-size:8px;color:rgba(234,179,8,.55)">${esc(directionText)} &middot; ${tx("\u4E3B", "H")}${esc(homeDelta)} / ${tx("\u5BA2", "A")}${esc(awayDelta)} &middot; ${tx("\u6765\u6E90", "src")}: ${esc(divData.source || "---")}</div>
        </div>`;
      }
      window.WorldCup.MatchDetail = { openMatch, switchDetailTab, closeModal, renderVenueWeather, renderMatchWeatherBlock, renderNewsList, renderHeadToHead, renderPreMatchPrediction, renderTacticalScenario, renderCornerAnalysis, renderOddsDivergenceHint };
      window.openMatch = openMatch;
      window.switchDetailTab = switchDetailTab;
      window.closeModal = closeModal;
      var _userVoteUid = null;
      function _saveUid(uid) {
        _userVoteUid = uid;
        try {
          document.cookie = "ps_uid=" + uid + "; path=/; max-age=31536000; SameSite=Lax";
        } catch (e) {
        }
      }
      function _readUid() {
        if (_userVoteUid) return _userVoteUid;
        try {
          var m = document.cookie.match(/(?:^|;\s*)ps_uid=([^;]+)/);
          return m ? m[1].trim() : null;
        } catch (e) {
          return null;
        }
      }
      function castUserVote(matchId, choice) {
        var U = window.WorldCup.Utils || {};
        (U.api || fetch)("" + window.location.origin + "/api/user-predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, choice })
        }).then(function(res) {
          return res.json ? res.json() : res;
        }).then(function(data) {
          if (data.error) {
            console.warn("castUserVote error:", data.error);
            return;
          }
          if (data.uid) _saveUid(data.uid);
          document.querySelectorAll(".vote-btn").forEach(function(btn) {
            btn.classList.remove("ring-2", "ring-indigo-400", "ring-offset-1");
            if (btn.getAttribute("data-choice") === choice) btn.classList.add("ring-2", "ring-indigo-400", "ring-offset-1");
          });
          loadUserVoteAggregate(matchId);
        }).catch(function(e) {
          console.error("castUserVote failed:", e);
        });
      }
      function loadUserVoteAggregate(matchId) {
        var U = window.WorldCup.Utils || {};
        (U.api || fetch)("" + window.location.origin + "/api/user-predictions/" + matchId + "/aggregate").then(function(res) {
          return res.json ? res.json() : res;
        }).then(function(data) {
          if (data.error || !data.totalVotes) return;
          var el = document.getElementById("user-vote-result");
          if (!el) return;
          var p = data.percentages;
          el.innerHTML = '<div class="mb-1.5 font-bold text-white">' + (data.totalVotes || 0) + tx(" \u4EBA\u5DF2\u6295\u7968", " voted") + '</div><div class="grid grid-cols-3 gap-1"><div class="text-center"><div class="text-green-400 font-bold">' + p.home + '%</div><div class="text-[9px] text-gray-500">Home</div></div><div class="text-center"><div class="text-yellow-400 font-bold">' + p.draw + '%</div><div class="text-[9px] text-gray-500">Draw</div></div><div class="text-center"><div class="text-red-400 font-bold">' + p.away + '%</div><div class="text-[9px] text-gray-500">Away</div></div></div>';
        }).catch(function() {
        });
      }
    })();
  }
});

// static/js/team-detail.js
var require_team_detail = __commonJS({
  "static/js/team-detail.js"() {
    (function() {
      "use strict";
      const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
      const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
      const { tx } = window.WorldCup.Utils;
      const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
      const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
      const displayGroupName = (...a) => (window.WorldCup.I18n?.displayGroupName || ((x) => x))(...a);
      const translatePlayerName = (...a) => (window.WorldCup.I18n?.translatePlayerName || ((x) => x))(...a);
      const translateCoachField = (...a) => (window.WorldCup.I18n?.translateCoachField || ((x) => x))(...a);
      let allTeams = [];
      async function refreshTeamsFromStandings() {
        const d = await api("/api/standings");
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
        return allTeams.find((team) => String(team.id) === String(teamId)) || null;
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
          pts: Number(team.pts) || 0
        };
      }
      async function loadTeams2() {
        const el = document.getElementById("teams-grid");
        if (!allTeams.length) {
          el.innerHTML = `<div class="col-span-full text-center py-10" style="color:rgba(248,250,252,.2)">\u26BD ${tx("teamsLoading")}</div>`;
          try {
            await refreshTeamsFromStandings();
          } catch (e) {
            el.innerHTML = `<div class="col-span-full text-center py-10" style="color:rgba(248,113,113,.4)">\u26A0\uFE0F ${tx("teamsError")}</div>`;
            return;
          }
        }
        el.innerHTML = allTeams.map((team) => `
            <div style="background:rgba(0,0,0,.28);backdrop-filter:blur(48px);-webkit-backdrop-filter:blur(48px);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:16px 14px;cursor:pointer;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04);transition:border-color .2s" onmouseover="this.style.borderColor='rgba(52,211,153,.15)'" onmouseout="this.style.borderColor='rgba(255,255,255,.05)'" data-action="open-team-detail" data-team-id="${attr(team.id)}" data-team-name="${attr(team.name)}" data-group="${attr(team.group)}">
                ${team.logo ? `<img src="${attr(team.logo)}" style="width:36px;height:36px;object-fit:contain;margin:0 auto 8px" onerror="this.style.display='none'">` : `<div style="font-size:28px;margin-bottom:8px">\u{1F3F3}\uFE0F</div>`}
                <div style="font:500 14px/1 'Inter';color:#f8fafc;margin-bottom:2px">${esc(displayMaybeTeamName(team))}</div>
                <div style="font:400 9px/1 'Inter';color:rgba(248,250,252,.15);margin-bottom:6px">${esc(displayGroupName(team.group))}</div>
                <div style="display:flex;justify-content:center;gap:8px;font:400 9px/1 'JetBrains Mono',monospace">
                    <span style="padding:2px 7px;border-radius:4px;background:rgba(52,211,153,.06);color:rgba(52,211,153,.5)">${esc(tx("\u79EF\u5206", "Pts"))} <span style="font-weight:600;color:#34d399">${esc(team.pts)}</span></span>
                    <span style="padding:2px 7px;border-radius:4px;background:rgba(255,255,255,.03);color:rgba(248,250,252,.2)">${esc(team.wins)}-${esc(team.draws)}-${esc(team.losses)}</span>
                </div>
            </div>
        `).join("") || `<div class="col-span-full text-center py-10" style="color:rgba(248,250,252,.2)">${esc(tx("teamsLoading"))}</div>`;
      }
      function renderTeamWCMatches(data) {
        const matches = data?.matches;
        if (!matches || !matches.length) return "";
        const resultBadge = (r) => {
          if (r === "W") return `<span style="font:600 11px/1 'JetBrains Mono',monospace;color:#34d399;width:20px;text-align:center">${tx("\u80DC", "W")}</span>`;
          if (r === "D") return `<span style="font:600 11px/1 'JetBrains Mono',monospace;color:#f59e0b;width:20px;text-align:center">${tx("\u5E73", "D")}</span>`;
          if (r === "L") return `<span style="font:600 11px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.6);width:20px;text-align:center">${tx("\u8D1F", "L")}</span>`;
          return `<span style="font:400 11px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1);width:20px;text-align:center">-</span>`;
        };
        const stateLabel = (s) => s === "post" ? `<span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.15)">FT</span>` : s === "in" ? `<span style="font:400 10px/1 'Inter';color:rgba(248,113,113,.6);animation:pulse-live 1.8s infinite">LIVE</span>` : `<span style="font:400 10px/1 'Inter';color:rgba(52,211,153,.4)">${tx("\u5F85\u8D5B", "TBD")}</span>`;
        const rows = matches.map((m) => {
          const opp = m.opponent;
          const oppName = opp ? displayMaybeTeamName(m.opponentNameI18n || opp.nameI18n || opp.name || opp.abbreviation || "?") : "?";
          const score = m.state === "post" || m.state === "in" ? `${m.score?.home ?? "-"} : ${m.score?.away ?? "-"}` : "vs";
          const dateStr = m.dateBJT ? m.dateBJT.split(" ")[0].replace(/\//g, "-") : m.date ? m.date.slice(0, 10) : "";
          const homeAwayLabel = m.isHome ? `<span style="font:400 9px/1 'Inter';color:rgba(52,211,153,.5)">${tx("\u4E3B", "H")}</span>` : `<span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.2)">${tx("\u5BA2", "A")}</span>`;
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='rgba(255,255,255,.02)'" data-action="open-match" data-match-id="${attr(m.matchId)}">${resultBadge(m.result)}${homeAwayLabel}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 12px/1 'Inter';color:rgba(248,250,252,.7)">${esc(oppName)}</span><span style="font:500 13px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.6)">${esc(score)}</span>${stateLabel(m.state)}<span style="font:300 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.15);min-width:54px;text-align:right">${esc(dateStr)}</span></div>`;
        }).join("");
        const completedCount = matches.filter((m) => m.state === "post").length;
        const totalCount = matches.length;
        const note = completedCount > 0 ? tx(`\u672C\u5C4A\u4E16\u754C\u676F \xB7 \u5171 ${totalCount} \u573A \xB7 ${completedCount} \u573A\u5DF2\u7ED3\u675F`, `World Cup \xB7 ${totalCount} matches \xB7 ${completedCount} completed`) : tx(`\u672C\u5C4A\u4E16\u754C\u676F \xB7 \u5171 ${totalCount} \u573A\u8D5B\u7A0B`, `World Cup \xB7 ${totalCount} scheduled`);
        const w = matches.filter((m) => m.result === "W").length;
        const d = matches.filter((m) => m.result === "D").length;
        const l = matches.filter((m) => m.result === "L").length;
        const summaryBar = completedCount > 0 ? `<div style="display:flex;justify-content:center;gap:12px;margin-bottom:10px;font:500 12px/1 'JetBrains Mono',monospace"><span style="color:#34d399">${w}${tx("\u80DC", "W")}</span><span style="color:#f59e0b">${d}${tx("\u5E73", "D")}</span><span style="color:rgba(248,113,113,.6)">${l}${tx("\u8D1F", "L")}</span></div>` : "";
        return `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1px">\u{1F4C5} ${tx("\u672C\u5C4A\u8D5B\u7A0B", "WC Record")}</span><span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.15)">${esc(note)}</span></div>${summaryBar}<div style="display:flex;flex-direction:column;gap:4px">${rows}</div><div style="margin-top:8px;font:400 8px/1 'Inter';color:rgba(248,250,252,.1)">ESPN \u5B9E\u65F6 \xB7 \u4EC5\u542B\u672C\u5C4A\u4E16\u754C\u676F\u6BD4\u8D5B</div></div>`;
      }
      function getRosterRole(p, posGroup, rankInGroup) {
        const apps = p.appearances || 0;
        const subs = p.subIns || 0;
        if (apps > 0) {
          return apps > subs ? "starter" : "keySub";
        }
        if (posGroup === "GK") return rankInGroup === 0 ? "starter" : rankInGroup === 1 ? "keySub" : "reserve";
        if (posGroup === "DF") return rankInGroup < 4 ? "starter" : rankInGroup < 6 ? "keySub" : "reserve";
        if (posGroup === "MF") return rankInGroup < 4 ? "starter" : rankInGroup < 6 ? "keySub" : "reserve";
        if (posGroup === "FW") return rankInGroup < 3 ? "starter" : rankInGroup < 5 ? "keySub" : "reserve";
        return "reserve";
      }
      function renderRosterGroup(label, emoji, players, posGroup) {
        if (!players.length) return "";
        const hasRealData = players.some((p) => (p.appearances || 0) > 0);
        const sorted = [...players].sort((a, b) => {
          if (hasRealData) {
            const d = (b.appearances || 0) - (a.appearances || 0);
            return d !== 0 ? d : (a.subIns || 0) - (b.subIns || 0);
          }
          return (parseInt(a.jersey) || 999) - (parseInt(b.jersey) || 999);
        });
        return `<div class="mb-2"><div style="font:500 8px/1 'JetBrains Mono', monospace;color:rgba(52,211,153,.35);letter-spacing:1px;margin-bottom:8px">${emoji} ${label} (${players.length})</div><div class="grid grid-cols-1 gap-1">${sorted.map((p, idx) => {
          const role = getRosterRole(p, posGroup || p.pos, idx);
          const roleBadge = role === "starter" ? `<span style="font:500 9px/1 'Inter';color:#f59e0b">\u2B50${tx("\u4E3B\u529B", "Start")}</span>` : role === "keySub" ? `<span style="font:500 9px/1 'Inter';color:rgba(52,211,153,.5)">\u{1F504}${tx("\u66FF\u8865", "Sub")}</span>` : "";
          return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='rgba(255,255,255,.02)'" data-action="open-player-detail" data-player-id="${p.id}" data-player-name="${p.name || ""}" data-player-pos="${p.pos || ""}" data-player-jersey="${p.jersey || ""}" data-player-age="${p.age || ""}" data-player-height="${p.height || ""}" data-player-nationality="${p.nationality || ""}"><span style="width:22px;text-align:center;font:400 11px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.2)">#${p.jersey || "?"}</span><span style="flex:1;font:400 12px/1 'Inter';color:rgba(248,250,252,.7)">${translatePlayerName(p.name, p.nameZh)}</span>${roleBadge}<span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${p.pos}</span>${p.age ? `<span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.25)">${p.age}${tx("\u5C81", "")}</span>` : ""}<span style="font:400 11px/1 'Inter';color:rgba(248,250,252,.1)">\u203A</span></div>`;
        }).join("")}</div></div>`;
      }
      function renderTeamRadarChart(canvasId, data) {
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) existingChart.destroy();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const uiLang2 = window.WorldCup.State?.uiLang || "zh";
        const labels = uiLang2 === "en" ? ["Attack", "Defense", "Possession", "Physical", "Discipline"] : ["\u8FDB\u653B", "\u9632\u5B88", "\u63A7\u7403", "\u4F53\u80FD", "\u7EAA\u5F8B"];
        const values = [data.attack || 70, data.defense || 70, data.possession || 70, data.physical || 70, data.discipline || 70];
        new Chart(ctx, { type: "radar", data: { labels, datasets: [{ label: tx("\u7403\u961F\u80FD\u529B", "Team Ability"), data: values, backgroundColor: "rgba(52, 211, 153, 0.12)", borderColor: "#34d399", borderWidth: 1.5, pointBackgroundColor: "#34d399", pointBorderColor: "#0f172a", pointHoverBackgroundColor: "#0f172a", pointHoverBorderColor: "#34d399" }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: "rgba(255, 255, 255, 0.06)" }, pointLabels: { color: "rgba(248, 250, 252, 0.35)", font: { size: 9 } } } } } });
      }
      function renderPlayerRadarChart(canvasId, data) {
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) existingChart.destroy();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const uiLang2 = window.WorldCup.State?.uiLang || "zh";
        const labels = uiLang2 === "en" ? ["Attack", "Defense", "Physical", "Form", "Experience"] : ["\u8FDB\u653B", "\u9632\u5B88", "\u8EAB\u4F53", "\u72B6\u6001", "\u7ECF\u9A8C"];
        const values = [data.attack || 70, data.defense || 70, data.physical || 70, data.form || 70, data.experience || 70];
        new Chart(ctx, { type: "radar", data: { labels, datasets: [{ label: tx("\u7403\u5458\u80FD\u529B", "Player Ability"), data: values, backgroundColor: "rgba(52, 211, 153, 0.10)", borderColor: "rgba(52, 211, 153, 0.6)", borderWidth: 1.5, pointBackgroundColor: "#34d399", pointBorderColor: "#0f172a", pointHoverBackgroundColor: "#0f172a", pointHoverBorderColor: "#34d399" }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: "rgba(255, 255, 255, 0.06)" }, pointLabels: { color: "rgba(248, 250, 252, 0.35)", font: { size: 9 } } } } } });
      }
      function renderTeamBasic(teamData, coachData, teamName, group) {
        let html = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">${teamData?.logo ? `<img src="${teamData.logo}" style="width:40px;height:40px;object-fit:contain">` : ""}<div><h3 style="font:600 18px/1 'Inter';color:#f8fafc">${teamName}</h3><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">${group} \xB7 ${teamData?.record || "\u6218\u7EE9\u672A\u77E5"}</div></div></div>`;
        if (coachData && !coachData.error) {
          html += `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px;margin-bottom:12px">
                <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1px;margin-bottom:10px">\u{1F9E0} ${tx("\u6559\u7EC3", "Coach")}</div>
                <div style="font:500 13px/1 'Inter';color:rgba(248,250,252,.7);margin-bottom:2px">${translateCoachField(coachData.name, "name")} <span style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25)">${translateCoachField(coachData.nationality, "nationality")}</span></div>
                <div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.35);margin-bottom:10px">${translateCoachField(coachData.style, "style")} \xB7 ${coachData.styleDetail || ""}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx("\u6267\u6559\u65F6\u957F", "Tenure")}</div><div style="font-weight:600;color:rgba(248,250,252,.6)">${translateCoachField(coachData.tenure || coachData.since, "tenure")}</div></div>
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx("\u80DC\u7387", "Win Rate")}</div><div style="font-weight:600;color:#34d399">${coachData.winRate}</div></div>
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx("\u5E38\u7528\u9635\u578B", "Formation")}</div><div style="font-weight:600;color:rgba(248,250,252,.6)">${(coachData.formation || []).join(" / ")}</div></div>
                    <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.03);border-radius:8px;padding:8px 10px"><div style="color:rgba(248,250,252,.25);margin-bottom:2px">${tx("\u4E34\u573A\u8C03\u6574", "In-game Adjustments")}</div><div style="font-weight:600;color:rgba(248,250,252,.6)">${coachData.adjustment?.substring(0, 20) || tx("\u4E2D\u7B49", "Medium")}...</div></div>
                </div>
                <div style="margin-top:8px;font:400 10px/1 'Inter';color:rgba(248,250,252,.25)"><span style="color:rgba(248,250,252,.15)">${tx("\u5927\u8D5B", "Tournaments")}: </span>${coachData.bigTournament || tx("\u6682\u65E0", "None")}</div>
                <div style="margin-top:2px;font:400 10px/1 'Inter';color:rgba(248,250,252,.25)"><span style="color:rgba(248,250,252,.15)">${tx("\u7279\u70B9", "Notes")}: </span>${coachData.notes || ""}</div>
            </div>`;
        }
        const roster = teamData?.roster || [];
        if (roster.length) {
          const gk = roster.filter((p) => p.pos === "G" || p.pos === "GK");
          const def = roster.filter((p) => ["D", "CB", "LB", "RB"].includes(p.pos));
          const mid = roster.filter((p) => ["M", "CM", "CDM", "CAM"].includes(p.pos));
          const fwd = roster.filter((p) => ["F", "FW", "ST", "LW", "RW"].includes(p.pos));
          const other = roster.filter((p) => ![...gk, ...def, ...mid, ...fwd].includes(p));
          html += `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px">
                <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1px;margin-bottom:10px">\u{1F465} ${tx("\u5927\u540D\u5355", "Roster")} (${roster.length}${tx("\u4EBA", "")})</div>
                ${renderRosterGroup(tx("\u95E8\u5C06", "Goalkeepers"), "\u{1F9E4}", gk)}${renderRosterGroup(tx("\u540E\u536B", "Defenders"), "\u{1F6E1}\uFE0F", def)}${renderRosterGroup(tx("\u4E2D\u573A", "Midfielders"), "\u{1F3AF}", mid)}${renderRosterGroup(tx("\u524D\u950B", "Forwards"), "\u26A1", fwd)}${renderRosterGroup(tx("\u5176\u4ED6", "Other"), "\u{1F4CB}", other)}
            </div>`;
        } else {
          html += `<div style="color:rgba(248,250,252,.2);font-size:13px;text-align:center;padding:20px 0">${tx("\u9635\u5BB9\u6570\u636E\u6682\u672A\u516C\u5E03", "Roster data has not been released")}</div>`;
        }
        return html;
      }
      async function openTeamDetail(teamId, teamName, group) {
        const modal = document.getElementById("team-modal");
        const content = document.getElementById("team-modal-content");
        modal.classList.remove("hidden");
        content.innerHTML = '<div class="py-10 text-center" style="color:rgba(248,250,252,.2)">\u52A0\u8F7D\u4E2D...</div>';
        await refreshTeamsFromStandings();
        const standingTeam = findTeamStanding(teamId);
        const liveGroup = standingTeam?.group || group;
        const liveGroupRecord = groupRecordFromStanding(standingTeam);
        const [enhancedData, wcMatches] = await window.WorldCup.ApiClient.allData(["/api/team/" + teamId + "/enhanced", "/api/team/" + teamId + "/recent-matches"]);
        if (enhancedData && !enhancedData.error) {
          const wcGroupRecord = (() => {
            const ms = wcMatches?.matches?.filter((m) => m.stage === "group" && m.state === "post");
            if (!ms?.length) return null;
            const w = ms.filter((m) => m.result === "W").length;
            const d = ms.filter((m) => m.result === "D").length;
            const l = ms.filter((m) => m.result === "L").length;
            let gf = 0, ga = 0;
            ms.forEach((m) => {
              const hs = Number(m.score?.home || 0), as_ = Number(m.score?.away || 0);
              if (m.isHome) {
                gf += hs;
                ga += as_;
              } else {
                gf += as_;
                ga += hs;
              }
            });
            return { w, d, l, gf, ga, gd: gf - ga, pts: w * 3 + d };
          })();
          const finalGroupRecord = wcGroupRecord || liveGroupRecord;
          if (finalGroupRecord) {
            enhancedData.overview || (enhancedData.overview = {});
            enhancedData.overview.group = liveGroup;
            enhancedData.overview.groupRecord = finalGroupRecord;
          }
          content.innerHTML = renderTeamEnhanced(enhancedData, liveGroup, wcMatches);
          setTimeout(() => {
            const r = enhancedData.radar;
            if (r) {
              renderTeamRadarChart("team-radar-chart", { attack: r.attack, defense: r.defense, possession: r.possession, physical: Math.round((r.pace + r.stamina) / 2), discipline: r.tactics });
            } else if (enhancedData.recentForm) {
              renderTeamRadarChart("team-radar-chart", { attack: parseFloat(enhancedData.recentForm.attack?.avgGoals || 1.5) * 40, defense: 100 - parseFloat(enhancedData.recentForm.defense?.avgConceded || 1) * 40, possession: parseFloat(enhancedData.recentForm.possession?.avgPossession || 50), physical: 70, discipline: 70 });
            }
          }, 100);
        } else {
          const [teamData, coachData] = await window.WorldCup.ApiClient.allData(["/api/team/" + teamId, "/api/coach/" + teamId]);
          if (teamData && liveGroupRecord) teamData.groupRecord = liveGroupRecord;
          content.innerHTML = renderTeamBasic(teamData, coachData, teamName, liveGroup);
        }
      }
      function renderTeamEnhanced(d, group, wcMatchData) {
        const getWinRateColor = (winRate) => winRate >= 0.6 ? "#34d399" : winRate >= 0.4 ? "#f59e0b" : "rgba(248,113,113,.6)";
        const getRankingColor = (ranking) => ranking <= 10 ? "#34d399" : ranking <= 30 ? "#f59e0b" : "rgba(248,113,113,.5)";
        const card = "background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:12px 16px";
        const secHdr = "font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1px;margin-bottom:10px";
        let h = `<div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:center;gap:12px">${d.logo ? `<img src="${d.logo}" style="width:40px;height:40px;object-fit:contain">` : ""}<div><h3 style="font:600 18px/1 'Inter';color:#f8fafc">${displayMaybeTeamName(d)}</h3><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">${displayGroupName(group)} \xB7 ${d.shortName || ""}</div></div></div>`;
        if (d.overview) {
          h += `<div style="${card}"><div style="${secHdr}">\u{1F4CA} ${tx("\u7403\u961F\u6982\u51B5", "Team Overview")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx("\u4E16\u754C\u6392\u540D", "World Rank")}</span><span style="font-weight:600;margin-left:4px;color:${getRankingColor(d.overview.worldRanking)}">#${d.overview.worldRanking || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("FIFA\u79EF\u5206", "FIFA Points")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.overview.fifaPoints || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u5E02\u503C", "Market Value")}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.overview.marketValue || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u5E73\u5747\u5E74\u9F84", "Avg Age")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.overview.avgAge || "?"}${tx("\u5C81", "")}</span></div></div>`;
          if (d.overview.groupRecord) {
            h += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)"><div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:6px">${tx("\u5C0F\u7EC4\u8D5B\u6218\u7EE9", "Group Record")}</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;font:500 12px/1 'Inter'"><div style="color:#34d399">${d.overview.groupRecord.w || 0}${tx("\u80DC", "W")}</div><div style="color:#f59e0b">${d.overview.groupRecord.d || 0}${tx("\u5E73", "D")}</div><div style="color:rgba(248,113,113,.6)">${d.overview.groupRecord.l || 0}${tx("\u8D1F", "L")}</div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;font:400 11px/1 'Inter';margin-top:4px"><div><span style="color:rgba(248,250,252,.25)">${tx("\u8FDB\u7403", "GF")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.overview.groupRecord.gf || 0}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u5931\u7403", "GA")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.overview.groupRecord.ga || 0}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u79EF\u5206", "Pts")}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.overview.groupRecord.pts || 0}</span></div></div></div>`;
          }
          h += `</div>`;
        }
        h += `<div style="${card}"><div style="${secHdr}">\u{1F4CA} ${tx("\u80FD\u529B\u96F7\u8FBE\u56FE", "Ability Radar")}</div><div style="height:200px"><canvas id="team-radar-chart"></canvas></div></div>`;
        if (d.recentForm) {
          h += `<div style="${card}"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="${secHdr}margin-bottom:0">\u{1F4C8} ${tx("\u8FD1\u671F\u8868\u73B0", "Recent Form")}</span><span style="font:500 11px/1 'Inter';color:${getWinRateColor(parseFloat(d.recentForm.winRate))}">${tx("\u80DC\u7387", "Win Rate")} ${Math.round(parseFloat(d.recentForm.winRate) * 100)}%</span></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;font:500 12px/1 'Inter';margin-bottom:8px"><div style="color:#34d399">${d.recentForm.last10?.w || 0}${tx("\u80DC", "W")}</div><div style="color:#f59e0b">${d.recentForm.last10?.d || 0}${tx("\u5E73", "D")}</div><div style="color:rgba(248,113,113,.6)">${d.recentForm.last10?.l || 0}${tx("\u8D1F", "L")}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx("\u573A\u5747\u8FDB\u7403", "Avg Goals")}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.recentForm.attack?.avgGoals || "-"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u573A\u5747\u5931\u7403", "Avg Conceded")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,113,113,.5)">${d.recentForm.defense?.avgConceded || "-"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u63A7\u7403\u7387", "Possession")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.recentForm.possession?.avgPossession || "-"}%</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u4F20\u7403\u6210\u529F\u7387", "Pass Accuracy")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.recentForm.possession?.passAccuracy ? Math.round(parseFloat(d.recentForm.possession.passAccuracy) * 100) + "%" : "-"}</span></div></div><div style="margin-top:8px;font:400 10px/1 'Inter';color:rgba(248,250,252,.15)">${tx("\u8D8B\u52BF", "Trend")}: ${d.recentForm.trend || tx("\u8868\u73B0\u7A33\u5B9A", "Stable")}</div></div>`;
        }
        if (d.coach) {
          h += `<div style="${card}"><div style="${secHdr}">\u{1F9E0} ${tx("\u6559\u7EC3", "Coach")}</div><div style="font:500 13px/1 'Inter';color:rgba(248,250,252,.7);margin-bottom:2px">${translateCoachField(d.coach.name, "name")} <span style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25)">${translateCoachField(d.coach.nationality, "nationality")}</span></div><div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.35);margin-bottom:10px">${translateCoachField(d.coach.style, "style") || ""}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx("\u6267\u6559\u65F6\u957F", "Tenure")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.coach.tenure || d.coach.since || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u80DC\u7387", "Win Rate")}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.coach.winRate || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u5E38\u7528\u9635\u578B", "Formation")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${(d.coach.formation || []).join(" / ") || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u5927\u8D5B\u7ECF\u9A8C", "Tournament Exp.")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.coach.bigTournament ? "\u2713" : "?"}</span></div></div></div>`;
        }
        if (d.squadChanges) {
          h += `<div style="${card}"><div style="${secHdr}">\u{1F504} ${tx("\u7403\u961F\u52A8\u6001", "Team News")}</div>`;
          if (d.squadChanges.injuries?.length) h += `<div style="margin-bottom:8px"><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:4px">\u{1F3E5} ${tx("\u4F24\u75C5", "Injuries")}</div>${d.squadChanges.injuries.map((i) => `<div style="font:400 11px/1 'Inter';color:rgba(248,113,113,.5)">\u2022 ${i.player || "?"} (${i.pos || "?"}) - ${i.issue || "?"}</div>`).join("")}</div>`;
          if (d.squadChanges.suspended?.length) h += `<div style="margin-bottom:8px"><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:4px">\u{1F6AB} ${tx("\u505C\u8D5B", "Suspensions")}</div>${d.squadChanges.suspended.map((s) => `<div style="font:400 11px/1 'Inter';color:#f59e0b">\u2022 ${s.player || "?"} (${s.pos || "?"}) - ${s.reason || "?"}</div>`).join("")}</div>`;
          if (d.squadChanges.watchPoints?.length) h += `<div><div style="font:400 10px/1 'Inter';color:rgba(248,250,252,.25);margin-bottom:4px">\u26A0\uFE0F ${tx("\u5173\u6CE8\u70B9", "Watch Points")}</div>${d.squadChanges.watchPoints.map((w) => `<div style="font:400 11px/1 'Inter';color:rgba(251,146,60,.5)">\u2022 ${w}</div>`).join("")}</div>`;
          if (!d.squadChanges.injuries?.length && !d.squadChanges.suspended?.length && !d.squadChanges.watchPoints?.length) h += `<div style="font:400 11px/1 'Inter';color:rgba(248,250,252,.15)">${tx("\u6682\u65E0\u91CD\u5927\u52A8\u6001", "No major updates")}</div>`;
          h += `</div>`;
        }
        if (d.tournamentHistory) {
          h += `<div style="${card}"><div style="${secHdr}">\u{1F3C6} ${tx("\u5927\u8D5B\u5386\u53F2", "Tournament History")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 11px/1 'Inter'"><div><span style="color:rgba(248,250,252,.25)">${tx("\u53C2\u8D5B\u6B21\u6570", "Appearances")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.tournamentHistory.worldCupApps || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u6700\u4F73\u6210\u7EE9", "Best Finish")}</span><span style="font-weight:600;margin-left:4px;color:#34d399">${d.tournamentHistory.bestResult || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u4E0A\u5C4A\u6210\u7EE9", "Last Edition")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.tournamentHistory.lastEdition || "?"}</span></div><div><span style="color:rgba(248,250,252,.25)">${tx("\u7D2F\u8BA1\u6218\u7EE9", "All-time Record")}</span><span style="font-weight:600;margin-left:4px;color:rgba(248,250,252,.6)">${d.tournamentHistory.allTimeRecord ? `${d.tournamentHistory.allTimeRecord.w}${tx("\u80DC", "W")} ${d.tournamentHistory.allTimeRecord.d}${tx("\u5E73", "D")} ${d.tournamentHistory.allTimeRecord.l}${tx("\u8D1F", "L")}` : "?"}</span></div></div></div>`;
        }
        if (d.roster?.length) {
          h += `<div style="${card}"><div style="${secHdr}">\u{1F465} ${tx("\u5927\u540D\u5355", "Roster")} (${d.roster.length}${tx("\u4EBA", "")})</div>${renderRosterGroup(tx("\u95E8\u5C06", "Goalkeepers"), "\u{1F9E4}", d.roster.filter((p) => p.pos === "G" || p.pos === "GK"), "GK")}${renderRosterGroup(tx("\u540E\u536B", "Defenders"), "\u{1F6E1}\uFE0F", d.roster.filter((p) => ["D", "CB", "LB", "RB", "LWB", "RWB"].includes(p.pos)), "DF")}${renderRosterGroup(tx("\u4E2D\u573A", "Midfielders"), "\u{1F3AF}", d.roster.filter((p) => ["M", "CM", "CDM", "CAM", "LM", "RM"].includes(p.pos)), "MF")}${renderRosterGroup(tx("\u524D\u950B", "Forwards"), "\u26A1", d.roster.filter((p) => ["F", "FW", "ST", "LW", "RW", "CF"].includes(p.pos)), "FW")}</div>`;
        }
        h += renderTeamWCMatches(wcMatchData);
        return h + `</div>`;
      }
      function closeTeamModal() {
        document.getElementById("team-modal").classList.add("hidden");
      }
      const ns = window.WorldCup.TeamDetail = {
        loadTeams: loadTeams2,
        openTeamDetail,
        closeTeamModal,
        refreshTeamsFromStandings,
        renderTeamRadarChart,
        renderPlayerRadarChart
      };
      Object.assign(window, { loadTeams: loadTeams2, openTeamDetail, closeTeamModal, refreshTeamsFromStandings });
    })();
  }
});

// static/js/elo-prediction.js
var require_elo_prediction = __commonJS({
  "static/js/elo-prediction.js"() {
    (function() {
      "use strict";
      const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
      const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
      const { tx } = window.WorldCup.Utils;
      const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
      const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
      const displayGroupName = (...a) => (window.WorldCup.I18n?.displayGroupName || ((x) => x))(...a);
      const Fmt2 = () => window.WorldCup.Fmt || window.WorldCup.Formatters || window.Fmt || {};
      function pctLabel(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return "\u2014";
        return `${Math.round(n * 100)}%`;
      }
      function pctDelta(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return "\u2014";
        const pct = n * 100;
        return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}pp`;
      }
      function divergenceScore(divergence) {
        if (!divergence || divergence.error || !divergence.marketProbs) return -1;
        const direct = Number(divergence.maxAbsDelta);
        if (Number.isFinite(direct)) return direct;
        const delta = divergence.delta || {};
        return Math.max(
          Math.abs(Number(delta.home) || 0),
          Math.abs(Number(delta.draw) || 0),
          Math.abs(Number(delta.away) || 0)
        );
      }
      function renderProbabilityMiniRow(probs, labels) {
        if (!probs) return `<div style="color:rgba(248,250,252,.28);font-size:10px;line-height:1.5">${tx("\u6682\u65E0\u5E02\u573A\u6570\u636E", "No market data")}</div>`;
        return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">
            <div><div style="color:rgba(248,250,252,.25);font-size:9px">${esc(labels.home)}</div><div style="font:600 12px/1.2 'JetBrains Mono',monospace;color:#34d399">${pctLabel(probs.home)}</div></div>
            <div><div style="color:rgba(248,250,252,.25);font-size:9px">${esc(labels.draw)}</div><div style="font:600 12px/1.2 'JetBrains Mono',monospace;color:#facc15">${pctLabel(probs.draw)}</div></div>
            <div><div style="color:rgba(248,250,252,.25);font-size:9px">${esc(labels.away)}</div><div style="font:600 12px/1.2 'JetBrains Mono',monospace;color:#f87171">${pctLabel(probs.away)}</div></div>
        </div>`;
      }
      function renderMarketDivergencePanel(modelProbs, divergence) {
        const hasMarket = divergence && !divergence.error && divergence.marketProbs;
        const score = divergenceScore(divergence);
        const scorePct = score >= 0 ? `${(score * 100).toFixed(1)}pp` : "\u2014";
        const delta = divergence?.delta || {};
        const direction = divergence?.direction || "none";
        let directionText = tx("\u5E02\u573A\u6570\u636E\u4E0D\u8DB3\uFF0C\u6682\u4E0D\u6392\u5E8F", "Market data unavailable");
        if (direction === "model_home_lean") directionText = tx("\u6A21\u578B\u66F4\u770B\u597D\u4E3B\u961F", "Model leans home");
        else if (direction === "model_away_lean") directionText = tx("\u6A21\u578B\u66F4\u770B\u597D\u5BA2\u961F", "Model leans away");
        else if (direction === "market_home_lean") directionText = tx("\u5E02\u573A\u66F4\u770B\u597D\u4E3B\u961F", "Market leans home");
        else if (direction === "market_away_lean") directionText = tx("\u5E02\u573A\u66F4\u770B\u597D\u5BA2\u961F", "Market leans away");
        else if (hasMarket) directionText = tx("\u6A21\u578B\u4E0E\u5E02\u573A\u57FA\u672C\u4E00\u81F4", "Model and market aligned");
        const flagCls = hasMarket && divergence.divergence ? "color:#fbbf24;background:rgba(251,191,36,.10);border-color:rgba(251,191,36,.24)" : hasMarket ? "color:#94a3b8;background:rgba(148,163,184,.08);border-color:rgba(148,163,184,.16)" : "color:rgba(248,250,252,.32);background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.06)";
        return `<div class="market-divergence-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px;min-width:0">
            <div style="border:1px solid rgba(59,130,246,.14);background:rgba(59,130,246,.05);border-radius:10px;padding:8px">
                <div style="font:700 10px/1 'Inter';color:#93c5fd;margin-bottom:7px">\u2460 ${tx("\u6A21\u578B\u9884\u6D4B", "Model")}</div>
                ${renderProbabilityMiniRow(modelProbs, { home: tx("\u4E3B", "H"), draw: tx("\u5E73", "D"), away: tx("\u5BA2", "A") })}
            </div>
            <div style="border:1px solid rgba(16,185,129,.14);background:rgba(16,185,129,.045);border-radius:10px;padding:8px">
                <div style="font:700 10px/1 'Inter';color:#6ee7b7;margin-bottom:7px">\u2461 ${tx("\u5E02\u573A\u53C2\u8003", "Market")}</div>
                ${renderProbabilityMiniRow(hasMarket ? divergence.marketProbs : null, { home: tx("\u4E3B", "H"), draw: tx("\u5E73", "D"), away: tx("\u5BA2", "A") })}
                <div style="font-size:8px;color:rgba(248,250,252,.22);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(hasMarket ? divergence.source || "market" : tx("\u672A\u914D\u7F6E\u8D54\u7387 Key \u6216\u65E0\u76D8\u53E3", "No odds key / market"))}</div>
            </div>
            <div style="border:1px solid;border-radius:10px;padding:8px;${flagCls}">
                <div style="font:700 10px/1 'Inter';margin-bottom:7px">\u2462 ${tx("\u5206\u6B67\u6307\u6570", "Divergence")}</div>
                <div style="font:700 18px/1 'JetBrains Mono',monospace">${esc(scorePct)}</div>
                <div style="font-size:9px;line-height:1.4;margin-top:5px">${esc(directionText)}</div>
                <div style="font-size:8px;opacity:.72;margin-top:4px">${tx("\u4E3B", "H")} ${pctDelta(delta.home)} \xB7 ${tx("\u5E73", "D")} ${pctDelta(delta.draw)} \xB7 ${tx("\u5BA2", "A")} ${pctDelta(delta.away)}</div>
            </div>
        </div>`;
      }
      function pctMetric(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return "\u2014";
        return `${(n * 100).toFixed(1)}%`;
      }
      function renderCalibrationReport(report) {
        const metrics = report?.metrics || {};
        const buckets = Array.isArray(report?.buckets) ? report.buckets : [];
        const hasData = Number(report?.sampleSize || 0) > 0;
        const bars = buckets.map((b) => {
          const acc = Number(b.accuracy);
          const conf = Number(b.avgConfidence);
          const accPct = Number.isFinite(acc) ? Math.round(acc * 100) : 0;
          const confPct = Number.isFinite(conf) ? Math.round(conf * 100) : 0;
          const label = `${Math.round((b.range?.[0] || 0) * 100)}-${Math.round((b.range?.[1] || 0) * 100)}%`;
          return `<div style="display:grid;grid-template-columns:46px 1fr 38px;align-items:center;gap:8px;min-height:18px">
                <div style="font:500 9px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.32)">${esc(label)}</div>
                <div style="height:7px;background:rgba(255,255,255,.06);border-radius:999px;position:relative;overflow:hidden">
                    <div style="position:absolute;left:0;top:0;bottom:0;width:${accPct}%;background:#34d399;border-radius:999px"></div>
                    <div style="position:absolute;left:${confPct}%;top:-2px;bottom:-2px;width:2px;background:#facc15"></div>
                </div>
                <div style="font:600 9px/1 'JetBrains Mono',monospace;color:${b.count ? "#cbd5e1" : "rgba(248,250,252,.2)"}">${b.count || 0}</div>
            </div>`;
        }).join("");
        return `<div class="pred-section" style="padding:16px;margin-bottom:12px">
            <div class="pred-section-title text-cyan-400" style="font-family:'DM Sans',sans-serif">
                <span class="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xs flex-shrink-0">\u{1F4C8}</span>${tx("\u6A21\u578B\u8868\u73B0", "Model Performance")}
            </div>
            ${hasData ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px">
                <div class="glass-light rounded-lg p-2"><div style="font-size:9px;color:rgba(248,250,252,.35);margin-bottom:3px">Brier</div><div style="font:700 16px/1 'JetBrains Mono',monospace;color:#f8fafc">${metrics.brier ?? "\u2014"}</div></div>
                <div class="glass-light rounded-lg p-2"><div style="font-size:9px;color:rgba(248,250,252,.35);margin-bottom:3px">${tx("\u65B9\u5411\u51C6\u786E\u7387", "Accuracy")}</div><div style="font:700 16px/1 'JetBrains Mono',monospace;color:#34d399">${pctMetric(metrics.accuracy)}</div></div>
                <div class="glass-light rounded-lg p-2"><div style="font-size:9px;color:rgba(248,250,252,.35);margin-bottom:3px">ECE</div><div style="font:700 16px/1 'JetBrains Mono',monospace;color:#facc15">${pctMetric(metrics.expectedCalibrationError)}</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:10px;color:rgba(248,250,252,.38)">
                <span>${tx("\u6837\u672C", "Sample")} ${report.sampleSize}</span>
                <span style="display:flex;align-items:center;gap:4px"><i style="width:12px;height:6px;background:#34d399;border-radius:999px"></i>${tx("\u5B9E\u9645\u547D\u4E2D", "Actual")}</span>
                <span style="display:flex;align-items:center;gap:4px"><i style="width:2px;height:10px;background:#facc15"></i>${tx("\u5E73\u5747\u7F6E\u4FE1", "Confidence")}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:5px">${bars}</div>
            <div style="font-size:10px;color:rgba(248,250,252,.32);margin-top:10px">${report.platt?.available ? `Platt a=${report.platt.slope}, b=${report.platt.intercept}` : tx("\u6837\u672C\u4E0D\u8DB3\u65F6\u4EC5\u5C55\u793A\u89C2\u6D4B\u6821\u51C6\u6876\u3002", "Shows observed calibration buckets until enough samples exist.")}</div>` : `<div class="glass-light rounded-lg p-3 text-xs text-gray-400">${tx("\u6682\u65E0\u5DF2\u5B8C\u8D5B\u5FEB\u7167\u6837\u672C\uFF1B\u8D5B\u540E\u590D\u76D8\u5199\u56DE\u540E\u4F1A\u81EA\u52A8\u751F\u6210\u6821\u51C6\u62A5\u544A\u3002", "No completed forecast snapshots yet; calibration appears after post-match reviews are written back.")}</div>`}
        </div>`;
      }
      function buildEloTable(rankings) {
        let h = "";
        h += `<div class="pred-section-title text-purple-400" style="font-family:'DM Sans',sans-serif">
            <span class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs flex-shrink-0">\u26A1</span>${tx("Elo \u5B9E\u529B\u6392\u540D", "Elo Rankings")}
        </div>`;
        h += `<div style="display:grid;grid-template-columns:36px 1fr 70px 80px;gap:6px;align-items:center;padding:4px 8px;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,.04)">
            <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15)">#</span>
            <span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.15)">${esc(tx("\u7403\u961F", "Team"))}</span>
            <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15);text-align:right">Elo</span>
            <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.15);text-align:right">${esc(tx("\u51FA\u7EBF", "Qual."))}</span>
        </div>`;
        rankings.slice(0, 10).forEach((t, i) => {
          const barWidth = Math.min(100, Math.max(5, Math.round((t.rating - 1400) / 6)));
          const prevRank = t.previousRank || t.prevRank || null;
          let changeHtml = '<span style="color:rgba(248,250,252,.15);font-size:10px">\u2014</span>';
          if (prevRank && prevRank !== t.rank) {
            const diff = prevRank - t.rank;
            changeHtml = diff > 0 ? `<span style="color:#22c55e;font-size:10px;font-weight:600">\u25B2${diff}</span>` : `<span style="color:#ef4444;font-size:10px;font-weight:600">\u25BC${Math.abs(diff)}</span>`;
          } else if (t.change > 0) {
            changeHtml = `<span style="color:#22c55e;font-size:10px;font-weight:600">\u25B2${t.change}</span>`;
          } else if (t.change < 0) {
            changeHtml = `<span style="color:#ef4444;font-size:10px;font-weight:600">\u25BC${Math.abs(t.change)}</span>`;
          }
          const rankColor = i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : "rgba(248,250,252,.25)";
          const eloFlag = t.flag || "\u{1F3F3}\uFE0F";
          const qualifyPct = t.qualifyProb ? Math.round(t.qualifyProb * 100) : null;
          h += `<div style="display:grid;grid-template-columns:36px 1fr 70px 80px;gap:6px;align-items:center;padding:5px 8px;border-radius:6px;transition:background .15s" class="hover:bg-white/[0.03]">
                <span style="font:600 11px/1 'JetBrains Mono', monospace;color:${rankColor}">${t.rank}</span>
                <div style="display:flex;align-items:center;gap:6px;min-width:0">
                    <span style="font-size:14px;width:18px;flex-shrink:0;text-align:center">${eloFlag}</span>
                    <span style="font:500 12px/1 'Inter';color:#f8fafc;truncate;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(displayMaybeTeamName(t))}">${esc(displayMaybeTeamName(t))}</span>
                    ${changeHtml}
                </div>
                <div style="text-align:right">
                    <span style="font:500 12px/1 'JetBrains Mono', monospace;color:#a78bfa">${t.rating}</span>
                    <div style="height:3px;border-radius:2px;background:rgba(255,255,255,.06);margin-top:2px;overflow:hidden">
                        <div style="height:100%;border-radius:2px;background:linear-gradient(90deg,#059669,#34d399);width:${barWidth}%;transition:width .8s ease"></div>
                    </div>
                </div>
                <div style="text-align:right">
                    ${qualifyPct !== null ? `<span style="font:500 11px/1 'JetBrains Mono', monospace;color:${qualifyPct >= 70 ? "#34d399" : qualifyPct >= 40 ? "#f59e0b" : "rgba(248,250,252,.3)"}">${qualifyPct}%</span><div style="height:3px;border-radius:2px;background:rgba(255,255,255,.06);margin-top:2px;overflow:hidden"><div style="height:100%;border-radius:2px;background:${qualifyPct >= 70 ? "rgba(52,211,153,.4)" : qualifyPct >= 40 ? "rgba(245,158,11,.3)" : "rgba(255,255,255,.08)"};width:${qualifyPct}%;transition:width .8s ease"></div></div>` : '<span style="color:rgba(248,250,252,.1)">\u2014</span>'}
                </div>
            </div>`;
        });
        return h;
      }
      async function buildPredictionCards(upcoming, startIdx) {
        let h = "";
        const predPromises = upcoming.map((m) => api(`/api/predict/${m.id}`).catch(() => null));
        const divergencePromises = upcoming.map((m) => api(`/api/odds-divergence/${m.id}`).catch(() => null));
        const [predictions, divergences] = await Promise.all([
          Promise.all(predPromises),
          Promise.all(divergencePromises)
        ]);
        const rows = upcoming.map((match, originalIndex) => {
          const divergence = divergences[originalIndex]?.data || divergences[originalIndex];
          return {
            match,
            prediction: predictions[originalIndex]?.data || predictions[originalIndex],
            divergence,
            originalIndex,
            divergenceScore: divergenceScore(divergence)
          };
        }).sort((a, b) => {
          if (b.divergenceScore !== a.divergenceScore) return b.divergenceScore - a.divergenceScore;
          return a.originalIndex - b.originalIndex;
        });
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const m = row.match;
          const pred = row.prediction;
          const idx = startIdx + row.originalIndex;
          if (pred && !pred.error && pred.homeWin !== void 0) {
            const p = pred;
            const hw = Fmt2().pctBar(p.homeWin);
            const dr = Fmt2().pctBar(p.draw);
            const aw = Fmt2().pctBar(p.awayWin);
            const modelProbs = {
              home: Number(p.homeWin || p.homeWinProb || 0),
              draw: Number(p.draw || p.drawProb || 0),
              away: Number(p.awayWin || p.awayWinProb || 0)
            };
            const comps = p.components || {};
            const compConfs = [comps.elo, comps.poisson, comps.coach, comps.venue, comps.odds].filter(Boolean).map((c) => Fmt2().safeNum(c.confidence, 0));
            const conf = compConfs.length ? Math.round(compConfs.reduce((a, b) => a + b, 0) / compConfs.length * 100) : 65;
            const homeName = displayMaybeTeamName(pred.match?.homeNameI18n || pred.match?.homeName || m.home);
            const awayName = displayMaybeTeamName(pred.match?.awayNameI18n || pred.match?.awayName || m.away);
            const homeFlag = m.home.flag || pred.match?.homeFlag || "\u{1F3F3}\uFE0F";
            const awayFlag = m.away.flag || pred.match?.awayFlag || "\u{1F3F3}\uFE0F";
            const expectedHome = Number(p.goals?.homeExpected);
            const expectedAway = Number(p.goals?.awayExpected);
            const fallbackScore = Number.isFinite(expectedHome) && Number.isFinite(expectedAway) ? `${Math.max(0, Math.round(expectedHome))}-${Math.max(0, Math.round(expectedAway))}` : `${hw > aw ? 1 : 0}-${aw > hw ? 1 : 0}`;
            const score = pred.likelyScore != null && pred.likelyScore !== "" ? pred.likelyScore : fallbackScore;
            const confCls = conf > 70 ? "bg-green-500/20 text-green-400" : conf > 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-500/20 text-gray-400";
            const eloPred = p.components?.elo || { home: 0, draw: 0, away: 0 };
            const poissonPred = p.components?.poisson || { home: 0, draw: 0, away: 0 };
            const coachPred = p.components?.coach || {};
            const weights = pred.weights || { elo: 0.3, poisson: 0.25, coach: 0.15, venue: 0.1, odds: 0.2 };
            const topScores = `${score}${p.likelyScoreProb != null ? ` ${Fmt2().pct(p.likelyScoreProb)}` : ""}`;
            const confLabel = conf > 70 ? tx("\u9AD8", "High") : conf > 50 ? tx("\u4E2D", "Medium") : tx("\u4F4E", "Low");
            let headerText = "";
            if (m.group && m.matchday !== void 0) headerText = `${m.group} \xB7 ${tx("\u7B2C", "MD")} ${m.matchday}`;
            else if (m.group && m.stage && !m.stage.includes("Group")) headerText = `${m.group} \xB7 ${m.stage}`;
            else if (m.group) headerText = m.group;
            else if (m.stage) headerText = m.stage;
            else headerText = tx("\u6BD4\u8D5B", "Match");
            h += `<div class="pred-card" style="margin-bottom:10px;background:rgba(255,255,255,.03);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px 16px">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                        <span style="font:400 9px/1 'JetBrains Mono', monospace;letter-spacing:1px;color:rgba(248,250,252,.15)">${esc(headerText)}</span>
                        <span style="font:400 9px/1 'JetBrains Mono', monospace;color:rgba(248,250,252,.12)">${esc(m.timeBJT || m.dateBJT || "")}</span>
                    </div>`;
            h += `<div style="display:flex;align-items:center">
                    <div style="flex:1;display:flex;align-items:center;gap:8px;min-width:0">
                        <div style="width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${homeFlag}</div>
                        <span style="font:500 13px/1 'Inter';color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(homeName)}</span>
                    </div>
                    <div style="padding:0 12px;text-align:center">
                        <span style="font:600 14px/1 'JetBrains Mono', monospace;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.03em">${esc(score)}</span>
                    </div>
                    <div style="flex:1;display:flex;align-items:center;gap:8px;min-width:0;justify-content:flex-end">
                        <span style="font:500 13px/1 'Inter';color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right">${esc(awayName)}</span>
                        <div style="width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${awayFlag}</div>
                    </div>
                </div>`;
            h += `<div class="prob-bar" role="img" aria-label="${tx("\u80DC\u5E73\u8D1F\u6982\u7387", "Win draw loss probability")}: ${tx("\u4E3B\u80DC", "Home")} ${hw}%, ${tx("\u5E73\u5C40", "Draw")} ${dr}%, ${tx("\u5BA2\u80DC", "Away")} ${aw}%" style="margin-top:10px"><div class="prob-bar-home" style="width:${hw}%">${hw > 12 ? hw + "%" : ""}</div><div class="prob-bar-draw" style="width:${dr}%">${dr > 10 ? dr + "%" : ""}</div><div class="prob-bar-away" style="width:${aw}%">${aw > 12 ? aw + "%" : ""}</div></div>`;
            h += `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px">
                    <span style="color:rgba(52,211,153,.5);font-weight:600">${tx("\u4E3B\u80DC", "Home")} ${hw}%</span>
                    <span style="color:rgba(250,204,21,.5);font-weight:600">${tx("\u5E73\u5C40", "Draw")} ${dr}%</span>
                    <span style="color:rgba(248,113,113,.4);font-weight:600">${tx("\u5BA2\u80DC", "Away")} ${aw}%</span>
                </div>`;
            h += renderMarketDivergencePanel(modelProbs, row.divergence);
            h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.04)">
                    <button data-action="toggle-pred-detail" data-target="pred-detail-${idx}" style="font:400 10px/1 'Inter';color:rgba(59,130,246,.65);background:none;border:none;cursor:pointer;min-width:44px;min-height:44px;padding:8px 4px">\u{1F4CA} ${tx("\u8BE6\u60C5", "Details")} \u25BE</button>
                    <span class="confidence-pill ${confCls}">\u{1F4CA} ${tx("\u7F6E\u4FE1\u5EA6", "Confidence")}: ${confLabel} ${conf}%</span>
                </div>`;
            h += `<div id="pred-detail-${idx}" class="hidden" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.04)">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px">
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#a78bfa;font-weight:600;margin-bottom:3px">\u26A1 ${tx("Elo \u9884\u6D4B", "Elo Forecast")}</div>
                            <div style="color:rgba(248,250,252,.35)">${tx("\u4E3B\u80DC", "Home")} ${(eloPred.home * 100).toFixed(0)}%  ${tx("\u5E73", "Draw")} ${(eloPred.draw * 100).toFixed(0)}%  ${tx("\u5BA2", "Away")} ${(eloPred.away * 100).toFixed(0)}%</div>
                        </div>
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#60a5fa;font-weight:600;margin-bottom:3px">\u{1F4D0} ${tx("Poisson \u9884\u6D4B", "Poisson Forecast")}</div>
                            <div style="color:rgba(248,250,252,.35)">${tx("\u4E3B\u80DC", "Home")} ${(poissonPred.home * 100).toFixed(0)}%  ${tx("\u5E73", "Draw")} ${(poissonPred.draw * 100).toFixed(0)}%  ${tx("\u5BA2", "Away")} ${(poissonPred.away * 100).toFixed(0)}%</div>
                        </div>
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#34d399;font-weight:600;margin-bottom:3px">\u{1F454} ${tx("\u6559\u7EC3\u56E0\u7D20", "Coach Factor")}</div>
                            <div style="color:rgba(248,250,252,.35)">${tx("\u4E3B\u80DC", "Home")} ${(coachPred.home * 100).toFixed(0)}%  ${tx("\u5E73", "Draw")} ${(coachPred.draw * 100).toFixed(0)}%  ${tx("\u5BA2", "Away")} ${(coachPred.away * 100).toFixed(0)}%</div>
                        </div>
                        <div style="background:rgba(255,255,255,.02);border-radius:8px;padding:8px">
                            <div style="color:#fbbf24;font-weight:600;margin-bottom:3px">\u{1F3AF} ${tx("\u6700\u53EF\u80FD\u6BD4\u5206", "Most Likely Score")}</div>
                            <div style="color:rgba(248,250,252,.35)">${topScores}</div>
                        </div>
                    </div>
                    <div style="font-size:9px;color:rgba(248,250,252,.12);margin-top:8px">${tx("\u6743\u91CD", "Weights")}: Elo ${(weights.elo * 100).toFixed(0)}% \xB7 Poisson ${(weights.poisson * 100).toFixed(0)}% \xB7 ${tx("\u8D54\u7387", "Odds")} ${(weights.odds * 100).toFixed(0)}% \xB7 ${tx("\u6559\u7EC3", "Coach")} ${(weights.coach * 100).toFixed(0)}% \xB7 ${tx("\u573A\u9986", "Venue")} ${(weights.venue * 100).toFixed(0)}%</div>
                </div></div>`;
          } else {
            let headerText = "";
            if (m.group && m.matchday !== void 0) headerText = `${m.group} \xB7 ${tx("\u7B2C", "MD")} ${m.matchday}`;
            else if (m.group && m.stage && !m.stage.includes("Group")) headerText = `${m.group} \xB7 ${m.stage}`;
            else if (m.group) headerText = m.group;
            else if (m.stage) headerText = m.stage;
            else headerText = tx("\u6BD4\u8D5B", "Match");
            h += `<div class="pred-card" style="margin-bottom:10px;opacity:.5;background:rgba(255,255,255,.03);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px 16px">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="font:400 9px/1 'JetBrains Mono', monospace;letter-spacing:1px;color:rgba(248,250,252,.15)">${esc(headerText)}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:center;margin-top:8px">
                        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${m.home.flag || "\u{1F3F3}\uFE0F"}</span><span style="font:500 12px/1 'Inter';color:rgba(248,250,252,.5)">${esc(displayMaybeTeamName(m.home))}</span></div>
                        <span style="margin:0 10px;color:rgba(248,250,252,.1);font-size:12px">VS</span>
                        <div style="display:flex;align-items:center;gap:6px"><span style="font:500 12px/1 'Inter';color:rgba(248,250,252,.5)">${esc(displayMaybeTeamName(m.away))}</span><span style="font-size:12px">${m.away.flag || "\u{1F3F3}\uFE0F"}</span></div>
                    </div>
                    <div style="text-align:center;font-size:10px;color:rgba(248,250,252,.2);margin-top:6px">${tx("\u9884\u6D4B\u6682\u4E0D\u53EF\u7528", "Prediction unavailable")}</div>
                </div>`;
          }
        }
        return h;
      }
      async function loadPrediction2() {
        const el = document.getElementById("prediction-content");
        el.innerHTML = `<div class="text-center py-10 text-gray-500">\u{1F9E0} ${esc(tx("loadingPredictions"))}</div>`;
        const [rankings, schedule, qualiData, calibrationReport] = await window.WorldCup.ApiClient.allData([
          "/api/elo/rankings",
          "/api/schedule",
          "/api/qualification-probabilities",
          "/api/calibration-report"
        ]);
        let html = `<div class="pred-disclaimer border border-amber-400/30 bg-amber-400/10 rounded-xl px-3 py-2.5 text-xs text-amber-100" style="margin-bottom:16px">\u26A0\uFE0F ${tx("\u672C\u9875\u9762\u4E3A\u5B9E\u9A8C\u6027\u8DB3\u7403\u6982\u7387\u6A21\u578B\uFF0C\u4EC5\u4F9B\u4EA7\u54C1\u4F53\u9A8C\u53C2\u8003\uFF0C\u4E0D\u6784\u6210\u4EFB\u4F55\u6295\u6CE8\u5EFA\u8BAE\u3002\u9884\u6D4B\u57FA\u7EBF\u6765\u81EA Elo \u4E0E Poisson\uFF1B\u82E5\u5DF2\u914D\u7F6E\u5E02\u573A\u8D54\u7387\uFF0C\u6BD4\u8D5B\u8BE6\u60C5\u9875\u4F1A\u5C55\u793A\u6A21\u578B vs \u5E02\u573A\u5206\u6B67\u63D0\u793A\u3002", "This page provides an experimental football probability model for product evaluation only. It is not betting advice. The baseline forecast uses Elo and Poisson; when market odds are configured, match details show model-vs-market divergence hints.")}</div>`;
        html += renderCalibrationReport(calibrationReport);
        const allMatches = schedule?.matches || [];
        const isKnockoutStage = allMatches.some((m) => m.stage && m.stage !== "group");
        let upcoming = allMatches.filter((m) => m.state === "pre").slice(0, 6);
        if (upcoming.length === 0) {
          const now = /* @__PURE__ */ new Date();
          const todayStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
          const futureDates = [...new Set(
            allMatches.filter((m) => m.date && m.date.slice(0, 10) > todayStr && m.state === "pre").map((m) => m.date.slice(0, 10))
          )].sort();
          if (futureDates.length > 0) {
            const nextDate = futureDates[0];
            upcoming = allMatches.filter(
              (m) => m.date && m.date.slice(0, 10) === nextDate && m.state === "pre"
            ).slice(0, 6);
          }
        }
        const hasRankings = !isKnockoutStage && Array.isArray(rankings) && rankings.length;
        const hasUpcoming = upcoming.length > 0;
        if (hasRankings && hasUpcoming) {
          const eloHtml = buildEloTable(rankings);
          const predHtml = await buildPredictionCards(upcoming, 0);
          html += `<div class="pred-two-col" style="display:flex;gap:24px;align-items:start">
                <div class="pred-section" style="flex:1;min-width:0;padding:16px">${eloHtml}</div>
                <div class="pred-section" style="width:380px;flex-shrink:0;padding:16px">
                    <div class="pred-section-title text-blue-400" style="font-family:'DM Sans',sans-serif">
                        <span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs flex-shrink-0">\u{1F3AF}</span>${tx("\u6BD4\u8D5B\u9884\u6D4B", "Match Predictions")}
                    </div>
                    ${predHtml}
                </div>
            </div>`;
        } else if (hasRankings) {
          html += `<div class="pred-section" style="padding:16px">${buildEloTable(rankings)}</div>`;
        } else if (hasUpcoming) {
          const predHtml = await buildPredictionCards(upcoming, 0);
          html += `<div class="pred-section" style="padding:16px">
                <div class="pred-section-title text-blue-400" style="font-family:'DM Sans',sans-serif">
                    <span class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs flex-shrink-0">\u{1F3AF}</span>${tx("\u6BD4\u8D5B\u9884\u6D4B", "Match Predictions")}
                </div>
                ${predHtml}
            </div>`;
        }
        if (!isKnockoutStage && qualiData && typeof qualiData === "object" && !Array.isArray(qualiData)) {
          const qualiGroups = Object.values(qualiData);
          if (qualiGroups.length) {
            html += `<div class="pred-section" style="margin-top:12px;padding:16px">
                    <div class="pred-section-title text-emerald-400" style="font-family:'DM Sans',sans-serif">
                        <span class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs flex-shrink-0">\u{1F3AF}</span>${tx("\u51FA\u7EBF\u5F62\u52BF", "Qualification Probabilities")}
                    </div>`;
            qualiGroups.forEach((g) => {
              const groupName = displayGroupName(g.group || tx("\u672A\u77E5\u5C0F\u7EC4", "Unknown Group"));
              html += `<div style="margin-bottom:12px"><div style="font:600 11px/1 'DM Sans', sans-serif;color:rgba(248,250,252,.3);margin-bottom:6px">${esc(groupName)}</div><div style="display:flex;flex-direction:column;gap:6px">`;
              (g.results || []).forEach((t) => {
                const pct = Math.round((t.probability || t.qualifyProb || 0) * 100);
                const thirdPct = Math.round((t.thirdPlaceQualifyProb || 0) * 100);
                const barCls = pct >= 70 ? "quali-high" : pct >= 40 ? "quali-mid" : "quali-low";
                html += `<div class="quali-card flex items-center gap-2.5"><div class="team-flag">${t.flag || "\u{1F3F3}\uFE0F"}</div><div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-1"><span style="font:500 12px/1 'Inter';color:#f8fafc">${esc(displayMaybeTeamName(t.name))}</span><span style="font:500 12px/1 'JetBrains Mono', monospace;color:${pct >= 70 ? "#34d399" : pct >= 40 ? "#f59e0b" : "rgba(248,250,252,.3)"}">${pct}%</span></div><div class="quali-bar"><div class="quali-bar-fill ${barCls}" style="width:${pct}%"></div></div>${thirdPct > 0 ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px"><span style="font:500 9px/1 'Inter';color:#fbbf24">${tx("\u6700\u4F73\u7B2C\u4E09", "Best third")} ${thirdPct}%</span><div class="quali-bar" style="flex:1;height:3px"><div style="height:100%;border-radius:2px;background:#fbbf24;width:${thirdPct}%"></div></div></div>` : ""}</div></div>`;
              });
              html += "</div></div>";
            });
            html += "</div>";
          }
        }
        html += `<div class="pred-section mt-4" style="padding:16px">
            <div class="pred-section-title text-orange-400" style="font-family:'DM Sans',sans-serif">
                <span class="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center text-xs flex-shrink-0">\u{1F3C6}</span>${tx("\u540E\u671F\u6DD8\u6C70\u8D5B", "Knockout Stage")}
            </div>
            <div id="bracket-container-pred" class="w-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide text-center min-h-[200px]">
                <div class="text-gray-500 py-10">${tx("\u52A0\u8F7D\u5BF9\u9635\u56FE...", "Loading bracket...")}</div>
            </div>
        </div>`;
        el.innerHTML = html || `<div class="text-gray-500 text-center py-10">${tx("\u6682\u65E0\u9884\u6D4B\u6570\u636E", "No prediction data available")}</div>`;
        api("/api/bracket").then((data) => {
          const container = document.getElementById("bracket-container-pred");
          if (container && data && !data.error) {
            container.innerHTML = "";
            if (typeof renderBracket === "function") renderBracket(data, container);
            setTimeout(() => {
              const wrap = container.querySelector("#bk-wrap");
              if (wrap) container.scrollLeft = (wrap.scrollWidth - container.clientWidth) / 2;
            }, 100);
          }
        }).catch(() => {
          const container = document.getElementById("bracket-container-pred");
          if (container) container.innerHTML = `<div class="text-gray-500 py-10">${tx("\u6DD8\u6C70\u8D5B\u5BF9\u9635\u56FE\u5C06\u5728\u5C0F\u7EC4\u8D5B\u7ED3\u675F\u540E\u751F\u6210", "Knockout bracket will be generated after group stage.")}</div>`;
        });
      }
      window.WorldCup.EloPrediction = { loadPrediction: loadPrediction2 };
      Object.assign(window, { loadPrediction: loadPrediction2 });
    })();
  }
});

// static/js/players-tab.js
var require_players_tab = __commonJS({
  "static/js/players-tab.js"() {
    (function() {
      "use strict";
      const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
      const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
      const { tx } = window.WorldCup.Utils;
      const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
      let allPlayersCache = [];
      function loadAllPlayers() {
        if (allPlayersCache.length) {
          renderPlayers(allPlayersCache);
          return;
        }
        const grid = document.getElementById("players-grid");
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">\u52A0\u8F7D\u7403\u5458\u6570\u636E...</div>';
        const teamIds = ["660", "210", "206", "211", "204", "214", "208", "220", "448", "209", "473", "201", "472", "471", "476", "475", "474", "477", "207", "212", "478", "479", "213", "218"];
        Promise.all(teamIds.map((id) => api(`/api/team/${id}/lineup`).catch(() => null))).then((results) => {
          const players = [];
          for (const r of results) {
            if (!r || r.error) continue;
            for (const p of r.players || []) {
              players.push({ ...p, teamName: r.name, teamId: r.teamId });
            }
          }
          allPlayersCache = players;
          renderPlayers(players);
        });
      }
      function renderPlayers(players) {
        const grid = document.getElementById("players-grid");
        grid.innerHTML = players.map((p) => `
            <div class="card glass rounded-xl p-2.5 cursor-pointer" data-action="open-player-detail" data-player-id="${attr(p.id)}">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">${esc(p.jersey || "?")}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-bold truncate">${esc(p.name)}</div>
                        <div class="text-[11px] text-gray-500">${esc(p.teamName || "")} \xB7 ${esc(p.pos)}</div>
                    </div>
                </div>
                <div class="mt-1.5 flex items-center gap-1">
                    <span class="text-xs font-bold ${p.rating >= 80 ? "text-green-400" : p.rating >= 70 ? "text-yellow-400" : "text-gray-400"}">${p.rating}</span>
                    <div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${p.rating >= 80 ? "bg-green-500" : p.rating >= 70 ? "bg-yellow-500" : "bg-gray-600"}" style="width:${p.rating}%"></div>
                    </div>
                </div>
                <div class="mt-1 grid grid-cols-3 gap-0.5 text-[10px] text-gray-600">
                    <span>\u653B${p.dims?.attack || 0}</span>
                    <span>\u9632${p.dims?.defense || 0}</span>
                    <span>\u4F53${p.dims?.physical || 0}</span>
                </div>
            </div>
        `).join("") || '<div class="col-span-full text-center text-gray-500 py-10">\u65E0\u7403\u5458\u6570\u636E</div>';
      }
      function searchPlayers(q) {
        if (!q) {
          renderPlayers(allPlayersCache);
          return;
        }
        const lower = q.toLowerCase();
        const filtered = allPlayersCache.filter(
          (p) => p.name.toLowerCase().includes(lower) || p.pos?.toLowerCase().includes(lower) || p.teamName?.toLowerCase().includes(lower)
        );
        renderPlayers(filtered);
      }
      window.WorldCup.PlayersTab = { loadAllPlayers, renderPlayers, searchPlayers };
      Object.assign(window, { loadAllPlayers, renderPlayers, searchPlayers });
    })();
  }
});

// static/js/spatial-matchup.js
var require_spatial_matchup = __commonJS({
  "static/js/spatial-matchup.js"() {
    (function() {
      "use strict";
      const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
      const { tx } = window.WorldCup.Utils;
      const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
      const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
      const translatePlayerName = (...a) => (window.WorldCup.I18n?.translatePlayerName || ((x) => x))(...a);
      let allTeamOptions = [];
      function loadSpatialTab() {
        const homeSelect = document.getElementById("spatial-home");
        const awaySelect = document.getElementById("spatial-away");
        if (allTeamOptions.length) return;
        const teams = [
          { id: "660", name: "USA" },
          { id: "210", name: "Paraguay" },
          { id: "206", name: "Canada" },
          { id: "211", name: "Bosnia-Herzegovina" },
          { id: "204", name: "Mexico" },
          { id: "214", name: "South Africa" },
          { id: "208", name: "South Korea" },
          { id: "220", name: "Czech Republic" },
          { id: "448", name: "Germany" },
          { id: "209", name: "Japan" },
          { id: "473", name: "Spain" },
          { id: "201", name: "Brazil" },
          { id: "472", name: "France" },
          { id: "471", name: "England" },
          { id: "476", name: "Argentina" },
          { id: "475", name: "Portugal" },
          { id: "474", name: "Netherlands" },
          { id: "477", name: "Belgium" },
          { id: "207", name: "Croatia" },
          { id: "212", name: "Morocco" },
          { id: "478", name: "Switzerland" },
          { id: "479", name: "Uruguay" },
          { id: "213", name: "Colombia" },
          { id: "218", name: "Ecuador" }
        ];
        allTeamOptions = teams;
        homeSelect.innerHTML = '<option value="">\u9009\u62E9\u4E3B\u961F...</option>' + teams.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
        awaySelect.innerHTML = '<option value="">\u9009\u62E9\u5BA2\u961F...</option>' + teams.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
        document.getElementById("spatial-home").value = "660";
        document.getElementById("spatial-away").value = "210";
        loadSelectedSpatial();
      }
      async function loadSelectedSpatial() {
        const home = document.getElementById("spatial-home").value;
        const away = document.getElementById("spatial-away").value;
        if (!home || !away) {
          document.getElementById("spatial-result").innerHTML = '<div class="text-gray-500 text-center py-10 text-xs">\u8BF7\u9009\u62E9\u4E24\u652F\u7403\u961F</div>';
          return;
        }
        const el = document.getElementById("spatial-result");
        el.innerHTML = '<div class="text-center py-10 text-gray-500">\u52A0\u8F7D\u4E2D...</div>';
        el.innerHTML = renderSpatialMatchupPanel(await loadSpatialMatchup(home, away));
      }
      async function loadSpatialMatchup(homeId, awayId) {
        const d = await api(`/api/matchup-spatial/${homeId}/${awayId}`);
        return d && !d.error ? d : null;
      }
      function renderSpatialPitch(data) {
        if (!data) return '<div class="text-gray-500 text-center py-10">\u5BF9\u4F4D\u6570\u636E\u52A0\u8F7D\u5931\u8D25</div>';
        const W = 680, H = 1050;
        let svg = `<svg viewBox="0 0 ${W} ${H}" class="w-full rounded-xl overflow-hidden" style="max-height:500px;"><rect width="${W}" height="${H}" fill="#1a472a" rx="8"/>`;
        const sH = (H - 40) / 20;
        for (let i = 0; i < 20; i += 2) svg += `<rect x="20" y="${20 + i * sH}" width="${W - 40}" height="${sH}" fill="rgba(255,255,255,0.03)"/>`;
        svg += `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>`;
        svg += `<line x1="20" y1="${H / 2}" x2="${W - 20}" y2="${H / 2}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>`;
        svg += `<circle cx="${W / 2}" cy="${H / 2}" r="80" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><circle cx="${W / 2}" cy="${H / 2}" r="4" fill="rgba(255,255,255,0.3)"/>`;
        svg += `<rect x="${W / 2 - 150}" y="20" width="300" height="150" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><rect x="${W / 2 - 90}" y="20" width="180" height="60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
        svg += `<rect x="${W / 2 - 150}" y="${H - 170}" width="300" height="150" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><rect x="${W / 2 - 90}" y="${H - 80}" width="180" height="60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
        svg += `<path d="M ${W / 2 - 60} 170 A 60 60 0 0 0 ${W / 2 + 60} 170" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>`;
        svg += `<path d="M ${W / 2 - 60} ${H - 170} A 60 60 0 0 1 ${W / 2 + 60} ${H - 170}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>`;
        svg += `<path d="M 35 20 A 15 15 0 0 1 20 35" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<path d="M ${W - 35} 20 A 15 15 0 0 0 ${W - 20} 35" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<path d="M ${W - 20} ${H - 35} A 15 15 0 0 0 ${W - 35} ${H - 20}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<path d="M 20 ${H - 35} A 15 15 0 0 1 35 ${H - 20}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
        svg += `<defs><filter id="ability-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
        const renderBubbles = (players, color, className) => {
          for (const p of players || []) {
            const px = p.x * 6.8, py = (100 - p.y) * 10.5;
            const rating = Math.max(50, Math.min(100, Number(p.rating) || 65));
            const radius = 12 + (rating - 50) * 0.48;
            svg += `<circle class="${className}" cx="${px}" cy="${py}" r="${radius * 1.3}" fill="${color}" opacity="0.2" filter="url(#ability-blur)"/>`;
            svg += `<circle class="${className}" cx="${px}" cy="${py}" r="${radius}" fill="${color}" opacity="0.48" filter="url(#ability-blur)"/>`;
          }
        };
        renderBubbles(data.home?.players, "rgb(59,130,246)", "pitch-home");
        renderBubbles(data.away?.players, "rgb(239,68,68)", "pitch-away");
        return svg + "</svg>";
      }
      function renderSpatialMatchupPanel(data) {
        if (!data) return "";
        const s = data.summary || {}, pairs = data.pairs || [];
        const homeAvg = data.home?.players?.length ? data.home.players.reduce((sum, p) => sum + (p.rating || 70), 0) / data.home.players.length : 70;
        const awayAvg = data.away?.players?.length ? data.away.players.reduce((sum, p) => sum + (p.rating || 70), 0) / data.away.players.length : 70;
        const total = homeAvg + awayAvg;
        const homePct = total > 0 ? (homeAvg / total * 100).toFixed(1) : 50;
        const awayPct = total > 0 ? (awayAvg / total * 100).toFixed(1) : 50;
        const avgGap = s.avgGap || 0;
        let difficulty = "\u4F4E", difficultyColor = "text-green-400";
        if (avgGap >= 8) {
          difficulty = "\u9AD8";
          difficultyColor = "text-red-400";
        } else if (avgGap >= 5) {
          difficulty = "\u4E2D\u7B49";
          difficultyColor = "text-yellow-400";
        }
        return `<div class="spatial-matchup-panel glass rounded-xl p-3 mb-3"><div class="mb-3"><div class="flex items-center justify-between mb-1"><div class="flex items-center gap-2"><span class="text-lg">${data.home?.flag || "\u{1F3F3}\uFE0F"}</span><div><div class="text-sm font-bold text-white">${displayMaybeTeamName(data.home || tx("\u4E3B\u961F", "Home"))}</div><div class="text-[11px] text-gray-500">${tx("\u63A8\u6D4B\u9635\u578B", "Estimated formation")} ${data.home?.formation || "?"}</div></div></div><div class="text-center"><div class="text-[11px] text-gray-500 mb-0.5">${tx("\u7EFC\u5408\u8BC4\u5206", "Composite")}</div><div class="text-lg font-black ${homePct > awayPct ? "text-red-400" : "text-blue-400"}">${homePct} <span class="text-gray-600">vs</span> ${awayPct}</div><div class="text-[11px] font-bold ${difficultyColor}">${difficulty}</div></div><div class="flex items-center gap-2"><div class="text-right"><div class="text-sm font-bold text-white">${displayMaybeTeamName(data.away || tx("\u5BA2\u961F", "Away"))}</div><div class="text-[11px] text-gray-500">${tx("\u63A8\u6D4B\u9635\u578B", "Estimated formation")} ${data.away?.formation || "?"}</div></div><span class="text-lg">${data.away?.flag || "\u{1F3F3}\uFE0F"}</span></div></div><div class="flex h-2.5 rounded-full overflow-hidden bg-white/5 mb-2"><div class="bg-red-500 transition-all duration-500" style="width:${homePct}%"></div><div class="bg-blue-500 transition-all duration-500" style="width:${awayPct}%"></div></div><div class="flex justify-between text-[11px]"><span class="text-red-400 font-bold">${tx("\u4E3B\u4F18", "Home edges")} ${s.homeAdvantages || 0}</span><span class="text-gray-400">${tx("\u5747\u52BF", "Even")} ${s.even || 0}</span><span class="text-blue-400 font-bold">${tx("\u5BA2\u4F18", "Away edges")} ${s.awayAdvantages || 0}</span><span class="text-gray-500">${tx("\u5E73\u5747\u5DEE", "Avg gap")} ${avgGap}</span></div></div><div class="flex items-center justify-between mb-2"><h4 class="text-xs font-bold text-blue-400">\u2694\uFE0F ${tx("\u7A7A\u95F4\u5BF9\u4F4D", "Spatial Matchups")}</h4><div class="flex gap-1"><button data-action="set-pitch-view" data-view="both" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">${tx("\u5168\u90E8", "All")}</button><button data-action="set-pitch-view" data-view="home" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx("\u4E3B\u961F", "Home")}</button><button data-action="set-pitch-view" data-view="away" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx("\u5BA2\u961F", "Away")}</button></div></div>${renderSpatialPitch(data)}<p class="mt-2 text-[10px] text-gray-500">${tx("\u9635\u578B\u4E0E\u7403\u5458\u4F4D\u7F6E\u57FA\u4E8E\u5E38\u7528\u9635\u578B\u53CA\u4F4D\u7F6E\u8BC4\u5206\u7684\u4F30\u8BA1\uFF0C\u4E0D\u662F\u5B98\u65B9\u9996\u53D1\u3002", "Formation and player positions are estimates from usual shape and position ratings, not an official lineup.")}</p><div class="mt-2 flex flex-wrap gap-1">${pairs.filter((p) => p.key).map((p) => `<span class="pitch-pair text-[11px] px-1.5 py-0.5 rounded ${p.advantage === "home" ? "bg-green-500/20 text-green-400" : p.advantage === "away" ? "bg-red-500/20 text-red-400" : "bg-white/5 text-gray-400"}">${p.home.name.split(" ").pop()}(${p.home.rating}) vs ${p.away.name.split(" ").pop()}(${p.away.rating}) ${p.diff > 0 ? "+" : ""}${p.diff}</span>`).join("")}</div></div>`;
      }
      function getFlagEmoji(teamId) {
        if (!teamId) return "\u{1F3F3}\uFE0F";
        const flagMap = {
          "202": "\u{1F1E6}\u{1F1F7}",
          "203": "\u{1F1F2}\u{1F1FD}",
          "205": "\u{1F1E7}\u{1F1F7}",
          "206": "\u{1F1E8}\u{1F1E6}",
          "208": "\u{1F1E8}\u{1F1F4}",
          "209": "\u{1F1EA}\u{1F1E8}",
          "210": "\u{1F1F5}\u{1F1FE}",
          "212": "\u{1F1FA}\u{1F1FE}",
          "214": "\u{1F1E8}\u{1F1F7}",
          "4375": "\u{1F1EE}\u{1F1F6}",
          "4398": "\u{1F1F6}\u{1F1E6}",
          "4469": "\u{1F1EC}\u{1F1ED}",
          "448": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
          "449": "\u{1F1F3}\u{1F1F1}",
          "450": "\u{1F1E8}\u{1F1FF}",
          "451": "\u{1F1F0}\u{1F1F7}",
          "452": "\u{1F1E7}\u{1F1E6}",
          "459": "\u{1F1E7}\u{1F1EA}",
          "464": "\u{1F1F3}\u{1F1F4}",
          "465": "\u{1F1F9}\u{1F1F7}",
          "466": "\u{1F1F8}\u{1F1EA}",
          "467": "\u{1F1FF}\u{1F1E6}",
          "469": "\u{1F1EE}\u{1F1F7}",
          "472": "\u{1F1EB}\u{1F1F7}",
          "474": "\u{1F1E6}\u{1F1F9}",
          "475": "\u{1F1E8}\u{1F1ED}",
          "477": "\u{1F1ED}\u{1F1F7}",
          "478": "\u{1F1EB}\u{1F1F7}",
          "481": "\u{1F1E9}\u{1F1EA}",
          "482": "\u{1F1F5}\u{1F1F9}",
          "580": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
          "624": "\u{1F1E9}\u{1F1FF}",
          "627": "\u{1F1EF}\u{1F1F5}",
          "628": "\u{1F1E6}\u{1F1FA}",
          "654": "\u{1F1F8}\u{1F1F3}",
          "655": "\u{1F1F8}\u{1F1E6}",
          "659": "\u{1F1F9}\u{1F1F3}",
          "660": "\u{1F1FA}\u{1F1F8}",
          "2570": "\u{1F1FA}\u{1F1FF}",
          "2597": "\u{1F1E8}\u{1F1FB}",
          "2620": "\u{1F1EA}\u{1F1EC}",
          "2654": "\u{1F1ED}\u{1F1F9}",
          "2659": "\u{1F1F5}\u{1F1E6}",
          "2666": "\u{1F1F3}\u{1F1FF}",
          "2850": "\u{1F1E8}\u{1F1E9}",
          "2869": "\u{1F1F2}\u{1F1E6}",
          "2917": "\u{1F1EF}\u{1F1F4}",
          "11678": "\u{1F1E8}\u{1F1FC}",
          "4789": "\u{1F1E8}\u{1F1EE}"
        };
        return flagMap[String(teamId)] || "\u{1F3F3}\uFE0F";
      }
      window.WorldCup.SpatialMatchup = { loadSpatialTab, loadSelectedSpatial, renderSpatialPitch, renderSpatialMatchupPanel, getFlagEmoji, FORMATIONS: {} };
      Object.assign(window, { loadSpatialTab, loadSelectedSpatial, getFlagEmoji });
    })();
  }
});

// static/js/ai-chat.js
var require_ai_chat = __commonJS({
  "static/js/ai-chat.js"() {
    (function() {
      "use strict";
      const attr = (...a) => (window.WorldCup.Utils?.attr || ((s) => s))(...a);
      const { tx } = window.WorldCup.Utils;
      const api = (...a) => (window.WorldCup.Utils?.api || (async () => ({})))(...a);
      function renderAIChat(matchId, homeId, awayId, homeName, awayName) {
        const chatId = `ai-chat-${matchId}`;
        return `<div class="glass rounded-xl p-3"><h4 class="text-xs font-bold text-purple-400 mb-2">\u{1F916} ${tx("AI \u6218\u672F\u5206\u6790", "AI Tactical Analysis")}</h4><div id="${attr(chatId)}-messages" class="space-y-2 max-h-48 overflow-y-auto mb-2"><div class="text-[11px] text-gray-500 text-center py-2">${tx("\u8BE2\u95EE AI \u5173\u4E8E\u8FD9\u573A\u6BD4\u8D5B\u7684\u4EFB\u4F55\u95EE\u9898...", "Ask AI anything about this match...")}</div></div><div class="flex gap-2"><input type="text" id="${attr(chatId)}-input" placeholder="${tx("\u4F8B\uFF1A\u8C01\u4F1A\u8D62\uFF1F\u5173\u952E\u5BF9\u4F4D\uFF1F\u6218\u672F\u5206\u6790\uFF1F", "Example: who will win? key matchups? tactics?")}" class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500" data-key-action="send-ai-message" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}"><button data-action="send-ai-message" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" class="bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-500/30">${tx("\u53D1\u9001", "Send")}</button></div><div class="mt-2 flex flex-wrap gap-1"><button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx("\u8C01\u4F1A\u8D62\uFF1F", "Who will win?"))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx("\u8C01\u4F1A\u8D62\uFF1F", "Who wins?")}</button><button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx("\u5173\u952E\u5BF9\u4F4D\u5206\u6790", "Key matchup analysis"))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx("\u5173\u952E\u5BF9\u4F4D", "Key matchups")}</button><button data-action="ask-ai-preset" data-chat-id="${attr(chatId)}" data-match-id="${attr(matchId)}" data-home-id="${attr(homeId)}" data-away-id="${attr(awayId)}" data-question="${attr(tx("\u6218\u672F\u98CE\u683C\u5BF9\u6BD4", "Tactical style comparison"))}" class="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:bg-white/10">${tx("\u6218\u672F\u5BF9\u6BD4", "Tactics")}</button></div></div>`;
      }
      function appendChatMessage(messages, text, align, spanClass, id) {
        const row = document.createElement("div");
        row.className = align;
        if (id) row.id = id;
        const span = document.createElement("span");
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
        appendChatMessage(messages, question, "text-right", "text-[11px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg inline-block");
        input.value = "";
        messages.scrollTop = messages.scrollHeight;
        const loadingId = "loading-" + Date.now();
        appendChatMessage(messages, tx("AI \u601D\u8003\u4E2D...", "AI is thinking..."), "text-left", "text-[11px] text-gray-500", loadingId);
        messages.scrollTop = messages.scrollHeight;
        try {
          const response = await api("/api/bot/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, matchId, homeId, awayId, context: "worldcup-matchup", uiLang: window.WorldCup.State?.uiLang || "zh" })
          });
          document.getElementById(loadingId)?.remove();
          const answer = response?.answer || response?.error || tx("\u62B1\u6B49\uFF0C\u6682\u65F6\u65E0\u6CD5\u56DE\u7B54\u8FD9\u4E2A\u95EE\u9898\u3002", "Sorry, I cannot answer that right now.");
          appendChatMessage(messages, answer, "text-left", "text-[11px] bg-white/5 text-gray-300 px-2 py-1 rounded-lg inline-block");
        } catch (err) {
          document.getElementById(loadingId)?.remove();
          appendChatMessage(messages, `${tx("\u8BF7\u6C42\u5931\u8D25", "Request failed")}: ${err.message}`, "text-left", "text-[11px] text-red-400 px-2 py-1");
        }
        messages.scrollTop = messages.scrollHeight;
      }
      function askAIPreset(chatId, matchId, homeId, awayId, question) {
        const input = document.getElementById(`${chatId}-input`);
        input.value = question;
        sendAIMessage(chatId, matchId, homeId, awayId);
      }
      window.WorldCup.AIChat = { renderAIChat, appendChatMessage, sendAIMessage, askAIPreset };
      Object.assign(window, { renderAIChat, appendChatMessage, sendAIMessage, askAIPreset });
    })();
  }
});

// static/js/coach-comparison.js
var require_coach_comparison = __commonJS({
  "static/js/coach-comparison.js"() {
    (function() {
      "use strict";
      const { tx } = window.WorldCup.Utils;
      const translateCoachField = (...a) => (window.WorldCup.I18n?.translateCoachField || ((x) => x))(...a);
      const i18nText = (...a) => (window.WorldCup.I18n?.i18nText || ((o, f) => f))(...a);
      function renderCoachComparison(data) {
        if (!data || data.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u6559\u7EC3\u6570\u636E\u6682\u65E0", "No coach data")}</div>`;
        const a = data.coachA || {}, b = data.coachB || {}, c = data.comparison || {};
        const score = c.overallScore || {};
        const scoreA = score[a.name] || "-";
        const scoreB = score[b.name] || "-";
        const renderCoach = (coach, accent, scoreValue) => `<div class="glass-light rounded-lg p-3"><div class="flex items-start justify-between gap-2 mb-2"><div><div class="text-sm font-bold text-white">${translateCoachField(coach.name, "name") || tx("\u672A\u77E5\u6559\u7EC3", "Unknown coach")}</div><div class="text-[11px] text-gray-500">${translateCoachField(coach.nationality, "nationality") || ""} \xB7 ${coach.age || "?"}${tx("\u5C81", "")} \xB7 ${translateCoachField(coach.tenure, "tenure") || ""}</div></div><div class="text-right"><div class="text-[11px] text-gray-500">${tx("\u8BC4\u5206", "Rating")}</div><div class="text-base font-black ${accent}">${scoreValue}</div></div></div><div class="text-xs font-bold ${accent} mb-1">${i18nText(coach.styleI18n, coach.style || tx("\u6218\u672F\u98CE\u683C\u672A\u77E5", "Style unknown"))}</div><div class="text-[11px] text-gray-400 leading-relaxed">${i18nText(coach.styleDetailI18n, coach.styleDetail || coach.notes || "")}</div><div class="grid grid-cols-2 gap-2 mt-2 text-[11px]"><div><span class="text-gray-500">${tx("\u80DC\u7387", "Win Rate")}</span> <span class="font-bold">${coach.winRate || "-"}</span></div><div><span class="text-gray-500">${tx("\u9635\u578B", "Formation")}</span> <span class="font-bold">${(coach.formation || []).join(" / ") || "-"}</span></div></div></div>`;
        return `<div class="space-y-3"><div class="grid sm:grid-cols-2 gap-2">${renderCoach(a, "text-blue-400", scoreA)}${renderCoach(b, "text-red-400", scoreB)}</div><div class="glass-light rounded-lg p-3 text-[11px] text-gray-300 space-y-1"><div><span class="text-gray-500">${tx("\u98CE\u683C\u5BF9\u4F4D", "Style matchup")}</span> <span class="font-bold text-white">${i18nText(c.styleMatchupI18n, c.styleMatchup || "-")}</span></div><div><span class="text-gray-500">${tx("\u7ECF\u9A8C\u5DEE\u8DDD", "Experience gap")}</span> <span class="font-bold text-white">${i18nText(c.experienceGapI18n, c.experienceGap || "-")}</span></div><div><span class="text-gray-500">${tx("\u4E34\u573A\u4F18\u52BF", "Adjustment edge")}</span> <span class="font-bold text-white">${i18nText(c.adjustmentEdgeI18n, c.adjustmentEdge || "-")}</span></div></div></div>`;
      }
      window.WorldCup.CoachComparison = { renderCoachComparison };
      Object.assign(window, { renderCoachComparison });
    })();
  }
});

// static/js/match-review.js
var require_match_review = __commonJS({
  "static/js/match-review.js"() {
    (function() {
      "use strict";
      const esc = (...a) => (window.WorldCup.Utils?.esc || ((s) => s))(...a);
      const { tx } = window.WorldCup.Utils;
      const i18nText = (...a) => (window.WorldCup.I18n?.i18nText || ((o, f) => f))(...a);
      const displayMaybeTeamName = (...a) => (window.WorldCup.I18n?.displayMaybeTeamName || ((x) => x))(...a);
      function renderMatchReview(review) {
        if (!review || review.error) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u6BD4\u8D5B\u56DE\u987E\u52A0\u8F7D\u5931\u8D25", "Match review failed to load")}</div>`;
        const match = review.match || {}, ai = review.aiPrediction || {}, bias = review.biasAnalysis || {};
        const summary = review.matchSummary || {}, eloChange = review.eloChange || {};
        const factors = bias.factors || [], aiPostmortem = review.aiPostmortem || {};
        const uiLang2 = window.WorldCup.State?.uiLang || "zh";
        const pmLang = uiLang2 === "zh" ? "zh" : "en";
        const pmArr = (f, l) => f && Array.isArray(f[pmLang]) ? f[pmLang] : l || [];
        const postmortemItems = [...pmArr(aiPostmortem.whyRightI18n, aiPostmortem.whyRight), ...pmArr(aiPostmortem.whyWrongI18n, aiPostmortem.whyWrong), ...pmArr(aiPostmortem.processNotesI18n, aiPostmortem.processNotes)].slice(0, 4);
        const pmHeadline = i18nText(aiPostmortem.headlineI18n, aiPostmortem.headline || "");
        const postmortemRaw = [pmHeadline, ...postmortemItems].join(" ");
        const aiGenerated = aiPostmortem.status === "completed" && (pmHeadline || postmortemItems.length > 0);
        const hasChinesePostmortem = uiLang2 !== "zh" || Boolean(aiPostmortem.headlineI18n?.zh) || /[\u4e00-\u9fff]/.test(postmortemRaw) || aiGenerated;
        const evidence = review.evidence || {};
        const predictionSource = review.predictionSource || "pre_match";
        const predictionSnapshotNote = review.predictionSnapshotNote || null;
        const isRetrospective = predictionSource === "retrospective";
        const momentum = review.momentum || {};
        const momentumBuckets = momentum.buckets || [];
        const momentumScript = momentum.matchScript || "unknown";
        const momentumNotes = momentum.notes || [];
        const hasValue = (v) => v !== void 0 && v !== null && v !== "";
        const displayValue = (v, fb = "?") => hasValue(v) ? v : fb;
        const displayPct = (v) => hasValue(v) ? `${v}%` : "\u2014";
        const firstValue = (...vs) => {
          const f = vs.find(hasValue);
          return f === void 0 ? void 0 : f;
        };
        const scoreHome = firstValue(match.home?.score, match.homeScore);
        const scoreAway = firstValue(match.away?.score, match.awayScore);
        const matchTypeText = i18nText(summary.matchTypeI18n, summary.matchType || tx("\u5DF2\u7ED3\u675F", "Finished"));
        const overviewText = i18nText(summary.overviewI18n, summary.overview || "");
        const upsetText = i18nText(summary.upsetTextI18n, summary.upsetText || "");
        const biasSummary = i18nText(bias.summaryI18n, bias.summary || "");
        const sHN = Number(scoreHome), sAN = Number(scoreAway);
        const scoreColor = Number.isFinite(sHN) && Number.isFinite(sAN) ? sHN > sAN ? "green" : sHN < sAN ? "red" : "yellow" : "yellow";
        const rawKE = Array.isArray(review.keyEvents) ? review.keyEvents : [];
        const rawEE = Array.isArray(evidence.events) ? evidence.events : [];
        const seenTexts = new Set(rawKE.map((e) => typeof e === "string" ? e : e?.text || ""));
        const events = [...rawKE, ...rawEE.filter((e) => {
          const t = typeof e === "string" ? e : e?.text || "";
          if (!t || seenTexts.has(t)) return false;
          seenTexts.add(t);
          return true;
        })];
        let html = `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-start gap-2.5"><span class="text-lg mt-0.5">\u{1F4CB}</span><div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1"><span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-${["dominant_win", "goal_fest"].includes(summary.matchTypeKey) || summary.matchType === "\u78BE\u538B\u5927\u80DC" || summary.matchType === "\u8FDB\u7403\u5927\u6218" ? "yellow" : "blue"}-400">${matchTypeText}</span><span class="text-[11px] text-gray-500">${match.group || ""}</span></div><div class="text-xs text-gray-400 leading-relaxed">${overviewText}</div>${upsetText ? `<div class="text-[11px] font-bold text-yellow-400 mt-1">\u26A1 ${upsetText}</div>` : ""}</div></div></div>`;
        if (isRetrospective && predictionSnapshotNote) {
          html += `<div class="glass rounded-xl p-3 mb-2.5 border border-yellow-500/20 bg-yellow-500/5"><div class="flex items-start gap-2"><span class="text-sm mt-0.5">\u26A0\uFE0F</span><div class="text-[11px] text-yellow-300 leading-relaxed">${esc(i18nText(predictionSnapshotNote, predictionSnapshotNote.en || ""))}</div></div></div>`;
        }
        html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">\u{1F916} ${tx("AI \u9884\u6D4B vs \u771F\u5B9E\u7ED3\u679C", "AI Forecast vs Actual Result")}${isRetrospective ? ` <span class="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 align-middle">${tx("\u8D5B\u540E\u53C2\u8003", "retro")}</span>` : ""}</div><div class="grid grid-cols-2 gap-2"><div class="bg-white/5 rounded-lg p-2.5 text-center"><div class="text-[11px] text-gray-500 mb-1">${tx("AI \u9884\u6D4B", "AI Forecast")}</div><div class="text-xl font-bold text-blue-400">${ai.predictedScore || tx("\u7F3A\u5FEB\u7167", "No snapshot")}</div><div class="text-[11px] text-gray-500 mt-1">${tx("\u4E3B", "Home")} ${displayPct(ai.homeWin)} \xB7 ${tx("\u5E73", "Draw")} ${displayPct(ai.draw)} \xB7 ${tx("\u5BA2", "Away")} ${displayPct(ai.awayWin)}</div><div class="text-[11px] text-gray-600">xG ${displayValue(ai.homeExpectedGoals, "-")} - ${displayValue(ai.awayExpectedGoals, "-")}</div>${review.predictionSourceNote ? `<div class="text-[10px] text-amber-300 mt-1">${esc(review.predictionSourceNote)}</div>` : ""}</div><div class="bg-white/5 rounded-lg p-2.5 text-center"><div class="text-[11px] text-gray-500 mb-1">${tx("\u771F\u5B9E\u7ED3\u679C", "Actual Result")}</div><div class="text-xl font-bold text-${scoreColor}-400">${displayValue(scoreHome)} : ${displayValue(scoreAway)}</div><div class="text-[11px] text-gray-500 mt-1">${displayMaybeTeamName(match.homeNameI18n || match.home || "")} vs ${displayMaybeTeamName(match.awayNameI18n || match.away || "")}</div><div class="text-[11px] text-gray-600">${match.date || ""}</div></div></div>`;
        const accCls = bias.accuracy === "highly_accurate" || bias.accuracy === "exact_score" ? "text-green-400 bg-green-500/10" : bias.accuracy === "result_correct_score_wrong" ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10";
        const accLabel = bias.accuracy === "highly_accurate" || bias.accuracy === "exact_score" ? `\u{1F7E2} ${tx("\u7CBE\u51C6\u547D\u4E2D", "Accurate")}` : bias.accuracy === "result_correct_score_wrong" ? `\u{1F7E1} ${tx("\u6BD4\u5206\u504F\u5DEE", "Score off")}` : bias.accuracy === "wrong_result" ? `\u{1F534} ${tx("\u7ED3\u679C\u9519\u8BEF", "Wrong result")}` : `\u26AA ${tx("\u672A\u77E5", "Unknown")}`;
        html += `<div class="mt-2.5 pt-2.5 border-t border-white/5"><div class="flex items-center justify-between"><span class="text-[11px] font-bold ${accCls} px-2 py-0.5 rounded-md">${accLabel}</span><span class="text-[11px] text-gray-500">${tx("\u9884\u6D4B\u7F6E\u4FE1", "Forecast Confidence")} ${bias.predictedConfidence || 0}%</span></div><div class="text-[11px] text-gray-400 mt-1">${biasSummary}</div><div class="text-[9px] text-gray-600 mt-1">${tx('"\u7CBE\u51C6\u547D\u4E2D / \u6BD4\u5206\u504F\u5DEE / \u7ED3\u679C\u9519\u8BEF"\u4EC5\u4E3A\u672C\u573A\u9884\u6D4B\u4E0E\u7ED3\u679C\u7684\u5BF9\u6BD4\uFF0C\u4E0D\u4EE3\u8868\u6A21\u578B\u6574\u4F53\u51C6\u786E\u7387\u3002', '"Accurate / Score off / Wrong result" compares this match only and does not represent overall model accuracy.')}</div></div></div>`;
        if (factors.length > 0) {
          html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">\u{1F50D} ${tx("\u504F\u5DEE\u56E0\u7D20\u5206\u6790", "Bias Factors")}</div><div class="space-y-1.5">`;
          for (const f of factors) {
            const impCls = f.impact === "high" ? "border-red-500/20 bg-red-500/5" : f.impact === "medium" ? "border-yellow-500/20 bg-yellow-500/5" : "border-gray-500/20 bg-gray-500/5";
            const dotCls = f.impact === "high" ? "bg-red-500" : f.impact === "medium" ? "bg-yellow-500" : "bg-gray-500";
            html += `<div class="border ${impCls} rounded-lg p-2"><div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${dotCls} shrink-0"></span><span class="text-[11px] font-bold text-gray-300">${i18nText(f.factorI18n || f.nameI18n, f.factor || f.name || "")}</span><span class="text-[9px] text-gray-500 ml-auto uppercase">${f.impact || ""}</span></div><div class="text-[11px] text-gray-400 mt-0.5 ml-3">${i18nText(f.detailI18n, f.detail || "")}</div></div>`;
          }
          html += "</div></div>";
        }
        if (momentumScript !== "unknown" || momentumBuckets.length > 0) {
          const sl = { comeback: { zh: "\u9006\u8F6C", en: "Comeback", cls: "bg-orange-500/15 text-orange-400 border-orange-500/20", icon: "\u{1F504}" }, control_win: { zh: "\u63A7\u573A\u80DC", en: "Control Win", cls: "bg-green-500/15 text-green-400 border-green-500/20", icon: "\u{1F3AF}" }, smash_and_grab: { zh: "\u5077\u88AD", en: "Smash & Grab", cls: "bg-red-500/15 text-red-400 border-red-500/20", icon: "\u{1F977}" }, collapse: { zh: "\u5D29\u76D8", en: "Collapse", cls: "bg-red-500/15 text-red-400 border-red-500/20", icon: "\u{1F4C9}" }, even: { zh: "\u50F5\u6301", en: "Even", cls: "bg-gray-500/15 text-gray-400 border-gray-500/20", icon: "\u2696\uFE0F" } };
          const script = sl[momentumScript] || { zh: momentumScript, en: momentumScript, cls: "bg-gray-500/15 text-gray-400 border-gray-500/20", icon: "\u2753" };
          html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-center justify-between mb-2.5"><div class="text-xs font-bold text-gray-400">\u{1F4CA} ${tx("\u6BD4\u8D5B\u52A8\u91CF", "Match Momentum")}</div><span class="text-[10px] px-1.5 py-0.5 rounded-full border ${script.cls}">${script.icon} ${i18nText({ zh: script.zh, en: script.en }, script.en)}</span></div>`;
          if (momentumBuckets.length > 0) {
            const maxShots = Math.max(1, ...momentumBuckets.map((b) => Math.max(b.homeShots || 0, b.awayShots || 0)));
            html += `<div class="space-y-1">`;
            for (const b of momentumBuckets) {
              const hW = Math.round((b.homeShots || 0) / maxShots * 100), aW = Math.round((b.awayShots || 0) / maxShots * 100);
              html += `<div class="flex items-center gap-1.5 text-[10px]"><span class="w-10 text-right text-gray-500 shrink-0">${b.window || ""}'</span><div class="flex-1 flex items-center gap-0.5"><div class="flex justify-end flex-1"><div class="h-3 rounded-sm bg-blue-500/40" style="width:${hW}%"></div></div><span class="text-gray-500 w-5 text-center shrink-0">${b.homeShots || 0}-${b.awayShots || 0}</span><div class="flex justify-start flex-1"><div class="h-3 rounded-sm bg-red-500/40" style="width:${aW}%"></div></div></div><span class="text-gray-500 w-12 text-left shrink-0">${(b.goals || 0) > 0 ? " \u26BD".repeat(b.goals) : ""}</span></div>`;
            }
            html += `</div><div class="flex justify-between text-[9px] text-gray-600 mt-1.5"><span>${tx("\u4E3B\u961F\u5C04\u95E8", "Home shots")}</span><span>H-A</span><span>${tx("\u5BA2\u961F\u5C04\u95E8", "Away shots")}</span></div>`;
          }
          if (momentumNotes.length > 0) {
            html += `<div class="mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 space-y-0.5">`;
            for (const note of momentumNotes.slice(0, 3)) {
              const noteText = typeof note === "object" && note !== null ? tx(note.zh, note.en) : String(note);
              html += `<div class="leading-relaxed">\u{1F4A1} ${noteText}</div>`;
            }
            html += `</div>`;
          }
          html += "</div>";
        }
        if (eloChange.homeBefore != null) {
          const hD = eloChange.homeChange || 0, aD = eloChange.awayChange || 0;
          html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">\u26A1 ${tx("Elo \u8BC4\u5206\u53D8\u5316", "Elo Rating Change")}</div><div class="grid grid-cols-2 gap-2"><div class="bg-white/5 rounded-lg p-2"><div class="flex items-center justify-between"><span class="text-[11px] font-bold">${displayMaybeTeamName(match.homeNameI18n || match.home || "")}</span><span class="text-[11px] font-mono font-bold ${hD > 0 ? "text-green-400" : hD < 0 ? "text-red-400" : "text-gray-400"}">${hD > 0 ? "+" : ""}${hD}</span></div><div class="text-[11px] text-gray-500 mt-1">${eloChange.homeBefore} \u2192 <span class="text-white font-bold">${eloChange.homeAfter}</span></div></div><div class="bg-white/5 rounded-lg p-2"><div class="flex items-center justify-between"><span class="text-[11px] font-bold">${displayMaybeTeamName(match.awayNameI18n || match.away || "")}</span><span class="text-[11px] font-mono font-bold ${aD > 0 ? "text-green-400" : aD < 0 ? "text-red-400" : "text-gray-400"}">${aD > 0 ? "+" : ""}${aD}</span></div><div class="text-[11px] text-gray-500 mt-1">${eloChange.awayBefore} \u2192 <span class="text-white font-bold">${eloChange.awayAfter}</span></div></div></div><div class="text-[11px] text-gray-600 mt-1.5 flex items-center gap-2"><span>${tx("\u9884\u671F\u80DC\u7387", "Expected Win Rate")}: ${Math.round((eloChange.expectedHome || 0) * 100)}% / ${Math.round((eloChange.expectedAway || 0) * 100)}%</span><span>${tx("\u6BD4\u5206\u52A0\u6210", "Score Multiplier")}: x${(eloChange.goalDiffMultiplier || 1).toFixed(2)}</span></div></div>`;
        }
        if (events.length > 0) {
          html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="text-xs font-bold text-gray-400 mb-2">\u{1F3AC} ${tx("\u5173\u952E\u4E8B\u4EF6", "Key Events")}</div><div class="space-y-1">`;
          for (const evt of events) {
            const ne = typeof evt === "string" ? { text: evt } : evt || {};
            const eTxt = i18nText(ne.textI18n, firstValue(ne.text, ne.description, ne.title, ne.event, ne.summary, ""));
            const eClr = ne.type === "goal" ? "bg-green-500/15 text-green-400" : ne.type === "highlight" ? "bg-yellow-500/10 text-yellow-400" : "bg-blue-500/10 text-blue-400";
            const eIco = ne.type === "goal" ? "\u26BD" : ne.type === "highlight" ? "\u2B50" : "\u{1F4A1}";
            html += `<div class="flex items-start gap-2 py-1"><span class="text-[11px] font-mono text-gray-600 shrink-0 w-8 text-right">${displayValue(ne.minute, "")}</span><span class="${eClr} px-1.5 py-0.5 rounded text-[11px] shrink-0">${eIco}</span><span class="text-[11px] text-gray-300">${esc(eTxt)}</span>${hasValue(ne.score) ? `<span class="text-[11px] font-mono font-bold text-white ml-auto shrink-0">${esc(ne.score)}</span>` : ""}</div>`;
          }
          html += "</div></div>";
        }
        html += `<div class="glass rounded-xl p-3 mb-2.5"><div class="flex items-center justify-between mb-2"><div class="text-xs font-bold text-purple-400">\u{1F9E0} ${tx("AI \u8D5B\u540E\u590D\u76D8\uFF08\u5B9E\u9A8C\u6027\uFF09", "AI Post-match Review (Experimental)")}</div><span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">${aiPostmortem.status || "pending_provider"}</span></div>${aiPostmortem.headline || aiPostmortem.headlineI18n ? `<div class="text-xs font-bold text-white mb-1">${i18nText(aiPostmortem.headlineI18n, aiPostmortem.headline || "")} ${!hasChinesePostmortem ? `<span class="text-[9px] text-yellow-500 font-normal ml-1">(${tx("\u672A\u8FD4\u56DE\u4E2D\u6587", "English Only")})</span>` : ""}</div>` : `<div class="text-[11px] text-gray-500 mb-1">${tx("AI \u8D5B\u540E\u590D\u76D8\u6B63\u5728\u751F\u6210\u4E2D...", "Waiting for expert commentary/news evidence before AI attribution")}</div>`}<div class="grid grid-cols-3 gap-1.5 text-[10px] text-gray-500 mb-2"><div class="bg-white/5 rounded p-1.5 text-center">${tx("\u4E8B\u4EF6", "Events")} ${evidence.events?.length || 0}</div><div class="bg-white/5 rounded p-1.5 text-center">${tx("\u65B0\u95FB", "News")} ${evidence.news?.length || 0}</div><div class="bg-white/5 rounded p-1.5 text-center">${tx("\u8BC4\u8BBA", "Commentary")} ${evidence.commentary?.length || 0}</div></div>${postmortemItems.length > 0 ? postmortemItems.map((n) => `<div class="text-[11px] text-gray-300 border-l border-purple-400/30 pl-2 mb-1">${i18nText(n)}</div>`).join("") : ""}</div>`;
        html += `<div class="text-center text-[9px] text-gray-700 mt-2">${tx("\u5B9E\u9A8C\u6027\u8D5B\u540E\u590D\u76D8\uFF1AAI \u81EA\u52A8\u751F\u6210\u5185\u5BB9\u53EF\u80FD\u4E0D\u5B8C\u6574\u6216\u5B58\u5728\u8BEF\u5DEE\uFF0C\u4EC5\u4F9B\u53C2\u8003\u3002", "Experimental post-match review: AI-generated content may be incomplete or inaccurate and is for reference only.")}</div>`;
        return html;
      }
      window.WorldCup.MatchReview = { renderMatchReview };
      Object.assign(window, { renderMatchReview });
    })();
  }
});

// static/js/player-detail.js
var require_player_detail = __commonJS({
  "static/js/player-detail.js"() {
    (function() {
      "use strict";
      const { tx, esc, api } = window.WorldCup.Utils;
      const { translatePlayerName } = window.WorldCup.I18n;
      function openPlayerDetail(id, inlineData, teamId) {
        if (!id && !inlineData) return;
        const modal = document.getElementById("match-modal");
        const content = document.getElementById("modal-content");
        modal.classList.remove("hidden");
        content.innerHTML = '<div class="py-10 text-center text-gray-500">' + tx("\u52A0\u8F7D\u7403\u5458\u4FE1\u606F...", "Loading player...") + "</div>";
        const showInline = () => {
          if (!inlineData) {
            content.innerHTML = '<div class="text-gray-500 text-center py-10">' + tx("\u7403\u5458\u6570\u636E\u6682\u65E0", "No player data") + "</div>";
            return;
          }
          const nameZh = translatePlayerName(inlineData.name, inlineData.nameZh);
          content.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center gap-3">
                    <div class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl">\u26BD</div>
                    <div>
                        <h3 class="font-bold text-lg">${nameZh}</h3>
                        ${nameZh !== inlineData.name ? `<div class="text-xs text-gray-500">${inlineData.name}</div>` : ""}
                        <div class="text-xs text-gray-500">${inlineData.pos || ""} \xB7 ${inlineData.nationality || ""}</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    ${inlineData.jersey ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx("\u7403\u8863\u53F7", "Jersey")}</div><div class="font-bold">#${inlineData.jersey}</div></div>` : ""}
                    ${inlineData.age ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx("\u5E74\u9F84", "Age")}</div><div class="font-bold">${inlineData.age}${tx("\u5C81", "")}</div></div>` : ""}
                    ${inlineData.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx("\u8EAB\u9AD8", "Height")}</div><div class="font-bold">${inlineData.height}</div></div>` : ""}
                    ${inlineData.pos ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx("\u4F4D\u7F6E", "Position")}</div><div class="font-bold">${inlineData.pos}</div></div>` : ""}
                </div>
                <div class="text-[11px] text-gray-600 text-center">${tx("\u8BE6\u7EC6\u6570\u636E\u52A0\u8F7D\u4E2D...", "Loading stats...")}</div>
            </div>`;
        };
        if (inlineData) showInline();
        if (!id && !teamId) return;
        const fallbackRosterSearch = () => {
          if (!teamId || !inlineData || !inlineData.name) {
            api("/api/player/" + id).then((basic) => {
              if (!basic || basic.error) {
                if (!inlineData) showInline();
                return;
              }
              content.innerHTML = renderPlayerBasic(basic);
            }).catch(() => {
              if (!inlineData) showInline();
            });
            return;
          }
          api("/api/team/" + teamId).then((t) => {
            if (!t || !t.roster) throw new Error("no roster");
            const p = t.roster.find((x) => x.name.toLowerCase() === inlineData.name.toLowerCase() || x.name.toLowerCase().includes(inlineData.name.toLowerCase()) || inlineData.name.toLowerCase().includes(x.name.toLowerCase()));
            if (p && p.id && String(p.id) !== String(id)) {
              api("/api/player/" + p.id + "/enhanced").then((d2) => {
                if (d2 && !d2.error) content.innerHTML = renderPlayerEnhanced(d2);
                else showInline();
              }).catch(showInline);
            } else {
              api("/api/player/" + id).then((basic) => {
                if (!basic || basic.error) {
                  if (!inlineData) showInline();
                  return;
                }
                content.innerHTML = renderPlayerBasic(basic);
              }).catch(() => {
                if (!inlineData) showInline();
              });
            }
          }).catch(() => showInline());
        };
        if (!id) {
          fallbackRosterSearch();
          return;
        }
        api("/api/player/" + id + "/enhanced").then((d) => {
          if (!d || d.error) {
            fallbackRosterSearch();
            return;
          }
          if (inlineData?.name && d.name) {
            const normA = inlineData.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
            const normB = d.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
            if (!normB.includes(normA.split(" ")[0]) && !normA.includes(normB.split(" ")[0])) {
              fallbackRosterSearch();
              return;
            }
          }
          content.innerHTML = renderPlayerEnhanced(d);
        }).catch(() => fallbackRosterSearch());
      }
      function renderPlayerBasic(d) {
        return `
        <div class="space-y-3">
            <!-- Header -->
            <div class="flex items-center gap-3">
                ${d.headshot ? `<img src="${d.headshot}" class="w-16 h-16 rounded-full object-cover bg-white/10">` : ""}
                <div>
                    <h3 class="font-bold text-lg">${d.name}</h3>
                    <div class="text-xs text-gray-500">${d.position || ""} \xB7 ${d.team || ""} \xB7 ${d.nationality || ""}</div>
                </div>
            </div>
            
            <!-- Basic Info -->
            <div class="grid grid-cols-2 gap-2 text-xs">
                ${d.age ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">\u5E74\u9F84</div><div class="font-bold">${d.age}\u5C81</div></div>` : ""}
                ${d.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">\u8EAB\u9AD8</div><div class="font-bold">${d.height}</div></div>` : ""}
                ${d.weight ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">\u4F53\u91CD</div><div class="font-bold">${d.weight}</div></div>` : ""}
                ${d.jersey ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">\u7403\u8863</div><div class="font-bold">#${d.jersey}</div></div>` : ""}
            </div>
        </div>`;
      }
      function renderPlayerEnhanced(d) {
        const getFormColor = (form) => {
          switch (form) {
            case "excellent":
              return "text-green-400";
            case "good":
              return "text-blue-400";
            case "average":
              return "text-yellow-400";
            case "poor":
              return "text-red-400";
            default:
              return "text-gray-400";
          }
        };
        const getTrendIcon = (trend) => {
          switch (trend) {
            case "rising":
              return "\u{1F4C8}";
            case "stable":
              return "\u27A1\uFE0F";
            case "declining":
              return "\u{1F4C9}";
            default:
              return "\u27A1\uFE0F";
          }
        };
        const formatMarketValue = (value) => {
          if (value >= 1e7) return `\u20AC${(value / 1e7).toFixed(1)}\u5343\u4E07`;
          if (value >= 1e6) return `\u20AC${(value / 1e6).toFixed(1)}\u767E\u4E07`;
          if (value >= 1e3) return `\u20AC${(value / 1e3).toFixed(0)}\u5343`;
          return `\u20AC${value}`;
        };
        const nameZh = translatePlayerName(d.name, d.nameZh);
        return `
        <div class="space-y-3">
            <!-- Header -->
            <div class="flex items-center gap-3">
                ${d.headshot ? `<img src="${d.headshot}" class="w-16 h-16 rounded-full object-cover bg-white/10" onerror="this.style.display='none'">` : '<div class="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl">\u26BD</div>'}
                <div>
                    <h3 class="font-bold text-lg">${nameZh}</h3>
                    ${nameZh !== d.name ? `<div class="text-xs text-gray-500">${d.name}</div>` : ""}
                    <div class="text-xs text-gray-400">${d.position || ""} \xB7 <span class="text-blue-400">${d.club || d.team || ""}</span></div>
                    <div class="text-[11px] text-gray-500">${d.nationality || ""} \xB7 #${d.jersey || "?"} \xB7 ${d.age || "?"}${tx("\u5C81", "")}</div>
                </div>
            </div>
            <!-- Basic Info -->
            <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
                ${d.height ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx("\u8EAB\u9AD8", "Height")}</div><div class="font-bold">${d.height}</div></div>` : ""}
                ${d.weight ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx("\u4F53\u91CD", "Weight")}</div><div class="font-bold">${d.weight}</div></div>` : ""}
                ${d.dob ? `<div class="glass-light rounded-lg p-2"><div class="text-gray-500">${tx("\u751F\u65E5", "DOB")}</div><div class="font-bold">${d.dob}</div></div>` : ""}
            </div>
            <!-- Club Stats this season -->
            ${d.clubStats && d.clubStats.dataQuality === "live" ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-blue-400 mb-2">\u{1F3DF}\uFE0F ${d.clubStats.season || tx("\u672C\u8D5B\u5B63\u6570\u636E", "Season Stats")}</div>
                <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
                    ${d.clubStats.appearances != null ? `<div><div class="text-gray-500">${tx("\u51FA\u573A", "Apps")}</div><div class="font-bold">${d.clubStats.appearances}</div></div>` : ""}
                    ${d.clubStats.goals != null ? `<div><div class="text-gray-500">${tx("\u8FDB\u7403", "Goals")}</div><div class="font-bold text-green-400">${d.clubStats.goals}</div></div>` : ""}
                    ${d.clubStats.assists != null ? `<div><div class="text-gray-500">${tx("\u52A9\u653B", "Assists")}</div><div class="font-bold text-yellow-400">${d.clubStats.assists}</div></div>` : ""}
                </div>
            </div>
            ` : ""}
            <!-- Traits -->
            ${d.traits?.length > 0 ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">\u2B50 ${tx("\u7403\u5458\u7279\u8272", "Player Traits")}</div>
                <div class="space-y-1">
                    ${d.traits.map((trait) => `
                    <div class="flex items-center justify-between text-[11px]">
                        <span>${trait.name}</span>
                        <span class="font-bold text-blue-400">${trait.score}</span>
                    </div>
                    `).join("")}
                </div>
            </div>
            ` : ""}
            <!-- Recent Form -->
            ${d.recentForm ? `
            <div class="glass-light rounded-lg p-2">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-gray-400">\u{1F4CA} ${tx("\u8FD1\u671F\u8868\u73B0", "Recent Form")}</span>
                    <span class="text-xs ${getFormColor(d.recentForm.form)}">
                        ${getTrendIcon(d.recentForm.trend)} ${d.recentForm.form === "excellent" ? tx("\u51FA\u8272", "Excellent") : d.recentForm.form === "good" ? tx("\u826F\u597D", "Good") : d.recentForm.form === "average" ? tx("\u4E00\u822C", "Average") : tx("\u4F4E\u8FF7", "Poor")}
                    </span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                        <span class="text-gray-500">${tx("\u51FA\u573A", "Appearances")}</span>
                        <span class="font-bold ml-1">${d.recentForm.matches}${tx("\u573A", "")}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx("\u8FDB\u7403", "Goals")}</span>
                        <span class="font-bold ml-1 text-green-400">${d.recentForm.goals}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx("\u52A9\u653B", "Assists")}</span>
                        <span class="font-bold ml-1 text-blue-400">${d.recentForm.assists}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">${tx("\u8BC4\u5206", "Rating")}</span>
                        <span class="font-bold ml-1">${d.recentForm.rating ?? "-"}</span>
                    </div>
                </div>
            </div>
            ` : ""}
            <!-- Club Stats -->
            ${d.clubStats && d.clubStats.dataQuality !== "unavailable" ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">\u{1F3DF}\uFE0F \u4FF1\u4E50\u90E8\u6570\u636E</div>
                ${d.clubStats.season ? `<div class="text-[11px] text-gray-500 mb-1">${d.clubStats.season}</div>` : ""}
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                    ${d.clubStats.appearances != null ? `<div><span class="text-gray-500">\u51FA\u573A</span><span class="font-bold ml-1">${d.clubStats.appearances}</span></div>` : ""}
                    ${d.clubStats.goals != null ? `<div><span class="text-gray-500">\u8FDB\u7403</span><span class="font-bold ml-1 text-green-400">${d.clubStats.goals}</span></div>` : ""}
                    ${d.clubStats.assists != null ? `<div><span class="text-gray-500">\u52A9\u653B</span><span class="font-bold ml-1 text-blue-400">${d.clubStats.assists}</span></div>` : ""}
                    ${d.clubStats.shots != null ? `<div><span class="text-gray-500">\u5C04\u95E8</span><span class="font-bold ml-1">${d.clubStats.shots}</span></div>` : ""}
                </div>
            </div>
            ` : ""}
            <!-- National Stats -->
            ${d.nationalStats && d.nationalStats.dataQuality === "live" ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">\u{1F30D} \u56FD\u5BB6\u961F\u6570\u636E</div>
                ${d.nationalStats.teamCode ? `<div class="text-[11px] text-gray-500 mb-1">${d.nationalStats.teamCode}</div>` : ""}
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span class="text-gray-500">\u56FD\u5BB6\u961F\u5E3D</span><span class="font-bold ml-1">${d.nationalStats.caps ?? "-"}</span></div>
                    <div><span class="text-gray-500">\u56FD\u5BB6\u961F\u8FDB\u7403</span><span class="font-bold ml-1 text-green-400">${d.nationalStats.goals ?? "-"}</span></div>
                    <div><span class="text-gray-500">\u672C\u5C4A\u51FA\u573A</span><span class="font-bold ml-1">${d.nationalStats.tournamentApps ?? "-"}</span></div>
                    <div><span class="text-gray-500">\u672C\u5C4A\u8FDB\u7403</span><span class="font-bold ml-1 text-yellow-400">${d.nationalStats.tournamentGoals ?? "-"}</span></div>
                </div>
            </div>
            ` : ""}
            <!-- Injury History -->
            ${d.injuryHistory?.length > 0 ? `
            <div class="glass-light rounded-lg p-2">
                <div class="text-xs font-bold text-gray-400 mb-2">\u{1F3E5} \u4F24\u75C5\u5386\u53F2</div>
                ${d.injuryHistory.map((injury) => `
                <div class="text-[11px] py-1 border-b border-white/5">
                    <div class="flex items-center justify-between">
                        <span>${injury.type}</span>
                        <span class="text-gray-600">${injury.date}</span>
                    </div>
                    <div class="text-gray-500">${injury.duration} \xB7 ${injury.status}</div>
                </div>
                `).join("")}
            </div>
            ` : ""}
        </div>`;
      }
      window.WorldCup.PlayerDetail = { openPlayerDetail, renderPlayerBasic, renderPlayerEnhanced };
      Object.assign(window, { openPlayerDetail });
    })();
  }
});

// static/js/pre-match.js
var require_pre_match = __commonJS({
  "static/js/pre-match.js"() {
    (function() {
      "use strict";
      const API2 = window.WorldCup.ApiClient;
      const { tx, esc } = window.WorldCup.Utils;
      const { renderSpatialMatchupPanel } = window.WorldCup.SpatialMatchup;
      const { renderVenueWeather, renderCornerAnalysis } = window.WorldCup.MatchDetail;
      const { scheduleCache } = window.WorldCup.State;
      const { renderRecentAvgComparison } = window.WorldCup.MatchStats;
      async function openPreMatch(matchId, homeId, awayId, homeName, awayName, venueName = "") {
        const modal = document.getElementById("match-modal");
        const content = document.getElementById("modal-content");
        modal.classList.remove("hidden");
        content.innerHTML = `<div class="py-10 text-center text-gray-500">${tx("\u52A0\u8F7D\u8D5B\u524D\u5206\u6790...", "Loading pre-match analysis...")}</div>`;
        const spatialResult = await API2.get(`/api/matchup-spatial/${homeId}/${awayId}`, { timeout: API2.TIMEOUT_LONG });
        const spatialData = spatialResult.data;
        let html = `<h3 class="font-bold text-base mb-2">\u{1F4CB} ${tx("\u8D5B\u524D\u5206\u6790", "Pre-match Analysis")}</h3>`;
        html += `<div class="mb-4">${renderSpatialMatchupPanel(spatialData)}</div>`;
        const scheduledVenue = venueName || scheduleCache.find((m) => String(m.id) === String(matchId))?.venue || "";
        html += `<div id="pre-match-venue" class="glass rounded-xl p-3 mb-3 text-xs text-gray-500">\u{1F3DF}\uFE0F ${scheduledVenue ? `${tx("\u5DF2\u77E5\u573A\u9986", "Known venue")}: ${esc(scheduledVenue)} \xB7 ${tx("\u52A0\u8F7D\u573A\u5730\u6761\u4EF6...", "Loading venue conditions...")}` : tx("\u52A0\u8F7D\u573A\u5730\u4E0E\u5929\u6C14...", "Loading venue & weather...")}</div>`;
        html += `<div class="mt-4">
            <div class="flex gap-1.5 mb-3 overflow-x-auto">
                <button data-action="switch-detail-tab" data-detail-tab="stats" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white">\u{1F4CA} ${tx("\u7EDF\u8BA1", "Stats")}</button>
                <button data-action="switch-detail-tab" data-detail-tab="corners" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400">\u{1F4D0} ${tx("\u89D2\u7403", "Corners")}</button>
                <button data-action="switch-detail-tab" data-detail-tab="coach" class="detail-tab px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-gray-400">\u{1F9E0} ${tx("\u6559\u7EC3", "Coach")}</button>
            </div>
            <div id="detail-content-stats" class="detail-content">
                <div class="flex items-center gap-2 mb-3">
                    <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                    <span class="text-xs text-gray-500">${tx("\u52A0\u8F7D\u7EDF\u8BA1\u6570\u636E...", "Loading stats...")}</span>
                </div>
            </div>
            <div id="detail-content-corners" class="detail-content hidden">
                <div class="text-gray-500 text-xs py-4 text-center">${tx("\u52A0\u8F7D\u89D2\u7403\u6570\u636E...", "Loading corner data...")}</div>
            </div>
            <div id="detail-content-coach" class="detail-content hidden">
                <div class="flex items-center gap-2 mb-3">
                    <div class="loader w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                    <span class="text-xs text-gray-500">${tx("\u52A0\u8F7D\u6559\u7EC3\u6570\u636E...", "Loading coach data...")}</span>
                </div>
            </div>
        </div>`;
        content.innerHTML = html;
        Promise.allSettled([
          homeId ? API2.get(`/api/team/${homeId}/recent-stats`) : Promise.resolve({ data: null }),
          awayId ? API2.get(`/api/team/${awayId}/recent-stats`) : Promise.resolve({ data: null })
        ]).then(([hRes, aRes]) => {
          const el = document.getElementById("detail-content-stats");
          if (!el) return;
          const hs = hRes.status === "fulfilled" && hRes.value?.data?.stats ? hRes.value.data : null;
          const as = aRes.status === "fulfilled" && aRes.value?.data?.stats ? aRes.value.data : null;
          if (!hs && !as) {
            el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">
                    <p>\u{1F4CA} ${tx("\u8D5B\u524D\u6682\u65E0\u53EF\u7528\u7EDF\u8BA1", "No pre-match stats")}</p>
                    <p class="text-gray-600 mt-1 text-[10px]">${tx("\u7F3A\u4E4F\u8FD1\u671F\u5B8C\u8D5B\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u751F\u6210\u573A\u5747\u7EDF\u8BA1\u3002", "Insufficient completed matches to generate averages.")}</p>
                </div>`;
            return;
          }
          const hName = homeName || (hs?.teamId || "");
          const aName = awayName || (as?.teamId || "");
          let statsHtml = `<h4 class="text-xs font-bold text-gray-500 mb-2">\u{1F4CA} ${tx("\u8FD1\u671F\u573A\u5747\u7EDF\u8BA1", "Recent Avg Stats")}</h4>`;
          statsHtml += `<p class="text-[10px] text-gray-500 mb-3">${tx("\u57FA\u4E8E\u8FD1\u671F\u5B8C\u8D5B\u8BB0\u5F55\u751F\u6210\uFF0C\u975E\u9884\u6D4B\u3002", "Based on recent completed matches, not predictions.")}</p>`;
          statsHtml += renderRecentAvgComparison(hs, as, hName, aName);
          el.innerHTML = statsHtml;
        }).catch(() => {
          const el = document.getElementById("detail-content-stats");
          if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u7EDF\u8BA1\u6570\u636E\u52A0\u8F7D\u5931\u8D25", "Failed to load stats")}</div>`;
        });
        API2.get("/api/coach-compare/" + homeId + "/" + awayId, { timeout: 8e3 }).then((res) => {
          const el = document.getElementById("detail-content-coach");
          const coachData = res?.data;
          if (el && coachData && !coachData.error) {
            el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(coachData, false);
          } else if (el) {
            el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(null, false);
          }
        }).catch(() => {
          const el = document.getElementById("detail-content-coach");
          if (el) el.innerHTML = window.WorldCup.MatchRenderers.renderCoachPanel(null, false);
        });
        const venueRequest = scheduledVenue ? API2.get("/api/venue/" + encodeURIComponent(scheduledVenue), { timeout: API2.TIMEOUT_LONG }).then((r) => r.data) : API2.get("/api/match/" + matchId).then((r) => {
          const match = r.data;
          const fallbackVenue = match?.venue || "";
          return fallbackVenue ? API2.get("/api/venue/" + encodeURIComponent(fallbackVenue), { timeout: API2.TIMEOUT_LONG }).then((r2) => r2.data) : null;
        });
        venueRequest.then((venue) => {
          const el = document.getElementById("pre-match-venue");
          if (!el) return;
          el.innerHTML = venue && !venue.error ? renderVenueWeather(venue) : `<div class="text-gray-500 text-xs py-2">\u{1F3DF}\uFE0F ${tx("\u573A\u5730\u6216\u5B9E\u65F6\u5929\u6C14\u6682\u4E0D\u53EF\u7528\uFF1B\u8BE5\u4FE1\u606F\u4E0D\u53C2\u4E0E\u9884\u6D4B\u3002", "Venue or live weather is unavailable; it is not used in the prediction.")}</div>`;
        }).catch(() => {
          const el = document.getElementById("pre-match-venue");
          if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-2">\u{1F3DF}\uFE0F ${tx("\u573A\u5730\u6216\u5B9E\u65F6\u5929\u6C14\u6682\u4E0D\u53EF\u7528\uFF1B\u8BE5\u4FE1\u606F\u4E0D\u53C2\u4E0E\u9884\u6D4B\u3002", "Venue or live weather is unavailable; it is not used in the prediction.")}</div>`;
        });
        API2.get("/api/corner-analysis/" + matchId).then((res) => {
          const el = document.getElementById("detail-content-corners");
          if (el && res.ok && res.data) el.innerHTML = renderCornerAnalysis(res.data);
          else if (el) el.innerHTML = `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u89D2\u7403\u6570\u636E\u6682\u65E0", "No corner data")}</div>`;
        });
      }
      window.WorldCup.PreMatch = { openPreMatch };
      Object.assign(window, { openPreMatch });
    })();
  }
});

// static/js/odds-card.js
var require_odds_card = __commonJS({
  "static/js/odds-card.js"() {
    (function() {
      "use strict";
      const { tx } = window.WorldCup.Utils;
      function renderOddsTrend(current, previous) {
        if (!previous) return `<span class="text-gray-600 text-[11px]">${tx("\u9996\u6B21\u6570\u636E", "First sample")}</span>`;
        const diff = current - previous;
        const pct = (diff / previous * 100).toFixed(1);
        if (Math.abs(diff) < 0.01) return '<span class="trend-flat">\u2192</span>';
        if (diff > 0) return `<span class="trend-up arrow-bounce">\u2191 +${pct}%</span>`;
        return `<span class="trend-down arrow-bounce">\u2193 ${pct}%</span>`;
      }
      function renderOddsCard(odds) {
        if (!odds || odds.source === "api_key_not_configured") return "";
        const hist = odds.history || [];
        const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
        const homeTrend = prev ? renderOddsTrend(odds.homeWin, prev.homeWin) : "";
        const drawTrend = prev ? renderOddsTrend(odds.draw, prev.draw) : "";
        const awayTrend = prev ? renderOddsTrend(odds.awayWin, prev.awayWin) : "";
        return `
        <div class="glass rounded-xl p-3 mb-3">
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-bold text-yellow-400">\u{1F4B0} ${tx("\u76D8\u53E3", "Odds")}</h4>
                <div class="flex items-center gap-2">
                    ${odds._frozen ? `<span class="text-[11px] text-orange-400 font-bold">\u26A1 ${tx("\u8D5B\u524D\u6570\u636E", "Pre-match data")}</span>` : ""}
                    <span class="text-[11px] text-gray-600">${odds.bookmakers?.length || 0}${tx("\u5BB6\u535A\u5F69", " books")}</span>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center mb-2">
                <div class="glass-light rounded-lg p-2">
                    <div class="text-[11px] text-gray-500">${tx("\u4E3B\u80DC", "Home")}</div>
                    <div class="text-base font-bold text-green-400">${odds.homeWin || "-"}</div>
                    <div class="text-[11px]">${homeTrend}</div>
                </div>
                <div class="glass-light rounded-lg p-2">
                    <div class="text-[11px] text-gray-500">${tx("\u5E73\u5C40", "Draw")}</div>
                    <div class="text-base font-bold">${odds.draw || "-"}</div>
                    <div class="text-[11px]">${drawTrend}</div>
                </div>
                <div class="glass-light rounded-lg p-2">
                    <div class="text-[11px] text-gray-500">${tx("\u5BA2\u80DC", "Away")}</div>
                    <div class="text-base font-bold text-blue-400">${odds.awayWin || "-"}</div>
                    <div class="text-[11px]">${awayTrend}</div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="glass-light rounded-lg p-2 text-center">
                    <div class="text-[11px] text-gray-500">${tx("\u5927\u5C0F\u7403", "Total")} ${odds.overUnder?.line || 2.5}</div>
                    <div>${tx("\u5927", "Over")} ${odds.overUnder?.over || "-"} / ${tx("\u5C0F", "Under")} ${odds.overUnder?.under || "-"}</div>
                </div>
                <div class="glass-light rounded-lg p-2 text-center">
                    <div class="text-[11px] text-gray-500">${tx("\u8BA9\u7403\u76D8", "Handicap")}</div>
                    <div>${odds.asianHandicap?.line > 0 ? tx("\u4E3B\u8BA9", "Home -") + odds.asianHandicap.line : odds.asianHandicap?.line < 0 ? tx("\u5BA2\u8BA9", "Away -") + Math.abs(odds.asianHandicap.line) : tx("\u5E73\u624B", "Level")} ${odds.asianHandicap?.home || "-"}</div>
                </div>
            </div>
        </div>`;
      }
      window.WorldCup.OddsCard = { renderOddsTrend, renderOddsCard };
      Object.assign(window, { renderOddsTrend, renderOddsCard });
    })();
  }
});

// static/js/ui-helpers.js
var require_ui_helpers = __commonJS({
  "static/js/ui-helpers.js"() {
    (function() {
      "use strict";
      const { esc } = window.WorldCup.Utils;
      function setPitchView(mode, btn) {
        window.WorldCup.State.pitchViewMode = mode;
        const panel = btn.closest(".spatial-matchup-panel") || document;
        panel.querySelectorAll(".pitch-view-btn").forEach((b) => {
          b.classList.remove("bg-white/10", "text-white", "font-bold");
          b.classList.add("bg-white/5", "text-gray-500");
        });
        btn.classList.remove("bg-white/5", "text-gray-500");
        btn.classList.add("bg-white/10", "text-white", "font-bold");
        panel.querySelectorAll(".pitch-home").forEach((el) => el.style.display = mode === "away" ? "none" : "");
        panel.querySelectorAll(".pitch-away").forEach((el) => el.style.display = mode === "home" ? "none" : "");
        panel.querySelectorAll(".pitch-pair").forEach((el) => el.style.display = mode === "both" ? "" : "none");
      }
      const POS_ZH = { GK: "\u95E8\u5C06", CB: "\u4E2D\u540E\u536B", LB: "\u5DE6\u540E\u536B", RB: "\u53F3\u540E\u536B", LWB: "\u5DE6\u7FFC\u536B", RWB: "\u53F3\u7FFC\u536B", DF: "\u540E\u536B", DM: "\u540E\u8170", CM: "\u4E2D\u573A", AM: "\u653B\u51FB\u4E2D\u573A", LM: "\u5DE6\u4E2D\u573A", RM: "\u53F3\u4E2D\u573A", MF: "\u4E2D\u573A", LW: "\u5DE6\u7FFC", RW: "\u53F3\u7FFC", SS: "\u5F71\u5B50\u524D\u950B", CF: "\u4E2D\u950B", ST: "\u524D\u950B", FW: "\u524D\u950B" };
      function showTip(el, name, pos, rating, team, status, goals) {
        let tip = document.getElementById("player-tip");
        if (!tip) {
          tip = document.createElement("div");
          tip.id = "player-tip";
          tip.className = "player-tip";
          document.body.appendChild(tip);
        }
        const tx = window.WorldCup?.I18n?.tx || ((zh) => zh);
        const lang = window.WorldCup?.State?.uiLang || "zh";
        const cls = rating >= 7.5 ? "text-green-400" : rating >= 6.5 ? "text-yellow-400" : "text-red-400";
        const defaultStatus = tx("\u9996\u53D1", "Starting");
        const st = status || defaultStatus;
        const isSub = st !== defaultStatus && st !== "\u9996\u53D1" && st !== "Starting";
        const sCls = isSub ? "text-amber-400" : "text-green-400";
        const posLabel = lang === "zh" ? POS_ZH[pos] || pos : pos;
        const goalsHtml = goals ? `<div class="text-[11px] text-emerald-400 mt-1">\u26BD ${esc(goals)}</div>` : "";
        tip.innerHTML = `
            <div class="text-sm font-bold mb-0.5">${esc(name)}</div>
            <div class="text-[11px] text-gray-500 mb-2">${esc(team)} \xB7 ${esc(posLabel)}</div>
            <div class="mb-1.5">
                <div class="text-[10px] text-gray-500 mb-0.5">${tx("\u72B6\u6001", "Status")}</div>
                <div class="text-xs font-bold ${sCls}" style="line-height:1.4;word-break:break-word">${esc(st)}</div>
            </div>
            ${goalsHtml}
            <div class="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/5">
                <span class="text-[10px] text-gray-500">${tx("\u8BC4\u5206", "Rating")}</span>
                <span class="text-base font-bold font-mono ${cls}">${esc(rating)}</span>
            </div>
            <div class="text-[10px] text-gray-600 mt-1">${tx("\u70B9\u51FB\u67E5\u770B\u7403\u5458\u8BE6\u60C5", "Click for details")} \u2192</div>
        `;
        const rect = el.getBoundingClientRect();
        tip.style.left = Math.min(rect.right + 8, window.innerWidth - 200) + "px";
        tip.style.top = Math.max(rect.top - 20, 8) + "px";
        tip.classList.add("show");
      }
      function hideTip() {
        const tip = document.getElementById("player-tip");
        if (tip) tip.classList.remove("show");
      }
      function showTipFromDataset(el) {
        const name = el.dataset.name || "";
        const pos = el.dataset.pos || "";
        const rating = parseFloat(el.dataset.rating) || 0;
        const team = el.dataset.team || "";
        const status = el.dataset.status || "";
        const goals = el.dataset.goals || "";
        showTip(el, name, pos, rating, team, status, goals);
      }
      window.WorldCup.UIHelpers = { setPitchView, showTip, hideTip, showTipFromDataset };
      Object.assign(window, { setPitchView, showTip, hideTip, showTipFromDataset });
    })();
  }
});

// static/js/match-renderers.js
var require_match_renderers = __commonJS({
  "static/js/match-renderers.js"() {
    window.WorldCup = window.WorldCup || {};
    window.WorldCup.MatchRenderers = (() => {
      const { Formatters, ApiClient, State, Utils } = window.WorldCup;
      const getLang = () => State.uiLang || "zh";
      const tx = (zh, en) => Utils.tx(zh, en);
      const esc = (value) => Utils.esc(value);
      const attr = (value) => esc(value);
      const i18nText = (value, fallback = "") => {
        if (value && typeof value === "object" && (value.zh || value.en)) {
          return getLang() === "en" ? value.en || value.zh || fallback : value.zh || value.en || fallback;
        }
        return value || fallback;
      };
      const FORMATION_POSITIONS = {};
      function formationTemplate(formation, side, opponentFormation = "") {
        const isHome = side === "home";
        const parts = String(formation || "4-3-3").split("-").map(Number);
        let defCount = parts[0] || 4;
        let fwdCount = parts[parts.length - 1] || 3;
        let midLines = parts.slice(1, parts.length - 1);
        if (midLines.length === 0) {
          midLines = [3];
        }
        const out = [];
        const gkY = 6;
        out.push({
          x: 50,
          y: isHome ? gkY : 100 - gkY,
          pos: "GK",
          line: "gk"
        });
        const defYBase = 22;
        for (let i = 0; i < defCount; i++) {
          let x = 50;
          let dy = 0;
          if (defCount === 2) {
            x = i === 0 ? 35 : 65;
          } else if (defCount === 3) {
            x = i === 0 ? 28 : i === 1 ? 50 : 72;
            if (i === 1) dy = -2.5;
          } else if (defCount === 4) {
            x = i === 0 ? 14 : i === 1 ? 36 : i === 2 ? 64 : 86;
            if (i === 0 || i === 3) dy = 3.5;
          } else {
            const step = 76 / (defCount - 1);
            x = Math.round(12 + step * i);
            if (i === 0 || i === defCount - 1) dy = 5;
          }
          const y = isHome ? defYBase + dy : 100 - defYBase - dy;
          out.push({ x, y, pos: "D", line: "def" });
        }
        const fwdYBase = 70;
        const totalMidLines = midLines.length;
        for (let l = 0; l < totalMidLines; l++) {
          const count = midLines[l] || 3;
          const midYBase = defYBase + (fwdYBase - defYBase) * ((l + 1) / (totalMidLines + 1));
          for (let i = 0; i < count; i++) {
            let x = 50;
            let dy = 0;
            if (count === 1) {
              x = 50;
            } else if (count === 2) {
              x = i === 0 ? 34 : 66;
            } else if (count === 3) {
              x = i === 0 ? 26 : i === 1 ? 50 : 74;
              if (l === totalMidLines - 1) {
                if (i === 1) dy = 2.5;
              } else {
                if (i === 1) dy = -2.5;
              }
            } else if (count === 4) {
              x = i === 0 ? 16 : i === 1 ? 36 : i === 2 ? 64 : 84;
              if (i === 0 || i === 3) dy = 2;
            } else {
              const step = 72 / (count - 1);
              x = Math.round(14 + step * i);
              if (i === 0 || i === count - 1) dy = 3;
            }
            const y = isHome ? midYBase + dy : 100 - midYBase - dy;
            out.push({ x, y, pos: "M", line: "mid" });
          }
        }
        for (let i = 0; i < fwdCount; i++) {
          let x = 50;
          let dy = 0;
          if (fwdCount === 1) {
            x = 50;
          } else if (fwdCount === 2) {
            x = i === 0 ? 36 : 64;
          } else if (fwdCount === 3) {
            x = i === 0 ? 18 : i === 1 ? 50 : 82;
            if (i === 1) dy = 4;
          } else {
            const step = 68 / (fwdCount - 1);
            x = Math.round(16 + step * i);
            if (i > 0 && i < fwdCount - 1) dy = 4;
          }
          const y = isHome ? fwdYBase + dy : 100 - fwdYBase - dy;
          out.push({ x, y, pos: "F", line: "fwd" });
        }
        return out;
      }
      function parseFormationStr(f) {
        const parts = String(f || "4-3-3").split("-").map(Number);
        if (parts.length === 3) return { def: parts[0], mid: parts[1], fwd: parts[2] };
        if (parts.length === 4) return { def: parts[0], midDM: parts[1], midAM: parts[2], fwd: parts[3], mid: parts[1] + parts[2] };
        return { def: 4, mid: 3, fwd: 3 };
      }
      const teamLabel = (teamObj) => {
        if (!teamObj) return tx("\u672A\u77E5\u7403\u961F", "Unknown Team");
        const i18n = teamObj.nameI18n;
        if (i18n && (i18n.zh || i18n.en)) {
          return getLang() === "en" ? i18n.en || i18n.zh || "" : i18n.zh || i18n.en || "";
        }
        const raw = teamObj.team || teamObj.name || teamObj.shortName || teamObj.teamName || "";
        if (raw) {
          const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
          if (bilingual) return getLang() === "en" ? bilingual[2].trim() : bilingual[1].trim();
          return raw;
        }
        const alt = teamObj.fullName || teamObj.displayName || teamObj.label || teamObj.id || "";
        if (alt) return alt;
        return tx("\u672A\u77E5\u7403\u961F", "Unknown Team");
      };
      const teamFlagHtml = (teamObj, bgClass) => {
        const flag = teamObj && teamObj.flag;
        if (flag && flag !== "\u{1F3F3}\uFE0F" && flag !== "") {
          return `<span class="text-lg shrink-0">${esc(flag)}</span>`;
        }
        const name = teamLabel(teamObj);
        const initial = name ? name.charAt(0).toUpperCase() : "?";
        return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${bgClass} text-white text-xs font-bold shrink-0">${esc(initial)}</span>`;
      };
      const playerCoords = (p) => ({
        x: p.x ?? p.coords?.x ?? 50,
        y: p.y ?? p.coords?.y ?? 50
      });
      function getMockMatchupData() {
        return {
          home: {
            formation: "4-3-3",
            players: [
              { name: "Emiliano Mart\xEDnez", number: 23, pos: "GK", x: 50, y: 8, isKey: false },
              { name: "Nahuel Molina", number: 26, pos: "RB", x: 82, y: 22, isKey: false },
              { name: "Cristian Romero", number: 13, pos: "CB", x: 62, y: 20, isKey: true },
              { name: "Nicol\xE1s Otamendi", number: 19, pos: "CB", x: 38, y: 20, isKey: false },
              { name: "Nicol\xE1s Tagliafico", number: 3, pos: "LB", x: 18, y: 22, isKey: false },
              { name: "Rodrigo De Paul", number: 7, pos: "CM", x: 75, y: 38, isKey: true },
              { name: "Enzo Fern\xE1ndez", number: 24, pos: "CM", x: 50, y: 35, isKey: false },
              { name: "Alexis Mac Allister", number: 20, pos: "CM", x: 25, y: 38, isKey: false },
              { name: "Lionel Messi", number: 10, pos: "RW", x: 80, y: 48, isKey: true },
              { name: "Juli\xE1n \xC1lvarez", number: 9, pos: "ST", x: 50, y: 46, isKey: false },
              { name: "\xC1ngel Di Mar\xEDa", number: 11, pos: "LW", x: 20, y: 48, isKey: true }
            ]
          },
          away: {
            formation: "4-2-3-1",
            players: [
              { name: "Hugo Lloris", number: 1, pos: "GK", x: 50, y: 8, isKey: false },
              { name: "Jules Kound\xE9", number: 5, pos: "RB", x: 82, y: 22, isKey: false },
              { name: "Rapha\xEBl Varane", number: 4, pos: "CB", x: 62, y: 20, isKey: true },
              { name: "William Saliba", number: 17, pos: "CB", x: 38, y: 20, isKey: false },
              { name: "Theo Hern\xE1ndez", number: 22, pos: "LB", x: 18, y: 22, isKey: false },
              { name: "Aur\xE9lien Tchouam\xE9ni", number: 8, pos: "CDM", x: 62, y: 35, isKey: true },
              { name: "Adrien Rabiot", number: 14, pos: "CDM", x: 38, y: 35, isKey: false },
              { name: "Ousmane Demb\xE9l\xE9", number: 11, pos: "RW", x: 80, y: 48, isKey: false },
              { name: "Antoine Griezmann", number: 7, pos: "CAM", x: 50, y: 46, isKey: true },
              { name: "Kylian Mbapp\xE9", number: 10, pos: "LW", x: 20, y: 48, isKey: true },
              { name: "Olivier Giroud", number: 9, pos: "ST", x: 50, y: 55, isKey: false }
            ]
          },
          matchups: [
            { homePlayer: "Lionel Messi", awayPlayer: "Theo Hern\xE1ndez", type: "critical" },
            { homePlayer: "\xC1ngel Di Mar\xEDa", awayPlayer: "Jules Kound\xE9", type: "key" },
            { homePlayer: "Rodrigo De Paul", awayPlayer: "Aur\xE9lien Tchouam\xE9ni", type: "key" }
          ]
        };
      }
      function getMockPrediction() {
        return {
          homeWin: 0.452,
          draw: 0.268,
          awayWin: 0.28,
          expectedScore: { home: 1.8, away: 1.1 },
          poissonModeScore: { home: 2, away: 1 },
          components: { elo: { home: 1850, away: 1720 } }
        };
      }
      function renderTacticalBoard(matchupData, matchData2) {
        if (matchupData) {
          ["home", "away"].forEach((side) => {
            const s = matchupData[side];
            if (s && (!s.players || !s.players.length)) {
              s.players = [...s.gk || [], ...s.def || [], ...s.mid || [], ...s.fwd || []];
            }
          });
        }
        const hasData = matchupData && matchupData.home?.players?.length >= 1 && matchupData.away?.players?.length >= 1;
        let svg = `<svg viewBox="0 0 100 160" class="w-full rounded-xl border-2 border-white/10" style="display:block;max-width:420px;margin:0 auto">`;
        svg += `<defs>
            <linearGradient id="tb-pitch" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#1e5631"/>
                <stop offset="49%" stop-color="#1a472a"/>
                <stop offset="50%" stop-color="#1a472a"/>
                <stop offset="100%" stop-color="#1e5631"/>
            </linearGradient>
            <linearGradient id="tb-m-critical-home" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.9"/>
                <stop offset="100%" stop-color="#9ca3af" stop-opacity="0.3"/>
            </linearGradient>
            <linearGradient id="tb-m-critical-away" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#9ca3af" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.9"/>
            </linearGradient>
            <linearGradient id="tb-m-even" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#9ca3af" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="#9ca3af" stop-opacity="0.4"/>
            </linearGradient>
            <linearGradient id="tb-m-key" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="#f87171" stop-opacity="0.2"/>
            </linearGradient>
            <clipPath id="tb-avatar-clip"><circle r="2.8" cx="0" cy="0"/></clipPath>
            <filter id="tb-ability-blur" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="1.2"/>
            </filter>
            <radialGradient id="halo-glow-home" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="1.0"/>
                <stop offset="35%" stop-color="#3b82f6" stop-opacity="0.85"/>
                <stop offset="70%" stop-color="#3b82f6" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="halo-glow-away" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="1.0"/>
                <stop offset="35%" stop-color="#ef4444" stop-opacity="0.85"/>
                <stop offset="70%" stop-color="#ef4444" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <style>
            .pitch-player-group {
                cursor: pointer;
            }
            .ability-halo {
                transition: opacity 0.2s ease;
            }
            .pitch-player-group:hover .ability-halo {
                opacity: 1.0 !important;
            }
            .pitch-player-group:hover .player-core {
                stroke-width: 0.7px !important;
                filter: drop-shadow(0 0.8px 1.5px rgba(0,0,0,0.5)) !important;
            }
        </style>`;
        svg += `<rect width="100" height="160" fill="url(#tb-pitch)"/>`;
        for (let i = 0; i < 20; i += 2) svg += `<rect x="0" y="${i * 8}" width="100" height="8" fill="rgba(255,255,255,0.03)"/>`;
        svg += `<line x1="0" y1="80" x2="100" y2="80" stroke="rgba(255,255,255,0.15)" stroke-width="0.3"/>`;
        svg += `<circle cx="50" cy="80" r="12" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
        svg += `<circle cx="50" cy="80" r="0.8" fill="rgba(255,255,255,0.2)"/>`;
        svg += `<rect x="20" y="0" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
        svg += `<rect x="35" y="0" width="30" height="8" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
        svg += `<rect x="20" y="140" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
        svg += `<rect x="35" y="152" width="30" height="8" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
        svg += `<path d="M 38 80 A 12 12 0 0 0 62 80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.3"/>`;
        svg += `<path d="M 38 80 A 12 12 0 0 1 62 80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.3"/>`;
        svg += `<path d="M 38 20 A 12 12 0 0 0 62 20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
        svg += `<path d="M 38 140 A 12 12 0 0 1 62 140" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
        svg += `<path d="M 2 0 A 2 2 0 0 1 0 2" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
        svg += `<path d="M 98 0 A 2 2 0 0 0 100 2" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
        svg += `<path d="M 100 158 A 2 2 0 0 0 98 160" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
        svg += `<path d="M 0 158 A 2 2 0 0 1 2 160" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.3"/>`;
        const renderSourceBadge = (source, announceTime, x, y) => {
          if (!source) return "";
          const isOfficial = source === "official";
          const bg = isOfficial ? "rgba(16,185,129,0.85)" : "rgba(245,158,11,0.85)";
          const textZh = isOfficial ? `FIFA \u5B98\u65B9\u9996\u53D1${announceTime ? " \xB7 " + announceTime + " \u516C\u5E03" : ""}` : "\u9884\u6D4B\u9635\u5BB9\uFF08\u672C\u5C4A\u4F17\u6570/\u6700\u8FD1\u4E00\u573A\uFF09";
          const textEn = isOfficial ? `Official XI${announceTime ? " \xB7 " + announceTime : ""}` : "Projected XI (mode/recent)";
          const text = getLang() === "en" ? textEn : textZh;
          const w = isOfficial ? 44 : 52;
          return `<g transform="translate(${x - w / 2},${y})">
                <rect x="0" y="0" width="${w}" height="4.5" rx="2" fill="${bg}" opacity="0.95"/>
                <text x="${w / 2}" y="3.1" text-anchor="middle" font-size="2.2" font-weight="600" fill="white" dominant-baseline="middle">${esc(text)}</text>
            </g>`;
        };
        const globalSource = matchupData.source || matchupData.lineupSource || null;
        const globalTime = matchupData.announceTime || matchupData.publishedAt || null;
        if (globalSource) {
          svg += renderSourceBadge(globalSource, globalTime, 50, 1.5);
        }
        if (!hasData) {
          svg += `<text x="50" y="75" text-anchor="middle" font-size="3" fill="rgba(255,255,255,0.25)">${esc(tx("\u6682\u65E0\u9996\u53D1\u6570\u636E", "No lineup data"))}</text>`;
          svg += `<text x="50" y="85" text-anchor="middle" font-size="2.5" fill="rgba(255,255,255,0.15)">${esc(tx("\u7B49\u5F85\u5B98\u65B9\u516C\u5E03", "Awaiting official announcement"))}</text>`;
          svg += `</svg>`;
          return svg;
        }
        const home = matchupData.home;
        const away = matchupData.away;
        const flattenPlayers = (side) => {
          if (!side) return;
          if (!side.players || !side.players.length) {
            side.players = [
              ...side.gk || [],
              ...side.def || [],
              ...side.mid || [],
              ...side.fwd || []
            ];
          }
        };
        flattenPlayers(home);
        flattenPlayers(away);
        const matchups = matchupData.matchups || [];
        const substitutions = matchupData.substitutions || [];
        const normalizeName = (s) => String(s || "").toLowerCase().replace(/['\u0301\u0300\u0308]/g, "").trim();
        const findPlayer = (players, name) => {
          if (!players || !name) return null;
          const n = normalizeName(name);
          return players.find((p) => {
            const pn = normalizeName(p.name);
            return pn === n || pn.includes(n) || n.includes(pn);
          });
        };
        const subOffMap = /* @__PURE__ */ new Map();
        const subOnMap = /* @__PURE__ */ new Map();
        const ensureSideMap = (m, side) => {
          if (!m.has(side)) m.set(side, /* @__PURE__ */ new Map());
          return m.get(side);
        };
        for (const s of substitutions) {
          if (!s) continue;
          const side = s.side || "home";
          const offName = s.offName || s.playerOut;
          const offId = s.off;
          const onName = s.onName || s.playerIn;
          const onId = s.on;
          const minute = s.minute ?? s.minutePlayed ?? "?";
          const subData = {
            minute,
            onId,
            onName,
            onNameZh: s.onNameZh || null,
            onRating: s.onRating || 70,
            onJersey: s.onJersey || "?",
            offId,
            offName,
            offNameZh: s.offNameZh || null,
            offRating: s.offRating || 70,
            raw: s
          };
          const offMap = ensureSideMap(subOffMap, side);
          if (offId) offMap.set(String(offId).toLowerCase(), subData);
          if (offName) offMap.set(normalizeName(offName), subData);
          const onMap = ensureSideMap(subOnMap, side);
          if (onId) onMap.set(String(onId).toLowerCase(), subData);
          if (onName) onMap.set(normalizeName(onName), subData);
        }
        const homeTemplate = formationTemplate(home.formation || "4-3-3", "home", away.formation || "4-3-3");
        const awayTemplate = formationTemplate(away.formation || "4-3-3", "away", home.formation || "4-3-3");
        const MIN_DIST = 9;
        for (let iter = 0; iter < 10; iter++) {
          let adjusted = false;
          for (let i = 0; i < homeTemplate.length; i++) {
            const h = homeTemplate[i];
            for (let j = 0; j < awayTemplate.length; j++) {
              const a = awayTemplate[j];
              const dx = h.x - a.x;
              const dy = h.y * 1.6 - a.y * 1.6;
              const dist = Math.hypot(dx, dy);
              if (dist < MIN_DIST) {
                adjusted = true;
                const overlap = MIN_DIST - dist;
                const angle = dist > 0.1 ? Math.atan2(dy, dx) : Math.random() * 2 * Math.PI;
                const pushAmount = overlap / 2;
                const hPushX = Math.cos(angle) * pushAmount;
                const hPushY = Math.sin(angle) * pushAmount / 1.6;
                h.x += hPushX;
                h.y += hPushY;
                a.x -= hPushX;
                a.y -= hPushY;
                h.x = Math.max(10, Math.min(90, h.x));
                a.x = Math.max(10, Math.min(90, a.x));
              }
            }
          }
          if (!adjusted) break;
        }
        const coord = (p, idx, side) => {
          const tmpl = side === "home" ? homeTemplate : awayTemplate;
          const t = tmpl[idx] || tmpl[tmpl.length - 1] || { x: 50, y: 50 };
          return { cx: t.x, cy: t.y * 1.6 };
        };
        const TEAM_STYLE = {
          home: { halo: "rgba(59,130,246,0.6)", solid: "#2563eb", stroke: "#93c5fd", text: "white" },
          away: { halo: "rgba(239,68,68,0.6)", solid: "#dc2626", stroke: "#fca5a5", text: "white" }
        };
        const R = 2.6;
        const goals = matchData2?.goals || [];
        const translatePlayerName2 = (name, nameZh) => Utils.translatePlayerName ? Utils.translatePlayerName(name, nameZh) : nameZh || name;
        const playerMatchesName = (pName, eventName) => {
          if (!pName || !eventName) return false;
          const pn = normalizeName(pName);
          const en = normalizeName(eventName);
          return pn === en || pn.includes(en) || en.includes(pn);
        };
        const getPlayerGoals = (pName, side) => {
          const teamName = side === "home" ? home?.team || "" : away?.team || "";
          return goals.filter((g) => {
            const teamMatches = String(g.team || "").toLowerCase().includes(String(teamName).toLowerCase()) || String(teamName).toLowerCase().includes(String(g.team || "").toLowerCase());
            return teamMatches && playerMatchesName(pName, g.player);
          });
        };
        const renderEventBadge = (x, y, icon, text, isSubOn) => {
          const displayStr = `${icon}${text}`;
          const w = displayStr.length * 1.3 + 1.8;
          const bg = isSubOn ? "rgba(16,185,129,0.85)" : "rgba(0,0,0,0.65)";
          return `<g transform="translate(${x},${y})">
                <rect x="-${w / 2}" y="-2.3" width="${w}" height="3.2" rx="0.8" fill="${bg}" stroke="rgba(255,255,255,0.15)" stroke-width="0.2"/>
                <text x="0" y="-0.7" text-anchor="middle" dominant-baseline="middle" font-size="1.8" fill="white" font-weight="800">${esc(displayStr)}</text>
            </g>`;
        };
        const renderPlayerNode = (p, side, idx) => {
          if (!p) return "";
          const { cx, cy } = coord(p, idx, side);
          const st = TEAM_STYLE[side] || TEAM_STYLE.home;
          const playerId = p.playerId || p.id || p.espnId || "";
          const rawName = p.name || "";
          const pIdLower = String(playerId).toLowerCase();
          const pNameNorm = normalizeName(rawName);
          const sideSubOff = subOffMap.get(side);
          const subOff = sideSubOff ? sideSubOff.get(pIdLower) || sideSubOff.get(pNameNorm) : null;
          let activePlayerId = playerId;
          let activeName = rawName;
          let activeJersey = p.jersey || p.number || "?";
          let activeRating = Number(p.rating) || 65;
          let activeNameZh = p.nameZh || null;
          let isSubOn = false;
          let subOffDetails = null;
          if (subOff) {
            activePlayerId = subOff.onId || "";
            activeName = subOff.onName;
            activeJersey = subOff.onJersey || "?";
            activeRating = Number(subOff.onRating) || 65;
            activeNameZh = subOff.onNameZh || null;
            isSubOn = true;
            subOffDetails = {
              minute: subOff.minute,
              starterName: translatePlayerName2(rawName, p.nameZh)
            };
          }
          const pGoals = getPlayerGoals(activeName, side);
          const hasGoals = pGoals.length > 0;
          const goalMinutesJoin = pGoals.map((g) => String(g.minute).replace(/'/g, "") + "'").join(",");
          const rating = Math.max(50, Math.min(100, activeRating));
          const ratingDiff = Math.max(0, rating - 50);
          const radius = 2.8 + Math.pow(ratingDiff, 1.25) * 0.1;
          const pNameZh = translatePlayerName2(activeName, activeNameZh);
          const pTeamName = side === "home" ? home?.team || "" : away?.team || "";
          let statusText = "";
          if (isSubOn) {
            statusText = esc(tx(`\u66FF\u8865\u4E0A\u573A ${subOffDetails.minute} \u2190 ${subOffDetails.starterName}`, `Sub On ${subOffDetails.minute} \u2190 ${subOffDetails.starterName}`));
          } else {
            statusText = esc(tx("\u9996\u53D1", "Starting"));
          }
          let htmlNode = "";
          const goalsText = hasGoals ? goalMinutesJoin : "";
          htmlNode += `<g class="pitch-player-group pitch-${side}-player" data-action="open-player-detail" data-player-id="${attr(String(activePlayerId))}" data-player-name="${attr(activeName)}" style="cursor:pointer" data-player-tip="true" data-name="${attr(pNameZh)}" data-pos="${attr(p.pos || "")}" data-rating="${(rating / 10).toFixed(1)}" data-team="${attr(pTeamName)}" data-status="${statusText}" data-goals="${attr(goalsText)}">`;
          htmlNode += `<circle class="ability-halo" cx="${cx}" cy="${cy}" r="${radius}" fill="url(#halo-glow-${side})" opacity="0.8" filter="url(#tb-ability-blur)"/>`;
          const strokeDash = isSubOn ? 'stroke-dasharray="0.8 0.4"' : "";
          htmlNode += `<circle class="player-core" cx="${cx}" cy="${cy}" r="${R}" fill="${st.solid}" stroke="${st.stroke}" stroke-width="0.45" ${strokeDash}/>`;
          htmlNode += `<text x="${cx}" y="${cy + 0.15}" text-anchor="middle" dominant-baseline="middle" fill="${st.text}" font-size="2.45" font-weight="800">${esc(String(activeJersey))}</text>`;
          htmlNode += `</g>`;
          if (isSubOn) {
            htmlNode += renderEventBadge(cx - 3.8, cy - 2.8, "\u2191", subOffDetails.minute, true);
          }
          if (hasGoals) {
            htmlNode += renderEventBadge(cx + 3.8, cy - 2.8, "\u26BD", goalMinutesJoin, false);
          }
          return htmlNode;
        };
        svg += `<g class="pitch-home">`;
        home.players.forEach((p, i) => {
          svg += renderPlayerNode(p, "home", i);
        });
        svg += `</g>`;
        svg += `<g class="pitch-away">`;
        away.players.forEach((p, i) => {
          svg += renderPlayerNode(p, "away", i);
        });
        svg += `</g>`;
        if (!globalSource) {
          const homeSrc = home.source || home.lineupSource || null;
          const awaySrc = away.source || away.lineupSource || null;
          if (homeSrc) svg += renderSourceBadge(homeSrc, home.announceTime || home.publishedAt, 28, 1.5);
          if (awaySrc) svg += renderSourceBadge(awaySrc, away.announceTime || away.publishedAt, 72, 1.5);
        }
        svg += `</svg>`;
        return svg;
      }
      function renderPredictionLayers(pred) {
        if (!pred || pred.homeWin === void 0 && pred.draw === void 0 && pred.awayWin === void 0) {
          return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u9884\u6D4B\u6570\u636E\u52A0\u8F7D\u5931\u8D25", "Prediction data unavailable")}</div>`;
        }
        const hw = ((pred.homeWin ?? 0) * 100).toFixed(1);
        const dw = ((pred.draw ?? 0) * 100).toFixed(1);
        const aw = ((pred.awayWin ?? 0) * 100).toFixed(1);
        const hwNum = parseFloat(hw);
        const dwNum = parseFloat(dw);
        const awNum = parseFloat(aw);
        const parseScore = (v) => {
          if (v && typeof v === "object") return { home: v.home, away: v.away };
          if (typeof v === "string") {
            const m = v.split("-");
            if (m.length === 2) return { home: m[0].trim(), away: m[1].trim() };
          }
          return { home: null, away: null };
        };
        const expStr = parseScore(pred.expectedScore);
        const lamHome = pred.goals?.homeExpected ?? expStr.home;
        const lamAway = pred.goals?.awayExpected ?? expStr.away;
        const escHome = lamHome != null && lamHome !== "" ? Number(lamHome).toFixed(1) : "-";
        const escAway = lamAway != null && lamAway !== "" ? Number(lamAway).toFixed(1) : "-";
        const pm = parseScore(pred.poissonModeScore);
        const pmHome = pm.home ?? "-";
        const pmAway = pm.away ?? "-";
        return `
        <div class="glass rounded-xl p-4 space-y-3">
            <!-- Layer 1: Win/Draw/Loss Probability Bar -->
            <div>
                <div class="text-xs font-bold text-gray-400 mb-2">
                    <span class="inline-flex items-center gap-1">
                        <span class="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center text-[10px]">\u{1F3AF}</span>
                        ${tx("\u80DC\u5E73\u8D1F\u6982\u7387", "Win/Draw/Loss")}
                    </span>
                </div>
                <div class="prob-bar mb-2">
                    <div class="prob-bar-home" style="width:${hw}%">${hwNum > 12 ? hw + "%" : ""}</div>
                    <div class="prob-bar-draw" style="width:${dw}%">${dwNum > 10 ? dw + "%" : ""}</div>
                    <div class="prob-bar-away" style="width:${aw}%">${awNum > 12 ? aw + "%" : ""}</div>
                </div>
                <div class="flex justify-between text-[11px]">
                    <span class="text-green-400 font-bold">${tx("\u4E3B\u80DC", "Home")} ${hw}%</span>
                    <span class="text-yellow-400 font-bold">${tx("\u5E73\u5C40", "Draw")} ${dw}%</span>
                    <span class="text-red-400 font-bold">${tx("\u5BA2\u80DC", "Away")} ${aw}%</span>
                </div>
            </div>

            <div class="border-t border-white/5"></div>

            <!-- Layer 2: Expected Score (\u03BB-based) -->
            <div class="text-center">
                <div class="text-xs font-bold text-emerald-400 mb-1">
                    <span class="inline-flex items-center gap-1">
                        <span class="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-[10px]">\u{1F4CA}</span>
                        ${tx("\u671F\u671B\u6BD4\u5206", "Expected Score")}
                    </span>
                </div>
                <div class="text-xl font-black font-mono tracking-tight">
                    <span class="text-blue-400">${esc(escHome)}</span>
                    <span class="text-gray-500 mx-1.5">\u2014</span>
                    <span class="text-red-400">${esc(escAway)}</span>
                </div>
                <div class="text-[10px] text-gray-500 mt-1">
                    ${getLang() === "en" ? "Based on expected goals \u03BB" : "\u57FA\u4E8E\u8FDB\u7403\u671F\u671B\u503C \u03BB"}
                </div>
            </div>

            <div class="border-t border-white/5"></div>

            <!-- Layer 3: Poisson Mode Score -->
            <div class="text-center">
                <div class="text-xs font-bold text-amber-400 mb-1">
                    <span class="inline-flex items-center gap-1">
                        <span class="w-5 h-5 rounded-md bg-amber-400/10 flex items-center justify-center text-[10px]">\u{1F52E}</span>
                        ${tx("\u6700\u53EF\u80FD\u6BD4\u5206", "Most Likely Score")}
                    </span>
                </div>
                <div class="text-xl font-black font-mono tracking-tight">
                    <span class="text-blue-400">${esc(String(pmHome))}</span>
                    <span class="text-gray-500 mx-1.5">\u2014</span>
                    <span class="text-red-400">${esc(String(pmAway))}</span>
                </div>
                <div class="text-[10px] text-gray-500 mt-1">
                    ${getLang() === "en" ? "Poisson mode: the single most probable exact scoreline" : "\u6CCA\u677E\u4F17\u6570\uFF1A\u6240\u6709\u53EF\u80FD\u6BD4\u5206\u4E2D\u6982\u7387\u6700\u9AD8\u7684\u4E00\u7EC4"}
                </div>
            </div>
            ${(() => {
          const vf = pred.venueFactor;
          if (!vf || !vf.applied) return "";
          const fmtBeta = (b) => b != null ? Number(b).toFixed(2) : "-";
          const row = (side, label) => {
            const f = vf[side] || {};
            const dh = f.deltaH != null ? Math.round(f.deltaH) : null;
            const t = f.tempC != null ? Math.round(f.tempC) : null;
            const bits = [];
            if (dh != null && dh > 0) bits.push(tx("\u6D77\u62D4\u5DEE", "Alt \u0394") + " " + dh + "m");
            if (t != null) bits.push(tx("\u6C14\u6E29", "Temp") + " " + t + "\xB0C");
            return `<div class="flex items-center justify-between text-[11px]">
                        <span class="text-gray-400">${label}</span>
                        <span class="font-mono font-bold ${side === "home" ? "text-blue-400" : "text-red-400"}">\u03B2 ${fmtBeta(f.beta)}</span>
                        <span class="text-gray-500 text-[10px]">${bits.join(" \xB7 ") || tx("\u65E0\u4FEE\u6B63", "no effect")}</span>
                    </div>`;
          };
          return `
                <div class="border-t border-white/5"></div>
                <div>
                    <div class="text-xs font-bold text-cyan-400 mb-1.5">
                        <span class="inline-flex items-center gap-1">
                            <span class="w-5 h-5 rounded-md bg-cyan-500/15 flex items-center justify-center text-[10px]">\u{1F3D4}\uFE0F</span>
                            ${tx("\u73AF\u5883\u4FEE\u6B63", "Venue Adjustment")}
                        </span>
                    </div>
                    <div class="space-y-1">
                        ${row("home", tx("\u4E3B\u961F", "Home"))}
                        ${row("away", tx("\u5BA2\u961F", "Away"))}
                    </div>
                    <div class="text-[10px] text-gray-500 mt-1.5">
                        ${getLang() === "en" ? "High altitude / heat scale down expected goals \u03BB (\u03B2<1)" : "\u9AD8\u6D77\u62D4 / \u9AD8\u6E29\u4F1A\u6309 \u03B2 \u7CFB\u6570\u4E0B\u8C03\u8FDB\u7403\u671F\u671B \u03BB\uFF08\u03B2<1\uFF09"}
                    </div>
                </div>`;
        })()}
        </div>`;
      }
      function renderFormation(matchupData, isFinishedMatch = false) {
        if ((!matchupData || !matchupData.home || !matchupData.away) && !isFinishedMatch) {
          matchupData = getMockMatchupData();
        }
        if (!matchupData || !matchupData.home || !matchupData.away) {
          return `<div class="text-gray-500 text-xs text-center py-8">${isFinishedMatch ? tx("\u5B98\u65B9\u5386\u53F2\u9996\u53D1\u5C1A\u672A\u540C\u6B65\uFF1B\u4E0D\u4EE5\u63A8\u6D4B\u9635\u5BB9\u66FF\u4EE3\u5B9E\u9645\u9996\u53D1\u3002", "Official historical lineups are not synced; estimates are not shown as actual starters.") : tx("\u6682\u65E0\u5B98\u65B9\u9996\u53D1\uFF0C\u4EE5\u4E0B\u4E3A\u6839\u636E\u5386\u53F2\u9996\u53D1\u751F\u6210\u7684\u63A8\u6D4B\u9635\u5BB9", "No official lineups; showing projected lineups based on history")}</div>`;
        }
        const home = matchupData.home;
        const away = matchupData.away;
        const pairs = matchupData.pairs || [];
        const matchups = matchupData.matchups || [];
        const summary = matchupData.summary || {};
        const homeAdv = summary.homeAdvantages ?? summary.homeAdvantagePairs ?? 0;
        const awayAdv = summary.awayAdvantages ?? summary.awayAdvantagePairs ?? 0;
        const totalPairs = homeAdv + (summary.evenPairs || 0) + awayAdv;
        const homePct = totalPairs ? homeAdv / totalPairs * 100 : 0;
        const evenPct = totalPairs ? (summary.evenPairs || 0) / totalPairs * 100 : totalPairs === 0 ? 100 : 0;
        const awayPct = totalPairs ? awayAdv / totalPairs * 100 : 0;
        let html = `
        <div class="flex items-center justify-between mb-2">
            <div class="text-xs font-bold text-blue-300 flex items-center gap-1.5">\u{1F535} ${teamFlagHtml(home, "bg-blue-600")} ${teamLabel(home)} (${home.formation || "4-3-3"})</div>
            <div class="flex gap-1">
                <button data-action="set-pitch-view" data-view="both" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">${tx("\u5168\u90E8", "All")}</button>
                <button data-action="set-pitch-view" data-view="home" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx("\u4E3B\u961F", "Home")}</button>
                <button data-action="set-pitch-view" data-view="away" class="pitch-view-btn text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-500">${tx("\u5BA2\u961F", "Away")}</button>
            </div>
            <div class="text-xs font-bold text-red-300 flex items-center gap-1.5 justify-end">${teamLabel(away)} (${away.formation || "4-3-3"}) ${teamFlagHtml(away, "bg-red-600")} \u{1F534}</div>
        </div>

        <!-- Segmented Score Bar -->
        <div class="glass-light rounded-lg p-3 mb-2">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-blue-400">${teamLabel(home)}</span>
                <span class="text-xs text-gray-500">${tx("\u5BF9\u4F4D\u4F18\u52BF\u5206\u5E03", "Matchup Edge")}</span>
                <span class="text-xs font-bold text-red-400">${teamLabel(away)}</span>
            </div>
            <div class="flex h-4 rounded-full overflow-hidden mb-2 shadow-inner bg-white/5">
                <div class="flex items-center justify-center bg-blue-500/80 transition-all duration-700" style="width:${homePct}%">
                    ${homeAdv ? `<span class="text-[10px] font-bold text-white">${homeAdv}</span>` : ""}
                </div>
                <div class="flex items-center justify-center bg-gray-500/50 transition-all duration-700" style="width:${evenPct}%">
                    ${summary.evenPairs ? `<span class="text-[10px] font-bold text-gray-300">${summary.evenPairs}</span>` : ""}
                </div>
                <div class="flex items-center justify-center bg-red-500/80 transition-all duration-700" style="width:${awayPct}%">
                    ${awayAdv ? `<span class="text-[10px] font-bold text-white">${awayAdv}</span>` : ""}
                </div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-gray-400 px-1">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500/80"></span>${tx("\u4E3B\u961F\u5360\u4F18", "Home Edge")}</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-gray-500/50"></span>${tx("\u5747\u52BF", "Even")}</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500/80"></span>${tx("\u5BA2\u961F\u5360\u4F18", "Away Edge")}</span>
            </div>
        </div>

        <!-- SVG Tactical Board -->
        <div class="w-full" id="pitch-canvas">
            ${renderTacticalBoard(matchupData, matchData)}
        </div>`;
        const shortName = (name, nameZh) => {
          const d = Utils.translatePlayerName ? Utils.translatePlayerName(name, nameZh) : nameZh || name;
          return d.includes("\xB7") ? d.split("\xB7").pop() : d.split(" ").pop();
        };
        if (matchups.length > 0) {
          html += '<div class="mt-2 space-y-0.5">';
          html += `<div class="text-[10px] text-gray-500 mb-1">\u2694\uFE0F ${tx("\u5173\u952E\u5BF9\u4F4D", "Key Matchups")}</div>`;
          for (const m of matchups.slice(0, 4)) {
            const cls = m.type === "critical" ? "text-yellow-400" : "text-gray-400";
            const hName = m.homeInfo?.nameZh || m.homePlayer;
            const aName = m.awayInfo?.nameZh || m.awayPlayer;
            html += `<div class="text-[11px] ${cls} flex items-center gap-1">
                    <span>${m.type === "critical" ? "\u2B50" : "\u2022"}</span>
                    ${esc(hName)} \u2194 ${esc(aName)}
                    ${m.type === "critical" ? `<span class="text-[10px] font-bold text-amber-400">${tx("\u5173\u952E", "Critical")}</span>` : ""}
                </div>`;
          }
          html += "</div>";
        } else if (pairs.length > 0) {
          const _pDiff = (p) => p.diff ?? p.gap ?? 0;
          const keyPairs = pairs.filter((p) => Math.abs(_pDiff(p)) >= 8).slice(0, 4);
          if (keyPairs.length) {
            html += '<div class="mt-2 space-y-0.5">';
            for (const p of keyPairs) {
              const diff = _pDiff(p);
              const cls = p.advantage === "home" ? "text-green-400" : p.advantage === "away" ? "text-red-400" : "text-gray-400";
              const hShort = shortName(p.home.name, p.home.nameZh);
              const aShort = shortName(p.away.name, p.away.nameZh);
              html += `<div class="text-[11px] ${cls} flex items-center gap-1">
                        ${p.advantage === "home" ? "\u{1F7E2}" : "\u{1F534}"}
                        ${esc(hShort)} (${(p.home.rating / 10).toFixed(1)}) vs ${esc(aShort)} (${(p.away.rating / 10).toFixed(1)})
                        <span class="font-bold">${diff > 0 ? "+" : ""}${(diff / 10).toFixed(1)}</span>
                    </div>`;
            }
            html += "</div>";
          }
        }
        return html;
      }
      const translatePlayerName = (name, nameZh) => Utils.translatePlayerName ? Utils.translatePlayerName(name, nameZh) : nameZh || name;
      function renderBenchAnalysis(data, isFinishedMatch) {
        if (!data) return `<div class="text-gray-500 text-xs py-4 text-center">${tx("\u6570\u636E\u6682\u65E0", "No data")}</div>`;
        const home = data.homeTeam;
        const away = data.awayTeam;
        const comparison = data.comparison;
        const getStrengthColor = (score) => {
          if (score >= 80) return "text-green-400";
          if (score >= 60) return "text-yellow-400";
          return "text-red-400";
        };
        const getImpactIcon = (type) => {
          switch (type) {
            case "creative":
              return "\u{1F3A8}";
            case "defensive":
              return "\u{1F6E1}\uFE0F";
            case "physical":
              return "\u{1F4AA}";
            default:
              return "\u2696\uFE0F";
          }
        };
        const getProbColor = (prob) => {
          if (prob >= 0.7) return "text-green-400";
          if (prob >= 0.5) return "text-yellow-400";
          return "text-red-400";
        };
        const renderSubstitutionImpact = (item) => {
          const impact = item.teamImpact;
          const playerLabel = item.playerIn ? `${esc(item.playerIn)}${item.playerOut ? ` ${tx("\u6362\u4E0B", "for")} ${esc(item.playerOut)}` : ""}` : tx("\u6362\u4EBA", "Substitution");
          let signal = `<span class="text-gray-500">${tx("\u6570\u636E\u4E0D\u8DB3", "Insufficient data")}</span>`;
          if (item.impact?.status === "pending") {
            signal = `<span class="text-gray-500">${tx("\u8BC4\u4F30\u4E2D", "Evaluating")}</span>`;
          } else if (impact?.status === "ready") {
            const direction = impact.direction;
            const icon = direction === "positive" ? "\u2191" : direction === "negative" ? "\u2193" : "\u2192";
            const label = direction === "positive" ? tx("\u538B\u529B\u63D0\u5347", "Pressure up") : direction === "negative" ? tx("\u538B\u529B\u4E0B\u964D", "Pressure down") : tx("\u538B\u529B\u6301\u5E73", "Pressure steady");
            const color = direction === "positive" ? "text-green-400" : direction === "negative" ? "text-red-400" : "text-gray-300";
            const delta = Number(impact.slopeDelta);
            signal = `<span class="${color} font-bold">${icon} ${label} ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}/min</span>`;
          }
          return `<div class="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <div class="min-w-0">
                    <div class="text-xs text-gray-200 truncate">${playerLabel}</div>
                    <div class="text-[10px] text-gray-500">${esc(item.minute)}\u2032 \xB7 ${item.side === "home" ? esc(teamLabel(home)) : item.side === "away" ? esc(teamLabel(away)) : tx("\u7403\u961F\u5F85\u786E\u8BA4", "Team unknown")}</div>
                </div>
                <div class="text-[11px] text-right shrink-0">${signal}</div>
            </div>`;
        };
        const renderBenchPlayer = (player, teamColor, teamNameStr) => {
          const playerNameZh = translatePlayerName(player.name, player.nameZh);
          let playedStr = "";
          if (data.realSubstitutions && data.realSubstitutions.length > 0) {
            const subEvent = data.realSubstitutions.find((s) => {
              const matchName = s.playerIn.toLowerCase();
              const pName = (player.name || "").toLowerCase();
              return matchName === pName || pName.includes(matchName) || matchName.includes(pName);
            });
            if (subEvent) {
              playedStr = `<span class="font-bold ml-1 text-green-400">\u{1F53D} ${subEvent.minute} ${tx("\u51FA\u573A", "In")}</span>`;
            } else if (isFinishedMatch) {
              playedStr = `<span class="font-bold ml-1 text-gray-600">${tx("\u672A\u51FA\u573A", "Unused")}</span>`;
            }
          }
          return `
            <div class="glass-light rounded-lg p-2 mb-2 cursor-pointer hover:bg-white/10 transition-colors"
                 data-action="open-player-detail"
                 data-player-id="${attr(player.id || "")}"
                 data-player-name="${attr(player.name || "")}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold ${teamColor}">${player.jersey || "?"}</span>
                        <span class="text-xs font-bold">${esc(playerNameZh)}</span>
                        <span class="text-[11px] text-gray-500">${esc(player.pos) || "?"}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[11px] text-gray-500">${getImpactIcon(player.impactType)}</span>
                        <span class="text-xs font-bold ${getStrengthColor(player.rating)}">${esc(player.rating) || "-"}</span>
                    </div>
                </div>

                <div class="flex items-center gap-2 text-[11px] mb-1">
                    <span class="text-gray-500">${tx("\u7279\u8272:", "Traits:")}</span>
                    ${player.traits?.map((t) => `<span class="bg-white/5 px-1.5 py-0.5 rounded">${esc(t)}</span>`).join("") || '<span class="text-gray-600">-</span>'}
                </div>

                <div class="flex items-center justify-between text-[11px]">
                    <div>
                        <span class="text-gray-500">${tx("\u66FF\u4EE3:", "Sub for:")}</span>
                        <span class="ml-1">${esc(player.substituteFor?.join(", ")) || "-"}</span>
                    </div>
                    <div>
                        ${playedStr ? `
                            <span class="text-gray-500">${tx("\u72B6\u6001:", "Status:")}</span>
                            ${playedStr}
                        ` : `
                            <span class="text-gray-500">${tx("\u51FA\u573A\u6982\u7387:", "Sub Prob:")}</span>
                            <span class="font-bold ml-1 ${getProbColor(player.appearanceProb)}">${Math.round(player.appearanceProb * 100)}%</span>
                        `}
                    </div>
                </div>
            </div>
            `;
        };
        return `
        <div class="space-y-3">
            <!-- Comparison Overview -->
            <div class="glass-light rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-gray-400">\u{1F504} \u66FF\u8865\u5E2D\u5BF9\u6BD4</span>
                    <span class="text-[11px] text-gray-500">\u677F\u51F3\u6DF1\u5EA6</span>
                </div>

                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="text-sm font-bold ${getStrengthColor(comparison.homeStrength)}">\u{1F535} ${teamLabel(home)}</div>
                        <div class="text-lg font-bold ${getStrengthColor(comparison.homeStrength)}">${comparison.homeStrength || "-"}</div>
                    </div>

                    <div class="text-center">
                        <div class="text-xs text-gray-500">VS</div>
                        <div class="text-[11px] font-bold ${comparison.advantage === "home" ? "text-blue-400" : comparison.advantage === "away" ? "text-red-400" : "text-gray-400"}">${comparison.advantage === "home" ? "\u{1F535} \u4F18\u52BF" : comparison.advantage === "away" ? "\u{1F534} \u4F18\u52BF" : "\u2696\uFE0F \u5747\u52BF"}</div>
                    </div>

                    <div class="flex-1 text-right">
                        <div class="text-sm font-bold ${getStrengthColor(comparison.awayStrength)}">${teamLabel(away)} \u{1F534}</div>
                        <div class="text-lg font-bold ${getStrengthColor(comparison.awayStrength)}">${comparison.awayStrength || "-"}</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-[11px] mt-2">
                    <div>
                        <span class="text-gray-500">\u8D85\u7EA7\u66FF\u8865:</span>
                        <span class="font-bold ml-1">${home.superSubCount || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">\u8D85\u7EA7\u66FF\u8865:</span>
                        <span class="font-bold ml-1">${away.superSubCount || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">\u9632\u5B88\u9009\u9879:</span>
                        <span class="font-bold ml-1">${home.defensiveOptions || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">\u9632\u5B88\u9009\u9879:</span>
                        <span class="font-bold ml-1">${away.defensiveOptions || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">\u8FDB\u653B\u9009\u9879:</span>
                        <span class="font-bold ml-1">${home.attackingOptions || 0}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500">\u8FDB\u653B\u9009\u9879:</span>
                        <span class="font-bold ml-1">${away.attackingOptions || 0}</span>
                    </div>
                </div>
            </div>

            ${Array.isArray(data.substitutionImpacts) && data.substitutionImpacts.length ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-gray-300 mb-1">${tx("\u6362\u4EBA\u5F71\u54CD", "Substitution Impact")}</div>
                <div class="text-[10px] text-gray-500 mb-2">${tx("\u6362\u4EBA\u524D\u540E 10 \u5206\u949F Pressure Index \u659C\u7387", "Pressure Index slope, 10 minutes before and after")}</div>
                ${data.substitutionImpacts.map(renderSubstitutionImpact).join("")}
            </div>
            ` : ""}

            <div class="grid grid-cols-2 gap-2">
                <div class="glass-light rounded-lg p-2 min-w-0">
                    <div class="text-xs font-bold text-blue-400 mb-2">\u{1F535} ${esc(teamLabel(home))}</div>
                    ${home.bench?.map((p) => renderBenchPlayer(p, "text-blue-400", teamLabel(home))).join("") || `<div class="text-gray-500 text-xs">${tx("\u6682\u65E0\u66FF\u8865\u6570\u636E", "No bench data")}</div>`}
                </div>
                <div class="glass-light rounded-lg p-2 min-w-0">
                    <div class="text-xs font-bold text-red-400 mb-2 text-right">${esc(teamLabel(away))} \u{1F534}</div>
                    ${away.bench?.map((p) => renderBenchPlayer(p, "text-red-400", teamLabel(away))).join("") || `<div class="text-gray-500 text-xs">${tx("\u6682\u65E0\u66FF\u8865\u6570\u636E", "No bench data")}</div>`}
                </div>
            </div>

            <!-- Substitution Matrix -->
            ${home.substitutionMatrix && Object.keys(home.substitutionMatrix).length > 0 ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-blue-400 mb-3 flex items-center gap-1">
                    <span>\u{1F504}</span> ${teamLabel(home)} ${tx("\u6838\u5FC3\u8F6E\u6362\u7F51\u7EDC", "Substitution Heatmap")}
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${Object.entries(home.substitutionMatrix).map(([starter, subs]) => `
                    <div class="bg-white/5 rounded-lg p-2 flex flex-col justify-center border border-white/5 shadow-sm">
                        <div class="text-[11px] font-bold text-gray-300 text-center mb-1">${esc(starter)}</div>
                        <div class="flex items-center justify-center">
                            <span class="text-gray-500 text-[10px]">\u25BC</span>
                        </div>
                        <div class="text-center mt-1 flex flex-col items-center gap-1">
                            <span class="inline-block bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded font-medium">${esc(subs.primary) || "\u2014"}</span>
                            ${subs.secondary ? `<span class="inline-block bg-white/5 text-gray-400 text-[9px] px-2 py-0.5 rounded">${esc(subs.secondary)}</span>` : ""}
                        </div>
                    </div>
                    `).join("")}
                </div>
            </div>
            ` : ""}

            ${away.substitutionMatrix && Object.keys(away.substitutionMatrix).length > 0 ? `
            <div class="glass-light rounded-lg p-3">
                <div class="text-xs font-bold text-red-400 mb-3 flex items-center gap-1">
                    <span>\u{1F504}</span> ${teamLabel(away)} ${tx("\u6838\u5FC3\u8F6E\u6362\u7F51\u7EDC", "Substitution Heatmap")}
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${Object.entries(away.substitutionMatrix).map(([starter, subs]) => `
                    <div class="bg-white/5 rounded-lg p-2 flex flex-col justify-center border border-white/5 shadow-sm">
                        <div class="text-[11px] font-bold text-gray-300 text-center mb-1">${esc(starter)}</div>
                        <div class="flex items-center justify-center">
                            <span class="text-gray-500 text-[10px]">\u25BC</span>
                        </div>
                        <div class="text-center mt-1 flex flex-col items-center gap-1">
                            <span class="inline-block bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded font-medium">${esc(subs.primary) || "\u2014"}</span>
                            ${subs.secondary ? `<span class="inline-block bg-white/5 text-gray-400 text-[9px] px-2 py-0.5 rounded">${esc(subs.secondary)}</span>` : ""}
                        </div>
                    </div>
                    `).join("")}
                </div>
            </div>
            ` : ""}
        </div>
        `;
      }
      function applySubstitutionsToFormation(realSubstitutions) {
        if (!realSubstitutions || !realSubstitutions.length) return;
        const svg = document.querySelector("#pitch-canvas svg");
        if (!svg) return;
        const circles = svg.querySelectorAll("circle");
        const texts = svg.querySelectorAll("text");
        realSubstitutions.forEach((sub) => {
          const outName = (sub.playerOut || "").toLowerCase();
          if (!outName) return;
          circles.forEach((c) => {
            const name = c.getAttribute("data-player-name");
            if (name && name.toLowerCase().includes(outName)) {
              c.setAttribute("opacity", "0.35");
              const cx = parseFloat(c.getAttribute("cx") || "0");
              const cy = parseFloat(c.getAttribute("cy") || "0");
              const marker = document.createElementNS("http://www.w3.org/2000/svg", "text");
              marker.setAttribute("x", cx);
              marker.setAttribute("y", cy - 3.5);
              marker.setAttribute("text-anchor", "middle");
              marker.setAttribute("font-size", "2");
              marker.setAttribute("font-weight", "bold");
              marker.setAttribute("fill", "#ef4444");
              marker.textContent = `\u{1F53D}${sub.minute}'`;
              c.parentNode.appendChild(marker);
            }
          });
          texts.forEach((t) => {
            const textContent = (t.textContent || "").trim();
            if (textContent === String(sub.playerOut) || textContent === `${sub.playerOut}'`) {
              t.setAttribute("opacity", "0.3");
            }
          });
        });
      }
      function renderCoachPanel(coachData, isFinishedMatch) {
        if (!coachData || !coachData.coachA && !coachData.coachB) {
          return `<div class="glass-light rounded-lg p-6 text-center">
                <div class="text-4xl mb-3">\u{1F9E0}</div>
                <div class="text-sm font-bold text-gray-300 mb-2">${tx("\u6559\u7EC3\u6570\u636E", "Coach Data")}</div>
                <div class="text-xs text-gray-500">${tx("\u6559\u7EC3\u6570\u636E\u5C06\u5728\u540E\u7EED\u7248\u672C\u4E2D\u5F00\u653E\uFF0C\u656C\u8BF7\u671F\u5F85\u3002", "Coach data will be available in a future release. Stay tuned.")}</div>
            </div>`;
        }
        const coachA = coachData.coachA;
        const coachB = coachData.coachB;
        const comp = coachData.comparison;
        const renderCoachCard = (coach, side) => {
          if (!coach || coach.error) {
            return `<div class="glass-light rounded-lg p-4 text-center">
                    <div class="text-2xl mb-1">\u{1F937}</div>
                    <div class="text-xs text-gray-500">${tx("\u6559\u7EC3\u6570\u636E\u6682\u672A\u540C\u6B65", "Coach data not synced")}</div>
                </div>`;
          }
          const name = coach.name || "?";
          const style = coach.style || tx("\u672A\u77E5", "Unknown");
          const winRate = coach.winRate || "?";
          const tenure = coach.tenure || "?";
          const nationality = coach.nationality || "";
          const flag = coach.flag || "";
          const sideColor = side === "home" ? "border-l-blue-500" : "border-l-red-500";
          const initial = name !== "?" ? name.charAt(0).toUpperCase() : "?";
          return `<div class="glass-light rounded-lg p-4 border-l-2 ${sideColor}">
                <div class="flex items-center gap-3 mb-3">
                    <div class="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold shadow-inner shrink-0">
                        ${initial}
                        ${flag ? `<div class="absolute -bottom-1 -right-1 text-[10px] bg-gray-800 rounded-full w-4 h-4 flex items-center justify-center border border-gray-700">${esc(flag)}</div>` : ""}
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-sm font-bold text-gray-200 truncate" title="${esc(name)}">${esc(name)}</span>
                        ${nationality ? `<span class="text-[10px] text-gray-500 truncate" title="${esc(nationality)}">${esc(nationality)}</span>` : ""}
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-[11px] bg-white/5 rounded-lg p-2">
                    <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx("\u98CE\u683C", "Style")}</span><span class="text-gray-300 font-semibold truncate" title="${esc(style)}">${esc(style)}</span></div>
                    <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx("\u80DC\u7387", "Win %")}</span><span class="text-gray-300 font-mono font-semibold">${esc(winRate)}</span></div>
                    <div class="flex flex-col"><span class="text-gray-500 mb-0.5">${tx("\u6267\u6559", "Tenure")}</span><span class="text-gray-300 font-mono font-semibold truncate" title="${esc(tenure)}">${esc(tenure)}</span></div>
                </div>
            </div>`;
        };
        let html = '<div class="grid grid-cols-2 gap-3 mb-3">';
        html += renderCoachCard(coachA, "home");
        html += renderCoachCard(coachB, "away");
        html += "</div>";
        if (comp) {
          html += `<div class="glass-light rounded-lg p-4 mt-3">
                <div class="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">
                    <span>\u2694\uFE0F</span> ${tx("\u6218\u672F\u4E0E\u6267\u6559\u5BF9\u4F4D", "Tactical & Coaching Matchup")}
                </div>
                <div class="space-y-2">`;
          const renderMatchupItem = (icon, titleZh, titleEn, valueI18n, valueFallback) => {
            const text = valueI18n ? i18nText(valueI18n) : valueFallback || "\u2014";
            if (text === "\u2014") return "";
            return `
                <div class="flex items-start gap-3 bg-white/5 rounded-lg p-2.5">
                    <div class="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center shrink-0 text-lg">${icon}</div>
                    <div class="flex flex-col justify-center">
                        <span class="text-[10px] text-gray-500 font-bold mb-0.5">${tx(titleZh, titleEn)}</span>
                        <span class="text-[11px] text-gray-300 leading-tight">${esc(text)}</span>
                    </div>
                </div>`;
          };
          html += renderMatchupItem("\u{1F4CB}", "\u98CE\u683C\u5BF9\u5792", "Style Matchup", comp.styleMatchupI18n, comp.styleMatchup);
          html += renderMatchupItem("\u23F3", "\u7ECF\u9A8C\u5DEE\u8DDD", "Experience Gap", comp.experienceGapI18n, comp.experienceGap);
          html += renderMatchupItem("\u{1F3AF}", "\u4E34\u573A\u8C03\u6574", "Adjustment Edge", comp.adjustmentEdgeI18n, comp.adjustmentEdge);
          if (comp.overallScore) {
            const names = Object.keys(comp.overallScore);
            if (names.length >= 2) {
              const scoreA = Number(comp.overallScore[names[0]]) || 0;
              const scoreB = Number(comp.overallScore[names[1]]) || 0;
              const totalScore = scoreA + scoreB || 1;
              const pctA = scoreA / totalScore * 100;
              const pctB = scoreB / totalScore * 100;
              html += `
                    <div class="mt-4 pt-3 border-t border-white/10">
                        <div class="text-[10px] text-gray-500 mb-2 flex justify-between">
                            <span>${esc(names[0])}</span>
                            <span>${tx("\u7EFC\u5408\u8BC4\u5206\u5BF9\u6BD4", "Overall Rating Comparison")}</span>
                            <span>${esc(names[1])}</span>
                        </div>
                        <div class="flex h-3 rounded-full overflow-hidden mb-1 bg-white/5 shadow-inner">
                            <div class="bg-blue-500/80 transition-all duration-700" style="width: ${pctA}%"></div>
                            <div class="bg-red-500/80 transition-all duration-700" style="width: ${pctB}%"></div>
                        </div>
                        <div class="flex justify-between text-[11px] font-mono font-bold">
                            <span class="text-blue-300">${scoreA}</span>
                            <span class="text-red-300">${scoreB}</span>
                        </div>
                    </div>`;
            } else {
              html += `<div class="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                        <span class="text-gray-500 text-[11px]">${tx("\u7EFC\u5408\u8BC4\u5206", "Overall")}</span>`;
              for (const [name, score] of Object.entries(comp.overallScore)) {
                html += `<span class="text-[11px] font-mono font-bold text-gray-200">${esc(name)}: ${esc(String(score))}</span>`;
              }
              html += `</div>`;
            }
          }
          html += `</div></div>`;
        } else if (coachA && coachB && !coachData._fallback) {
          html += `<div class="glass-light rounded-lg p-4 text-center mt-3">
                <div class="text-xs text-gray-500">${tx("\u6559\u7EC3\u5BF9\u9635\u5206\u6790\u6682\u672A\u751F\u6210", "Coach matchup analysis not yet generated")}</div>
            </div>`;
        }
        return html;
      }
      function renderHudStatsPanel(matchData2, pred) {
        const stats = matchData2?.teamStats;
        if (!stats || stats.length === 0) {
          return `<div class="text-gray-500 text-xs text-center py-6">${tx("\u6682\u65E0\u7EDF\u8BA1\u6570\u636E", "No stats available")}</div>`;
        }
        const isFlat = stats.some((stat) => stat && ("home" in stat || "away" in stat));
        const hs = isFlat ? [] : stats[0]?.statistics || [];
        const as = isFlat ? [] : stats[1]?.statistics || [];
        const flatMap = new Map(stats.map((stat) => [stat.name || stat.abbreviation, stat]));
        const findStat = (side, keys) => {
          const candidates = Array.isArray(keys) ? keys : [keys];
          if (isFlat) {
            for (const key of candidates) {
              const stat2 = flatMap.get(key);
              if (stat2 && stat2[side] != null) return String(stat2[side]);
            }
            return "0";
          }
          const arr = side === "home" ? hs : as;
          const stat = arr.find((item) => candidates.includes(item.name) || candidates.includes(item.abbreviation));
          return stat ? String(stat.displayValue ?? stat.value ?? "0") : "0";
        };
        const pct = (v) => parseFloat(v) || 0;
        const pctDisplay = (v) => {
          const n = pct(v);
          const normalized = n > 0 && n <= 1 ? n * 100 : n;
          return `${Math.round(normalized * 10) / 10}%`;
        };
        const statRows = [
          { keys: ["possessionPct", "Possession"], label: tx("\u63A7\u7403\u7387", "Possession"), fmt: pctDisplay },
          { keys: ["totalShots", "Total Shots"], label: tx("\u5C04\u95E8", "Shots"), fmt: (v) => v },
          { keys: ["shotsOnTarget", "Shots on Target"], label: tx("\u5C04\u6B63", "On Target"), fmt: (v) => v },
          { keys: ["passPct", "PassAccuracy"], label: tx("\u4F20\u7403\u6210\u529F", "Pass Acc."), fmt: pctDisplay },
          { keys: ["wonCorners", "Corners"], label: tx("\u89D2\u7403", "Corners"), fmt: (v) => v },
          { keys: ["foulsCommitted", "Fouls Committed"], label: tx("\u72AF\u89C4", "Fouls"), fmt: (v) => v }
        ];
        let html = `<div style="padding:16px 18px">`;
        html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px">${tx("\u6BD4\u8D5B\u7EDF\u8BA1", "MATCH STATISTICS")}</div>`;
        html += `<div style="display:flex;flex-direction:column;gap:12px">`;
        for (const row of statRows) {
          const hRaw = findStat("home", row.keys);
          const aRaw = findStat("away", row.keys);
          const hVal = row.fmt(hRaw);
          const aVal = row.fmt(aRaw);
          const hNum = pct(hRaw);
          const aNum = pct(aRaw);
          const total = hNum + aNum || 1;
          const hPct = Math.round(hNum / total * 100);
          html += `<div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
                    <span style="font:500 16px/1 'JetBrains Mono',monospace;color:#f8fafc">${esc(hVal)}</span>
                    <span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.3)">${esc(row.label)}</span>
                    <span style="font:500 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.45)">${esc(aVal)}</span>
                </div>
                <div style="display:flex;height:4px;gap:2px;border-radius:2px;overflow:hidden">
                    <div style="width:${hPct}%;background:linear-gradient(90deg,rgba(59,130,246,.5),rgba(59,130,246,.25));border-radius:2px"></div>
                    <div style="width:${100 - hPct}%;background:rgba(248,113,113,.15);border-radius:2px"></div>
                </div>
            </div>`;
        }
        html += `</div>`;
        if (pred && pred.goals) {
          const hxG = pred.goals.homeExpected != null ? Number(pred.goals.homeExpected).toFixed(1) : "-";
          const axG = pred.goals.awayExpected != null ? Number(pred.goals.awayExpected).toFixed(1) : "-";
          html += `<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.04)">
                <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">${tx("\u6CCA\u677E\u671F\u671B\u8FDB\u7403", "POISSON EXPECTED SCORE")}</div>
                <div style="display:flex;align-items:center;justify-content:center;gap:16px">
                    <div style="text-align:center"><div style="font:300 32px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.6)">${hxG}</div><div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">xG ${tx("\u4E3B", "H")}</div></div>
                    <div style="font:300 16px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1)">\u2014</div>
                    <div style="text-align:center"><div style="font:300 32px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.5)">${axG}</div><div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-top:3px">xG ${tx("\u5BA2", "A")}</div></div>
                </div>
            </div>`;
        }
        html += `</div>`;
        return html;
      }
      function renderHudWinProbPanel(pred, homeName, awayName) {
        if (!pred || pred.homeWin == null) {
          return `<div class="text-gray-500 text-xs text-center py-6">${tx("\u9884\u6D4B\u6570\u636E\u52A0\u8F7D\u5931\u8D25", "Prediction unavailable")}</div>`;
        }
        const hw = Math.round((pred.homeWin || 0) * 100);
        const dr = Math.round((pred.draw || 0) * 100);
        const aw = 100 - hw - dr;
        const expectedHome = Number(pred.goals?.homeExpected);
        const expectedAway = Number(pred.goals?.awayExpected);
        const fallbackScore = Number.isFinite(expectedHome) && Number.isFinite(expectedAway) ? `${Math.max(0, Math.round(expectedHome))}-${Math.max(0, Math.round(expectedAway))}` : `${hw > aw ? 1 : 0}-${aw > hw ? 1 : 0}`;
        const score = String(pred.likelyScore || fallbackScore);
        const scoreParts = score.split(/[-:]/).map((s) => s.trim());
        const [sH, sA] = scoreParts.length >= 2 ? scoreParts : ["?", "?"];
        const cx = 90, cy = 76, r = 66, SW = 10;
        const pt = (pct) => {
          const \u03B8 = Math.PI * (1 - pct / 100);
          return { x: +(cx + r * Math.cos(\u03B8)).toFixed(2), y: +(cy - r * Math.sin(\u03B8)).toFixed(2) };
        };
        const p0 = pt(0);
        const p1 = pt(hw);
        const p2 = pt(hw + dr);
        const p3 = pt(100);
        const seg = (a, b, col) => a.x === b.x && a.y === b.y ? "" : `<path d="M${a.x} ${a.y} A${r} ${r} 0 0 1 ${b.x} ${b.y}" fill="none" stroke="${col}" stroke-width="${SW}" stroke-linecap="butt"/>`;
        let html = `<div style="background:rgba(15,23,42,.45);backdrop-filter:blur(var(--glass-blur-sm));border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px 18px;box-shadow:0 4px 30px rgba(0,0,0,.4)">`;
        html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx("\u80DC\u7387\u9884\u6D4B", "WIN PROBABILITY")}</div>`;
        html += `<div style="text-align:center;margin-bottom:4px">
            <svg width="180" height="88" viewBox="0 0 180 88">
                <path d="M${p0.x} ${p0.y} A${r} ${r} 0 0 1 ${p3.x} ${p3.y}" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="${SW}" stroke-linecap="butt"/>
                ${hw > 1 ? seg(p0, p1, "rgba(59,130,246,.6)") : ""}
                ${dr > 1 ? seg(p1, p2, "rgba(251,191,36,.5)") : ""}
                ${aw > 1 ? seg(p2, p3, "rgba(248,113,113,.5)") : ""}
                <circle cx="${p0.x}" cy="${p0.y}" r="${SW / 2}" fill="${hw > 1 ? "rgba(59,130,246,.6)" : "rgba(255,255,255,.05)"}"/>
                <circle cx="${p3.x}" cy="${p3.y}" r="${SW / 2}" fill="${aw > 1 ? "rgba(248,113,113,.5)" : "rgba(255,255,255,.05)"}"/>
                ${hw > 2 && dr > 2 ? `<circle cx="${p1.x}" cy="${p1.y}" r="${SW / 2 + 1.5}" fill="rgba(10,18,36,.96)"/>` : ""}
                ${dr > 2 && aw > 2 ? `<circle cx="${p2.x}" cy="${p2.y}" r="${SW / 2 + 1.5}" fill="rgba(10,18,36,.96)"/>` : ""}
                <text x="${cx}" y="44" text-anchor="middle" fill="#f8fafc" font-family="JetBrains Mono" font-size="26" font-weight="300">${hw}<tspan font-size="13" fill="rgba(248,250,252,.3)">%</tspan></text>
                <text x="${cx}" y="60" text-anchor="middle" fill="rgba(59,130,246,.45)" font-family="JetBrains Mono" font-size="7" font-weight="400" letter-spacing="1.5">${esc((homeName || "HOME").toUpperCase())} WIN</text>
            </svg>
        </div>`;
        html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:0 2px;margin-bottom:12px">
            <div style="text-align:left">
                <div style="font:600 15px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.8)">${hw}<span style="font-size:9px;font-weight:400;color:rgba(59,130,246,.35)">%</span></div>
                <div style="font:400 7px/1 'Inter';color:rgba(59,130,246,.3);margin-top:3px;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(homeName || "HOME")}</div>
            </div>
            <div style="text-align:center">
                <div style="font:400 12px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.55)">${dr}<span style="font-size:9px;color:rgba(251,191,36,.25)">%</span></div>
                <div style="font:400 7px/1 'Inter';color:rgba(251,191,36,.25);margin-top:3px">${tx("\u5E73", "DRAW")}</div>
            </div>
            <div style="text-align:right">
                <div style="font:500 13px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.6)">${aw}<span style="font-size:9px;font-weight:400;color:rgba(248,113,113,.25)">%</span></div>
                <div style="font:400 7px/1 'Inter';color:rgba(248,113,113,.25);margin-top:3px;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl">${esc(awayName || "AWAY")}</div>
            </div>
        </div>`;
        html += `<div style="padding-top:12px;border-top:1px solid rgba(255,255,255,.04)">
            <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.35);letter-spacing:1.5px;margin-bottom:8px">${tx("\u9884\u6D4B\u6BD4\u5206", "PREDICTED SCORE")}</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:12px">
                <div style="padding:6px 16px;border-radius:8px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.12)"><span style="font:300 20px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.6)">${esc(sH)}</span></div>
                <span style="font:300 12px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1)">:</span>
                <div style="padding:6px 16px;border-radius:8px;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.08)"><span style="font:300 20px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.45)">${esc(sA)}</span></div>
            </div>
        </div>`;
        html += `</div>`;
        return html;
      }
      function renderPressurePanel(pressureData, homeName, awayName) {
        if (!pressureData || pressureData.error) return "";
        const current = pressureData.current;
        const curve = Array.isArray(pressureData.curve) ? pressureData.curve : [];
        if (!current && curve.length === 0) return "";
        const homePI = current?.home ?? 0;
        const awayPI = current?.away ?? 0;
        const total = homePI + awayPI || 1;
        const homePct = Math.round(homePI / total * 100);
        const awayPct = 100 - homePct;
        const dominant = current?.dominant;
        const minute = current?.atMinute;
        const domLabel = dominant === "home" ? `<span style="color:rgba(59,130,246,.7)">${esc(homeName)}</span>` : dominant === "away" ? `<span style="color:rgba(248,113,113,.6)">${esc(awayName)}</span>` : `<span style="color:rgba(248,250,252,.25)">${tx("\u5747\u52BF", "Even")}</span>`;
        let html = `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx("\u6001\u52BF\u8D70\u52BF", "MOMENTUM")}</div>`;
        if (curve.length > 1) {
          const W = 244, H = 52;
          const maxMin = Math.max(...curve.map((r) => r.minute), 90);
          const toX = (m) => (m / maxMin * (W - 8) + 4).toFixed(1);
          const toY = (v) => (H - 4 - Math.min(v, 100) / 100 * (H - 10)).toFixed(1);
          const hPts = curve.map((r) => `${toX(r.minute)},${toY(r.pressure_home)}`).join(" ");
          const aPts = curve.map((r) => `${toX(r.minute)},${toY(r.pressure_away)}`).join(" ");
          const last = curve[curve.length - 1];
          const midY = toY(50);
          html += `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin-bottom:10px;overflow:visible">
                <line x1="4" y1="${midY}" x2="${W - 4}" y2="${midY}" stroke="rgba(255,255,255,.05)" stroke-width="1" stroke-dasharray="2,4"/>
                <polyline points="${hPts}" fill="none" stroke="rgba(59,130,246,.55)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                <polyline points="${aPts}" fill="none" stroke="rgba(248,113,113,.45)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                <circle cx="${toX(last.minute)}" cy="${toY(last.pressure_home)}" r="2.5" fill="rgba(59,130,246,.8)"/>
                <circle cx="${toX(last.minute)}" cy="${toY(last.pressure_away)}" r="2.5" fill="rgba(248,113,113,.7)"/>
            </svg>`;
        }
        html += `<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;gap:1px;margin-bottom:6px">
            <div style="width:${homePct}%;background:rgba(59,130,246,.18);display:flex;align-items:center;justify-content:center;min-width:28px">
                <span style="font:500 9px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.75)">${homePI.toFixed(0)}</span>
            </div>
            <div style="width:${awayPct}%;background:rgba(248,113,113,.12);display:flex;align-items:center;justify-content:center;min-width:28px">
                <span style="font:400 9px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.55)">${awayPI.toFixed(0)}</span>
            </div>
        </div>`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.35)">${esc(homeName || "H")}</span>
            <span style="font:400 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.18)">${domLabel} ${tx("\u4E3B\u5BFC", "dominant")}${minute != null ? ` \xB7 ${minute}'` : ""}</span>
            <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.3)">${esc(awayName || "A")}</span>
        </div>`;
        html += `<div style="display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">
            <div style="display:flex;align-items:center;gap:4px"><div style="width:16px;height:1.5px;background:rgba(59,130,246,.55)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(homeName || "H")}</span></div>
            <div style="display:flex;align-items:center;gap:4px"><div style="width:16px;height:1.5px;background:rgba(248,113,113,.45)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(awayName || "A")}</span></div>
            <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1);margin-left:auto">${tx("\u538B\u529B\u6307\u6570", "PI 0\u2013100")}</span>
        </div>`;
        return html;
      }
      function renderLiveProbPanel(data, homeName, awayName) {
        if (!data || data.error) return "";
        const preMatch = data.preMatch || {};
        const current = data.current || null;
        const curve = Array.isArray(data.curve) ? data.curve : [];
        if (!preMatch.homeWin && curve.length === 0) return "";
        const W = 244, H = 64;
        const pct = (v) => Math.round((v || 0) * 100);
        let html = `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">${tx("\u6982\u7387\u8D70\u52BF", "PROB JOURNEY")}</div>`;
        const st = data.liveState?.state || (current && (current.minuteElapsed > 0 || current.homeScore > 0 || current.awayScore > 0) ? "match" : "pre");
        const stLabel = data.liveState?.label || (st === "end" ? "FT" : st === "match" ? "LIVE" : "PRE");
        const hSc = data.score?.home ?? current?.homeScore ?? "-";
        const aSc = data.score?.away ?? current?.awayScore ?? "-";
        const stStyles = {
          pre: "background:rgba(100,116,139,.15);color:#94a3b8;border:1px solid rgba(100,116,139,.25)",
          match: "background:rgba(52,211,153,.15);color:#34d399;border:1px solid rgba(52,211,153,.3)",
          ht: "background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.3)",
          et: "background:rgba(168,85,247,.15);color:#c084fc;border:1px solid rgba(168,85,247,.3)",
          pen: "background:rgba(244,63,94,.15);color:#fb7185;border:1px solid rgba(244,63,94,.3)",
          end: "background:rgba(100,116,139,.2);color:#cbd5e1;border:1px solid rgba(100,116,139,.3)"
        };
        const badgeStyle = stStyles[st] || stStyles.pre;
        const pulseCircle = st === "match" ? `<div style="width:5px;height:5px;border-radius:50%;background:#34d399;animation:pulse-live 1.8s ease-in-out infinite"></div>` : "";
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:6px;max-width:35%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                <span style="font:500 11px/1 'Inter';color:#f8fafc" title="${esc(homeName || "")}">${esc(homeName || "H")}</span>
                <span style="font:700 14px/1 'JetBrains Mono',monospace;color:#f8fafc">${esc(String(hSc))}</span>
            </div>
            <div style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;font:600 8px/1 'JetBrains Mono',monospace;letter-spacing:0.5px;flex-shrink:0;${badgeStyle}">
                ${pulseCircle}<span>${esc(stLabel)}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;max-width:35%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                <span style="font:700 14px/1 'JetBrains Mono',monospace;color:#f8fafc">${esc(String(aSc))}</span>
                <span style="font:500 11px/1 'Inter';color:#f8fafc" title="${esc(awayName || "")}">${esc(awayName || "A")}</span>
            </div>
        </div>`;
        if (curve.length > 1) {
          const maxMin = Math.max(...curve.map((r) => r.minute || 0), 90);
          const toX = (m) => (Math.min(m || 0, maxMin) / maxMin * (W - 8) + 4).toFixed(1);
          const toY = (v) => (H - 4 - Math.min(Math.max(v || 0, 0), 1) * (H - 12)).toFixed(1);
          const hPts = curve.map((r) => `${toX(r.minute)},${toY(r.prob_home_win)}`).join(" ");
          const dPts = curve.map((r) => `${toX(r.minute)},${toY(r.prob_draw)}`).join(" ");
          const aPts = curve.map((r) => `${toX(r.minute)},${toY(r.prob_away_win)}`).join(" ");
          const pmHY = toY(preMatch.homeWin || 0);
          const goals = curve.filter((r) => r.type === "goal");
          html += `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin-bottom:8px;overflow:visible">
                <line x1="4" y1="${pmHY}" x2="${W - 4}" y2="${pmHY}" stroke="rgba(59,130,246,.12)" stroke-width="1" stroke-dasharray="3,5"/>
                <polyline points="${aPts}" fill="none" stroke="rgba(248,113,113,.5)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                <polyline points="${dPts}" fill="none" stroke="rgba(251,191,36,.4)" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>
                <polyline points="${hPts}" fill="none" stroke="rgba(59,130,246,.75)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                ${goals.map((g) => `<circle cx="${toX(g.minute)}" cy="${toY(g.prob_home_win)}" r="2.5" fill="rgba(52,211,153,.85)"/>`).join("")}
            </svg>`;
        }
        const pmH = pct(preMatch.homeWin), pmD = pct(preMatch.draw), pmA = pct(preMatch.awayWin);
        html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);margin-bottom:5px">
            <span style="font:400 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.18)">${tx("\u8D5B\u524D", "PRE")}</span>
            <div style="display:flex;gap:8px">
                <span style="font:500 10px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.6)">${pmH}%</span>
                <span style="font:400 9px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.4)">${pmD}%</span>
                <span style="font:400 10px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.5)">${pmA}%</span>
            </div>
        </div>`;
        if (current && !current.error && (current.minuteElapsed > 0 || current.homeScore > 0 || current.awayScore > 0)) {
          const lH = pct(current.homeWin), lD = pct(current.draw), lA = pct(current.awayWin);
          const delta = (current.homeWin || 0) - (preMatch.homeWin || 0);
          const deltaStr = delta > 5e-3 ? `+${Math.round(delta * 100)}%` : delta < -5e-3 ? `${Math.round(delta * 100)}%` : "";
          const deltaColor = delta > 5e-3 ? "rgba(52,211,153,.7)" : delta < -5e-3 ? "rgba(248,113,113,.6)" : "rgba(248,250,252,.2)";
          html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.13)">
                <span style="font:400 7px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.5)">${tx("\u5F53\u524D", "NOW")}</span>
                <div style="display:flex;gap:8px;align-items:center">
                    <span style="font:700 11px/1 'JetBrains Mono',monospace;color:rgba(59,130,246,.85)">${lH}%</span>
                    <span style="font:400 9px/1 'JetBrains Mono',monospace;color:rgba(251,191,36,.45)">${lD}%</span>
                    <span style="font:500 10px/1 'JetBrains Mono',monospace;color:rgba(248,113,113,.6)">${lA}%</span>
                    ${deltaStr ? `<span style="font:500 8px/1 'JetBrains Mono',monospace;color:${deltaColor}">${esc(deltaStr)}</span>` : ""}
                </div>
            </div>`;
        }
        html += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04)">
            <div style="display:flex;align-items:center;gap:3px"><div style="width:12px;height:2px;background:rgba(59,130,246,.75)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(homeName || "H")}</span></div>
            <div style="display:flex;align-items:center;gap:3px"><div style="width:12px;height:1.5px;background:rgba(251,191,36,.4)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${tx("\u5E73", "D")}</span></div>
            <div style="display:flex;align-items:center;gap:3px"><div style="width:12px;height:1.5px;background:rgba(248,113,113,.5)"></div><span style="font:400 7px/1 'Inter';color:rgba(248,250,252,.2)">${esc(awayName || "A")}</span></div>
            <span style="font:300 7px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.1);margin-left:auto">Track A</span>
        </div>`;
        return html;
      }
      function renderHudVenuePanel(venueData) {
        if (!venueData || venueData.error) {
          return "";
        }
        const v = venueData;
        const w = v.weather;
        const impact = v.impact;
        const meta = v.meta;
        let html = `<div style="background:rgba(15,23,42,.45);backdrop-filter:blur(var(--glass-blur-sm));border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.4)">`;
        html += `<div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(52,211,153,.4);letter-spacing:1.5px;text-transform:uppercase;padding:16px 18px 12px">${tx("\u573A\u5730\u6761\u4EF6", "VENUE CONDITIONS")}</div>`;
        if (v.wikiThumb) {
          html += `<div style="padding:0 18px;margin-bottom:12px"><img src="${esc(v.wikiThumb)}" alt="${esc(v.name || "")}" style="width:100%;height:120px;object-fit:cover;border-radius:10px;opacity:.85" loading="lazy"></div>`;
        }
        html += `<div style="padding:0 18px"><div style="font:italic 400 15px/1 'Instrument Serif',serif;color:rgba(248,250,252,.6);margin-bottom:3px">${esc(v.name || "")}</div>`;
        html += `<div style="font:400 9px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:14px">${esc(v.city || "")}, ${esc(v.country || "")}</div></div>`;
        const metaCards = [];
        if (v.capacity) metaCards.push({ label: tx("\u5BB9\u91CF", "Capacity"), value: v.capacity.toLocaleString(), color: "rgba(248,250,252,.5)" });
        if (meta?.yearBuilt) metaCards.push({ label: tx("\u5EFA\u9020", "Built"), value: String(meta.yearBuilt), color: "rgba(167,139,250,.6)" });
        if (meta?.architect) metaCards.push({ label: tx("\u5EFA\u7B51\u5E08", "Architect"), value: meta.architect, color: "rgba(251,191,36,.5)" });
        if (meta?.cost) metaCards.push({ label: tx("\u9020\u4EF7", "Cost"), value: meta.cost, color: "rgba(52,211,153,.5)" });
        if (metaCards.length > 0) {
          const cols = metaCards.length <= 2 ? metaCards.length : 2;
          html += `<div style="padding:0 18px;margin-bottom:14px;display:grid;grid-template-columns:${"1fr ".repeat(cols).trim()};gap:8px">`;
          for (const c of metaCards) {
            html += `<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
                    <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${c.label}</div>
                    <div style="font:500 12px/1.2 'JetBrains Mono',monospace;color:${c.color}">${esc(c.value)}</div>
                </div>`;
          }
          html += `</div>`;
        }
        const alt = v.altitude || 0;
        const altWarn = alt > 1500;
        const temp = w?.temp || "--";
        const hum = w?.humidity || "--";
        const grass = meta?.surface || v.grass || tx("\u5929\u7136\u8349", "Natural");
        html += `<div style="padding:0 18px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
                <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx("\u6D77\u62D4", "Altitude")}</div>
                <div style="font:400 18px/1 'JetBrains Mono',monospace;color:rgba(251,146,60,.6)">${alt.toLocaleString()}<span style="font-size:9px;color:rgba(251,146,60,.3)">m</span></div>
                ${altWarn ? `<div style="font:400 7px/1 'Inter';color:rgba(251,146,60,.35);margin-top:3px">\u26A0 ${tx("\u9AD8\u6D77\u62D4", "High altitude")}</div>` : ""}
            </div>
            <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
                <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx("\u6E29\u5EA6", "Temp")}</div>
                <div style="font:400 18px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${esc(String(temp))}<span style="font-size:9px;color:rgba(248,250,252,.2)">\xB0C</span></div>
            </div>
            <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
                <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx("\u8349\u76AE", "Surface")}</div>
                <div style="font:500 11px/1 'Inter';color:rgba(52,211,153,.5);margin-top:2px">${esc(grass)}</div>
            </div>
            <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04)">
                <div style="font:400 8px/1 'Inter';color:rgba(248,250,252,.2);margin-bottom:4px">${tx("\u6E7F\u5EA6", "Humidity")}</div>
                <div style="font:400 18px/1 'JetBrains Mono',monospace;color:rgba(248,250,252,.5)">${esc(String(hum))}<span style="font-size:9px;color:rgba(248,250,252,.2)">%</span></div>
            </div>
        </div>`;
        if (impact && impact.overall != null) {
          const pct = Math.min(100, Math.max(0, Math.round(impact.overall + 50)));
          const color = impact.overall > 5 ? "rgba(52,211,153,.5)" : impact.overall < -5 ? "rgba(248,113,113,.5)" : "rgba(251,146,60,.5)";
          html += `<div style="margin-top:12px;padding:10px;border-radius:8px;background:rgba(251,146,60,.04);border:1px solid rgba(251,146,60,.08)">
                <div style="font:500 8px/1 'JetBrains Mono',monospace;color:rgba(251,146,60,.4);letter-spacing:1px;margin-bottom:6px">${tx("\u573A\u5730\u56E0\u5B50", "VENUE FACTOR")}</div>
                <div style="display:flex;align-items:center;gap:8px">
                    <div style="flex:1;height:4px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${color},${color.replace(".5", ".15")});border-radius:2px"></div></div>
                    <span style="font:400 10px/1 'JetBrains Mono',monospace;color:${color}">${impact.overall > 0 ? "+" : ""}${impact.overall.toFixed(0)}</span>
                </div>
            </div>`;
        }
        html += `</div>`;
        return html;
      }
      return {
        renderFormation,
        renderTacticalBoard,
        renderPredictionLayers,
        renderBenchAnalysis,
        applySubstitutionsToFormation,
        renderCoachPanel,
        getMockMatchupData,
        getMockPrediction,
        formationTemplate,
        parseFormationStr,
        // HUD renderers
        renderHudStatsPanel,
        renderHudWinProbPanel,
        renderHudVenuePanel,
        renderPressurePanel,
        renderLiveProbPanel
      };
    })();
  }
});

// static/js/push-notifications.js
var require_push_notifications = __commonJS({
  "static/js/push-notifications.js"() {
    (function() {
      "use strict";
      const button = () => document.getElementById("push-notification-btn");
      function setState(state, zh, en) {
        const el = button();
        if (!el) return;
        el.dataset.pushState = state;
        el.title = window.WorldCup?.State?.uiLang === "en" ? en : zh;
        const label = el.querySelector("[data-push-label]");
        if (label) label.textContent = state === "enabled" ? "\u2713" : "\u{1F514}";
        el.setAttribute("aria-label", el.title);
        el.style.color = state === "enabled" ? "#34d399" : "rgba(248,250,252,.45)";
      }
      function base64UrlToUint8Array(value) {
        const padding = "=".repeat((4 - value.length % 4) % 4);
        const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        return Uint8Array.from(raw, (char) => char.charCodeAt(0));
      }
      function getDeviceId() {
        const key = "pitchsignal_push_device_id";
        let id = localStorage.getItem(key);
        if (!id) {
          id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          localStorage.setItem(key, id);
        }
        return id;
      }
      async function registerSubscription(subscription) {
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: getDeviceId(),
            subscription: subscription.toJSON()
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || "Subscription registration failed");
      }
      async function enablePushNotifications() {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
          setState("unsupported", "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u63A8\u9001\u901A\u77E5", "Push notifications are not supported");
          return;
        }
        const el = button();
        if (el) el.disabled = true;
        try {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            setState("denied", "\u901A\u77E5\u6743\u9650\u672A\u5F00\u542F", "Notification permission was not granted");
            return;
          }
          const registration = await navigator.serviceWorker.ready;
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
            const keyData = await keyResponse.json().catch(() => ({}));
            if (!keyResponse.ok || !keyData.publicKey) {
              throw new Error(keyData.error || "Push service is not configured");
            }
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: base64UrlToUint8Array(keyData.publicKey)
            });
          }
          await registerSubscription(subscription);
          setState("enabled", "\u8FDB\u7403\u63A8\u9001\u5DF2\u5F00\u542F", "Goal notifications enabled");
        } catch (error) {
          console.error("push-notifications: enable failed", error);
          setState("error", "\u8FDB\u7403\u63A8\u9001\u5F00\u542F\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", "Could not enable goal notifications");
        } finally {
          if (el) el.disabled = false;
        }
      }
      async function refreshPushState() {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
          setState("unsupported", "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u63A8\u9001\u901A\u77E5", "Push notifications are not supported");
          return;
        }
        if (Notification.permission === "denied") {
          setState("denied", "\u901A\u77E5\u6743\u9650\u5DF2\u88AB\u6D4F\u89C8\u5668\u963B\u6B62", "Notifications are blocked by the browser");
          return;
        }
        if (Notification.permission !== "granted") {
          setState("idle", "\u5F00\u542F\u8FDB\u7403\u63A8\u9001", "Enable goal notifications");
          return;
        }
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await registerSubscription(subscription);
            setState("enabled", "\u8FDB\u7403\u63A8\u9001\u5DF2\u5F00\u542F", "Goal notifications enabled");
          } else {
            setState("idle", "\u5F00\u542F\u8FDB\u7403\u63A8\u9001", "Enable goal notifications");
          }
        } catch {
          setState("error", "\u8FDB\u7403\u63A8\u9001\u72B6\u6001\u68C0\u67E5\u5931\u8D25", "Could not check notification status");
        }
      }
      window.PitchSignalPush = { enable: enablePushNotifications, refresh: refreshPushState };
    })();
  }
});

// static/js/app.js
var require_app = __commonJS({
  "static/js/app.js"() {
    (function() {
      "use strict";
      const state = window.WorldCup.State;
      const { tab } = state;
      const TAB_MAX_WIDTHS = { live: "720px", schedule: "720px", prediction: "1080px", standings: "960px", teams: "1080px" };
      function switchTab(newTab) {
        state.tab = newTab;
        document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
        document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("tab-on"));
        const detailOverlay = document.querySelector(".match-detail-overlay, .spatial-matchup-panel");
        if (detailOverlay) detailOverlay.remove();
        document.getElementById("match-modal").classList.add("hidden");
        const target = document.getElementById("tab-" + state.tab);
        if (target) {
          target.classList.remove("hidden");
          target.classList.add("fade-in");
        }
        document.querySelector(`[data-tab="${state.tab}"]`)?.classList.add("tab-on");
        const w = TAB_MAX_WIDTHS[state.tab] || "720px";
        const main = document.getElementById("main-content");
        if (main) main.style.maxWidth = w;
        const bb = document.getElementById("bottom-bar-inner");
        if (bb) bb.style.maxWidth = w;
        if (state.tab === "schedule" && !state.scheduleLoaded) loadSchedule();
        if (state.tab === "standings") loadStandings();
        if (state.tab === "teams") {
          document.getElementById("team-detail").classList.add("hidden");
          document.getElementById("teams-grid").classList.remove("hidden");
          loadTeams();
        }
        if (state.tab === "prediction") loadPrediction();
        history.replaceState(null, "", "#" + state.tab);
      }
      function togglePredDetail(id) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("hidden");
      }
      function refreshAll() {
        const btn = document.getElementById("refresh-btn");
        btn.style.animation = "spin 0.5s linear";
        setTimeout(() => btn.style.animation = "", 500);
        loadScores();
        if (state.tab === "schedule") {
          state.scheduleLoaded = false;
          loadSchedule();
        }
        if (state.tab === "standings") loadStandings();
      }
      function tick() {
        const time = (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", {
          timeZone: "Asia/Shanghai",
          hour12: false
        });
        const el = document.getElementById("clock");
        if (el) el.textContent = time + (state.uiLang === "en" ? " CST" : "");
      }
      function _appendChatBubble(container, role, text) {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-bottom:12px;" + (role === "user" ? "align-items:flex-end" : "align-items:flex-start");
        const label = document.createElement("span");
        label.style.cssText = "font:400 9px/1 'Inter';color:rgba(248,250,252,.3)";
        label.textContent = role === "user" ? "You" : "AI Assistant";
        const bubble = document.createElement("div");
        bubble.style.cssText = role === "user" ? "background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.15);border-radius:16px 16px 4px 16px;padding:10px 14px;font:400 13px/1.5 'Inter';color:#f8fafc;max-width:85%;word-break:break-word" : "background:rgba(255,255,255,.06);border-radius:16px 16px 16px 4px;padding:10px 14px;font:400 13px/1.5 'Inter';color:rgba(248,250,252,.7);max-width:85%;word-break:break-word";
        bubble.textContent = text || "";
        wrap.appendChild(label);
        wrap.appendChild(bubble);
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
        return bubble;
      }
      function _typewriterEffect(el, text, speed) {
        speed = speed || 18;
        return new Promise((resolve) => {
          let i = 0;
          const scroll = () => {
            el.parentElement.parentElement.scrollTop = el.parentElement.parentElement.scrollHeight;
          };
          (function type() {
            if (i < text.length) {
              el.textContent += text.charAt(i);
              i++;
              scroll();
              setTimeout(type, speed);
            } else resolve();
          })();
        });
      }
      let globalChatState = { history: [], mode: "ask" };
      function getPageContext() {
        const hash = window.location.hash || "#live";
        const ctx = { currentRoute: hash, uiLang: state.uiLang };
        if (hash.startsWith("#predict/")) {
          ctx.matchId = hash.split("/")[1];
          const home = document.querySelector("#pred-home-team .pred-team-name");
          const away = document.querySelector("#pred-away-team .pred-team-name");
          if (home && away) ctx.teams = `${home.textContent} vs ${away.textContent}`;
        } else if (hash.startsWith("#match/")) {
          ctx.matchId = hash.split("/")[1];
        }
        const modal = document.getElementById("match-modal");
        if (modal && !modal.classList.contains("hidden")) {
          const modalMatchId = modal.dataset?.currentMatchId || modal.getAttribute("data-current-match-id");
          if (modalMatchId) ctx.matchId = modalMatchId;
        }
        return ctx;
      }
      function switchGlobalChatMode(mode) {
        if (globalChatState.mode === mode) return;
        globalChatState.mode = mode;
        globalChatState.history = [];
        const btnAsk = document.getElementById("global-chat-mode-ask");
        const btnMsg = document.getElementById("global-chat-mode-message");
        const input = document.getElementById("global-chat-input");
        const container = document.getElementById("global-chat-messages");
        const chips = document.getElementById("global-chat-chips");
        if (!btnAsk || !btnMsg || !input || !container) return;
        if (mode === "ask") {
          btnAsk.style.background = "rgba(255,255,255,.1)";
          btnAsk.style.color = "#f8fafc";
          btnMsg.style.background = "transparent";
          btnMsg.style.color = "rgba(248,250,252,.5)";
          input.placeholder = state.uiLang === "zh" ? "\u8F93\u5165\u4F60\u7684\u95EE\u9898..." : "Type your question...";
          if (chips) chips.style.display = "flex";
          container.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px">
                    <span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.3)">AI Assistant</span>
                    <div style="background:rgba(255,255,255,.06);border-radius:16px 16px 16px 4px;padding:10px 14px;font:400 13px/1.5 'Inter';color:rgba(248,250,252,.7)">${state.uiLang === "zh" ? "\u4F60\u597D\uFF01\u6211\u662F PitchSignal AI \u52A9\u624B\uFF0C\u53EF\u4EE5\u5E2E\u4F60\u5206\u6790\u6BD4\u8D5B\u3001\u9884\u6D4B\u7ED3\u679C\u3001\u4E86\u89E3\u7403\u961F\u5B9E\u529B\u3002\u6709\u4EC0\u4E48\u60F3\u95EE\u7684\uFF1F" : "Hi! I am the PitchSignal AI assistant. How can I help you today?"}</div>
                </div>
            `;
        } else {
          btnMsg.style.background = "rgba(255,255,255,.1)";
          btnMsg.style.color = "#f8fafc";
          btnAsk.style.background = "transparent";
          btnAsk.style.color = "rgba(248,250,252,.5)";
          input.placeholder = state.uiLang === "zh" ? "\u7559\u4E0B\u60A8\u7684\u60F3\u6CD5\u6216\u610F\u89C1..." : "Share your thoughts or feedback...";
          if (chips) chips.style.display = "none";
          container.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px">
                    <span style="font:400 9px/1 'Inter';color:rgba(248,250,252,.3)">AI Assistant</span>
                    <div style="background:rgba(255,255,255,.06);border-radius:16px 16px 16px 4px;padding:10px 14px;font:400 13px/1.5 'Inter';color:rgba(248,250,252,.7)">${state.uiLang === "zh" ? "\u6B22\u8FCE\u7559\u8A00\uFF01\u60A8\u5BF9\u8D5B\u4E8B\u9884\u6D4B\u3001\u6570\u636E\u5C55\u793A\u6216\u4EA7\u54C1\u4F53\u9A8C\u6709\u4EFB\u4F55\u60F3\u6CD5\uFF0C\u90FD\u53EF\u4EE5\u5728\u8FD9\u91CC\u544A\u8BC9\u6211\u4EEC\u3002\u7559\u8A00\u4F1A\u88AB\u6C47\u603B\u4F9B\u56E2\u961F\u53C2\u8003\uFF0C\u4E0D\u4F1A\u6709 AI \u5B9E\u65F6\u56DE\u590D\u3002" : "Welcome! Feel free to leave any thoughts. Messages are collected for the team \u2014 there is no live AI reply here."}</div>
                </div>
            `;
        }
      }
      function syncGlobalChatLanguage() {
        const title = document.getElementById("global-chat-title");
        const btnAsk = document.getElementById("global-chat-mode-ask");
        const btnMsg = document.getElementById("global-chat-mode-message");
        if (title) title.textContent = state.uiLang === "zh" ? "PitchSignal AI" : "PitchSignal AI";
        if (btnAsk) btnAsk.textContent = state.uiLang === "zh" ? "AI \u95EE\u7B54" : "Ask AI";
        if (btnMsg) btnMsg.textContent = state.uiLang === "zh" ? "\u7559\u8A00 / \u610F\u89C1" : "Leave Note";
        const mode = globalChatState.mode;
        globalChatState.mode = null;
        switchGlobalChatMode(mode || "ask");
      }
      window.syncGlobalChatLanguage = syncGlobalChatLanguage;
      async function sendGlobalChatMessage(question) {
        const input = document.getElementById("global-chat-input");
        const sendBtn = document.getElementById("global-chat-send");
        const msg = question || input.value.trim();
        if (!msg) return;
        if (!question) input.value = "";
        input.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        const container = document.getElementById("global-chat-messages");
        _appendChatBubble(container, "user", msg);
        const aiBubble = _appendChatBubble(container, "ai", "");
        aiBubble.style.opacity = "0.5";
        try {
          if (globalChatState.mode === "ask") {
            globalChatState.history.push({ role: "user", content: msg });
            const res = await fetch("/api/bot/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: globalChatState.history, context: getPageContext() })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Request failed");
            aiBubble.style.opacity = "1";
            const answer = data.response || data.answer || "No response";
            await _typewriterEffect(aiBubble, answer, 15);
            globalChatState.history.push({ role: "assistant", content: answer });
          } else {
            const res = await fetch("/api/bot/message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: msg,
                uiLang: state.uiLang,
                pageUrl: window.location.href,
                context: getPageContext()
              })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Request failed");
            aiBubble.style.opacity = "1";
            await _typewriterEffect(aiBubble, data.response || (state.uiLang === "zh" ? "\u611F\u8C22\u60A8\u7684\u7559\u8A00\uFF0C\u6211\u4EEC\u5DF2\u6536\u5230\uFF01" : "Thanks! Your message has been received."), 15);
          }
        } catch (e) {
          aiBubble.style.opacity = "1";
          aiBubble.style.color = "rgba(248,113,113,.7)";
          if (globalChatState.mode === "ask") {
            aiBubble.textContent = "AI \u670D\u52A1\u6682\u65F6\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002\n\nThe AI service could not be reached. Please try again shortly.";
          } else {
            aiBubble.textContent = state.uiLang === "zh" ? "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002" : "Send failed. Please try again later.";
          }
        } finally {
          input.disabled = false;
          if (sendBtn) sendBtn.disabled = false;
          if (!question) input.focus();
        }
      }
      document.getElementById("nav")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tab]");
        if (!btn) return;
        switchTab(btn.dataset.tab);
      });
      document.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;
        const action = target.dataset.action;
        if (action === "set-lang") return window.setLanguage(target.dataset.lang);
        if (action === "refresh-all") return refreshAll();
        if (action === "enable-push") return window.PitchSignalPush?.enable();
        if (action === "close-team-modal") return window.closeTeamModal();
        if (action === "close-modal") return window.closeModal();
        if (action === "open-match") return window.openMatch(target.dataset.matchId);
        if (action === "open-match-from-bracket") return window.openMatch(target.dataset.matchId);
        if (action === "open-pre-match") {
          return window.openPreMatch(
            target.dataset.matchId,
            target.dataset.homeId || "",
            target.dataset.awayId || "",
            target.dataset.homeName || "",
            target.dataset.awayName || "",
            target.dataset.venueName || ""
          );
        }
        if (action === "filter-date") return window.filterDate(target.dataset.date);
        if (action === "open-team-detail") {
          e.stopPropagation();
          return window.openTeamDetail(target.dataset.teamId, target.dataset.teamName || "", target.dataset.group || "");
        }
        if (action === "toggle-pred-detail") return togglePredDetail(target.dataset.target);
        if (action === "open-player-detail") {
          const ds = target.dataset;
          const inline = ds.playerName ? { name: ds.playerName, pos: ds.playerPos, jersey: ds.playerJersey, age: ds.playerAge, height: ds.playerHeight, nationality: ds.playerNationality } : null;
          return window.openPlayerDetail(ds.playerId, inline, ds.teamId);
        }
        if (action === "switch-detail-tab") return window.switchDetailTab(target.dataset.detailTab, target);
        if (action === "switch-standings-tab") return window.switchStandingsSubTab(target.dataset.standingsTab, target);
        if (action === "switch-standings-sub-tab") return window.switchStandingsSubTab(target.dataset.standingsTab, target);
        if (action === "weather-unit") return window.WorldCup.Utils.setWeatherUnit(target.dataset.weatherUnit);
        if (action === "set-pitch-view") return window.setPitchView(target.dataset.view, target);
        if (action === "send-ai-message") {
          return window.sendAIMessage(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId);
        }
        if (action === "ask-ai-preset") {
          return window.askAIPreset(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId, target.dataset.question);
        }
        if (action === "close-global-chat") {
          e.stopPropagation();
          document.getElementById("global-chat-modal")?.classList.add("hidden");
          document.body.style.overflow = "";
          return;
        }
        if (action === "send-global-chat") return sendGlobalChatMessage();
        if (action === "ask-global-preset") {
          const q = target.dataset.question;
          if (q) sendGlobalChatMessage(q);
          return;
        }
        if (action === "switch-ai-mode") return switchGlobalChatMode(target.dataset.mode);
      });
      document.addEventListener("mouseover", (e) => {
        const target = e.target.closest('[data-action="show-player-tip"], [data-player-tip="true"]');
        if (target) {
          const related = e.relatedTarget ? e.relatedTarget.closest('[data-action="show-player-tip"], [data-player-tip="true"]') : null;
          if (related === target) return;
          window.showTipFromDataset(target);
        }
      });
      document.addEventListener("mouseout", (e) => {
        const target = e.target.closest('[data-action="show-player-tip"], [data-player-tip="true"]');
        if (target) {
          const related = e.relatedTarget ? e.relatedTarget.closest('[data-action="show-player-tip"], [data-player-tip="true"]') : null;
          if (related === target) return;
          window.hideTip();
        }
      });
      document.addEventListener("keydown", (e) => {
        const target = e.target.closest("[data-key-action]");
        if (!target || e.key !== "Enter") return;
        if (target.dataset.keyAction === "send-ai-message") {
          window.sendAIMessage(target.dataset.chatId, target.dataset.matchId, target.dataset.homeId, target.dataset.awayId);
        }
      });
      const globalChatInput = document.getElementById("global-chat-input");
      if (globalChatInput) {
        globalChatInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") sendGlobalChatMessage();
        });
      }
      function routeFromHash() {
        const hash = location.hash.slice(1);
        if (hash.startsWith("match/")) {
          const matchId = decodeURIComponent(hash.slice("match/".length));
          if (matchId) window.openMatch(matchId);
          return;
        }
        if (hash && document.getElementById("tab-" + hash)) switchTab(hash);
      }
      window.addEventListener("DOMContentLoaded", () => {
        routeFromHash();
      });
      window.addEventListener("popstate", routeFromHash);
      window.switchTab = switchTab;
      window.togglePredDetail = togglePredDetail;
      window.refreshAll = refreshAll;
      tick();
      setInterval(tick, 1e3);
      window.applyLanguage();
      loadScores().then(() => {
        const liveMatches = window.WorldCup.State._lastScoresMatches || [];
        if (liveMatches.length) {
          const cache = window.WorldCup.State.scheduleCache;
          const existingIds = new Set(cache.map((m) => String(m.id)));
          for (const m of liveMatches) {
            if (!existingIds.has(String(m.id))) cache.push(m);
          }
        }
      });
      const autoRefresh = setInterval(() => {
        if (document.hidden) return;
        loadScores();
      }, 12e4);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && state.tab === "live") loadScores();
      });
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/static/sw.js?v=20260703-push", { updateViaCache: "none" }).then(() => window.PitchSignalPush?.refresh()).catch(() => {
        });
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "OPEN_MATCH" && event.data.matchId) {
            window.openMatch(String(event.data.matchId));
          }
        });
      }
    })();
  }
});

// static/js/_entry.js
var require_entry = __commonJS({
  "static/js/_entry.js"() {
    var import_state = __toESM(require_state());
    var import_i18n = __toESM(require_i18n());
    var import_utils = __toESM(require_utils());
    var import_api_client = __toESM(require_api_client());
    var import_formatters = __toESM(require_formatters());
    var import_match_stats = __toESM(require_match_stats());
    var import_scores = __toESM(require_scores());
    var import_schedule = __toESM(require_schedule());
    var import_standings = __toESM(require_standings());
    var import_match_detail = __toESM(require_match_detail());
    var import_team_detail = __toESM(require_team_detail());
    var import_elo_prediction = __toESM(require_elo_prediction());
    var import_players_tab = __toESM(require_players_tab());
    var import_spatial_matchup = __toESM(require_spatial_matchup());
    var import_ai_chat = __toESM(require_ai_chat());
    var import_coach_comparison = __toESM(require_coach_comparison());
    var import_match_review = __toESM(require_match_review());
    var import_player_detail = __toESM(require_player_detail());
    var import_pre_match = __toESM(require_pre_match());
    var import_odds_card = __toESM(require_odds_card());
    var import_ui_helpers = __toESM(require_ui_helpers());
    var import_match_renderers = __toESM(require_match_renderers());
    var import_push_notifications = __toESM(require_push_notifications());
    var import_app = __toESM(require_app());
  }
});
export default require_entry();
