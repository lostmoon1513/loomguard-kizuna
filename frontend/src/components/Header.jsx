import { useEffect, useState } from 'react';
import { Bell, CircleHelp, LoaderCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getHealth } from '../api/drafts.js';

const titles = {
  '/studio': [
    'Studio',
    'Check content against your current brand kit.',
  ],
  '/brand': [
    'Brand setup',
    'Manage the sources that define your brand.',
  ],
  '/reviews': [
    'Review queue',
    'Track drafts as they move through review.',
  ],
  '/manager': [
    'Manager review',
    'Make explicit human decisions on submitted drafts.',
  ],
  '/insights': [
    'Insights',
    'Understand findings and workflow activity.',
  ],
};

export default function Header({ role, setRole }) {
  const location = useLocation();

  const [user, setUser] = useState(
    localStorage.getItem('loomguard-user') || 'creator',
  );

  const [showHelp, setShowHelp] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'waking'

  const [title, subtitle] = titles[location.pathname] || [
    'LoomGuard',
    'Brand governance workspace',
  ];

  useEffect(() => {
    localStorage.setItem('loomguard-user', user);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const check = () => {
      getHealth()
        .then(() => {
          if (!cancelled) setBackendStatus('online');
        })
        .catch(() => {
          if (!cancelled) {
            setBackendStatus('waking');
            timer = setTimeout(check, 5000);
          }
        });
    };

    check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const changeRole = (next) => {
    setRole(next);

    const nextUser = next === 'manager' ? 'manager' : 'creator';

    setUser(nextUser);
    localStorage.setItem('loomguard-role', next);
    localStorage.setItem('loomguard-user', nextUser);
  };

  return (
    <header className="relative flex flex-col gap-4 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      {/* Left: page title with accent bar */}
      <div className="flex items-center gap-3.5">
        <div className="h-7 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-700 shrink-0" />
        <div>
          <div className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
            {title}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-tight">{subtitle}</p>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Render Free Tier Backend Status Pill */}
        {backendStatus === 'waking' && (
          <div
            className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 shadow-sm"
            title="Render free tier services sleep after 15m of inactivity and need ~45-50s to wake up on first visit."
          >
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
            <span>Waking up backend (~45s)...</span>
          </div>
        )}

        {backendStatus === 'online' && (
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-medium text-emerald-700"
            title="Backend server connected and operational"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Live</span>
          </div>
        )}

        {/* Role pill switcher */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          {['creator', 'manager'].map((r) => (
            <button
              key={r}
              onClick={() => changeRole(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                role === r
                  ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200 border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Bell */}
        <button
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
          aria-label="Notifications"
          title="Notifications are not connected yet"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Help */}
        <button
          onClick={() => setShowHelp((value) => !value)}
          className={`rounded-xl border p-2 transition-all ${
            showHelp
              ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
              : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
          aria-label="Help"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="absolute right-5 top-[calc(100%+8px)] z-30 w-80 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-xl shadow-slate-200/80 sm:right-8">
          <div className="flex items-start justify-between gap-2 mb-3">
            <strong className="text-slate-900 text-base">How LoomGuard works</strong>
            <button
              onClick={() => setShowHelp(false)}
              className="text-slate-400 hover:text-slate-600 -mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-slate-600 leading-6">
            Check a draft, review source-backed findings, resolve mandatory
            issues, then submit it for a manager decision. LoomGuard does
            not auto-approve or rewrite entire documents.
          </p>
        </div>
      )}
    </header>
  );
}
