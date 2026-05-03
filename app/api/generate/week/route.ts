import { NextResponse, type NextRequest } from "next/server";
import { generateWeek } from "@/lib/generation/pipeline";
import { formatIsoWeek, nextIsoWeek } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      isoWeek?: string;
      mode?: "current" | "next";
    };
    const isoWeek =
      body.isoWeek ??
      (body.mode === "current" ? formatIsoWeek() : nextIsoWeek(formatIsoWeek()));
    const result = await generateWeek(isoWeek);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
