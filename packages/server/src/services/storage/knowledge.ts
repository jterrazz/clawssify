import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

export class KnowledgeStorage {
  constructor(private dataDir: string) {}

  async getKnowledgeTree(): Promise<string[]> {
    return this.scanDir(join(this.dataDir, 'knowledge'))
  }

  private async scanDir(dir: string): Promise<string[]> {
    const base = join(this.dataDir, 'knowledge')
    const results: string[] = []

    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.name.startsWith('.')) continue
        if (entry.isDirectory()) {
          const nested = await this.scanDir(fullPath)
          results.push(...nested)
        } else if (entry.name.endsWith('.md')) {
          results.push(relative(base, fullPath))
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return results
  }
}
