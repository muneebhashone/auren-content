import { spawn } from "node:child_process";
import { needsWindowsShell } from "./cli-spawn";

export interface LlmModelInfo {
  id: string;
  name: string;
}

export interface ModelListResult {
  models: LlmModelInfo[];
  available: boolean;
  error?: string;
}

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  result: ModelListResult;
}

let openRouterCache: CacheEntry | null = null;
let openCodeCache: CacheEntry | null = null;
let codexCache: CacheEntry | null = null;
let claudeCodeCache: CacheEntry | null = null;

function fresh(entry: CacheEntry | null): boolean {
  return !!entry && Date.now() - entry.at < TTL_MS;
}

export async function listOpenRouterModels(): Promise<ModelListResult> {
  if (fresh(openRouterCache)) return openRouterCache!.result;

  const apiKey = process.env.OPENROUTER_API_KEY;
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
    if (!res.ok) {
      const result: ModelListResult = {
        models: [],
        available: false,
        error: `OpenRouter ${res.status}`,
      };
      openRouterCache = { at: Date.now(), result };
      return result;
    }
    const data = (await res.json()) as {
      data?: Array<{ id?: string; name?: string }>;
    };
    const models: LlmModelInfo[] = (data.data ?? [])
      .filter((m): m is { id: string; name?: string } => typeof m.id === "string")
      .map((m) => ({ id: m.id, name: m.name || m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const result: ModelListResult = { models, available: true };
    openRouterCache = { at: Date.now(), result };
    return result;
  } catch (err) {
    const result: ModelListResult = {
      models: [],
      available: false,
      error: (err as Error).message,
    };
    openRouterCache = { at: Date.now(), result };
    return result;
  }
}

export async function listOpenCodeModels(): Promise<ModelListResult> {
  if (fresh(openCodeCache)) return openCodeCache!.result;

  const bin = process.env.OPENCODE_BIN || "opencode";
  const result = await new Promise<ModelListResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(bin, ["models"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: needsWindowsShell(bin),
    });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {}
      resolve({
        models: [],
        available: false,
        error: "opencode models timed out after 10s",
      });
    }, 10_000);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        models: [],
        available: false,
        error: `spawn failed: ${err.message}`,
      });
    });
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({
          models: [],
          available: false,
          error: `exit ${code}: ${stderr.trim() || "(empty)"}`,
        });
        return;
      }
      const ids = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^[A-Za-z0-9._-]+\/.+/.test(l));
      const models: LlmModelInfo[] = Array.from(new Set(ids))
        .sort()
        .map((id) => ({ id, name: id }));
      resolve({ models, available: true });
    });
  });
  openCodeCache = { at: Date.now(), result };
  return result;
}

export async function listCodexModels(): Promise<ModelListResult> {
  if (fresh(codexCache)) return codexCache!.result;

  const bin = process.env.CODEX_BIN || "codex";
  const result = await new Promise<ModelListResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(bin, ["debug", "models"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: needsWindowsShell(bin),
    });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {}
      resolve({
        models: fallbackCodexModels(),
        available: false,
        error: "codex debug models timed out after 10s",
      });
    }, 10_000);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        models: fallbackCodexModels(),
        available: false,
        error: `spawn failed: ${err.message}`,
      });
    });
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({
          models: fallbackCodexModels(),
          available: false,
          error: `exit ${code}: ${stderr.trim() || "(empty)"}`,
        });
        return;
      }
      try {
        const data = JSON.parse(stdout) as {
          models?: Array<{ slug?: string; display_name?: string }>;
        };
        const models: LlmModelInfo[] = (data.models ?? [])
          .filter((m): m is { slug: string; display_name?: string } => typeof m.slug === "string")
          .map((m) => ({ id: m.slug, name: m.display_name || m.slug }))
          .sort((a, b) => a.id.localeCompare(b.id));
        resolve({ models: models.length ? models : fallbackCodexModels(), available: true });
      } catch (err) {
        resolve({
          models: fallbackCodexModels(),
          available: false,
          error: `parse failed: ${(err as Error).message}`,
        });
      }
    });
  });
  codexCache = { at: Date.now(), result };
  return result;
}

export async function listClaudeCodeModels(): Promise<ModelListResult> {
  if (fresh(claudeCodeCache)) return claudeCodeCache!.result;

  const bin = process.env.CLAUDE_CODE_BIN || "claude";
  const result = await new Promise<ModelListResult>((resolve) => {
    let stderr = "";
    let settled = false;
    const child = spawn(bin, ["auth", "status", "--text"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: needsWindowsShell(bin),
    });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {}
      resolve({
        models: configuredClaudeModels(),
        available: false,
        error: "claude auth status timed out after 10s",
      });
    }, 10_000);

    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        models: configuredClaudeModels(),
        available: false,
        error: `spawn failed: ${err.message}`,
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        models: configuredClaudeModels(),
        available: code === 0,
        ...(code === 0 ? {} : { error: `exit ${code}: ${stderr.trim() || "(empty)"}` }),
      });
    });
  });
  claudeCodeCache = { at: Date.now(), result };
  return result;
}

function fallbackCodexModels(): LlmModelInfo[] {
  return ["gpt-5.5", "gpt-5.4", "gpt-5.3-codex", "gpt-5.3-codex-spark"].map(
    (id) => ({ id, name: id })
  );
}

function configuredClaudeModels(): LlmModelInfo[] {
  const fromEnv = process.env.CLAUDE_CODE_MODELS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const ids = fromEnv?.length
    ? fromEnv
    : [
        "default",
        "best",
        "sonnet",
        "opus",
        "haiku",
        "sonnet[1m]",
        "opus[1m]",
        "opusplan",
        "claude-sonnet-4-6",
        "claude-opus-4-7",
      ];
  return Array.from(new Set(ids)).map((id) => ({ id, name: id }));
}
