import type { AIProvider, AppConfig } from '@clawssify/shared'
import { AnthropicProvider } from './anthropic.js'
import { OpenAIProvider } from './openai.js'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/'

export function createAIProvider(config: AppConfig['ai']): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'openai':
      return new OpenAIProvider(config)
    case 'gemini':
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl || GEMINI_BASE_URL,
      })
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}
