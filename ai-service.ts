import OpenAI from "openai";

// Provider registry
// To add a new provider in the future:
// 1. Add one entry below.
// 2. Set its API key in .env.local.
// 3. Change AI_PRIMARY_PROVIDER or AI_FALLBACK_PROVIDER in .env.local.
// No route handler needs to change.
export type ProviderName = "deepseek" | "qwen" | "moonshot" | "glm" | "openai";

interface ProviderConfig {
  baseURL: string;
  defaultModel: string;
  envKeyName: string;
}

const PROVIDER_REGISTRY: Record<ProviderName, ProviderConfig> = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    envKeyName: "DEEPSEEK_API_KEY",
  },
  qwen: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    envKeyName: "QWEN_API_KEY",
  },
  moonshot: {
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    envKeyName: "MOONSHOT_API_KEY",
  },
  glm: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    envKeyName: "GLM_API_KEY",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    envKeyName: "OPENAI_API_KEY",
  },
};

const PROVIDER_NAMES = new Set<ProviderName>(Object.keys(PROVIDER_REGISTRY) as ProviderName[]);

// Circuit breaker
let lastQuotaExceededTime = 0;
const QUOTA_COOLDOWN_MS = 60000;

// Client cache
const clientCache = new Map<ProviderName, OpenAI>();

function normalizeProviderName(value: string | undefined, fallback: ProviderName): ProviderName {
  if (value && PROVIDER_NAMES.has(value as ProviderName)) {
    return value as ProviderName;
  }
  if (value) {
    console.warn(`[AI Service] WARNING: Unknown provider "${value}". Falling back to "${fallback}".`);
  }
  return fallback;
}

function getClient(providerName: ProviderName): OpenAI {
  const cachedClient = clientCache.get(providerName);
  if (cachedClient) return cachedClient;

  const config = PROVIDER_REGISTRY[providerName];
  const apiKey = process.env[config.envKeyName];

  if (!apiKey) {
    console.warn(`[AI Service] WARNING: ${config.envKeyName} is not set for provider "${providerName}".`);
  }

  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: apiKey || "MOCK_KEY",
  });

  clientCache.set(providerName, client);
  return client;
}

// Public interface
export interface GenerateParams {
  contents: string;
  systemInstruction?: string;
  temperature?: number;
}

/**
 * Single entry point for all AI calls in the project.
 * Provider and model are controlled by environment variables:
 * AI_PRIMARY_PROVIDER: default "deepseek"
 * AI_FALLBACK_PROVIDER: default "qwen"
 * AI_MODEL_OVERRIDE: optional override for the provider default model
 */
export async function generateAI(params: GenerateParams, maxAttempts = 3): Promise<string> {
  const now = Date.now();
  if (now - lastQuotaExceededTime < QUOTA_COOLDOWN_MS) {
    throw new Error("429 RESOURCE_EXHAUSTED (Circuit Breaker active - rate limit cooling down)");
  }

  const primaryName = normalizeProviderName(process.env.AI_PRIMARY_PROVIDER, "deepseek");
  const fallbackName = normalizeProviderName(process.env.AI_FALLBACK_PROVIDER, "qwen");
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const providerName = attempt === 1 ? primaryName : fallbackName;
    const config = PROVIDER_REGISTRY[providerName];
    const model = process.env.AI_MODEL_OVERRIDE || config.defaultModel;
    const apiKey = process.env[config.envKeyName];

    if (!apiKey || apiKey === "MOCK_KEY") {
      lastError = new Error(
        `[AI Service] ${config.envKeyName} API key is not configured for provider "${providerName}".`
      );
      console.warn(String(lastError));
      if (attempt < maxAttempts) continue;
      throw lastError;
    }

    try {
      const client = getClient(providerName);
      console.log(`[AI Service] Provider: ${providerName} | Model: ${model} | Attempt ${attempt}/${maxAttempts}`);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (params.systemInstruction) {
        messages.push({ role: "system", content: params.systemInstruction });
      }
      messages.push({ role: "user", content: params.contents });

      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: params.temperature ?? 0.8,
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (error: any) {
      lastError = error;
      const msg = error?.message || String(error);
      const is503 = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("unavailable");
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("Resource exhausted") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("rate limit") ||
        msg.includes("quota");
      const isTransient = is503 || isRateLimit;

      if (isRateLimit) lastQuotaExceededTime = Date.now();
      if (!isTransient) throw error;

      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 400 + Math.random() * 200;
        console.warn(
          `[AI Service] Attempt ${attempt} failed on "${providerName}". Retrying in ${Math.round(delay)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
