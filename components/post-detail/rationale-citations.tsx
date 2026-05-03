"use client";

import { useState, useRef, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type CitationSource = {
  id: number;
  claimKey: string;
  claim: string;
  sourceKind: string;
  sourceLabel: string;
  sourceDetail?: string;
  sourceUrl?: string;
};

const FIELD_LABEL: Record<string, string> = {
  hookStrategy: "Hook Strategy",
  audience: "Audience",
  slotReasoning: "Slot Reasoning",
  viralityLever: "Virality Lever",
  expectedOutcome: "Expected Outcome",
};

export function RationaleCitations({
  rationale,
  citations,
}: {
  rationale: Record<string, string | undefined>;
  citations: CitationSource[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpenId(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const byKey = new Map<string, CitationSource[]>();
  for (const c of citations) {
    const arr = byKey.get(c.claimKey) ?? [];
    arr.push(c);
    byKey.set(c.claimKey, arr);
  }

  const fields = Object.keys(FIELD_LABEL).filter(
    (k) => rationale[k] && rationale[k]!.length > 0
  );

  if (fields.length === 0) {
    return (
      <p className="text-sm text-fg-subtle">No rationale available.</p>
    );
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {fields.map((key) => {
        const cites = byKey.get(key) ?? [];
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
              {FIELD_LABEL[key]}
            </span>
            <p className="text-sm leading-relaxed text-fg">{rationale[key]}</p>
            {cites.length > 0 ? (
              <div className="relative flex flex-wrap gap-1.5">
                {cites.map((c) => (
                  <div key={c.id} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenId(openId === c.id ? null : c.id)
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                        openId === c.id
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-border bg-bg-overlay text-fg-muted hover:border-border-strong hover:text-fg"
                      )}
                    >
                      {c.sourceKind} · {c.sourceLabel}
                    </button>
                    {openId === c.id ? (
                      <div className="absolute left-0 top-full z-10 mt-1 w-80 rounded-md border border-border-strong bg-bg-overlay p-3">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                          {c.sourceKind}
                        </div>
                        <div className="mt-1 text-sm font-medium text-fg">
                          {c.sourceLabel}
                        </div>
                        {c.sourceDetail ? (
                          <div className="mt-1 text-xs text-fg-muted">
                            {c.sourceDetail}
                          </div>
                        ) : null}
                        <div className="mt-2 border-t border-border pt-2 text-[11px] italic text-fg-subtle">
                          “{c.claim}”
                        </div>
                        {c.sourceUrl ? (
                          <a
                            href={c.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open source
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
