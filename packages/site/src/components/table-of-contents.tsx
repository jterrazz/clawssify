'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

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
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        On this page
      </p>
      <ul className="space-y-0.5 text-[13px]">
        {headings.map((heading) => (
          <li key={heading.id} style={{ paddingLeft: `${(heading.level - 2) * 12}px` }}>
            <a
              href={`#${heading.id}`}
              className={cn(
                'block py-1 text-muted-foreground/70 hover:text-foreground transition-colors',
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
