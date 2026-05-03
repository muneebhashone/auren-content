import type { Post, Persona } from "@/lib/db/schema";
import { PostCard } from "./post-card";

const COLUMNS: { key: Post["status"]; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "approved", label: "Approved" },
  { key: "posted", label: "Posted" },
  { key: "logged", label: "Logged" },
];

export function KanbanBoard({
  posts,
  personas,
}: {
  posts: Post[];
  personas: Persona[];
}) {
  const personasById = new Map(personas.map((p) => [p.id, p]));
  const byStatus = new Map<string, Post[]>();
  for (const p of posts) {
    const arr = byStatus.get(p.status) ?? [];
    arr.push(p);
    byStatus.set(p.status, arr);
  }
  for (const arr of byStatus.values()) {
    arr.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {COLUMNS.map((col) => {
        const items = byStatus.get(col.key) ?? [];
        return (
          <div
            key={col.key}
            className="flex min-h-[420px] flex-col rounded-lg border border-border bg-bg-elevated/40"
          >
            <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-muted">
                {col.label}
              </span>
              <span className="font-mono text-xs text-fg-subtle">
                {items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {items.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[11px] text-fg-subtle">
                  empty
                </div>
              ) : (
                items.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    persona={personasById.get(post.personaId)}
                    density="kanban"
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
