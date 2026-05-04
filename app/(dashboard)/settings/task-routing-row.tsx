"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import type { LlmModelInfo } from "@/lib/llm/models";
import type { CodexReasoningEffort, LlmProvider } from "@/lib/llm/types";

interface Props {
  task: string;
  initialProvider: LlmProvider;
  initialModel: string;
  initialReasoningEffort: CodexReasoningEffort | "";
  defaultLabel: string;
  openRouterModels: LlmModelInfo[];
  openCodeModels: LlmModelInfo[];
  codexModels: LlmModelInfo[];
  openCodeAvailable: boolean;
  codexAvailable: boolean;
}

const ALL_VENDORS = "__all__";

function vendorOf(modelId: string): string {
  const idx = modelId.indexOf("/");
  return idx === -1 ? modelId : modelId.slice(0, idx);
}

export function TaskRoutingRow({
  task,
  initialProvider,
  initialModel,
  initialReasoningEffort,
  defaultLabel,
  openRouterModels,
  openCodeModels,
  codexModels,
  openCodeAvailable,
  codexAvailable,
}: Props) {
  const [provider, setProvider] = React.useState<LlmProvider>(initialProvider);
  const [model, setModel] = React.useState<string>(initialModel);
  const [vendor, setVendor] = React.useState<string>(
    initialModel ? vendorOf(initialModel) : ALL_VENDORS
  );
  const [reasoningEffort, setReasoningEffort] =
    React.useState<CodexReasoningEffort | "">(initialReasoningEffort);

  const allModels =
    provider === "openrouter"
      ? openRouterModels
      : provider === "opencode"
        ? openCodeModels
        : codexModels;

  const vendors = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of allModels) set.add(vendorOf(m.id));
    return Array.from(set).sort();
  }, [allModels]);

  const visibleModels = React.useMemo(() => {
    if (vendor === ALL_VENDORS) return allModels;
    return allModels.filter((m) => vendorOf(m.id) === vendor);
  }, [allModels, vendor]);

  // Always render the currently-selected model as an option, even if the
  // catalog hasn't loaded yet or vendor filter would hide it. This prevents
  // the controlled <select> from silently falling back to "" on submit.
  const renderedOptions = React.useMemo(() => {
    if (!model) return visibleModels;
    if (visibleModels.some((m) => m.id === model)) return visibleModels;
    return [{ id: model, name: model }, ...visibleModels];
  }, [model, visibleModels]);

  const onProviderChange = (next: LlmProvider) => {
    setProvider(next);
    setVendor(ALL_VENDORS);
    setModel("");
    if (next !== "codex") setReasoningEffort("");
  };

  const onVendorChange = (next: string) => {
    setVendor(next);
    if (model && next !== ALL_VENDORS && vendorOf(model) !== next) {
      setModel("");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        name={`override:${task}:provider`}
        value={provider}
        onChange={(e) => onProviderChange(e.target.value as LlmProvider)}
        className="text-xs"
      >
        <option value="openrouter">OpenRouter</option>
        <option value="opencode" disabled={!openCodeAvailable}>
          OpenCode {openCodeAvailable ? "" : "(unavailable)"}
        </option>
        <option value="codex" disabled={!codexAvailable}>
          Codex CLI {codexAvailable ? "" : "(unavailable)"}
        </option>
      </Select>
      <Select
        value={vendor}
        onChange={(e) => onVendorChange(e.target.value)}
        className="text-xs"
      >
        <option value={ALL_VENDORS}>All vendors ({allModels.length})</option>
        {vendors.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
      <Select
        name={`override:${task}:model`}
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="font-mono text-xs"
      >
        <option value="">— use default ({defaultLabel}) —</option>
        {renderedOptions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id}
          </option>
        ))}
      </Select>
      {provider === "codex" ? (
        <Select
          name={`override:${task}:reasoning`}
          value={reasoningEffort}
          onChange={(e) =>
            setReasoningEffort(e.target.value as CodexReasoningEffort | "")
          }
          className="text-xs"
        >
          <option value="">Default reasoning</option>
          <option value="low">Low reasoning</option>
          <option value="medium">Medium reasoning</option>
          <option value="high">High reasoning</option>
          <option value="xhigh">Extra high reasoning</option>
        </Select>
      ) : null}
    </div>
  );
}
