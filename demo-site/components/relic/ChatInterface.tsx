"use client";

import { memo, useEffect, useRef, useState, type FormEvent, type HTMLAttributes } from "react";
import { Mic, SendHorizonal, Sparkles, Trash2, ShieldAlert } from "lucide-react";

import { type Dialog } from "@/data/relics";
import ChatBubble from "@/components/relic/ChatBubble";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/I18nProvider";

export interface ChatInterfaceProps extends HTMLAttributes<HTMLDivElement> {
  readonly relicId: string;
  readonly relicName: string;
  readonly relicAvatar: string;
  readonly dialogs: Dialog[];
  readonly onSendMessage: (message: string) => void;
  readonly onTriggerScenario: (scenario: "newYear" | "birthday" | "random") => void;
  readonly onClearHistory?: () => void;
}

function ChatInterfaceBase({
  relicId: _relicId,
  relicName,
  relicAvatar,
  dialogs,
  onSendMessage,
  onTriggerScenario,
  onClearHistory,
  className,
  ...props
}: ChatInterfaceProps) {
  void _relicId;
  const { dict } = useI18n();
  const [message, setMessage] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [dialogs]);

  const isReplyPending = dialogs.some((dialog) => !dialog.relic.trim());
  const latestCompletedReplyIndex = dialogs.reduce<number>(
    (latestIndex, dialog, index) => {
      if (dialog.relic.trim()) return index;
      return latestIndex;
    },
    -1,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isReplyPending) return;
    onSendMessage(trimmed);
    setMessage("");
  };

  return (
    <div className={cn("flex flex-col glass-panel-heavy rounded-2xl overflow-hidden shadow-elevated transition-colors duration-500 h-full max-h-[calc(100vh-12rem)]", className)} {...props}>
      <div className="relative flex items-center justify-between border-b border-white/50 bg-white/40 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={relicName} src={relicAvatar} size="md" className="ring-2 ring-white/80 shadow-soft" />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 animate-pulse"></span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground font-display flex items-center gap-1.5">
              {relicName}
              <ShieldAlert className="h-4 w-4 text-brand" aria-label="AI Protection" />
            </h3>
            <p className="text-xs font-medium text-brand/80 bg-brand/10 inline-flex px-2 py-0.5 rounded mt-0.5">
              {dict.demo.online}
            </p>
          </div>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1.5 text-xs font-medium text-foreground-secondary border border-white/60 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
          <span>{dict.demo.space}</span>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 space-y-6 overflow-y-auto px-6 py-8 sm:max-h-[36rem]"
      >
        {dialogs.length === 0 ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center text-center px-4 animate-fade-in-up">
            <div className="mb-4 h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center opacity-80 mix-blend-multiply">
               <Sparkles className="h-8 w-8 text-brand" />
            </div>
            <p className="text-lg font-bold text-foreground font-display">{dict.demo.sleepingTitle}</p>
            <p className="mt-2 text-sm text-foreground-muted max-w-sm mx-auto leading-relaxed">
              {dict.demo.sleepingHint(relicName)}
            </p>
          </div>
        ) : (
          dialogs.flatMap((dialog, index) => {
            const items = [
              <ChatBubble
                key={`${index}-user`}
                role="user"
                content={dialog.user}
                timestamp={dialog.timestamp}
                className="animate-fade-in-up"
              />,
            ];

            if (dialog.relic.trim()) {
              items.push(
                <ChatBubble
                  key={`${index}-relic`}
                  role="relic"
                  content={dialog.relic}
                  avatar={relicAvatar}
                  timestamp={dialog.timestamp ? dialog.timestamp + 1_000 : undefined}
                  typing={index === latestCompletedReplyIndex}
                  className="animate-fade-in-up"
                />,
              );
            }

            return items;
          })
        )}

        {isReplyPending ? (
          <div className="flex items-center gap-3 text-sm text-foreground-secondary/70 animate-fade-in-up">
            <Avatar name={relicName} src={relicAvatar} size="sm" className="opacity-50" />
            <span className="flex items-center gap-1">
              {dict.demo.feeling}
              <span className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-brand" style={{ animationDelay: '0ms' }} />
              <span className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-brand" style={{ animationDelay: '150ms' }} />
              <span className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-brand" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/50 bg-white/30 backdrop-blur px-6 py-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground-muted mr-1">
            {dict.demo.quickTry}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full bg-white/60 hover:bg-white text-foreground hover:shadow-soft border border-white focus:ring-brand/20 transition-all text-xs"
            onClick={() => onTriggerScenario("newYear")}
            disabled={isReplyPending}
          >
            {dict.demo.scenarioNewYear}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full bg-white/60 hover:bg-white text-foreground hover:shadow-soft border border-white focus:ring-brand/20 transition-all text-xs"
            onClick={() => onTriggerScenario("birthday")}
            disabled={isReplyPending}
          >
            {dict.demo.scenarioBirthday}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full bg-white/60 hover:bg-white text-foreground hover:shadow-soft border border-white focus:ring-brand/20 transition-all text-xs"
            onClick={() => onTriggerScenario("random")}
            disabled={isReplyPending}
          >
            {dict.demo.scenarioRandom}
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 relative group">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={dict.demo.inputPlaceholder}
            rows={2}
            disabled={isReplyPending}
            className="glass-input w-full resize-none rounded-xl px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-foreground-muted/60 disabled:cursor-not-allowed disabled:opacity-50 pr-24"
          />
          <div className="flex items-center justify-end gap-2 mt-1">
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-foreground-muted hover:text-brand hover:bg-white/50 rounded-full"
                disabled
                title={dict.demo.voiceTitle}
              >
                <Mic className="h-4 w-4" />
                <span className="sr-only">Voice</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-foreground-muted hover:text-red-500 hover:bg-white/50 rounded-full"
                onClick={onClearHistory}
                disabled={!onClearHistory || dialogs.length === 0}
                title={dict.demo.clearTitle}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Clear</span>
              </Button>
            </div>
            <Button
              type="submit"
              size="sm"
              loading={isReplyPending}
              loadingText={dict.demo.thinking}
              icon={<SendHorizonal className="h-4 w-4" />}
              iconPosition="right"
              className="h-8 px-4 rounded-full bg-foreground text-white hover:bg-foreground-secondary focus:ring-foreground/20 shadow-md transform transition-transform hover:scale-105 active:scale-95"
            >
              {dict.demo.send}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ChatInterface = memo(ChatInterfaceBase);
ChatInterface.displayName = "ChatInterface";

export { ChatInterface };
export default ChatInterface;
