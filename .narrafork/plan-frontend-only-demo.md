# relic.skill 纯前端演示站实施计划

## 一、项目定位

**纯展示型演示站,不做真实功能**

目标:
- 用精美的视觉和文案打动人
- 展示"万物永生"的理念
- 引导用户去 GitHub 使用真实功能

不做:
- ❌ 真实 AI 对话
- ❌ 真实文件上传
- ❌ 真实 Relic 生成
- ❌ 后端服务器

做:
- ✅ 精美的 Landing 页
- ✅ 预设对话演示
- ✅ 流畅的动画效果
- ✅ 完整的视觉体验

---

## 二、技术栈

**纯前端方案**:
- Next.js 16 (Static Export)
- React 19
- Tailwind CSS 4
- Framer Motion
- 部署: Vercel / Cloudflare Pages / Nginx 静态托管

**无需**:
- ❌ Express 后端
- ❌ 数据库
- ❌ API 服务
- ❌ 文件上传

---

## 三、页面结构

```
/                    - Landing 页 (主页)
/demo                - Demo 体验 (预设对话)
/gallery             - Relic 展示 (3个示例)
/roadmap             - 产品路线图
```

**简化后只需 4 个页面**,全部静态生成。

---

## 四、核心功能设计

### 4.1 Landing 页

**Hero 区**:
- 大标题: "给灵魂开个 GitHub"
- 副标题 + 描述
- 三个示例 Relic 卡片轮播
- CTA: "体验示例" / "GitHub"

**特性展示**:
- 四维灵魂蒸馏 (可视化图表)
- 七种模板卡片
- 伦理保护框架

**示例展示**:
- 三个 Relic 卡片
- 悬停预览对话
- 点击跳转到 Demo 页

**技术亮点**:
- 开源、本地优先、多平台

**CTA 区**:
- "开始使用" → GitHub
- "查看文档" → docs

### 4.2 Demo 页

**预设对话演示**:

选择 Relic → 显示预设对话

**奶奶王秀兰的对话**:
```javascript
const grandmaDialogs = [
  { user: "奶奶,我今天加班到十一点", relic: "哎呀你这孩子,怎么又恁晚,吃饭了没有" },
  { user: "知道了知道了", relic: "你每次都说知道了,也没见你改。早点睡啊" },
  { user: "今天好冷", relic: "多穿点,别冻着。我跟你说,年轻的时候不注意,老了就知道了" }
];
```

**猫咪咪的对话**:
```javascript
const catDialogs = [
  { user: "咪咪,过来", relic: "喵~ [跳上桌子,尾巴竖起来]" },
  { user: "要吃饭吗", relic: "[围着你的腿转圈,发出急促的喵喵声]" },
  { user: "乖", relic: "[在你手上蹭了蹭,开始呼噜呼噜]" }
];
```

**星火工作室的对话**:
```javascript
const teamDialogs = [
  { user: "这个需求能今天上吗", relic: "PM: 能!\nCTO: 你上次也是这么说的\n实习生: 哈哈哈哈" },
  { user: "有bug", relic: "CTO: 我看看\nPM: 严重吗\n实习生: 我去测试" }
];
```

**交互方式**:
- 用户输入 → 匹配预设回复
- 没有匹配 → 通用回复: "试试问我别的吧"
- 打字机效果
- 可以点击"情景触发"按钮触发特定对话

**情景触发**:
- 🎊 过年问候 → 触发预设的过年对话
- 🎂 生日祝福 → 触发预设的生日对话
- 💭 随机想念 → 随机选一条预设对话

### 4.3 Gallery 页

**展示 3 个示例 Relic**:
- 从 `examples/` 读取数据
- 卡片网格布局
- 点击 → 跳转到 Demo 页

**筛选功能**:
- 纯前端筛选
- 按类型过滤

### 4.4 Roadmap 页

**纯静态展示**:
- 三个阶段
- 已完成/进行中/计划中
- 未来功能卡片

---

## 五、数据结构

### 5.1 示例 Relic 数据

在 `demo-site/data/relics.ts` 中:

```typescript
export const exampleRelics = [
  {
    id: 'grandma',
    slug: 'grandma-demo',
    displayName: '奶奶 · 王秀兰',
    type: 'human',
    description: '会在过年时主动问你"吃饺子了没"',
    coverUrl: '/images/relics/grandma-cover.jpg',
    avatarUrl: '/images/relics/grandma-avatar.jpg',
    dialogs: [
      { user: "...", relic: "..." }
    ],
    scenarios: {
      newYear: { user: "...", relic: "..." },
      birthday: { user: "...", relic: "..." }
    }
  },
  // 猫、团队...
];
```

### 5.2 预设对话数据

每个 Relic 有:
- `dialogs[]` - 通用对话列表
- `scenarios{}` - 情景对话 (过年/生日/想念)
- `fallback` - 兜底回复

---

## 六、组件设计

### 6.1 基础 UI 组件

**Button** - primary/secondary/ghost 变体
**Card** - 玻璃拟态效果
**Badge** - 类型标签
**Avatar** - 圆形头像

### 6.2 Relic 组件

**RelicCard** - 展示 Relic 卡片
**RelicAvatar** - 头像组件
**ChatBubble** - 对话气泡
**ChatInterface** - 对话界面 (预设对话)

### 6.3 动画组件

**TypeWriter** - 打字机效果
**FadeIn** - 淡入动画
**SlideIn** - 滑入动画
**FloatingCard** - 漂浮卡片

---

## 七、视觉设计

### 7.1 色彩

