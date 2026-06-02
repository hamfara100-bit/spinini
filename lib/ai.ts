/**
 * AI helpers — tries the tRPC server first (key stays server-side).
 * Falls back to a direct OpenRouter call that:
 *   1. Fetches the live list of free models from OpenRouter (cached 6 h)
 *   2. Walks the list best-first (sorted by context_length — bigger = smarter)
 *   3. Skips rate-limited (429) or removed (404) models automatically
 *
 * No app update ever needed when OpenRouter adds or removes free models.
 *
 * Key priority: AsyncStorage (parent override) → EXPO_PUBLIC_OPENROUTER_KEY
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getVanillaClient } from "./trpc";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const AI_KEY_STORAGE = "@famkids/ai_key";
const MODEL_CACHE_STORAGE = "@famkids/free_models_cache";
const MODEL_CACHE_TTL_MS  = 6 * 60 * 60 * 1000; // refresh every 6 hours

// Per-request timeout so a slow/stuck model is abandoned and the next is tried,
// instead of stalling the whole chat.
const REQUEST_TIMEOUT_MS = 22_000;

// Only use the tRPC server when a REAL server URL is configured. The default is
// http://localhost:3000, which is unreachable from a device/emulator — trying it
// first made every AI call wait for a failed round-trip before the real request.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const SERVER_ENABLED = !!API_URL && !/localhost|127\.0\.0\.1|10\.0\.2\.2/.test(API_URL);

/**
 * Curated FAST free models, tried first (when available) for snappy replies.
 * Small/medium instruct models answer in a fraction of the time of the huge
 * long-context models the live list would otherwise pick first.
 */
const FAST_FREE_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "qwen/qwen-2.5-7b-instruct:free",
];

/** Last-resort list — used only when the /models endpoint itself is unreachable */
const FALLBACK_MODELS = [
  ...FAST_FREE_MODELS,
  "meta-llama/llama-3.3-70b-instruct:free",
];

interface ModelCache { models: string[]; fetchedAt: number }

// In-memory cache so we don't hit AsyncStorage on every message
let _memCache: ModelCache | null = null;

// ─── Live free-model discovery ────────────────────────────────────────────────

async function getLiveFreeModels(key: string): Promise<string[]> {
  const now = Date.now();

  // 1. Hot in-memory cache
  if (_memCache && now - _memCache.fetchedAt < MODEL_CACHE_TTL_MS) {
    return _memCache.models;
  }

  // 2. Warm AsyncStorage cache (survives app restarts within TTL)
  try {
    const raw = await AsyncStorage.getItem(MODEL_CACHE_STORAGE);
    if (raw) {
      const stored: ModelCache = JSON.parse(raw);
      if (now - stored.fetchedAt < MODEL_CACHE_TTL_MS) {
        _memCache = stored;
        return stored.models;
      }
    }
  } catch {}

  // 3. Fetch live list from OpenRouter
  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`models ${res.status}`);

    const data = (await res.json()) as {
      data: { id: string; context_length?: number }[];
    };

    const models = data.data
      .filter(m => m.id.endsWith(":free"))
      // Sort by context_length descending — bigger context == more capable model
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .map(m => m.id);

    if (models.length > 0) {
      const cache: ModelCache = { models, fetchedAt: now };
      _memCache = cache;
      AsyncStorage.setItem(MODEL_CACHE_STORAGE, JSON.stringify(cache)).catch(() => {});
      return models;
    }
  } catch {
    // Network error, bad JSON, etc. — fall through to static fallback
  }

  // 4. Static fallback — never throws
  return FALLBACK_MODELS;
}

// ─── API key resolution ───────────────────────────────────────────────────────

async function getBestKey(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(AI_KEY_STORAGE);
    if (stored?.trim()) return stored.trim();
  } catch {}
  const envKey = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
  if (envKey?.trim()) return envKey.trim();
  return "";
}

// ─── Core chat — walks live free model list, skips unavailable ones ───────────

