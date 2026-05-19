# 技术设计：demo-site UI 优化

## 1. 架构概览

### 1.1 设计目标

将 demo-site 从当前"AI 开发遗留问题累积"状态优化到商业级可用标准，核心策略为：

1. **确立 @theme 单一权威**：所有设计令牌由 `globals.css` 的 `@theme` 块统一定义，消除双源冲突
2. **批量类名修正**：系统性替换所有无效/错误类名，确保每个 Tailwind 类名均能正确生效
3. **布局精确修复**：针对每个布局缺陷进行精确修复，不引入新的布局问题
4. **死代码清除**：移除所有未引用的组件和 CSS 定义，减小维护负担和构建体积
5. **设计令牌统一**：消除硬编码颜色值，所有视觉属性来源于设计系统

### 1.2 技术栈

| 技术 | 版本 | 角色 |
|------|------|------|
| Next.js | 16.2.3 | 应用框架（App Router） |
| React | 19.2.4 | UI 库 |
| Tailwind CSS | v4 | 样式系统（@theme 机制） |
| @tailwindcss/postcss | v4 | PostCSS 插件 |
| class-variance-authority | 0.7.1 | 组件变体管理 |
| tailwind-merge | 3.5.0 | 类名合并去重 |
| framer-motion | 12.38.0 | 动画库 |
| lucide-react | 1.8.0 | 图标库 |
| TypeScript | 5 | 类型系统 |

### 1.3 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    globals.css                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  @theme {                                         │  │
│  │    --color-*        颜色令牌（唯一权威源）         │  │
│  │    --font-*         字体令牌                       │  │
│  │    --font-size-*    排版令牌（含 clamp 响应式）    │  │
│  │    --radius-*       圆角令牌                       │  │
│  │    --shadow-*       阴影令牌                       │  │
│  │    --ease-*         动画曲线令牌                   │  │
│  │    --max-width-*    容器宽度令牌                   │  │
│  │    --z-index-*      层级令牌（新增）               │  │
│  │  }                                                │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  :root { --space-section, --space-section-sm }    │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  自定义 CSS 类（仅保留 @theme 无法生成的）        │  │
│  │  .bg-brand-gradient, .text-gradient-brand(删)     │  │
│  │  .bg-warm-gradient, .bg-warm-radial(删)          │  │
│  │  .card-hover, .glass-panel*, .glass-input         │  │
│  │  .glow-brand, .animate-*, .typewriter-cursor      │  │
│  │  .text-display/heading-1/2/3（改为 @layer 控制）  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │ Tailwind v4 自动生成工具类
          ▼
┌─────────────────────────────────────────────────────────┐
│              组件层 (.tsx)                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  layout  │ │   site   │ │  relic   │ │    ui    │  │
│  │ Header   │ │ PageShell│ │ChatIntfc │ │ Button   │  │
│  │ Footer   │ │ Surface  │ │ RelicCard│ │ Avatar   │  │
│  │ Container│ │ Section* │ │ ChatBble │ │ Badge    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

**关键架构决策**：`tailwind.config.mjs` 被移除后，`@theme` 成为唯一设计令牌源。Tailwind v4 的 `@tailwindcss/postcss` 插件直接读取 `@theme` 块生成工具类，无需配置文件。

---

## 2. 样式系统设计

### 2.1 @theme 令牌补全方案

当前 `@theme` 缺失以下令牌（来源于 `tailwind.config.mjs`），需补全：

```css
@theme {
  /* ---- 新增：Brand 色板补全 ---- */
  --color-brand-800: #1e40af;
  --color-brand-900: #1e3a8a;

  /* ---- 新增：动画曲线补全 ---- */
  --ease-exit: cubic-bezier(0.7, 0, 0.84, 0);

  /* ---- 新增：z-index 层级规范 ---- */
  --z-index-base: 0;
  --z-index-dropdown: 10;
  --z-index-sticky: 20;
  --z-index-overlay: 40;
  --z-index-modal: 50;
  --z-index-toast: 60;

  /* ---- 修正：圆角令牌使用 --radius-* 命名空间 ---- */
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
  --radius-xl: 32px;

  /* ---- 修正：排版令牌使用 clamp 响应式值 ---- */
  --font-size-display: clamp(2.5rem, 5vw + 1rem, 4.5rem);
  --font-size-heading-1: clamp(2rem, 4vw + 0.5rem, 3rem);
  --font-size-heading-2: clamp(1.5rem, 3vw + 0.25rem, 2.25rem);
  --font-size-heading-3: 1.375rem;
  --font-size-small: 0.875rem;
}
```

