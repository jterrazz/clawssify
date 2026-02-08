import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProvider,
  AppConfig,
  ProcessingResult,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from '@clawssify/shared'
import { resolveAuth } from './auth.js'
import { PROXY_BASE_URL } from '../proxy.js'

const MAX_ITERATIONS = 25

export class AnthropicProvider implements AIProvider {
  private model: string

  constructor(private config: AppConfig['ai']) {
    this.model = config.model
  }

  async process(
    systemPrompt: string,
    userPrompt: string,
    tools: ToolDefinition[],
    executeToolCall: (call: ToolCall) => Promise<ToolResult>,
  ): Promise<ProcessingResult> {
    const auth = resolveAuth(this.config)
    const client =
      auth.type === 'oauth'
        ? new Anthropic({ baseURL: PROXY_BASE_URL, apiKey: 'proxy' })
        : new Anthropic({ apiKey: auth.token })

    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        properties: t.parameters,
        required: Object.keys(t.parameters),
      },
    }))

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        tools: anthropicTools,
        messages,
      })

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      )

      if (response.stop_reason === 'end_turn' && toolUseBlocks.length === 0) {
        const finalText = textBlocks.map((b) => b.text).join('')
        return parseProcessingResult(finalText)
      }

      if (toolUseBlocks.length > 0) {
        messages.push({ role: 'assistant', content: response.content })

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            const result = await executeToolCall({
              name: block.name,
              arguments: block.input as Record<string, unknown>,
            })
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: result.result,
              is_error: result.isError,
            }
          }),
        )

        messages.push({ role: 'user', content: toolResults })
      }
    }

    throw new Error(`AI processing exceeded maximum iterations (${MAX_ITERATIONS})`)
  }
}

function parseProcessingResult(text: string): ProcessingResult {
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/)
  const jsonStr = jsonMatch ? jsonMatch[1] : text

  try {
    const parsed = JSON.parse(jsonStr.trim())
    return {
      sourceTitle: parsed.sourceTitle ?? 'Untitled',
      impact: parsed.impact ?? 'standard',
      filesCreated: parsed.filesCreated ?? [],
      filesModified: parsed.filesModified ?? [],
      summary: parsed.summary ?? '',
    }
  } catch {
    return {
      sourceTitle: 'Untitled',
      impact: 'standard',
      filesCreated: [],
      filesModified: [],
      summary: text.slice(0, 200),
    }
  }
}
