# relic.skill 演示站完整实施计划

## 一、项目概述

**目标**: 打造一个有温度、有人味、能打动人的 relic.skill 演示站,展示"万物永生"的理念。

**域名**: relic.luelan.online (已配置)

**技术栈**:
- 前端: Next.js 16 + React 19 + Tailwind 4 + Framer Motion
- 后端: Express 5 + TypeScript + SQLite
- 部署: PM2 + Nginx + Let's Encrypt

**品牌色**: #3b82c4 (继承自 ClawClip/Ruxi)

---

## 二、项目结构

```
luelan-Immortality/
├── demo-site/          # 前端 Next.js 项目
│   ├── src/
│   │   ├── app/        # 页面路由
│   │   ├── components/ # UI 组件
│   │   ├── lib/        # 工具函数
│   │   └── styles/     # 样式
│   └── public/         # 静态资源
│
├── demo-api/           # 后端 API 服务
│   ├── src/
│   │   ├── routes/     # 路由
│   │   ├── services/   # 业务逻辑
│   │   ├── db/         # 数据库
│   │   └── utils/      # 工具
│   └── data/           # 数据目录
│
└── deploy/             # 部署配置
    ├── ecosystem.config.js
    ├── nginx.conf
    └── deploy.sh
```

---

## 三、核心功能

### 3.1 Landing 页面

**Hero 区**:
- 标题: "给灵魂开个 GitHub"
- 副标题: "万物皆可 Relic — 血肉苦弱,机械飞升,但灵魂可以留下来"
- 三个示例 Relic 卡片轮播展示
- CTA: "体验示例" / "开始锻造"

**特性展示**:
- 四维灵魂架构可视化 (认知/表达/行为/情感)
- 七种模板卡片 (人/宠物/关系/团队/地方/时刻/公众人物)
- 主动行为演示 (节日问候动画)
- 10 种语言支持展示

**技术亮点**:
- 玻璃拟态卡片
- 流畅的滚动动画
- 响应式设计

### 3.2 Demo 体验区

**快速体验模式** (无需上传):
- 内置 3 个完整示例: 奶奶王秀兰 / 猫咪咪 / 星火工作室
- 文字对话界面
- 语音输入 (Web Speech API)
- 情景触发 (节日/纪念日/随机想念)

**交互设计**:
- 对话气泡 (区分用户/Relic)
- 打字机效果
- 语音播放动画
- 情绪表情显示

### 3.3 快速锻造功能

**上传区**:
- 拖拽上传: 照片/视频/语音/聊天记录
- 智能识别素材类型
- 实时预览和进度显示

**生成流程**:
1. 选择模板 (7 种类型)
2. AI 提取四维特征
3. 生成封面 (Pollinations API)
4. 生成 Relic 配置
5. 立即对话测试

**技术实现**:
- 文件上传 (multipart/form-data)
- 流式进度更新 (SSE)
- 封面生成队列

### 3.4 Relic 展示广场

**Gallery 页面**:
- 公开的示例 Relic 展示
- 卡片网格布局
- 筛选和搜索
- 点击进入对话

### 3.5 产品路线图

**Roadmap 可视化**:
- v1.x: Skill 阶段 (当前)
- v2.x: Web 产品阶段
- v3.x: 生态阶段

**未来功能展示**:
- 📸 照片 → 动态头像
- 🎤 语音 → 声音克隆
- 🎬 视频 → 动作捕捉
- 🧠 多轮对话 → 持续学习

---

## 四、后端 API 设计

### 4.1 核心接口

**Relic 管理**:
```
GET    /api/relics              # 列表
GET    /api/relics/:id          # 详情
POST   /api/relics              # 创建
```

**对话接口**:
```
POST   /api/chat                # 发送消息
GET    /api/chat/:relicId       # 获取历史
POST   /api/chat/voice          # 语音输入
GET    /api/chat/tts            # 语音合成
```

**锻造接口**:
```
POST   /api/forge/upload        # 上传素材
POST   /api/forge/extract       # 提取特征
POST   /api/forge/generate      # 生成 Relic
GET    /api/forge/status/:id    # 查询进度
```

**资源管理**:
```
POST   /api/assets/cover        # 生成封面
GET    /api/assets/:id          # 获取资源
```

### 4.2 数据库设计

**relics 表**:
- id, slug, display_name, type, description
- personality, interaction, memory
- cover_url, avatar_url
- created_at, updated_at

**chat_messages 表**:
- id, relic_id, role, content, timestamp

