import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { getAuthenticatedUser } from '../../../../lib/server/core';
import { getDb } from '../../../../lib/db';

const PUBLIC_FOLDERS = new Set(['products', 'categories', 'site', 'testimonials']);
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export async function GET(request, { params }) {
  const { path } = await params;
  if (!Array.isArray(path) || path.length < 2 || !path.every((seg) => SAFE_SEGMENT.test(seg) && seg !== '..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const folder = path[0];
  const relative = path.join('/');

  // Payment screenshots are private: only the admin or the customer who
  // uploaded it (on their own order) may view them.
  if (folder === 'screenshots') {
    const user = await getAuthenticatedUser();
    if (!user) return new NextResponse('Not found', { status: 404 });
    if (!user.is_superuser) {
      const db = await getDb();
      const owns = await db.collection('orders').findOne(
        { user_id: user.id, screenshot_id: `/api/media/${relative}` },
        { projection: { _id: 1 } }
      );
      if (!owns) return new NextResponse('Not found', { status: 404 });
    }
  } else if (!PUBLIC_FOLDERS.has(folder)) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const result = await get(`media/${relative}`, { access: 'private' });
    if (!result) return new NextResponse('Not found', { status: 404 });

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        'Cache-Control': folder === 'screenshots' ? 'private, max-age=3600' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('Media fetch failed:', relative, err);
    return new NextResponse('Not found', { status: 404 });
  }
}
