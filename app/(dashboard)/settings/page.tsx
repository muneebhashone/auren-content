import {
  DEFAULT_MODELS,
  getAllModelOverrides,
  type LlmTask,
} from "@/lib/llm/router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { saveOverridesAction, resetOverridesAction } from "./actions";

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
  const overrides = await getAllModelOverrides();

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
              Single API key powers all LLM calls. Stored only in environment.
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
        <CardHeader>
          <CardTitle>Model routing</CardTitle>
          <CardDescription>
            Per-task model selection. Leave override blank to use the default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOverridesAction} className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-bg-overlay">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-fg-subtle">
                    <th className="px-4 py-2 font-medium w-[180px]">Task</th>
                    <th className="px-4 py-2 font-medium">Default</th>
                    <th className="px-4 py-2 font-medium w-[280px]">
                      Override
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TASK_ORDER.map((task, i) => (
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
                          {DEFAULT_MODELS[task]}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Input
                          name={`override:${task}`}
                          defaultValue={overrides[task] ?? ""}
                          placeholder="provider/model-id"
                          className="font-mono text-xs"
                        />
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
