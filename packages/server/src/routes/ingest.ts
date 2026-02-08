import type { FastifyInstance } from 'fastify'
import { ingestPayloadSchema, generateSourceId } from '@clawssify/shared'
import type { IngestPayload, IngestResponse } from '@clawssify/shared'

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: IngestPayload; Reply: IngestResponse }>(
    '/ingest',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = ingestPayloadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          id: '',
          status: 'queued',
          message: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        } as any)
      }

      const payload = parsed.data as IngestPayload
      const sourceId = generateSourceId()

      // Fire-and-forget: process in background
      setImmediate(() => {
        app.ingestService.process(sourceId, payload).catch((err) => {
          app.log.error({ err, sourceId }, 'Ingest processing failed')
        })
      })

      return reply.status(202).send({
        id: sourceId,
        status: 'processing',
        message: 'Content queued for analysis',
      })
    },
  )
}
