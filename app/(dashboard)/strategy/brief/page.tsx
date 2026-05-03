import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  FileText,
  Save,
  Sparkles,
  TrendingUp,
  Newspaper,
  Swords,
  ClipboardPaste,
  ExternalLink,
  Trash2,
  Wand2,
  Lightbulb,
} from "lucide-react";
import { db } from "@/lib/db/client";
import { weeklyBriefs, researchSignals } from "@/lib/db/schema";
import { formatIsoWeek, isoWeekRange, safeJson } from "@/lib/utils";
import { runResearch } from "@/lib/generation/pipeline";
import { suggestWeeklyBrief } from "@/lib/generation/brief-suggester";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SignalKind = "trend" | "competitor" | "news" | "user_pasted";

const briefInput = z.object({
  focus: z.string().trim().default(""),
  targetSegment: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

const pasteInput = z.object({
  summary: z.string().trim().min(1, "Paste at least one signal"),
  sourceUrl: z.string().trim().default(""),
});

async function ensureBrief(isoWeek: string) {
  const existing = (
    await db.select().from(weeklyBriefs).where(eq(weeklyBriefs.isoWeek, isoWeek)).limit(1)
  )[0];
  if (existing) return existing;
  const [created] = await db
    .insert(weeklyBriefs)
    .values({ isoWeek, focus: "", targetSegment: "", notes: "" })
    .returning();
  return created;
}

async function saveBrief(formData: FormData) {
  "use server";
  const isoWeek = String(formData.get("isoWeek") ?? "");
  if (!isoWeek) throw new Error("Missing isoWeek");
  const parsed = briefInput.parse({
    focus: formData.get("focus") ?? "",
    targetSegment: formData.get("targetSegment") ?? "",
    notes: formData.get("notes") ?? "",
  });
  await ensureBrief(isoWeek);
  await db.update(weeklyBriefs).set(parsed).where(eq(weeklyBriefs.isoWeek, isoWeek));
  revalidatePath("/strategy/brief");
}

async function runResearchAction(formData: FormData) {
  "use server";
  const isoWeek = String(formData.get("isoWeek") ?? formatIsoWeek());
  await runResearch(isoWeek);
  revalidatePath("/strategy/brief");
}

async function addPastedSignal(formData: FormData) {
  "use server";
  const isoWeek = String(formData.get("isoWeek") ?? "");
  const parsed = pasteInput.parse({
    summary: formData.get("summary") ?? "",
    sourceUrl: formData.get("sourceUrl") ?? "",
  });
  const brief = await ensureBrief(isoWeek);
  await db.insert(researchSignals).values({
    weekId: brief.id,
    summary: parsed.summary,
    sourceUrl: parsed.sourceUrl,
    kind: "user_pasted",
  });
  revalidatePath("/strategy/brief");
}

async function suggestBriefAction(formData: FormData) {
  "use server";
  const isoWeek = String(formData.get("isoWeek") ?? formatIsoWeek());
  await suggestWeeklyBrief(isoWeek);
  revalidatePath("/strategy/brief");
}

async function deleteSignal(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.delete(researchSignals).where(eq(researchSignals.id, id));
  revalidatePath("/strategy/brief");
}

const KIND_META: Record<
  SignalKind,
  { label: string; variant: "accent" | "warning" | "default" | "muted"; Icon: React.ComponentType<{ className?: string }> }
> = {
  trend: { label: "Trend", variant: "accent", Icon: TrendingUp },
  competitor: { label: "Competitor", variant: "warning", Icon: Swords },
  news: { label: "News", variant: "default", Icon: Newspaper },
  user_pasted: { label: "Pasted", variant: "muted", Icon: ClipboardPaste },
};

function fmtRange(isoWeek: string) {
  const { start, end } = isoWeekRange(isoWeek);
  const f = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(start)} – ${f(end)}`;
}

type SuggestedIdeas = {
  reasoning: string;
  alt_angles: Array<{ angle: string; why: string; segment: string }>;
};

export default async function WeeklyBriefPage() {
  const isoWeek = formatIsoWeek();
  const brief = await ensureBrief(isoWeek);

  const ideas = safeJson<SuggestedIdeas | null>(brief.suggestedIdeasJson, null);

  const signals = await db
    .select()
    .from(researchSignals)
    .where(eq(researchSignals.weekId, brief.id))
    .orderBy(desc(researchSignals.fetchedAt));

  const counts: Record<SignalKind, number> = {
    trend: 0,
    competitor: 0,
    news: 0,
    user_pasted: 0,
  };
  for (const s of signals) {
    const k = s.kind as SignalKind;
    if (k in counts) counts[k]++;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Weekly Brief"
        description="The current week's focus, segment, and signal pool. Drives the post generator."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="accent">
              <FileText className="w-3 h-3" />
              <span className="font-mono">{isoWeek}</span>
            </Badge>
            <span className="text-xs text-fg-subtle">{fmtRange(isoWeek)}</span>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <CardTitle>This week</CardTitle>
                <CardDescription>
                  What we&apos;re aiming at, who we&apos;re aiming at.
                </CardDescription>
              </div>
              <form action={suggestBriefAction}>
                <input type="hidden" name="isoWeek" value={isoWeek} />
                <Button type="submit" size="sm" variant="secondary">
                  <Wand2 className="w-4 h-4" />
                  {brief.suggestedAt ? "Re-suggest brief" : "Suggest brief"}
                </Button>
              </form>
            </div>
            {brief.suggestedAt ? (
              <div className="mt-2 text-[11px] text-fg-subtle font-mono">
                Last suggested {new Date(brief.suggestedAt).toLocaleString()}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <form action={saveBrief} className="flex flex-col gap-5">
              <input type="hidden" name="isoWeek" value={isoWeek} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="focus">Focus</Label>
                <Input
                  id="focus"
                  name="focus"
                  defaultValue={brief.focus}
                  placeholder="e.g. Position fractional CTO offer"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="targetSegment">Target segment</Label>
                <Input
                  id="targetSegment"
                  name="targetSegment"
                  defaultValue={brief.targetSegment}
                  placeholder="e.g. Pre-seed founders without a technical co-founder"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={8}
                  defaultValue={brief.notes}
                  placeholder="Hooks to pursue. Stories to tell. Things to avoid this week."
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit">
                  <Save className="w-4 h-4" />
                  Save brief
                </Button>
              </div>
            </form>

            {ideas?.reasoning ? (
              <div className="mt-6 rounded-md border-l-2 border-accent bg-accent/5 px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent font-semibold mb-1">
                  <Sparkles className="w-3 h-3" />
                  Why this focus
                </div>
                <p className="text-sm text-fg leading-relaxed">{ideas.reasoning}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <CardTitle>Research</CardTitle>
                </div>
                <form action={runResearchAction}>
                  <input type="hidden" name="isoWeek" value={isoWeek} />
                  <Button type="submit" size="sm">
                    Run research
                  </Button>
                </form>
              </div>
              <CardDescription>
                Pulls trends, competitor moves, and news for this week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-center">
                {(Object.keys(counts) as SignalKind[]).map((k) => {
                  const meta = KIND_META[k];
                  return (
                    <div
                      key={k}
                      className="flex flex-col items-center gap-1 rounded-md border border-border bg-bg-overlay/40 py-3"
                    >
                      <meta.Icon className="w-3.5 h-3.5 text-fg-muted" />
                      <span className="font-mono text-base text-fg">{counts[k]}</span>
                      <span className="text-[10px] uppercase tracking-widest text-fg-subtle">
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-accent" />
                <CardTitle>Paste a signal</CardTitle>
              </div>
              <CardDescription>Drop something you saw. Saved as user_pasted.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addPastedSignal} className="flex flex-col gap-3">
                <input type="hidden" name="isoWeek" value={isoWeek} />
                <Textarea
                  name="summary"
                  rows={4}
                  placeholder="What's the signal? Why does it matter?"
                  required
                />
                <Input
                  name="sourceUrl"
                  type="url"
                  placeholder="https://… (optional)"
                  className="font-mono text-xs"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Add signal
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {ideas?.alt_angles && ideas.alt_angles.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-accent" />
              <CardTitle>Other angles to consider</CardTitle>
            </div>
            <CardDescription>
              Alternatives the system surfaced. Click an angle to use it as your focus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ideas.alt_angles.map((alt, i) => (
                <form
                  key={i}
                  action={async (fd: FormData) => {
                    "use server";
                    const isoWeekX = String(fd.get("isoWeek"));
                    const focus = String(fd.get("focus"));
                    const segment = String(fd.get("segment"));
                    await db
                      .update(weeklyBriefs)
                      .set({ focus, targetSegment: segment })
                      .where(eq(weeklyBriefs.isoWeek, isoWeekX));
                    revalidatePath("/strategy/brief");
                  }}
                  className="contents"
                >
                  <input type="hidden" name="isoWeek" value={isoWeek} />
                  <input type="hidden" name="focus" value={alt.angle} />
                  <input type="hidden" name="segment" value={alt.segment} />
                  <button
                    type="submit"
                    className="text-left rounded-md border border-border bg-bg-overlay/40 p-4 hover:border-accent/40 hover:bg-accent/5 transition-colors group"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-fg-subtle group-hover:text-accent mb-2">
                      Angle {i + 1}
                    </div>
                    <p className="text-sm font-medium text-fg leading-snug mb-2">
                      {alt.angle}
                    </p>
                    <p className="text-xs text-fg-muted leading-relaxed mb-2">
                      {alt.why}
                    </p>
                    <div className="text-[11px] text-fg-subtle font-mono">
                      → {alt.segment}
                    </div>
                  </button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Signal pool</CardTitle>
            <span className="text-xs text-fg-subtle font-mono">{signals.length} total</span>
          </div>
          <CardDescription>Everything gathered for {isoWeek}.</CardDescription>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg-muted">
              No signals yet. Run research or paste one to start the week.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border -mx-5">
              {signals.map((s) => {
                const meta = KIND_META[(s.kind as SignalKind) ?? "news"] ?? KIND_META.news;
                return (
                  <li key={s.id} className="px-5 py-4 flex items-start gap-4">
                    <Badge variant={meta.variant}>
                      <meta.Icon className="w-3 h-3" />
                      {meta.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg whitespace-pre-wrap">{s.summary}</p>
                      {s.sourceUrl ? (
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-accent font-mono break-all"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {s.sourceUrl}
                        </a>
                      ) : null}
                    </div>
                    <form action={deleteSignal}>
                      <input type="hidden" name="id" value={s.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete signal"
                        className="text-fg-subtle hover:text-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
