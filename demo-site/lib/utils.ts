import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}

export function formatDate(timestamp: number | string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "无效日期";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getInitials(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "R";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return trimmed.slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function matchDialog(input: string, candidates: readonly { user: string; relic: string }[]): string {
  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return "试试问我别的吧,或者点击下面的情景触发按钮";
  }

  const matched = candidates.find((candidate) => {
    const seed = candidate.user.trim().toLowerCase();
    return seed.includes(normalized) || normalized.includes(seed) || seed.split(/[，。！？,.!?:：\s]+/).some((word) => word && normalized.includes(word));
  });

  return matched?.relic ?? "试试问我别的吧,或者点击下面的情景触发按钮";
}
