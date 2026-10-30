import { NavLink } from 'react-router-dom';
import {
  Activity,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Sidebar() {
  const { role, user } = useAuth();

  const links = [
    { to: '/studio', label: 'Studio', icon: FileText, roles: ['creator', 'manager', 'reviewer'] },
    { to: '/brand', label: 'Brand setup', icon: Layers3, roles: ['creator', 'manager', 'reviewer'] },
    { to: '/reviews', label: 'Review queue', icon: FileCheck2, roles: ['creator', 'manager', 'reviewer'] },
    { to: '/manager', label: 'Manager review', icon: ShieldCheck, roles: ['manager', 'reviewer'] },
    { to: '/insights', label: 'Insights', icon: Gauge, roles: ['manager', 'reviewer'] },
  ];

  const visibleLinks = links.filter((link) => !role || link.roles.includes(role));

  return (
    <aside className="flex w-full shrink-0 flex-col bg-slate-900 md:min-h-screen md:w-64">
      {/* Logo area */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-900/40">
          <Activity className="h-[18px] w-[18px]" />
        </div>

        <div>
          <div className="text-base font-bold tracking-tight text-white leading-tight">
            LoomGuard
          </div>
          <div className="text-[11px] text-slate-400 leading-tight mt-0.5">Brand governance</div>
        </div>
      </div>

      {/* Nav label */}
      <div className="mt-5 mb-1.5 px-5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        <span>Workspace</span>
        {role && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-indigo-400 capitalize font-mono">
            {role}
          </span>
        )}
      </div>

      {/* Navigation — desktop vertical, mobile horizontal scroll */}
      <nav className="overflow-x-auto md:overflow-x-visible px-3 pb-2 md:pb-0">
        <div className="flex gap-1 md:flex-col min-w-max md:min-w-0">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap md:whitespace-normal ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30 border-l-0'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User info & bottom promo card — desktop only */}
      <div className="mt-auto hidden px-3 pb-5 md:block space-y-3">
        {user && (
          <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="h-7 w-7 rounded-lg bg-indigo-900/50 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-bold">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">
                  {user.name || user.email}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {role} role
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            Review before publish
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Evidence-backed checks. Human decisions stay with your team.
          </p>
        </div>
      </div>
    </aside>
  );
}
