# Relic 视觉素材生成规格

> 状态：等待 dofun 图像生成入口或授权凭据。本文不是已生成素材的证明。
>
> 推荐模型：`gpt-image-2.5-sunburst`；备选：`gpt-image-2.5-flare`。

## 统一约束

- 用途：公开 demo-site 和产品说明视觉素材。
- 不出现真实人物脸部、真实个人资料、客户信息、凭据、品牌 logo、可读文字或未经授权的角色形象。
- 不使用墓碑、骨灰盒、遗照、灵异元素、医院、悲伤煽情或“AI 复活”营销表达。
- 文字由网页组件渲染，图片内禁止生成标题、标签、UI 文案或伪造报告内容。
- 母版：PNG；网页版本：WebP；目标文件不超过 1.5 MB。
- 生成后检查实际像素尺寸、色彩模式、文件格式、EXIF/元数据和是否存在可识别内容。

## 素材 A：演示站 Hero / Carousel

- 建议文件：`demo-site/public/images/relic-hero-generated.webp`
- 尺寸：`1600x900`
- 比例：16:9
- 适用：Home Hero 或产品总览横幅

### Prompt

```text
Editorial cinematic illustration for a digital memory archive product, wide 16:9 composition, deep midnight blue and muted violet background with warm amber light, elegant orbit-like trails connecting floating abstract memory fragments, translucent paper fibers, tiny archival index marks that are intentionally unreadable, a quiet luminous abstract silhouette with no face and no body details, museum-quality future archive installation, restrained romantic atmosphere, warm and precise, sophisticated visual design, generous negative space on the left for website copy, crisp composition, soft film grain, no text, no logos, no watermark.
```

### Negative prompt

```text
gravestone, urn, ashes, memorial portrait, funeral, hospital, ghost, paranormal, angel wings, horror, black-and-white mourning photo, visible human face, identifiable person, celebrity likeness, readable words, letters, UI screenshot, logo, watermark, neon cyberpunk, gaming aesthetic, overly sad depression imagery, cluttered composition.
```

## 素材 B：专家经验交接流程

- 建议文件：`products/relic-expert-handoff/assets/handoff-flow.webp`
- 尺寸：`1600x1000`
- 比例：8:5
- 适用：README / 产品说明页

### Prompt

```text
Abstract editorial diagram-like illustration of expert knowledge handoff, a warm amber archive folder on the right connected by thin luminous threads to three floating layers on the left: source fragments, decision rules, and human review, deep blue-violet background, paper textures, subtle evidence tags represented only by geometric marks with no readable text, calm museum archive atmosphere, clear left-to-right flow, no people and no faces, high-end product editorial illustration, restrained, precise, generous whitespace, no text, no logo, no watermark.
```

### Negative prompt

```text
real employee, portrait, face, private documents, readable text, fake signatures, credentials, passwords, customer data, gravestone, funeral, ghost, horror, corporate stock photo, cheesy teamwork handshake, neon cyberpunk, clutter, watermark, logo.
```

## 素材 C：Skill 发布审计报告

- 建议文件：`products/relic-skill-launch-audit/assets/audit-report.webp`
- 尺寸：`1600x1000`
- 比例：8:5
- 适用：README / 产品说明页

### Prompt

```text
Abstract product editorial illustration for an AI agent skill release audit, a dark blue-violet audit board with layered translucent cards, three visual states shown only through abstract geometric indicators: green clear path, amber review path, red blocked path, small shield and magnifying-glass shapes, warm silver highlights, archival paper texture, sophisticated and calm, no readable text, no actual software brand, no source code, no credentials, no people, high-end documentation cover art, balanced 8:5 composition, clean negative space.
```

### Negative prompt

```text
readable words, letters, code blocks, real dashboard, API key, password, secret, company logo, brand logo, cybersecurity attack, hacker, threatening red alert, horror, neon cyberpunk, stock photo, face, person, watermark, clutter.
```

## 素材 D：团队记忆与 onboarding

- 建议文件：`products/relic-team-memory/assets/team-memory.webp`
- 尺寸：`1600x1000`
- 比例：8:5
- 适用：README / 产品说明页

### Prompt

```text
Abstract editorial illustration of a team memory archive and onboarding path, several warm amber points connected across a calm deep blue-violet constellation, layered cards and timeline fragments flowing toward a small open doorway of light, no people and no faces, visual feeling of decisions preserved and a newcomer finding the path, poetic but operational, museum-quality digital archive aesthetic, subtle paper grain, silver highlights, clean composition, generous whitespace, no readable text, no logos, no watermark.
```

### Negative prompt

```text
readable text, fake chat messages, real names, personal data, private conversation, company logo, corporate stock photo, handshake, visible faces, ghost, gravestone, funeral, hospital, horror, neon cyberpunk, clutter, watermark.
```

## 生成后验收

```text
1. 确认模型、生成时间、尺寸、输出格式和授权渠道。
2. 使用图像工具读取实际宽高、MIME、文件大小和色彩模式。
3. 目视检查：无脸、无真实资料、无 logo、无可读乱码、无水印。
4. 导出 PNG 母版和 WebP 网页版；网页版控制在 1.5 MB 内。
5. 只将通过检查的素材接入页面；失败素材不提交、不推送。
6. 运行 demo-site typecheck、lint、build，并执行视觉回归检查。
```
