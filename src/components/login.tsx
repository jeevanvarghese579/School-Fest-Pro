import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { checkCurrentUserAccess, type AccessCheck } from '../services/access';

type Props = {
  user: User | null;
  access: AccessCheck | null;
  error: string;
  busy: boolean;
  onContinueOffline: () => Promise<void>;
  onRequestAccess: (type: 'new-account' | 'access-request') => Promise<void>;
  onCheckAgain: () => void;
};

function friendlyError(error: unknown) {
  const code = (error as { code?: string }).code || '';
  if (code.includes('invalid-credential')) return 'Invalid email or password.';
  if (code.includes('email-already-in-use')) return 'An account already exists for this email.';
  if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (code.includes('popup-closed')) return 'Google sign-in was cancelled.';
  return 'Authentication failed. Please try again.';
}

function Login({ user, access, error: accessError, busy, onContinueOffline, onRequestAccess, onCheckAgain }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formMode, setFormMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [newAccount, setNewAccount] = useState(false);

  const handleEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setAuthBusy(true);
    try {
      if (formMode === 'sign-in') {
        setNewAccount(false);
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        setNewAccount(true);
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        setMessage('Account created. This does not grant app access; complete the approval steps below.');
        const policy = await checkCurrentUserAccess(credential.user);
        if (policy.requireEmailVerification && !credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          setMessage('Account created. A verification email was sent; app access still requires administrator approval.');
        }
      }
      setPassword('');
    } catch (authError) {
      setError(friendlyError(authError));
    } finally {
      setAuthBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setAuthBusy(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('If an account exists for this email, a password reset link has been sent.');
    } catch (authError) {
      setError(friendlyError(authError));
    } finally {
      setAuthBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    setAuthBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage('Verification email sent. Open it, then choose Check Again.');
    } catch (authError) {
      setError(friendlyError(authError));
    } finally {
      setAuthBusy(false);
    }
  };

  const checkAgain = async () => {
    if (auth.currentUser) await auth.currentUser.reload();
    onCheckAgain();
  };

  const pending = access?.requestStatus === 'pending';
  const rejected = access?.requestStatus === 'rejected';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-orange-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">SchoolFest Pro</h1>
        <p className="text-center text-gray-500 mb-6">Secure online access or private offline use</p>

        {(error || accessError) && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error || accessError}</div>}
        {message && <div className="bg-blue-100 text-blue-800 p-3 rounded-lg mb-4 text-sm">{message}</div>}

        {user ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="font-semibold text-gray-800">{user.email}</p>
              <p className="text-sm text-gray-600 mt-2">
                {pending
                  ? 'Your access request is awaiting administrator approval.'
                  : rejected
                    ? 'Your account does not currently have access to this application.'
                    : 'Your account does not currently have access to this application.'}
              </p>
            </div>

            {pending ? (
              <button onClick={checkAgain} disabled={busy || authBusy} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-lg">Check Again</button>
            ) : (
              <button onClick={() => onRequestAccess(newAccount ? 'new-account' : 'access-request')} disabled={busy || authBusy || rejected} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-lg">Request Access</button>
            )}

            {!user.emailVerified && access?.requireEmailVerification && (
              <button onClick={resendVerification} disabled={authBusy} className="w-full border border-blue-300 text-blue-700 font-semibold py-3 rounded-lg hover:bg-blue-50">Send Verification Email</button>
            )}
            <button onClick={onContinueOffline} disabled={busy || authBusy} className="w-full border border-slate-300 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-50">Continue Offline</button>
            <button onClick={() => signOut(auth)} disabled={busy || authBusy} className="w-full text-gray-600 py-2 hover:text-red-600">Sign Out</button>
          </div>
        ) : (
          <>
            <button onClick={() => signInWithPopup(auth, googleProvider).catch((authError) => setError(friendlyError(authError)))} disabled={authBusy} className="w-full border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-lg mb-4">Continue with Google</button>
            <div className="flex items-center gap-3 my-4"><div className="h-px bg-gray-200 flex-1" /><span className="text-xs text-gray-400">OR</span><div className="h-px bg-gray-200 flex-1" /></div>
            <form onSubmit={handleEmail}>
              <input type="email" placeholder="Email" className="w-full border rounded-lg px-4 py-3 mb-4" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <input type="password" placeholder="Password" minLength={6} className="w-full border rounded-lg px-4 py-3 mb-4" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button disabled={authBusy} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-lg">{formMode === 'sign-in' ? 'Sign In with Email' : 'Create Account'}</button>
            </form>
            {formMode === 'sign-in' && <button onClick={resetPassword} disabled={authBusy} className="w-full text-blue-700 text-sm py-3">Forgot Password?</button>}
            <button onClick={() => { setFormMode(formMode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); }} className="w-full text-gray-600 text-sm py-2">{formMode === 'sign-in' ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}</button>
            <button onClick={onContinueOffline} disabled={authBusy} className="w-full mt-4 border border-slate-300 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-50">Continue Offline</button>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
