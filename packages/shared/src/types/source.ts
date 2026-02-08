import type { ContentType, ResolvedImpact } from './ingest.js'

export type SourceStatus = 'processing' | 'processed' | 'bookmarked' | 'pending' | 'failed'

export interface Source {
  id: string
  url?: string
  type: ContentType
  ingestedAt: string
  title: string
  analysisPath: string
  knowledgePages: string[]
  concepts: string[]
  impact: ResolvedImpact
  status: SourceStatus
  tags?: string[]
}
