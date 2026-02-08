import { Badge } from '@/components/ui/badge'
import type { ContentFile } from '@/lib/content'
import { formatName } from '@/lib/content'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function ContentCard({ file }: { file: ContentFile }) {
  const title = (file.frontmatter.title as string) ?? formatName(file.slug[file.slug.length - 1])
  const href = `/${file.slug.join('/')}`
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
  const excerpt = file.content
    .replace(/^---[\s\S]*?---/, '')
    .slice(0, 160)
    .replace(/[#*_\[\]`]/g, '')
    .replace(/\n+/g, ' ')
    .trim()

  return (
    <Link href={href} className="group block">
      <div className="flex items-start gap-4 rounded-lg border border-border/60 px-5 py-4 transition-colors hover:bg-muted/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
          </div>
          {excerpt && (
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">
              {excerpt}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground/70">{date}</span>
            {concepts.length > 0 && (
              <>
                <span className="text-muted-foreground/30">&middot;</span>
                {concepts.slice(0, 3).map((c) => (
                  <Badge
                    key={c}
                    variant="secondary"
                    className="text-[11px] font-normal px-1.5 py-0"
                  >
                    {c}
                  </Badge>
                ))}
              </>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
      </div>
    </Link>
  )
}
