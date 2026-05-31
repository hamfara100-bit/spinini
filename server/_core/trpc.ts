import { initTRPC } from "@trpc/server";
import { z } from "zod";

export interface Context {
  kidId?: string;
  isParent?: boolean;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;
