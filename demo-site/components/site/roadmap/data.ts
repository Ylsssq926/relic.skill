export interface RoadmapPhase {
  readonly stage: string;
  readonly title: string;
  readonly description: string;
  readonly completed: readonly string[];
  readonly doing: readonly string[];
  readonly planned: readonly string[];
}

export const roadmapPhases: readonly RoadmapPhase[] = [
  {
    stage: "Phase 1",
    title: "基础体验",
    description: "让你能看到、摸到、感受到 Relic 是什么样子。",
    completed: ["首页、体验中心、示例广场、产品路线", "品牌配色、玻璃拟态风格、基础布局与导航", "3 个示例 Relic 与预设对话"],
    doing: ["继续细化页面层级和视觉节奏"],
    planned: ["补齐更多无障碍与细节交互"],
  },
  {
    stage: "Phase 2",
    title: "对话与情景",
    description: "不需要准备素材，直接体验对话和情景触发。",
    completed: ["预设对话匹配", "情景触发入口", "示例广场筛选与搜索"],
    doing: ["持续优化文案温度、卡片气质和动效节奏"],
    planned: ["扩展更多示例与更多预设情景"],
  },
  {
    stage: "Phase 3",
    title: "真实使用",
    description: "从体验走向创建，从示例走向自己的 Relic。",
    completed: ["GitHub、文档、社区入口聚合"],
    doing: ["整理创建流程与后续迭代方向"],
    planned: ["网页化创建流程", "跨平台客户端", "更多模板与分享生态"],
  },
] as const;

export const roadmapFutureCards = [
  "更多示例 Relic 进入广场，不只是 3 个。",
  "情景触发覆盖更多时刻，比如节日、低落、久别重逢。",
  "文档与创建流程衔接得更顺，不需要猜下一步去哪。",
  "体验和真实使用的边界更清楚，知道在哪里玩、在哪里用。",
] as const;
