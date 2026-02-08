'use client'

import { SearchDialog } from '@/components/search-dialog'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/wiki', label: 'Wiki' },
  { href: '/posts', label: 'Posts' },
  { href: '/digest', label: 'Digest' },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />

        <Link href="/" className="mr-4 flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">Clawssify</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] transition-colors',
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto">
          <SearchDialog />
        </div>
      </div>
    </header>
  )
}
