import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { Source, SourceStatus } from '@clawssify/shared'
import { withFileLock } from './file-lock.js'

export class SourcesStorage {
  constructor(private dataDir: string) {}

  private get sourcesPath(): string {
    return join(this.dataDir, '.sources', 'sources.json')
  }

  async registerSource(source: Source): Promise<void> {
    await withFileLock(this.sourcesPath, async () => {
      const sources = await this.readSources()
      sources.push(source)
      await writeFile(this.sourcesPath, JSON.stringify(sources, null, 2), 'utf-8')
    })
  }

  async getSource(id: string): Promise<Source | null> {
    const sources = await this.readSources()
    return sources.find((s) => s.id === id) ?? null
  }

  async updateSourceStatus(id: string, status: SourceStatus): Promise<void> {
    await withFileLock(this.sourcesPath, async () => {
      const sources = await this.readSources()
      const source = sources.find((s) => s.id === id)
      if (source) {
        source.status = status
        await writeFile(this.sourcesPath, JSON.stringify(sources, null, 2), 'utf-8')
      }
    })
  }

  async writeAnalysis(sourceId: string, content: string): Promise<string> {
    const relPath = join('.sources', 'analyses', `${sourceId}.md`)
    const fullPath = join(this.dataDir, relPath)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content, 'utf-8')
    return relPath
  }

  private async readSources(): Promise<Source[]> {
    try {
      const raw = await readFile(this.sourcesPath, 'utf-8')
      return JSON.parse(raw) as Source[]
    } catch {
      return []
    }
  }
}
