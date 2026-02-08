import { TableOfContents } from '@/components/table-of-contents'
import { getContentBySlug } from '@/lib/content'
import { formatName } from '@/lib/content'
import { extractHeadings, renderMarkdown } from '@/lib/mdx'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

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
    <div className="flex gap-12 px-8 py-10 max-w-5xl mx-auto">
      <article className="flex-1 min-w-0">
        <nav className="flex items-center gap-1 text-[13px] text-muted-foreground mb-6">
          <Link href={`/${section}`} className="hover:text-foreground transition-colors capitalize">
            {section}
          </Link>
          {slug.slice(0, -1).map((part, i) => (
            <span key={part} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <Link
                href={`/${section}/${slug.slice(0, i + 1).join('/')}`}
                className="hover:text-foreground transition-colors"
              >
                {formatName(part)}
              </Link>
            </span>
          ))}
        </nav>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1">{title}</h1>
        {typeof file.frontmatter.date === 'string' && (
          <p className="text-[13px] text-muted-foreground mb-8">
            {new Date(file.frontmatter.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
        {typeof file.frontmatter.date !== 'string' && <div className="mb-8" />}

        <div>{content}</div>
      </article>
      {headings.length > 2 && (
        <aside className="hidden xl:block w-48 shrink-0">
          <TableOfContents headings={headings} />
        </aside>
      )}
    </div>
  )
}
