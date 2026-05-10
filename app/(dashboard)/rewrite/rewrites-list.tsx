"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Save,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { VariantsDisplay } from "./variants-display";
import type { Variants, Signal } from "./types";

export type RewriteRow = {
  id: number;
  dump: string;
  personaId: number | null;
  personaName: string;
  factCheck: boolean;
  variants: Variants;
  signals: Signal[];
  createdAt: string;
  updatedAt: string;
};

export function RewritesList({ items }: { items: RewriteRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">History</h2>
        <span className="text-xs text-fg-subtle">
          {items.length === 0 ? "No rewrites yet" : `${items.length} saved`}
        </span>
      </div>
      {items.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <RewriteItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function RewriteItem({ item }: { item: RewriteRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dump, setDump] = useState(item.dump);
  const [variants, setVariants] = useState<Variants>(item.variants);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = editing && (dump !== item.dump || !sameVariants(variants, item.variants));

  function reset() {
    setDump(item.dump);
    setVariants(item.variants);
    setError(null);
    setEditing(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewrite/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dump: dump.trim(), variants }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this rewrite? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewrite/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-start gap-2 min-w-0 flex-1 text-left cursor-pointer"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 mt-0.5 text-fg-muted shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 mt-0.5 text-fg-muted shrink-0" />
          )}
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="muted">{item.personaName || "Unknown persona"}</Badge>
              {item.factCheck ? (
                <Badge variant="accent">Fact-checked</Badge>
              ) : null}
              <span className="text-xs text-fg-subtle">
                {formatDate(item.createdAt)}
              </span>
            </div>
            <p className="text-sm text-fg-muted line-clamp-2">{item.dump}</p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {open && !editing ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          ) : null}
          {editing ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={busy || !dirty || !dump.trim()}
              >
                <Save className="w-3.5 h-3.5" />
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={reset}
                disabled={busy}
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            </>
          ) : null}
          {!editing ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={remove}
              disabled={busy}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="flex flex-col gap-5 border-t border-border pt-5">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`dump-${item.id}`}>Original dump</Label>
              <Textarea
                id={`dump-${item.id}`}
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                rows={6}
                className="font-mono text-sm leading-relaxed"
              />
            </div>
          ) : (
            <details className="text-sm">
              <summary className="text-xs text-fg-subtle cursor-pointer hover:text-fg-muted">
                Show original dump
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-fg-muted text-sm">
                {item.dump}
              </p>
            </details>
          )}
          <VariantsDisplay
            rewriteId={item.id}
            variants={variants}
            signals={item.signals}
            editing={editing}
            onChange={setVariants}
          />
          {error ? (
            <div className="flex items-start gap-2 p-3 rounded-md border border-danger/30 bg-danger/10 text-sm text-danger">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function sameVariants(a: Variants, b: Variants): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