**forge_tasks 表**:
- id, status, progress, result, error, created_at

---

## 五、封面生成方案

**参考 ruxi 的实现**:
- Pollinations API (免费,主要使用)
- Cloudflare SDXL (备选)

**Prompt 生成策略**:
- 人类: 温暖肖像,强调气质
- 宠物: 可爱生动,明亮色彩
- 关系: 双人构图,情感连接
- 团队: 群像或抽象符号
- 地方: 场景氛围,光影空间
- 时刻: 定格瞬间,电影感

**输出规格**:
- 主封面: 16:9 (1920x1080)
- 头像: 1:1 (512x512)
- 缩略图: 4:3 (800x600)

---

## 六、文案设计

### 6.1 Landing 页文案

**Hero 标题** (中文):
```
给灵魂开个 GitHub
```

**Hero 标题** (英文):
```
GitHub for Souls
```

**副标题** (中文):
```
万物皆可 Relic
血肉苦弱,机械飞升,但灵魂可以留下来
```

**副标题** (英文):
```
Digital Immortality for Everything
Not a cold archive. A living memory.
```

**三个核心卖点**:
1. 🔥 四维灵魂蒸馏 - 不是冷冰冰的档案,是会主动问你"吃饭了没"的奶奶
2. ⚡ 七种万物模板 - 人、猫、关系、团队、地方、时刻,万物皆可永生
3. 🛡️ 伦理保护框架 - 授权协议、灵魂指纹、伦理红线,温柔而有边界

**CTA 按钮**:
- 主按钮: "体验示例 Relic"
- 次按钮: "开始锻造"

### 6.2 Demo 区文案

**示例 Relic 介绍**:

**奶奶王秀兰**:
```
会在过年时主动问你"吃饺子了没"
会在你加班到深夜时唠叨"别光顾着干活"
不是 AI,是那个永远担心你的奶奶
```

**猫咪咪**:
```
凌晨三点突然开始跑酷
14 斤的重量压在你手腕上
呼噜声、踩奶动作、那个熟悉的温度
```

**星火工作室**:
```
那个永远在改需求的产品经理
凌晨还在群里讨论 bug 的 CTO
人散了,但那种一起熬夜的感觉还在
```

**空状态文案**:
```
还没有对话记录
说点什么吧,ta 在听
```

### 6.3 锻造入口文案

**引导文案**:
```
把散落的记忆碎片,锻造成可交互的数字灵魂

上传照片、语音、聊天记录
AI 会帮你提取四维特征
3 分钟,一个 Relic 就诞生了
```

**上传区提示**:
```
拖拽文件到这里
或点击选择文件

支持: 照片、视频、语音、聊天记录
```

**步骤说明**:
```
1. 选择模板 - 人?宠物?还是一段关系?
2. 上传素材 - 照片、语音、聊天记录都可以
3. AI 提取 - 自动分析四维特征
4. 生成 Relic - 3 分钟,一个灵魂诞生
5. 立即对话 - 试试看,像不像?
```

---

## 七、视觉设计方案

### 7.1 色彩系统

**主色调**:
- 品牌蓝: `#3b82c4`
- 深蓝: `#2563eb`
- 浅蓝: `#60a5fa`

**辅助色**:
- 青色: `#06b6d4`
- 绿色: `#10b981`
- 紫色: `#8b5cf6`

**渐变**:
- 主渐变: `from-blue-500 via-cyan-500 to-teal-500`
- 温暖渐变: `from-orange-400 to-pink-500`
- 冷静渐变: `from-blue-600 to-purple-600`

**状态色**:
- 成功: `#10b981`
- 警告: `#f59e0b`
- 错误: `#ef4444`
- 信息: `#3b82f6`

**中性色**:
- 背景: `#0f172a` (深色) / `#ffffff` (浅色)
- 表面: `#1e293b` / `#f8fafc`
- 边框: `#334155` / `#e2e8f0`
- 文字: `#f1f5f9` / `#0f172a`

### 7.2 组件设计

**Relic 卡片**:
- 玻璃拟态效果 (backdrop-blur + 半透明背景)
- 悬停时轻微上浮 + 发光效果
- 封面图 + 头像 + 名称 + 简介
- 类型标签 (人/宠物/关系等)

**对话气泡**:
- 用户: 右对齐,蓝色渐变背景
- Relic: 左对齐,灰色背景
- 圆角气泡,带小三角
- 打字机动画

