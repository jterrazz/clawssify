export type AIProviderType = 'anthropic' | 'openai' | 'gemini'
export type AIAuthMethod = 'api-key' | 'oauth'

export interface AppConfig {
  port: number
  dataDir: string
  apiKey: string
  ai: {
    provider: AIProviderType
    authMethod: AIAuthMethod
    apiKey?: string
    baseUrl?: string
    model: string
  }
}
