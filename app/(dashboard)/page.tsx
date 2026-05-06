import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { posts, personas, weeklyBriefs } from "@/lib/db/schema";
import { formatIsoWeek, isoWeekRange } from "@/lib/utils";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { KanbanBoard } from "@/components/calendar/kanban-board";
import { GenerationStatusBanner } from "@/components/calendar/generation-status-banner";

type SP = {
  week?: string;
  personas?: string;
  platform?: string;
  view?: string;
};

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const isoWeek = sp.week ?? formatIsoWeek();
  const view: "calendar" | "kanban" =
    sp.view === "kanban" ? "kanban" : "calendar";
  const platform: "all" | "x" | "linkedin" | "reddit" =
    sp.platform === "x" ||
    sp.platform === "linkedin" ||
    sp.platform === "reddit"
      ? sp.platform
      : "all";
  const selectedPersonaIds = (sp.personas ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const [allPersonas, brief] = await Promise.all([
    db.select().from(personas).orderBy(personas.name),
    db
      .select()
      .from(weeklyBriefs)
      .where(eq(weeklyBriefs.isoWeek, isoWeek))
      .limit(1)
      .then((r) => r[0]),
  ]);

  let weekPosts: (typeof posts.$inferSelect)[] = [];
  if (brief) {
    const filters = [eq(posts.weekId, brief.id)];
    if (platform !== "all") filters.push(eq(posts.platform, platform));
    if (selectedPersonaIds.length > 0)
      filters.push(inArray(posts.personaId, selectedPersonaIds));
    weekPosts = await db
      .select()
      .from(posts)
      .where(filters.length > 1 ? and(...filters) : filters[0]);
  }

  const { start, end } = isoWeekRange(isoWeek);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-fg-muted">
            {isoWeek} · {start.toUTCString().slice(5, 16)} —{" "}
            {end.toUTCString().slice(5, 16)} ·{" "}
            {brief ? `${weekPosts.length} posts` : "no brief yet"}
          </p>
        </div>
      </header>

      <GenerationStatusBanner isoWeek={isoWeek} />

      <CalendarToolbar
        isoWeek={isoWeek}
        personas={allPersonas}
        selectedPersonaIds={selectedPersonaIds}
        platform={platform}
        view={view}
      />

      {!brief ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-elevated/30 p-10 text-center">
          <p className="text-sm font-medium">No brief for {isoWeek}</p>
          <p className="text-xs text-fg-subtle">
            Use “Generate next week” to create posts, or navigate to a different
            week.
          </p>
        </div>
      ) : view === "kanban" ? (
        <KanbanBoard posts={weekPosts} personas={allPersonas} />
      ) : (
        <CalendarGrid
          isoWeek={isoWeek}
          posts={weekPosts}
          personas={allPersonas}
        />
      )}
    </div>
  );
}
