import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { importFeedbackCsv } from "@/lib/feedback/import";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  csv: z.string().min(1, "csv is required"),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const summary = await importFeedbackCsv(parsed.data.csv);
    return NextResponse.json(summary);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
