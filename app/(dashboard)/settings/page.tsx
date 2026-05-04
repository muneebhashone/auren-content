import {
  DEFAULT_ROUTING,
  getAllRoutingOverrides,
  type LlmTask,
} from "@/lib/llm/router";
import {
  listOpenRouterModels,
  listOpenCodeModels,
  listCodexModels,
} from "@/lib/llm/models";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
  saveOverridesAction,
  resetOverridesAction,
  saveGenerationConcurrencyAction,
} from "./actions";
import { TaskRoutingRow } from "./task-routing-row";
import {
  getGenerationConcurrency,
  CONCURRENCY_DEFAULT,
  CONCURRENCY_MIN,
  CONCURRENCY_MAX,
} from "@/lib/generation/settings";

const TASK_ORDER: LlmTask[] = [
  "research",
  "strategy",
  "write",
  "hook",
  "polish",
  "rationale",
  "feedback-analysis",
];

const TASK_HELP: Record<LlmTask, string> = {
  research: "Grounded web search for live trend signals.",
  strategy: "Long-context planner for the weekly content brief.",
  write: "Voice-matched draft generation.",
  hook: "Punchy first-line hook generation.",
  polish: "Cheap, fast cleanup pass before publish.",
  rationale: "Reasoning + citation alignment for picks.",
  "feedback-analysis": "Pattern recognition over performance corpus.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  const [overrides, openRouter, openCode, codex, concurrency] = await Promise.all([
    getAllRoutingOverrides(),
    listOpenRouterModels(),
    listOpenCodeModels(),
    listCodexModels(),
    getGenerationConcurrency(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Configure provider credentials and per-task model routing."
      />

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>OpenRouter</CardTitle>
            <CardDescription>
              HTTP API. Key powers all OpenRouter-routed tasks.
            </CardDescription>
          </div>
          {hasKey ? (
            <Badge variant="accent">Configured</Badge>
          ) : (
            <Badge variant="warning">Not set</Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-fg-muted">
          <p>
            Set <code className="font-mono text-fg">OPENROUTER_API_KEY</code> in{" "}
            <code className="font-mono text-fg">.env.local</code> at the repo
            root, then restart the dev server. The key is never displayed here.
          </p>
          {!openRouter.available && hasKey && (
            <p className="text-warning">
              Model list unavailable: {openRouter.error}
            </p>
          )}
          <a
            href="https://openrouter.ai/"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline self-start text-sm"
          >
            openrouter.ai
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Codex CLI</CardTitle>
            <CardDescription>
              Local <code className="font-mono">codex</code> binary. Uses
              Codex CLI directly; no SDK.
            </CardDescription>
          </div>
          {codex.available ? (
            <Badge variant="accent">Configured</Badge>
          ) : (
            <Badge variant="warning">Unavailable</Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-fg-muted">
          {codex.available ? (
            <p>
              {codex.models.length} models discovered via{" "}
              <code className="font-mono">codex debug models</code>.
            </p>
          ) : (
            <p>
              CLI not reachable. Install{" "}
              <a
                href="https://developers.openai.com/codex/cli"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Codex CLI
              </a>
              , run <code className="font-mono">codex login</code> once, and
              ensure it&apos;s on PATH (or set{" "}
              <code className="font-mono">CODEX_BIN</code>).{" "}
              {codex.error && (
                <span className="text-warning">({codex.error})</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>OpenCode CLI</CardTitle>
            <CardDescription>
              Local <code className="font-mono">opencode</code> binary.
              Subscription auth via{" "}
              <code className="font-mono">opencode auth login</code>.
            </CardDescription>
          </div>
          {openCode.available ? (
            <Badge variant="accent">Configured</Badge>
          ) : (
            <Badge variant="warning">Unavailable</Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-fg-muted">
          {openCode.available ? (
            <p>
              {openCode.models.length} models discovered via{" "}
              <code className="font-mono">opencode models</code>.
            </p>
          ) : (
            <p>
              CLI not reachable. Install{" "}
              <a
                href="https://opencode.ai/docs/cli/"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                opencode
              </a>
              , run <code className="font-mono">opencode auth login</code> once,
              and ensure it&apos;s on PATH (or set{" "}
              <code className="font-mono">OPENCODE_BIN</code>).{" "}
              {openCode.error && (
                <span className="text-warning">({openCode.error})</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model routing</CardTitle>
          <CardDescription>
            Per-task provider and model. Leave model blank to use the default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOverridesAction} className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-bg-overlay">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle">
                    <th className="px-4 py-2 font-medium w-[200px]">Task</th>
                    <th className="px-4 py-2 font-medium">Default</th>
                    <th className="px-4 py-2 font-medium w-[340px]">
                      Override
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TASK_ORDER.map((task, i) => {
                    const def = DEFAULT_ROUTING[task];
                    const ov = overrides[task];
                    return (
                      <tr
                        key={task}
                        className={
                          i === TASK_ORDER.length - 1
                            ? ""
                            : "border-b border-border"
                        }
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-fg">{task}</div>
                          <div className="text-xs text-fg-subtle mt-1 leading-snug">
                            {TASK_HELP[task]}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="font-mono text-xs text-fg-subtle">
                            {def.provider}/{def.model}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <TaskRoutingRow
                            key={`${task}:${ov?.provider ?? def.provider}:${ov?.model ?? ""}`}
                            task={task}
                            initialProvider={ov?.provider ?? def.provider}
                            initialModel={ov?.model ?? ""}
                            initialReasoningEffort={ov?.reasoningEffort ?? ""}
                            defaultLabel={def.model}
                            openRouterModels={openRouter.models}
                            openCodeModels={openCode.models}
                            codexModels={codex.models}
                            openCodeAvailable={openCode.available}
                            codexAvailable={codex.available}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" variant="default">
                Save overrides
              </Button>
              <Button
                type="submit"
                variant="secondary"
                formAction={resetOverridesAction}
              >
                Reset to defaults
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generation pipeline</CardTitle>
          <CardDescription>
            How many posts the &ldquo;Generate this/next week&rdquo; pipeline
            writes in parallel. Higher values are faster but increase pressure
            on provider rate limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={saveGenerationConcurrencyAction}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2 max-w-xs">
              <Label htmlFor="generation_concurrency">Parallel slots</Label>
              <Input
                id="generation_concurrency"
                name="generation_concurrency"
                type="number"
                min={CONCURRENCY_MIN}
                max={CONCURRENCY_MAX}
                step={1}
                defaultValue={concurrency}
                className="font-mono"
              />
              <p className="text-xs text-fg-subtle">
                Range {CONCURRENCY_MIN}&ndash;{CONCURRENCY_MAX}. Default{" "}
                {CONCURRENCY_DEFAULT}. Set to 1 to restore fully sequential
                generation.
              </p>
            </div>
            <div>
              <Button type="submit" variant="default">
                Save concurrency
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
