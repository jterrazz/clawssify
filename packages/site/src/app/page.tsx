import { Card } from '@/components/ui/card'
import { getContentList } from '@/lib/content'
import { ArrowRight, BookOpen, CalendarDays, FileText } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const sections = [
  {
    title: 'Wiki',
    href: '/wiki',
    description: 'Evergreen topic pages that evolve over time as new knowledge is ingested.',
    icon: BookOpen,
    key: 'wiki',
  },
  {
    title: 'Posts',
    href: '/posts',
    description: 'Articles synthesized from ingested sources, organized by topic.',
    icon: FileText,
    key: 'posts',
  },
  {
    title: 'Digest',
    href: '/digest',
    description: 'Daily changelog tracking what changed across the knowledge base.',
    icon: CalendarDays,
    key: 'digest',
  },
]

export default async function HomePage() {
  const counts = await Promise.all(
    sections.map(async (s) => {
      const files = await getContentList(s.key)
      return files.length
    }),
  )

  return (
    <div className="px-8 py-16 max-w-3xl mx-auto">
      <div className="mb-16">
        <p className="text-sm font-medium text-muted-foreground mb-3 tracking-wide uppercase">
          Knowledge Base
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4">
          Your personal, AI-curated wiki
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
          Browse topics, read synthesized articles, and track daily updates — all generated and
          maintained by your AI agent.
        </p>
      </div>

      <div className="grid gap-3">
        {sections.map((section, i) => (
          <Link key={section.key} href={section.href} className="group">
            <Card className="flex items-center gap-5 px-5 py-4 transition-colors hover:bg-muted/50 border-border/60">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <section.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-sm font-medium text-foreground">{section.title}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {counts[i]} {counts[i] === 1 ? 'page' : 'pages'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-snug">{section.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
