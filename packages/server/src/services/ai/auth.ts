import type { AppConfig } from '@clawssify/shared'

export interface ResolvedAuth {
  type: 'api-key' | 'oauth'
  token: string
}

export function resolveAuth(config: AppConfig['ai']): ResolvedAuth {
  if (config.authMethod === 'api-key') {
    if (!config.apiKey) {
      throw new Error('AI_API_KEY is required when AI_AUTH_METHOD=api-key')
    }
    return { type: 'api-key', token: config.apiKey }
  }

  // OAuth: proxy handles real tokens, we just need a placeholder
  return { type: 'oauth', token: 'proxy' }
}
