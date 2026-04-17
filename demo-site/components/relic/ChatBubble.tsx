"use client";

import { memo, type HTMLAttributes } from "react";

import TypeWriter from "@/components/animations/TypeWriter";
import Avatar from "@/components/ui/Avatar";
import { formatDate, cn } from "@/lib/utils";

export interface ChatBubbleProps extends HTMLAttributes<HTMLDivElement> {
  readonly role: "user" | "relic";
  readonly content: string;
  readonly avatar?: string;
  readonly timestamp?: number;
  readonly typing?: boolean;
}

/**
 * ChatBubble — 聊天气泡
 *
 * 升级版：加入微发光、玻璃边缘效果区分不同的身份。
 */
function ChatBubbleBase({
  role,
  content,
  avatar,
  timestamp,
  typing = false,
  className,
  ...props
}: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn("flex gap-3.5", isUser ? "justify-end" : "justify-start", className)}
      {...props}
    >
      {!isUser ? (
        <Avatar name="档案" src={avatar} size="md" className="mt-1 shrink-0 ring-2 ring-white/40 shadow-soft" />
      ) : null}
      <div className={cn("max-w-[78%] sm:max-w-[70%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative rounded-2xl px-5 py-3 text-[15px] leading-relaxed shadow-sm backdrop-blur-md break-words overflow-hidden",
            isUser
              ? "rounded-br-sm bg-brand-gradient text-white shadow-brand"
              : "rounded-bl-sm border border-white/60 bg-white/50 text-foreground-secondary",
          )}
        >
          {typing ? <TypeWriter text={content} speed={34} /> : content}
        </div>
        {timestamp ? (
          <p
            className={cn(
              "mt-2 text-[11px] font-medium text-foreground-faint/80",
              isUser ? "text-right" : "text-left",
            )}
          >
            {formatDate(timestamp)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const ChatBubble = memo(ChatBubbleBase);
ChatBubble.displayName = "ChatBubble";

export { ChatBubble };
export default ChatBubble;
