"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { TableOfContents } from "@/components/table-of-contents";
import { getContentBySlugClient } from "@/lib/content-client";
import { formatName } from "@/lib/content-types";
import { extractHeadings, renderMarkdown } from "@/lib/mdx";

export default function ContentPage() {
  const params = useParams<{ section: string; slug: string[] }>();
  const { section, slug } = params;
  const [renderedContent, setRenderedContent] = useState<null | React.ReactNode>(null);
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<null | string>(null);
  const [loaded, setLoaded] = useState(false);
  const [found, setFound] = useState(true);

  useEffect(() => {
    async function load() {
      const file = await getContentBySlugClient([section, ...slug]);

      if (!file) {
        setFound(false);
        setLoaded(true);
        return;
      }

      setTitle((file.frontmatter.title as string) ?? formatName(slug[slug.length - 1]));
      setDate(typeof file.frontmatter.date === "string" ? file.frontmatter.date : null);
      setHeadings(extractHeadings(file.content));

      const { content } = await renderMarkdown(file.content);
      setRenderedContent(content);
      setLoaded(true);
    }
    load();
  }, [section, slug]);

  if (loaded && !found) {
    notFound();
  }
  if (!loaded || !renderedContent) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-12 px-8 py-10 max-w-5xl mx-auto">
      <article className="flex-1 min-w-0">
        <nav className="flex items-center gap-1 text-[13px] text-muted-foreground mb-6">
          <Link className="hover:text-foreground transition-colors capitalize" href={`/${section}`}>
            {section}
          </Link>
          {slug.slice(0, -1).map((part, i) => (
            <span className="flex items-center gap-1" key={part}>
              <ChevronRight className="h-3 w-3" />
              <Link
                className="hover:text-foreground transition-colors"
                href={`/${section}/${slug.slice(0, i + 1).join("/")}`}
              >
                {formatName(part)}
              </Link>
            </span>
          ))}
        </nav>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1">{title}</h1>
        {date && (
          <p className="text-[13px] text-muted-foreground mb-8">
            {new Date(date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
        {!date && <div className="mb-8" />}

        <div>{renderedContent}</div>
      </article>
      {headings.length > 2 && (
        <aside className="hidden xl:block w-48 shrink-0">
          <TableOfContents headings={headings} />
        </aside>
      )}
    </div>
  );
}