**设计决策**：

- **圆角令牌命名**：将 `--radius-card-sm/md/lg/xl` 改为 `--radius-sm/md/lg/xl`，使 Tailwind 自动生成 `rounded-sm`/`rounded-md`/`rounded-lg`/`rounded-xl` 工具类，值分别为 12/18/24/32px
- **排版令牌值**：将固定像素值改为 `clamp()` 响应式值，与当前自定义 CSS 类 `.text-display` 等的值保持一致
- **z-index 令牌**：新增 `--z-index-*` 系列，建立语义化层级规范

### 2.2 自定义 CSS 类冲突解决策略

**问题**：`.text-display`、`.text-heading-1`、`.text-heading-2`、`.text-heading-3` 自定义 CSS 类与 Tailwind v4 从 `@theme` 中 `--font-size-*` 自动生成的同名工具类冲突。

**方案**：使用 `@layer` 控制优先级。将自定义响应式排版类放入 `@layer components`，Tailwind 工具类在 `@layer utilities`。由于 `@theme` 中的 `--font-size-*` 已使用 clamp 值，自动生成的工具类本身就包含响应式值，因此**直接删除自定义 CSS 类**，完全依赖 @theme 生成的工具类。

但需注意：@theme 的 `--font-size-display` 只控制 `font-size`，而自定义类还包含 `line-height`、`letter-spacing`、`font-weight`。解决方案：

**在 @theme 中使用复合字体大小定义**（Tailwind v4 支持）：

```css
@theme {
  --font-size-display: clamp(2.5rem, 5vw + 1rem, 4.5rem);
  --font-size-display--line-height: 1.08;
  --font-size-display--letter-spacing: -0.02em;
  --font-size-display--font-weight: 800;
}
```

> **注意**：Tailwind v4 的 `--font-size-*` 复合定义语法为 `--font-size-{name}--line-height` 和 `--font-size-{name}--letter-spacing`。`font-weight` 不在复合定义支持范围内，需在组件中通过 `font-extrabold`/`font-bold`/`font-semibold` 类名显式指定。

因此最终方案为：

1. 在 @theme 中定义 `--font-size-display` 等使用 clamp 值，并附带 `--line-height` 和 `--letter-spacing`
2. 删除自定义 `.text-display`/`.text-heading-1`/`.text-heading-2`/`.text-heading-3` CSS 类
3. 组件中 `font-weight` 通过 Tailwind 工具类显式指定（当前组件已在使用，如 `font-extrabold`、`font-bold`）

### 2.3 冗余 CSS 类移除清单

以下自定义 CSS 类与 @theme 自动生成的工具类重复，需移除：

| 自定义类 | @theme 对应变量 | 自动生成工具类 |
|----------|-----------------|----------------|
| `.shadow-soft` | `--shadow-soft` | `shadow-soft` |
| `.shadow-medium` | `--shadow-medium` | `shadow-medium` |
| `.shadow-elevated` | `--shadow-elevated` | `shadow-elevated` |
| `.shadow-card` | `--shadow-card` | `shadow-card` |
| `.shadow-brand` | `--shadow-brand` | `shadow-brand` |
| `.ease-interaction` | `--ease-interaction` | `ease-interaction` |
| `.ease-entrance` | `--ease-entrance` | `ease-entrance` |
| `.max-w-container` | `--max-width-container` | `max-w-container` |

以下自定义 CSS 类未被使用，需移除：

| 未使用类 | 所在位置 |
|----------|----------|
| `.text-gradient-brand` | globals.css 第176-181行 |
| `.bg-warm-radial` | globals.css 第187-189行 |
| `.skeleton-shimmer` | globals.css 第267-271行 |
| `.animate-pulse-soft` | globals.css 第256行 |

### 2.4 无效类名替换映射

