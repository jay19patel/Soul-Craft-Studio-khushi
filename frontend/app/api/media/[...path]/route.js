import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export async function GET(request, { params }) {
  const { path } = await params;
  const pathname = `media/${path.join('/')}`;

  try {
    const result = await get(pathname, { access: 'private' });
    if (!result) {
      return NextResponse.json({ error: 'Blob not found', pathname }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message, name: err.name, pathname, hasToken: !!process.env.BLOB_READ_WRITE_TOKEN },
      { status: 500 }
    );
  }
}
