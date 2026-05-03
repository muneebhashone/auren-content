"use client";

import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshDigestAction } from "./actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      <RefreshCw className={pending ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
      {pending ? "Refreshing…" : "Refresh digest"}
    </Button>
  );
}

export function RefreshDigestButton() {
  return (
    <form action={refreshDigestAction}>
      <Inner />
    </form>
  );
}
