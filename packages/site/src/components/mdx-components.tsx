import type { MDXComponents } from 'mdx/types'

export const mdxComponents: MDXComponents = {
  h1: ({ children, ...props }) => (
    <h1 className="scroll-m-20 text-3xl font-bold tracking-tight mt-8 mb-4" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-10 mb-4 first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-8 mb-3" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="scroll-m-20 text-lg font-semibold tracking-tight mt-6 mb-2" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="leading-7 [&:not(:first-child)]:mt-4 text-foreground/90" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-4 ml-6 list-disc [&>li]:mt-1.5" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-4 ml-6 list-decimal [&>li]:mt-1.5" {...props}>
      {children}
    </ol>
  ),
  a: ({ children, href, ...props }) => (
    <a
      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="mt-4 border-l-2 pl-6 italic text-muted-foreground" {...props}>
      {children}
    </blockquote>
  ),
  code: ({ children, ...props }) => (
    <code
      className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm"
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre className="mb-4 mt-4 overflow-x-auto rounded-lg border bg-muted p-4" {...props}>
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
      {...props}
    >
      {children}
    </td>
  ),
  hr: () => <hr className="my-6 border-border" />,
}
