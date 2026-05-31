import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { kidSafeChat, parentAgentQuery, generateStory, generateColoringSVG, generateQuizFromText } from "./_core/llm";

// ─── Buddy (kid AI chat) ──────────────────────────────────────────────────────

const buddyRouter = router({
  kidChat: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })),
      kidAge: z.number().default(8),
    }))
    .mutation(async ({ input }) => {
      const reply = await kidSafeChat(input.messages, input.kidAge);
      return { reply };
    }),
});

// ─── Parent AI agent ──────────────────────────────────────────────────────────

const agentRouter = router({
  parentQuery: publicProcedure
    .input(z.object({
      query: z.string(),
      familyContext: z.string().default(""),
    }))
    .mutation(async ({ input }) => {
      const reply = await parentAgentQuery(input.query, input.familyContext);
      return { reply };
    }),
});

// ─── Story generator ──────────────────────────────────────────────────────────

const storyRouter = router({
  generate: publicProcedure
    .input(z.object({
      prompt: z.string(),
      kidName: z.string(),
      kidAge: z.number().default(8),
    }))
    .mutation(async ({ input }) => {
      const text = await generateStory(input.prompt, input.kidName, input.kidAge);
      return { text };
    }),
});

// ─── Image / coloring page ────────────────────────────────────────────────────

const imageRouter = router({
  generateSvg: publicProcedure
    .input(z.object({ subject: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const svg = await generateColoringSVG(input.subject);
      return { svg };
    }),
});

// ─── Quiz generator ───────────────────────────────────────────────────────────

const quizRouter = router({
  generate: publicProcedure
    .input(z.object({
      text: z.string().min(10).max(8000),
      numQuestions: z.number().min(3).max(20).default(5),
    }))
    .mutation(async ({ input }) => {
      const quiz = await generateQuizFromText(input.text, input.numQuestions);
      return quiz;
    }),
});

// ─── System ───────────────────────────────────────────────────────────────────

const systemRouter = router({
  time:   publicProcedure.query(() => ({ time: new Date().toISOString() })),
  config: publicProcedure.query(() => ({
    version: "1.0.0",
    model: "deepseek/deepseek-v4-flash:free",
    features: ["buddy", "agent", "stories", "coloring"],
  })),
});

// ─── Root router ──────────────────────────────────────────────────────────────

export const appRouter = router({
  buddy:  buddyRouter,
  agent:  agentRouter,
  story:  storyRouter,
  image:  imageRouter,
  quiz:   quizRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
