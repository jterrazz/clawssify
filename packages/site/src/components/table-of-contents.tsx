'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Heading {
  id: string
  text: string
  level: number
}

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '0% 0% -80% 0%' },
    )

    for (const heading of headings) {
      const el = document.getElementById(heading.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <div className="sticky top-16">
      <p className="mb-3 text-sm font-medium">On this page</p>
      <ul className="space-y-1 text-sm">
        {headings.map((heading) => (
          <li key={heading.id} style={{ paddingLeft: `${(heading.level - 2) * 12}px` }}>
            <a
              href={`#${heading.id}`}
              className={cn(
                'block py-1 text-muted-foreground hover:text-foreground transition-colors',
                activeId === heading.id && 'text-foreground font-medium',
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
