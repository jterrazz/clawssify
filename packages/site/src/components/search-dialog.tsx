'use client'

import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { SearchDocument } from '@/lib/search'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<SearchDocument[]>([])
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (open && documents.length === 0) {
      fetch('/api/search')
        .then((r) => r.json())
        .then(setDocuments)
        .catch(() => {})
    }
  }, [open, documents.length])

  const filtered = useFilteredDocuments(documents, query)

  const onSelect = useCallback(
    (slug: string) => {
      setOpen(false)
      router.push(slug)
    },
    [router],
  )

  return (
    <>
      <Button
        variant="outline"
        className="relative h-8 w-full justify-start rounded-md border-border/60 text-[13px] text-muted-foreground sm:w-56"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-3.5 w-3.5" />
        Search...
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search knowledge base..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            <span className="text-sm text-muted-foreground">No results found.</span>
          </CommandEmpty>
          {filtered.length > 0 && (
            <CommandGroup heading="Results">
              {filtered.map((doc) => (
                <CommandItem key={doc.slug} value={doc.slug} onSelect={onSelect}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{doc.title}</span>
                    <span className="text-xs text-muted-foreground capitalize">{doc.section}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

function useFilteredDocuments(documents: SearchDocument[], query: string): SearchDocument[] {
  if (!query) return documents.slice(0, 10)
  const lower = query.toLowerCase()
  return documents
    .filter((d) => d.title.toLowerCase().includes(lower) || d.excerpt.toLowerCase().includes(lower))
    .slice(0, 10)
}
