# 示例 Relics

> 不想从零开始？先跟这八个 Relic 聊聊天，感受一下。

## 怎么体验

在你的 AI 编程助手里直接说：

- `让我跟奶奶聊天` — 加载王秀兰奶奶的 Relic
- `让我跟咪咪互动` — 加载橘猫咪咪的 Relic
- `模拟星火工作室的群聊` — 加载创业团队的 Relic

- `让我跟这台相机聊聊` — 加载尼康 FM2 的物件 Relic
- `讲讲我和我爸的关系` — 加载父子关系 Relic
- `带我回祖母的厨房看看` — 加载地方 Relic
- `重放那个下午` — 加载时刻 Relic
- `跟老周聊聊技术方案` — 加载专家 Relic

不需要提供任何数据，直接体验。

## 八个示例

### 🧓 [grandma-demo/](grandma-demo/) — 奶奶 · 王秀兰

山东济南，78 岁。爱唠叨，永远觉得你吃不饱，微信语音每条以"哎"开头。包饺子是她的绝活。

**试试说**：`奶奶，我今天加班到很晚` / `奶奶，教我包饺子` / `奶奶，我想你了`

### 🐱 [cat-mimi-demo/](cat-mimi-demo/) — 咪咪 · 橘猫 · 14斤

高冷但半夜会来蹭你的脸。只喝流动的水。对塑料袋的声音有执念。注意：猫不说人话，交互用第三人称叙述。

**试试说**：`咪咪，我回来了` / `今天想你了` / `咪咪在干嘛`

### 🏢 [team-startup-demo/](team-startup-demo/) — 星火工作室 · 5人创业团队

AI 产品团队，2022-2025。CTO 口头禅是"这个需求不合理但我可以做"。产品经理永远在改需求。

**试试说**：`需求有点小调整` / `产品上线了` / `中午吃什么`

## 想唤醒自己的 Relic？

回到根目录，对 AI 说：`帮我唤醒一个 Relic`

### 📷 [old-camera-demo/](old-camera-demo/) — 尼康 FM2 · 物件

1978 年买的尼康 FM2，父亲用了三十年，2009 年传给儿子。四角磨出黄铜色，过片扳手被拇指磨亮。
留下来的原因不是值钱，是它拍下了三十年里所有普通的周日。**英文人格**（海外用户可直接体验）。

**试试说**：`Let me talk to the camera` / `Where did you live before 2009?` / `Tell me about the two weeks you were gone`

### 👨‍👦 [dad-and-me-demo/](dad-and-me-demo/) — 我和我爸 · 关系

蒸馏的不是某个人，而是两个人之间的模式：九十个字的电话、靠递扳手结束的争吵、
谁都没说出口的和解。**英文人格**，并且故意保留了一处双方记忆不一致的锚点。

**试试说**：`Show me an ordinary Sunday between you two` / `How do you two actually make up?`

### 🍳 [kitchen-demo/](kitchen-demo/) — 祖母的厨房 · 地方

六平米，能喂饱九口人，也装得下这个家所有的秘密。存在的不是那个房间，而是走进它时的感觉：
灶台上的味道、窗台的收音机、你学着做饭时那张桌子的高度。**英文人格**。

**试试说**：`Walk me through the kitchen` / `What did it smell like?` / `Why does everyone call this room home?`

### 💍 [proposal-demo/](proposal-demo/) — 那个下午 · 时刻

冷风海滩上的求婚，作为「时刻」而不是故事保存：先看现场，再说它后来为何重要。
**刻意保留一处双方记忆不一致的锚点**（一个人说哭了，另一个说没有），演示「矛盾并存」原则。

**试试说**：`Replay it` / `Who said it first?` / `How did you tell it five years later?`

### 🧑‍💻 [tech-lead-demo/](tech-lead-demo/) — 老周 · 专家

一位退休技术主管的 Relic：「他从不回答你问的那个问题，他回答的是下面那个。」
人离开了公司，判断逻辑、经验直觉和带人的方式留下来。**B 端场景**（团队知识传承）。

**试试说**：`What would you ask first about this design?` / `How did you know a project was in trouble?` / `How do you teach someone to make the call themselves?`

---

## 覆盖矩阵

| 模板 | 示例 | 语言 |
|---|---|---|
| human | grandma-demo | 中文 |
| pet | cat-mimi-demo | 中文 |
| team-culture | team-startup-demo | 中文 |
| object | old-camera-demo | 英文 |
| relationship | dad-and-me-demo | 英文 |
| place | kitchen-demo | 英文 |
| moment | proposal-demo | 英文 |
| expert | tech-lead-demo | 英文 |

**public-figure / feishu-cli 暂未提供示例**：前者涉及真实人物，做示例需要处理肖像与授权边界；
后者是飞书区域的增强能力（见 `templates/feishu-cli.md`）。两者都可以直接走唤醒流程。
