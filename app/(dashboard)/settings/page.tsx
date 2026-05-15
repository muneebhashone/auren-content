import {
  DEFAULT_ROUTING,
  getAllRoutingOverrides,
  type LlmTask,
} from "@/lib/llm/router";
import {
  listGatewayModelInfos,
  listGatewayProviderStatuses,
  type ProviderStatusInfo,
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
  saveContentMixAction,
} from "./actions";
import { ModelRoutingEditor } from "./model-routing-editor";
import {
  getGenerationConcurrency,
  CONCURRENCY_DEFAULT,
  CONCURRENCY_MIN,
  CONCURRENCY_MAX,
} from "@/lib/generation/settings";
import { getContentMix } from "@/lib/generation/content-mix";

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

const CAPABILITY_LABELS: Array<{
  key: keyof ProviderStatusInfo["capabilities"];
  label: string;
}> = [
  { key: "text", label: "Text" },
  { key: "imageInput", label: "Image input" },
  { key: "imageGeneration", label: "Image gen" },
  { key: "tools", label: "Tools" },
  { key: "streaming", label: "Streaming" },
  { key: "jsonMode", label: "JSON" },
  { key: "reasoningEffort", label: "Reasoning" },
];

function ProviderStatusCard({
  name,
  configured,
  modelCount,
  capabilities,
  detail,
  unavailableLabel = "Unavailable",
}: {
  name: string;
  configured: boolean;
  modelCount: number;
  capabilities: ProviderStatusInfo["capabilities"] | null;
  detail?: string;
  unavailableLabel?: string;
}) {
  const features = capabilities
    ? CAPABILITY_LABELS.filter((item) => capabilities[item.key])
    : [];

  return (
    <div className="flex min-h-[132px] flex-col gap-3 rounded-md border border-border bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <CardTitle className="text-sm">{name}</CardTitle>
        {configured ? (
          <Badge variant="accent" className="shrink-0">
            {modelCount} models
          </Badge>
        ) : (
          <Badge variant="warning" className="shrink-0">
            {unavailableLabel}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {features.length > 0 ? (
          features.map((feature) => (
            <Badge key={feature.key} variant="muted">
              {feature.label}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-fg-subtle">No capabilities reported</span>
        )}
      </div>
      {detail ? (
        <p className="line-clamp-2 text-xs leading-snug text-fg-subtle">{detail}</p>
      ) : null}
    </div>
  );
}

export default async function SettingsPage() {
  const [overrides, gatewayModels, gatewayProviders, concurrency, contentMix] =
    await Promise.all([
      getAllRoutingOverrides(),
      listGatewayModelInfos(),
      listGatewayProviderStatuses(),
      getGenerationConcurrency(),
      getContentMix(),
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
            {gatewayProviders.providers.length > 0 ? (
              gatewayProviders.providers.map((provider) => (
                <ProviderStatusCard
                  key={provider.id}
                  name={provider.name}
                  configured={provider.configured}
                  modelCount={provider.modelCount}
                  capabilities={provider.capabilities}
                  detail={provider.detail}
                  unavailableLabel="Unavailable"
                />
              ))
            ) : (
              <ProviderStatusCard
                name="AI Gateway"
                configured={false}
                modelCount={0}
                capabilities={null}
                unavailableLabel="Unavailable"
              />
            )}
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
              models={gatewayModels.models}
              providers={gatewayProviders.providers.map((provider) => ({
                id: provider.id,
                name: provider.name,
                configured: provider.configured,
              }))}
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

      <Card>
        <CardHeader>
          <CardTitle>Content mix</CardTitle>
          <CardDescription>
            Target percentage of each content type per week. Research slots are
            grounded in fresh signals. Story and opinion slots draw on the
            Story Bank. Values are normalized to sum to 100 on save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveContentMixAction} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="mix_research">Research %</Label>
                <Input
                  id="mix_research"
                  name="mix_research"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={contentMix.research}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mix_story">Story %</Label>
                <Input
                  id="mix_story"
                  name="mix_story"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={contentMix.story}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mix_fun">Fun %</Label>
                <Input
                  id="mix_fun"
                  name="mix_fun"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={contentMix.fun}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mix_opinion">Opinion %</Label>
                <Input
                  id="mix_opinion"
                  name="mix_opinion"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={contentMix.opinion}
                  className="font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-fg-subtle">
              Current sum: {contentMix.research + contentMix.story + contentMix.fun + contentMix.opinion}.
              Story slots draw on a story bank entry; opinion slots punch up at
              industry practices (no politics, no identity, no attacks on
              individuals).
            </p>
            <div>
              <Button type="submit" variant="default">
                Save content mix
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
