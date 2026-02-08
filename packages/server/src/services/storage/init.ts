import { mkdir, writeFile, access, copyFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SYSTEM_SEED = `# Clawssify Brain

You are an AI librarian managing a personal knowledge base.

## Preferences
- Language: English
- Style: Clear, concise, well-structured
- Merge threshold: Topics with 3+ overlapping concepts should be merged
`

const STRUCTURE_SEED = `# Knowledge Structure

## Wiki Categories
Categories emerge organically as content is ingested.

## Naming Conventions
- Wiki pages: \`wiki/{category}/{topic}.md\`
- Posts: \`posts/{date}_{slug}.md\`
- Digest: \`digest/{date}.md\`
`

const DECISIONS_SEED = `# Decisions Log
`

const PENDING_SEED = `# Pending Changes
`

const INDEX_SEED = `# Knowledge Base

Welcome to your Clawssify knowledge base.

## Sections
- [Wiki](/wiki/) — Topic pages that evolve over time
- [Posts](/posts/) — Articles from ingested sources
- [Digest](/digest/) — Daily changelog of changes
`

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await access(filePath)
  } catch {
    await writeFile(filePath, content, 'utf-8')
  }
}

export async function initializeDataDirectory(dataDir: string): Promise<void> {
  await ensureDir(join(dataDir, '.brain'))
  await ensureDir(join(dataDir, '.proxy', 'auth'))
  await ensureDir(join(dataDir, '.sources', 'analyses'))
  await ensureDir(join(dataDir, 'knowledge', 'wiki'))
  await ensureDir(join(dataDir, 'knowledge', 'posts'))
  await ensureDir(join(dataDir, 'knowledge', 'digest'))

  await writeIfMissing(join(dataDir, '.brain', 'SYSTEM.md'), SYSTEM_SEED)
  await writeIfMissing(join(dataDir, '.brain', 'STRUCTURE.md'), STRUCTURE_SEED)
  await writeIfMissing(join(dataDir, '.brain', 'DECISIONS.md'), DECISIONS_SEED)
  await writeIfMissing(join(dataDir, '.brain', 'PENDING.md'), PENDING_SEED)
  await writeIfMissing(join(dataDir, '.sources', 'sources.json'), '[]')
  await writeIfMissing(join(dataDir, 'knowledge', 'index.md'), INDEX_SEED)

  // Create section index files
  await writeIfMissing(join(dataDir, 'knowledge', 'wiki', 'index.md'), '# Wiki\n\nTopic pages organized by category.\n')
  await writeIfMissing(join(dataDir, 'knowledge', 'posts', 'index.md'), '# Posts\n\nArticles from ingested sources.\n')
  await writeIfMissing(join(dataDir, 'knowledge', 'digest', 'index.md'), '# Digest\n\nDaily changelog of knowledge base changes.\n')
}
