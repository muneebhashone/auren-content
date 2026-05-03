import { NextResponse, type NextRequest } from "next/server";
import { runResearch } from "@/lib/generation/pipeline";
import { formatIsoWeek } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { isoWeek?: string };
    const isoWeek = body.isoWeek ?? formatIsoWeek();
    const result = await runResearch(isoWeek);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
