import { NextResponse, type NextRequest } from "next/server";
import { generateWeek } from "@/lib/generation/pipeline";
import {
  startJob,
  JobAlreadyRunningError,
  type JobReporter,
} from "@/lib/generation/job-reporter";
import { formatIsoWeek, nextIsoWeek } from "@/lib/utils";

export const runtime = "nodejs";
// The job runs detached from this request; the response returns immediately.
// maxDuration is kept short on purpose — the actual work is bounded by the
// host process, not by this HTTP request.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      isoWeek?: string;
      mode?: "current" | "next";
    };
    const isoWeek =
      body.isoWeek ??
      (body.mode === "current" ? formatIsoWeek() : nextIsoWeek(formatIsoWeek()));

    let reporter: JobReporter;
    try {
      reporter = await startJob(isoWeek);
    } catch (e) {
      if (e instanceof JobAlreadyRunningError) {
        return NextResponse.json(
          {
            error: e.message,
            jobId: e.jobId,
            isoWeek,
            alreadyRunning: true,
          },
          { status: 409 }
        );
      }
      throw e;
    }

    // Fire-and-forget. The Node process keeps the promise alive; we surface
    // progress via the generation_jobs table polled by the UI banner.
    // NOTE: on serverless hosts the function instance can be killed mid-run.
    void generateWeek(isoWeek, reporter)
      .then(async () => {
        await reporter.finish("succeeded");
      })
      .catch(async (err: unknown) => {
        console.error("[job] generation failed", err);
        const msg =
          err instanceof Error ? err.message : String(err ?? "unknown error");
        await reporter.finish("failed", msg);
      });

    return NextResponse.json({ jobId: reporter.jobId, isoWeek });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
