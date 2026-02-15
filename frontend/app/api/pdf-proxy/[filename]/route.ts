import { NextRequest, NextResponse } from 'next/server';

/**
 * PDF proxy route — szerver oldalon tölti le a PDF-et a Strapi-ról,
 * ezzel elkerüli a CORS problémákat.
 *
 * Használat: GET /api/pdf-proxy?url=https://cms.emermedia.eu/uploads/.../file.pdf
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pdfUrl = searchParams.get('url');

  if (!pdfUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Biztonsági ellenőrzés: csak a saját Strapi szerverről engedünk PDF-t
  const allowedHosts = [
    'cms.emermedia.eu',
    'localhost',
    '127.0.0.1',
  ];

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pdfUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const isAllowed = allowedHosts.some(host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`));
  if (!isAllowed) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const headers: Record<string, string> = {};

    // Strapi API token hozzáadása, ha a CMS URL-ről töltjük
    const apiToken = process.env.STRAPI_API_TOKEN || process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;
    if (apiToken && parsedUrl.hostname === 'cms.emermedia.eu') {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const response = await fetch(pdfUrl, { headers });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    // Fájlnév kinyerése az URL-ből a böngésző PDF viewer számára
    const pathSegments = parsedUrl.pathname.split('/');
    const rawFilename = pathSegments[pathSegments.length - 1] || 'document.pdf';
    const filename = decodeURIComponent(rawFilename);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.byteLength),
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF proxy error:', message);
    return NextResponse.json({ error: `PDF proxy error: ${message}` }, { status: 500 });
  }
}
