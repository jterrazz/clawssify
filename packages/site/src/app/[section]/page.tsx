'use client';

import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContentCard } from '@/components/content-card';
import { getContentBySlugClient, getContentListClient } from '@/lib/content-client';
import type { ContentFile } from '@/lib/content-types';
import { renderMarkdown } from '@/lib/mdx';

const sectionMeta: Record<string, { title: string; description: string }> = {
    wiki: {
        title: 'Wiki',
        description: 'Evergreen topic pages that evolve as new knowledge is ingested.',
    },
    posts: {
        title: 'Posts',
        description: 'Articles synthesized from ingested sources.',
    },
    digest: {
        title: 'Digest',
        description: 'Daily changelog of knowledge base changes.',
    },
};

const validSections = new Set(['wiki', 'posts', 'digest']);

export default function SectionPage() {
    const params = useParams<{ section: string }>();
    const section = params.section;
    const [files, setFiles] = useState<ContentFile[]>([]);
    const [indexContent, setIndexContent] = useState<null | React.ReactNode>(null);
    const [loaded, setLoaded] = useState(false);

    if (!validSections.has(section)) {
        notFound();
    }
    const meta = sectionMeta[section];

    useEffect(() => {
        async function load() {
            const [contentFiles, indexFile] = await Promise.all([
                getContentListClient(section),
                getContentBySlugClient([section]),
            ]);

            setFiles(contentFiles);

            if (indexFile) {
                const { content } = await renderMarkdown(indexFile.content);
                setIndexContent(content);
            }

            setLoaded(true);
        }
        load();
    }, [section]);

    return (
        <div className="px-8 py-12 max-w-3xl mx-auto">
            <div className="mb-10">
                <p className="text-sm font-medium text-muted-foreground mb-2 tracking-wide uppercase">
                    {meta.title}
                </p>
                <p className="text-muted-foreground text-sm">{meta.description}</p>
            </div>

            {indexContent && (
                <div className="mb-10 text-sm">
                    <div>{indexContent}</div>
                </div>
            )}

            {loaded && files.length > 0 && (
                <div className="grid gap-2">
                    {files.map((file) => (
                        <ContentCard file={file} key={file.slug.join('/')} />
                    ))}
                </div>
            )}

            {loaded && files.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm text-muted-foreground">No content in this section yet.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        Content will appear here after ingestion.
                    </p>
                </div>
            )}
        </div>
    );
}
