import { ContentCard } from '@/components/content-card'
import { getContentBySlug, getContentList } from '@/lib/content'
import { renderMarkdown } from '@/lib/mdx'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const sectionMeta: Record<string, { title: string; description: string }> = {
  wiki: {
    title: 'Wiki',
    description: 'Evergreen topic pages that evolve as new knowledge is ingested.',
  },
  posts: {
    title: 'Posts',
    description: 'Articles synthesized from ingested sources.',
  },
  digest: {
    title: 'Digest',
    description: 'Daily changelog of knowledge base changes.',
  },
}

const validSections = ['wiki', 'posts', 'digest']

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!validSections.includes(section)) notFound()

  const meta = sectionMeta[section]
  const indexFile = await getContentBySlug([section])
  const files = await getContentList(section)

  return (
    <div className="px-8 py-12 max-w-3xl mx-auto">
      <div className="mb-10">
        <p className="text-sm font-medium text-muted-foreground mb-2 tracking-wide uppercase">
          {meta.title}
        </p>
        <p className="text-muted-foreground text-sm">{meta.description}</p>
      </div>

      {indexFile && (
        <div className="mb-10 text-sm">
          {await renderMarkdown(indexFile.content).then(({ content }) => <div>{content}</div>)}
        </div>
      )}

      {files.length > 0 && (
        <div className="grid gap-2">
          {files.map((file) => (
            <ContentCard key={file.slug.join('/')} file={file} />
          ))}
        </div>
      )}

      {files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No content in this section yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Content will appear here after ingestion.
          </p>
        </div>
      )}
    </div>
  )
}
