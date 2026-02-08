import { readFile, appendFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { BrainContext } from '@clawssify/shared'

export class BrainStorage {
  constructor(private dataDir: string) {}

  async loadContext(): Promise<BrainContext> {
    const [system, structure, decisions] = await Promise.all([
      this.readBrainFile('SYSTEM.md'),
      this.readBrainFile('STRUCTURE.md'),
      this.readBrainFile('DECISIONS.md'),
    ])

    const knowledgeTree = await this.scanKnowledgeTree()

    return {
      system,
      structure,
      decisions: this.lastLines(decisions, 50),
      knowledgeTree,
    }
  }

  async logDecision(entry: string): Promise<void> {
    const timestamp = new Date().toISOString()
    const line = `\n## ${timestamp}\n${entry}\n`
    await appendFile(join(this.dataDir, '.brain', 'DECISIONS.md'), line, 'utf-8')
  }

  async addPending(entry: string): Promise<void> {
    const timestamp = new Date().toISOString()
    const line = `\n## ${timestamp}\n${entry}\n`
    await appendFile(join(this.dataDir, '.brain', 'PENDING.md'), line, 'utf-8')
  }

  private async readBrainFile(filename: string): Promise<string> {
    try {
      return await readFile(join(this.dataDir, '.brain', filename), 'utf-8')
    } catch {
      return ''
    }
  }

  private lastLines(content: string, n: number): string {
    const lines = content.split('\n')
    return lines.slice(-n).join('\n')
  }

  private async scanKnowledgeTree(dir?: string): Promise<string[]> {
    const baseDir = dir ?? join(this.dataDir, 'knowledge')
    const results: string[] = []

    try {
      const entries = await readdir(baseDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(baseDir, entry.name)
        if (entry.isDirectory()) {
          const nested = await this.scanKnowledgeTree(fullPath)
          results.push(...nested)
        } else if (entry.name.endsWith('.md')) {
          results.push(relative(join(this.dataDir, 'knowledge'), fullPath))
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return results
  }
}
