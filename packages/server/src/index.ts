import 'dotenv/config'
import { resolve } from 'node:path'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'
import { initializeDataDirectory } from './services/storage/init.js'

const config = loadConfig()

// Resolve data directory to absolute path
config.dataDir = resolve(config.dataDir)

// Initialize the three-layer data structure
await initializeDataDirectory(config.dataDir)

// Build and start the server
const app = await buildApp(config)

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
  app.log.info(`Clawssify server running on http://localhost:${config.port}`)
  app.log.info(`Data directory: ${config.dataDir}`)
  app.log.info(`AI provider: ${config.ai.provider} (${config.ai.authMethod})`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
