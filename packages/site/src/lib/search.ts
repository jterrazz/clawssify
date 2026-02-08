import Fuse from 'fuse.js'
import type { ContentFile } from './content'
import { formatName } from './content'

export interface SearchDocument {
  title: string
  slug: string
  section: string
  excerpt: string
}

export function buildSearchIndex(files: ContentFile[]): SearchDocument[] {
  return files.map((file) => ({
    title: (file.frontmatter.title as string) ?? formatName(file.slug[file.slug.length - 1]),
    slug: `/${file.slug.join('/')}`,
    section: file.section,
    excerpt: file.content.slice(0, 200).replace(/[#*_\[\]]/g, ''),
  }))
}

export function createSearchClient(documents: SearchDocument[]) {
  return new Fuse(documents, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'excerpt', weight: 1 },
    ],
    threshold: 0.3,
    includeMatches: true,
  })
}
