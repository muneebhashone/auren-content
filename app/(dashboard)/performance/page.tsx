import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { BarChart3, Sparkles, TrendingUp, AlertCircle, ArrowRight } from "lucide-react";
import { db } from "@/lib/db/client";
import { performanceRecords, personas, posts } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPerformanceDigest } from "@/lib/feedback/pattern-digest";
import type { FeedbackAnalysisOutput } from "@/lib/llm/prompts/feedback-analysis";
import { CsvImportBlock } from "./import-block";
import { RefreshDigestButton } from "./refresh-button";
import { RecordsTable, type RecordRow } from "./records-table";

export const dynamic = "force-dynamic";

async function loadRecords(): Promise<RecordRow[]> {
  const rows = await db
    .select({
      postId: performanceRecords.postId,
      persona: personas.name,
      platform: posts.platform,
      scheduledFor: posts.scheduledFor,
      hook: posts.hook,
      impressions: performanceRecords.impressions,
      likes: performanceRecords.likes,
      comments: performanceRecords.comments,
      reposts: performanceRecords.reposts,
      qualitativeNote: performanceRecords.qualitativeNote,
      importedAt: performanceRecords.importedAt,
    })
    .from(performanceRecords)
    .innerJoin(posts, eq(performanceRecords.postId, posts.id))
    .innerJoin(personas, eq(posts.personaId, personas.id))
    .orderBy(desc(performanceRecords.importedAt));
  return rows;
}

async function loadTopPerformers(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      postId: posts.id,
      hook: posts.hook,
      platform: posts.platform,
      persona: personas.name,
      impressions: performanceRecords.impressions,
      likes: performanceRecords.likes,
      comments: performanceRecords.comments,
      reposts: performanceRecords.reposts,
      qualitativeNote: performanceRecords.qualitativeNote,
    })
    .from(posts)
    .innerJoin(personas, eq(posts.personaId, personas.id))
    .leftJoin(performanceRecords, eq(performanceRecords.postId, posts.id))
    .where(inArray(posts.id, ids));
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.postId) ?? 99) - (order.get(b.postId) ?? 99));
  return rows;
}

function formatComputedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default async function PerformancePage() {
  const [{ digest, computedAt, insufficient, recordCount }, records] = await Promise.all([
    getPerformanceDigestSafe(),
    loadRecords(),
  ]);

  const topPerformerIds = digest?.top_performers?.slice(0, 5) ?? [];
  const topPerformers = await loadTopPerformers(topPerformerIds);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Performance"
        description="Patterns, top performers, and the raw record table. Imports invalidate the digest cache; the digest also auto-refreshes after 24h."
        actions={<RefreshDigestButton />}
      />

      <DigestCard
        digest={digest}
        computedAt={computedAt}
        insufficient={Boolean(insufficient)}
        recordCount={recordCount}
      />

      {topPerformers.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-subtle">
              Top performers
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topPerformers.map((p) => (
              <Link
                key={p.postId}
                href={`/posts/${p.postId}`}
                className="group rounded-lg border border-border bg-bg-elevated p-4 hover:border-accent/40 transition-colors flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={p.platform === "linkedin" ? "linkedin" : "x"}>
                    {p.platform}
                  </Badge>
                  <span className="font-mono text-[11px] text-fg-subtle tabular-nums">
                    #{p.postId}
                  </span>
                </div>
                <p className="text-sm text-fg leading-snug line-clamp-3">
                  {p.hook || "(no hook)"}
                </p>
                <div className="grid grid-cols-4 gap-2 text-[11px] text-fg-muted font-mono tabular-nums border-t border-border pt-3">
                  <Stat label="imp" value={p.impressions ?? 0} />
                  <Stat label="lk" value={p.likes ?? 0} />
                  <Stat label="cm" value={p.comments ?? 0} />
                  <Stat label="rp" value={p.reposts ?? 0} />
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-fg-subtle">
                  <span className="truncate">{p.persona}</span>
                  <ArrowRight className="w-3 h-3 group-hover:text-accent transition-colors" />
                </div>
                {p.qualitativeNote ? (
                  <p className="text-[11px] text-fg-muted italic line-clamp-2">
                    “{p.qualitativeNote}”
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <CsvImportBlock />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-subtle">
              Records
            </h2>
            <span className="text-xs text-fg-subtle font-mono tabular-nums">
              ({records.length})
            </span>
          </div>
          {computedAt ? (
            <span className="text-[11px] text-fg-subtle font-mono">
              Digest computed {formatComputedAt(computedAt)}
            </span>
          ) : null}
        </div>
        <RecordsTable rows={records} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      <span className="text-fg">{value.toLocaleString()}</span>
    </div>
  );
}

async function getPerformanceDigestSafe() {
  try {
    return await getPerformanceDigest();
  } catch (err) {
    console.error("Digest failed", err);
    return {
      digest: null,
      computedAt: null,
      insufficient: false,
      recordCount: 0,
      error: (err as Error).message,
    } as Awaited<ReturnType<typeof getPerformanceDigest>> & { error?: string };
  }
}

function DigestCard({
  digest,
  computedAt,
  insufficient,
  recordCount,
}: {
  digest: FeedbackAnalysisOutput | null;
  computedAt: string | null;
  insufficient: boolean;
  recordCount: number;
}) {
  if (insufficient) {
    return (
      <Card className="border-l-4 border-l-accent/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <CardTitle className="text-lg">Pattern digest</CardTitle>
          </div>
          <CardDescription>
            Once you have at least 3 imported performance records, the LLM will surface
            patterns about what works, what misses, and what to do next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-fg-muted flex flex-col items-center gap-3">
            <AlertCircle className="w-6 h-6 text-fg-subtle" />
            <div>
              <span className="font-mono tabular-nums text-fg">{recordCount}</span> /{" "}
              <span className="font-mono tabular-nums">3</span> records imported.
            </div>
            <p className="max-w-md">
              Paste a CSV below to start building the corpus. The digest will compute
              automatically on the next page load once you cross the threshold.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!digest) {
    return (
      <Card className="border-l-4 border-l-warning/60">
        <CardHeader>
          <CardTitle>Pattern digest unavailable</CardTitle>
          <CardDescription>
            The digest could not be computed. Try refreshing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-accent">
      <CardHeader className="bg-accent/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-accent" />
            <CardTitle className="text-xl tracking-tight">Pattern digest</CardTitle>
          </div>
          {computedAt ? (
            <span className="text-[11px] text-fg-subtle font-mono">
              {formatComputedAt(computedAt)}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-base text-fg leading-relaxed">{digest.summary}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <DigestList
          tone="accent"
          title="What works"
          items={digest.what_works}
          emptyLabel="No clear winning patterns yet."
        />
        <DigestList
          tone="warning"
          title="What misses"
          items={digest.what_misses}
          emptyLabel="No clear failure patterns yet."
        />
        <DigestList
          tone="muted"
          title="Recommendations"
          items={digest.recommendations}
          emptyLabel="No recommendations."
        />
      </CardContent>
    </Card>
  );
}

function DigestList({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone: "accent" | "warning" | "muted";
}) {
  const dotClass =
    tone === "accent"
      ? "bg-accent"
      : tone === "warning"
        ? "bg-warning"
        : "bg-fg-subtle";
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
        {title}
      </h3>
      {items && items.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-fg-muted leading-snug">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-fg-subtle italic">{emptyLabel}</p>
      )}
    </div>
  );
}
