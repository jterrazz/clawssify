import { notFound } from 'next/navigation'
import { getContentList, getContentBySlug } from '@/lib/content'
import { renderMarkdown } from '@/lib/mdx'
import { ContentCard } from '@/components/content-card'

export const dynamic = 'force-dynamic'

const validSections = ['wiki', 'posts', 'digest']

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!validSections.includes(section)) notFound()

  const indexFile = await getContentBySlug([section])
  const files = await getContentList(section)

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {indexFile && (
        <div className="mb-8">
          {await renderMarkdown(indexFile.content).then(({ content }) => (
            <div>{content}</div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="grid gap-3">
          {files.map((file) => (
            <ContentCard key={file.slug.join('/')} file={file} />
          ))}
        </div>
      )}

      {files.length === 0 && (
        <p className="text-muted-foreground">No content in this section yet.</p>
      )}
    </div>
  )
}