严格遵守 `.reference/DESIGN_STANDARDS.md`:
- 品牌蓝: #3b82c4
- 玻璃拟态效果
- 温暖渐变

### 7.2 动效

- 页面过渡: 300ms
- 卡片悬停: 上浮 + 发光
- 对话出现: 打字机效果
- 流畅的滚动动画

### 7.3 响应式

- 移动端优先
- 平板适配
- 桌面端最佳体验

---

## 八、开发计划

### Phase 1: 项目搭建 (0.5天)

- [x] 创建 Next.js 项目
- [ ] 配置 Tailwind CSS
- [ ] 设置品牌色
- [ ] 创建基础布局

### Phase 2: 基础组件 (1天)

- [ ] Button/Card/Badge/Avatar
- [ ] RelicCard/RelicAvatar
- [ ] ChatBubble/ChatInterface
- [ ] TypeWriter/FadeIn/SlideIn

### Phase 3: Landing 页 (1天)

- [ ] Hero 区
- [ ] 特性展示区
- [ ] 示例 Relic 展示
- [ ] CTA 区

### Phase 4: Demo 页 (1天)

- [ ] Relic 选择
- [ ] 预设对话系统
- [ ] 情景触发
- [ ] 打字机效果

### Phase 5: Gallery 和 Roadmap (0.5天)

- [ ] Gallery 页面
- [ ] Roadmap 页面
- [ ] 筛选功能

### Phase 6: 优化和部署 (1天)

- [ ] 性能优化
- [ ] 移动端适配
- [ ] 静态导出
- [ ] 部署到服务器

**总计**: 约 5 天

---

## 九、部署方案

### 9.1 静态导出

```bash
npm run build
npm run export
```

生成 `out/` 目录,纯静态文件。

### 9.2 Nginx 配置

```nginx
server {
    listen 443 ssl http2;
    server_name relic.luelan.online;

    ssl_certificate /etc/letsencrypt/live/relic.luelan.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relic.luelan.online/privkey.pem;

    root /opt/apps/services/relic-demo/out;
    index index.html;

    location / {
        try_files $uri $uri.html $uri/ =404;
    }

    # 缓存静态资源
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 9.3 部署流程

```bash
# 1. 构建
npm run build

# 2. 上传到服务器
scp -r out/* user@server:/opt/apps/services/relic-demo/

# 3. Nginx 重载
ssh user@server "sudo nginx -s reload"
```

---

## 十、文件结构

```
demo-site/
├── app/
│   ├── page.tsx              # Landing 页
│   ├── demo/
│   │   └── page.tsx          # Demo 页
│   ├── gallery/
│   │   └── page.tsx          # Gallery 页
│   ├── roadmap/
│   │   └── page.tsx          # Roadmap 页
│   ├── layout.tsx            # 根布局
│   └── globals.css           # 全局样式
│
├── components/
│   ├── ui/                   # 基础 UI
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Avatar.tsx
│   ├── relic/                # Relic 组件
│   │   ├── RelicCard.tsx
│   │   ├── RelicAvatar.tsx
│   │   ├── ChatBubble.tsx
│   │   └── ChatInterface.tsx
│   ├── animations/           # 动画组件
│   │   ├── TypeWriter.tsx
│   │   ├── FadeIn.tsx
│   │   └── SlideIn.tsx
│   └── layout/               # 布局组件
│       ├── Header.tsx
│       ├── Footer.tsx
│       └── Container.tsx
│
├── data/
│   └── relics.ts             # 示例 Relic 数据
│
├── lib/
│   ├── utils.ts              # 工具函数
│   └── constants.ts          # 常量
│
├── public/
│   └── images/
│       └── relics/           # Relic 图片
│
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## 十一、关键实现细节

### 11.1 预设对话匹配

```typescript
function matchDialog(userInput: string, dialogs: Dialog[]) {
  // 简单关键词匹配
  const keywords = userInput.toLowerCase();
  
  for (const dialog of dialogs) {
    if (dialog.user.toLowerCase().includes(keywords) ||
        keywords.includes(dialog.user.toLowerCase())) {
      return dialog.relic;
    }
  }
  
  // 兜底回复
  return "试试问我别的吧,或者点击下面的情景触发按钮";
}
```

### 11.2 打字机效果

```typescript
function TypeWriter({ text, speed = 50 }) {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    
    return () => clearInterval(timer);
  }, [text, speed]);
  
  return <span>{displayText}</span>;
}
```

### 11.3 情景触发

```typescript
function triggerScenario(scenario: 'newYear' | 'birthday' | 'random') {
  const relic = currentRelic;
  
  if (scenario === 'random') {
    // 随机选一条对话
    const randomDialog = relic.dialogs[Math.floor(Math.random() * relic.dialogs.length)];
    return randomDialog;
  }
  
  // 返回特定情景对话
  return relic.scenarios[scenario];
}
```

---

## 十二、质量标准

### 12.1 性能

- Lighthouse 分数 > 90
- 首屏加载 < 2s
- 图片懒加载
- 代码分割

### 12.2 视觉

- 严格遵守设计规范
- 动画流畅 (60fps)
- 响应式完美适配
- 无障碍支持

### 12.3 代码

- TypeScript 类型完整
- 组件可复用
- 代码格式化
- 注释清晰

---

## 十三、下一步行动

1. **立即开始开发** - 启动子代理搭建项目
2. **准备资源** - 从 examples 提取图片和数据
3. **并发开发** - 多个子代理同时开发不同页面
4. **快速迭代** - 边开发边预览效果

---

**预计完成时间**: 5 天
**预计上线日期**: 2026-04-16

---

_纯前端方案,快速精美,重点在视觉和文案打动人。_
