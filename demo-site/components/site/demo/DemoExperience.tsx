"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import DemoChatPanel from "@/components/site/demo/DemoChatPanel";
import DemoRelicSelector from "@/components/site/demo/DemoRelicSelector";
import PageShell from "@/components/site/PageShell";
import { exampleRelics, getRelicById, type Dialog } from "@/data/relics";
import { matchDialog } from "@/lib/utils";
import FadeIn from "@/components/animations/FadeIn";
import { useI18n } from "@/components/providers/I18nProvider";

export default function DemoExperience() {
  const { dict } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const queryRelicId = getRelicById(searchParams.get("relic") ?? "")?.id ?? "";
  const fallbackRelicId = exampleRelics[0]?.id ?? "";
  const [selectedRelicId, setSelectedRelicId] = useState<string>(
    queryRelicId || fallbackRelicId,
  );
  const [dialogsByRelic, setDialogsByRelic] = useState<Record<string, Dialog[]>>({});

  const resolvedRelicId = queryRelicId || selectedRelicId || fallbackRelicId;
  const selectedRelic = useMemo(
    () => getRelicById(resolvedRelicId),
    [resolvedRelicId],
  );
  const selectedDialogs = selectedRelic
    ? dialogsByRelic[selectedRelic.id] ?? []
    : [];
  const isReplyPending = selectedDialogs.some((dialog) => !dialog.relic.trim());

  const queueDialog = (message: string, reply: string) => {
    if (!selectedRelic) return;

    const timestamp = Date.now();

    setDialogsByRelic((previous) => ({
      ...previous,
      [selectedRelic.id]: [
        ...(previous[selectedRelic.id] ?? []),
        { user: message, relic: "", timestamp },
      ],
    }));

    window.setTimeout(() => {
      setDialogsByRelic((previous) => ({
        ...previous,
        [selectedRelic.id]: (previous[selectedRelic.id] ?? []).map((dialog) =>
          dialog.timestamp === timestamp
            ? { ...dialog, relic: reply || selectedRelic.fallback }
            : dialog,
        ),
      }));
    }, 720);
  };

  const handleSendMessage = (message: string) => {
    if (!selectedRelic || isReplyPending) return;

    const reply = matchDialog(message, selectedRelic.dialogs) || selectedRelic.fallback;
    queueDialog(message, reply);
  };

  const handleTriggerScenario = (
    scenario: "newYear" | "birthday" | "random",
  ) => {
    if (!selectedRelic || isReplyPending) return;

    if (scenario === "random") {
      const randomDialog =
        selectedRelic.dialogs[Math.floor(Math.random() * selectedRelic.dialogs.length)];
      if (randomDialog) {
        queueDialog(randomDialog.user, randomDialog.relic);
      }
      return;
    }

    const preset = selectedRelic.scenarios[scenario];
    queueDialog(preset.user, preset.relic);
  };

  const handleClearHistory = () => {
    if (!selectedRelic) return;
    setDialogsByRelic((previous) => ({
      ...previous,
      [selectedRelic.id]: [],
    }));
  };

  const handleSelectRelic = (relicId: string) => {
    setSelectedRelicId(relicId);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("relic", relicId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <PageShell mainClassName="pt-10 sm:pt-14">
      <FadeIn>
        <div className="mb-10 text-center sm:text-left space-y-5">
          <p className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand ring-1 ring-inset ring-brand/20">
            {dict.demo.badge}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
            {dict.demo.title}
          </h1>
          <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-foreground-muted">
            {dict.demo.subtitle}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

          <div className="w-full lg:w-80 shrink-0">
            <DemoRelicSelector
              relics={exampleRelics}
              selectedRelic={selectedRelic}
              selectedRelicId={resolvedRelicId}
              onSelectRelic={handleSelectRelic}
            />
          </div>

          <div className="flex-1 min-w-0">
            <DemoChatPanel
              selectedRelic={selectedRelic}
              dialogs={selectedDialogs}
              onSendMessage={handleSendMessage}
              onTriggerScenario={handleTriggerScenario}
              onClearHistory={handleClearHistory}
            />
          </div>

        </div>
      </FadeIn>
    </PageShell>
  );
}
