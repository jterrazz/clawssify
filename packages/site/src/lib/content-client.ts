import type { ContentFile, SidebarItem } from './content-types';
import { isTauri, tauriInvoke } from './tauri.js';

interface TauriContentEntry {
    slug: string[];
    title: string;
    content: string;
    frontmatter: Record<string, unknown>;
    section: string;
    last_modified: string;
}

interface TauriSidebarItem {
    title: string;
    href: null | string;
    children: TauriSidebarItem[];
}

function toContentFile(entry: TauriContentEntry): ContentFile {
    return {
        slug: entry.slug,
        content: entry.content,
        frontmatter: entry.frontmatter,
        section: entry.section as ContentFile['section'],
        lastModified: new Date(entry.last_modified),
    };
}

function toSidebarItem(item: TauriSidebarItem): SidebarItem {
    const result: SidebarItem = { title: item.title };
    if (item.href) {
        result.href = item.href;
    }
    if (item.children.length > 0) {
        result.children = item.children.map(toSidebarItem);
    }
    return result;
}

function parseContentFile(raw: unknown): ContentFile | null {
    if (!raw) {
        return null;
    }
    const data = raw as Record<string, unknown>;
    return {
        ...data,
        lastModified: new Date(data.lastModified as string),
    } as ContentFile;
}

function parseContentFiles(raw: unknown): ContentFile[] {
    const arr = raw as Record<string, unknown>[];
    return arr.map((d) => ({
        ...d,
        lastModified: new Date(d.lastModified as string),
    })) as ContentFile[];
}

export async function getContentBySlugClient(slug: string[]): Promise<ContentFile | null> {
    if (isTauri) {
        const entry = await tauriInvoke<null | TauriContentEntry>('get_content_by_slug', { slug });
        return entry ? toContentFile(entry) : null;
    }
    const res = await fetch(`/api/content?action=get_by_slug&slug=${slug.join('/')}`);
    return parseContentFile(await res.json());
}

export async function getContentListClient(section: string): Promise<ContentFile[]> {
    if (isTauri) {
        const entries = await tauriInvoke<TauriContentEntry[]>('get_content_list', {
            section,
        });
        return entries.map(toContentFile);
    }
    const res = await fetch(`/api/content?action=list&section=${section}`);
    return parseContentFiles(await res.json());
}

export async function getSidebarTreeClient(section: string): Promise<SidebarItem[]> {
    if (isTauri) {
        const items = await tauriInvoke<TauriSidebarItem[]>('get_sidebar_tree', {
            section,
        });
        return items.map(toSidebarItem);
    }
    // In web mode, sidebar is pre-fetched server-side
    return [];
}

export async function getAllContentClient(): Promise<ContentFile[]> {
    if (isTauri) {
        const entries = await tauriInvoke<TauriContentEntry[]>('get_all_content');
        return entries.map(toContentFile);
    }
    const res = await fetch('/api/search');
    return res.json();
}
