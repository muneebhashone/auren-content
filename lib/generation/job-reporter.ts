import { db } from "@/lib/db/client";
import { generationJobs, type GenerationJob } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const JOB_LOG = process.env.JOB_LOG !== "0";

function nowIso(): string {
  return new Date().toISOString();
}

function log(...args: unknown[]) {
  if (JOB_LOG) console.log("[job]", ...args);
}

export class JobAlreadyRunningError extends Error {
  constructor(public jobId: number) {
    super(`A generation job is already running for this week (id=${jobId}).`);
    this.name = "JobAlreadyRunningError";
  }
}

export class JobReporter {
  constructor(public readonly jobId: number, public readonly isoWeek: string) {}

  async stage(stage: string, label: string): Promise<void> {
    log(`#${this.jobId} ${stage}: ${label}`);
    await db
      .update(generationJobs)
      .set({ stage, stageLabel: label, updatedAt: nowIso() })
      .where(eq(generationJobs.id, this.jobId));
  }

  async setTotalSlots(n: number): Promise<void> {
    log(`#${this.jobId} total_slots=${n}`);
    await db
      .update(generationJobs)
      .set({ totalSlots: n, updatedAt: nowIso() })
      .where(eq(generationJobs.id, this.jobId));
  }

  async beginSlot(index: number, label: string): Promise<void> {
    log(`#${this.jobId} slot ${index}: ${label}`);
    await db
      .update(generationJobs)
      .set({
        stage: "slot",
        currentSlot: index,
        stageLabel: label,
        updatedAt: nowIso(),
      })
      .where(eq(generationJobs.id, this.jobId));
  }

  async completedPost(): Promise<void> {
    await db
      .update(generationJobs)
      .set({
        postsCreated: sql`${generationJobs.postsCreated} + 1`,
        updatedAt: nowIso(),
      })
      .where(eq(generationJobs.id, this.jobId));
  }

  async startSlot(): Promise<void> {
    await db
      .update(generationJobs)
      .set({
        stage: "slot",
        inFlight: sql`${generationJobs.inFlight} + 1`,
        updatedAt: nowIso(),
      })
      .where(eq(generationJobs.id, this.jobId));
  }

  async endSlot(): Promise<void> {
    await db
      .update(generationJobs)
      .set({
        inFlight: sql`MAX(${generationJobs.inFlight} - 1, 0)`,
        updatedAt: nowIso(),
      })
      .where(eq(generationJobs.id, this.jobId));
  }

  async signalsFetched(n: number): Promise<void> {
    await db
      .update(generationJobs)
      .set({ signalsFetched: n, updatedAt: nowIso() })
      .where(eq(generationJobs.id, this.jobId));
  }

  async finish(
    status: "succeeded" | "failed",
    message?: string
  ): Promise<void> {
    log(`#${this.jobId} finish ${status}${message ? `: ${message}` : ""}`);
    const now = nowIso();
    await db
      .update(generationJobs)
      .set({
        status,
        stage: "done",
        stageLabel: status === "succeeded" ? "Done" : "Failed",
        errorMessage: message ?? "",
        inFlight: 0,
        updatedAt: now,
        finishedAt: now,
      })
      .where(eq(generationJobs.id, this.jobId));
  }
}

export async function startJob(isoWeek: string): Promise<JobReporter> {
  const existing = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.isoWeek, isoWeek),
        eq(generationJobs.status, "running")
      )
    )
    .orderBy(desc(generationJobs.startedAt))
    .limit(1);

  if (existing[0]) {
    throw new JobAlreadyRunningError(existing[0].id);
  }

  const [created] = await db
    .insert(generationJobs)
    .values({
      isoWeek,
      status: "running",
      stage: "init",
      stageLabel: "Starting…",
    })
    .returning();

  log(`#${created.id} started for ${isoWeek}`);
  return new JobReporter(created.id, isoWeek);
}

export async function getLatestJob(
  isoWeek: string
): Promise<GenerationJob | null> {
  const rows = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.isoWeek, isoWeek))
    .orderBy(desc(generationJobs.startedAt))
    .limit(1);
  return rows[0] ?? null;
}
