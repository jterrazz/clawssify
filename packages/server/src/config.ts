import { z } from 'zod'
import type { AppConfig } from '@clawssify/shared'

const envSchema = z.object({
  AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  AI_AUTH_METHOD: z.enum(['api-key', 'oauth']).default('api-key'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().default('claude-sonnet-4-5-20250929'),
  PORT: z.coerce.number().default(3000),
  API_KEY: z.string().min(1, 'API_KEY is required'),
  DATA_DIR: z.string().default('./data'),
})

export function loadConfig(): AppConfig {
  const env = envSchema.parse(process.env)

  return {
    port: env.PORT,
    dataDir: env.DATA_DIR,
    apiKey: env.API_KEY,
    ai: {
      provider: env.AI_PROVIDER,
      authMethod: env.AI_AUTH_METHOD,
      apiKey: env.AI_API_KEY,
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL,
    },
  }
}
