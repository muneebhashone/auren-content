"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { VariantsDisplay } from "./variants-display";
import type { Variants, Signal } from "./types";

type PersonaOption = { id: number; name: string; role: string };
type Result = Variants & { id: number; signals: Signal[] };

export function RewriteForm({ personas }: { personas: PersonaOption[] }) {
  const router = useRouter();
  const [dump, setDump] = useState("");
  const [personaId, setPersonaId] = useState<number>(personas[0]?.id ?? 0);
  const [factCheck, setFactCheck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!dump.trim()) {
      setError("Add some text first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dump: dump.trim(), personaId, factCheck }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json as Result);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dump">What do you want to post?</Label>
          <Textarea
            id="dump"
            value={dump}
            onChange={(e) => setDump(e.target.value)}
            placeholder="Dump everything — bullet points, half-thoughts, links, claims. The model will rewrite it into a real post."
            rows={10}
            className="min-h-[220px] font-mono text-sm leading-relaxed"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="persona">Persona</Label>
            <Select
              id="persona"
              value={personaId}
              onChange={(e) => setPersonaId(Number(e.target.value))}
              disabled={loading}
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.role ? ` — ${p.role}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Options</Label>
            <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-bg-elevated text-sm cursor-pointer hover:bg-bg-overlay">
              <input
                type="checkbox"
                checked={factCheck}
                onChange={(e) => setFactCheck(e.target.checked)}
                disabled={loading}
                className="accent-accent"
              />
              <span>Fact-check (ground with research first)</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || !dump.trim()}>
            <Wand2 className="w-4 h-4" />
            {loading ? "Generating…" : "Generate"}
          </Button>
          {loading && factCheck ? (
            <span className="text-xs text-fg-muted">
              Grounding with research, then writing 4 variants…
            </span>
          ) : loading ? (
            <span className="text-xs text-fg-muted">
              Writing 4 variants in parallel (polished + faithful for each platform)…
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="flex items-start gap-2 p-3 rounded-md border border-danger/30 bg-danger/10 text-sm text-danger">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </form>

      {result ? (
        <VariantsDisplay
          variants={{ linkedin: result.linkedin, x: result.x }}
          signals={result.signals}
        />
      ) : null}
    </div>
  );
}
