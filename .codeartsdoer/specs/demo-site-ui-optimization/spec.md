# 需求规格：demo-site UI 优化

## 1. 概述

### 1.1 项目背景

luelan-Immortality 是"万物永生引擎"(relic.skill)的开源项目，demo-site 是其基于 Next.js 16 + React 19 + Tailwind CSS v4 的演示站点。当前站点存在大量 AI 开发常见的样式系统冲突、无效类名、布局缺陷和死代码问题，导致 UI 表现远低于商业级可用标准。本规格旨在系统性地修复所有已识别问题，使 demo-site 达到商业级可用标准。

### 1.2 功能范围

本规格覆盖以下核心优化领域：

1. **Tailwind v4 样式系统统一**：消除 @theme 与 tailwind.config.mjs 的冲突，确立 @theme 为唯一设计令牌来源
2. **无效类名修复**：修正所有不符合 Tailwind v4 语法的类名
3. **布局缺陷修复**：解决输入区重叠、容器冲突、z-index 不一致等布局问题
4. **页面商业级优化**：404 页面、Header 移动端、Gallery 网格、Roadmap 时间线等
5. **死代码与冗余清理**：移除未使用的组件、CSS 类和遗留配置文件
6. **设计系统一致性**：确保所有页面使用统一的设计令牌，消除硬编码值

### 1.3 非目标（排除范围）

- 不涉及功能逻辑变更（如聊天交互逻辑、数据模型等）
- 不涉及新增页面或新增组件
- 不涉及后端 API 或数据层修改
- 不涉及国际化（i18n）改造
- 不涉及深色模式（dark mode）实现
- 不涉及 SEO 优化
- 不涉及性能优化（除 resize debounce 外）

---

## 2. 需求领域

### 2.1 样式系统统一（Style System Unification）

#### REQ-SS-001: @theme 作为唯一设计令牌来源

- **类型**: Ubiquitous
- **描述**: The demo-site 样式系统 shall 以 `globals.css` 中的 `@theme` 块作为所有设计令牌（颜色、间距、圆角、阴影、字体、动画曲线）的唯一权威来源，`tailwind.config.mjs` 中的 theme.extend 配置 shall 不再生效或被引用。
- **验收标准**:
  - Given: Tailwind v4 环境下 @theme 是权威来源
  - When: 检查所有设计令牌定义
  - Then: @theme 中定义的令牌值与实际渲染值一致，tailwind.config.mjs 中的值不产生覆盖

#### REQ-SS-002: 补全 @theme 中缺失的设计令牌

