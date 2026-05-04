import { NextResponse, type NextRequest } from "next/server";
import { getLatestJob } from "@/lib/generation/job-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isoWeek = req.nextUrl.searchParams.get("isoWeek");
  if (!isoWeek) {
    return NextResponse.json({ error: "isoWeek is required" }, { status: 400 });
  }
  const job = await getLatestJob(isoWeek);
  if (!job) return NextResponse.json({ job: null });

  const startedMs = Date.parse(job.startedAt);
  const updatedMs = Date.parse(job.updatedAt);
  const finishedMs = job.finishedAt ? Date.parse(job.finishedAt) : null;
  const now = Date.now();

  return NextResponse.json({
    job: {
      ...job,
      elapsedMs:
        (finishedMs ?? now) - (Number.isFinite(startedMs) ? startedMs : now),
      staleMs: Number.isFinite(updatedMs) ? now - updatedMs : 0,
    },
  });
}