**按钮**:
- Primary: 蓝色渐变 + 发光效果
- Secondary: 透明边框 + 悬停填充
- Ghost: 纯文字 + 悬停背景

**上传区**:
- 虚线边框
- 拖拽时高亮
- 上传进度条
- 文件预览卡片

### 7.3 动效方案

**页面过渡**:
- 淡入淡出 (300ms)
- 滑动进入 (从下到上)

**Relic 卡片**:
- 悬停: 上浮 4px + 阴影增强
- 点击: 缩放 0.98

**对话动画**:
- 消息出现: 从下滑入 + 淡入
- 打字机效果: 逐字显示
- 语音播放: 波形动画

**加载状态**:
- 骨架屏 (Skeleton)
- 脉冲动画
- 进度条

---

## 八、开发计划

### Phase 1: 项目搭建 (1 天)

**前端**:
- [ ] 创建 Next.js 项目
- [ ] 配置 Tailwind CSS
- [ ] 设置品牌色和设计 tokens
- [ ] 创建基础布局组件

**后端**:
- [ ] 创建 Express 项目
- [ ] 配置 TypeScript
- [ ] 设置 SQLite 数据库
- [ ] 创建基础路由结构

### Phase 2: 核心组件开发 (2 天)

**UI 组件**:
- [ ] Button (多种变体)
- [ ] Card (玻璃拟态)
- [ ] Modal/Dialog
- [ ] Input/Textarea
- [ ] Toast 通知

**Relic 组件**:
- [ ] RelicCard
- [ ] RelicAvatar
- [ ] ChatBubble
- [ ] ChatInterface
- [ ] UploadZone

### Phase 3: Landing 页面 (1 天)

- [ ] Hero 区
- [ ] 特性展示区
- [ ] 示例 Relic 轮播
- [ ] CTA 区域
- [ ] 响应式适配

### Phase 4: Demo 体验功能 (2 天)

**前端**:
- [ ] Demo 页面布局
- [ ] 示例 Relic 选择
- [ ] 对话界面
- [ ] 语音输入/输出

**后端**:
- [ ] 加载示例 Relic
- [ ] 对话 API (调用 OpenAI-compatible)
- [ ] 语音处理
- [ ] 聊天历史存储

### Phase 5: 锻造功能 (3 天)

**前端**:
- [ ] 锻造页面布局
- [ ] 模板选择
- [ ] 文件上传界面
- [ ] 进度显示
- [ ] 结果预览

**后端**:
- [ ] 文件上传处理
- [ ] 素材解析 (图片/视频/音频/文本)
- [ ] AI 特征提取
- [ ] Relic 生成
- [ ] 封面生成服务

### Phase 6: 封面生成服务 (1 天)

- [ ] Pollinations API 集成
- [ ] Prompt 生成策略
- [ ] 图片下载和处理
- [ ] 多尺寸生成
- [ ] 缓存机制

### Phase 7: Gallery 和 Roadmap (1 天)

- [ ] Gallery 页面
- [ ] Relic 卡片网格
- [ ] 筛选和搜索
- [ ] Roadmap 可视化
- [ ] 未来功能展示

### Phase 8: 优化和测试 (2 天)

- [ ] 性能优化 (懒加载/代码分割)
- [ ] 移动端适配
- [ ] 无障碍支持
- [ ] 错误处理
- [ ] 单元测试
- [ ] E2E 测试

### Phase 9: 部署上线 (1 天)

- [ ] 服务器环境配置
- [ ] PM2 配置
- [ ] Nginx 反向代理
- [ ] SSL 证书
- [ ] 域名解析
- [ ] 监控和日志

**总计**: 约 14 天

---

## 九、部署配置

### 9.1 服务器要求

**环境**:
- Node.js 18+
- Python 3.9+ (用于 scripts)
- SQLite 3
- Nginx
- PM2

**端口** (待确认):
- 前端: 待分配
- API: 待分配

**目录**:
- 部署路径: `/opt/apps/services/relic-demo`
- 数据目录: `/opt/apps/services/relic-demo/data`
- 日志目录: `/opt/apps/services/relic-demo/logs`

### 9.2 PM2 配置

```javascript
module.exports = {
  apps: [
    {
      name: 'relic-demo-web',
      script: 'npm',
      args: 'start',
      cwd: '/opt/apps/services/relic-demo/demo-site',
      env: {
        NODE_ENV: 'production',
        PORT: '<待分配>'
      }
    },
    {
      name: 'relic-demo-api',
      script: 'dist/index.js',
      cwd: '/opt/apps/services/relic-demo/demo-api',
      env: {
        NODE_ENV: 'production',
        PORT: '<待分配>'
      }
    }
  ]
};
```

