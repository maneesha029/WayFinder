import { NextResponse, type NextRequest } from 'next/server';

/**
 * A1: strict CSP. Next picks up the nonce from the request CSP header and
 * adds it to its own bootstrap scripts, so no 'unsafe-inline' for scripts.
 * (styles need 'unsafe-inline' — Tailwind-injected styles and MapLibre inline styles.)
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ''}`.trim(),
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' http://localhost:8000 ws:`,
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    // skip static assets; run on pages and API-ish routes
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|maps).*)'
  ]
};
