# relic.skill 图片生成方案参考

> 目的：沉淀 `ruxi` 项目的图片生成实现，作为 relic.skill 示例图、封面图、头像图统一风格时的参考依据；并补充 2026 年更优替代方案，方便后续选型。

---

## 1. ruxi 现有图片生成方案总结

### 1.1 核心思路
ruxi 不是在前端实时生图，而是走一条 **离线 / 半离线封面生成链路**：

1. 从数据库拿世界 / 角色数据
2. 在服务端整理 `brief`
3. 根据题材、玩法、关键词拼装 prompt
4. 调图片生成 provider
5. 下载结果并落盘
6. 把公开 URL 回写数据库

也就是说，它本质上是一个：

> **批处理封面生成器**

而不是一个让用户当场实时点一下就生图的前端服务。

---

### 1.2 关键文件

#### 核心生成逻辑
- `C:/Personal/Azure Glance/apps/luelan-ruxi/server/src/services/coverGeneration.js`

#### 批处理脚本
- `C:/Personal/Azure Glance/apps/luelan-ruxi/server/scripts/covers.js`

#### 测试
- `C:/Personal/Azure Glance/apps/luelan-ruxi/tests/cover-generation.test.js`

#### 静态资源暴露
- `C:/Personal/Azure Glance/apps/luelan-ruxi/server/src/index.js`

#### 数据库存储字段
- `C:/Personal/Azure Glance/apps/luelan-ruxi/server/src/db/database.js`

#### 前端图片展示相关
- `C:/Personal/Azure Glance/apps/luelan-ruxi/next.config.ts`
- `C:/Personal/Azure Glance/apps/luelan-ruxi/src/components/WorldCard.tsx`
- `C:/Personal/Azure Glance/apps/luelan-ruxi/src/components/WorldDetailClient.tsx`

---

### 1.3 风格控制方式
ruxi 的风格控制不是靠大量人工 prompt 文件，而是三层叠加：

1. **题材映射**：`GENRE_STYLE_HINTS`
2. **玩法映射**：`PLAY_TYPE_HINTS`
3. **文本启发式识别**：`deriveWorldVisualAnchors(world)`

它会先把世界/角色的数据压成结构化 brief，再拼成英文 prompt。

#### 世界封面 prompt 组成
- 固定前缀：电影感、海报感、无文字、无 logo、无 watermark
- 再补：
  - 标题/世界观钩子
  - 主角信息
  - 题材风格提示
  - 玩法提示
  - 文本关键词提炼出来的视觉锚点

#### 角色图 prompt 组成
- 从角色：
  - `name`
  - `role`
  - `appearance`
  - `personality`
  - `background`
  - `greeting`
  - `speech_style`
- 再叠加所属世界的风格信息
- 按角色类型使用不同构图模板（主角 / 普通角色 / “你”型角色）

---

### 1.4 当前使用的 provider / 模型

#### 主方案：Pollinations
- API：`https://image.pollinations.ai/prompt/...`
- 参数中指定模型：`flux`
- 还会带：
  - `width`
  - `height`
  - `nologo=true`
  - `enhance=true`
  - 可选 `seed`

#### 兜底方案：Cloudflare AI
- 默认模型：`@cf/stabilityai/stable-diffusion-xl-base-1.0`
- 通过 Cloudflare Workers AI 跑图
- 只有在环境变量齐全时才启用

#### 未发现用于图片生成的方案
以下没在 ruxi 当前生图链路里看到：
- OpenAI Images
- Google Imagen / Gemini 图像 API
- OpenRouter 图片模型
- Replicate

---

### 1.5 尺寸、批量、缓存、落盘

#### 尺寸
ruxi 当前主要使用统一竖版尺寸：
- `832 x 1216`

这更适合世界封面 / 角色海报，不是我们现在演示站横版卡片的最佳比例。

#### 批量生成
脚本支持：
- 单个 world / character 预览
- 单个 world / character 生成
- 批量 worlds
- 批量 characters
- `missing-only`
- `force`
- `ids` 指定范围

