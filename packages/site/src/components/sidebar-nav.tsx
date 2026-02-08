'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { SidebarItem } from '@/lib/content'
import { cn } from '@/lib/utils'
import { BookOpen, CalendarDays, ChevronDown, FileText, PenLine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const sectionIcons: Record<string, LucideIcon> = {
  wiki: BookOpen,
  posts: PenLine,
  digest: CalendarDays,
}

interface SidebarNavProps {
  label: string
  href: string
  sectionKey: string
  items: SidebarItem[]
}

export function SidebarNav({ label, href, sectionKey, items }: SidebarNavProps) {
  const pathname = usePathname()
  const Icon = sectionIcons[sectionKey] ?? FileText

  return (
    <div className="py-4">
      <Link
        href={href}
        className="flex items-center gap-2 px-3 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
      <div>
        {items.map((item) => (
          <NavItem key={item.title} item={item} pathname={pathname} />
        ))}
      </div>
    </div>
  )
}

function NavItem({ item, pathname }: { item: SidebarItem; pathname: string }) {
  const hasActiveChild = item.children?.some(
    (child) => child.href === pathname || child.children?.some((c) => c.href === pathname),
  )
  const [open, setOpen] = useState(hasActiveChild ?? false)

  if (item.children) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')}
          />
          <span className="truncate">{item.title}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-5">
            {item.children.map((child) => (
              <NavLink key={child.title} item={child} pathname={pathname} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return <NavLink item={item} pathname={pathname} />
}

function NavLink({ item, pathname }: { item: SidebarItem; pathname: string }) {
  const isActive = item.href === pathname

  if (!item.href) {
    return (
      <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground/50">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{item.title}</span>
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors truncate',
        isActive
          ? 'bg-muted text-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  )
}