- **类型**: Ubiquitous
- **描述**: The @theme 块 shall 包含当前 `tailwind.config.mjs` 中定义但 @theme 中缺失的所有设计令牌，包括但不限于 `brand-800`、`brand-900`、`ease-exit`。
- **验收标准**:
  - Given: tailwind.config.mjs 中定义了 brand-800 (#1e40af)、brand-900 (#1e3a8a)、ease-exit (cubic-bezier(0.7, 0, 0.84, 0))
  - When: 在组件中使用 `bg-brand-800`、`bg-brand-900`、`ease-exit` 类名
  - Then: 这些类名正确生效，渲染值与 tailwind.config.mjs 中定义一致

#### REQ-SS-003: 圆角令牌使用自定义值而非 Tailwind 内置默认值

- **类型**: Ubiquitous
- **描述**: The 样式系统 shall 确保 `rounded-sm`、`rounded-md`、`rounded-lg`、`rounded-xl` 使用自定义圆角值（12/18/24/32px）而非 Tailwind v4 内置默认值（2/4/8/12px）。
- **验收标准**:
  - Given: @theme 中定义了 --radius-sm: 12px, --radius-md: 18px, --radius-lg: 24px, --radius-xl: 32px
  - When: 组件使用 `rounded-sm`/`rounded-md`/`rounded-lg`/`rounded-xl` 类名
  - Then: 实际渲染的 border-radius 值分别为 12px/18px/24px/32px

#### REQ-SS-004: 响应式排版令牌使用 clamp 值

- **类型**: Ubiquitous
- **描述**: The 样式系统 shall 确保 `text-display`、`text-heading-1`、`text-heading-2`、`text-heading-3` 使用 clamp() 响应式值而非固定像素值，以实现流式排版。
- **验收标准**:
  - Given: @theme 或 CSS 中定义了响应式排版
  - When: 在不同视口宽度下使用 `text-display`/`text-heading-1`/`text-heading-2` 类名
  - Then: 字体大小随视口宽度平滑缩放，而非固定不变

#### REQ-SS-005: 消除自定义 CSS 类与 Tailwind 工具类的同名冲突

- **类型**: Ubiquitous
- **描述**: The 样式系统 shall 消除 `.text-display`、`.text-heading-1`、`.text-heading-2`、`.text-heading-3` 自定义 CSS 类与 Tailwind v4 自动生成工具类之间的同名冲突，确保响应式 clamp 值优先生效。
- **验收标准**:
  - Given: globals.css 中存在与 Tailwind 工具类同名的自定义 CSS 类
  - When: 组件使用 `text-display`/`text-heading-1`/`text-heading-2`/`text-heading-3` 类名
  - Then: 渲染结果使用 clamp() 响应式值，且优先级确定、无歧义

#### REQ-SS-006: 移除冗余自定义 CSS 类

- **类型**: Ubiquitous
- **描述**: The 样式系统 shall 移除与 @theme 自动生成工具类重复的自定义 CSS 类，包括 `.shadow-soft`、`.shadow-medium`、`.shadow-elevated`、`.shadow-card`、`.shadow-brand`、`.ease-interaction`、`.ease-entrance`、`.max-w-container`。
- **验收标准**:
  - Given: @theme 已定义对应的 --shadow-*、--ease-*、--max-width-container 变量
  - When: Tailwind v4 自动生成 `shadow-soft`/`shadow-medium`/`ease-interaction`/`max-w-container` 等工具类
  - Then: 自定义 CSS 类定义被移除，工具类仍正常工作

#### REQ-SS-007: 移除 tailwind.config.mjs 遗留文件

- **类型**: Ubiquitous
- **描述**: The 项目 shall 移除 `tailwind.config.mjs` 文件，因为其在 Tailwind v4 中不生效，仅作为遗留配置产生混淆。
- **验收标准**:
  - Given: Tailwind v4 使用 @theme 而非 tailwind.config.mjs
  - When: 删除 tailwind.config.mjs
  - Then: 项目构建和渲染结果不受影响

---

### 2.2 无效类名修复（Invalid Classname Fix）

#### REQ-IC-001: 修复 text-muted-foreground 为 text-foreground-muted

- **类型**: Ubiquitous
- **描述**: The 所有组件 shall 将 `text-muted-foreground` 类名替换为 Tailwind v4 正确语法 `text-foreground-muted`，涉及 Modal.tsx、Toast.tsx、Input.tsx、Textarea.tsx、UploadZone.tsx 共 15 处。
- **验收标准**:
  - Given: Tailwind v4 中 foreground 颜色命名空间为 `foreground-{variant}`
  - When: 检查所有组件中的 `text-muted-foreground` 用法
  - Then: 全部替换为 `text-foreground-muted`，文字颜色正确渲染为 #78716C

#### REQ-IC-002: 修复 bg-brand-[0.02] 无效语法

- **类型**: Event-Driven
- **描述**: When HomeExampleCard.tsx 中使用品牌色低透明度背景，the 组件 shall 使用 `bg-brand/[0.02]` 语法替代无效的 `bg-brand-[0.02]`。
- **验收标准**:
  - Given: HomeExampleCard.tsx 第51行使用了 `bg-brand-[0.02]`
  - When: 替换为 `bg-brand/[0.02]`
  - Then: 品牌色以 2% 透明度正确渲染为背景色

#### REQ-IC-003: 修复 text-small 未定义类名

- **类型**: Event-Driven
- **描述**: When SectionHeading.tsx 中使用小号文字类名，the 组件 shall 使用已定义的 `text-small`（对应 0.875rem）或等效的 Tailwind 类名 `text-sm`，而非未定义的 `text-small`。
- **验收标准**:
  - Given: SectionHeading.tsx 第50行使用了 `text-small`
  - When: @theme 中定义了 --font-size-small: 0.875rem
  - Then: `text-small` 类名正确生效，渲染为 0.875rem 字号

#### REQ-IC-004: 修复 custom-scrollbar 未定义类名

- **类型**: Event-Driven
- **描述**: When Modal.tsx 中使用自定义滚动条类名，the 组件 shall 移除 `custom-scrollbar` 类名或将其替换为有效的滚动条样式实现。
- **验收标准**:
  - Given: Modal.tsx 第186行使用了 `custom-scrollbar`
  - When: 该类名在 CSS 中未定义
  - Then: 滚动区域正常显示，无样式缺失

#### REQ-IC-005: 修复 scrollbar-thin 等无插件支持的类名

- **类型**: Event-Driven
- **描述**: When DemoRelicSelector.tsx 中使用 `scrollbar-thin`、`scrollbar-thumb-*`、`scrollbar-track-*` 类名，the 组件 shall 移除这些类名或使用 CSS 原生滚动条样式替代，因为项目未安装 tailwind-scrollbar 插件。
- **验收标准**:
  - Given: DemoRelicSelector.tsx 第37行使用了 scrollbar-* 类名
  - When: 项目未安装 tailwind-scrollbar 插件
  - Then: 滚动区域使用全局定义的滚动条样式（globals.css 中的 ::-webkit-scrollbar），无无效类名

#### REQ-IC-006: 修复 canvas 上的 object-cover 无效类名

- **类型**: Event-Driven
- **描述**: When DynamicBackground.tsx 中 canvas 元素使用 `object-cover` 类名，the 组件 shall 移除该类名，因为 `object-fit` 对 canvas 元素无效。
- **验收标准**:
  - Given: DynamicBackground.tsx canvas 元素使用了 `object-cover`
  - When: canvas 元素不支持 object-fit CSS 属性
  - Then: 移除 `object-cover` 类名，canvas 渲染不受影响

---

### 2.3 布局缺陷修复（Layout Defect Fix）

#### REQ-LY-001: ChatInterface 输入区按钮与文本不重叠

- **类型**: Ubiquitous
- **描述**: The ChatInterface 输入区 shall 为底部绝对定位的按钮行预留足够的 padding 空间，确保按钮与 textarea 文本内容不重叠。
- **验收标准**:
  - Given: textarea 使用 `py-3`（12px padding），底部有绝对定位的 h-8（32px）按钮行
  - When: 用户在 textarea 中输入多行文本
  - Then: 文本内容与按钮行之间有清晰间距，无视觉重叠

#### REQ-LY-002: DemoExperience 容器样式与 Container 默认值一致

- **类型**: Ubiquitous
- **描述**: The DemoExperience 组件 shall 使用与 Container 默认值一致的容器样式，消除 `max-w-7xl`（1280px）与 `max-w-container`（1200px）之间的冲突，以及 padding 值的冲突。
- **验收标准**:
  - Given: Container 默认提供 `max-w-container`（1200px）和 `px-5 sm:px-7 lg:px-9`
  - When: DemoExperience 通过 containerClassName 传入 `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
  - Then: 容器宽度统一为 1200px，padding 值一致，无样式冲突

#### REQ-LY-003: Demo 页面 z-index 一致性

- **类型**: Ubiquitous
- **描述**: The 所有页面 shall 使用一致的 z-index 层级策略，DemoExperience 中的 `z-10` shall 被移除或统一到页面布局的 z-index 规范中。
- **验收标准**:
  - Given: DemoExperience 使用 `z-10`，其他页面未使用
  - When: 检查所有页面的 z-index 使用
  - Then: z-index 层级策略一致，无不必要的 z-index 堆叠

#### REQ-LY-004: Header 移动端下拉菜单不截断内容

- **类型**: State-Driven
- **描述**: While Header 移动端下拉菜单展开，the 菜单 shall 完整显示所有导航项和 CTA 按钮，不被 `max-h-80` 截断。
- **验收标准**:
  - Given: Header 移动端菜单使用 `max-h-80`（320px）限制高度
  - When: 菜单包含 5 个导航项 + 1 个 CTA 按钮
  - Then: 所有菜单项完整可见，无截断

#### REQ-LY-005: DemoRelicSelector sticky 定位不被 Header 遮挡

- **类型**: Ubiquitous
- **描述**: The DemoRelicSelector 的 sticky 定位 shall 考虑 Header 的高度，确保选择器不被 Header 遮挡。
- **验收标准**:
  - Given: Header 使用 `sticky top-0`，DemoRelicSelector 使用 `sticky top-24`
  - When: 页面滚动时
  - Then: DemoRelicSelector 始终在 Header 下方完整可见

#### REQ-LY-006: RoadmapTimeline 时间线竖线与节点中心对齐

- **类型**: Ubiquitous
- **描述**: The RoadmapTimeline 时间线竖线 shall 在 md 以上断点与节点圆心水平对齐。
- **验收标准**:
  - Given: 时间线竖线使用 `left-[19px]`（移动端）和 `md:left-[23px]`（桌面端）
  - When: 节点圆直径为 40px（h-10 w-10），圆心位于 20px 处
  - Then: 竖线在所有断点与节点圆心精确对齐

#### REQ-LY-007: GalleryGrid 在容器宽度下正确触发三列布局

- **类型**: Ubiquitous
- **描述**: The GalleryGrid shall 在 `max-w-container`（1200px）容器宽度下正确触发 `xl:grid-cols-3` 三列布局。
- **验收标准**:
  - Given: 容器最大宽度为 1200px，xl 断点为 1280px
  - When: 视口宽度 ≥ 1280px
  - Then: GalleryGrid 正确显示三列布局

#### REQ-LY-008: PageShell 移除多余的 children 包裹 div

- **类型**: Ubiquitous
- **描述**: The PageShell 组件 shall 移除 Container 内部多余的 `<div>{children}</div>` 包裹，直接渲染 children。
- **验收标准**:
  - Given: PageShell 中 Container 内有 `<div>{children}</div>` 包裹
  - When: 移除该 div
  - Then: children 直接作为 Container 的子元素渲染，无额外 DOM 层级

---

### 2.4 页面商业级优化（Page Quality Enhancement）

#### REQ-PQ-001: 404 页面使用设计系统令牌

- **类型**: Ubiquitous
- **描述**: The 404 页面 shall 使用设计系统令牌替代硬编码值，包括背景色、文字颜色等，并包含 Header 和 Footer。
- **验收标准**:
  - Given: 404 页面当前使用 `bg-white`、`text-slate-900`、`text-slate-600` 等非设计系统值
  - When: 替换为设计系统令牌（`bg-background`、`text-foreground`、`text-foreground-secondary`）
  - Then: 404 页面视觉风格与其他页面一致，包含 Header/Footer

#### REQ-PQ-002: DynamicBackground resize 事件使用 debounce

- **类型**: Event-Driven
- **描述**: When 窗口 resize 事件触发，the DynamicBackground shall 使用 debounce（≥150ms）处理 resize 回调，避免高频重绘导致性能问题。
- **验收标准**:
  - Given: DynamicBackground 直接监听 resize 事件无 debounce
  - When: 用户快速调整窗口大小
  - Then: canvas 重绘频率被限制，无卡顿或性能下降

---

### 2.5 死代码与冗余清理（Dead Code Elimination）

#### REQ-DC-001: 移除未使用的组件文件

- **类型**: Ubiquitous
- **描述**: The 项目 shall 移除以下 12 个未使用的组件文件：RelicAvatar.tsx、UploadZone.tsx、Input.tsx、Modal.tsx、Textarea.tsx、GalleryEmptyStateSection.tsx、GalleryFiltersSection.tsx、GalleryGridSection.tsx、GalleryIntroSection.tsx、RoadmapFutureSection.tsx、RoadmapIntroSection.tsx、RoadmapPhasesSection.tsx。
- **验收标准**:
  - Given: 这些组件在项目中无任何导入引用
  - When: 删除这些文件
  - Then: 项目构建成功，无编译错误

#### REQ-DC-002: 移除未使用的 CSS 类

- **类型**: Ubiquitous
- **描述**: The 项目 shall 移除以下 4 个未使用的 CSS 类定义：`.text-gradient-brand`、`.bg-warm-radial`、`.skeleton-shimmer`、`.animate-pulse-soft`。
- **验收标准**:
  - Given: 这些 CSS 类在项目中无任何使用
  - When: 从 globals.css 中移除这些类定义
  - Then: 项目构建和渲染不受影响

#### REQ-DC-003: GalleryGrid 移除向后兼容别名导出

- **类型**: Ubiquitous
- **描述**: The GalleryGrid 组件 shall 移除 `GalleryGridSection` 别名导出，因为该别名已无外部引用。
- **验收标准**:
  - Given: GalleryGrid.tsx 底部有 `export const GalleryGridSection = GalleryGrid`
  - When: 无其他文件导入 GalleryGridSection
  - Then: 移除别名导出，项目构建成功

---

### 2.6 设计系统一致性（Design System Consistency）

#### REQ-DS-001: 消除所有硬编码颜色值

- **类型**: Ubiquitous
- **描述**: The 所有组件 shall 使用设计系统颜色令牌替代硬编码的颜色值（如 `text-slate-900`、`text-slate-600`、`bg-white` 等），确保颜色来源统一。
- **验收标准**:
  - Given: 部分组件使用了 Tailwind 默认色板（slate、amber 等）而非设计系统令牌
  - When: 检查所有组件中的颜色类名
  - Then: 所有颜色均来自设计系统令牌（foreground-*、brand-*、background-*、surface-*、border-*、warm-*），无硬编码默认色板值

#### REQ-DS-002: 统一 z-index 层级规范

- **类型**: Ubiquitous
- **描述**: The 项目 shall 建立统一的 z-index 层级规范并在 @theme 中定义，所有组件的 z-index 值 shall 引用该规范而非硬编码数值。
- **验收标准**:
  - Given: 当前 z-index 值分散硬编码在各组件中（z-50、z-[80]、z-[100] 等）
  - When: 定义 z-index 层级规范
  - Then: 所有 z-index 值有明确的层级语义，无随意数值

---

## 3. 非功能性需求

### 3.1 性能

- **NFR-PERF-001**: DynamicBackground resize debounce 后，resize 期间 CPU 占用率应降低 50% 以上
- **NFR-PERF-002**: 移除死代码后，构建产物（bundle）大小应减小

### 3.2 可维护性

- **NFR-MAINT-001**: 所有设计令牌变更只需修改 @theme 块，无需同步修改其他文件
- **NFR-MAINT-002**: 移除 tailwind.config.mjs 后，新开发者不会因遗留配置产生混淆
- **NFR-MAINT-003**: 组件中无无效类名，所有使用的 Tailwind 类名均能正确生效

### 3.3 兼容性

- **NFR-COMP-001**: 所有修改在 Chrome 120+、Firefox 120+、Safari 17+、Edge 120+ 上表现一致
- **NFR-COMP-002**: 移动端（375px-768px）和桌面端（≥1024px）布局均正确

---

## 4. 约束与假设

### 4.1 技术约束

- **CON-001**: 必须基于 Tailwind CSS v4 的 @theme 机制，不可降级到 v3 配置方式
- **CON-002**: 不可引入新的 npm 依赖（如 tailwind-scrollbar 插件）
- **CON-003**: 不可改变现有组件的公共 API（props 接口）
- **CON-004**: Next.js 16 + React 19 环境不可变更

### 4.2 假设

- **ASM-001**: 当前 @theme 中定义的令牌值是设计意图的正确表达
- **ASM-002**: tailwind.config.mjs 中的值与 @theme 中的值设计意图一致（仅是未被 Tailwind v4 读取）
- **ASM-003**: 未使用的组件确实无外部引用（已通过代码搜索确认）
- **ASM-004**: GalleryGrid 的 xl:grid-cols-3 在修正容器宽度后可正确触发

---

## 5. 术语表

| 术语 | 定义 |
|------|------|
| @theme | Tailwind CSS v4 中定义设计令牌的 CSS at-rule，是设计系统的权威来源 |
| 设计令牌 | 设计系统中可复用的原子级值（颜色、间距、圆角、阴影等） |
| tailwind.config.mjs | Tailwind CSS v3 风格的配置文件，在 v4 中不生效 |
| EARS | Easy Approach to Requirements Syntax，需求规格编写模式 |
| clamp() | CSS 函数，实现响应式流式排版，在最小值和最大值之间根据视口宽度插值 |
| 死代码 | 项目中存在但未被任何其他代码引用的文件或定义 |
| z-index 层级 | CSS 堆叠上下文的层级规范，决定元素在 Z 轴上的渲染顺序 |
| debounce | 限制高频事件触发频率的技术，在指定时间窗口内只执行最后一次 |
