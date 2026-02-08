import Link from 'next/link'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { SearchDialog } from '@/components/search-dialog'

export function SiteHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <nav className="flex items-center gap-6 text-sm">
        <Link href="/" className="font-semibold">
          Clawssify
        </Link>
        <Link
          href="/wiki"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Wiki
        </Link>
        <Link
          href="/posts"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Posts
        </Link>
        <Link
          href="/digest"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Digest
        </Link>
      </nav>
      <div className="ml-auto">
        <SearchDialog />
      </div>
    </header>
  )
}