async function tryModel(
  key: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://spinini.app",
        "X-Title": "Spinini",
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
  } catch (e) {
    // Aborted (timeout) or network error → tell caller to try the next model.
    throw Object.assign(new Error("skip:timeout"), { status: 429 });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429 || res.status === 404) {
    // Rate-limited or removed — tell caller to try next
    const e = Object.assign(new Error(`skip:${res.status}`), { status: res.status });
    throw e;
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function directChat(
  messages: { role: string; content: string }[],
  maxTokens = 512,
): Promise<string> {
  const key = await getBestKey();
  if (!key) throw new Error("No AI key configured. Add an OpenRouter key in Settings → AI Features.");

  // Fetch (or return cached) live free model list, then try the FAST curated
  // models first (when they're actually available) for snappy replies.
  const live = await getLiveFreeModels(key);
  const liveSet = new Set(live);
  const fast = FAST_FREE_MODELS.filter(m => liveSet.has(m));
  const fastSet = new Set(fast);
  const models = [...fast, ...live.filter(m => !fastSet.has(m))];

  let lastError: Error = new Error("All free models are currently unavailable. Please try again shortly.");

  for (const model of models) {
    try {
      const reply = await tryModel(key, model, messages, maxTokens);
      if (reply) return reply;
    } catch (err) {
      lastError = err as Error;
      const skippable =
        (err as Error & { status?: number }).status === 429 ||
        (err as Error & { status?: number }).status === 404 ||
        (err as Error).message.startsWith("skip:");
      if (!skippable) throw err; // Auth error, network error — don't retry
    }
  }

  throw lastError;
}

// ─── Kid AI buddy chat ────────────────────────────────────────────────────────

export async function buddyChat(
  messages: { role: "user" | "assistant"; content: string }[],
  kidAge: number,
  kidContext?: string,
): Promise<string> {
  const contextNote = kidContext ? `\n\nCurrent info about this child:\n${kidContext}` : "";
  const systemPrompt = `You are a friendly, safe AI buddy for a ${kidAge}-year-old child. Always be positive, encouraging, and age-appropriate. Never discuss violence, adult topics, or anything unsafe. Use simple language, fun emojis, and keep replies to 2-4 sentences.${contextNote}`;
  if (SERVER_ENABLED) {
    try {
      const { reply } = await getVanillaClient().buddy.kidChat.mutate({ messages, kidAge });
      return reply;
    } catch {}
  }
  return directChat([{ role: "system", content: systemPrompt }, ...messages], 384);
}

// ─── Parent AI agent ──────────────────────────────────────────────────────────

export async function parentAgentQuery(
  query: string,
  familyContext: string,
): Promise<string> {
  if (SERVER_ENABLED) {
    try {
      const { reply } = await getVanillaClient().agent.parentQuery.mutate({ query, familyContext });
      return reply;
    } catch {}
  }
  return directChat(
    [
      {
        role: "system",
        content: `You are a helpful AI assistant for a parent managing their family's digital life through Spinini. Be concise, practical, and supportive.${familyContext ? `\n\nFamily data:\n${familyContext}` : ""}`,
      },
      { role: "user", content: query },
    ],
    1024,
  );
}

// ─── Coloring page SVG ────────────────────────────────────────────────────────

export async function generateColoringSVG(subject: string): Promise<string> {
  if (SERVER_ENABLED) {
    try {
      const { svg } = await getVanillaClient().image.generateSvg.mutate({ subject });
      return svg;
    } catch {}
  }
  return directChat(
    [
      {
        role: "user",
        content: `Create a simple SVG coloring page for children about: "${subject}". Rules: viewBox="0 0 400 500" width="400" height="500", white background, black outlines only, stroke-width 3-6, simple large shapes, no text. Return ONLY raw SVG markup starting with <svg.`,
      },
    ],
    2048,
  );
}

// ─── Generic AI chat (homework helper, parenting coach, etc.) ─────────────────

export async function callAI(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string,
  maxTokens = 512,
): Promise<string> {
  return directChat(
    [{ role: "system", content: systemPrompt }, ...messages],
    maxTokens,
  );
}

// ─── Bedtime story ────────────────────────────────────────────────────────────

export async function claudeGenerateStory(
  theme: string,
  kidName: string,
  kidAge: number,
  character?: string,
): Promise<string> {
  if (SERVER_ENABLED) {
    try {
      const { text } = await getVanillaClient().story.generate.mutate({ prompt: theme, kidName, kidAge });
      return text;
    } catch {}
  }
  const characterNote = character ? ` Always include ${character} as the main character.` : "";
  return directChat(
    [
      {
        role: "system",
        content: `You are a creative children's story writer. Write engaging, age-appropriate stories that are positive, imaginative, and end happily.${characterNote}`,
      },
      {
        role: "user",
        content: `Write a bedtime story for ${kidName} (age ${kidAge}) about: "${theme}". 3-5 paragraphs, imaginative, ends with a happy sleepy conclusion.`,
      },
    ],
    1500,
  );
}
