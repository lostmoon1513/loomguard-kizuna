import { useEffect, useState } from 'react';
import { Bell, CircleHelp, LoaderCircle, LogOut, User, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getHealth } from '../api/drafts.js';
import { useAuth } from '../context/AuthContext.jsx';

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

export default function Header() {
  const location = useLocation();
  const { user, role, logout } = useAuth();

  const [showHelp, setShowHelp] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'waking'

  // Match /drafts/:id to Studio title
  const currentPath = location.pathname.startsWith('/drafts/') ? '/studio' : location.pathname;
  const [title, subtitle] = titles[currentPath] || [
    'LoomGuard',
    'Brand governance workspace',
  ];

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

  const getRoleBadgeClass = () => {
    if (role === 'manager') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (role === 'reviewer') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-indigo-100 text-indigo-800 border-indigo-200';
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
      <div className="flex flex-wrap items-center gap-2.5">
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

        {/* Authenticated User & Role Display */}
        {user && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5">
            <div className="grid h-6 w-6 place-items-center rounded-lg bg-slate-200 text-slate-600">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {user.name || user.email || 'Authenticated User'}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight font-medium">
                {user.email}
              </span>
            </div>
            <span
              className={`ml-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeClass()}`}
            >
              {role || 'creator'}
            </span>
          </div>
        )}

        {/* Sign Out Button */}
        {user && (
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-all"
            title="Sign out of LoomGuard"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        )}

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

          <p className="text-slate-600 leading-6 text-xs">
            Check a draft, review source-backed findings, resolve mandatory
            issues, then submit it for a manager decision. LoomGuard does
            not auto-approve or rewrite entire documents.
          </p>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div>• <strong className="text-slate-700">Creator:</strong> Drafts, edits, & exception requests</div>
            <div>• <strong className="text-slate-700">Manager:</strong> Approvals, rejections, & waivers</div>
            <div>• <strong className="text-slate-700">Reviewer:</strong> Claim checks & claim-level waivers</div>
          </div>
        </div>
      )}
    </header>
  );
}
