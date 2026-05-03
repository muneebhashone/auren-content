"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateBody } from "@/app/(dashboard)/posts/[id]/actions";

export function EditableBody({
  postId,
  initial,
}: {
  postId: number;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = value !== initial;

  function save() {
    startTransition(async () => {
      await updateBody(postId, value);
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[220px] font-sans text-base leading-relaxed"
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-fg-subtle">
          {value.length} chars
          {savedAt && !dirty ? " · saved" : ""}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={save}
          disabled={!dirty || pending}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save body
        </Button>
      </div>
    </div>
  );
}
