export interface ContentFile {
  slug: string[];
  content: string;
  frontmatter: Record<string, unknown>;
  section: "digest" | "posts" | "wiki";
  lastModified: Date;
}

export interface SidebarItem {
  title: string;
  href?: string;
  children?: SidebarItem[];
}

export function formatName(name: string): string {
  return name
    .replace(/^\d{4}-\d{2}-\d{2}_/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
