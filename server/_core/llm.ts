import { env } from "./env";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Last-resort list — used only when the /models endpoint itself is unreachable */
const FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-v4-flash:free",
  "qwen/qwen3-coder:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
];

interface ModelCache { models: string[]; fetchedAt: number }
let _memCache: ModelCache | null = null;

// ─── Live free-model discovery ─────────────────────────────────────────────────

async function getLiveFreeModels(): Promise<string[]> {
  const now = Date.now();

  // Return in-memory cache if still fresh
  if (_memCache && now - _memCache.fetchedAt < MODEL_CACHE_TTL_MS) {
    return _memCache.models;
  }

  if (!env.OPENROUTER_API_KEY) return FALLBACK_MODELS;

  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    });
    if (!res.ok) throw new Error(`models ${res.status}`);

    const data = (await res.json()) as {
      data: { id: string; context_length?: number }[];
    };

    const models = data.data
      .filter(m => m.id.endsWith(":free"))
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .map(m => m.id);

    if (models.length > 0) {
      _memCache = { models, fetchedAt: now };
      return models;
    }
  } catch {
    // Network/parse error — fall through
  }

  return FALLBACK_MODELS;
}

// ─── Core chat — walks live model list, skips unavailable ones ─────────────────

type Message = { role: "system" | "user" | "assistant"; content: string };

async function tryModel(model: string, messages: Message[], maxTokens: number): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured on the server.");
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://famkids.app",
      "X-Title": "Spinini",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (res.status === 429 || res.status === 404) {
    const e = Object.assign(new Error(`skip:${res.status}`), { status: res.status });
    throw e;
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function chat(messages: Message[], maxTokens = 512): Promise<string> {
  const models = await getLiveFreeModels();
  let lastError: Error = new Error("All free models are currently unavailable.");

  for (const model of models) {
    try {
      const reply = await tryModel(model, messages, maxTokens);
      if (reply) return reply;
    } catch (err) {
      lastError = err as Error;
      const skippable =
        (err as Error & { status?: number }).status === 429 ||
        (err as Error & { status?: number }).status === 404 ||
        (err as Error).message.startsWith("skip:");
      if (!skippable) throw err;
    }
  }

  throw lastError;
}

// ─── Kid-safe buddy chat ───────────────────────────────────────────────────────

export async function kidSafeChat(
  messages: { role: "user" | "assistant"; content: string }[],
  kidAge: number,
): Promise<string> {
  return chat(
    [
      {
        role: "system",
        content: `You are a friendly, safe AI buddy for a ${kidAge}-year-old child.
Always be positive, encouraging, and age-appropriate.
Never discuss violence, adult topics, or anything unsafe.
Use simple language, fun emojis, and keep replies to 2-4 sentences.
If asked about homework, help gently without just giving answers.`,
      },
      ...messages,
    ],
    512,
  );
}

// ─── Parent AI agent ──────────────────────────────────────────────────────────

export async function parentAgentQuery(
  query: string,
  familyContext: string,
): Promise<string> {
  return chat(
    [
      {
        role: "system",
        content: `You are a helpful AI assistant for a parent managing their family's digital life through Spinini.
You have access to data about kids' screen time, chores, behavior points, school assignments, and schedules.
Be concise, practical, and supportive. Give direct, actionable answers.${
  familyContext ? `\n\nFamily data:\n${familyContext}` : ""
}`,
      },
      { role: "user", content: query },
    ],
    1024,
  );
}

// ─── Story generator ──────────────────────────────────────────────────────────

export async function generateStory(
  prompt: string,
  kidName: string,
  kidAge: number,
): Promise<string> {
  return chat(
    [
      {
        role: "system",
        content: `You are a creative children's story writer.
Write engaging, age-appropriate stories that are positive, imaginative, and end happily.
Use simple language for younger kids. No violence, scary content, or adult themes.`,
      },
      {
        role: "user",
        content: `Write a bedtime story for ${kidName} (age ${kidAge}) about: "${prompt}".
3-5 paragraphs, imaginative, ends with a happy sleepy conclusion.`,
      },
    ],
    1500,
  );
}

// ─── Coloring page SVG generator ──────────────────────────────────────────────

export async function generateColoringSVG(subject: string): Promise<string> {
  const text = await chat(
    [
      {
        role: "user",
        content: `Create a simple SVG coloring page for children about: "${subject}".

Rules:
- SVG must have exactly: viewBox="0 0 400 500" width="400" height="500"
- Start with a white background <rect width="400" height="500" fill="white"/>
- Black outlines ONLY — stroke="black", all shapes filled with white (fill="white") so kids can color them in
- stroke-width between 3 and 6 — thick bold lines easy to color inside
- Simple large clear shapes — no tiny details, no gradients, no patterns
- No text, no labels
- Drawing should fill most of the canvas
- Return ONLY the raw SVG markup starting with <svg and ending with </svg> — no explanation, no markdown fences`,
      },
    ],
    2048,
  );

  const match = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (match) return match[0];
  if (text.trim().startsWith("<svg")) return text.trim();
  throw new Error("Model did not return valid SVG. Try a different subject.");
}

// ─── Quiz generator ───────────────────────────────────────────────────────────

export interface GeneratedQuiz {
  title: string;
  readingMaterial: string;
  questions: Array<{
    type: "multiple_choice" | "text";
    question: string;
    options?: string[];
    correctAnswer: string;
    hint?: string;
  }>;
}

export async function generateQuizFromText(
  text: string,
  numQuestions = 5,
): Promise<GeneratedQuiz> {
  const raw = await chat(
    [
      {
        role: "system",
        content: `You are an educational quiz maker. Create quiz questions from the provided text.
Return ONLY valid JSON — no markdown, no explanation. Format exactly:
{
  "title": "Quiz title here",
  "readingMaterial": "The full text summarized for reading (1-3 paragraphs)",
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "0",
      "hint": "Short hint from the text"
    }
  ]
}
Use "0","1","2","3" for correctAnswer in multiple_choice (index of correct option).
Mix multiple_choice and text question types. Make questions clear and age-appropriate.`,
      },
      {
        role: "user",
        content: `Create ${numQuestions} quiz questions from this content:\n\n${text}`,
      },
    ],
    2048,
  );

  try {
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr) as GeneratedQuiz;
  } catch {
    throw new Error("Could not parse AI quiz response. Please try again.");
  }
}
