import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BookOpen, FileText, CalendarDays } from 'lucide-react'
import { getContentList } from '@/lib/content'

export const dynamic = 'force-dynamic'

const sections = [
  {
    title: 'Wiki',
    href: '/wiki',
    description: 'Topic pages that evolve over time',
    icon: BookOpen,
    key: 'wiki',
  },
  {
    title: 'Posts',
    href: '/posts',
    description: 'Articles from ingested sources',
    icon: FileText,
    key: 'posts',
  },
  {
    title: 'Digest',
    href: '/digest',
    description: 'Daily changelog of changes',
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
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Knowledge Base</h1>
      <p className="text-muted-foreground mb-8">
        Your AI-powered personal knowledge base. Browse topics, read articles, and track daily
        updates.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((section, i) => (
          <Link key={section.key} href={section.href}>
            <Card className="hover:bg-accent/50 transition-colors h-full">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <section.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{counts[i]} pages</span>
                </div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
