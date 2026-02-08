import { z } from 'zod'

export const ingestPayloadSchema = z.object({
  type: z.enum(['url', 'text', 'tweet', 'conversation', 'note']),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['normal', 'urgent']).optional().default('normal'),
  impact: z.enum(['auto', 'bookmark', 'standard', 'deep']).optional().default('auto'),
})

export type IngestPayloadInput = z.input<typeof ingestPayloadSchema>
