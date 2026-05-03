import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { Target, Plus, Check, Pencil, Trash2, X } from "lucide-react";
import { db } from "@/lib/db/client";
import { quarterlyGoals } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const goalInput = z.object({
  quarter: z.string().trim().min(1, "Quarter required").regex(/^\d{4}-Q[1-4]$/, "Format: YYYY-Q1"),
  objective: z.string().trim().min(1, "Objective required"),
  narrative: z.string().trim().default(""),
  successMetrics: z.string().trim().default(""),
});

async function createGoal(formData: FormData) {
  "use server";
  const parsed = goalInput.parse({
    quarter: formData.get("quarter") ?? "",
    objective: formData.get("objective") ?? "",
    narrative: formData.get("narrative") ?? "",
    successMetrics: formData.get("successMetrics") ?? "",
  });
  await db.insert(quarterlyGoals).values({ ...parsed, active: false });
  revalidatePath("/strategy/goals");
}

async function updateGoal(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid goal id");
  const parsed = goalInput.parse({
    quarter: formData.get("quarter") ?? "",
    objective: formData.get("objective") ?? "",
    narrative: formData.get("narrative") ?? "",
    successMetrics: formData.get("successMetrics") ?? "",
  });
  await db.update(quarterlyGoals).set(parsed).where(eq(quarterlyGoals.id, id));
  revalidatePath("/strategy/goals");
  redirect("/strategy/goals");
}

async function activateGoal(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid goal id");
  await db.update(quarterlyGoals).set({ active: false }).where(ne(quarterlyGoals.id, id));
  await db.update(quarterlyGoals).set({ active: true }).where(eq(quarterlyGoals.id, id));
  revalidatePath("/strategy/goals");
}

async function deactivateGoal(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.update(quarterlyGoals).set({ active: false }).where(eq(quarterlyGoals.id, id));
  revalidatePath("/strategy/goals");
}

async function deleteGoal(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  await db.delete(quarterlyGoals).where(eq(quarterlyGoals.id, id));
  revalidatePath("/strategy/goals");
}

function defaultQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

export default async function QuarterlyGoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const editingId = edit ? Number(edit) : null;

  const goals = await db
    .select()
    .from(quarterlyGoals)
    .orderBy(desc(quarterlyGoals.active), desc(quarterlyGoals.createdAt));

  const activeCount = goals.filter((g) => g.active).length;
  const editing = editingId ? goals.find((g) => g.id === editingId) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Quarterly Goals"
        description="One active objective at a time. The active goal threads through every weekly brief."
        actions={
          <Badge variant={activeCount === 1 ? "accent" : "warning"}>
            <Target className="w-3 h-3" />
            {activeCount === 1 ? "1 active" : activeCount === 0 ? "no active goal" : `${activeCount} active`}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="flex flex-col gap-3">
          {goals.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-fg-muted">
                No goals yet. Add your first quarterly objective on the right.
              </CardContent>
            </Card>
          ) : (
            goals.map((g) => {
              const isEditing = editingId === g.id;
              if (isEditing) {
                return (
                  <Card key={g.id} className="border-accent/40">
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="text-sm">Editing {g.quarter}</CardTitle>
                      <a
                        href="/strategy/goals"
                        className="text-fg-subtle hover:text-fg text-xs flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </a>
                    </CardHeader>
                    <CardContent>
                      <form action={updateGoal} className="flex flex-col gap-4">
                        <input type="hidden" name="id" value={g.id} />
                        <GoalFields defaults={g} />
                        <div className="flex justify-end">
                          <Button type="submit" size="sm">
                            Save changes
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                );
              }
              return (
                <Card key={g.id} className={g.active ? "border-accent/50" : undefined}>
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-fg-subtle">{g.quarter}</span>
                        {g.active ? (
                          <Badge variant="accent">
                            <Check className="w-3 h-3" />
                            Active
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        {g.active ? (
                          <form action={deactivateGoal}>
                            <input type="hidden" name="id" value={g.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Deactivate
                            </Button>
                          </form>
                        ) : (
                          <form action={activateGoal}>
                            <input type="hidden" name="id" value={g.id} />
                            <Button type="submit" variant="secondary" size="sm">
                              <Check className="w-3 h-3" />
                              Activate
                            </Button>
                          </form>
                        )}
                        <a
                          href={`/strategy/goals?edit=${g.id}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-fg-muted hover:text-fg hover:bg-bg-overlay"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </a>
                        <form action={deleteGoal}>
                          <input type="hidden" name="id" value={g.id} />
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
                    <h3 className="text-base font-semibold leading-snug">{g.objective}</h3>
                    {g.narrative ? (
                      <p className="text-sm text-fg-muted whitespace-pre-wrap">{g.narrative}</p>
                    ) : null}
                    {g.successMetrics ? (
                      <div className="text-xs text-fg-subtle border-t border-border pt-3">
                        <span className="uppercase tracking-widest mr-2">Metrics</span>
                        <span className="text-fg-muted whitespace-pre-wrap font-mono">{g.successMetrics}</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {!editing ? (
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" />
                <CardTitle>New goal</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form action={createGoal} className="flex flex-col gap-4">
                <GoalFields
                  defaults={{
                    quarter: defaultQuarter(),
                    objective: "",
                    narrative: "",
                    successMetrics: "",
                  }}
                />
                <Button type="submit">
                  <Plus className="w-4 h-4" />
                  Add goal
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function GoalFields({
  defaults,
}: {
  defaults: { quarter: string; objective: string; narrative: string; successMetrics: string };
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="quarter">Quarter</Label>
        <Input
          id="quarter"
          name="quarter"
          defaultValue={defaults.quarter}
          placeholder="2026-Q2"
          className="font-mono"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="objective">Objective</Label>
        <Input
          id="objective"
          name="objective"
          defaultValue={defaults.objective}
          placeholder="Become the default voice on X for fractional CTOs"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="narrative">Narrative</Label>
        <Textarea
          id="narrative"
          name="narrative"
          rows={4}
          defaultValue={defaults.narrative}
          placeholder="Why this matters this quarter."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="successMetrics">Success metrics</Label>
        <Textarea
          id="successMetrics"
          name="successMetrics"
          rows={3}
          defaultValue={defaults.successMetrics}
          placeholder={"+10k followers\n3 inbound leads / week"}
          className="font-mono text-[13px]"
        />
      </div>
    </>
  );
}
