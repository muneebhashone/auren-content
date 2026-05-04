"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobPayload {
  id: number;
  isoWeek: string;
  status: "running" | "succeeded" | "failed";
  stage: string;
  stageLabel: string;
  totalSlots: number | null;
  currentSlot: number | null;
  inFlight: number;
  postsCreated: number;
  signalsFetched: number;
  errorMessage: string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  elapsedMs: number;
  staleMs: number;
}

interface ApiResponse {
  job: JobPayload | null;
}

const POLL_INTERVAL_MS = 1500;
// Hide a finished banner this long after it finished.
const FINISHED_LINGER_MS = 8_000;
// Treat the job as "stuck" if no progress update for this long.
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GenerationStatusBanner({ isoWeek }: { isoWeek: string }) {
  const router = useRouter();
  const [job, setJob] = React.useState<JobPayload | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const lastStatusRef = React.useRef<string | null>(null);

  // Reset dismissal when the week changes.
  React.useEffect(() => {
    setDismissed(false);
    setJob(null);
    lastStatusRef.current = null;
  }, [isoWeek]);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(
          `/api/generate/status?isoWeek=${encodeURIComponent(isoWeek)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as ApiResponse;
        if (cancelled) return;
        const next = data.job;
        setJob(next);

        // When transitioning from running → succeeded, refresh server data so
        // the new posts show up in the calendar grid.
        if (
          next &&
          lastStatusRef.current === "running" &&
          next.status === "succeeded"
        ) {
          router.refresh();
        }
        lastStatusRef.current = next?.status ?? null;
      } catch {
        // swallow; will retry next tick
      }
      if (!cancelled) {
        const isRunning = lastStatusRef.current === "running";
        timer = setTimeout(tick, isRunning ? POLL_INTERVAL_MS : 4000);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isoWeek, router]);

  if (!job || dismissed) return null;

  // Hide finished banners after the linger window, except for failures (those
  // stay until the user dismisses).
  if (job.status === "succeeded") {
    const since = Date.now() - (job.finishedAt ? Date.parse(job.finishedAt) : 0);
    if (since > FINISHED_LINGER_MS) return null;
  }

  const isRunning = job.status === "running";
  const isStuck = isRunning && job.staleMs > STALE_THRESHOLD_MS;
  const total = job.totalSlots ?? 0;
  const progress =
    total > 0 ? Math.min(100, Math.round((job.postsCreated / total) * 100)) : 0;
  const inFlight = isRunning ? job.inFlight ?? 0 : 0;
  const isSlotStage = isRunning && job.stage === "slot" && total > 0;
  const slotMessage = isSlotStage
    ? `Generating posts · ${job.postsCreated}/${total} done${
        inFlight > 0 ? ` · ${inFlight} in progress` : ""
      }`
    : null;

  const tone =
    job.status === "succeeded"
      ? "border-accent/40 bg-accent/10 text-accent"
      : job.status === "failed"
        ? "border-danger/40 bg-danger/10 text-danger"
        : isStuck
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border bg-bg-elevated/60 text-fg";

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
        tone
      )}
    >
      <span className="flex items-center gap-2">
        {job.status === "running" && !isStuck && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {job.status === "succeeded" && <CheckCircle2 className="h-4 w-4" />}
        {job.status === "failed" && <XCircle className="h-4 w-4" />}
        {isStuck && <AlertTriangle className="h-4 w-4" />}
      </span>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-medium truncate">
            {job.status === "succeeded"
              ? `Generated ${job.postsCreated} post${job.postsCreated === 1 ? "" : "s"} for ${job.isoWeek}`
              : job.status === "failed"
                ? `Generation failed for ${job.isoWeek}`
                : slotMessage ?? job.stageLabel ?? "Working…"}
          </span>
          <span className="font-mono text-[11px] text-fg-subtle">
            {job.isoWeek} · {formatElapsed(job.elapsedMs)}
            {total > 0 ? ` · ${job.postsCreated}/${total} posts` : ""}
            {job.signalsFetched > 0 ? ` · ${job.signalsFetched} signals` : ""}
          </span>
        </div>
        {isRunning && total > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-bg-overlay">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {job.status === "failed" && job.errorMessage && (
          <p className="text-xs text-fg-muted truncate" title={job.errorMessage}>
            {job.errorMessage}
          </p>
        )}
        {isStuck && (
          <p className="text-xs">
            No progress for {formatElapsed(job.staleMs)}. The model may be slow
            or stuck — check the server logs.
          </p>
        )}
      </div>

      {!isRunning && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-fg-muted hover:text-fg"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
