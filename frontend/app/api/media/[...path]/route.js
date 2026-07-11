import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export async function GET(request, { params }) {
  const { path } = await params;
  const pathname = `media/${path.join('/')}`;

  const result = await get(pathname, { access: 'private' });
  if (!result) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
