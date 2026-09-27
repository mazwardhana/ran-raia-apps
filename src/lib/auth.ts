import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

export const { auth, signIn, signOut } = NextAuth(authConfig);

export interface CurrentUser {
  id: string;
  role: string;
  username: string;
  kycStatus: string;
}

export class AuthenticationError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';

  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(code === 'UNAUTHENTICATED' ? 'Authentication required' : 'Insufficient role');
    this.name = 'AuthenticationError';
    this.code = code;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.role || !user.username || !user.kycStatus) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    username: user.username,
    kycStatus: user.kycStatus,
  };
}

export async function requireRole(role: string | string[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError('UNAUTHENTICATED');

  const allowedRoles = Array.isArray(role) ? role : [role];
  if (!allowedRoles.includes(user.role)) {
    throw new AuthenticationError('FORBIDDEN');
  }

  return user;
}
