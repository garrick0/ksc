import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to set cross-origin isolation headers for WebContainer
 *
 * WebContainer requires these headers to enable SharedArrayBuffer:
 * - Cross-Origin-Embedder-Policy: require-corp
 * - Cross-Origin-Opener-Policy: same-origin
 *
 * Using middleware ensures headers are applied reliably in both
 * development and production, unlike async headers() in next.config.mjs
 * which can be unreliable during HMR/Fast Refresh.
 */
export function middleware(_request: NextRequest) {
  // Apply cross-origin isolation headers to ALL routes
  // Required for WebContainer - headers must be on every resource
  const response = NextResponse.next();

  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  return response;
}

// Run on all routes
export const config = {
  matcher: '/:path*',
};