| 无效类名 | 正确类名 | 涉及文件 | 出现次数 |
|----------|----------|----------|----------|
| `text-muted-foreground` | `text-foreground-muted` | Modal.tsx, Toast.tsx, Input.tsx, Textarea.tsx, UploadZone.tsx | 15 |
| `bg-brand-[0.02]` | `bg-brand/[0.02]` | HomeExampleCard.tsx | 1 |
| `text-small` | `text-small`（需在 @theme 中定义 `--font-size-small`） | SectionHeading.tsx | 1 |
| `custom-scrollbar` | 移除 | Modal.tsx | 1 |
| `scrollbar-thin` 等 | 移除 | DemoRelicSelector.tsx | 1组 |
| `object-cover`（canvas） | 移除 | DynamicBackground.tsx | 1 |

---

## 3. 布局系统设计

### 3.1 ChatInterface 输入区修复

**问题**：textarea `py-3`（12px 上下 padding）不足以容纳底部绝对定位的按钮行（h-8 = 32px），导致文本与按钮重叠。

**方案**：增加 textarea 底部 padding，为按钮行预留空间。

```
修改前: className="... px-4 py-3 ..."
修改后: className="... px-4 pt-3 pb-12 ..."
```

`pb-12`（48px）= 按钮行高度 32px + 间距 16px，确保文本内容不被遮挡。

### 3.2 DemoExperience 容器冲突修复

**问题**：`containerClassName="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-6 sm:py-10"` 与 Container 默认值 `max-w-container px-5 sm:px-7 lg:px-9` 冲突。

**方案**：移除 containerClassName 中的冲突值，仅保留必要的额外样式。

```
修改前: containerClassName="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-6 sm:py-10"
修改后: containerClassName="relative py-6 sm:py-10"
```

- `max-w-7xl` → 移除（Container 默认 `max-w-container` = 1200px 已足够）
- `mx-auto` → 移除（Container 默认已包含）
- `px-4 sm:px-6 lg:px-8` → 移除（Container 默认 `px-5 sm:px-7 lg:px-9` 已足够）
- `z-10` → 移除（无不必要，见 3.3）
- `relative py-6 sm:py-10` → 保留（页面特定间距）

### 3.3 z-index 层级规范

**当前 z-index 使用情况**：

| 组件 | 当前值 | 语义 |
|------|--------|------|
| layout.tsx body | `z-0` | 基础层 |
| DynamicBackground canvas | `-z-10` | 背景层 |
| RoadmapTimeline 节点 | `z-10` | 内容层（相对定位上下文） |
| DemoExperience | `z-10` | ❌ 不必要 |
| Header | `z-50` | 固定导航层 |
| Modal 遮罩 | `z-[80]` | 弹窗层 |
| Modal 面板 | `z-10`（相对弹窗内） | 弹窗内容 |
| Toast | `z-[100]` | 通知层 |

**规范方案**：在 @theme 中定义 z-index 令牌，组件引用令牌而非硬编码数值。

```css
@theme {
  --z-index-background: -10;
  --z-index-base: 0;
  --z-index-content: 10;
  --z-index-header: 50;
  --z-index-modal: 80;
  --z-index-toast: 100;
}
```

组件替换映射：

| 组件 | 修改前 | 修改后 |
|------|--------|--------|
| layout.tsx body | `z-0` | `z-base` |
| DynamicBackground | `-z-10` | `-z-background` |
| RoadmapTimeline 节点 | `z-10` | `z-content` |
| DemoExperience | `z-10` | 移除 |
| Header | `z-50` | `z-header` |
| Modal 遮罩 | `z-[80]` | `z-modal` |
| Toast | `z-[100]` | `z-toast` |

### 3.4 Header 移动端菜单修复

**问题**：`max-h-80`（320px）可能截断 5 个导航项 + 1 个 CTA 按钮。

**方案**：将 `max-h-80` 改为 `max-h-96`（384px），确保所有内容完整显示。

```
修改前: open ? "max-h-80 opacity-100 pb-3" : "max-h-0 opacity-0"
修改后: open ? "max-h-96 opacity-100 pb-3" : "max-h-0 opacity-0"
```

### 3.5 DemoRelicSelector sticky 定位修复

