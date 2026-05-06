"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Variant, Variants, Signal } from "./types";

type Platform = "linkedin" | "x";
type Kind = "polished" | "faithful";

export function VariantsDisplay({
  variants,
  signals,
  editing,
  onChange,
}: {
  variants: Variants;
  signals: Signal[];
  editing?: boolean;
  onChange?: (next: Variants) => void;
}) {
  function updateVariant(platform: Platform, kind: Kind, next: Variant) {
    if (!onChange) return;
    onChange({
      ...variants,
      [platform]: { ...variants[platform], [kind]: next },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PlatformGroup
        platform="linkedin"
        title="LinkedIn"
        variants={variants.linkedin}
        editing={editing}
        onChange={(kind, next) => updateVariant("linkedin", kind, next)}
      />
      <PlatformGroup
        platform="x"
        title="X"
        variants={variants.x}
        editing={editing}
        onChange={(kind, next) => updateVariant("x", kind, next)}
      />
      {signals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {signals.map((s, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <span className="text-fg-muted">{s.summary}</span>
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline truncate"
                  >
                    {s.sourceUrl}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PlatformGroup({
  platform,
  title,
  variants,
  editing,
  onChange,
}: {
  platform: Platform;
  title: string;
  variants: { polished: Variant; faithful: Variant };
  editing?: boolean;
  onChange: (kind: Kind, next: Variant) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span
          className={
            platform === "linkedin"
              ? "inline-block w-2 h-2 rounded-full bg-linkedin"
              : "inline-block w-2 h-2 rounded-full bg-fg/70"
          }
        />
        {title}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VariantCard
          platform={platform}
          variant={variants.polished}
          kind="polished"
          label="Polished"
          subtitle="Persona voice, sharpened hook"
          editing={editing}
          onChange={(v) => onChange("polished", v)}
        />
        <VariantCard
          platform={platform}
          variant={variants.faithful}
          kind="faithful"
          label="Faithful"
          subtitle="Your tone and intent preserved"
          editing={editing}
          onChange={(v) => onChange("faithful", v)}
        />
      </div>
    </div>
  );
}

function VariantCard({
  platform,
  variant,
  kind,
  label,
  subtitle,
  editing,
  onChange,
}: {
  platform: Platform;
  variant: Variant;
  kind: Kind;
  label: string;
  subtitle: string;
  editing?: boolean;
  onChange: (next: Variant) => void;
}) {
  const [copied, setCopied] = useState(false);
  const fullText = formatPost(variant);
  const bodyChars = variant.body.length;
  const charStatus = charBadgeStatus(platform, bodyChars);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Badge variant={kind === "faithful" ? "accent" : "muted"}>
              {label}
            </Badge>
          </CardTitle>
          <span className="text-xs text-fg-subtle">{subtitle}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={
              charStatus === "bad"
                ? "danger"
                : charStatus === "warn"
                ? "warning"
                : "default"
            }
          >
            {bodyChars} chars
          </Badge>
          {!editing ? (
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Hook</Label>
              <Input
                value={variant.hook}
                onChange={(e) => onChange({ ...variant, hook: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Body</Label>
              <Textarea
                rows={6}
                value={variant.body}
                onChange={(e) => onChange({ ...variant, body: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Hashtags (space-separated)</Label>
              <Input
                value={variant.hashtags.join(" ")}
                onChange={(e) =>
                  onChange({
                    ...variant,
                    hashtags: e.target.value
                      .split(/\s+/)
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-fg whitespace-pre-wrap">
              {variant.hook}
            </div>
            <div className="text-sm text-fg-muted whitespace-pre-wrap">
              {variant.body}
            </div>
            {variant.hashtags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {variant.hashtags.map((tag, i) => (
                  <span key={i} className="text-xs text-accent">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatPost(v: Variant): string {
  const tags = v.hashtags.length ? `\n\n${v.hashtags.join(" ")}` : "";
  return `${v.hook}\n\n${v.body}${tags}`;
}

function charBadgeStatus(
  platform: Platform,
  chars: number
): "ok" | "warn" | "bad" {
  if (platform === "x") {
    if (chars > 270) return "bad";
    if (chars > 240) return "warn";
    return "ok";
  }
  if (chars < 600 || chars > 1400) return "warn";
  return "ok";
}
