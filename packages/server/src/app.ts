import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { ChildProcess } from 'node:child_process'
import type { AppConfig } from '@clawssify/shared'
import { createAIProvider } from './services/ai/provider.js'
import { IngestService } from './services/ingest.service.js'
import { authPlugin } from './middleware/auth.js'
import { healthRoutes } from './routes/health.js'
import { ingestRoutes } from './routes/ingest.js'
import { ensureProxyBinary, startProxy, stopProxy } from './services/proxy.js'

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig
    authenticate: (request: any, reply: any) => Promise<void>
    ingestService: IngestService
  }
}

export async function buildApp(
  config: AppConfig,
  options?: {
    loggerDestination?: import('node:stream').Writable
    onProxyLog?: (line: string) => void
  },
) {
  const app = Fastify({
    logger: options?.loggerDestination
      ? { level: 'info', stream: options.loggerDestination }
      : true,
  })

  await app.register(cors)

  app.decorate('config', config)
  await app.register(authPlugin)

  // Start OAuth proxy if needed
  let proxyProc: ChildProcess | undefined
  if (config.ai.authMethod === 'oauth') {
    await ensureProxyBinary(config.dataDir)
    proxyProc = await startProxy(config.dataDir, { onLog: options?.onProxyLog })
    app.log.info('OAuth proxy started on port 8317')
  }

  const aiProvider = createAIProvider(config.ai)
  const ingestService = new IngestService(aiProvider, config.dataDir, app.log)
  app.decorate('ingestService', ingestService)

  await app.register(healthRoutes)
  await app.register(ingestRoutes)

  app.addHook('onClose', async () => {
    if (proxyProc) {
      await stopProxy(proxyProc)
    }
  })

  return app
}
