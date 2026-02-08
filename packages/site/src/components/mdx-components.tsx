import type { MDXComponents } from 'mdx/types'

export const mdxComponents: MDXComponents = {
  h1: ({ children, ...props }) => (
    <h1
      className="scroll-m-20 text-2xl font-semibold tracking-tight text-foreground mt-10 mb-4 first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="scroll-m-20 text-lg font-semibold tracking-tight text-foreground mt-10 mb-4 pb-2 border-b border-border/50 first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="scroll-m-20 text-base font-semibold tracking-tight text-foreground mt-8 mb-3"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="scroll-m-20 text-sm font-semibold tracking-tight text-foreground mt-6 mb-2"
      {...props}
    >
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed text-foreground/80 [&:not(:first-child)]:mt-3" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-3 ml-5 list-disc text-sm text-foreground/80 [&>li]:mt-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-3 ml-5 list-decimal text-sm text-foreground/80 [&>li]:mt-1" {...props}>
      {children}
    </ol>
  ),
  a: ({ children, href, ...props }) => (
    <a
      className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground/50 transition-colors"
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mt-4 border-l-2 border-border pl-4 text-sm text-muted-foreground italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, ...props }) => (
    <code
      className="relative rounded bg-muted px-[0.3rem] py-[0.15rem] font-mono text-[13px] text-foreground/80"
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg border border-border/50 bg-muted/50 p-4 font-mono text-[13px]"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="my-6 w-full overflow-y-auto rounded-lg border border-border/50">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-b border-border/50 bg-muted/30 px-4 py-2 text-left text-xs font-medium text-muted-foreground [&[align=center]]:text-center [&[align=right]]:text-right"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="border-b border-border/30 px-4 py-2 text-sm [&[align=center]]:text-center [&[align=right]]:text-right"
      {...props}
    >
      {children}
    </td>
  ),
  hr: () => <hr className="my-8 border-border/50" />,
}
