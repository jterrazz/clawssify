export interface BrainContext {
  system: string
  structure: string
  decisions: string
  knowledgeTree: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  name: string
  result: string
  isError?: boolean
}

export interface ProcessingResult {
  sourceTitle: string
  impact: string
  filesCreated: string[]
  filesModified: string[]
  summary: string
}

export interface AIProvider {
  process(
    systemPrompt: string,
    userPrompt: string,
    tools: ToolDefinition[],
    executeToolCall: (call: ToolCall) => Promise<ToolResult>,
  ): Promise<ProcessingResult>
}
