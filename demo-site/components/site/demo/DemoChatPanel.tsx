"use client";

import dynamic from "next/dynamic";

import type { Dialog, ExampleRelic } from "@/data/relics";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/components/providers/I18nProvider";

const ChatInterface = dynamic(
  () => import("@/components/relic/ChatInterface"),
  {
    loading: () => {
      return (
        <div className="glass-panel flex min-h-[26rem] items-center justify-center text-center rounded-2xl">
          <div className="space-y-3">
            <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-brand/10" />
            <p className="text-lg font-semibold text-foreground">
              正在载入对话界面
            </p>
            <p className="text-sm text-foreground-muted">马上就能开始对话。</p>
          </div>
        </div>
      );
    },
  },
);

export interface DemoChatPanelProps {
  readonly selectedRelic?: ExampleRelic;
  readonly dialogs: Dialog[];
  readonly onSendMessage: (message: string) => void;
  readonly onTriggerScenario: (scenario: "newYear" | "birthday" | "random") => void;
  readonly onClearHistory: () => void;
}

export default function DemoChatPanel({
  selectedRelic,
  dialogs,
  onSendMessage,
  onTriggerScenario,
  onClearHistory,
}: DemoChatPanelProps) {
  const { dict } = useI18n();

  return (
    <div>
      {selectedRelic ? (
        <ChatInterface
          relicId={selectedRelic.id}
          relicName={selectedRelic.displayName}
          relicAvatar={selectedRelic.avatarUrl}
          dialogs={dialogs}
          onSendMessage={onSendMessage}
          onTriggerScenario={onTriggerScenario}
          onClearHistory={onClearHistory}
        />
      ) : (
        <div className="glass-panel-heavy flex min-h-[26rem] flex-col items-center justify-center text-center rounded-2xl">
          <div className="space-y-3">
            <div className="mx-auto mb-2 h-14 w-14 rounded-full bg-brand/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-brand" />
            </div>
            <p className="text-lg font-bold text-foreground font-display">
              {dict.demo.emptyTitle}
            </p>
            <p className="text-sm text-foreground-muted max-w-xs mx-auto">
              {dict.demo.emptyHint}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
