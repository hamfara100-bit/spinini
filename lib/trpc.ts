import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/routers";

// ─── React-Query client (use inside React components via hooks) ───────────────

export const trpc = createTRPCReact<AppRouter>();

function authHeaders(): Record<string, string> {
  const secret = process.env.EXPO_PUBLIC_API_SECRET;
  return secret ? { "x-famkids-secret": secret } : {};
}

export function getTrpcClient() {
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
  return trpc.createClient({
    links: [httpBatchLink({ url: `${apiBase}/trpc`, headers: authHeaders })],
  });
}

// ─── Vanilla client (use outside React — in lib/ai.ts utility functions) ──────

let _vanillaClient: ReturnType<typeof createTRPCClient<AppRouter>> | null = null;

export function getVanillaClient() {
  if (!_vanillaClient) {
    const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
    _vanillaClient = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${apiBase}/trpc`, headers: authHeaders })],
    });
  }
  return _vanillaClient;
}
