import { mdxComponents } from '@/components/mdx-components'
import { compileMDX } from 'next-mdx-remote/rsc'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

export async function renderMarkdown(source: string) {
  const { content, frontmatter } = await compileMDX({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
      },
      parseFrontmatter: true,
    },
    components: mdxComponents,
  })
  return { content, frontmatter }
}

export function extractHeadings(markdown: string): { id: string; text: string; level: number }[] {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm
  const headings: { id: string; text: string; level: number }[] = []
  let match: RegExpExecArray | null = headingRegex.exec(markdown)
  while (match !== null) {
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
    headings.push({ id, text, level: match[1].length })
    match = headingRegex.exec(markdown)
  }
  return headings
}
