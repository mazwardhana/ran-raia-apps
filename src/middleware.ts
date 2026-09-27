import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/auth.config';

const { auth } = NextAuth(authConfig);

const OPERATOR_ROLES = ['OPERATOR', 'ADMIN'];

export interface RouteSessionUser {
  id?: string;
  role?: string;
  username?: string;
  kycStatus?: string;
}

export interface RouteSession {
  user?: RouteSessionUser | null;
}

export function getRouteRedirect(pathname: string, session: RouteSession | null): string | null {
  const user = session?.user;
  const isOperatorPath = pathname === '/op' || pathname.startsWith('/op/');
  const isCheckoutPath =
    pathname === '/app/checkout' || pathname.startsWith('/app/checkout/');
  const isAppPath = pathname === '/app' || pathname.startsWith('/app/');
  const isKycPath = pathname === '/kyc' || pathname.startsWith('/kyc/');
  const isProtected = isOperatorPath || isAppPath || isKycPath;

  if (!user?.role) {
    return isProtected ? '/login' : null;
  }

  if (isOperatorPath && !OPERATOR_ROLES.includes(user.role)) {
    return '/app';
  }

  if (isCheckoutPath && user.kycStatus !== 'VERIFIED') {
    return '/kyc';
  }

  return null;
}

export const middleware = auth((req) => {
  const redirectPath = getRouteRedirect(req.nextUrl.pathname, req.auth);
  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, req.url));
  }
});

export default middleware;

export const config = {
  matcher: ['/app/:path*', '/op/:path*', '/kyc'],
};
