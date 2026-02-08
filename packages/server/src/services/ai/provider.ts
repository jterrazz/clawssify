import type { AIProvider, AppConfig } from '@clawssify/shared'
import { AnthropicProvider } from './anthropic.js'
import { OpenAIProvider } from './openai.js'

export function createAIProvider(config: AppConfig['ai']): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'openai':
      return new OpenAIProvider(config)
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}
