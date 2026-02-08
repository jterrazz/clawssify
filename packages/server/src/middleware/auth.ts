import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('authenticate', async (request: any, reply: any) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' })
    }

    const token = authHeader.slice(7)
    if (token !== app.config.apiKey) {
      return reply.status(401).send({ error: 'Invalid API key' })
    }
  })
})
