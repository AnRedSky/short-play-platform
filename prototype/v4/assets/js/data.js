/* ============================================================
   长夜制作台 V4 · 演示数据
   所有数据仅为静态原型演示，保存在浏览器 localStorage。
   ============================================================ */
window.SPData = (function () {
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
      { id: "a1", name: "长夜书店 · 橱窗", type: "scene", status: "locked", version: "REF v4", refs: 14, shots: 12, desc: "暖黄橱窗、旧木书架、雨痕玻璃。全剧核心场景，夜间主光来自橱窗内 2700K 台灯。", prompt: "旧书店橱窗，雨夜，暖黄台灯，玻璃反光，电影感，9:16", color: "#8a6137", initial: "书" },
      { id: "a2", name: "长夜书店 · 内景", type: "scene", status: "locked", version: "REF v3", refs: 9, shots: 18, desc: "纵深 6 米，左侧柜台，右侧旧书墙。柜台下有一只铁皮桶，后来被用来烧账簿。", prompt: "旧书店内景，木质书架，暖光，灰尘，浅景深", color: "#6b5237", initial: "内" },
      { id: "a3", name: "雨夜巷道", type: "scene", status: "ready", version: "REF v2", refs: 6, shots: 9, desc: "窄巷，两侧旧墙，湿地面反射橙色灯。警戒线出现在第 4 场。", prompt: "雨夜窄巷，湿地面，橙色路灯，青黑色调，电影感", color: "#33514f", initial: "巷" },
      { id: "a4", name: "旧印刷厂", type: "scene", status: "draft", version: "REF v0", refs: 2, shots: 4, desc: "废弃铅字房，灰尘中的光柱，墙上还挂着一九八七年的生产表。", prompt: "废弃印刷厂，铅字盘，灰尘光柱，冷调，电影感", color: "#5c5e52", initial: "印" },
      { id: "a5", name: "刑警队办公室", type: "scene", status: "ready", version: "REF v1", refs: 4, shots: 6, desc: "审讯室，单侧顶光，桌面有旧划痕。墙上时钟永远慢十一分钟。", prompt: "审讯室，顶光，旧木桌，冷绿墙面，压抑", color: "#4a5550", initial: "警" },
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
      { id: "T-2040", name: "配音合成 · EP01 对白 19 条", type: "语音合成", model: "moss-tts-cn", status: "queued", progress: 0, cost: 0.21, started: "—", duration: "—", target: "EP01 / 全部对白", logs: [["23:40:55", "任务排队中，等待并发槽位"]] },
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

    var members = [
      { name: "陈默", email: "chenmo@studio.cn", role: "项目所有者", dept: "制作中心", status: "在线", last: "刚刚", initial: "陈", color: "" },
      { name: "苏禾", email: "suhe@studio.cn", role: "导演", dept: "制作中心", status: "在线", last: "3 分钟前", initial: "苏", color: "blue" },
      { name: "顾青", email: "guqing@studio.cn", role: "编剧", dept: "内容组", status: "在线", last: "12 分钟前", initial: "顾", color: "green" },
      { name: "白露", email: "bailu@studio.cn", role: "美术指导", dept: "视觉组", status: "离线", last: "昨天 22:14", initial: "白", color: "red" },
      { name: "程野", email: "chengye@studio.cn", role: "剪辑师", dept: "后期组", status: "在线", last: "8 分钟前", initial: "程", color: "blue" },
      { name: "周可", email: "zhouke@studio.cn", role: "审核员", dept: "质控组", status: "离线", last: "今天 09:02", initial: "周", color: "green" }
    ];

    return {
      version: 1,
      user: { name: "陈默", email: "chenmo@studio.cn", role: "制作总监", initial: "陈" },
      project: {
        id: "nyjm", name: "长夜将明", code: "NYJM-26", genre: "悬疑 / 都市 / 温情", episodes: 12, ratio: "9:16", fps: 30,
        tagline: "一间只在雨夜营业的旧书店，一本提前写好名字的账簿。",
        synopsis: "周砚在暴雨夜收到一本没有署名的黑皮账簿，第一页写着他自己的名字和死期。十二个夜晚，十二个名字，他必须在天亮之前决定：谁被写进最后一页。",
        stage: "资产与分镜", progress: 42, due: "2026-12-12", budget: 12000, spend: 6842,
        owner: "陈默", members: 6, updated: "今天 00:12"
      },
      projects: [
        { id: "nyjm", name: "长夜将明", code: "NYJM-26", genre: "悬疑", episodes: 12, ratio: "9:16", progress: 42, stage: "资产与分镜", status: "制作中", updated: "今天 00:12", tweaks: "current" },
        { id: "whgx", name: "雾港来信", code: "WHGX-11", genre: "都市情感", episodes: 8, ratio: "9:16", progress: 76, stage: "配音与字幕", status: "制作中", updated: "昨天 19:40" },
        { id: "dlcr", name: "第六次日落", code: "DLCR-08", genre: "科幻", episodes: 6, ratio: "16:9", progress: 18, stage: "剧本与分集", status: "制作中", updated: "昨天 11:02" },
        { id: "crgz", name: "春日故障", code: "CRGZ-03", genre: "轻喜剧", episodes: 10, ratio: "9:16", progress: 100, stage: "已交付", status: "已归档", updated: "11-08" }
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
      roles: [
        { name: "项目所有者", desc: "全部权限，含成员与删除", perms: ["项目", "剧情", "资产", "分镜", "生成", "审核", "剪辑", "导出", "成员"] },
        { name: "导演", desc: "内容与成片终审", perms: ["剧情", "资产", "分镜", "生成", "审核", "剪辑", "导出"] },
        { name: "编剧", desc: "故事、分集与剧本", perms: ["剧情"] },
        { name: "美术指导", desc: "资产、分镜与参考图", perms: ["资产", "分镜", "生成"] },
        { name: "剪辑师", desc: "时间线与导出", perms: ["剪辑", "导出"] },
        { name: "审核员", desc: "质检与审核结论", perms: ["审核"] }
      ],
      models: [
        { name: "mork-llm-7b", cap: "文本生成", version: "2026.11", status: "已连接", latency: "1.8s", cost: "¥0.006 / 千字", def: true },
        { name: "mork-image-3", cap: "图像生成", version: "2026.10", status: "已连接", latency: "12s", cost: "¥0.08 / 张", def: true },
        { name: "mork-video-2", cap: "视频生成", version: "2026.11", status: "已连接", latency: "2m 40s", cost: "¥0.86 / 5s", def: true },
        { name: "moss-tts-cn", cap: "语音合成", version: "2026.09", status: "已连接", latency: "0.6s", cost: "¥0.01 / 百字", def: true },
        { name: "qa-rules-2026.11", cap: "质检规则", version: "2026.11", status: "已连接", latency: "36s", cost: "固定", def: true },
        { name: "enhance-video-pro", cap: "视频增强", version: "—", status: "未配置", latency: "—", cost: "—", def: false }
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
        { kind: "review", title: "EP01 成片待审核", meta: "质检 94 分 · 3 条批注 · 截止今天 18:00", page: "review.html" },
        { kind: "task", title: "T-2039 参考图生成失败", meta: "FACE_DRIFT · 3/4 候选一致性不足", page: "tasks.html" },
        { kind: "script", title: "EP03 剧本等待确认", meta: "顾青提交 · 4 场 · 待导演锁版", page: "script.html?ep=03" },
        { kind: "asset", title: "2 项资产需要补参考", meta: "铅字盘、沈知白 · 0 个有效参考", page: "assets.html" }
      ],
      notices: [
        { type: "review", title: "EP01 成片待审核", meta: "质检 94 分 · 3 条批注", page: "review.html" },
        { type: "task", title: "参考图生成失败", meta: "FACE_DRIFT · 可重试", page: "tasks.html" }
      ]
    };
  }

  return { seed: seed };
})();
