"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  Check,
  Archive,
  Trash2,
  Copy,
  CheckCircle2,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateStatus,
  deletePost,
  generateImage,
} from "@/app/(dashboard)/posts/[id]/actions";

export function PostActions({
  postId,
  hook,
  body,
  hashtags,
  hasImagePrompt,
}: {
  postId: number;
  hook: string;
  body: string;
  hashtags: string[];
  hasImagePrompt: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [regenerating, setRegenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [copied, setCopied] = useState(false);

  function setStatus(status: "approved" | "posted" | "logged") {
    startTransition(async () => {
      await updateStatus(postId, status);
    });
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/generate/post/${postId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Regenerate failed");
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  async function copyToClipboard() {
    const text = [hook, "", body, "", hashtags.map((h) => `#${h}`).join(" ")]
      .join("\n")
      .trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      alert("Copy failed");
    }
  }

  async function onGenerateImage() {
    setGeneratingImage(true);
    try {
      await generateImage(postId);
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setGeneratingImage(false);
    }
  }

  function onDelete() {
    if (!confirm("Delete this post permanently?")) return;
    startTransition(async () => {
      await deletePost(postId);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={regenerate}
        disabled={regenerating || pending}
      >
        {regenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Regenerate
      </Button>
      <Button
        variant="secondary"
        onClick={() => setStatus("approved")}
        disabled={pending}
      >
        <Check className="h-4 w-4" />
        Approve
      </Button>
      <Button
        variant="secondary"
        onClick={() => setStatus("posted")}
        disabled={pending}
      >
        <Check className="h-4 w-4" />
        Mark Posted
      </Button>
      <Button
        variant="secondary"
        onClick={() => setStatus("logged")}
        disabled={pending}
      >
        <Archive className="h-4 w-4" />
        Mark Logged
      </Button>
      <Button variant="secondary" onClick={copyToClipboard}>
        {copied ? (
          <CheckCircle2 className="h-4 w-4 text-accent" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
      {hasImagePrompt ? (
        <Button
          variant="secondary"
          onClick={onGenerateImage}
          disabled={generatingImage || pending}
        >
          {generatingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          {generatingImage ? "Generating image" : "Generate image"}
        </Button>
      ) : null}
      <div className="ml-auto">
        <Button variant="danger" onClick={onDelete} disabled={pending}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}
