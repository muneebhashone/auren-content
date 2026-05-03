import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn, safeJson } from "@/lib/utils";
import type { Post, Persona } from "@/lib/db/schema";

type RationaleShape = {
  hookStrategy?: string;
  audience?: string;
  slotReasoning?: string;
  viralityLever?: string;
  expectedOutcome?: string;
};

const personaPalette = [
  "bg-accent/15 text-accent",
  "bg-linkedin/15 text-linkedin",
  "bg-warning/15 text-warning",
  "bg-fg/10 text-fg",
  "bg-danger/15 text-danger",
];

export function personaColor(personaId: number) {
  return personaPalette[personaId % personaPalette.length];
}

export function PostCard({
  post,
  persona,
  density = "calendar",
}: {
  post: Post;
  persona: Persona | undefined;
  density?: "calendar" | "kanban";
}) {
  const rationale = safeJson<RationaleShape>(post.rationaleJson, {});
  const peek =
    rationale.hookStrategy ||
    rationale.viralityLever ||
    rationale.expectedOutcome ||
    "";
  const initial = (persona?.name ?? "?").slice(0, 1).toUpperCase();
  const time = (() => {
    try {
      return format(new Date(post.scheduledFor), "EEE HH:mm");
    } catch {
      return post.scheduledFor;
    }
  })();

  return (
    <Link
      href={`/posts/${post.id}`}
      className={cn(
        "group block rounded-md border border-border bg-bg-elevated p-2.5 transition-colors hover:border-border-strong hover:bg-bg-overlay",
        density === "kanban" && "p-3"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
            persona ? personaColor(persona.id) : "bg-bg-overlay text-fg-subtle"
          )}
          title={persona?.name ?? "Unknown persona"}
        >
          {initial}
        </span>
        <Badge variant={post.platform === "linkedin" ? "linkedin" : "x"}>
          {post.platform === "linkedin" ? "LI" : "X"}
        </Badge>
        <span className="ml-auto font-mono text-[10px] text-fg-subtle">
          {time}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 text-[13px] leading-snug text-fg",
          density === "calendar" ? "line-clamp-2" : "line-clamp-3"
        )}
      >
        {post.hook || "(no hook yet)"}
      </div>
      {peek ? (
        <div
          className={cn(
            "mt-1.5 text-[11px] text-fg-subtle",
            density === "calendar" ? "line-clamp-1" : "line-clamp-2"
          )}
        >
          {peek}
        </div>
      ) : null}
    </Link>
  );
}