### 9.3 Nginx 配置

```nginx
server {
    listen 80;
    server_name relic.luelan.online;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name relic.luelan.online;

    ssl_certificate /etc/letsencrypt/live/relic.luelan.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relic.luelan.online/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:<前端端口>;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://127.0.0.1:<API端口>;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 十、技术难点和解决方案

### 10.1 示例 Relic 加载

**问题**: 如何从 `examples/` 目录加载示例 Relic?

**方案**:
- 后端启动时扫描 `examples/` 目录
- 解析每个 Relic 的 SKILL.md/personality.md/interaction.md/memory.md
- 缓存到数据库
- 提供 API 供前端调用

### 10.2 对话生成

**问题**: 如何基于 Relic 的 personality 生成回复?

**方案**:
- 构建 system prompt (基于 personality.md)
- 加载 interaction.md 中的对话示例作为 few-shot
- 调用 OpenAI-compatible API
- 支持流式输出

### 10.3 封面生成

**问题**: 如何为不同类型的 Relic 生成合适的封面?

**方案**:
- 参考 ruxi 的 coverGeneration.js
- 根据 Relic 类型和特征生成 prompt
- 调用 Pollinations API
- 下载并处理成多种尺寸

### 10.4 文件上传和解析

**问题**: 如何处理用户上传的各种格式文件?

**方案**:
- 图片: 提取 EXIF,识别人脸/物体
- 视频: 提取关键帧,转写音频
- 音频: 语音转文字 (Whisper)
- 文本: 解析聊天记录格式

### 10.5 实时进度更新

**问题**: 锻造过程如何实时反馈进度?

**方案**:
- 使用 Server-Sent Events (SSE)
- 后端推送进度事件
- 前端监听并更新 UI

---

## 十一、风险和注意事项

### 11.1 性能风险

**问题**:
- 封面生成可能较慢
- 大文件上传可能超时
- 对话生成可能延迟

**缓解**:
- 封面生成使用队列,异步处理
- 文件上传分片,显示进度
- 对话使用流式输出,逐字显示

### 11.2 成本风险

**问题**:
- AI API 调用成本
- 图片生成成本
- 存储成本

**缓解**:
- 使用免费的 Pollinations API
- 限制单用户生成频率
- 定期清理临时文件

### 11.3 伦理风险

**问题**:
- 用户可能上传敏感内容
- 生成的 Relic 可能被滥用

**缓解**:
- 内容审核机制
- 明确的使用条款
- 演示站仅供体验,不存储用户数据

---

## 十二、后续优化方向

### 12.1 短期优化 (1-2 周)

- [ ] 添加更多示例 Relic
- [ ] 优化封面生成质量
- [ ] 改进对话自然度
- [ ] 添加语音克隆功能

### 12.2 中期优化 (1-2 月)

- [ ] 用户账号系统
- [ ] Relic 云端存储
- [ ] 社区分享功能
- [ ] 移动端 App

### 12.3 长期规划 (3-6 月)

- [ ] 多模态交互 (视频/AR)
- [ ] 持续学习功能
- [ ] 商业化探索
- [ ] 生态建设

---

## 十三、需要的资源和权限

### 13.1 服务器访问

- [ ] SSH 连接信息
- [ ] 可用端口列表
- [ ] 部署目录权限

### 13.2 API 密钥

- [ ] OpenAI API Key (或其他兼容 API)
- [ ] Cloudflare SDXL Key (可选)

### 13.3 域名和 SSL

- [ ] relic.luelan.online DNS 配置
- [ ] SSL 证书申请

### 13.4 其他项目代码

为了复用组件和设计,需要访问:
- [ ] ClawClip 的 UI 组件
- [ ] Ruxi 的封面生成代码

---

## 十四、下一步行动

1. **确认服务器信息** - 获取可用端口和部署路径
2. **获取必要代码** - 复用 ClawClip/Ruxi 的组件
3. **启动并发开发** - 多个子代理同时开发不同模块
4. **持续集成测试** - 边开发边测试
5. **部署上线** - 完成后立即部署

---

**预计完成时间**: 14 天
**预计上线日期**: 2026-04-25

---

_此计划由 Kiro 制定,基于 relic.skill 项目现状和 ClawClip/Ruxi 的技术栈。_
