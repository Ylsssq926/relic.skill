export const RELIC_TYPES = {
  human: "人类",
  pet: "宠物",
  relationship: "关系",
  team: "团队",
  place: "地方",
  moment: "时刻",
  "public-figure": "公众人物",
  expert: "业务专家",
  "feishu-cli": "飞书 CLI",
} as const;

export type RelicTypeKey = keyof typeof RELIC_TYPES;
export type RelicType = RelicTypeKey;

export interface RelicTypeOption {
  readonly value: RelicTypeKey;
  readonly label: string;
  readonly emoji: string;
  readonly description: string;
  readonly accentFrom: string;
  readonly accentTo: string;
}

export const RELIC_TYPE_OPTIONS: readonly RelicTypeOption[] = [
  {
    value: "human",
    label: "人类",
    emoji: "🧑",
    description: "任何人的思维方式和说话习惯。",
    accentFrom: "#fb923c",
    accentTo: "#fb7185",
  },
  {
    value: "pet",
    label: "宠物",
    emoji: "🐱",
    description: "把陪伴过你的生命留在身边。",
    accentFrom: "#f97316",
    accentTo: "#facc15",
  },
  {
    value: "relationship",
    label: "关系",
    emoji: "💞",
    description: "留住你们之间独有的默契。",
    accentFrom: "#ec4899",
    accentTo: "#a855f7",
  },
  {
    value: "team",
    label: "团队",
    emoji: "🏢",
    description: "人散了，但协作的感觉还在。",
    accentFrom: "#3b82c4",
    accentTo: "#60a5fa",
  },
  {
    value: "place",
    label: "地方",
    emoji: "🏠",
    description: "让有记忆的地方继续回应你。",
    accentFrom: "#f59e0b",
    accentTo: "#fb923c",
  },
  {
    value: "moment",
    label: "时刻",
    emoji: "⏳",
    description: "把重要瞬间做成可再次抵达的入口。",
    accentFrom: "#64748b",
    accentTo: "#3b82c4",
  },
  {
    value: "public-figure",
    label: "公众人物",
    emoji: "🌟",
    description: "用公开资料提炼可对话的认知框架。",
    accentFrom: "#8b5cf6",
    accentTo: "#3b82c4",
  },
  {
    value: "expert",
    label: "业务专家",
    emoji: "💼",
    description: "知识不该随人走，把经验锻造成可对话的数字身份。",
    accentFrom: "#10b981",
    accentTo: "#3b82f6",
  },
  {
    value: "feishu-cli",
    label: "飞书 CLI",
    emoji: "🐦",
    description: "用飞书 CLI 蒸馏协作记忆，让那些一起扛过的夜继续发光。",
    accentFrom: "#3370ff",
    accentTo: "#60a5fa",
  },
] as const;

export const RELIC_TYPE_LOOKUP: Record<RelicTypeKey, RelicTypeOption> = RELIC_TYPE_OPTIONS.reduce(
  (accumulator, item) => {
    accumulator[item.value] = item;
    return accumulator;
  },
  {} as Record<RelicTypeKey, RelicTypeOption>,
);

export const RELIC_TYPE_ACCENTS: Record<RelicTypeKey, string> = {
  human: "from-orange-300/80 via-orange-400/60 to-rose-400/70",
  pet: "from-amber-300/80 via-orange-300/70 to-yellow-300/70",
  relationship: "from-pink-300/80 via-fuchsia-300/70 to-violet-400/70",
  team: "from-brand-300/80 via-brand-400/70 to-indigo-400/70",
  place: "from-amber-500/60 via-yellow-500/50 to-orange-300/60",
  moment: "from-slate-300/70 via-brand-300/60 to-indigo-400/60",
  "public-figure": "from-violet-400/80 via-brand-400/70 to-indigo-400/70",
  expert: "from-emerald-400/80 via-teal-400/70 to-blue-400/70",
  "feishu-cli": "from-blue-400/80 via-blue-500/70 to-indigo-400/70",
};

export const RELIC_TYPE_BADGE_STYLES: Record<RelicTypeKey, string> = {
  human: "border-warm-human/20 bg-warm-human/10 text-warm-human",
  pet: "border-warm-pet/20 bg-warm-pet/10 text-warm-pet",
  relationship: "border-warm-relationship/20 bg-warm-relationship/10 text-warm-relationship",
  team: "border-warm-team/20 bg-warm-team/10 text-warm-team",
  place: "border-warm-place/20 bg-warm-place/10 text-warm-place",
  moment: "border-warm-moment/20 bg-warm-moment/10 text-warm-moment",
  "public-figure": "border-warm-public/20 bg-warm-public/10 text-warm-public",
  expert: "border-emerald-400/20 bg-emerald-500/10 text-emerald-600",
  "feishu-cli": "border-blue-400/20 bg-blue-500/10 text-blue-500",
};

export const GITHUB_URL = "https://github.com/Ylsssq926/relic.skill";
export const DOCS_URL = "https://github.com/Ylsssq926/relic.skill/tree/main/docs";
export const QQ_GROUP = "1098169092";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "https://api.relic.skill";
