import { type NextRequest, NextResponse } from 'next/server';

import { getContentBySlug, getContentList } from '@/lib/content';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    if (action === 'get_by_slug') {
        const slugStr = searchParams.get('slug');
        if (!slugStr) {
            return NextResponse.json(null);
        }
        const slug = slugStr.split('/');
        const file = await getContentBySlug(slug);
        return NextResponse.json(file);
    }

    if (action === 'list') {
        const section = searchParams.get('section');
        if (!section) {
            return NextResponse.json([]);
        }
        const files = await getContentList(section);
        return NextResponse.json(files);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
