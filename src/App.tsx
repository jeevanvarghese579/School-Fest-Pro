import { useEffect, useState } from 'react';
import {
  Users,
  BarChart3,
  Trophy,
  Info,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { loadCloudDataToLocal, syncLocalDataToCloud } from './utils/storage';

import RegistrationPortal from './components/RegistrationPortal';
import ReportsDashboard from './components/ReportsDashboard';
import ResultsConsole from './components/ResultsConsole';
import About from './components/About';
import Login from './components/Login';
import appIcon from './assets/app-icon.svg';

type Page = 'registration' | 'reports' | 'results' | 'about';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('registration');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);




  
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);

    if (currentUser) {
      try {
        const cloudDataLoaded = await loadCloudDataToLocal();

        if (!cloudDataLoaded) {
          localStorage.clear();
        }
      } catch (error) {
        console.error('Failed to load cloud data:', error);
        localStorage.clear();
      }
    } else {
      localStorage.clear();
    }

    setLoading(false);
  });

  return () => unsubscribe();
}, []);




  const navItems = [
    { id: 'registration', label: 'Registration Portal', icon: Users },
    { id: 'reports', label: 'Reports Dashboard', icon: BarChart3 },
    { id: 'results', label: 'Results Console', icon: Trophy },
    { id: 'about', label: 'About', icon: Info },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-slate-800 to-slate-900 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <img src={appIcon} alt="SchoolFest Pro" className="w-10 h-10 rounded-lg shadow-lg" />
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-lg leading-tight">SchoolFest</h1>
                <p className="text-xs text-slate-400">Pro</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as Page)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-700">
            {user.email}
          </div>
        )}

        <button
  onClick={async () => {
    localStorage.clear();
    await signOut(auth);
  }}className="p-4 border-t border-slate-700 hover:bg-red-600 transition-colors flex items-center gap-3"
        >
          <LogOut size={20} />
          {sidebarOpen && <span>Logout</span>}
        </button>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-slate-700 hover:bg-slate-700 transition-colors"
        >
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