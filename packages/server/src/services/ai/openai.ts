import OpenAI from 'openai'
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

export class OpenAIProvider implements AIProvider {
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
    const client = new OpenAI({
      apiKey: auth.token,
      ...(auth.type === 'oauth'
        ? { baseURL: PROXY_BASE_URL }
        : this.config.baseUrl
          ? { baseURL: this.config.baseUrl }
          : {}),
    })

    const openaiTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.parameters,
          required: Object.keys(t.parameters),
        },
      },
    }))

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.chat.completions.create({
        model: this.model,
        tools: openaiTools,
        messages,
      })

      const choice = response.choices[0]
      if (!choice) throw new Error('No response from OpenAI')

      const message = choice.message

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return parseProcessingResult(message.content ?? '')
      }

      messages.push(message)

      const toolResults = await Promise.all(
        message.tool_calls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>
          const result = await executeToolCall({
            name: tc.function.name,
            arguments: args,
          })
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: result.result,
          }
        }),
      )

      messages.push(...toolResults)
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