**问题**：`sticky top-24`（96px）可能被 Header 遮挡。Header 高度约为 `pt-3 + py-2.5 + 内容 ≈ 56px`（移动端）到 `pt-4 + py-2.5 + 内容 ≈ 60px`（桌面端）。

**方案**：`top-24`（96px）已足够容纳 Header 高度（~60px）+ 间距。但需验证在滚动时 Header 的 `sticky top-0` 与 DemoRelicSelector 的 `sticky top-24` 协同工作。当前值合理，保持不变，但需在实现时验证。

### 3.6 RoadmapTimeline 对齐修复

**问题**：时间线竖线 `left-[19px]`（移动端）/ `md:left-[23px]`（桌面端）与节点圆心（h-10 w-10 = 40px，圆心 20px）不对齐。

**方案**：竖线 left 值应为节点圆心位置，即 `left-[20px]`。移动端和桌面端节点大小相同（h-10 w-10），因此统一为 `left-[20px]`。

```
修改前: className="absolute left-[19px] top-6 bottom-6 w-px bg-border md:left-[23px]"
修改后: className="absolute left-5 top-6 bottom-6 w-px bg-border"
```

`left-5` = 20px（Tailwind spacing scale），与 40px 节点的圆心精确对齐。

### 3.7 GalleryGrid 三列布局修复

**问题**：容器 `max-w-container`（1200px），而 `xl:grid-cols-3` 的触发条件是视口 ≥ 1280px。当视口 = 1280px 时，容器宽度 = 1280 - padding ≈ 1246px，三列布局可以触发。但实际问题是容器内 Surface 组件的 padding 进一步压缩了可用宽度。

**方案**：将 `xl:grid-cols-3` 改为 `lg:grid-cols-3`，使三列在视口 ≥ 1024px 时触发，确保在 1200px 容器宽度下有足够空间。

```
修改前: className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
修改后: className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
```

### 3.8 PageShell 多余 div 移除

**方案**：移除 Container 内的 `<div>{children}</div>` 包裹。

```tsx
修改前:
<Container className={containerClassName}>
  <div>{children}</div>
</Container>

修改后:
<Container className={containerClassName}>
  {children}
</Container>
```

---

## 4. 页面优化设计

### 4.1 404 页面重构

**当前问题**：
- 使用 `bg-white` 而非 `bg-background`
- 使用 `text-slate-900`/`text-slate-600` 而非设计系统令牌
- 缺少 Header/Footer

**方案**：使用 PageShell 包裹，替换所有硬编码颜色。

```tsx
修改后结构:
<PageShell>
  <Surface tone="elevated" padding="none" className="mx-auto max-w-2xl rounded-[32px] px-8 py-14 text-center">
    <p className="text-sm font-semibold tracking-[0.18em] text-brand">页面未找到</p>
    <h1 className="mt-4 text-6xl font-bold text-brand">404</h1>
    <p className="mt-4 text-xl text-foreground">你访问的页面不存在</p>
    <p className="mt-3 text-sm leading-7 text-foreground-secondary">这个地址可能已经调整，或者当前并没有对应内容。</p>
    <Link href="/" className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-brand transition-all duration-300 hover:-translate-y-0.5">
      返回首页
    </Link>
  </Surface>
</PageShell>
```

颜色替换映射：
- `bg-white` → 移除（PageShell 提供 `bg-background`）
- `text-slate-900` → `text-foreground`
- `text-slate-600` → `text-foreground-secondary`
- `shadow-[0_16px_36px_-24px_rgba(59,130,196,0.72)]` → `shadow-brand`（简化）

### 4.2 DynamicBackground resize debounce

**方案**：在 useEffect 中添加 debounce 逻辑。

```typescript
// 在 useEffect 内部：
const DEBOUNCE_MS = 200;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

const handleResize = () => {
  if (resizeTimer !== null) {
    clearTimeout(resizeTimer);
  }
  resizeTimer = setTimeout(() => {
    init();
  }, DEBOUNCE_MS);
};

window.addEventListener("resize", handleResize, { passive: true });

// cleanup:
return () => {
  if (resizeTimer !== null) {
    clearTimeout(resizeTimer);
  }
  window.removeEventListener("resize", handleResize);
  cancelAnimationFrame(animationFrameId);
};
```

