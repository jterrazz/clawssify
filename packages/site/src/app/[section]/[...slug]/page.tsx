import { notFound } from 'next/navigation'
import { getContentBySlug } from '@/lib/content'
import { renderMarkdown, extractHeadings } from '@/lib/mdx'
import { TableOfContents } from '@/components/table-of-contents'
import { formatName } from '@/lib/content'

export const dynamic = 'force-dynamic'

export default async function ContentPage({
  params,
}: {
  params: Promise<{ section: string; slug: string[] }>
}) {
  const { section, slug } = await params
  const file = await getContentBySlug([section, ...slug])
  if (!file) notFound()

  const { content } = await renderMarkdown(file.content)
  const headings = extractHeadings(file.content)
  const title = (file.frontmatter.title as string) ?? formatName(slug[slug.length - 1])

  return (
    <div className="flex gap-10 px-6 py-8 max-w-6xl mx-auto">
      <article className="flex-1 min-w-0">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
        {typeof file.frontmatter.date === 'string' && (
          <p className="text-sm text-muted-foreground mb-6">
            {new Date(file.frontmatter.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
        <div>{content}</div>
      </article>
      {headings.length > 2 && (
        <aside className="hidden xl:block w-56 shrink-0">
          <TableOfContents headings={headings} />
        </aside>
      )}
    </div>
  )
}
