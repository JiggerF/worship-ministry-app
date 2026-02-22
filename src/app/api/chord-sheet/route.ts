import { NextRequest, NextResponse } from 'next/server';

// Extracts the Google Docs document ID from any share/edit/view URL format
function extractDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  const fileUrl = request.nextUrl.searchParams.get('url');

  if (!fileUrl) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  // Verify it's actually a Google Docs URL before extracting the ID
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(fileUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (parsedUrl.hostname !== 'docs.google.com') {
    return NextResponse.json({ error: 'Only Google Docs URLs are supported' }, { status: 400 });
  }

  const docId = extractDocId(fileUrl);
  if (!docId) {
    return NextResponse.json({ error: 'Could not extract document ID from URL' }, { status: 400 });
  }

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  try {
    const res = await fetch(exportUrl, {
      // Cache the exported text for 1 hour — chord sheets rarely change
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Docs export returned ${res.status}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch chord sheet from Google Docs' },
      { status: 502 }
    );
  }
}
