"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateHook } from "@/app/(dashboard)/posts/[id]/actions";

type AltHook = { hook: string; reasoning?: string };

export function HookEditor({
  postId,
  initial,
  altHooks,
}: {
  postId: number;
  initial: string;
  altHooks: AltHook[];
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initial;

  function save(next: string) {
    setValue(next);
    startTransition(async () => {
      await updateHook(postId, next);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[80px] text-xl font-semibold leading-snug"
      />
      <div className="flex items-center justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => save(value)}
          disabled={!dirty || pending}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save hook
        </Button>
      </div>
      {altHooks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
            Alt hooks
          </span>
          {altHooks.map((alt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => save(alt.hook)}
              disabled={pending}
              className={cn(
                "rounded-md border border-border bg-bg-elevated p-3 text-left transition-colors hover:border-border-strong hover:bg-bg-overlay",
                pending && "opacity-60"
              )}
            >
              <div className="text-sm text-fg">{alt.hook}</div>
              {alt.reasoning ? (
                <div className="mt-1 text-[11px] text-fg-subtle">
                  {alt.reasoning}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
