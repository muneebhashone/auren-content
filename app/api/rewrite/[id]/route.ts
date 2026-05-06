import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rewrites } from "@/lib/db/schema";

export const runtime = "nodejs";

const variantSchema = z.object({
  hook: z.string().default(""),
  body: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
  title: z.string().optional(),
});

const variantsSchema = z.object({
  linkedin: z.object({
    polished: variantSchema,
    faithful: variantSchema,
  }),
  x: z.object({
    polished: variantSchema,
    faithful: variantSchema,
  }),
  reddit: z.object({
    polished: variantSchema,
    faithful: variantSchema,
  }),
});

const patchSchema = z.object({
  dump: z.string().trim().min(1).max(8000).optional(),
  variants: variantsSchema.optional(),
});

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = await parseId(params);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.dump !== undefined) update.dump = body.dump;
  if (body.variants !== undefined)
    update.variantsJson = JSON.stringify(body.variants);

  const result = await db
    .update(rewrites)
    .set(update)
    .where(eq(rewrites.id, id))
    .returning({ id: rewrites.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = await parseId(params);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const result = await db
    .delete(rewrites)
    .where(eq(rewrites.id, id))
    .returning({ id: rewrites.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
