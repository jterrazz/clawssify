import { getAllContent } from '@/lib/content'
import { buildSearchIndex } from '@/lib/search'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const files = await getAllContent()
  const index = buildSearchIndex(files)
  return NextResponse.json(index)
}
