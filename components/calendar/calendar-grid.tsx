import { format } from "date-fns";
import { isoWeekRange, cn } from "@/lib/utils";
import type { Post, Persona } from "@/lib/db/schema";
import { PostCard } from "./post-card";

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function CalendarGrid({
  isoWeek,
  posts,
  personas,
}: {
  isoWeek: string;
  posts: Post[];
  personas: Persona[];
}) {
  const { start } = isoWeekRange(isoWeek);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });

  const byDay = new Map<string, Post[]>();
  for (const p of posts) {
    let k: string;
    try {
      k = format(new Date(p.scheduledFor), "yyyy-MM-dd");
    } catch {
      continue;
    }
    const arr = byDay.get(k) ?? [];
    arr.push(p);
    byDay.set(k, arr);
  }
  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  }

  const personasById = new Map(personas.map((p) => [p.id, p]));
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const k = dayKey(d);
        const dayPosts = byDay.get(k) ?? [];
        const isToday = k === today;
        return (
          <div
            key={k}
            className="flex min-h-[420px] flex-col rounded-lg border border-border bg-bg-elevated/40"
          >
            <div
              className={cn(
                "flex items-baseline justify-between border-b border-border px-3 py-2",
                isToday && "bg-bg-overlay"
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted">
                {format(d, "EEE")}
              </span>
              <span
                className={cn(
                  "font-mono text-xs",
                  isToday ? "text-accent" : "text-fg-subtle"
                )}
              >
                {format(d, "MMM d")}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {dayPosts.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[11px] text-fg-subtle">
                  no posts
                </div>
              ) : (
                dayPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    persona={personasById.get(post.personaId)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
