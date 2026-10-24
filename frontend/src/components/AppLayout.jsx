
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';

export default function AppLayout() {
  const [role, setRoleState] = useState(
    localStorage.getItem('loomguard-role') || 'creator',
  );

  const setRole = (next) => {
    localStorage.setItem('loomguard-role', next);
    setRoleState(next);
  };

  useEffect(() => {
    if (!localStorage.getItem('loomguard-user')) {
      localStorage.setItem('loomguard-user', role);
    }
  }, [role]);

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Sidebar: sticky on desktop */}
      <div className="md:sticky md:top-0 md:h-screen md:shrink-0 md:overflow-y-auto">
        <Sidebar />
      </div>

      <div className="min-w-0 flex-1 flex flex-col">
        <Header role={role} setRole={setRole} />

        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet context={{ role }} />
        </main>

        <footer className="border-t border-slate-200/80 bg-white/60 px-6 py-3 text-center text-xs text-slate-400">
          <span className="font-medium text-slate-500">LoomGuard</span>
          {' · '}Evidence-led brand governance
          {' · '}Human approval required
        </footer>
      </div>
    </div>
  );
}
