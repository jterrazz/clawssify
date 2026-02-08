import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import type { ContentType } from '@clawssify/shared'

export interface ExtractedContent {
  title: string
  text: string
  url?: string
}

export async function extractContent(
  type: ContentType,
  content: string,
): Promise<ExtractedContent> {
  switch (type) {
    case 'url':
      return extractFromUrl(content)
    case 'tweet':
      if (isTweetUrl(content)) {
        return extractFromUrl(content.trim())
      }
      return extractFromText(content)
    case 'text':
    case 'note':
    case 'conversation':
      return extractFromText(content)
  }
}

function isTweetUrl(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith('http') && (trimmed.includes('twitter.com') || trimmed.includes('x.com'))
}

function generateTitleFromText(text: string): string {
  const firstLine = text.split('\n')[0].trim()
  if (firstLine.length <= 60) return firstLine
  return `${firstLine.slice(0, 60)}...`
}

function extractFromText(content: string): ExtractedContent {
  return {
    title: generateTitleFromText(content),
    text: content,
  }
}

async function extractFromUrl(url: string): Promise<ExtractedContent> {
  const trimmedUrl = url.trim()

  try {
    const response = await fetch(trimmedUrl, {
      headers: { 'User-Agent': 'Clawssify/0.1 (Knowledge Base Bot)' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await response.text()
    const { document } = parseHTML(html)
    const reader = new Readability(document)
    const article = reader.parse()

    if (article) {
      return {
        title: article.title,
        text: article.textContent,
        url: trimmedUrl,
      }
    }

    return {
      title: document.title || trimmedUrl,
      text: document.body?.textContent?.trim() || '',
      url: trimmedUrl,
    }
  } catch {
    return {
      title: trimmedUrl,
      text: `Failed to extract content from URL: ${trimmedUrl}`,
      url: trimmedUrl,
    }
  }
}
