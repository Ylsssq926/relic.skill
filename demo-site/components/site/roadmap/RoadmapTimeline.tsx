"use client";

import { CheckCircle2, CircleDot, Circle } from "lucide-react";

import { useI18n } from "@/components/providers/I18nProvider";

export interface TimelineStatusProps {
  readonly status: "completed" | "inProgress" | "planned";
}

export default function RoadmapTimeline({ status }: TimelineStatusProps) {
  const { dict } = useI18n();

  const config = {
    completed: {
      icon: CheckCircle2,
      label: dict.roadmap.completed,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    inProgress: {
      icon: CircleDot,
      label: dict.roadmap.inProgress,
      color: "text-brand",
      bgColor: "bg-brand/5",
    },
    planned: {
      icon: Circle,
      label: dict.roadmap.planned,
      color: "text-foreground-faint",
      bgColor: "bg-surface",
    },
  };

  const current = config[status];
  const Icon = current.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${current.bgColor} ${current.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {current.label}
    </div>
  );
}
