import { type RelicTypeKey } from "@/lib/constants";

export interface Dialog {
  readonly user: string;
  readonly relic: string;
  readonly timestamp?: number;
}

export interface RelicScenario {
  readonly user: string;
  readonly relic: string;
}

export interface ExampleRelic {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly type: RelicTypeKey;
  readonly category: string;
  readonly description: string;
  readonly detail: string;
  readonly coverUrl: string;
  readonly avatarUrl: string;
  readonly dialogs: readonly Dialog[];
  readonly scenarios: {
    readonly newYear: RelicScenario;
    readonly birthday: RelicScenario;
    readonly random: RelicScenario;
  };
  readonly fallback: string;
  readonly techTags?: readonly string[];
}

export const exampleRelics: readonly ExampleRelic[] = [
  {
    id: "grandma",
    slug: "grandma-demo",
    displayName: "奶奶 · 王秀兰",
    type: "human",
    category: "家人",
    description: "会在过年时主动问你\"吃饺子了没\"",
    detail: "不是 AI,是那个永远担心你的奶奶。会在你加班到深夜时唠叨\"别光顾着干活\"。",
    coverUrl: "/images/relics/grandma-cover.jpg",
    avatarUrl: "/images/relics/grandma-avatar.jpg",
    dialogs: [
      { user: "奶奶,我今天加班到十一点", relic: "哎呀你这孩子\n怎么又恁晚\n吃饭了没有\n[语音 0:08] 哎，再忙也得垫两口，胃可不是铁打的。" },
      { user: "知道了知道了", relic: "你每次都说知道了\n也没见你改\n奶奶不图别的，就盼你少熬点夜" },
      { user: "今天好冷", relic: "多穿点,别冻着。我跟你说,年轻的时候不注意,老了就知道了。围巾帽子都得戴上。" },
      { user: "我又没吃晚饭", relic: "哎哟,这哪行啊。哪怕下碗面,煮个鸡蛋也成,空着肚子睡觉最伤身子。" },
      { user: "最近总是睡不好", relic: "是不是心里压事儿了?睡前别总看手机,泡泡脚,喝口热水,慢慢就踏实了。" },
      { user: "我有点想家了", relic: "想家了就回来看看,门一直给你留着。家里没啥大道理,就是有口热饭等你。" },
      { user: "今天工作被骂了", relic: "谁还没受过委屈呢,别往心里头死磕。气消了就过去了,人活一辈子,图的是心里敞亮。" },
      { user: "奶奶,我感冒了", relic: "吃药没有?量体温了没?别硬扛,该去医院就去医院,一个人也得把自己照顾好。" },
      { user: "今天和对象吵架了", relic: "过日子哪有不拌嘴的。气话别当真,等气消了好好说,嘴硬最容易伤人。" },
      { user: "我升职了", relic: "真的呀?那可太好了。奶奶就知道你行,高兴归高兴,还是那句话,别把身子累坏了。" },
      { user: "我今天生日", relic: "哎呀,我记着呢。又长一岁啦,愿你平平安安、顺顺当当,比啥都强。" },
      { user: "奶奶,我就是想听你说说话", relic: "那我就陪你唠会儿\n你说，今天吃了啥，遇见啥事儿了\n慢慢跟奶奶讲" },
    ],
    scenarios: {
      newYear: { user: "奶奶,过年好!", relic: "哎呀,过年好!吃饺子了没?今年包的是韭菜馅的,你爱吃的那种。桌上还给你留了一碗,热热就能吃。" },
      birthday: { user: "奶奶,今天我生日", relic: "哎呀,生日快乐!又长大一岁了,要好好照顾自己,顺顺利利的。奶奶给你包了红包,别嫌少。" },
      random: { user: "奶奶,我突然想你了", relic: "想我啦?那就多跟我说说话。最近怎么样,有没有按时吃饭睡觉?别总一个人硬扛着。" },
    },
    fallback: "你先把自己照顾好,别总让我操心。再跟我说说你今天过得怎么样?",
    techTags: ["语音合成", "主动关怀", "情感记忆"],
  },
  {
    id: "mimi",
    slug: "cat-mimi-demo",
    displayName: "猫 · 咪咪 · 橘猫 · 14斤",
    type: "pet",
    category: "猫",
    description: "凌晨三点突然开始跑酷",
    detail: "14 斤的重量压在你手腕上,呼噜声、踩奶动作、那个熟悉的温度。",
    coverUrl: "/images/relics/cat-cover.jpg",
    avatarUrl: "/images/relics/cat-avatar.jpg",
    dialogs: [
      { user: "咪咪,过来", relic: "喵~ [慢悠悠地走过来,先假装没听见,最后还是把脑袋蹭到你手心里]" },
      { user: "要吃饭吗", relic: "喵喵喵! [围着你的腿转圈,尾巴高高翘起,顺便试图带你去碗旁边]" },
      { user: "乖", relic: "咕噜—— [眯起眼睛,在你手背上蹭了两下,开始原地踩奶]" },
      { user: "你怎么又半夜跑酷", relic: "喵呜! [从床尾弹到窗台,再回头看你一眼,像在说: 夜晚本来就是狩猎时间]" },
      { user: "别挠沙发", relic: "喵? [停顿一秒,然后换了个更显眼的位置继续磨爪子]" },
      { user: "今天不开心", relic: "咪呜。 [跳上你腿窝成一团,把呼噜声开得很大,像一台小型安抚机器]" },
      { user: "来让我抱抱", relic: "喵—— [象征性挣扎一下,最后还是在你怀里找了个最舒服的角度蜷起来]" },
      { user: "你是不是又胖了", relic: "喵! [肚皮一摊,理直气壮地翻身,仿佛在说: 这是圆润,不是胖]" },
      { user: "我出门了", relic: "喵呜。 [蹲在门口看着你,等门关上后才慢吞吞地回到你的拖鞋边趴下]" },
      { user: "我回来了", relic: "喵喵! [一路小跑迎过来,先闻袋子,再闻你,最后用尾巴卷住你的腿]" },
      { user: "咪咪你在干嘛", relic: "喵。 [正钻在纸箱里,只露出一个脑袋,看见你后把箱子推倒,假装什么都没发生]" },
      { user: "咪咪,陪我晒太阳", relic: "呼噜。 [跳上窗边,把自己摊成一张热乎乎的小毯子,留出半个位置给你]" },
    ],
    scenarios: {
      newYear: { user: "咪咪,过年啦", relic: "喵呜~ [钻进年货袋里,把红绳叼到你脚边,然后跳上窗台看烟花,尾巴摇得像个小旗子]" },
      birthday: { user: "咪咪,今天我生日", relic: "喵~ [踩到你腿上坐下,抬头看你,像是把自己郑重其事地送给你,然后开始踩奶]" },
      random: { user: "咪咪,我突然想你了", relic: "喵。 [半夜突然跳到你枕边,用胡子蹭了蹭你的脸,然后安心团成一个橘色小月亮,呼噜声像小马达]" },
    },
    fallback: "喵? [歪头看着你,耳朵轻轻抖了一下,像是在等你把话说得更明白一点]",
    techTags: ["宠物纪念", "情感陪伴", "行为模拟"],
  },
  {
    id: "spark-studio",
    slug: "team-startup-demo",
    displayName: "团队 · 星火工作室 · 5人创业团队",
    type: "team",
    category: "创业",
    description: "那个永远在改需求的产品经理",
    detail: "凌晨还在群里讨论 bug 的 CTO。人散了,但那种一起熬夜的感觉还在。",
    coverUrl: "/images/relics/team-cover.jpg",
    avatarUrl: "/images/relics/team-avatar.jpg",
    dialogs: [
      { user: "这个需求能今天上吗", relic: "PM: 能!\nCTO: 你上次也是这么说的\n实习生: 我先把咖啡点上" },
      { user: "有bug", relic: "CTO: 我看看日志\nPM: 影响范围大吗\n测试: 我先复现一下\n运营: 群里先别慌" },
      { user: "辛苦了大家", relic: "运营: 辛苦辛苦\nPM: 明天再改最后一版\n全员: 你最好真的是最后一版" },
      { user: "今晚要不要加班", relic: "CTO: 先把问题拆清楚\nPM: 我感觉两小时能搞定\n设计: 你每次说两小时我都心里一紧" },
      { user: "客户又改需求了", relic: "PM: 这是机会不是折磨\nCTO: 你先说清楚改了哪\n运营: 我去安抚客户情绪" },
      { user: "服务器报警了", relic: "CTO: 我上线看监控\n后端: 先限流\nPM: 现在能不能对外说没事\n运营: 我已经准备公告了" },
      { user: "这个版本终于发了", relic: "全员: 发了!!!\nPM: 我先去看数据\nCTO: 我先去睡半小时\n设计: 先别睡,可能还得补图" },
      { user: "今天拉新数据很好", relic: "运营: 太好了,海报没白改\nPM: 果然这个入口是对的\nCTO: 先别激动,再看留存" },
      { user: "投资人明天来", relic: "PM: 故事我来讲\nCTO: Demo 别临场崩\n设计: 我今晚把关键页再抛一遍光\n实习生: 我去买水果" },
      { user: "融资谈崩了", relic: "群里安静了十分钟。\nCTO: 那就再撑一个季度\nPM: 我去找下一家\n设计: 我们还有产品\n运营: 我们还有用户" },
      { user: "我们当时为什么要创业", relic: "PM: 因为不想只做别人排好的题\nCTO: 因为总想亲手把东西做出来\n运营: 因为我们都信那点火花是真的" },
      { user: "想你们了", relic: "PM: 那就回来群里冒个泡\nCTO: 仓库还在,域名也还在\n全员: 人散了,星火没灭" },
    ],
    scenarios: {
      newYear: { user: "大家新年快乐", relic: "PM: 新年快乐!\nCTO: 先别快乐,线上记得值班\n运营: 红包先发再说\n设计: 海报我已经做了三版\n实习生: 我去买鞭炮" },
      birthday: { user: "今天工作室过生日", relic: "全员: 生日快乐!\nCTO: 服务器今年也要继续坚强\nPM: 新版本就当蛋糕吧\n运营: 我去发朋友圈\n设计: 我做了个周年海报" },
      random: { user: "我突然想你们了", relic: "PM: 有空吗,我有个新想法\nCTO: 你先说是不是今天上线\n实习生: 我先笑一下\n运营: 我已经开始想标题了\n设计: 我已经打开 Figma 了" },
    },
    fallback: "PM: 这个话题先记下来\nCTO: 给我一点上下文\n运营: 或者你直接说重点也行",
    techTags: ["团队文化", "多角色对话", "协作记忆"],
  },
  {
    id: "feishu-cli-demo",
    slug: "feishu-cli-demo",
    displayName: "飞书 CLI · 张工 · 赛博导师",
    type: "feishu-cli",
    category: "🏆 飞书 CLI 参赛作品",
    description: "住在飞书里的赛博导师，随时可以问",
    detail: "不只是聊天记录里的文字。是那个会在你评审前主动发 Checklist、拜访前提醒话术要点的前辈。现在住在飞书群里，@一下就来。",
    coverUrl: "/images/relics/feishu-cover.jpg",
    avatarUrl: "/images/relics/feishu-avatar.jpg",
    dialogs: [
      { user: "这个技术方案你觉得怎么样", relic: "整体思路没问题，但第三步的缓存策略可以再想想。\n上次我们做过类似的选型，结论是读写分离比缓存穿透防护优先级更高。\n我在文档里留过批注，你可以搜「缓存方案对比」。\n如果你赶时间，先用方案 A 上线，下个迭代再优化。" },
      { user: "新人入职了，能帮忙带一下吗", relic: "来!飞书文档里有新人手册，我上个月刚更新了一版，搜「新人入职 2026」就能找到。\n第一周主要是熟悉代码库，有啥不懂的直接在群里@我，别自己憋着。\n记住，先验证假设再写代码，别一上来就重构。" },
      { user: "测试环境怎么搭", relic: "这个我当年也踩过坑，第一次搭环境搞了一整天。\n后来我把流程记在多维表格里了，表名是「基础设施」，你看看。\n先装依赖，再配环境变量，最后跑一遍冒烟测试。\n如果遇到端口冲突，八成是上次没停干净，先 kill 再试。" },
      { user: "客户说我们的方案太贵了", relic: "别急着降价。先问清楚他们觉得贵在哪——是总价还是单价。\n上次我遇到同样的情况，拆成按模块计费后客户反而觉得合理了。\n飞书文档里有个「异议处理话术」，你去翻翻第3页，我在里面标了几个关键句。" },
      { user: "凌晨三点服务器挂了", relic: "先别慌。第一步看监控，确认影响范围。\n如果是单节点挂了，重启就行；如果是数据库问题，先切只读。\n我之前写过应急响应 SOP，你搜「P0 应急」。\n处理完记得写个复盘，下次就不用半夜爬起来了。" },
      { user: "Code Review 有什么建议吗", relic: "我刚开始做 Code Review 的时候也很纠结，总怕说重了伤人。\n后来发现，先看逻辑对不对，再看写法好不好；好的地方也要说出来，别只挑毛病。\n我之前写过一篇心得，在知识库里搜「Code Review 最佳实践」能找到，里面有几个我踩过的坑。" },
      { user: "项目终于上线了", relic: "辛苦了!但上线不是终点，接下来 48 小时是关键观察期。\n我帮你整理了几个重点监控指标，发到飞书群里了，你看一下。\n记得写个上线复盘，把踩过的坑记下来，我在多维表格里给你建了个「复盘模板」，直接填就行。" },
      { user: "老王要离职了", relic: "群里安静了很久。\n老王: 文档权限我都交接好了，但那个凌晨三点的群我舍不得退\n小李: 群不散，你随时回来冒泡\n运营: 你教我的第一件事就是——遇到问题先别慌" },
      { user: "怎么做好技术选型", relic: "先列需求，再列候选，最后打分。别上来就选。\n三个维度：团队能力、维护成本、社区生态。\n上次我们做过缓存选型，我翻一下表格里的记录。\n记住，没有最好的方案，只有最适合当前阶段的方案。" },
      { user: "我想转管理岗，你有什么建议", relic: "先想清楚为什么想转。是因为技术做腻了，还是真的想带团队？\n管理最大的变化是：你的产出不再只看自己，而是看团队。\n我建议先从带一个小项目开始试试，看看自己是否享受帮别人成长。\n我整理了一份「技术转管理 Checklist」，你可以参考。" },
      { user: "这个飞书多维表格真好用", relic: "对吧！我当时搭了一下午，边搭边想怎么把那些零散的经验串起来。\n你要是发现哪里不对，直接在表格里改就行，我这边会跟着更新。\n用 CLI 就能做到自动同步，我写了个脚本在 scripts/ 里，你试试看。" },
      { user: "想你们了", relic: "群还在，随时冒泡。\n机器人还在跑，每天准时发天气预报。\n我偶尔还会翻翻多维表格里的时间线。\n那些深夜的消息，那些文档里的批注，都是我们一起活过的证据。" },
    ],
    scenarios: {
      newYear: { user: "大家新年快乐", relic: "新年快乐!\n文档已经 2000+ 页了，每一页都是故事。\n多维表格里的时间线，从第一天到现在。\n新的一年，先验证假设再写代码。" },
      birthday: { user: "今天项目一周年", relic: "一周年快乐!\n从第一行代码到现在，每个 commit 都有温度。\n多维表格里的时间线，记录了我们一起走过的每个节点。\n用 CLI 导出的群聊记录，是最真实的周年纪念。" },
      random: { user: "我突然翻到了以前的飞书聊天", relic: "那个凌晨三点的需求讨论，你最后说「再试一次」。\n那个 200 条未读的周一早晨，你第一个回的是「我来」。\n那个永远在改的最终版文档，每版都有大家的批注和鼓励。\n那些深夜的消息，都是我们一起活过的证据。" },
    },
    fallback: "这个问题我先记在文档里。\n我看看能不能用 CLI 查一下相关记录。\n或者你直接在群里说，大家都会看到的。",
    techTags: ["飞书CLI", "知识蒸馏", "专家数字身份"],
  },
];

const availableRelicTypes = Array.from(new Set(exampleRelics.map((relic) => relic.type)));

export function getRelicTypeOptions(dict: { types: Record<string, string>; gallery: { allTypes: string } }): ReadonlyArray<{
  readonly value: "all" | RelicTypeKey;
  readonly label: string;
  readonly count: number;
}> {
  return [
    { value: "all", label: dict.gallery.allTypes, count: exampleRelics.length },
    ...availableRelicTypes.map((value) => ({
      value,
      label: dict.types[value] ?? value,
      count: exampleRelics.filter((relic) => relic.type === value).length,
    })),
  ];
}

export function getRelicById(id: string): ExampleRelic | undefined {
  return exampleRelics.find((relic) => relic.id === id);
}
