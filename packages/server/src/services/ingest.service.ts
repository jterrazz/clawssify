import type { AIProvider, IngestPayload, Source } from '@clawssify/shared'
import { generateSourceId, toDatePrefix, toISO } from '@clawssify/shared'
import { extractContent } from './content-extractor.js'
import { getToolDefinitions, createToolExecutor } from './ai/tools.js'
import { SYSTEM_PROMPT, buildUserPrompt } from './ai/prompts.js'
import { BrainStorage } from './storage/brain.js'
import { SourcesStorage } from './storage/sources.js'
import type { FastifyBaseLogger } from 'fastify'

export class IngestService {
  private brainStorage: BrainStorage
  private sourcesStorage: SourcesStorage
  private toolExecutor: ReturnType<typeof createToolExecutor>

  constructor(
    private aiProvider: AIProvider,
    private dataDir: string,
    private logger: FastifyBaseLogger,
  ) {
    this.brainStorage = new BrainStorage(dataDir)
    this.sourcesStorage = new SourcesStorage(dataDir)
    this.toolExecutor = createToolExecutor(dataDir)
  }

  async process(sourceId: string, payload: IngestPayload): Promise<void> {
    this.logger.info({ sourceId, type: payload.type }, 'Starting ingestion')

    // 1. Extract content
    const extracted = await extractContent(payload.type, payload.content)
    this.logger.info({ sourceId, title: extracted.title }, 'Content extracted')

    // 2. Register source as processing
    const source: Source = {
      id: sourceId,
      url: extracted.url,
      type: payload.type,
      ingestedAt: toISO(),
      title: extracted.title,
      analysisPath: '',
      knowledgePages: [],
      concepts: [],
      impact: (payload.impact === 'auto' ? 'standard' : payload.impact) as Source['impact'],
      status: 'processing',
      tags: payload.tags,
    }
    await this.sourcesStorage.registerSource(source)

    try {
      // 3. Build the user prompt
      const userPrompt = buildUserPrompt(
        extracted.text,
        payload.type,
        payload.impact ?? 'auto',
        extracted.url,
      )

      // 4. Run the AI with tools — the AI autonomously reads context, creates/updates files
      const result = await this.aiProvider.process(
        SYSTEM_PROMPT,
        userPrompt,
        getToolDefinitions(),
        this.toolExecutor,
      )

      this.logger.info({ sourceId, result }, 'AI processing complete')

      // 5. Write analysis
      const analysisContent = `# Analysis: ${result.sourceTitle}\n\n${result.summary}\n\n## Files Created\n${result.filesCreated.map((f) => `- ${f}`).join('\n')}\n\n## Files Modified\n${result.filesModified.map((f) => `- ${f}`).join('\n')}\n`
      await this.sourcesStorage.writeAnalysis(sourceId, analysisContent)

      // 6. Update source status
      await this.sourcesStorage.updateSourceStatus(
        sourceId,
        result.impact === 'bookmark' ? 'bookmarked' : 'processed',
      )
    } catch (err) {
      this.logger.error({ sourceId, err }, 'Ingestion failed')
      await this.sourcesStorage.updateSourceStatus(sourceId, 'failed')
      throw err
    }
  }
}
