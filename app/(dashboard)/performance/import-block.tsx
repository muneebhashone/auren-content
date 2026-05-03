"use client";

import { useActionState } from "react";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { importCsvAction } from "./actions";
import type { ImportSummary } from "@/lib/feedback/import";

export function CsvImportBlock() {
  const [state, action, pending] = useActionState<ImportSummary | null, FormData>(
    importCsvAction,
    null
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-accent" />
          <CardTitle>Import performance CSV</CardTitle>
        </div>
        <CardDescription>
          Columns: <span className="font-mono text-[12px]">post_id, impressions, likes, comments, reposts, qualitative_note</span>.
          One row per post. Existing rows are replaced.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <Textarea
            name="csv"
            rows={8}
            placeholder={
              "post_id,impressions,likes,comments,reposts,qualitative_note\n12,4200,84,12,3,got us a real lead"
            }
            className="font-mono text-[12px]"
            required
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-fg-subtle">
              Importing replaces any prior record for the same post_id and invalidates the digest cache.
            </p>
            <Button type="submit" disabled={pending}>
              <Upload className="w-4 h-4" />
              {pending ? "Importing…" : "Import"}
            </Button>
          </div>
        </form>

        {state ? <ImportResult summary={state} /> : null}
      </CardContent>
    </Card>
  );
}

function ImportResult({ summary }: { summary: ImportSummary }) {
  const ok = summary.inserted + summary.updated;
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-md border border-border bg-bg p-4">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <span className="font-mono tabular-nums">{ok}</span>
          <span className="text-fg-muted">imported</span>
        </div>
        <div className="text-fg-subtle">·</div>
        <div className="font-mono tabular-nums text-fg-muted">
          <span className="text-fg">{summary.inserted}</span> new ·{" "}
          <span className="text-fg">{summary.updated}</span> updated
        </div>
        {summary.errors.length > 0 ? (
          <>
            <div className="text-fg-subtle">·</div>
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-mono tabular-nums">{summary.errors.length}</span>
              <span className="text-fg-muted">errors</span>
            </div>
          </>
        ) : null}
      </div>

      {summary.errors.length > 0 ? (
        <ul className="text-xs text-fg-muted divide-y divide-border max-h-48 overflow-y-auto">
          {summary.errors.map((e, i) => (
            <li key={i} className="py-1.5 flex gap-3">
              <span className="font-mono tabular-nums text-fg-subtle shrink-0 w-16">
                row {e.rowNumber}
              </span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
