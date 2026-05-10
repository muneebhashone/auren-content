import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rewrites } from "@/lib/db/schema";
import { safeJson } from "@/lib/utils";
import { generateImageWithCodex } from "@/lib/images/codex-image";

export const runtime = "nodejs";
export const maxDuration = 300;

const platformValues = ["linkedin", "x", "reddit"] as const;
const kindValues = ["polished", "faithful"] as const;

const bodySchema = z.object({
  platform: z.enum(platformValues),
  kind: z.enum(kindValues),
});

type Variant = {
  hook: string;
  body: string;
  hashtags: string[];
  title?: string;
  imagePrompt?: string;
  imageUrl?: string;
};
type REDACTED_NON_SECRET_IDENTIFIER = { polished: Variant; faithful: Variant };
type Variants = {
  linkedin: REDACTED_NON_SECRET_IDENTIFIER;
  x: REDACTED_NON_SECRET_IDENTIFIER;
  reddit: REDACTED_NON_SECRET_IDENTIFIER;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
  const { platform, kind } = parsed;

  const [row] = await db
    .select()
    .from(rewrites)
    .where(eq(rewrites.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Rewrite not found" }, { status: 404 });
  }

  const variants = safeJson<Variants | null>(row.variantsJson, null);
  const variant = variants?.[platform]?.[kind];
  const prompt = variant?.imagePrompt?.trim() ?? "";
  if (!prompt) {
    return NextResponse.json(
      { error: "This variant has no image prompt." },
      { status: 400 }
    );
  }

  let imageUrl: string;
  try {
    imageUrl = await generateImageWithCodex({
      filenamePrefix: `rewrite-${id}-${platform}-${kind}`,
      imagePrompt: prompt,
    });
  } catch (err) {
    console.error("[rewrite/image] codex failed", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }

  const platformVariants: REDACTED_NON_SECRET_IDENTIFIER = {
    ...variants![platform],
    [kind]: { ...variant!, imageUrl },
  };
  const nextVariants: Variants = {
    ...variants!,
    [platform]: platformVariants,
  };

  await db
    .update(rewrites)
    .set({
      variantsJson: JSON.stringify(nextVariants),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(rewrites.id, id));

  return NextResponse.json({ imageUrl });
}
