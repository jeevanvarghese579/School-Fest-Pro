import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Info, LogOut, Menu, Trophy, Users, X } from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { auth, db, firestoreInitiallyDisabled } from './firebase';
import {
  configureWorkspace,
  loadCloudDataToLocal,
  setCloudAccessApproved,
  syncLocalDataToCloud,
} from './utils/storage';
import {
  checkCurrentUserAccess,
  isConnectivityError,
  requestCurrentUserAccess,
  type AccessCheck,
} from './services/access';

import RegistrationPortal from './components/RegistrationPortal';
import ReportsDashboard from './components/ReportsDashboard';
import ResultsConsole from './components/ResultsConsole';
import About from './components/About';
import Login from './components/login';
import appIcon from './assets/app-icon.svg';

type Page = 'registration' | 'reports' | 'results' | 'about';
type SessionState = 'checking' | 'signed-out' | 'offline' | 'allowed' | 'denied';

const accessCacheKey = (uid: string) => `schoolfest_access_cache:${uid}`;
const SESSION_MODE_KEY = 'schoolfest_session_mode';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('registration');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionState>('checking');
  const [access, setAccess] = useState<AccessCheck | null>(null);
  const [accessError, setAccessError] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const offlineRequested = useRef(false);

  const openApprovedWorkspace = useCallback(async (currentUser: User, check: AccessCheck) => {
    await configureWorkspace('online', currentUser.uid);
    setCloudAccessApproved(true);
    await enableNetwork(db);
    try {
      await loadCloudDataToLocal();
    } catch (error) {
      if (!isConnectivityError(error)) throw error;
      setCloudAccessApproved(false);
      await disableNetwork(db);
    }
    localStorage.setItem(accessCacheKey(currentUser.uid), 'approved');
    setAccess(check);
    setSession('allowed');
  }, []);

  const evaluateAccess = useCallback(async (currentUser: User) => {
    setSession('checking');
    setAccessError('');
    setCloudAccessApproved(false);
    await firestoreInitiallyDisabled;
    await disableNetwork(db).catch(() => undefined);
    try {
      const check = await checkCurrentUserAccess(currentUser);
      setAccess(check);
      if (!check.allowed) {
        setSession('denied');
        return;
      }
      await openApprovedWorkspace(currentUser, check);
    } catch (error) {
      if (isConnectivityError(error) && localStorage.getItem(accessCacheKey(currentUser.uid)) === 'approved') {
        await configureWorkspace('online', currentUser.uid);
        setCloudAccessApproved(false);
        setAccess({ allowed: true, requestStatus: null, requireEmailVerification: false, emailVerified: currentUser.emailVerified, role: null });
        setAccessError('Offline: using this account’s cached workspace. Server sync is paused until access is revalidated.');
        setSession('allowed');
        return;
      }
      console.error('Access check failed.', error);
      setAccessError('Could not verify application access. Check your connection and try again.');
      setSession('denied');
    }
  }, [openApprovedWorkspace]);

  useEffect(() => {
    let active = true;
    void firestoreInitiallyDisabled;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active || offlineRequested.current) return;
      setUser(currentUser);
      if (!currentUser) {
        if (localStorage.getItem(SESSION_MODE_KEY) === 'local') {
          offlineRequested.current = true;
          await configureWorkspace('local');
          setAccess(null);
          setSession('offline');
          return;
        }
        setAccess(null);
        setSession('signed-out');
        return;
      }
      await evaluateAccess(currentUser);
    });
    return () => { active = false; unsubscribe(); };
  }, [evaluateAccess]);

  useEffect(() => {
    const handleOffline = () => {
      setCloudAccessApproved(false);
      void disableNetwork(db);
      if (session === 'allowed') setAccessError('Offline: changes are safe on this device and will sync after access is revalidated.');
    };
    const handleOnline = async () => {
      if (session !== 'allowed' || !user || offlineRequested.current) return;
      try {
        const check = await checkCurrentUserAccess(user);
        if (!check.allowed) {
          setCloudAccessApproved(false);
          await disableNetwork(db);
          setAccess(check);
          setSession('denied');
          setAccessError('Online access was revoked. Your local unsynced data has been preserved.');
          return;
        }
        setCloudAccessApproved(true);
        await enableNetwork(db);
        await syncLocalDataToCloud();
        setAccessError('');
      } catch (error) {
        console.error('Reconnect validation failed.', error);
        setCloudAccessApproved(false);
        await disableNetwork(db);
        setAccessError('Reconnect validation failed. Sync remains paused; your local data is safe.');
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [session, user]);

  const enterOffline = async () => {
    offlineRequested.current = true;
    localStorage.setItem(SESSION_MODE_KEY, 'local');
    setCloudAccessApproved(false);
    await disableNetwork(db).catch(() => undefined);
    if (auth.currentUser) await signOut(auth);
    await configureWorkspace('local');
    setUser(null);
    setAccess(null);
    setAccessError('');
    setSession('offline');
  };

  const leaveSession = async () => {
    setCloudAccessApproved(false);
    await disableNetwork(db).catch(() => undefined);
    if (session === 'offline') {
      offlineRequested.current = false;
      localStorage.removeItem(SESSION_MODE_KEY);
      setSession('signed-out');
      return;
    }
    await signOut(auth);
    setSession('signed-out');
  };

  const requestAccess = async (requestType: 'new-account' | 'access-request') => {
    setRequestBusy(true);
    setAccessError('');
    try {
      const result = await requestCurrentUserAccess(requestType);
      if (result.status === 'already-approved' && auth.currentUser) {
        await evaluateAccess(auth.currentUser);
      } else {
        setAccess((current) => ({
          allowed: false,
          requestStatus: result.status === 'created' ? 'pending' : result.status as 'pending' | 'approved' | 'rejected',
          requireEmailVerification: current?.requireEmailVerification || false,
          emailVerified: current?.emailVerified || false,
          role: current?.role || null,
        }));
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      setAccessError(code === 'functions/failed-precondition'
        ? 'Verify your email address before requesting access to this application.'
        : 'Could not submit the access request. Please try again.');
    } finally {
      setRequestBusy(false);
    }
  };

  const navItems = [
    { id: 'registration', label: 'Registration Portal', icon: Users },
    { id: 'reports', label: 'Reports Dashboard', icon: BarChart3 },
    { id: 'results', label: 'Results Console', icon: Trophy },
    { id: 'about', label: 'About', icon: Info },
  ];

  if (session === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-600">Checking secure access...</p></div>;
  }

  if (session === 'signed-out' || session === 'denied') {
    return (
      <Login
        user={user}
        access={access}
        error={accessError}
        busy={requestBusy}
        onContinueOffline={enterOffline}
        onRequestAccess={requestAccess}
        onCheckAgain={() => auth.currentUser && evaluateAccess(auth.currentUser)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-slate-800 to-slate-900 text-white transition-all duration-300 flex flex-col shadow-xl`}>
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <img src={appIcon} alt="SchoolFest Pro" className="w-10 h-10 rounded-lg shadow-lg" />
            {sidebarOpen && <div><h1 className="font-bold text-lg leading-tight">SchoolFest</h1><p className="text-xs text-slate-400">Pro</p></div>}
          </div>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button key={item.id} onClick={() => setCurrentPage(item.id as Page)} className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' : 'hover:bg-slate-700 text-slate-300'}`}>
                <Icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-700">
            <div>{session === 'offline' ? 'Local offline profile' : user?.email}</div>
            {accessError && <div className="mt-1 text-amber-300">{accessError}</div>}
          </div>
        )}

        <button onClick={leaveSession} className="p-4 border-t border-slate-700 hover:bg-red-600 transition-colors flex items-center gap-3">
          <LogOut size={20} />
          {sidebarOpen && <span>{session === 'offline' ? 'Exit Offline' : 'Logout'}</span>}
        </button>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-4 border-t border-slate-700 hover:bg-slate-700 transition-colors">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1800px] mx-auto p-6">
          {currentPage === 'registration' && <RegistrationPortal />}
          {currentPage === 'reports' && <ReportsDashboard />}
          {currentPage === 'results' && <ResultsConsole />}
          {currentPage === 'about' && <About />}
        </div>
      </main>
    </div>
  );
}

export default App;
