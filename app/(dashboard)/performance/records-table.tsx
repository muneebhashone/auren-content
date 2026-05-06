"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RecordRow {
  postId: number;
  persona: string;
  platform: string;
  scheduledFor: string;
  hook: string;
  impressions: number;
  likes: number;
  comments: number;
  reposts: number;
  qualitativeNote: string;
  importedAt: string;
}

type SortKey = keyof RecordRow;

const COLUMNS: Array<{
  key: SortKey;
  label: string;
  numeric?: boolean;
  align?: "left" | "right";
  width?: string;
}> = [
  { key: "postId", label: "Post", numeric: true, align: "right", width: "70px" },
  { key: "persona", label: "Persona" },
  { key: "platform", label: "Platform", width: "100px" },
  { key: "scheduledFor", label: "Scheduled", width: "140px" },
  { key: "hook", label: "Hook" },
  { key: "impressions", label: "Imp", numeric: true, align: "right", width: "80px" },
  { key: "likes", label: "Lk", numeric: true, align: "right", width: "70px" },
  { key: "comments", label: "Cm", numeric: true, align: "right", width: "70px" },
  { key: "reposts", label: "Rp", numeric: true, align: "right", width: "70px" },
  { key: "qualitativeNote", label: "Note" },
];

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function RecordsTable({ rows }: { rows: RecordRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("importedAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, dir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setDir(key === "importedAt" || typeof rows[0]?.[key] === "number" ? "desc" : "asc");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-fg-muted">
        No performance records yet. Paste a CSV above to import.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-bg-overlay text-[10px] uppercase tracking-widest text-fg-subtle">
          <tr>
            {COLUMNS.map((c) => {
              const isActive = sortKey === c.key;
              const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "px-3 py-2 font-semibold whitespace-nowrap",
                    c.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-fg transition-colors",
                      c.align === "right" && "flex-row-reverse",
                      isActive && "text-fg"
                    )}
                  >
                    {c.label}
                    <Icon className="w-3 h-3" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.postId}
              className="border-t border-border hover:bg-bg-overlay/40 transition-colors"
            >
              <td className="px-3 py-2 text-right font-mono tabular-nums text-fg-muted">
                <Link href={`/posts/${r.postId}`} className="hover:text-accent">
                  #{r.postId}
                </Link>
              </td>
              <td className="px-3 py-2 text-fg">
                <Link href={`/posts/${r.postId}`} className="hover:text-accent">
                  {r.persona}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant={
                    r.platform === "linkedin"
                      ? "linkedin"
                      : r.platform === "reddit"
                        ? "reddit"
                        : "x"
                  }
                >
                  {r.platform}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono tabular-nums text-fg-muted text-xs">
                {formatDate(r.scheduledFor)}
              </td>
              <td className="px-3 py-2 text-fg-muted max-w-[320px]">
                <Link href={`/posts/${r.postId}`} className="hover:text-fg" title={r.hook}>
                  {truncate(r.hook, 70)}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {r.impressions.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {r.likes.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {r.comments.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {r.reposts.toLocaleString()}
              </td>
              <td
                className="px-3 py-2 text-fg-muted max-w-[260px] truncate"
                title={r.qualitativeNote}
              >
                {truncate(r.qualitativeNote, 60)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
