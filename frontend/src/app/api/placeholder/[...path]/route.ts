import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathString = path.join('/');
  const [width = '400', height = '300'] = pathString.split('/');

  // Generate a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:0.6" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <circle cx="50%" cy="40%" r="20" fill="rgba(255,255,255,0.2)"/>
      <rect x="20%" y="65%" width="60%" height="4" rx="2" fill="rgba(255,255,255,0.3)"/>
      <rect x="20%" y="75%" width="40%" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/>
      <text x="50%" y="90%" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="system-ui" font-size="12">${width}×${height}</text>
    </svg>
  `;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    },
  });
} 