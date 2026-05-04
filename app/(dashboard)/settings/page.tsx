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
import { ModelRoutingEditor } from "./model-routing-editor";
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

function ProviderStatusCard({
  name,
  configured,
  unavailableLabel = "Unavailable",
}: {
  name: string;
  configured: boolean;
  unavailableLabel?: string;
}) {
  return (
    <div className="flex min-h-[88px] flex-col justify-between rounded-md border border-border bg-bg-elevated p-4">
      <CardTitle className="text-sm">{name}</CardTitle>
      {configured ? (
        <Badge variant="accent" className="self-start">
          Configured
        </Badge>
      ) : (
        <Badge variant="warning" className="self-start">
          {unavailableLabel}
        </Badge>
      )}
    </div>
  );
}

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
        <CardHeader>
          <CardTitle>Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ProviderStatusCard
              name="OpenRouter"
              configured={hasKey}
              unavailableLabel="Not set"
            />
            <ProviderStatusCard name="Codex CLI" configured={codex.available} />
            <ProviderStatusCard
              name="OpenCode CLI"
              configured={openCode.available}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model routing</CardTitle>
          <CardDescription>
            Add a model, then assign the purposes it should handle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOverridesAction} className="flex flex-col gap-4">
            <ModelRoutingEditor
              tasks={TASK_ORDER.map((task) => ({
                task,
                help: TASK_HELP[task],
                defaultRouting: DEFAULT_ROUTING[task],
              }))}
              overrides={overrides}
              openRouterModels={openRouter.models}
              openCodeModels={openCode.models}
              codexModels={codex.models}
              openCodeAvailable={openCode.available}
              codexAvailable={codex.available}
            />
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
