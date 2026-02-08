export type ContentType = 'url' | 'text' | 'tweet' | 'conversation' | 'note'
export type Priority = 'normal' | 'urgent'
export type ImpactMode = 'auto' | 'bookmark' | 'standard' | 'deep'
export type ResolvedImpact = 'bookmark' | 'standard' | 'deep'

export interface IngestPayload {
  type: ContentType
  content: string
  tags?: string[]
  priority?: Priority
  impact?: ImpactMode
}

export interface IngestResponse {
  id: string
  status: 'processing' | 'queued'
  message: string
}
