import {
  listGatewayModels,
  listGatewayProviderModels,
  listGatewayProviders,
  type GatewayCapabilities,
} from "./gateway";

export interface LlmModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: GatewayCapabilities;
  description?: string;
}

export interface ModelListResult {
  models: LlmModelInfo[];
  available: boolean;
  error?: string;
}

export interface ProviderStatusInfo {
  id: string;
  name: string;
  configured: boolean;
  modelCount: number;
  capabilities: GatewayCapabilities;
  detail?: string;
}

export interface ProviderStatusResult {
  providers: ProviderStatusInfo[];
  available: boolean;
  error?: string;
}

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  at: number;
  result: T;
}

let modelsCache: CacheEntry<ModelListResult> | null = null;
let providersCache: CacheEntry<ProviderStatusResult> | null = null;
const providerModelCache = new Map<string, CacheEntry<ModelListResult>>();

function fresh<T>(entry: CacheEntry<T> | null): boolean {
  return !!entry && Date.now() - entry.at < TTL_MS;
}

export async function listGatewayModelInfos(): Promise<ModelListResult> {
  if (fresh(modelsCache)) return modelsCache!.result;
  try {
    const models = (await listGatewayModels())
      .map((model) => ({
        id: model.id,
        name: model.id,
        provider: model.provider,
        capabilities: model.capabilities,
        description: model.description,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const result: ModelListResult = { models, available: true };
    modelsCache = { at: Date.now(), result };
    return result;
  } catch (err) {
    const result: ModelListResult = {
      models: [],
      available: false,
      error: (err as Error).message,
    };
    modelsCache = { at: Date.now(), result };
    return result;
  }
}

export async function listGatewayProviderModelInfos(
  provider: string
): Promise<ModelListResult> {
  const cached = providerModelCache.get(provider) ?? null;
  if (fresh(cached)) return cached!.result;
  try {
    const models = (await listGatewayProviderModels(provider))
      .map((model) => ({
        id: model.id,
        name: model.id,
        provider: model.provider,
        capabilities: model.capabilities,
        description: model.description,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const result: ModelListResult = { models, available: true };
    providerModelCache.set(provider, { at: Date.now(), result });
    return result;
  } catch (err) {
    const result: ModelListResult = {
      models: [],
      available: false,
      error: (err as Error).message,
    };
    providerModelCache.set(provider, { at: Date.now(), result });
    return result;
  }
}

export async function listGatewayProviderStatuses(): Promise<ProviderStatusResult> {
  if (fresh(providersCache)) return providersCache!.result;
  try {
    const providers = (await listGatewayProviders())
      .map((provider) => ({
        id: provider.id,
        name: providerLabel(provider.id),
        configured: provider.healthy,
        modelCount: provider.model_count,
        capabilities: provider.capabilities,
        detail: provider.health_detail,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const result: ProviderStatusResult = { providers, available: true };
    providersCache = { at: Date.now(), result };
    return result;
  } catch (err) {
    const result: ProviderStatusResult = {
      providers: [],
      available: false,
      error: (err as Error).message,
    };
    providersCache = { at: Date.now(), result };
    return result;
  }
}

function providerLabel(id: string): string {
  if (id === "openrouter") return "OpenRouter";
  if (id === "opencode") return "OpenCode";
  if (id === "codex") return "Codex";
  if (id === "claude-code") return "Claude Code";
  if (id === "deepseek") return "DeepSeek";
  return id;
}
