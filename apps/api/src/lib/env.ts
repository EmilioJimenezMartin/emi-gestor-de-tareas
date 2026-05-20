import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  MONGODB_URI: z.string().min(1),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  GELATO_API_KEY: z.string().optional(),
  ETSY_API_KEY: z.string().optional(),
  ETSY_API_SECRET: z.string().optional(),
  ETSY_REDIRECT_URI: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv): Env {
  return envSchema.parse(raw);
}

