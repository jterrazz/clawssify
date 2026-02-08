import { defineConfig } from 'vitepress'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const dataDir = resolve(__dirname, '../../server/data/knowledge')

function generateSidebar(section: string): any[] {
  const dir = join(dataDir, section)
  if (!existsSync(dir)) return []
  return scanDir(dir, section)
}

function scanDir(dir: string, basePath: string): any[] {
  const items: any[] = []
  const entries = readdirSync(dir).sort()

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (entry.startsWith('.') || entry.startsWith('_')) continue

    if (stat.isDirectory()) {
      const children = scanDir(fullPath, `${basePath}/${entry}`)
      if (children.length > 0) {
        items.push({
          text: formatName(entry),
          collapsed: false,
          items: children,
        })
      }
    } else if (entry.endsWith('.md') && entry !== 'index.md') {
      items.push({
        text: formatName(entry.replace(/\.md$/, '')),
        link: `/${basePath}/${entry.replace(/\.md$/, '')}`,
      })
    }
  }

  return items
}

function formatName(name: string): string {
  return name
    .replace(/^\d{4}-\d{2}-\d{2}_/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default defineConfig({
  srcDir: dataDir,
  title: 'Clawssify',
  description: 'Your AI-powered personal knowledge base',
  themeConfig: {
    nav: [
      { text: 'Wiki', link: '/wiki/' },
      { text: 'Posts', link: '/posts/' },
      { text: 'Digest', link: '/digest/' },
    ],
    sidebar: {
      '/wiki/': generateSidebar('wiki'),
      '/posts/': generateSidebar('posts'),
      '/digest/': generateSidebar('digest'),
    },
    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/jterrazz/clawssify' }],
  },
})
