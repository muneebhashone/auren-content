"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { LlmModelInfo } from "@/lib/llm/models";
import type { LlmTask } from "@/lib/llm/router";
import type {
  ClaudeEffort,
  CodexReasoningEffort,
  LlmProvider,
  TaskRouting,
} from "@/lib/llm/types";
import { cn } from "@/lib/utils";

type TaskMeta = {
  task: LlmTask;
  help: string;
  defaultRouting: TaskRouting;
};

type ModelGroup = {
  id: string;
  provider: LlmProvider;
  model: string;
  reasoningEffort: CodexReasoningEffort | "";
  claudeEffort: ClaudeEffort | "";
  tasks: LlmTask[];
};

interface Props {
  tasks: TaskMeta[];
  overrides: Partial<Record<LlmTask, TaskRouting>>;
  openRouterModels: LlmModelInfo[];
  openCodeModels: LlmModelInfo[];
  codexModels: LlmModelInfo[];
  claudeModels: LlmModelInfo[];
  openCodeAvailable: boolean;
  codexAvailable: boolean;
  claudeAvailable: boolean;
}

const ALL_VENDORS = "__all__";

function vendorOf(modelId: string): string {
  const idx = modelId.indexOf("/");
  return idx === -1 ? modelId : modelId.slice(0, idx);
}

function providerLabel(provider: LlmProvider): string {
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "opencode") return "OpenCode";
  if (provider === "codex") return "Codex CLI";
  return "Claude Code";
}

function routeKey(route: TaskRouting): string {
  return `${route.provider}:${route.model}:${route.reasoningEffort ?? ""}:${route.claudeEffort ?? ""}`;
}

function createInitialGroups(
  taskOrder: LlmTask[],
  overrides: Partial<Record<LlmTask, TaskRouting>>
): ModelGroup[] {
  const grouped = new Map<string, ModelGroup>();
  for (const task of taskOrder) {
    const route = overrides[task];
    if (!route) continue;
    const key = routeKey(route);
    const existing = grouped.get(key);
    if (existing) {
      existing.tasks.push(task);
    } else {
      grouped.set(key, {
        id: key,
        provider: route.provider,
        model: route.model,
        reasoningEffort: route.reasoningEffort ?? "",
        claudeEffort: route.claudeEffort ?? "",
        tasks: [task],
      });
    }
  }
  return Array.from(grouped.values());
}

