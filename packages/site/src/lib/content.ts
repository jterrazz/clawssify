import matter from "gray-matter";
import fs from "node:fs/promises";
import path from "node:path";

import type { ContentFile, SidebarItem } from "./content-types";

export type { ContentFile, SidebarItem } from "./content-types.js";
export { formatName } from "./content-types.js";

const KNOWLEDGE_DIR =
  process.env.KNOWLEDGE_DIR ??
  path.resolve(process.env.HOME ?? "", ".clawssify", "data", "knowledge");

export async function getContentBySlug(slugParts: string[]): Promise<ContentFile | null> {
  const filePath = `${path.join(KNOWLEDGE_DIR, ...slugParts)}.md`;
  const file = await tryReadContent(filePath, slugParts);
  if (file) {
    return file;
  }

  const indexPath = path.join(KNOWLEDGE_DIR, ...slugParts, "index.md");
  return tryReadContent(indexPath, slugParts);
}

export async function getContentList(section: string): Promise<ContentFile[]> {
  const files: ContentFile[] = [];
  await scanDirectory(path.join(KNOWLEDGE_DIR, section), [section], files);
  return files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

export async function getSidebarTree(section: string): Promise<SidebarItem[]> {
  return buildSidebarItems(path.join(KNOWLEDGE_DIR, section), `/${section}`);
}

export async function getAllContent(): Promise<ContentFile[]> {
  const sections = ["wiki", "posts", "digest"];
  const all: ContentFile[] = [];
  for (const section of sections) {
    const files = await getContentList(section);
    all.push(...files);
  }
  return all;
}

async function tryReadContent(filePath: string, slugParts: string[]): Promise<ContentFile | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(raw);
    const stat = await fs.stat(filePath);
    return {
      slug: slugParts,
      content,
      frontmatter: data,
      section: slugParts[0] as ContentFile["section"],
      lastModified: stat.mtime,
    };
  } catch {
    return null;
  }
}

async function scanDirectory(
  dir: string,
  slugPrefix: string[],
  results: ContentFile[],
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, [...slugPrefix, entry.name], results);
      } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
        const raw = await fs.readFile(fullPath, "utf8");
        const { data, content } = matter(raw);
        const stat = await fs.stat(fullPath);
        results.push({
          slug: [...slugPrefix, entry.name.replace(/\.md$/, "")],
          content,
          frontmatter: data,
          section: slugPrefix[0] as ContentFile["section"],
          lastModified: stat.mtime,
        });
      }
    }
  } catch {
    // Directory does not exist yet
  }
}

async function buildSidebarItems(dir: string, basePath: string): Promise<SidebarItem[]> {
  const items: SidebarItem[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of sorted) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const children = await buildSidebarItems(fullPath, `${basePath}/${entry.name}`);
        if (children.length > 0) {
          items.push({ title: entry.name, children });
        }
      } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
        const basename = entry.name.replace(/\.md$/, "");
        items.push({ title: basename, href: `${basePath}/${basename}` });
      }
    }
  } catch {
    // Directory does not exist
  }
  return items;
}
