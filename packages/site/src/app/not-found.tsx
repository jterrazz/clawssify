import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <p className="text-6xl font-semibold text-foreground/10">404</p>
      <p className="text-sm text-muted-foreground">This page could not be found.</p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  )
}
