// ========== i18n.js - Internationalization Module ==========
(function() {
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

    // Get state from WorldCup namespace
    function getState() {
        return window.WorldCup.State;
    }

    function translatePlayerName(name) {
        const state = getState();
        if (!name) return name;
        if (state.uiLang === 'en') return name;
        return ZH_NAMES[name] || name;
    }

    function translateCoachField(val, type) {
        const state = getState();
        if (!val) return val;
        if (state.uiLang === 'zh') {
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
        const state = getState();
        const { I18N } = window.WorldCup;
        return I18N[state.uiLang]?.[key] || I18N.zh[key] || key;
    }

    function displayTeamName(name) {
        const state = getState();
        const raw = String(name || '').trim();
        const bilingual = raw.match(/^([\u3400-\u9fff（）()·\s]+)\s+(.+)$/u);
        if (!bilingual) return raw;
        return state.uiLang === 'en' ? bilingual[2].trim() : bilingual[1].trim();
    }

    function displayMaybeTeamName(name) {
        if (name && typeof name === 'object') {
            const i18n = name.nameI18n || name;
            if (i18n && (i18n.zh || i18n.en)) {
                const state = getState();
                return state.uiLang === 'en' ? (i18n.en || i18n.zh || '') : (i18n.zh || i18n.en || '');
            }
            return displayTeamName(name.name || name.displayName || name.shortName || '');
        }
        return displayTeamName(name);
    }

    function i18nText(value, fallback = '') {
        const state = getState();
        if (value && typeof value === 'object' && (value.zh || value.en)) {
            return state.uiLang === 'en' ? (value.en || value.zh || fallback) : (value.zh || value.en || fallback);
        }
        return value || fallback;
    }

    function displayGroupName(name) {
        const state = getState();
        const group = String(name || '').match(/([A-L])$/)?.[1] || '';
        if (!group) return name || '';
        return state.uiLang === 'en' ? `Group ${group}` : `小组 ${group}`;
    }

    function applyLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        // S2: Update aria-labels on date scroll buttons
        const scrollLeft = document.getElementById('date-scroll-left');
        if (scrollLeft) scrollLeft.setAttribute('aria-label', t('scrollLeft'));
        const scrollRight = document.getElementById('date-scroll-right');
        if (scrollRight) scrollRight.setAttribute('aria-label', t('scrollRight'));
        document.querySelectorAll('.lang-btn').forEach(btn => {
            const state = getState();
            const active = btn.dataset.lang === state.uiLang;
            btn.classList.toggle('bg-white/15', active);
            btn.classList.toggle('text-white', active);
            btn.classList.toggle('text-gray-500', !active);
        });
    }

    function setLanguage(lang) {
        const state = getState();
        const { I18N } = window.WorldCup;
        if (!I18N[lang] || lang === state.uiLang) return;
        state.uiLang = lang;
        localStorage.setItem('worldcup_lang', state.uiLang);
        applyLanguage();
        // Reload current tab content
        if (state.tab === 'live') loadScores();
        if (state.tab === 'schedule') {
            const selectedDate = document.querySelector('.date-btn.tab-on')?.dataset.date;
            if (selectedDate) filterDate(selectedDate);
            else loadSchedule();
        }
        if (state.tab === 'standings') loadStandings();
        if (state.tab === 'teams') {
            state.allTeams = [];
            loadTeams();
        }
        if (state.tab === 'prediction') loadPrediction();
    }

    // Expose to WorldCup namespace
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

    // Also expose globally for backward compatibility
    window.translatePlayerName = translatePlayerName;
    window.t = t;
    window.displayTeamName = displayTeamName;
    window.displayMaybeTeamName = displayMaybeTeamName;
    window.i18nText = i18nText;
    window.displayGroupName = displayGroupName;
    window.applyLanguage = applyLanguage;
    window.setLanguage = setLanguage;
})();