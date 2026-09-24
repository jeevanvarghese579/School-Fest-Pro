import type { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { firebaseConfig, functions } from '../firebase';

export const FIREBASE_APP_ID = firebaseConfig.appId;

export type AccessCheck = {
  allowed: boolean;
  requestStatus: 'pending' | 'approved' | 'rejected' | null;
  requireEmailVerification: boolean;
  emailVerified: boolean;
  role: string | null;
};

export async function checkCurrentUserAccess(user: User): Promise<AccessCheck> {
  const callable = httpsCallable<{ appId: string }, Record<string, unknown>>(
    functions,
    'checkMyAccess',
  );
  const result = await callable({ appId: FIREBASE_APP_ID });
  const data = result.data || {};
  const requestStatus = ['pending', 'approved', 'rejected'].includes(String(data.requestStatus))
    ? data.requestStatus as AccessCheck['requestStatus']
    : null;

  console.info('[SchoolFest Access]', {
    uid: user.uid,
    appId: FIREBASE_APP_ID,
    allowed: data.allowed === true,
    canonicalPath: `accessUsers/${user.uid}`,
    protectedPath: `apps/schoolFestPro/users/${user.uid}`,
  });

  return {
    allowed: data.allowed === true,
    requestStatus,
    requireEmailVerification: data.requireEmailVerification === true,
    emailVerified: data.emailVerified === true || user.emailVerified,
    role: typeof data.role === 'string' ? data.role : null,
  };
}

export async function requestCurrentUserAccess(requestType: 'new-account' | 'access-request') {
  const callable = httpsCallable<
    { appId: string; requestType: string },
    { status: 'created' | 'pending' | 'approved' | 'rejected' | 'already-approved' }
  >(functions, 'requestAppAccess');
  const result = await callable({ appId: FIREBASE_APP_ID, requestType });
  return result.data;
}

export function isConnectivityError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return !navigator.onLine || ['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal'].includes(code || '');
}
