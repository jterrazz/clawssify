import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ContentFile } from '@/lib/content'
import { formatName } from '@/lib/content'

export function ContentCard({ file }: { file: ContentFile }) {
  const title =
    (file.frontmatter.title as string) ?? formatName(file.slug[file.slug.length - 1])
  const href = '/' + file.slug.join('/')
  const date = file.frontmatter.date
    ? new Date(file.frontmatter.date as string).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : file.lastModified.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
  const concepts = (file.frontmatter.concepts as string[]) ?? []
  const excerpt = file.content.slice(0, 150).replace(/[#*_\[\]]/g, '').trim()

  return (
    <Link href={href}>
      <Card className="hover:bg-accent/50 transition-colors">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="capitalize">{file.section}</span>
            <span>&middot;</span>
            <span>{date}</span>
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
          {excerpt && <CardDescription className="line-clamp-2">{excerpt}</CardDescription>}
          {concepts.length > 0 && (
            <div className="flex gap-1 pt-2 flex-wrap">
              {concepts.slice(0, 4).map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>
    </Link>
  )
}
