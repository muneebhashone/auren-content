import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personas, rewrites } from "@/lib/db/schema";
import { safeJson } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { RewriteForm } from "./rewrite-form";
import { RewritesList, type RewriteRow } from "./rewrites-list";
import type { REDACTED_NON_SECRET_IDENTIFIER, Variant, Signal } from "./types";

export const dynamic = "force-dynamic";

export default async function RewritePage() {
  const activePersonas = await db
    .select({ id: personas.id, name: personas.name, role: personas.role })
    .from(personas)
    .where(eq(personas.active, true))
    .orderBy(desc(personas.createdAt));

  const rows = await db
    .select()
    .from(rewrites)
    .orderBy(desc(rewrites.createdAt))
    .limit(100);

  const items: RewriteRow[] = rows.map((r) => {
    const variants = safeJson<{
      linkedin: REDACTED_NON_SECRET_IDENTIFIER;
      x: REDACTED_NON_SECRET_IDENTIFIER;
      reddit: REDACTED_NON_SECRET_IDENTIFIER;
    }>(r.variantsJson, {
      linkedin: { polished: emptyVariant(), faithful: emptyVariant() },
      x: { polished: emptyVariant(), faithful: emptyVariant() },
      reddit: { polished: emptyVariant(), faithful: emptyVariant() },
    });
    if (!variants.reddit) {
      variants.reddit = { polished: emptyVariant(), faithful: emptyVariant() };
    }
    const signals = safeJson<Signal[]>(r.signalsJson, []);
    return {
      id: r.id,
      dump: r.dump,
      personaId: r.personaId ?? null,
      personaName: r.personaName,
      factCheck: r.factCheck,
      variants,
      signals,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rewrite"
        description="Dump a rough thought; get LinkedIn, X, and Reddit versions in two flavors — polished (persona voice) and faithful (your tone preserved)."
      />
      {activePersonas.length === 0 ? (
        <div className="text-sm text-fg-muted">
          No active personas yet. Create one in Strategy → Personas first.
        </div>
      ) : (
        <RewriteForm personas={activePersonas} />
      )}
      <RewritesList items={items} />
    </div>
  );
}

function emptyVariant(): Variant {
  return { hook: "", body: "", hashtags: [] };
}
