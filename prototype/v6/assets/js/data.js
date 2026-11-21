/* ============================================================
   长夜制作台 V5 · 数据层
   只读演示字典：业务数据、演示身份、角色与权限。
   不引用组件层，不读写页面状态。
   ============================================================ */
window.DB = (function () {
  function seed() {
    var chapters = [
      ["雨夜来客", 3120], ["黑皮账簿", 2870], ["第二页", 3410], ["红围巾", 2980],
      ["铅字房", 3250], ["失踪的插画师", 3060], ["旧城改造", 2710], ["第七个雨夜", 3520],
      ["录音带", 2890], ["天台", 3180], ["空白页", 2650], ["长夜", 3740],
      ["将明", 3310], ["沈知白的书房", 2950], ["城南印刷厂", 3120], ["铜钥匙", 2760],
      ["钟声", 3010], ["被删去的名字", 3260], ["雨停之前", 2840], ["最后一页", 3450],
      ["灯火", 2690], ["天亮", 3080], ["尾声：书店仍在", 2320], ["番外：阿棠的夏天", 2460]
    ];

    var scenes = [
      {
        id: "sc1", no: 1, slug: "雨夜书店", setting: "外景 · 长夜书店 · 夜", pages: "1.2",
        time: "23:12", chars: ["周砚", "黑衣人"], summary: "暴雨封街，书店打烊前，一个没有留下姓名的客人放下了一本黑皮账簿。",
        body: [
          ["action", "雨砸在长夜书店的玻璃上，像有人用指节不停敲门。整条街的灯都灭了，只有书店的橱窗还亮着一盏昏黄的灯。"],
          ["action", "周砚把最后一摞旧书码好，翻过「暂停营业」的木牌。门铃却在此时响了。"],
          ["dialog", "周砚", "打烊了。明天再来。"],
          ["action", "门开了一条缝。没有人，只有一本黑皮账簿，端端正正地放在门槛内侧，封皮上积着雨水。"],
          ["action", "周砚追出去。雨幕里，一个穿深色风衣的背影转过街角，消失得像从未存在。"],
          ["dialog", "周砚", "（低声）谁？"]
        ]
      },
      {
        id: "sc2", no: 2, slug: "第一页", setting: "内景 · 长夜书店 · 夜", pages: "1.8",
        time: "23:20", chars: ["周砚"], summary: "账簿没有署名，第一页只写着一个名字和一个时间：周砚，23:40。",
        body: [
          ["action", "台灯下，账簿的纸比寻常更厚，边缘发黑，像被火燎过又留下。"],
          ["action", "周砚翻开第一页。上面只有两行字：一笔一画，是他自己的字迹。"],
          ["action", "「周砚。今晚 23:40。」"],
          ["dialog", "周砚", "（笑了一声）恶作剧。"],
          ["action", "他合上书，又打开。字还在。墙上的老钟停在 23:21，秒针原地抖动，不肯向前。"],
          ["action", "门外，雨声突然停了。整条街安静得能听见自己的心跳。"]
        ]
      },
      {
        id: "sc3", no: 3, slug: "取伞的人", setting: "内景 · 长夜书店 · 夜", pages: "1.5",
        time: "23:26", chars: ["周砚", "阿棠"], summary: "店员阿棠折返取伞，认出了账簿的封皮，却不肯说在哪里见过。",
        body: [
          ["action", "门铃又响。阿棠浑身湿透地站在门口，怀里抱着一把坏掉的伞。"],
          ["dialog", "阿棠", "老板，伞骨断了。今晚这雨……不太对。"],
          ["action", "她的目光落在柜台上，笑容一点点收起来。"],
          ["dialog", "阿棠", "你从哪儿翻出这本书的？"],
          ["dialog", "周砚", "门口捡的。"],
          ["action", "阿棠伸手想碰，又在半空停住。她的指尖在发抖。"],
          ["dialog", "阿棠", "别翻下一页。"],
          ["dialog", "周砚", "为什么？"],
          ["action", "阿棠没有回答。她抓起柜台后的旧伞，转身冲进雨里，连门都没关。"]
        ]
      },
      {
        id: "sc4", no: 4, slug: "雨巷", setting: "外景 · 旧城巷道 · 夜", pages: "2.1",
        time: "23:33", chars: ["周砚", "陈叙"], summary: "周砚循着背影追进雨巷，撞上正在勘查失踪案的刑警队。",
        body: [
          ["action", "巷道窄得只容一人。雨水沿着两边墙皮往下淌，像两排黑色的瀑布。"],
          ["action", "周砚在拐角停住。前方拉起一道警戒线，红白相间的塑料带在风里抖。"],
          ["dialog", "陈叙", "别过来。这里是现场。"],
          ["action", "说话的人从伞下抬起脸，眼底布满血丝，大衣肩头落满水珠。"],
          ["dialog", "周砚", "你们在找谁？"],
          ["dialog", "陈叙", "一个失踪了三周的人。林晚，插画师。你认识？"],
          ["action", "周砚摇头。可他想起了账簿第二页边缘露出的一角红——像一条围巾。"],
          ["dialog", "陈叙", "这条街今晚不太平。书店老板，早点回去。"],
          ["action", "周砚后退一步，踩进积水。倒影里，警戒线后面似乎站着一个人，正看着他。"],
          ["dialog", "周砚", "……"]
        ]
      },
      {
        id: "sc5", no: 5, slug: "不在场的人", setting: "内景 · 刑警队办公室 · 夜", pages: "1.9",
        time: "23:48", chars: ["周砚", "陈叙"], summary: "陈叙把林晚的速写本摊在桌上。每一页，画的都是长夜书店的橱窗。",
        body: [
          ["action", "审讯室的灯管一闪一闪。陈叙把一本速写本推到周砚面前。"],
          ["action", "翻开的每一页，都是同一扇窗：暖黄灯光、旧木书架、雨里的招牌。"],
          ["dialog", "陈叙", "她画了三十七次你的书店。最后一次，是失踪前一晚。"],
          ["dialog", "周砚", "我不认识她。"],
          ["dialog", "陈叙", "可她认识你。"],
          ["action", "陈叙点了一支烟，又想起这里不能抽，把火按灭在掌心。"],
          ["dialog", "陈叙", "三周前，她给编辑部寄了一卷录音带。里面只有一句话：'别让周砚翻到第二页。'"],
          ["action", "周砚的手指在桌下收紧。墙上的钟，正好走到 23:40。"],
          ["action", "灯灭了。"]
        ]
      },
      {
        id: "sc6", no: 6, slug: "烧不掉的名字", setting: "内景 · 长夜书店 · 深夜", pages: "1.4",
        time: "00:06", chars: ["周砚"], summary: "周砚试图烧掉账簿。火苗熄灭后，纸上的名字变成了林晚。",
        body: [
          ["action", "周砚把账簿丢进铁皮桶，划亮火柴。火苗舔上纸角，却发不出一点声音。"],
          ["action", "火焰在桶里转了一圈，自己熄了。纸页完好，只是第一页的字迹淡了。"],
          ["action", "他伸手去拿。指尖碰到纸张的一刻，第二页自行翻开。"],
          ["action", "「林晚。明晚 23:40。」"],
          ["dialog", "周砚", "（呼吸急促）这本东西……在写谁？"],
          ["action", "窗外，雨又开始下。远处传来一声很轻的钟响，像从水底传来。"]
        ]
      },
      {
        id: "sc7", no: 7, slug: "天台上的红", setting: "外景 · 书店天台 · 夜", pages: "2.0",
        time: "00:20", chars: ["周砚"], summary: "周砚在书店天台找到一条被雨淋透的红围巾，围巾口袋里有一枚铜钥匙。",
        body: [
          ["action", "天台积水没过脚面。城市在雨里只剩下一片模糊的橙色光斑。"],
          ["action", "栏杆上挂着一条红围巾，湿透后颜色深得发黑。"],
          ["action", "周砚把它取下来。围巾口袋里，掉出一枚铜钥匙，齿纹很旧，柄上刻着一个「夜」字。"],
          ["dialog", "周砚", "（轻声）林晚……你来过这里。"],
          ["action", "他抬头。对面楼顶的灯光里，站着一个撑红伞的人影。人影抬起手，指向书店的钟楼。"],
          ["action", "钟楼的大钟，在雨里敲了十二下。每一下，周砚都听见一个名字。"]
        ]
      },
      {
        id: "sc8", no: 8, slug: "第二页", setting: "内景 · 长夜书店 · 黎明", pages: "1.3",
        time: "05:41", chars: ["周砚", "阿棠"], summary: "天快亮时，账簿第一页变成了空白，第二页写着林晚。阿棠说：她今晚会来。",
        body: [
          ["action", "雨停了。天光从云缝里漏下来，照得书店像一张刚洗过的旧照片。"],
          ["action", "账簿摊在柜台上。第一页已经空了，只剩一道像水痕的墨边。"],
          ["action", "第二页：林晚。今晚 23:40。"],
          ["action", "阿棠站在门口，头发还在滴水。她看着那行字，很久没有说话。"],
          ["dialog", "阿棠", "她会来。她每次都来。"],
          ["dialog", "周砚", "你说的'每次'，是什么意思？"],
          ["action", "阿棠把一枚同样的铜钥匙放在柜台上。两枚钥匙，齿纹相对，严丝合缝。"],
          ["dialog", "阿棠", "老板，你这家店，不是第一次开张了。"],
          ["action", "她身后的玻璃上，慢慢映出第三个名字。【本集完】"]
        ]
      }
    ];

    var episodes = [
      ["01", "雨夜书店", "一本没有署名的账簿，写下店主自己的死期。", "第 1–2 章", "locked", 6, "EP01 · 雨夜书店"],
      ["02", "第二页的名字", "林晚在雨夜走进书店，带来三周前就该寄到的录音带。", "第 3–4 章", "draft", 0, "EP02 · 第二页的名字"],
      ["03", "红围巾", "围巾的主人已经失踪，围巾却每晚出现在不同的窗台。", "第 5–6 章", "draft", 0, "EP03 · 红围巾"],
      ["04", "铅字与灰", "旧印刷厂的铅字盘里，藏着书店第一次开张的日期。", "第 7–8 章", "pending", 0, "EP04 · 铅字与灰"],
      ["05", "不在场的人", "所有人的证词都指向同一个不在场的人。", "第 9–10 章", "pending", 0, "EP05 · 不在场的人"],
      ["06", "城南旧事", "沈知白买下整条旧街，也买下了所有人的沉默。", "第 11–12 章", "pending", 0, "EP06 · 城南旧事"],
      ["07", "第七个雨夜", "这一夜，账簿上出现了阿棠的名字。", "第 13–14 章", "pending", 0, "EP07 · 第七个雨夜"],
      ["08", "录音带的背面", "B 面第一句，是周砚自己的声音。", "第 15–16 章", "pending", 0, "EP08 · 录音带的背面"],
      ["09", "天台上的灯", "有人在灯灭的三十秒里，把红围巾挂上栏杆。", "第 17–18 章", "pending", 0, "EP09 · 天台上的灯"],
      ["10", "空白页", "账簿第一次出现空白页，也第一次开始倒计时。", "第 19–20 章", "pending", 0, "EP10 · 空白页"],
      ["11", "长夜", "所有名字回到第一页，包括已经死去的人。", "第 21–22 章", "pending", 0, "EP11 · 长夜"],
      ["12", "将明", "天亮之前，周砚要决定谁被写进最后一页。", "第 23–24 章", "pending", 0, "EP12 · 将明"]
    ].map(function (e) {
      return { no: e[0], title: e[1], hook: e[2], chapters: e[3], status: e[4], scenes: 8, label: e[5], duration: e[0] === "01" ? "1'32\"" : "—", qa: e[0] === "01" ? 94 : null };
    });

    var characters = [
      { id: "ch1", name: "周砚", role: "主角 / 长夜书店店主", age: 32, type: "character", status: "locked", refs: 12, version: "REF v3", desc: "寡言，左眉有一道旧疤。习惯在雨夜开店、天亮前关门，像在等一个不会来的人。", anchor: "深灰风衣 · 左手腕旧表 · 左眉疤 · 总把袖口卷到小臂", voice: "低、慢、几乎不解释", color: "#6f6253", initial: "砚" },
      { id: "ch2", name: "林晚", role: "失踪的插画师", age: 24, type: "character", status: "review", refs: 7, version: "REF v2", desc: "只画同一扇窗的插画师。三周前失踪，留下一条红围巾与一卷录音带。", anchor: "红围巾 · 齐肩黑发 · 右手食指有墨迹 · 米色帆布包", voice: "轻，句尾常带笑", color: "#a35d4d", initial: "晚" },
      { id: "ch3", name: "陈叙", role: "刑警队长", age: 38, type: "character", status: "ready", refs: 9, version: "REF v1", desc: "查林晚失踪案三年，抽屉里全是没寄出去的信。烟戒了很多次。", anchor: "深棕皮夹克 · 胡茬 · 左眼下方痣 · 右手常插口袋", voice: "干、短、审讯式停顿", color: "#4c5763", initial: "叙" },
      { id: "ch4", name: "阿棠", role: "书店店员 / 大二学生", age: 19, type: "character", status: "locked", refs: 11, version: "REF v2", desc: "相信雨夜会发生怪事，也相信老板只是嘴硬。知道得比看起来多。", anchor: "透明雨靴 · 单边耳机 · 橙色发夹 · 总抱一把坏伞", voice: "快、亮、偶尔突然安静", color: "#c08a4e", initial: "棠" },
      { id: "ch5", name: "老秦", role: "房东 / 前印刷厂工人", age: 61, type: "character", status: "ready", refs: 5, version: "REF v1", desc: "把书店租给周家三十年。手抖，点烟要点三次。知道铅字盘里少了哪几个字。", anchor: "灰夹克 · 老花镜 · 右手抖 · 钥匙串挂在腰间", voice: "沙哑、絮叨、关键处停住", color: "#7d7468", initial: "秦" },
      { id: "ch6", name: "沈知白", role: "出版商 / 旧城改造投资人", age: 45, type: "character", status: "draft", refs: 3, version: "REF v0", desc: "买下整条旧街的人。说话永远像在签合同，从不留下把柄。", anchor: "炭灰西装 · 金丝眼镜 · 白手套 · 皮鞋一尘不染", voice: "温和、准确、不带情绪", color: "#44484f", initial: "沈" }
    ];

    var assets = [
      { id: "a1", name: "长夜书店 · 橱窗", type: "scene", status: "locked", version: "REF v4", refs: 14, shots: 12, thumb: "assets/img/still-bookstore.png", desc: "暖黄橱窗、旧木书架、雨痕玻璃。全剧核心场景，夜间主光来自橱窗内 2700K 台灯。", prompt: "旧书店橱窗，雨夜，暖黄台灯，玻璃反光，电影感，9:16", color: "#8a6137", initial: "书" },
      { id: "a2", name: "长夜书店 · 内景", type: "scene", status: "locked", version: "REF v3", refs: 9, shots: 18, thumb: "assets/img/still-bookstore.png", desc: "纵深 6 米，左侧柜台，右侧旧书墙。柜台下有一只铁皮桶，后来被用来烧账簿。", prompt: "旧书店内景，木质书架，暖光，灰尘，浅景深", color: "#6b5237", initial: "内" },
      { id: "a3", name: "雨夜巷道", type: "scene", status: "ready", version: "REF v2", refs: 6, shots: 9, thumb: "assets/img/still-alley.png", desc: "窄巷，两侧旧墙，湿地面反射橙色灯。警戒线出现在第 4 场。", prompt: "雨夜窄巷，湿地面，橙色路灯，青黑色调，电影感", color: "#33514f", initial: "巷" },
      { id: "a4", name: "旧印刷厂", type: "scene", status: "draft", version: "REF v0", refs: 2, shots: 4, desc: "废弃铅字房，灰尘中的光柱，墙上还挂着一九八七年的生产表。", prompt: "废弃印刷厂，铅字盘，灰尘光柱，冷调，电影感", color: "#5c5e52", initial: "印" },
      { id: "a5", name: "刑警队办公室", type: "scene", status: "ready", version: "REF v1", refs: 4, shots: 6, thumb: "assets/img/still-room.png", desc: "审讯室，单侧顶光，桌面有旧划痕。墙上时钟永远慢十一分钟。", prompt: "审讯室，顶光，旧木桌，冷绿墙面，压抑", color: "#4a5550", initial: "警" },
      { id: "a6", name: "书店天台", type: "scene", status: "ready", version: "REF v1", refs: 3, shots: 5, desc: "积水天台，城市橙色光斑，栏杆锈迹。第 7 场红围巾挂在这里。", prompt: "雨夜天台，积水，城市灯光虚化，红围巾，电影感", color: "#4b4438", initial: "台" },
      { id: "a7", name: "黑皮账簿", type: "prop", status: "locked", version: "REF v2", refs: 8, shots: 10, desc: "无署名，纸张厚且边缘焦黑。第一页写名字，第二页写时间。翻页时没有声音。", prompt: "黑色皮革账簿，焦边纸张，手写名字，特写，暖光", color: "#3a322c", initial: "簿" },
      { id: "a8", name: "红围巾", type: "prop", status: "locked", version: "REF v3", refs: 7, shots: 8, desc: "羊毛，湿透后接近黑色。口袋里总有一枚铜钥匙。林晚的角色锚点。", prompt: "红色羊毛围巾，湿透，特写，暗光，电影质感", color: "#93443a", initial: "巾" },
      { id: "a9", name: "铜钥匙", type: "prop", status: "ready", version: "REF v1", refs: 4, shots: 5, desc: "柄上刻「夜」字，齿纹与书店后门旧锁吻合。共有两枚。", prompt: "旧铜钥匙，刻字，微距特写，暖光，浅景深", color: "#8a6b3d", initial: "钥" },
      { id: "a10", name: "铅字盘", type: "prop", status: "draft", version: "REF v0", refs: 2, shots: 3, desc: "缺了「周」「林」「晚」三个铅字。老秦说，是当年排字时掉的。", prompt: "活字印刷铅字盘，缺失字块，灰尘，顶光，微距", color: "#5d5b55", initial: "铅" },
      { id: "a11", name: "录音带", type: "prop", status: "ready", version: "REF v1", refs: 3, shots: 4, desc: "B 面第一句是周砚自己的声音。磁带壳上贴着「给周砚」。", prompt: "老式录音带，手写标签，暖光，复古质感，特写", color: "#77644a", initial: "带" },
      { id: "a12", name: "周砚 · 雨夜装", type: "costume", status: "ready", version: "REF v1", refs: 5, shots: 7, desc: "深灰风衣、卷袖衬衫、旧皮带手表。风衣右肩有常年背书的磨损。", prompt: "深灰风衣，卷袖衬衫，旧手表，雨夜，全身造型", color: "#585b60", initial: "衣" }
    ];

    var shots = [
      ["S0101", "雨夜书店 · 建立", "大远景", "固定", "4.0", "ready", "9:16 · 24mm · 2700K", "整条街熄灯，唯书店橱窗亮着。雨幕压低画面，人物不出现。"],
      ["S0102", "门把手 · 特写", "特写", "缓推", "2.0", "ready", "9:16 · 85mm · 侧逆光", "湿手握住铜把手，门缝里漏出一线暖光。"],
      ["S0103", "账簿落地", "中景", "手持跟", "3.0", "ready", "9:16 · 35mm · 低照度", "黑皮账簿落在门槛内侧，雨水在封皮上聚成一小片。"],
      ["S0104", "翻开第一页", "近景", "俯拍下压", "2.5", "ready", "9:16 · 50mm · 台灯主光", "手指翻页，纸边焦黑。名字出现前有半秒空白。"],
      ["S0105", "名字 · 微距", "大特写", "固定", "1.5", "review", "9:16 · 100mm · 硬光", "「周砚。今晚 23:40。」墨迹像未干。"],
      ["S0106", "阿棠回头", "中近景", "横移", "2.0", "review", "9:16 · 50mm · 门框光", "阿棠在门口回头，发梢滴水，眼神停在柜台上。"],
      ["S0107", "雨巷追踪", "中景", "手持长跟", "4.5", "generating", "9:16 · 28mm · 青橙对比", "周砚追进窄巷，背影在雨里忽明忽暗。"],
      ["S0108", "警戒线", "全景", "缓升", "3.0", "ready", "9:16 · 24mm · 冷调", "红白警戒线在风里抖，刑警的伞沿压住画面。"],
      ["S0109", "审讯 · 对视", "双人中景", "固定", "4.0", "review", "9:16 · 40mm · 单侧顶光", "陈叙把速写本推过来。周砚不接，手指在桌下收紧。"],
      ["S0110", "烧账簿", "近景", "俯拍", "3.5", "todo", "9:16 · 50mm · 火光", "火苗舔纸又自己熄灭，纸页完好无损。"],
      ["S0111", "天台红围巾", "大远景", "缓推", "5.0", "todo", "9:16 · 35mm · 城市散景", "积水天台，红围巾挂在锈栏杆上，像一道伤口。"],
      ["S0112", "黎明书店", "全景", "固定渐亮", "6.0", "todo", "9:16 · 24mm · 黎明冷光", "雨停，天光漏下，书店像一张洗过的旧照片。"]
    ].map(function (s) {
      return { id: s[0], ep: "01", no: s[0].slice(2), title: s[1], size: s[2], move: s[3], duration: s[4], status: s[5], params: s[6], note: s[7] };
    });

    var tasks = [
      { id: "T-2041", name: "画面生成 · EP01 S0107 雨巷追踪", type: "视频生成", model: "mork-video-2", status: "running", progress: 32, cost: 0.86, started: "23:41:08", duration: "1m 12s", target: "EP01 / S0107", logs: [["23:41:08", "任务已创建，冻结 3 项输入版本"], ["23:41:09", "输入校验通过：REF v3 / Contract v2"], ["23:41:22", "提交 mork-video-2 · 1080×1920 · 24fps"], ["23:42:05", "生成中 32% · 预计剩余 2m 18s"], ["23:42:11", "提示：雨幕密度高于 Contract 参考，已自动重采样"]] },
      { id: "T-2040", name: "配音合成 · EP01 对白 19 条", type: "语音合成", model: "mork-tts-cn", status: "queued", progress: 0, cost: 0.21, started: "—", duration: "—", target: "EP01 / 全部对白", logs: [["23:40:55", "任务排队中，等待并发槽位"]] },
      { id: "T-2039", name: "参考图生成 · 林晚 REF v3", type: "图像生成", model: "mork-image-3", status: "failed", progress: 68, cost: 0.42, started: "23:18:30", duration: "48s", target: "资产 / 林晚", logs: [["23:18:30", "任务已创建"], ["23:18:31", "参考图 REF v2 冻结"], ["23:18:44", "生成 4 张候选，进入一致性检查"], ["23:19:18", "检查失败：FACE_DRIFT，3/4 候选与锚点偏差 > 0.18"], ["23:19:18", "任务失败，可调整参考权重后重跑"]], error: "FACE_DRIFT · 角色一致性低于阈值" },
      { id: "T-2038", name: "分镜契约解析 · EP01 12 镜头", type: "文本生成", model: "mork-llm-7b", status: "succeeded", progress: 100, cost: 1.86, started: "22:56:10", duration: "3m 12s", target: "EP01 / Storyboard", logs: [["22:56:10", "任务已创建"], ["22:56:40", "解析 8 场 · 19 条对白"], ["22:58:02", "生成 12 个 Shot Contract 草稿"], ["22:59:22", "校验通过，产物 Artifact #2041"]] },
      { id: "T-2037", name: "剧本结构化 · EP01 8 场", type: "文本生成", model: "mork-llm-7b", status: "succeeded", progress: 100, cost: 0.54, started: "22:31:44", duration: "1m 08s", target: "EP01 / Script v6", logs: [["22:31:44", "任务已创建"], ["22:32:12", "识别场次 8 · 角色 4 · 道具 6"], ["22:32:52", "产物 Script v6 已保存"]] },
      { id: "T-2036", name: "资产一致性检查 · 63 项", type: "质检", model: "qa-rules-2026.11", status: "succeeded", progress: 100, cost: 0.08, started: "21:58:02", duration: "36s", target: "项目 / 资产库", logs: [["21:58:02", "任务已创建"], ["21:58:20", "检查 63 项，2 项警告"], ["21:58:38", "产物 QAReport #118 已生成"]] },
      { id: "T-2035", name: "章节解析 ·《长夜将明》24 章", type: "文本生成", model: "mork-llm-7b", status: "succeeded", progress: 100, cost: 2.24, started: "20:12:00", duration: "4m 40s", target: "导入 / 24 章", logs: [["20:12:00", "任务已创建"], ["20:13:30", "章节切分 24 段"], ["20:16:40", "实体抽取 46 个，待确认 8 个"]] },
      { id: "T-2034", name: "视频生成 · EP01 S0105 名字微距", type: "视频生成", model: "mork-video-2", status: "failed", progress: 91, cost: 0.74, started: "19:40:11", duration: "2m 01s", target: "EP01 / S0105", logs: [["19:40:11", "任务已创建"], ["19:41:02", "生成中 60%"], ["19:42:12", "推理超时，provider 未返回最终帧"], ["19:42:12", "任务失败，可重试"]], error: "PROVIDER_TIMEOUT · 推理超时 300s" }
    ];

    var qaItems = [
      { name: "画面一致性", result: "PASS", score: 96, note: "12 个镜头中 11 个与 Contract 参考一致，S0107 待重生成。" },
      { name: "角色一致性", result: "PASS", score: 91, note: "周砚左眉疤在第 9 场弱化，已标记但不阻断。" },
      { name: "字幕准确率", result: "PASS", score: 98, note: "19 条对白逐字校验，2 处断句建议调整。" },
      { name: "时序与节奏", result: "REVIEW_REQUIRED", score: 88, note: "第 5 场到第 6 场转场偏快，建议延长 0.4s。" },
      { name: "安全与合规", result: "PASS", score: 100, note: "无违规内容、无水印、无第三方素材。" }
    ];

    var comments = [
      { id: "c1", time: "00:42", shot: "S0109", author: "陈默", role: "制作总监", text: "陈叙推速写本的动作太轻，缺少压迫感。建议手部再向前 15cm，镜头可再低 5°。", level: "需修改", resolved: false },
      { id: "c2", time: "01:08", shot: "S0111", author: "苏禾", role: "导演", text: "红围巾在雨里太鲜艳，湿透后应该接近黑色。需要降低饱和度并增加重量感。", level: "需修改", resolved: false },
      { id: "c3", time: "01:22", shot: "S0112", author: "陈默", role: "制作总监", text: "黎明来得太快，观众还没喘口气。结尾空镜可以再留 2 秒。", level: "建议", resolved: true }
    ];

    var tracks = [
      { id: "t1", name: "V2 · 主画面", type: "video", clips: [
        { id: "c1", name: "S0101 雨夜书店", start: 0, dur: 9, source: "S0101" },
        { id: "c2", name: "S0102 门把手", start: 9, dur: 4, source: "S0102" },
        { id: "c3", name: "S0103 账簿落地", start: 13, dur: 7, source: "S0103" },
        { id: "c4", name: "S0104 第一页", start: 20, dur: 8, source: "S0104" },
        { id: "c5", name: "S0109 审讯", start: 28, dur: 14, source: "S0109" },
        { id: "c6", name: "S0111 天台", start: 42, dur: 18, source: "S0111" },
        { id: "c7", name: "S0112 黎明", start: 60, dur: 32, source: "S0112" }
      ]},
      { id: "t2", name: "V1 · 字幕标题", type: "sub", clips: [
        { id: "c8", name: "片名 · 长夜将明", start: 3, dur: 6, source: "TITLE" },
        { id: "c9", name: "字幕 · 第 1–19 条", start: 14, dur: 44, source: "SRT" },
        { id: "c10", name: "片尾 · 下集预告", start: 78, dur: 10, source: "END" }
      ]},
      { id: "t3", name: "A1 · 对白", type: "audio", clips: [
        { id: "c11", name: "对白 · 周砚 01", start: 5, dur: 3, source: "D01" },
        { id: "c12", name: "对白 · 周砚 02", start: 18, dur: 4, source: "D02" },
        { id: "c13", name: "对白 · 阿棠 03", start: 26, dur: 6, source: "D03" },
        { id: "c14", name: "对白 · 陈叙 04", start: 31, dur: 9, source: "D04" },
        { id: "c15", name: "对白 · 周砚 05", start: 54, dur: 5, source: "D05" }
      ]},
      { id: "t4", name: "A2 · 环境 / 音乐", type: "audio", clips: [
        { id: "c16", name: "雨声 · 街道", start: 0, dur: 42, source: "AMB01" },
        { id: "c17", name: "低频 · 账簿", start: 20, dur: 24, source: "MUS01" },
        { id: "c18", name: "雨停 · 环境", start: 60, dur: 32, source: "AMB02" }
      ]}
    ];

    var exports = [
      { id: "EX-0211", target: "EP01 · 雨夜书店", profile: "竖屏 9:16 · 1080×1920 · 24fps", status: "succeeded", size: "78.4 MB", duration: "1'32\"", createdAt: "2026-11-19 18:42", checksum: "9f3c…a71e", ver: "EP01_v5.mp4" },
      { id: "EX-0210", target: "EP01 · 雨夜书店", profile: "字幕文件 · SRT UTF-8", status: "succeeded", size: "8.2 KB", duration: "—", createdAt: "2026-11-19 18:40", checksum: "4b1d…c2f0", ver: "EP01_v5.srt" },
      { id: "EX-0209", target: "EP01 · 雨夜书店", profile: "横屏 16:9 · 1920×1080 · 24fps", status: "failed", size: "—", duration: "—", createdAt: "2026-11-19 17:58", checksum: "—", ver: "EP01_v4_16x9.mp4", error: "FFMPEG_ENCODE_FAILED · 第 42s 音轨缺失" },
      { id: "EX-0208", target: "EP01 · 样片审阅", profile: "审阅版 · 720p · 带水印", status: "succeeded", size: "31.6 MB", duration: "1'32\"", createdAt: "2026-11-19 14:20", checksum: "e88a…90b3", ver: "EP01_review_v4.mp4" }
    ];

    var roles = [
      { id: "r-owner", name: "系统管理员", short: "系统", desc: "私有化部署的最终责任人，拥有系统治理与全部项目授权。", scope: "org", color: "red", system: true, perms: ["*"] },
      { id: "r-admin", name: "组织管理员", short: "组织", desc: "管理组织、用户、角色、Provider、数据外发与审计；项目内容仍按成员授权。", scope: "org", color: "blue", system: true, perms: ["system:read", "system:manage", "org:read", "dept:manage", "member:read", "member:manage", "role:manage", "security:manage", "audit:read", "provider:read", "provider:manage", "usage:read", "usage:manage", "project:read"] },
      { id: "r-manager", name: "项目负责人 / 制片人", short: "制片", desc: "对授权项目负责，管理项目成员、生产进度、预算与交付。", scope: "project", color: "gold", system: false, perms: ["project:read", "project:write", "settings:manage", "story:read", "script:read", "asset:read", "board:read", "task:read", "task:run", "qa:read", "qa:review", "timeline:read", "export:read", "usage:read"] },
      { id: "r-director", name: "导演 / 内容负责人", short: "导演", desc: "负责内容终审与镜头落地，覆盖从剧本到导出的制作链路。", scope: "project", color: "red", system: false, perms: ["project:read", "project:write", "settings:manage", "story:read", "story:write", "script:read", "script:write", "asset:read", "asset:write", "board:read", "board:write", "task:read", "task:run", "qa:read", "qa:review", "timeline:read", "timeline:write", "export:read", "export:run"] },
      { id: "r-writer", name: "编剧 / 策划", short: "编剧", desc: "维护故事、分集与剧本，可引用项目资产但不可改动制作文件。", scope: "project", color: "green", system: false, perms: ["project:read", "story:read", "story:write", "script:read", "script:write", "asset:read", "board:read", "task:read", "qa:read"] },
      { id: "r-art", name: "美术 / 分镜", short: "美术", desc: "维护角色、场景、道具参考与分镜画面，可发起生成任务。", scope: "project", color: "red", system: false, perms: ["project:read", "story:read", "asset:read", "asset:write", "board:read", "board:write", "task:read", "task:run", "qa:read"] },
      { id: "r-editor", name: "视频制作人员", short: "视频", desc: "负责生成任务、时间线、字幕与交付导出。", scope: "project", color: "blue", system: false, perms: ["project:read", "asset:read", "board:read", "task:read", "task:run", "qa:read", "timeline:read", "timeline:write", "export:read", "export:run"] },
      { id: "r-reviewer", name: "审核人员", short: "审核", desc: "执行项目级质检与人工审核，不参与制作写入。", scope: "project", color: "green", system: false, perms: ["project:read", "task:read", "qa:read", "qa:review", "timeline:read", "export:read"] },
      { id: "r-guest", name: "外部审片成员", short: "外部审片", desc: "仅可查看被授权项目的审片页与只读交付记录，不能进入内部制作。", scope: "project", color: "gold", system: false, perms: ["project:read", "qa:read", "timeline:read", "export:read"] }
    ];

    var permissionCatalog = [
      { id: "system", label: "系统治理", desc: "私有化部署的组织、用户、角色、安全与系统设置", items: [
        { key: "system:read", label: "查看系统概览", desc: "查看成员、项目授权、Provider 与治理待办", risk: "low" },
        { key: "system:manage", label: "管理系统设置", desc: "修改部署、存储、保留策略与默认行为", risk: "high" },
        { key: "org:read", label: "查看组织架构", desc: "查看部门、负责人和成员归属", risk: "low" },
        { key: "dept:manage", label: "管理组织架构", desc: "新增部门、调整负责人和汇报关系", risk: "high" },
        { key: "member:read", label: "查看用户与成员", desc: "查看账号、角色、项目成员授权与状态", risk: "low" },
        { key: "member:manage", label: "管理用户与成员", desc: "邀请、停用、移除成员并调整项目授权", risk: "high" },
        { key: "role:manage", label: "管理角色权限", desc: "维护系统 RBAC 权限与数据范围", risk: "high" },
        { key: "security:manage", label: "管理安全与访问", desc: "维护会话、数据外发、上传与媒体安全策略", risk: "high" },
        { key: "audit:read", label: "查看审计日志", desc: "查询、筛选和导出不可变审计记录", risk: "low" }
      ]},
      { id: "provider", label: "Provider 与模型", desc: "外部模型凭据、能力注册、路由与降级边界", items: [
        { key: "provider:read", label: "查看 Provider", desc: "查看 Provider 配置、模型能力与健康状态", risk: "low" },
        { key: "provider:manage", label: "管理 Provider", desc: "新建 Provider、轮换凭据、启停模型与调整路由", risk: "high" }
      ]},
      { id: "usage", label: "用量与预算", desc: "按项目、剧集、镜头、Provider 和模型核算成本", items: [
        { key: "usage:read", label: "查看用量", desc: "查看 token、时长、金额与预算执行", risk: "low" },
        { key: "usage:manage", label: "管理预算", desc: "设置组织与项目预算、阈值和超限动作", risk: "high" }
      ]},
      { id: "project", label: "项目边界", desc: "项目上下文、成员与项目级设置", items: [
        { key: "project:read", label: "查看项目", desc: "进入被授权的项目总览与生产页面", risk: "low" },
        { key: "project:write", label: "管理项目", desc: "创建、归档项目并维护项目成员", risk: "high" },
        { key: "settings:manage", label: "项目设置", desc: "修改项目信息、项目预算与通知", risk: "high" }
      ]},
      { id: "content", label: "内容", desc: "故事设定、分集与剧本", items: [
        { key: "story:read", label: "查看故事圣经", desc: "查看角色、场景、道具与关系", risk: "low" },
        { key: "story:write", label: "编辑故事圣经", desc: "修改设定并导入小说", risk: "medium" },
        { key: "script:read", label: "查看剧本", desc: "查看分集与剧本正文", risk: "low" },
        { key: "script:write", label: "编辑剧本", desc: "编辑、锁版和保存剧本版本", risk: "medium" }
      ]},
      { id: "production", label: "制作", desc: "资产、分镜、任务与质量门禁", items: [
        { key: "asset:read", label: "查看资产", desc: "查看项目内参考图与资产版本", risk: "low" },
        { key: "asset:write", label: "编辑资产", desc: "锁定资产、生成参考图", risk: "medium" },
        { key: "board:read", label: "查看分镜", desc: "查看镜头与 Shot Contract", risk: "low" },
        { key: "board:write", label: "编辑分镜", desc: "调整镜头、候选与送审", risk: "medium" },
        { key: "task:read", label: "查看 AI 任务", desc: "查看队列、Attempt 日志与失败诊断", risk: "low" },
        { key: "task:run", label: "运行 AI 任务", desc: "创建、重试和取消生成任务", risk: "medium" },
        { key: "qa:read", label: "查看质量门禁", desc: "查看 PASS / REVIEW_REQUIRED / FAIL 结果", risk: "low" },
        { key: "qa:review", label: "执行人工审核", desc: "记录 PASS 或 FAIL，不提供 WAIVED 豁免", risk: "high" }
      ]},
      { id: "delivery", label: "交付", desc: "时间线与最终导出", items: [
        { key: "timeline:read", label: "查看时间线", desc: "查看轨道、字幕与版本", risk: "low" },
        { key: "timeline:write", label: "编辑时间线", desc: "调整片段、字幕并保存版本", risk: "medium" },
        { key: "export:read", label: "查看导出记录", desc: "查看规格、历史与下载入口", risk: "low" },
        { key: "export:run", label: "执行导出", desc: "创建成片导出并下载交付物", risk: "high" }
      ]}
    ];

    var members = [
      { id: "u-owner", code: "owner", demo: true, name: "陈默", email: "chenmo@studio.cn", title: "制作总监", deptId: "d-exec", dept: "总经办", roleId: "r-owner", role: "系统管理员", status: "active", presence: "online", last: "刚刚", lastActive: "今天 10:24", joined: "2024-06-18", source: "local", projects: ["nyjm", "whgx", "dlcr", "crgz"], initial: "陈", color: "" },
      { id: "u-admin", code: "admin", demo: true, name: "沈一", email: "shenyi@studio.cn", title: "平台管理员", deptId: "d-exec", dept: "总经办", roleId: "r-admin", role: "组织管理员", status: "active", presence: "online", last: "5 分钟前", lastActive: "今天 10:19", joined: "2024-07-02", source: "local", projects: [], initial: "沈", color: "blue" },
      { id: "u-manager", code: "manager", demo: true, name: "林珊", email: "linshan@studio.cn", title: "商务负责人", deptId: "d-biz", dept: "商务与客户", roleId: "r-manager", role: "项目负责人 / 制片人", status: "active", presence: "online", last: "18 分钟前", lastActive: "今天 10:06", joined: "2024-09-12", source: "local", projects: ["nyjm", "whgx", "dlcr"], initial: "林", color: "gold" },
      { id: "u-director", code: "director", demo: true, name: "苏禾", email: "suhe@studio.cn", title: "导演", deptId: "d-prod", dept: "制作中心", roleId: "r-director", role: "导演", status: "active", presence: "online", last: "3 分钟前", lastActive: "今天 10:21", joined: "2024-06-18", source: "local", projects: ["nyjm", "crgz"], initial: "苏", color: "blue" },
      { id: "u-writer", code: "writer", demo: true, name: "顾青", email: "guqing@studio.cn", title: "编剧", deptId: "d-content", dept: "内容组", roleId: "r-writer", role: "编剧", status: "active", presence: "online", last: "12 分钟前", lastActive: "今天 10:12", joined: "2024-08-05", source: "invite", projects: ["nyjm", "whgx"], initial: "顾", color: "green" },
      { id: "u-art", code: "art", demo: true, name: "白露", email: "bailu@studio.cn", title: "美术指导", deptId: "d-visual", dept: "视觉组", roleId: "r-art", role: "美术指导", status: "active", presence: "offline", last: "昨天 22:14", lastActive: "昨天 22:14", joined: "2024-08-20", source: "local", projects: ["nyjm", "dlcr"], initial: "白", color: "red" },
      { id: "u-editor", code: "editor", demo: true, name: "程野", email: "chengye@studio.cn", title: "剪辑师", deptId: "d-post", dept: "后期组", roleId: "r-editor", role: "剪辑师", status: "active", presence: "online", last: "8 分钟前", lastActive: "今天 10:16", joined: "2024-10-09", source: "invite", projects: ["nyjm", "whgx"], initial: "程", color: "blue" },
      { id: "u-reviewer", code: "reviewer", demo: true, name: "周可", email: "zhouke@studio.cn", title: "审核员", deptId: "d-qa", dept: "质控与合规", roleId: "r-reviewer", role: "审核员", status: "active", presence: "offline", last: "今天 09:02", lastActive: "今天 09:02", joined: "2025-02-17", source: "local", projects: ["nyjm"], initial: "周", color: "green" },
      { id: "u-guest", code: "guest", demo: true, name: "许知", email: "xuzhi@client.com", title: "外部审片嘉宾", deptId: "d-ext", dept: "外部协作", roleId: "r-guest", role: "外部审片成员", status: "active", presence: "online", last: "2 分钟前", lastActive: "今天 10:22", joined: "2026-11-04", source: "invite", projects: ["nyjm"], initial: "许", color: "gold" },
      { id: "m-zhao", code: "", demo: false, name: "赵启明", email: "zhaoqm@studio.cn", title: "编剧", deptId: "d-content", dept: "内容组", roleId: "r-writer", role: "编剧", status: "active", presence: "offline", last: "今天 08:40", lastActive: "今天 08:40", joined: "2025-01-06", source: "invite", projects: ["nyjm"], initial: "赵", color: "green" },
      { id: "m-tang", code: "", demo: false, name: "唐宁", email: "tangning@studio.cn", title: "概念设计", deptId: "d-visual", dept: "视觉组", roleId: "r-art", role: "美术指导", status: "invited", presence: "offline", last: "—", lastActive: "—", joined: "待接受", source: "invite", projects: [], initial: "唐", color: "red" },
      { id: "m-he", code: "", demo: false, name: "何川", email: "hechuan@studio.cn", title: "混音师", deptId: "d-post", dept: "后期组", roleId: "r-editor", role: "剪辑师", status: "active", presence: "offline", last: "昨天 18:20", lastActive: "昨天 18:20", joined: "2024-11-21", source: "local", projects: ["nyjm", "whgx"], initial: "何", color: "blue" },
      { id: "m-luo", code: "", demo: false, name: "罗一", email: "luoyi@studio.cn", title: "客户成功", deptId: "d-biz", dept: "商务与客户", roleId: "r-manager", role: "项目负责人 / 制片人", status: "active", presence: "online", last: "25 分钟前", lastActive: "今天 09:59", joined: "2025-03-03", source: "local", projects: ["nyjm", "whgx"], initial: "罗", color: "gold" },
      { id: "m-fang", code: "", demo: false, name: "方可", email: "fangke@studio.cn", title: "合规专员", deptId: "d-qa", dept: "质控与合规", roleId: "r-reviewer", role: "审核员", status: "active", presence: "offline", last: "昨天 17:36", lastActive: "昨天 17:36", joined: "2025-05-26", source: "local", projects: ["nyjm"], initial: "方", color: "green" },
      { id: "m-han", code: "", demo: false, name: "韩序", email: "hanxu@studio.cn", title: "编剧", deptId: "d-prod", dept: "制作中心", roleId: "r-writer", role: "编剧", status: "suspended", presence: "offline", last: "10 月 28 日", lastActive: "10 月 28 日", joined: "2024-12-02", source: "local", projects: [], initial: "韩", color: "green" }
    ];

    members.forEach(function (m) {
      var role = roles.filter(function (r) { return r.id === m.roleId; })[0] || roles[0];
      m.role = role.name;
      m.accountType = m.roleId === "r-guest" ? "external" : "internal";
      m.source = m.status === "invited" ? "invite" : "local";
    });

    var identities = members.filter(function (m) { return m.demo; }).map(function (m) {
      var role = roles.filter(function (r) { return r.id === m.roleId; })[0] || roles[0];
      return {
        id: m.id, code: m.code, name: m.name, role: role.name, shortRole: role.short,
        roleId: role.id, dept: m.dept, deptId: m.deptId, email: m.email, title: m.title,
        initial: m.initial, color: m.color, perms: role.perms.slice(), scope: role.scope,
        accountType: m.accountType, status: m.status, projectIds: m.projects.slice(),
        tempPerms: []
      };
    });


    var tenants=[
      {id:"tn-prod",code:"PROD",name:"制作中心",orgUnit:"制作中心",owner:"苏禾",ownerId:"u-director",status:"active",memberIds:["u-owner","u-director","u-writer","u-art","u-editor","u-reviewer","u-manager","u-guest","m-zhao","m-tang","m-he","m-luo","m-fang"],projectIds:["nyjm","whgx"],budget:30000,spent:18420,modelPolicy:["mork-llm-7b","mork-image-3","mork-video-2","mork-tts-cn"],createdAt:"2025-01-10",description:"短剧策划、制作、审核与交付核心空间"},
      {id:"tn-lab",code:"LAB",name:"创新实验室",orgUnit:"创新业务部",owner:"白露",ownerId:"u-art",status:"active",memberIds:["u-owner","u-art","u-manager","m-zhao"],projectIds:["dlcr"],budget:12000,spent:3280,modelPolicy:["mork-llm-7b","mork-image-3","mork-video-2"],createdAt:"2025-04-01",description:"新题材、新视觉与 AI 生产流程实验"},
      {id:"tn-brand",code:"BRAND",name:"品牌内容部",orgUnit:"商务与客户",owner:"林珊",ownerId:"u-manager",status:"active",memberIds:["u-owner","u-manager","u-director","m-luo","m-he"],projectIds:["crgz"],budget:8000,spent:1960,modelPolicy:["mork-llm-7b","mork-image-3","mork-video-2","mork-tts-cn"],createdAt:"2025-06-12",description:"品牌定制短剧与商业内容项目"},
      {id:"tn-archive",code:"ARCHIVE",name:"历史项目归档空间",orgUnit:"企业档案室",owner:"沈一",ownerId:"u-admin",status:"archived",memberIds:["u-owner","u-admin"],projectIds:[],budget:0,spent:0,modelPolicy:[],createdAt:"2024-06-18",description:"保留已结束项目资产、版本与审计记录"}
    ];
    var tenantProjectMap={nyjm:"tn-prod",whgx:"tn-prod",dlcr:"tn-lab",crgz:"tn-brand"};
    members.forEach(function(m){m.tenantIds=m.id==="u-owner"||m.id==="u-admin"?["tn-prod","tn-lab","tn-brand","tn-archive"]:(m.projects||[]).map(function(id){return tenantProjectMap[id];}).filter(function(id,i,a){return id&&a.indexOf(id)===i;});if(m.id==="m-tang")m.tenantIds=["tn-prod"];});
    identities.forEach(function(u){var m=members.filter(function(x){return x.id===u.id;})[0];u.tenantIds=m?m.tenantIds.slice():[];});

    var departments = [
      { id: "d-root", name: "长夜影视", parent: null, leadId: "u-owner", lead: "陈默", type: "root", desc: "企业根组织" },
      { id: "d-exec", name: "总经办", parent: "d-root", leadId: "u-owner", lead: "陈默", type: "office", desc: "企业治理与管理员" },
      { id: "d-prod", name: "制作中心", parent: "d-root", leadId: "u-director", lead: "苏禾", type: "production", desc: "短剧制作与交付" },
      { id: "d-content", name: "内容组", parent: "d-prod", leadId: "u-writer", lead: "顾青", type: "content", desc: "故事、分集与剧本" },
      { id: "d-visual", name: "视觉组", parent: "d-prod", leadId: "u-art", lead: "白露", type: "visual", desc: "资产、分镜与画面" },
      { id: "d-post", name: "后期组", parent: "d-prod", leadId: "u-editor", lead: "程野", type: "post", desc: "剪辑、混音与导出" },
      { id: "d-qa", name: "质控与合规", parent: "d-root", leadId: "u-reviewer", lead: "周可", type: "qa", desc: "质检、审计与合规" },
      { id: "d-biz", name: "商务与客户", parent: "d-root", leadId: "u-manager", lead: "林珊", type: "business", desc: "客户、合同与审片" },
      { id: "d-ext", name: "外部协作", parent: "d-root", leadId: "u-guest", lead: "许知", type: "external", desc: "客户与外部审片人" }
    ];

    var workspace = {
      name: "长夜影视", legalName: "长夜影视文化传媒有限公司", emailDomain: "studio.cn",
      deployment: "私有化部署 · 企业内网", region: "中国大陆 · 上海", timezone: "Asia/Shanghai",
      locale: "zh-CN", weekStart: "周一", createdAt: "2024-06-18", updatedAt: "2026-11-19",
      dataRetention: 180, backupRetention: 30, defaultTemplate: "竖屏短剧 · 12 集",
      defaultModel: "mork-video-2", requireProjectApproval: true, allowExternalReviewer: true,
      runtime: {
        compose: "Docker Compose", web: "Nginx + Vue 3", api: "FastAPI · Python 3.12",
        queue: "Redis + Celery", worker: "AI Worker / Media Worker", database: "PostgreSQL 16",
        storage: "私有对象存储 · 本地加密卷", ffmpeg: "FFmpeg 7.1 · 参数数组调用",
        maxUpload: "2 GB", containerUser: "非 root"
      },
      backup: { last: "今天 03:00", lastSize: "42.6 GB", target: "私有备份卷 / backup", retention: 30, restoreDrill: "2026-11-05 · 通过" },
      notifications: [
        { key: "task_failed", label: "任务失败", desc: "立即通知任务创建者与项目负责人", on: true },
        { key: "review", label: "质量门禁待审核", desc: "出现 REVIEW_REQUIRED 时通知项目审核人", on: true },
        { key: "member", label: "成员与授权变更", desc: "邀请、停用或项目成员调整时通知管理员", on: true },
        { key: "budget", label: "预算阈值提醒", desc: "达到 80% 或 100% 时通知系统管理员与项目负责人", on: true },
        { key: "export", label: "导出完成", desc: "交付完成后通知项目成员", on: true }
      ]
    };

    var security = {
      session: { idle: 30, max: 12, refresh: 7, revokeOnSuspend: true, projectRecheck: true },
      access: { rbac: true, projectMembership: true, denyByDefault: true, crossProject: false, lastReview: "2026-11-18" },
      credentials: { algorithm: "AES-256-GCM", storage: "secret_ref", masked: true, rotationDays: 90, lastRotation: "2026-10-28", injectedBy: "部署环境变量 / Secret Manager" },
      dataPolicy: {
        defaultAction: "deny", allowedProviders: ["mork"], allowedRegions: ["中国大陆"],
        requireContract: true, contractReview: "2026-09-01 · Mork 企业服务条款",
        sensitiveClasses: ["剧本原文", "未公开角色设定", "未发布成片"], allowSensitive: false,
        logPayload: false, externalStorage: false, lastReview: "2026-11-12"
      },
      upload: { allowedMime: ["image/*", "video/*", "audio/*", "application/pdf"], maxFile: "2 GB", magicCheck: true, checksum: "SHA-256", antivirus: "ClamAV · 每日更新" },
      media: { ffmpeg: "参数数组调用", resourceLimit: true, tempDir: "私有临时卷", probe: "ffprobe 校验", nonRoot: true }
    };

    var securityChecks = [
      { key: "access", label: "项目访问校验", score: 100, status: "done", detail: "RBAC + 项目成员双层校验，跨项目读取默认拒绝" },
      { key: "credentials", label: "Provider 凭据", score: 92, status: "done", detail: "AES-256-GCM 加密，界面仅展示 secret_ref 掩码" },
      { key: "outbound", label: "数据外发策略", score: 88, status: "active", detail: "默认拒绝；仅 Mork 与中国大陆区域通过合同审查" },
      { key: "session", label: "会话与账号", score: 84, status: "active", detail: "空闲 30 分钟、最长 12 小时，停用即撤销会话" },
      { key: "upload", label: "上传校验", score: 90, status: "done", detail: "MIME + 文件签名 + 大小 + SHA-256 校验" },
      { key: "audit", label: "审计留痕", score: 100, status: "done", detail: "append-only，actor / action / resource / time / request_id" },
      { key: "media", label: "媒体处理", score: 94, status: "done", detail: "FFmpeg 参数数组、资源限制、非 root 容器与私有临时卷" }
    ];

    var providers = [
      {
        id: "mork", key: "mork", name: "Mork Provider Adapter", kind: "默认生产",
        desc: "多模态外部模型适配器，统一文本、图像、视频、语音与音乐能力。",
        baseUrl: "https://mork.internal/v1", secretRef: "secret://provider/mork", secretMasked: "mork_live_••••7f3a",
        secretStatus: "已加密 · 可轮换", secretUpdated: "2026-10-28",
        timeout: 300, rateLimit: "60 req/min", enabled: true, configured: true, health: "healthy",
        lastCheck: "今天 10:20", capabilities: ["文本", "图像", "视频", "语音合成", "语音识别", "音乐"],
        models: 5, contract: "Mork 企业服务条款 · 2026-09-01", region: "中国大陆",
        initial: "M", color: "blue"
      },
      {
        id: "mock", key: "mock", name: "Mock Provider", kind: "CI / 显式演示",
        desc: "仅用于自动化测试和明确标记的演示环境，生产任务不得静默回退。",
        baseUrl: "local://mock/v1", secretRef: "—", secretMasked: "无需凭据",
        secretStatus: "不适用", secretUpdated: "—",
        timeout: 30, rateLimit: "不限", enabled: false, configured: true, health: "restricted",
        lastCheck: "—", capabilities: ["文本", "图像", "视频"],
        models: 3, contract: "仅测试环境", region: "本地",
        initial: "K", color: "gold"
      }
    ];

    var providerRoutes = [
      { cap: "文本", label: "剧本与分镜解析", modelIds: ["mork-llm-7b"], defaultId: "mork-llm-7b" },
      { cap: "图像", label: "角色与场景参考", modelIds: ["mork-image-3"], defaultId: "mork-image-3" },
      { cap: "视频", label: "镜头生成", modelIds: ["mork-video-2"], defaultId: "mork-video-2" },
      { cap: "语音合成", label: "对白与旁白", modelIds: ["mork-tts-cn"], defaultId: "mork-tts-cn" },
      { cap: "语音识别", label: "对白转写", modelIds: ["mork-asr-cn"], defaultId: "mork-asr-cn" },
      { cap: "音乐", label: "配乐与氛围", modelIds: ["mork-music-1"], defaultId: "mork-music-1" }
    ];

    var orgUsage = {
      period: "2026-11-01 — 2026-11-21", budget: 50000, spent: 28640, estimatedMonth: 40800,
      threshold: 80, blockOnExceed: true, lastUpdated: "今天 10:22",
      byProject: [
        { id: "nyjm", tenantId: "tn-prod", name: "长夜将明", episodes: 12, shots: 168, tokens: "2.18M", vendorBilled: 9840, estimated: 10120, budget: 18000, status: "normal" },
        { id: "whgx", tenantId: "tn-prod", name: "雾港来信", episodes: 8, shots: 96, tokens: "1.42M", vendorBilled: 6320, estimated: 6480, budget: 12000, status: "normal" },
        { id: "dlcr", tenantId: "tn-lab", name: "第六次日落", episodes: 6, shots: 72, tokens: "780K", vendorBilled: 3280, estimated: 3360, budget: 9000, status: "normal" },
        { id: "crgz", tenantId: "tn-brand", name: "春日故障", episodes: 4, shots: 41, tokens: "460K", vendorBilled: 1960, estimated: 2040, budget: 5000, status: "normal" }
      ],
      byModel: [
        { model: "mork-video-2", provider: "Mork", cap: "视频", calls: 214, units: "1,284 秒", estimated: 11040, share: 39 },
        { model: "mork-image-3", provider: "Mork", cap: "图像", calls: 386, units: "386 张", estimated: 5740, share: 20 },
        { model: "mork-llm-7b", provider: "Mork", cap: "文本", calls: 642, units: "3.26M token", estimated: 6820, share: 24 },
        { model: "mork-tts-cn", provider: "Mork", cap: "语音合成", calls: 188, units: "42K 字", estimated: 3120, share: 11 },
        { model: "mork-asr-cn", provider: "Mork", cap: "语音识别", calls: 64, units: "186 分钟", estimated: 1920, share: 7 }
      ],
      byDept: [
        { name: "制作中心", estimated: 12640, share: 44 },
        { name: "视觉组", estimated: 8240, share: 29 },
        { name: "后期组", estimated: 5160, share: 18 },
        { name: "内容组", estimated: 2600, share: 9 }
      ],
      byUser: [
        { name: "白露", role: "美术 / 分镜", estimated: 6180 },
        { name: "苏禾", role: "导演 / 内容负责人", estimated: 5420 },
        { name: "程野", role: "视频制作人员", estimated: 4860 },
        { name: "顾青", role: "编剧 / 策划", estimated: 2140 }
      ],
      alerts: [
        { level: "warning", text: "《春日故障》项目已用 68%，接近 80% 预警阈值。", at: "今天 09:40" },
        { level: "info", text: "10-28 轮换 Mork 凭据后未产生失败调用。", at: "昨天 18:20" }
      ]
    };

    var accessRequests = [
      { id: "R-1048", type: "project", requesterId: "m-tang", requester: "唐宁", title: "申请加入《长夜将明》视觉组", target: "项目访问 · 视觉组", reason: "客户预审 EP01–EP03，需要查看分镜与资产参考。", risk: "low", status: "pending", createdAt: "今天 10:12", approver: "" },
      { id: "R-1047", type: "permission", requesterId: "m-zhao", requester: "赵启明", title: "申请临时导出权限", target: "export:run · 24 小时", reason: "今晚需要向平台方提交 EP03 样片，正式导出由程野复核。", risk: "medium", status: "pending", createdAt: "今天 09:36", approver: "" },
      { id: "R-1046", type: "download", requesterId: "u-guest", requester: "许知", title: "申请下载审阅版", target: "EX-0211 · 720p 带水印", reason: "客户内部确认会需要离线播放。", risk: "low", status: "approved", createdAt: "昨天 18:50", approver: "陈默" }
    ];

    var audit = [
      { id: "A-1042", time: "今天 10:24", actor: "陈默", actorId: "u-owner", category: "成员", action: "邀请成员", target: "周可 · 审核人员", detail: "通过企业邮箱邀请周可加入质控与合规，并授予《长夜将明》项目成员授权。", ip: "203.0.113.42", result: "success", severity: "normal", deptId: "d-qa", projectId: "nyjm" },
      { id: "A-1041", time: "今天 10:18", actor: "沈一", actorId: "u-admin", category: "Provider", action: "校验 Mork Provider", target: "mork · 5 个模型", detail: "测试连接通过，base_url、timeout 与 rate_limit 均符合配置，未触发数据外发拒绝。", ip: "203.0.113.56", result: "success", severity: "normal", deptId: "d-exec", projectId: null },
      { id: "A-1040", time: "今天 09:58", actor: "林珊", actorId: "u-manager", category: "项目", action: "提交交付审批", target: "《雾港来信》EP08", detail: "客户审片通过，提交商务与制作联合交付审批。", ip: "198.51.100.18", result: "success", severity: "normal", deptId: "d-biz", projectId: "whgx" },
      { id: "A-1039", time: "今天 09:42", actor: "系统", actorId: "system", category: "Provider", action: "模型能力健康检查", target: "5 个 Mork 模型", detail: "文本、图像、视频、TTS、ASR 能力均返回可用；Mock 仍保持禁用，未发生生产回退。", ip: "10.0.4.12", result: "success", severity: "normal", deptId: "d-exec", projectId: null },
      { id: "A-1038", time: "今天 09:21", actor: "周可", actorId: "u-reviewer", category: "审核", action: "记录 EP01 质量门禁结果", target: "EP01 · 雨夜书店", detail: "人工复核结论 REVIEW_REQUIRED → PASS；4 项 PASS、1 项复核后 PASS，允许进入时间线与导出。", ip: "203.0.113.72", result: "success", severity: "normal", deptId: "d-qa", projectId: "nyjm" },
      { id: "A-1037", time: "今天 09:02", actor: "顾青", actorId: "u-writer", category: "剧本", action: "提交剧本版本", target: "EP03 · v2", detail: "提交 4 场修改，等待导演锁版。", ip: "203.0.113.33", result: "success", severity: "normal", deptId: "d-content", projectId: "nyjm" },
      { id: "A-1036", time: "今天 08:48", actor: "沈一", actorId: "u-admin", category: "角色", action: "调整成员角色", target: "赵启明 · 编剧", detail: "由「外部审片成员」调整为「编剧」，项目范围同步为《长夜将明》。", ip: "203.0.113.56", result: "success", severity: "normal", deptId: "d-content", projectId: "nyjm" },
      { id: "A-1035", time: "昨天 22:14", actor: "白露", actorId: "u-art", category: "资产", action: "更新参考图", target: "林晚 · REF v3", detail: "上传 4 张候选并提交一致性检查。", ip: "198.51.100.18", result: "success", severity: "normal", deptId: "d-visual", projectId: "nyjm" },
      { id: "A-1034", time: "昨天 20:40", actor: "程野", actorId: "u-editor", category: "导出", action: "创建导出任务", target: "EX-0211 · 竖屏", detail: "EP01 竖屏 1080×1920 导出，使用 TL v4 与 QA #118。", ip: "198.51.100.18", result: "success", severity: "normal", deptId: "d-post", projectId: "nyjm" },
      { id: "A-1033", time: "昨天 19:58", actor: "系统", actorId: "system", category: "导出", action: "导出任务失败", target: "EX-0209 · 16:9", detail: "FFMPEG_ENCODE_FAILED，第 42s 音轨缺失，已保留诊断日志。", ip: "10.0.4.12", result: "failed", severity: "warning", deptId: "d-post", projectId: "nyjm" },
      { id: "A-1032", time: "昨天 18:32", actor: "陈默", actorId: "u-owner", category: "Provider", action: "轮换 Provider 凭据", target: "mork · secret://provider/mork", detail: "旧凭据立即失效，新凭据由部署环境注入；界面只保留掩码引用。", ip: "203.0.113.42", result: "success", severity: "high", deptId: "d-exec", projectId: null },
      { id: "A-1031", time: "昨天 17:20", actor: "沈一", actorId: "u-admin", category: "成员", action: "停用成员", target: "韩序 · 编剧 / 策划", detail: "账号转入 deactivated，撤销现有会话并移除全部项目访问；历史审计保留。", ip: "203.0.113.56", result: "success", severity: "warning", deptId: "d-prod", projectId: null },
      { id: "A-1030", time: "昨天 16:04", actor: "林珊", actorId: "u-manager", category: "项目", action: "授权外部审片成员", target: "许知 · 外部审片成员", detail: "仅授予《长夜将明》审片与导出只读权限；未授予内部制作页访问。", ip: "198.51.100.18", result: "success", severity: "normal", deptId: "d-biz", projectId: "nyjm" },
      { id: "A-1029", time: "昨天 15:12", actor: "陈默", actorId: "u-owner", category: "用量", action: "调整组织预算", target: "2026-11 · ¥50,000", detail: "预警阈值 80%，达到 100% 时阻止新生成任务，不提供静默超额。", ip: "203.0.113.42", result: "success", severity: "normal", deptId: "d-exec", projectId: null },
      { id: "A-1028", time: "昨天 14:30", actor: "系统", actorId: "system", category: "安全", action: "阻断异常会话", target: "未知设备 · 境外 IP", detail: "来源不在企业网络基线，且缺少有效会话签名；连续失败后阻断并撤销会话。", ip: "203.0.113.201", result: "blocked", severity: "critical", deptId: "d-exec", projectId: null },
      { id: "A-1027", time: "昨天 11:20", actor: "陈默", actorId: "u-owner", category: "系统", action: "修改数据保留周期", target: "180 天", detail: "审计与导出记录保留 180 天，到期归档；资产不在归档范围内。", ip: "203.0.113.42", result: "success", severity: "normal", deptId: "d-exec", projectId: null },
      { id: "A-1026", time: "昨天 10:05", actor: "周可", actorId: "u-reviewer", category: "审计", action: "导出审计包", target: "2026-11 · 质控", detail: "导出 28 条质检与审核记录，用于客户合规审查。", ip: "203.0.113.72", result: "success", severity: "normal", deptId: "d-qa", projectId: "nyjm" },
      { id: "A-1025", time: "前天 18:22", actor: "沈一", actorId: "u-admin", category: "安全", action: "重置管理员密码", target: "系统管理员 · 陈默", detail: "由管理员发起密码重置，旧会话全部失效，新密码通过一次性链接设置。", ip: "203.0.113.56", result: "success", severity: "warning", deptId: "d-exec", projectId: null },
      { id: "A-1024", time: "前天 16:40", actor: "顾青", actorId: "u-writer", category: "剧本", action: "锁定剧本版本", target: "EP01 · v6", detail: "导演确认后锁版，后续修改需新建版本。", ip: "203.0.113.33", result: "success", severity: "normal", deptId: "d-content", projectId: "nyjm" },
      { id: "A-1023", time: "前天 09:15", actor: "系统", actorId: "system", category: "安全", action: "拒绝停用账号登录", target: "韩序 · deactivated", detail: "停用账号尝试登录，认证层返回 account_disabled；未创建任何会话。", ip: "203.0.113.88", result: "blocked", severity: "critical", deptId: "d-prod", projectId: null }
    ];

    audit.forEach(function (a, i) {
      a.requestId = a.requestId || ("req_20261121_" + String(i + 1).padStart(4, "0"));
      a.resource = a.resource || (a.projectId ? "project:" + a.projectId : "workspace:changye");
    });

    /* ================= V5 增补：专职 Agent ================= */
    var agents = [
      { id: "ag-rewrite", name: "剧本改写 Agent", icon: "feather", cap: "文本生成", model: "mork-llm-7b", status: "ready", owner: "内容组", desc: "按分集钩子与人物声线改写拍摄剧本，保留场景动作与对白节奏；产出为草稿，需编剧确认后锁版。", inputs: ["锁版剧本", "人物设定"], outputs: ["分集剧本 v2"], runs: 18, lastRun: "今天 09:12", enabled: true },
      { id: "ag-entity", name: "实体提取 Agent", icon: "image", cap: "文本生成", model: "mork-llm-7b", status: "ready", owner: "视觉组", desc: "从剧本抽取角色 / 场景 / 道具 / 服装候选，建议合并与复用；候选不直接写入资产库。", inputs: ["剧本章节"], outputs: ["实体候选清单"], runs: 46, lastRun: "昨天 22:56", enabled: true },
      { id: "ag-board", name: "分镜拆解 Agent", icon: "activity", cap: "文本生成", model: "mork-llm-7b", status: "ready", owner: "视觉组", desc: "按场次拆镜，生成景别、运镜、时长、镜头参数与画面提示词；@角色自动映射参考图。", inputs: ["剧本", "资产锚点"], outputs: ["Shot Contract 草稿"], runs: 12, lastRun: "昨天 22:56", enabled: true },
      { id: "ag-prompt", name: "提示词生成 Agent", icon: "spark", cap: "文本生成", model: "mork-llm-7b", status: "draft", owner: "视觉组", desc: "为图 / 视频生成整理提示词与负向约束，套用项目风格快照；输出前需人工确认。", inputs: ["镜头合同", "风格快照"], outputs: ["生成提示词"], runs: 0, lastRun: "—", enabled: false }
    ];

    var skills = [
      { id: "sk-1", name: "雨夜写实 · 场景定调", kind: "风格快照", scope: "项目", model: "mork-image-3", use: 14, updated: "昨天 21:40", desc: "2700K 暖光 + 青黑雨夜，浅景深，9:16 电影感。" },
      { id: "sk-2", name: "人物近景 · 面部一致性", kind: "提示词模板", scope: "项目", model: "mork-image-3", use: 9, updated: "昨天 22:14", desc: "锚点特征前置，参考图权重 0.7，保持眉疤、红围巾等识别点。" },
      { id: "sk-3", name: "对白配音 · 角色声线", kind: "提示词模板", scope: "项目", model: "mork-tts-cn", use: 23, updated: "今天 08:30", desc: "低慢克制的男声；句尾不解释，停顿按剧本标点。" },
      { id: "sk-4", name: "悬疑转场 · 镜头衔接", kind: "提示词模板", scope: "个人", model: "mork-video-2", use: 6, updated: "11-18", desc: "前一镜末帧作首帧，动作方向一致，转场 0.4s。" }
    ];

    /* ================= V5 增补：配音台 ================= */
    var voices = [
      { id: "v-zhou", name: "周砚 · 低沉男声", roleId: "ch1", lang: "中文", tone: "低、慢、克制", sample: "0:12", status: "bound", clip: "D01 / D02 / D05", ref: "本地音色 · 未克隆外部样本" },
      { id: "v-lin", name: "林晚 · 轻软女声", roleId: "ch2", lang: "中文", tone: "轻，句尾带笑", sample: "0:09", status: "ready", clip: "待绑定", ref: "标准女声音色 · 可上传参考音频" },
      { id: "v-chen", name: "陈叙 · 干短男声", roleId: "ch3", lang: "中文", tone: "干、短、审讯式停顿", sample: "0:11", status: "bound", clip: "D04", ref: "本地音色" },
      { id: "v-tang", name: "阿棠 · 清亮女声", roleId: "ch4", lang: "中文", tone: "快、亮、偶尔安静", sample: "0:10", status: "bound", clip: "D03", ref: "本地音色" },
      { id: "v-narr", name: "旁白 · 中性叙述", roleId: null, lang: "中文", tone: "平稳、留白", sample: "0:14", status: "ready", clip: "预告 / 片尾", ref: "标准叙述音色" }
    ];

    var dubbingLines = [
      { id: "D01", shot: "S0102", role: "周砚", roleId: "ch1", line: "（雨声里）门没锁。", dur: "3.0s", voice: "v-zhou", status: "done", lip: "matched" },
      { id: "D02", shot: "S0103", role: "周砚", roleId: "ch1", line: "这账簿……谁放在这儿的。", dur: "4.2s", voice: "v-zhou", status: "done", lip: "matched" },
      { id: "D03", shot: "S0106", role: "阿棠", roleId: "ch4", line: "老板，你这家店，不是第一次开张了。", dur: "5.6s", voice: "v-tang", status: "review", lip: "pending" },
      { id: "D04", shot: "S0109", role: "陈叙", roleId: "ch3", line: "林晚失踪三年。你认得她。", dur: "6.8s", voice: "v-chen", status: "review", lip: "pending" },
      { id: "D05", shot: "S0110", role: "周砚", roleId: "ch1", line: "我不认识她。", dur: "2.4s", voice: "v-zhou", status: "todo", lip: "none" },
      { id: "D06", shot: "S0107", role: "旁白", roleId: null, line: "雨巷里，脚步声一直跟着他。", dur: "4.5s", voice: "v-narr", status: "todo", lip: "none" }
    ];

    /* ================= V5 增补：分镜画布 ================= */
    var canvasNodes = [
      { id: "n-ch1", type: "character", label: "周砚", sub: "REF v3 · 已锁定", x: 6, y: 28, status: "locked" },
      { id: "n-ch2", type: "character", label: "林晚", sub: "REF v2 · 待确认", x: 6, y: 64, status: "review" },
      { id: "n-a1", type: "scene", label: "长夜书店", sub: "REF v4 · 核心场景", x: 33, y: 14, status: "locked" },
      { id: "n-a3", type: "scene", label: "雨夜巷道", sub: "REF v2", x: 33, y: 68, status: "ready" },
      { id: "n-a7", type: "prop", label: "黑皮账簿", sub: "REF v2", x: 59, y: 41, status: "locked" },
      { id: "n-s101", type: "shot", label: "S0101 建立镜头", sub: "大远景 · 4.0s", x: 82, y: 12, status: "ready" },
      { id: "n-s107", type: "shot", label: "S0107 雨巷追踪", sub: "生成中 32%", x: 82, y: 43, status: "generating" },
      { id: "n-s109", type: "shot", label: "S0109 审讯对视", sub: "待确认", x: 82, y: 74, status: "review" }
    ];
    var canvasEdges = [
      { from: "n-ch1", to: "n-a1" }, { from: "n-ch1", to: "n-s107" }, { from: "n-ch2", to: "n-a1" },
      { from: "n-a1", to: "n-s101" }, { from: "n-a3", to: "n-s107" }, { from: "n-a7", to: "n-s101" },
      { from: "n-ch1", to: "n-s109" }, { from: "n-a3", to: "n-s109" }
    ];

    /* ================= V5 增补：成片预览中心 ================= */
    var previews = [
      { id: "pv-01", ep: "01", title: "雨夜书店", version: "粗剪 v4", duration: "1'32\"", cover: "assets/img/still-bookstore.png", qa: 94, status: "review", conclusion: "REVIEW_REQUIRED", comments: 3, favorited: true, updated: "今天 00:02", shots: 12 },
      { id: "pv-02", ep: "01", title: "雨夜书店 · 审阅版", version: "review_v4", duration: "1'32\"", cover: "assets/img/still-room.png", qa: null, status: "done", conclusion: "已通过", comments: 0, favorited: false, updated: "11-19 14:20", shots: 12 },
      { id: "pv-03", ep: "02", title: "第二页的名字", version: "草稿 v1", duration: "—", cover: "assets/img/still-alley.png", qa: null, status: "draft", conclusion: "未送审", comments: 0, favorited: false, updated: "昨天 19:40", shots: 0 }
    ];

    /* ================= V5 增补：独立生成台 ================= */
    var playground = [
      { id: "pg-01", kind: "image", model: "mork-image-3", prompt: "旧书店橱窗，雨夜，暖黄台灯，9:16 电影感", at: "今天 10:08", status: "succeeded", saved: false, ref: "2 张候选" },
      { id: "pg-02", kind: "video", model: "mork-video-2", prompt: "雨巷背影，手持跟拍，青橙对比，5s", at: "今天 09:52", status: "succeeded", saved: true, ref: "1 条 · 已收入资产库" },
      { id: "pg-03", kind: "tts", model: "mork-tts-cn", prompt: "低慢克制男声试音 15 秒", at: "昨天 18:22", status: "failed", saved: false, ref: "音色参数超限" },
      { id: "pg-04", kind: "image", model: "mork-image-3", prompt: "红围巾湿透特写，暗光，微距", at: "昨天 16:40", status: "succeeded", saved: true, ref: "4 张候选" }
    ];

    return {
      version: 2,
      storyVersion: "v5",
      scriptVersion: "v6",
      scriptLocked: true,
      currentUserId: "u-owner",
      currentTenantId: "tn-prod",
      tenants: tenants,
      tenantGrants: [{id:"TG-1001",subject:"沈一",tenants:["制作中心","创新实验室","品牌内容部"],permission:"跨租户汇总查看",purpose:"企业月度经营分析",expires:"2026-12-31",status:"active"}],
      workspace: workspace,
      departments: departments,
      project: {
        id: "nyjm", name: "长夜将明", code: "NYJM-26", genre: "悬疑 / 都市 / 温情", episodes: 12, ratio: "9:16", fps: 30,
        tagline: "一间只在雨夜营业的旧书店，一本提前写好名字的账簿。",
        synopsis: "周砚在暴雨夜收到一本没有署名的黑皮账簿，第一页写着他自己的名字和死期。十二个夜晚，十二个名字，他必须在天亮之前决定：谁被写进最后一页。",
        stage: "资产与分镜", progress: 42, due: "2026-12-12", budget: 12000, spend: 6842,
        owner: "陈默", ownerId: "u-owner", members: 9, visibility: "private", departmentId: "d-prod",
        memberIds: ["u-owner", "u-director", "u-writer", "u-art", "u-editor", "u-reviewer", "u-manager", "u-guest", "m-zhao"],
        updated: "今天 00:12"
      },
      projects: [
        { id: "nyjm", name: "长夜将明", code: "NYJM-26", genre: "悬疑", episodes: 12, ratio: "9:16", progress: 42, stage: "资产与分镜", status: "制作中", updated: "今天 00:12", tweaks: "current", ownerId: "u-owner", memberIds: ["u-owner", "u-director", "u-writer", "u-art", "u-editor", "u-reviewer", "u-manager", "u-guest", "m-zhao"] },
        { id: "whgx", name: "雾港来信", code: "WHGX-11", genre: "都市情感", episodes: 8, ratio: "9:16", progress: 76, stage: "配音与字幕", status: "制作中", updated: "昨天 19:40", ownerId: "u-manager", memberIds: ["u-owner", "u-manager", "u-writer", "u-editor", "m-he", "m-luo"] },
        { id: "dlcr", name: "第六次日落", code: "DLCR-08", genre: "科幻", episodes: 6, ratio: "16:9", progress: 18, stage: "剧本与分集", status: "制作中", updated: "昨天 11:02", ownerId: "u-art", memberIds: ["u-owner", "u-art", "u-manager", "m-zhao"] },
        { id: "crgz", name: "春日故障", code: "CRGZ-03", genre: "轻喜剧", episodes: 10, ratio: "9:16", progress: 100, stage: "已交付", status: "已归档", updated: "11-08", ownerId: "u-owner", memberIds: ["u-owner", "u-director"] }
      ],
      pipeline: { story: "done", episodes: "done", assets: "active", board: "active", generate: "todo", qa: "todo", timeline: "locked", export: "locked" },
      chapters: chapters.map(function (c, i) {
        return { no: String(i + 1).padStart(2, "0"), title: c[0], words: c[1], range: "第 " + (i + 1) + " 章", status: i < 3 ? "parsed" : "pending", ep: i < 24 ? String(Math.min(12, Math.floor(i / 2) + 1)).padStart(2, "0") : "" };
      }),
      entities: [
        { name: "周砚", type: "人物", mentions: 218, status: "confirmed", note: "主角 · 书店店主" },
        { name: "林晚", type: "人物", mentions: 164, status: "confirmed", note: "失踪插画师" },
        { name: "陈叙", type: "人物", mentions: 132, status: "confirmed", note: "刑警队长" },
        { name: "阿棠", type: "人物", mentions: 88, status: "confirmed", note: "书店店员" },
        { name: "老秦", type: "人物", mentions: 96, status: "confirmed", note: "房东" },
        { name: "沈知白", type: "人物", mentions: 54, status: "pending", note: "出版商，疑似待合并" },
        { name: "长夜书店", type: "地点", mentions: 121, status: "confirmed", note: "核心场景" },
        { name: "旧印刷厂", type: "地点", mentions: 63, status: "confirmed", note: "前史场景" },
        { name: "天台", type: "地点", mentions: 41, status: "pending", note: "第 7、9 集" },
        { name: "黑皮账簿", type: "道具", mentions: 77, status: "confirmed", note: "核心悬念物" },
        { name: "红围巾", type: "道具", mentions: 45, status: "confirmed", note: "林晚锚点" },
        { name: "铅字盘", type: "道具", mentions: 22, status: "pending", note: "第 15 章出现" }
      ],
      episodes: episodes,
      scenes: scenes,
      characters: characters,
      assets: assets,
      relations: [
        { from: "周砚", to: "林晚", label: "陌生 / 被画了 37 次", type: "mystery" },
        { from: "周砚", to: "阿棠", label: "店主 / 店员", type: "warm" },
        { from: "周砚", to: "老秦", label: "租客 / 房东", type: "warm" },
        { from: "陈叙", to: "林晚", label: "调查 / 未结案", type: "mystery" },
        { from: "陈叙", to: "周砚", label: "询问 / 怀疑", type: "conflict" },
        { from: "沈知白", to: "老秦", label: "收购 / 施压", type: "conflict" },
        { from: "沈知白", to: "长夜书店", label: "旧城改造目标", type: "conflict" }
      ],
      shots: shots,
      tasks: tasks,
      qa: { ep: "01", score: 94, status: "review", checkedAt: "今天 00:02", rule: "qa-rules-2026.11", items: qaItems, comments: comments, reviewer: "周可", reviewerNote: "" },
      timeline: { ep: "01", version: "TL v4", name: "EP01 · 雨夜书店 · 粗剪", duration: 92, fps: 30, tracks: tracks, approved: false },
      exports: exports,
      members: members,
      roles: roles,
      permissionCatalog: permissionCatalog,
      identities: identities,
      security: security,
      securityChecks: securityChecks,
      providers: providers,
      providerRoutes: providerRoutes,
      accessRequests: accessRequests,
      orgUsage: orgUsage,
      audit: audit,
      models: [
        { id: "mork-llm-7b", providerId: "mork", provider: "Mork", name: "mork-llm-7b", modelId: "mork-llm-7b", cap: "文本生成", capabilities: ["text", "json"], version: "2026.11", status: "已连接", enabled: true, latency: "1.8s", cost: "¥0.006 / 千字", timeout: 120, priority: 1, updated: "2026-11-18", def: true },
        { id: "mork-image-3", providerId: "mork", provider: "Mork", name: "mork-image-3", modelId: "mork-image-3", cap: "图像生成", capabilities: ["image"], version: "2026.10", status: "已连接", enabled: true, latency: "12s", cost: "¥0.08 / 张", timeout: 180, priority: 1, updated: "2026-11-12", def: true },
        { id: "mork-video-2", providerId: "mork", provider: "Mork", name: "mork-video-2", modelId: "mork-video-2", cap: "视频生成", capabilities: ["video"], version: "2026.11", status: "已连接", enabled: true, latency: "2m 40s", cost: "¥0.86 / 5s", timeout: 300, priority: 1, updated: "2026-11-18", def: true },
        { id: "mork-tts-cn", providerId: "mork", provider: "Mork", name: "mork-tts-cn", modelId: "mork-tts-cn", cap: "语音合成", capabilities: ["tts"], version: "2026.09", status: "已连接", enabled: true, latency: "0.6s", cost: "¥0.01 / 百字", timeout: 60, priority: 1, updated: "2026-10-09", def: true },
        { id: "mork-asr-cn", providerId: "mork", provider: "Mork", name: "mork-asr-cn", modelId: "mork-asr-cn", cap: "语音识别", capabilities: ["asr"], version: "2026.09", status: "已连接", enabled: true, latency: "3.2s", cost: "¥0.02 / 分钟", timeout: 120, priority: 1, updated: "2026-10-09", def: true },
        { id: "mork-music-1", providerId: "mork", provider: "Mork", name: "mork-music-1", modelId: "mork-music-1", cap: "音乐生成", capabilities: ["music"], version: "2026.08", status: "已连接", enabled: true, latency: "18s", cost: "¥0.12 / 段", timeout: 180, priority: 1, updated: "2026-09-20", def: true },
        { id: "qa-rules-2026.11", providerId: "internal", provider: "内部规则", name: "qa-rules-2026.11", modelId: "qa-rules-2026.11", cap: "质检规则", capabilities: ["qa"], version: "2026.11", status: "已连接", enabled: true, latency: "36s", cost: "固定", timeout: 120, priority: 1, updated: "2026-11-01", def: true }
      ],
      usage: {
        budget: 12000, spent: 6842,
        byCap: [["视频生成", 3820, 56], ["图像生成", 1264, 18], ["文本生成", 1108, 16], ["语音合成", 650, 10]],
        daily: [["11-15", 214], ["11-16", 386], ["11-17", 302], ["11-18", 640], ["11-19", 812], ["11-20", 468], ["11-21", 286]]
      },
      activity: [
        ["00:12", "苏禾", "将 S0107 加入生成队列", "task"],
        ["23:48", "陈默", "保存 EP01 剧本 v6 并锁版", "script"],
        ["23:18", "白露", "林晚参考图 v3 一致性检查失败", "alert"],
        ["22:56", "系统", "EP01 分镜契约解析完成，产出 12 个镜头", "ok"],
        ["21:40", "顾青", "更新 EP02–EP04 分集钩子", "script"],
        ["20:12", "系统", "《长夜将明》24 章解析完成，46 个实体待确认", "ok"]
      ],
      inbox: [
        { kind: "review", title: "EP01 成片待审核", meta: "质量门禁 REVIEW_REQUIRED · 3 条批注 · 截止今天 18:00", path: "review/qa" },
        { kind: "task", title: "T-2039 参考图生成失败", meta: "FACE_DRIFT · 3/4 候选一致性不足", path: "review/tasks" },
        { kind: "script", title: "EP03 剧本等待确认", meta: "顾青提交 · 4 场 · 待导演锁版", path: "production/script", params: { ep: "03" } },
        { kind: "asset", title: "2 项资产需要补参考", meta: "铅字盘、沈知白 · 0 个有效参考", path: "production/assets" }
      ],
      notices: [
        { type: "review", title: "EP01 成片待审核", meta: "质量门禁 REVIEW_REQUIRED · 3 条批注", path: "review/qa" },
        { type: "task", title: "参考图生成失败", meta: "FACE_DRIFT · 可重试", path: "review/tasks" },
        { type: "member", title: "唐宁的加入申请待审批", meta: "项目访问 · 视觉组", path: "system/overview" }
      ],
      agents: agents,
      skills: skills,
      voices: voices,
      dubbingLines: dubbingLines,
      canvasNodes: canvasNodes,
      canvasEdges: canvasEdges,
      previews: previews,
      playground: playground
    };
  }

  return {
    seed: function () {
      return JSON.parse(JSON.stringify(seed()));
    }
  };
})();
