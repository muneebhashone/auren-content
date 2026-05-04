import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { Users, Plus, Pencil, Trash2, Check, X, Power } from "lucide-react";
import { db } from "@/lib/db/client";
import { personas } from "@/lib/db/schema";
import { safeJson, cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Platform = "x" | "linkedin";
type Cadence = Partial<Record<Platform, number>>;

const personaInput = z.object({
  name: z.string().trim().min(1, "Name required"),
  role: z.string().trim().default(""),
  voiceProfileMd: z.string().default(""),
  dos: z.string().default(""),
  donts: z.string().default(""),
  samplePhrases: z.string().default(""),
  platforms: z.array(z.enum(["x", "linkedin"])).default([]),
  cadence: z
    .record(z.enum(["x", "linkedin"]), z.number().int().min(0).max(50))
    .default(() => ({ x: 0, linkedin: 0 })),
});

function readPersonaForm(formData: FormData) {
  const platformsRaw = formData.getAll("platforms").map(String) as string[];
  const platforms = platformsRaw.filter((p): p is Platform => p === "x" || p === "linkedin");
  const cadence: Record<Platform, number> = { x: 0, linkedin: 0 };
  for (const p of ["x", "linkedin"] as const) {
    if (!platforms.includes(p)) continue;
    const raw = Number(formData.get(`cadence_${p}`) ?? 0);
    cadence[p] = Number.isFinite(raw) ? Math.max(0, Math.min(50, Math.floor(raw))) : 0;
  }
  return personaInput.parse({
    name: formData.get("name") ?? "",
    role: formData.get("role") ?? "",
    voiceProfileMd: formData.get("voiceProfileMd") ?? "",
    dos: formData.get("dos") ?? "",
    donts: formData.get("donts") ?? "",
    samplePhrases: formData.get("samplePhrases") ?? "",
    platforms,
    cadence,
  });
}

async function createPersona(formData: FormData) {
  "use server";
  const data = readPersonaForm(formData);
  await db.insert(personas).values({
    name: data.name,
    role: data.role,
    voiceProfileMd: data.voiceProfileMd,
    dos: data.dos,
    donts: data.donts,
    samplePhrases: data.samplePhrases,
    platformsJson: JSON.stringify(data.platforms),
    cadenceJson: JSON.stringify(data.cadence),
    active: true,
  });
  revalidatePath("/strategy/personas");
  redirect("/strategy/personas");
}

async function updatePersona(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid persona id");
  const data = readPersonaForm(formData);
  await db
    .update(personas)
    .set({
      name: data.name,
      role: data.role,
      voiceProfileMd: data.voiceProfileMd,
      dos: data.dos,
      donts: data.donts,
      samplePhrases: data.samplePhrases,
      platformsJson: JSON.stringify(data.platforms),
      cadenceJson: JSON.stringify(data.cadence),
    })
    .where(eq(personas.id, id));
  revalidatePath("/strategy/personas");
  redirect("/strategy/personas");
}

async function togglePersonaActive(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const next = formData.get("next") === "1";
  await db.update(personas).set({ active: next }).where(eq(personas.id, id));
  revalidatePath("/strategy/personas");
}

async function deletePersona(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.delete(personas).where(eq(personas.id, id));
  revalidatePath("/strategy/personas");
}

const PLATFORMS: { id: Platform; label: string; variant: "x" | "linkedin" }[] = [
  { id: "x", label: "X", variant: "x" },
  { id: "linkedin", label: "LinkedIn", variant: "linkedin" },
];

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const { edit, new: isNew } = await searchParams;
  const editingId = edit ? Number(edit) : null;
  const creating = isNew === "1";

  const all = await db.select().from(personas).orderBy(desc(personas.active), desc(personas.createdAt));
  const editing = editingId ? all.find((p) => p.id === editingId) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Personas"
        description="Voices that ship content. Each persona owns its tone, platforms, and weekly cadence."
        actions={
          !creating && !editing ? (
            <a href="/strategy/personas?new=1">
              <Button>
                <Plus className="w-4 h-4" />
                New persona
              </Button>
            </a>
          ) : (
            <a href="/strategy/personas">
              <Button variant="ghost">
                <X className="w-4 h-4" />
                Close
              </Button>
            </a>
          )
        }
      />

      {creating ? (
        <PersonaEditor
          mode="create"
          action={createPersona}
          defaults={emptyPersona()}
        />
      ) : editing ? (
        <PersonaEditor
          mode="edit"
          action={updatePersona}
          defaults={{
            id: editing.id,
            name: editing.name,
            role: editing.role,
            voiceProfileMd: editing.voiceProfileMd,
            dos: editing.dos,
            donts: editing.donts,
            samplePhrases: editing.samplePhrases,
            platforms: safeJson<Platform[]>(editing.platformsJson, []),
            cadence: safeJson<Cadence>(editing.cadenceJson, {}),
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {all.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-14 flex flex-col items-center gap-3 text-center">
              <Users className="w-6 h-6 text-fg-subtle" />
              <p className="text-sm text-fg-muted">No personas yet.</p>
              <a href="/strategy/personas?new=1">
                <Button size="sm">
                  <Plus className="w-4 h-4" />
                  Create first persona
                </Button>
              </a>
            </CardContent>
          </Card>
        ) : (
          all.map((p) => {
            const platforms = safeJson<Platform[]>(p.platformsJson, []);
            const cadence = safeJson<Cadence>(p.cadenceJson, {});
            return (
              <Card
                key={p.id}
                className={cn(
                  "flex flex-col",
                  !p.active && "opacity-60"
                )}
              >
                <CardContent className="flex flex-col gap-3 p-5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold truncate">{p.name}</h3>
                        {p.active ? (
                          <Badge variant="accent">
                            <Check className="w-3 h-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="muted">Inactive</Badge>
                        )}
                      </div>
                      {p.role ? (
                        <p className="text-xs text-fg-muted mt-0.5">{p.role}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {platforms.length === 0 ? (
                      <span className="text-xs text-fg-subtle">No platforms</span>
                    ) : (
                      platforms.map((pl) => (
                        <Badge key={pl} variant={pl}>
                          {pl === "x" ? "X" : "LinkedIn"}
                          <span className="font-mono opacity-70">{cadence[pl] ?? 0}/wk</span>
                        </Badge>
                      ))
                    )}
                  </div>

                  {p.voiceProfileMd ? (
                    <p className="text-xs text-fg-muted line-clamp-3 whitespace-pre-wrap">
                      {p.voiceProfileMd}
                    </p>
                  ) : null}
                </CardContent>
                <div className="flex items-center justify-between border-t border-border px-3 py-2">
                  <form action={togglePersonaActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="next" value={p.active ? "0" : "1"} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-fg-muted"
                    >
                      <Power className="w-3.5 h-3.5" />
                      {p.active ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/strategy/personas?edit=${p.id}`}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-fg-muted hover:text-fg hover:bg-bg-overlay"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </a>
                    <form action={deletePersona}>
                      <input type="hidden" name="id" value={p.id} />
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

type PersonaDefaults = {
  id?: number;
  name: string;
  role: string;
  voiceProfileMd: string;
  dos: string;
  donts: string;
  samplePhrases: string;
  platforms: Platform[];
  cadence: Cadence;
};

function emptyPersona(): PersonaDefaults {
  return {
    name: "",
    role: "",
    voiceProfileMd: "",
    dos: "",
    donts: "",
    samplePhrases: "",
    platforms: [],
    cadence: {},
  };
}

function PersonaEditor({
  mode,
  action,
  defaults,
}: {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  defaults: PersonaDefaults;
}) {
  return (
    <Card className="border-accent/30">
      <CardHeader>
        <CardTitle>{mode === "create" ? "New persona" : `Editing ${defaults.name}`}</CardTitle>
        <CardDescription>
          Voice, guardrails, and cadence shape every post this persona produces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={defaults.name} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  name="role"
                  defaultValue={defaults.role}
                  placeholder="e.g. Founder, ghostwriter"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="voiceProfileMd">Voice profile</Label>
              <Textarea
                id="voiceProfileMd"
                name="voiceProfileMd"
                rows={6}
                defaultValue={defaults.voiceProfileMd}
                placeholder="Markdown describing voice, register, sentence rhythm."
                className="font-mono text-[13px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dos">Do</Label>
                <Textarea
                  id="dos"
                  name="dos"
                  rows={4}
                  defaultValue={defaults.dos}
                  placeholder="Use specifics. Numbers. Stakes."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="donts">Don&apos;t</Label>
                <Textarea
                  id="donts"
                  name="donts"
                  rows={4}
                  defaultValue={defaults.donts}
                  placeholder="No hashtags. No buzzwords."
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="samplePhrases">Sample phrases</Label>
              <Textarea
                id="samplePhrases"
                name="samplePhrases"
                rows={4}
                defaultValue={defaults.samplePhrases}
                placeholder="One per line. Calibrates style."
                className="font-mono text-[13px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <Label className="block mb-3">Platforms &amp; weekly cadence</Label>
              <div className="flex flex-col gap-2">
                {PLATFORMS.map((pl) => {
                  const checked = defaults.platforms.includes(pl.id);
                  const cad = defaults.cadence[pl.id] ?? (checked ? 1 : 0);
                  return (
                    <label
                      key={pl.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-bg-overlay/40 px-3 py-2.5 cursor-pointer hover:border-border-strong transition-colors"
                    >
                      <input
                        type="checkbox"
                        name="platforms"
                        value={pl.id}
                        defaultChecked={checked}
                        className="h-4 w-4 accent-accent"
                      />
                      <Badge variant={pl.variant}>{pl.label}</Badge>
                      <div className="flex-1" />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          name={`cadence_${pl.id}`}
                          defaultValue={cad}
                          min={0}
                          max={50}
                          className="h-8 w-20 font-mono text-center"
                        />
                        <span className="text-xs text-fg-subtle">/ week</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <a href="/strategy/personas">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </a>
              <Button type="submit">
                {mode === "create" ? (
                  <>
                    <Plus className="w-4 h-4" />
                    Create persona
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