---

## 5. 死代码清除设计

### 5.1 未使用组件文件删除清单

| 文件路径 | 原因 |
|----------|------|
| `components/relic/RelicAvatar.tsx` | 无导入引用 |
| `components/relic/UploadZone.tsx` | 无导入引用（注意：此文件含 text-muted-foreground，但整体未使用，直接删除） |
| `components/ui/Input.tsx` | 无导入引用 |
| `components/ui/Modal.tsx` | 无导入引用 |
| `components/ui/Textarea.tsx` | 无导入引用 |
| `components/site/gallery/GalleryEmptyStateSection.tsx` | 无导入引用 |
| `components/site/gallery/GalleryFiltersSection.tsx` | 无导入引用 |
| `components/site/gallery/GalleryGridSection.tsx` | 无导入引用（GalleryGrid.tsx 中的别名导出也一并移除） |
| `components/site/gallery/GalleryIntroSection.tsx` | 无导入引用 |
| `components/site/roadmap/RoadmapFutureSection.tsx` | 无导入引用 |
| `components/site/roadmap/RoadmapIntroSection.tsx` | 无导入引用 |
| `components/site/roadmap/RoadmapPhasesSection.tsx` | 无导入引用 |

### 5.2 遗留配置文件删除

| 文件路径 | 原因 |
|----------|------|
| `tailwind.config.mjs` | Tailwind v4 不读取此文件，@theme 是唯一配置源 |

### 5.3 GalleryGrid 别名导出移除

```tsx
// 删除以下行：
export const GalleryGridSection = GalleryGrid;
```

---

## 6. 设计系统一致性设计

### 6.1 硬编码颜色替换策略

**原则**：所有语义颜色必须使用设计系统令牌。但**状态色**（emerald/amber/rose）属于功能性颜色，不在设计系统令牌范围内，可保留。

**替换映射**：

| 硬编码类名 | 替换为 | 上下文 |
|------------|--------|--------|
| `bg-white` | `bg-surface` | 404 页面、各组件 |
| `text-slate-900` | `text-foreground` | 404 页面 |
| `text-slate-600` | `text-foreground-secondary` | 404 页面 |
| `text-amber-500` | 保留（状态色） | ChatInterface |
| `text-emerald-500` | 保留（状态色） | UploadZone、RoadmapTimeline |
| `bg-emerald-50/50` | 保留（状态色） | RoadmapTimeline |
| `text-emerald-700` | 保留（状态色） | RoadmapTimeline |
| `bg-amber-50/50` | 保留（状态色） | RoadmapTimeline |
| `text-amber-700` | 保留（状态色） | RoadmapTimeline |
| `bg-emerald-500` | 保留（状态色） | Toast、UploadZone |
| `bg-rose-500` | 保留（状态色） | Toast |
| `text-amber-950` | 保留（状态色） | Toast |

### 6.2 z-index 令牌化

见 3.3 节 z-index 层级规范设计。

---

## 7. 文件变更清单

### 7.1 修改文件

| 文件 | 变更类型 | 涉及需求 |
|------|----------|----------|
| `app/globals.css` | 重构 @theme + 删除冗余 CSS 类 | REQ-SS-001~007, REQ-IC-003~004, REQ-DC-002, REQ-DS-001~002 |
| `app/not-found.tsx` | 使用 PageShell + 替换硬编码颜色 | REQ-PQ-001, REQ-DS-001 |
| `components/layout/Header.tsx` | max-h 修复 + z-index 令牌化 | REQ-LY-004, REQ-DS-002 |
| `components/layout/Container.tsx` | 无变更（默认值已正确） | — |
| `components/site/PageShell.tsx` | 移除多余 div | REQ-LY-008 |
| `components/site/Surface.tsx` | 无变更（rounded-lg/xl 在 @theme 修正后自动生效） | — |
| `components/site/SectionHeading.tsx` | text-small 修复 | REQ-IC-003 |
| `components/site/demo/DemoExperience.tsx` | 容器冲突修复 + z-index 移除 | REQ-LY-002, REQ-LY-003 |
| `components/site/demo/DemoRelicSelector.tsx` | 移除 scrollbar-* 类名 | REQ-IC-005 |
| `components/site/gallery/GalleryGrid.tsx` | 断点修复 + 移除别名导出 | REQ-LY-007, REQ-DC-003 |
| `components/site/roadmap/RoadmapTimeline.tsx` | 竖线对齐修复 | REQ-LY-006 |
| `components/relic/ChatInterface.tsx` | 输入区 padding 修复 | REQ-LY-001 |
| `components/relic/RelicCard.tsx` | 无变更（已使用设计系统令牌） | — |
| `components/ui/Toast.tsx` | text-muted-foreground 修复 + z-index 令牌化 | REQ-IC-001, REQ-DS-002 |
| `components/ui/Badge.tsx` | 无变更 | — |
| `components/ui/Button.tsx` | 无变更 | — |
| `components/ui/Avatar.tsx` | 无变更 | — |
| `components/ui/Card.tsx` | 无变更 | — |
| `components/animations/DynamicBackground.tsx` | debounce + 移除 object-cover + z-index 令牌化 | REQ-PQ-002, REQ-IC-006, REQ-DS-002 |
| `app/layout.tsx` | z-index 令牌化 | REQ-DS-002 |

