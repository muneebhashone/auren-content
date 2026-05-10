import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { BookOpen, Plus, Pencil, Trash2, Check, X, Power } from "lucide-react";
import { db } from "@/lib/db/client";
import { personas, storyBank } from "@/lib/db/schema";
import { safeJson, cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Kind = "story" | "hot_take";

const KINDS = ["story", "hot_take"] as const;

const entryInput = z.object({
  kind: z.enum(KINDS),
  title: z.string().trim().min(1, "Title required"),
  body: z.string().trim().min(1, "Body required"),
  tags: z.array(z.string()).default([]),
  personaId: z.number().int().positive().nullable().default(null),
});

function parseTags(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim().toLowerCase().replace(/^#+/, ""))
    .filter(Boolean);
}

function readEntryForm(formData: FormData) {
  const personaRaw = formData.get("personaId");
  const personaNum =
    typeof personaRaw === "string" && personaRaw.trim() && personaRaw !== "global"
      ? Number(personaRaw)
      : null;
  return entryInput.parse({
    kind: formData.get("kind") ?? "story",
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    tags: parseTags(String(formData.get("tags") ?? "")),
    personaId: Number.isFinite(personaNum) ? personaNum : null,
  });
}

async function createEntry(formData: FormData) {
  "use server";
  const data = readEntryForm(formData);
  await db.insert(storyBank).values({
    kind: data.kind,
    title: data.title,
    body: data.body,
    tagsJson: JSON.stringify(data.tags),
    personaId: data.personaId,
    active: true,
  });
  revalidatePath("/strategy/story-bank");
  redirect("/strategy/story-bank");
}

async function updateEntry(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid story-bank id");
  const data = readEntryForm(formData);
  await db
    .update(storyBank)
    .set({
      kind: data.kind,
      title: data.title,
      body: data.body,
      tagsJson: JSON.stringify(data.tags),
      personaId: data.personaId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(storyBank.id, id));
  revalidatePath("/strategy/story-bank");
  redirect("/strategy/story-bank");
}

async function toggleActive(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const next = formData.get("next") === "1";
  await db.update(storyBank).set({ active: next }).where(eq(storyBank.id, id));
  revalidatePath("/strategy/story-bank");
}

async function deleteEntry(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.delete(storyBank).where(eq(storyBank.id, id));
  revalidatePath("/strategy/story-bank");
}

function kindLabel(k: string): string {
  return k === "hot_take" ? "Hot take" : "Story";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never used";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Never used";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "Used today";
  if (days === 1) return "Used 1 day ago";
  if (days < 30) return `Used ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Used 1 month ago" : `Used ${months} months ago`;
}

export default async function StoryBankPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const { edit, new: isNew } = await searchParams;
  const editingId = edit ? Number(edit) : null;
  const creating = isNew === "1";

  const [allEntries, allPersonas] = await Promise.all([
    db
      .select()
      .from(storyBank)
      .orderBy(
        desc(storyBank.active),
        asc(sql`coalesce(${storyBank.lastUsedAt}, '0')`),
        desc(storyBank.createdAt)
      ),
    db.select().from(personas).where(eq(personas.active, true)),
  ]);
  const personaById = new Map(allPersonas.map((p) => [p.id, p]));
  const editing = editingId
    ? allEntries.find((e) => e.id === editingId)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Story Bank"
        description="First-person anecdotes and contrarian takes the generator draws on for story and opinion slots. Stalest entries appear first."
        actions={
          !creating && !editing ? (
            <a href="/strategy/story-bank?new=1">
              <Button>
                <Plus className="w-4 h-4" />
                New entry
              </Button>
            </a>
          ) : (
            <a href="/strategy/story-bank">
              <Button variant="ghost">
                <X className="w-4 h-4" />
                Close
              </Button>
            </a>
          )
        }
      />

      {creating ? (
        <EntryEditor
          mode="create"
          action={createEntry}
          personas={allPersonas}
          defaults={emptyEntry()}
        />
      ) : editing ? (
        <EntryEditor
          mode="edit"
          action={updateEntry}
          personas={allPersonas}
          defaults={{
            id: editing.id,
            kind: editing.kind as Kind,
            title: editing.title,
            body: editing.body,
            tags: safeJson<string[]>(editing.tagsJson, []),
            personaId: editing.personaId ?? null,
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {allEntries.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-14 flex flex-col items-center gap-3 text-center">
              <BookOpen className="w-6 h-6 text-fg-subtle" />
              <p className="text-sm text-fg-muted">
                No story-bank entries yet. Add a few first-person anecdotes and
                a couple of contrarian takes; the generator will rotate through
                them.
              </p>
              <a href="/strategy/story-bank?new=1">
                <Button size="sm">
                  <Plus className="w-4 h-4" />
                  Create first entry
                </Button>
              </a>
            </CardContent>
          </Card>
        ) : (
          allEntries.map((e) => {
            const tags = safeJson<string[]>(e.tagsJson, []);
            const persona = e.personaId ? personaById.get(e.personaId) : null;
            return (
              <Card
                key={e.id}
                className={cn(
                  "flex flex-col",
                  !e.active && "opacity-60"
                )}
              >
                <CardContent className="flex flex-col gap-3 p-5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={e.kind === "hot_take" ? "danger" : "accent"}
                        >
                          {kindLabel(e.kind)}
                        </Badge>
                        {persona ? (
                          <Badge variant="muted">{persona.name}</Badge>
                        ) : (
                          <Badge variant="muted">Global</Badge>
                        )}
                        {!e.active ? (
                          <Badge variant="muted">Inactive</Badge>
                        ) : null}
                      </div>
                      <h3 className="text-base font-semibold mt-2 truncate">
                        {e.title}
                      </h3>
                      <p className="text-[11px] text-fg-subtle mt-0.5">
                        {formatRelative(e.lastUsedAt)} &middot; used{" "}
                        {e.useCount}x
                      </p>
                    </div>
                  </div>

                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-mono text-fg-subtle border border-border rounded px-1.5 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-xs text-fg-muted line-clamp-4 whitespace-pre-wrap">
                    {e.body}
                  </p>
                </CardContent>
                <div className="flex items-center justify-between border-t border-border px-3 py-2">
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="next" value={e.active ? "0" : "1"} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-fg-muted"
                    >
                      <Power className="w-3.5 h-3.5" />
                      {e.active ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/strategy/story-bank?edit=${e.id}`}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-fg-muted hover:text-fg hover:bg-bg-overlay"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </a>
                    <form action={deleteEntry}>
                      <input type="hidden" name="id" value={e.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        className="text-fg-muted hover:text-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

type EntryDefaults = {
  id?: number;
  kind: Kind;
  title: string;
  body: string;
  tags: string[];
  personaId: number | null;
};

function emptyEntry(): EntryDefaults {
  return {
    kind: "story",
    title: "",
    body: "",
    tags: [],
    personaId: null,
  };
}

function EntryEditor({
  mode,
  action,
  defaults,
  personas,
}: {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  defaults: EntryDefaults;
  personas: Array<{ id: number; name: string }>;
}) {
  return (
    <Card className="border-accent/30">
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "New story bank entry" : `Editing ${defaults.title}`}
        </CardTitle>
        <CardDescription>
          Stories are first-person anecdotes the writer rewrites in persona voice.
          Hot takes are contrarian opinions on industry topics or business culture
          (no politics, no identity, no attacks on individuals).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {defaults.id ? (
            <input type="hidden" name="id" value={defaults.id} />
          ) : null}

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Kind</Label>
              <div className="flex gap-2">
                {(["story", "hot_take"] as const).map((k) => (
                  <label
                    key={k}
                    className="flex items-center gap-2 rounded-md border border-border bg-bg-overlay/40 px-3 py-2 cursor-pointer hover:border-border-strong transition-colors flex-1"
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={k}
                      defaultChecked={defaults.kind === k}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="text-sm">{kindLabel(k)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={defaults.title}
                placeholder="Short label for the bank list"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                name="body"
                rows={10}
                defaultValue={defaults.body}
                placeholder="Story: 1-3 paragraphs of first-person anecdote with concrete specifics. Hot take: a clear stance and the reasoning behind it."
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="personaId">Persona</Label>
              <select
                id="personaId"
                name="personaId"
                defaultValue={defaults.personaId ?? "global"}
                className="h-10 rounded-md border border-border bg-bg-overlay px-3 text-sm"
              >
                <option value="global">Global (any persona)</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-fg-subtle">
                Global entries are usable by any persona. Persona-specific
                entries are only used by that persona.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Textarea
                id="tags"
                name="tags"
                rows={3}
                defaultValue={defaults.tags.join(", ")}
                placeholder="Comma-separated, e.g. hiring, agency-life, retainers"
                className="font-mono text-[13px]"
              />
              <p className="text-xs text-fg-subtle">
                Tags help the strategist match this entry to a slot theme.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <a href="/strategy/story-bank">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </a>
              <Button type="submit">
                {mode === "create" ? (
                  <>
                    <Plus className="w-4 h-4" />
                    Create entry
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
