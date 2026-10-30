import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import SystemBanner from './SystemBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppLayout() {
  const { role, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* WCAG 2.1 AA Keyboard Skip Navigation Link */}
      <a
        href="#main-content"
        className="sr-only-focusable z-50 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      {/* Persistent System Health / Ephemeral Banner (H19, G6, H15) */}
      <SystemBanner />

      <div className="flex-1 md:flex">
        {/* Sidebar: sticky on desktop */}
        <div className="md:sticky md:top-0 md:h-screen md:shrink-0 md:overflow-y-auto">
          <Sidebar />
        </div>

        <div className="min-w-0 flex-1 flex flex-col">
          <Header />

          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6 lg:p-8 outline-none">
            <Outlet context={{ role, user }} />
          </main>

          <footer className="border-t border-slate-200/80 bg-white/60 px-6 py-3 text-center text-xs text-slate-400">
            <span className="font-medium text-slate-500">LoomGuard</span>
            {' · '}Evidence-led brand governance
            {' · '}Human approval required
          </footer>
        </div>
      </div>
    </div>
  );
}