### 7.2 删除文件

| 文件 | 涉及需求 |
|------|----------|
| `tailwind.config.mjs` | REQ-SS-007 |
| `components/relic/RelicAvatar.tsx` | REQ-DC-001 |
| `components/relic/UploadZone.tsx` | REQ-DC-001 |
| `components/ui/Input.tsx` | REQ-DC-001 |
| `components/ui/Modal.tsx` | REQ-DC-001 |
| `components/ui/Textarea.tsx` | REQ-DC-001 |
| `components/site/gallery/GalleryEmptyStateSection.tsx` | REQ-DC-001 |
| `components/site/gallery/GalleryFiltersSection.tsx` | REQ-DC-001 |
| `components/site/gallery/GalleryGridSection.tsx` | REQ-DC-001 |
| `components/site/gallery/GalleryIntroSection.tsx` | REQ-DC-001 |
| `components/site/roadmap/RoadmapFutureSection.tsx` | REQ-DC-001 |
| `components/site/roadmap/RoadmapIntroSection.tsx` | REQ-DC-001 |
| `components/site/roadmap/RoadmapPhasesSection.tsx` | REQ-DC-001 |

### 7.3 不变文件

以下文件经分析无需修改：

- `components/layout/Container.tsx` — 默认值已正确
- `components/layout/Footer.tsx` — 已使用设计系统令牌
- `components/site/Surface.tsx` — rounded-lg/xl 在 @theme 修正后自动生效
- `components/relic/RelicCard.tsx` — 已使用设计系统令牌
- `components/relic/ChatBubble.tsx` — 需检查但预计无问题
- `components/ui/Badge.tsx`、`Button.tsx`、`Avatar.tsx`、`Card.tsx` — 已使用设计系统令牌
- `lib/utils.ts`、`lib/constants.ts` — 纯逻辑/常量，无样式问题
- `data/*` — 数据文件，无样式问题

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| @theme 圆角令牌重命名（--radius-card-sm → --radius-sm）导致使用 `rounded-card-sm` 的组件失效 | 中 | 全局搜索 `rounded-card-sm` 等并替换为 `rounded-sm`；当前代码中未使用 `rounded-card-*` 类名，风险低 |
| 删除自定义 `.text-display` 等类后，@theme 生成的工具类可能不包含 line-height/letter-spacing | 高 | 在 @theme 中使用复合字体大小定义（`--font-size-display--line-height` 等），确保完整排版属性 |
| 删除 UploadZone.tsx 等文件后，如有未发现的隐式引用会导致构建失败 | 中 | 删除后立即执行 `npm run build` 验证 |
| z-index 令牌化后，Tailwind v4 可能不自动生成 `z-base`/`z-header` 等工具类 | 中 | 验证 Tailwind v4 对 `--z-index-*` 变量的工具类生成行为；如不支持，改用 `--z-*` 命名 |
| GalleryGrid 改为 `lg:grid-cols-3` 后，在 1024px 视口下三列可能过窄 | 低 | 每列最小宽度 ≈ (1024 - padding) / 3 ≈ 310px，对卡片布局足够 |