#### 缓存
没有复杂的生成结果缓存系统，更多是：
- 只要 DB 里已有 `cover_url` / `avatar_url`，就不重复生成
- 静态资源暴露时走缓存
- Next 图片优化也有 TTL

#### 落盘
- 默认目录：`server/data/generated-assets`
- 世界图：`worlds/`
- 角色图：`characters/`
- 最终通过公开 URL 提供访问，并回写 DB

---

## 2. 对 relic.skill 的启发

ruxi 的方案适合我们借鉴的，不是“照抄 provider”，而是这几个结构：

### 2.1 借鉴点
1. **先做 brief，再做 prompt**
   - 不要把整段设定直接扔给模型
   - 先把人物 / 猫 / 团队各自的视觉特征提炼出来

2. **风格规则前置**
   - 先定义统一风格圣经
   - 再根据示例类型加少量差异
   - 而不是每张图自由发挥

3. **生成与展示解耦**
   - 生图是离线资源准备过程
   - 网站只消费结果图
   - 这样风格更稳定，也更容易人工筛选

4. **cover / avatar 要分开设计**
   - 横版封面关注场景和气氛
   - 头像关注识别度和圆形裁切
   - 两者不能用一套 prompt 硬兼容

---

### 2.2 不建议照搬的点
1. **ruxi 当前主方案更偏“海报封面”**
   - relic.skill 现在更需要“统一气质的示例插画”
   - 不是小说平台式 KV

2. **统一竖版尺寸不适合当前演示站**
   - 我们需要：
     - cover：横版
     - avatar：方形 / 圆形裁切友好

3. **Pollinations + flux 的风格稳定性不够强**
   - 做 demo 封面也许够用
   - 但做“奶奶 / 猫 / 团队三组同世界观一致插画”时，容易漂

---

## 3. 2026 年更优替代方案 / 更适合 relic.skill 的方案

下面是更适合 relic.skill 的三套方案。

---

## 方案 A：Google 方案（推荐做长期正式方案）

### 组合方式
- **Gemini 图像能力**：负责强理解、多轮修改
- **Imagen 3 / style customization**：负责统一风格和参考图约束

### 优点
- 官方支持图像生成、编辑、参考图
- 风格一致性能力最强
- 很适合我们这种：
  - 奶奶
  - 猫
  - 团队
  三组不同主题，但又要像一个产品宇宙里出来的图

### 缺点
- 接入和计费理解会比 OpenAI 麻烦一点
- 最强组合通常不是“一条 API 全搞定”

### 适合 relic.skill 的原因
如果后面我们要做：
- 一套固定风格的 cover
- 一套固定风格的 avatar
- 甚至未来支持更多示例批量生成

Google 的路线是最像“能长期生产稳定视觉资产”的。

### 参考定位
- **长期主方案首选**

---

## 方案 B：OpenAI GPT Image（推荐做最近可落地方案）

### 优点
- 接入最顺手
- 指令遵循普遍更省心
- 多图输入、编辑、重绘流程比较自然
- 适合快速建立：
  - 固定 prompt
  - 固定参考图
  - 批量出一致性尚可的图

### 缺点
- 官方层面对“风格锁定”的产品化能力不如 Google 路线明确
- 如果要非常强的一致性，还是得靠提示工程 + 参考图管理

### 适合 relic.skill 的原因
如果我们现在要快速做一轮真正好看的统一图，而不是继续用手工 SVG 顶着，OpenAI 会是最快能开始试的方案。

### 参考定位
- **短期最实用方案**

---

## 方案 C：Replicate / FLUX 微调路线（推荐做追求极致一致性的方案）

### 优点
- 最灵活
- 可选模型多
- 如果要把风格锁得很死，可以走 fine-tune / custom model
- 最适合长期把“relic.skill 示例图风格”做成自己的视觉资产

### 缺点
- 工程治理成本更高
- 模型和参数选择空间大，容易乱
- 不适合一上来就当 MVP