function nextGroupId(provider: LlmProvider, model: string): string {
  return `${provider}:${model}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function ModelRoutingEditor({
  tasks,
  overrides,
  openRouterModels,
  openCodeModels,
  codexModels,
  claudeModels,
  openCodeAvailable,
  codexAvailable,
  claudeAvailable,
}: Props) {
  const taskOrder = React.useMemo(() => tasks.map((item) => item.task), [tasks]);
  const [groups, setGroups] = React.useState<ModelGroup[]>(() =>
    createInitialGroups(taskOrder, overrides)
  );
  const [provider, setProvider] = React.useState<LlmProvider>("openrouter");
  const [vendor, setVendor] = React.useState<string>(ALL_VENDORS);
  const [model, setModel] = React.useState<string>("");

  const allModels =
    provider === "openrouter"
      ? openRouterModels
      : provider === "opencode"
        ? openCodeModels
        : provider === "codex"
          ? codexModels
          : claudeModels;

  const vendors = React.useMemo(() => {
    const set = new Set<string>();
    for (const item of allModels) set.add(vendorOf(item.id));
    return Array.from(set).sort();
  }, [allModels]);

  const visibleModels = React.useMemo(() => {
    if (vendor === ALL_VENDORS) return allModels;
    return allModels.filter((item) => vendorOf(item.id) === vendor);
  }, [allModels, vendor]);

  const routingByTask = React.useMemo(() => {
    const map = new Map<LlmTask, ModelGroup>();
    for (const group of groups) {
      for (const task of group.tasks) map.set(task, group);
    }
    return map;
  }, [groups]);

  const defaultTasks = tasks.filter((item) => !routingByTask.has(item.task));
  const canAdd =
    model.length > 0 &&
    (provider === "openrouter" ||
      (provider === "opencode" && openCodeAvailable) ||
      (provider === "codex" && codexAvailable) ||
      (provider === "claude" && claudeAvailable));

  const onProviderChange = (next: LlmProvider) => {
    setProvider(next);
    setVendor(ALL_VENDORS);
    setModel("");
  };

  const onVendorChange = (next: string) => {
    setVendor(next);
    if (model && next !== ALL_VENDORS && vendorOf(model) !== next) {
      setModel("");
    }
  };

  const addModel = () => {
    if (!canAdd) return;
    setGroups((current) => {
      if (
        current.some(
          (group) =>
            group.provider === provider &&
            group.model === model &&
            group.reasoningEffort === "" &&
            group.claudeEffort === ""
        )
      ) {
        return current;
      }
      return [
        ...current,
        {
          id: nextGroupId(provider, model),
          provider,
          model,
          reasoningEffort: "",
          claudeEffort: "",
          tasks: [],
        },
      ];
    });
    setModel("");
  };

  const removeGroup = (groupId: string) => {
    setGroups((current) => current.filter((group) => group.id !== groupId));
  };

  const setReasoningEffort = (
    groupId: string,
    reasoningEffort: CodexReasoningEffort | ""
  ) => {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId ? { ...group, reasoningEffort } : group
      )
    );
  };

  const setClaudeEffort = (groupId: string, claudeEffort: ClaudeEffort | "") => {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId ? { ...group, claudeEffort } : group
      )
    );
  };

  const toggleTask = (groupId: string, task: LlmTask) => {
    setGroups((current) => {
      const target = current.find((group) => group.id === groupId);
      const isAssigned = target?.tasks.includes(task) ?? false;
      return current.map((group) => {
        const withoutTask = group.tasks.filter((item) => item !== task);
        if (group.id !== groupId) return { ...group, tasks: withoutTask };
        return {
          ...group,
          tasks: isAssigned ? withoutTask : [...withoutTask, task],
        };
      });
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {taskOrder.map((task) => {
        const group = routingByTask.get(task);
        if (!group) return null;
        return (
          <React.Fragment key={task}>
            <input
              type="hidden"
              name={`override:${task}:provider`}
              value={group.provider}
            />
            <input
              type="hidden"
              name={`override:${task}:model`}
              value={group.model}
            />
            {group.provider === "codex" && group.reasoningEffort ? (
              <input
                type="hidden"
                name={`override:${task}:reasoning`}
                value={group.reasoningEffort}
              />
            ) : null}
            {group.provider === "claude" && group.claudeEffort ? (
              <input
                type="hidden"
                name={`override:${task}:claudeEffort`}
                value={group.claudeEffort}
              />
            ) : null}
          </React.Fragment>
        );
      })}

      <div className="rounded-md border border-border bg-bg-overlay/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-fg">Default routing</h3>
            <p className="text-xs text-fg-subtle">
              Purposes without an override use the built-in model.
            </p>
          </div>
          <Badge variant="muted">{defaultTasks.length} default</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {defaultTasks.length > 0 ? (
            defaultTasks.map((item) => (
              <span
                key={item.task}
                className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-xs text-fg-muted"
                title={`${item.defaultRouting.provider}/${item.defaultRouting.model}`}
              >
                <span className="font-medium text-fg">{item.task}</span>{" "}
                <span className="font-mono text-fg-subtle">
                  {item.defaultRouting.model}
                </span>
              </span>
            ))
          ) : (
            <span className="text-sm text-fg-subtle">
              Every purpose currently has a model override.
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[180px_180px_1fr_auto]">
        <Select
          value={provider}
          onChange={(event) => onProviderChange(event.target.value as LlmProvider)}
          className="text-xs"
        >
          <option value="openrouter">OpenRouter</option>
          <option value="opencode" disabled={!openCodeAvailable}>
            OpenCode {openCodeAvailable ? "" : "(unavailable)"}
          </option>
          <option value="codex" disabled={!codexAvailable}>
            Codex CLI {codexAvailable ? "" : "(unavailable)"}
          </option>
          <option value="claude" disabled={!claudeAvailable}>
            Claude Code {claudeAvailable ? "" : "(unavailable)"}
          </option>
        </Select>
        <Select
          value={vendor}
          onChange={(event) => onVendorChange(event.target.value)}
          className="text-xs"
        >
          <option value={ALL_VENDORS}>All vendors ({allModels.length})</option>
          {vendors.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="font-mono text-xs"
        >
          <option value="">Select a discovered model</option>
          {visibleModels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={addModel} disabled={!canAdd}>
          <Plus className="h-4 w-4" />
          Add model
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div
              key={group.id}
              className="rounded-md border border-border bg-bg-elevated p-4"
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="default">{providerLabel(group.provider)}</Badge>
                    <span className="font-mono text-sm text-fg break-all">
                      {group.model}
                    </span>
                  </div>
                  <p className="text-xs text-fg-subtle">
                    {group.tasks.length} purpose
                    {group.tasks.length === 1 ? "" : "s"} assigned
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {group.provider === "codex" ? (
                    <Select
                      value={group.reasoningEffort}
                      onChange={(event) =>
                        setReasoningEffort(
                          group.id,
                          event.target.value as CodexReasoningEffort | ""
                        )
                      }
                      className="w-[190px] text-xs"
                    >
                      <option value="">Default reasoning</option>
                      <option value="low">Low reasoning</option>
                      <option value="medium">Medium reasoning</option>
                      <option value="high">High reasoning</option>
                      <option value="xhigh">Extra high reasoning</option>
                    </Select>
                  ) : group.provider === "claude" ? (
                    <Select
                      value={group.claudeEffort}
                      onChange={(event) =>
                        setClaudeEffort(
                          group.id,
                          event.target.value as ClaudeEffort | ""
                        )
                      }
                      className="w-[190px] text-xs"
                    >
                      <option value="">Default effort</option>
                      <option value="low">Low effort</option>
                      <option value="medium">Medium effort</option>
                      <option value="high">High effort</option>
                      <option value="xhigh">Extra high effort</option>
                      <option value="max">Max effort</option>
                    </Select>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGroup(group.id)}
                    aria-label={`Remove ${group.model}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {tasks.map((item) => {
                  const active = group.tasks.includes(item.task);
                  const assignedTo = routingByTask.get(item.task);
                  const movedHere = assignedTo?.id === group.id;
                  return (
                    <label
                      key={item.task}
                      className={cn(
                        "flex min-h-[76px] cursor-pointer gap-3 rounded-md border p-3 transition-colors",
                        active
                          ? "border-accent/50 bg-accent/10"
                          : "border-border bg-bg hover:bg-bg-overlay"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleTask(group.id, item.task)}
                        className="mt-0.5 h-4 w-4 accent-current"
                      />
                      <span className="min-w-0">
                        <span className="mb-1 flex items-center gap-2 text-sm font-medium text-fg">
                          {item.task}
                          {assignedTo && !movedHere ? (
                            <span className="rounded-full bg-bg-overlay px-1.5 py-0.5 text-[10px] font-normal text-fg-subtle">
                              moves
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs leading-snug text-fg-subtle">
                          {item.help}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-fg-subtle">
            Add a discovered model, then choose the purposes it should handle.
          </div>
        )}
      </div>
    </div>
  );
}
