/**
 * Spinini AI Server
 *
 * Runs the tRPC API that handles all AI calls (buddy chat, parent agent,
 * story generation, coloring page SVG). The OpenRouter API key lives here —
 * it NEVER enters the mobile app bundle.
 *
 * Start:  npx tsx server/index.ts
 * Watch:  npx tsx --watch server/index.ts
 * Deploy: Railway / Render / Fly.io — set OPENROUTER_API_KEY and SERVER_SECRET env vars.
 */

import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./routers";
import { env } from "./_core/env";

if (!env.OPENROUTER_API_KEY) {
  console.warn("⚠️  OPENROUTER_API_KEY is not set — AI endpoints will error.");
}

const ALLOWED_ORIGINS = env.NODE_ENV === "production"
  ? ["https://famkids.app"]
  : ["http://localhost:8081", "http://localhost:19000", "http://localhost:3000", "http://10.0.2.2:3000"];

// In-memory rate limiter: max 30 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000).unref();

const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({}),
  middleware(req, res, next) {
    // CORS — allow specific origins, not wildcard
    const origin = (req.headers.origin as string) ?? "";
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (env.NODE_ENV !== "production") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type,trpc-batch-mode,x-famkids-secret");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Shared-secret auth — skip if SERVER_SECRET is not configured
    if (env.SERVER_SECRET) {
      const provided = req.headers["x-famkids-secret"];
      if (provided !== env.SERVER_SECRET) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    // Per-IP rate limiting
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown");
    if (!checkRateLimit(ip)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Too many requests — slow down" }));
      return;
    }

    next();
  },
});

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`✅ Spinini AI server — http://0.0.0.0:${env.PORT}`);
  console.log(`   Mode:  ${env.NODE_ENV}`);
  console.log(`   Model: deepseek/deepseek-v4-flash:free (OpenRouter)`);
  console.log(`   Auth:  ${env.SERVER_SECRET ? "enabled (x-famkids-secret)" : "disabled — set SERVER_SECRET to enable"}`);
});
