export const env = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
  SERVER_SECRET: process.env.SERVER_SECRET ?? "",
  PORT: parseInt(process.env.PORT ?? "3000"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
