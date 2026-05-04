import { format } from "date-fns";
import Image from "next/image";
import { eq, inArray } from "drizzle-orm";
import {
  personas,
  rationaleCitations,
  researchSignals,
  quarterlyGoals,
  weeklyBriefs,
  performanceRecords,
  businessProfile,
} from "@/lib/db/schema";
import type { Post } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { safeJson, cn } from "@/lib/utils";
import { personaColor } from "@/components/calendar/post-card";
import { EditableBody } from "./editable-body";
import { HookEditor } from "./hook-editor";
import { PostActions } from "./post-actions";
import {
  RationaleCitations,
  type CitationSource,
} from "./rationale-citations";

type AltHook = { hook: string; reasoning?: string };
type RationaleShape = {
  hookStrategy?: string;
  audience?: string;
  slotReasoning?: string;
  viralityLever?: string;
  expectedOutcome?: string;
};

async function loadCitations(postId: number): Promise<CitationSource[]> {
  const rows = await db
    .select()
    .from(rationaleCitations)
    .where(eq(rationaleCitations.postId, postId));
  if (rows.length === 0) return [];

  const idsByKind: Record<string, number[]> = {};
  for (const r of rows) {
    if (r.sourceId == null) continue;
    (idsByKind[r.sourceKind] ??= []).push(r.sourceId);
  }

  const sourceLookup = new Map<string, { label: string; detail?: string; url?: string }>();

  if (idsByKind.signal?.length) {
    const sigs = await db
      .select()
      .from(researchSignals)
      .where(inArray(researchSignals.id, idsByKind.signal));
    for (const s of sigs) {
      sourceLookup.set(`signal:${s.id}`, {
        label: s.kind,
        detail: s.summary,
        url: s.sourceUrl || undefined,
      });
    }
  }
  if (idsByKind.persona?.length) {
    const ps = await db
      .select()
      .from(personas)
      .where(inArray(personas.id, idsByKind.persona));
    for (const p of ps) {
      sourceLookup.set(`persona:${p.id}`, {
        label: p.name,
        detail: p.role,
      });
    }
  }
  if (idsByKind.goal?.length) {
    const gs = await db
      .select()
      .from(quarterlyGoals)
      .where(inArray(quarterlyGoals.id, idsByKind.goal));
    for (const g of gs) {
      sourceLookup.set(`goal:${g.id}`, {
        label: g.quarter,
        detail: g.objective,
      });
    }
  }
  if (idsByKind.brief?.length) {
    const bs = await db
      .select()
      .from(weeklyBriefs)
      .where(inArray(weeklyBriefs.id, idsByKind.brief));
    for (const b of bs) {
      sourceLookup.set(`brief:${b.id}`, {
        label: b.isoWeek,
        detail: b.focus,
      });
    }
  }
  if (idsByKind.performance?.length) {
    const prs = await db
      .select()
      .from(performanceRecords)
      .where(inArray(performanceRecords.id, idsByKind.performance));
    for (const pr of prs) {
      sourceLookup.set(`performance:${pr.id}`, {
        label: `Post #${pr.postId}`,
        detail: pr.qualitativeNote || `${pr.impressions} impressions`,
      });
    }
  }
  if (idsByKind.profile?.length) {
    const pfs = await db
      .select()
      .from(businessProfile)
      .where(inArray(businessProfile.id, idsByKind.profile));
    for (const pf of pfs) {
      sourceLookup.set(`profile:${pf.id}`, {
        label: "Business profile",
        detail: pf.icp || pf.region,
      });
    }
  }

  return rows.map((r) => {
    const key = r.sourceId != null ? `${r.sourceKind}:${r.sourceId}` : null;
    const src = key ? sourceLookup.get(key) : undefined;
    return {
      id: r.id,
      claimKey: r.claimKey,
      claim: r.claim,
      sourceKind: r.sourceKind,
      sourceLabel: src?.label ?? r.sourceKind,
      sourceDetail: src?.detail,
      sourceUrl: src?.url,
    };
  });
}

export async function PostDetailView({ post }: { post: Post }) {
  const [persona] = await db
    .select()
    .from(personas)
    .where(eq(personas.id, post.personaId))
    .limit(1);
  const citations = await loadCitations(post.id);
  const altHooks = safeJson<AltHook[]>(post.altHooksJson, []);
  const hashtags = safeJson<string[]>(post.hashtagsJson, []);
  const rationale = safeJson<RationaleShape>(post.rationaleJson, {});

  const initial = (persona?.name ?? "?").slice(0, 1).toUpperCase();
  const scheduled = (() => {
    try {
      return format(new Date(post.scheduledFor), "EEE, MMM d · HH:mm");
    } catch {
      return post.scheduledFor;
    }
  })();
  const updated = (() => {
    try {
      return format(new Date(post.updatedAt), "MMM d HH:mm");
    } catch {
      return post.updatedAt;
    }
  })();

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              persona ? personaColor(persona.id) : "bg-bg-overlay text-fg-subtle"
            )}
          >
            {initial}
          </span>
          <span className="text-sm font-medium">
            {persona?.name ?? "Unknown persona"}
          </span>
          <Badge variant={post.platform === "linkedin" ? "linkedin" : "x"}>
            {post.platform === "linkedin" ? "LinkedIn" : "X"}
          </Badge>
          <Badge
            variant={
              post.status === "posted"
                ? "accent"
                : post.status === "approved"
                  ? "warning"
                  : post.status === "logged"
                    ? "muted"
                    : "default"
            }
          >
            {post.status}
          </Badge>
          <span className="ml-auto font-mono text-[11px] text-fg-subtle">
            scheduled {scheduled} · updated {updated}
          </span>
        </div>
        <PostActions
          postId={post.id}
          hook={post.hook}
          body={post.body}
          hashtags={hashtags}
          hasImagePrompt={Boolean(post.imagePrompt)}
        />
      </header>

      {post.imageUrl ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
            Generated image
          </h2>
          <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
            <Image
              src={post.imageUrl}
              alt={post.imagePrompt || "Generated post image"}
              width={1200}
              height={1200}
              sizes="(max-width: 768px) 100vw, 960px"
              className="max-h-[640px] w-full object-contain"
            />
          </div>
          <p className="text-xs text-fg-subtle">
            Generated with {post.imageProvider || "codex"}
            {post.imageGeneratedAt ? ` on ${post.imageGeneratedAt}` : ""}.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
          Hook
        </h2>
        <HookEditor
          postId={post.id}
          initial={post.hook}
          altHooks={altHooks}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
          Body
        </h2>
        <EditableBody postId={post.id} initial={post.body} />
      </section>

      {hashtags.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
            Hashtags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((h) => (
              <Badge key={h} variant="muted">
                #{h}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {post.imagePrompt ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
            Image prompt
          </h2>
          <p className="rounded-md border border-border bg-bg-elevated p-3 font-mono text-xs leading-relaxed text-fg-muted">
            {post.imagePrompt}
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
          Rationale
        </h2>
        <RationaleCitations
          rationale={rationale as Record<string, string | undefined>}
          citations={citations}
        />
      </section>
    </article>
  );
}
