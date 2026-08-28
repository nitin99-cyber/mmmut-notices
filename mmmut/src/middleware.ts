import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // 1. Allow public access to the homepage and /deadlines page
  if (url.pathname === '/' ) {
    return NextResponse.next();
  }

  // 2. Allow GET requests to /api/deadlines to pass through without auth
  if (url.pathname.startsWith('/api/deadlines') && req.method === 'GET') {
    return NextResponse.next();
  }

  // 3. Allow Vercel Cron to access /api/cron
  if (url.pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // 4. For all other pages and APIs, require Basic Authentication
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // Default to admin/admin if env variables are not set
    // Instruct users to set these in Vercel Environment Variables
    const validUser = process.env.ADMIN_USER || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (user === validUser && pwd === validPassword) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
