"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatIsoWeek, isoWeekRange, nextIsoWeek } from "@/lib/utils";
import { format } from "date-fns";
import type { Persona } from "@/lib/db/schema";

function prevIsoWeek(isoWeek: string): string {
  const { start } = isoWeekRange(isoWeek);
  const prev = new Date(start);
  prev.setUTCDate(start.getUTCDate() - 7);
  const target = new Date(
    Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate())
  );
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function CalendarToolbar({
  isoWeek,
  personas,
  selectedPersonaIds,
  platform,
  view,
}: {
  isoWeek: string;
  personas: Persona[];
  selectedPersonaIds: number[];
  platform: "all" | "x" | "linkedin" | "reddit";
  view: "calendar" | "kanban";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState<null | "current" | "next">(null);

  const { start, end } = isoWeekRange(isoWeek);
  const label = `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;

  function buildQuery(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    params.set("week", isoWeek);
    if (selectedPersonaIds.length > 0)
      params.set("personas", selectedPersonaIds.join(","));
    if (platform !== "all") params.set("platform", platform);
    if (view !== "calendar") params.set("view", view);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function navigate(overrides: Record<string, string | null>) {
    startTransition(() => {
      router.push(buildQuery(overrides));
    });
  }

  function togglePersona(id: number) {
    const next = selectedPersonaIds.includes(id)
      ? selectedPersonaIds.filter((x) => x !== id)
      : [...selectedPersonaIds, id];
    navigate({ personas: next.length === 0 ? null : next.join(",") });
  }

  async function handleGenerate(mode: "current" | "next") {
    setGenerating(mode);
    try {
      const res = await fetch("/api/generate/week", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        isoWeek?: string;
        jobId?: number;
        error?: string;
        alreadyRunning?: boolean;
      };
      if (!res.ok && !data.alreadyRunning) {
        throw new Error(data.error || "Failed to generate");
      }
      const fallback = mode === "current" ? formatIsoWeek() : nextIsoWeek(isoWeek);
      const target = data.isoWeek ?? fallback;
      router.push(`/?week=${target}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Generation failed: " + (err as Error).message);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-elevated/40 p-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ week: prevIsoWeek(isoWeek) })}
          disabled={isPending}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-center px-2 leading-tight">
          <span className="font-mono text-[11px] text-fg-subtle">{isoWeek}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ week: nextIsoWeek(isoWeek) })}
          disabled={isPending}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-2 h-6 w-px bg-border" />

      <div className="flex flex-wrap items-center gap-1.5">
        {personas.map((p) => {
          const active = selectedPersonaIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePersona(p.id)}
              disabled={isPending}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
              )}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="mx-2 h-6 w-px bg-border" />

      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {(["all", "x", "linkedin", "reddit"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() =>
              navigate({ platform: opt === "all" ? null : opt })
            }
            disabled={isPending}
            className={cn(
              "rounded px-2.5 py-1 text-xs capitalize transition-colors",
              platform === opt
                ? "bg-bg-overlay text-fg"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {opt === "x"
              ? "X"
              : opt === "linkedin"
                ? "LinkedIn"
                : opt === "reddit"
                  ? "Reddit"
                  : "All"}
          </button>
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-border" />

      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {(["calendar", "kanban"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() =>
              navigate({ view: opt === "calendar" ? null : opt })
            }
            disabled={isPending}
            className={cn(
              "rounded px-2.5 py-1 text-xs capitalize transition-colors",
              view === opt
                ? "bg-bg-overlay text-fg"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => handleGenerate("current")}
          disabled={generating !== null}
        >
          {generating === "current" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating === "current" ? "Generating…" : "Generate this week"}
        </Button>
        <Button
          onClick={() => handleGenerate("next")}
          disabled={generating !== null}
        >
          {generating === "next" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating === "next" ? "Generating…" : "Generate next week"}
        </Button>
      </div>
    </div>
  );
}