### 适合 relic.skill 的原因
如果未来你希望：
- 所有示例图都像同一个插画师画的
- 以后新增示例也能稳定延续风格

那这条路线最强，但最重。

### 参考定位
- **中长期高一致性方案**

---

## 4. 对当前 relic.skill 的建议结论

### 短期建议
先别继续手工拼不同风格图，也别继续随便生图碰运气。

最合理的是：

1. 先写一份 **风格圣经**
   - 色调
   - 构图
   - 人物距离
   - 光感
   - 情绪
   - cover / avatar 的区别

2. 再做两套固定 prompt 模板
   - `cover` 模板
   - `avatar` 模板

3. 先选 **OpenAI 或 Google** 出一轮高质量样图

### 中期建议
如果确认这套风格长期使用：
- 再考虑把生成流程做成脚本
- 参考 ruxi 的做法，把：
  - brief 提取
  - prompt 组装
  - 批量生成
  - 结果落盘
  变成正式工具链

### 长期建议
如果未来示例越来越多、而且你对风格一致性要求越来越高：
- 再考虑 Replicate / fine-tune 路线

---

## 5. 推荐顺序

### 对 relic.skill 当前最现实的路线

#### 第一阶段
- 借鉴 ruxi 的“brief -> prompt -> 资源落盘”结构
- 但不照搬 provider

#### 第二阶段
- 用 **OpenAI GPT Image** 或 **Google** 先出一轮真正统一风格的 3 组图

#### 第三阶段
- 效果稳定后，再决定是否脚本化、批量化

---

## 6. 当前判断

如果只是问：

> “ruxi 的方案能不能拿来参考？”

答案是：
**能，结构非常值得参考。**

如果问：

> “ruxi 当前用的那套 provider / prompt 逻辑，是不是 relic.skill 最优解？”

答案是：
**不是。**

它更适合小说/世界观海报，不是我们现在这种要做统一人物/宠物/团队示例视觉系统的场景。

---

## 7. 当前已落地的免费方案记录（2026-04）

目前 relic.skill 已经基于 `demo-api` 落了一套 **可持续的免费生成链路**，核心不是继续手工拼图，而是：

- `brief -> prompt -> provider plan -> dry-run/live -> 落盘`
- 主 provider：`pollinations`
- 备选 provider manifest：`openai / google / openrouter / replicate`
- 当前环境没有可用 API key，因此只有 `pollinations` 能直接 live 执行

### 已落地位置
- `demo-api/src/services/demoImage/styleBible.ts`
- `demo-api/src/services/demoImage/relicBriefs.ts`
- `demo-api/src/services/demoImage/promptBuilder.ts`
- `demo-api/src/services/demoImage/providers.ts`
- `demo-api/src/services/demoImage/planBuilder.ts`
- `demo-api/scripts/generateDemoRelicCovers.ts`

### 已具备能力
- dry-run 输出 manifest / snapshots
- provider 方案切换
- Pollinations 真执行
- 429 限流重试
- 独立候选图目录输出，不污染站内正式资源
- `seed offset` 支持，用来批量跑多套候选图

### 当前候选图目录
- `demo-api/generated/demo-image-candidates/pollinations-v1/`

### 当前计划目录
- `demo-api/generated/demo-image-plans/`

### 对免费方案的判断
免费方案不是不能用，问题是稳定性和一致性不足。所以正确做法不是把免费源当终版，而是：

1. 固定风格圣经
2. 固定 prompt 模板
3. 多 seed 批量出候选
4. 人工筛选最合适的一组
5. 再决定是否替换站内正式图

---

## 8. 我建议的下一步

1. 继续用免费主源 `pollinations` 生成 `v2 / v3 / v4` 多套候选图
2. 重点压这几个风险：
   - 奶奶的恐怖谷感
   - 猫的过拟合可爱/二次元感
   - 团队的商业素材感
3. 等后续拿到可用 key，再把 OpenAI / Google 的 live 执行接进去

这样我们就不是“继续觉得现在图片一般”，而是正式进入一套可持续优化的图片系统。
