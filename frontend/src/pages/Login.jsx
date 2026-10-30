import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  User,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { DEMO_ACCOUNTS } from '../api/auth.js';
import { getErrorMessage } from '../api/client.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, loginAsDemo } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(null);
  const [error, setError] = useState('');

  const isSessionExpired = searchParams.get('expired') === '1';

  const redirectAfterLogin = () => {
    const savedRedirect = sessionStorage.getItem('loomguard_redirect_url');
    if (savedRedirect) {
      sessionStorage.removeItem('loomguard_redirect_url');
      navigate(savedRedirect, { replace: true });
      return;
    }
    const from = location.state?.from?.pathname || '/studio';
    navigate(from, { replace: true });
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await login(email.trim(), password);
      redirectAfterLogin();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDemoSignIn = async (roleName) => {
    setDemoBusy(roleName);
    setError('');

    try {
      await loginAsDemo(roleName);
      redirectAfterLogin();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDemoBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))] pointer-events-none" />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Logo badge */}
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-600/30">
          <Activity className="h-7 w-7" />
        </div>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          LoomGuard
        </h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-indigo-400 font-semibold">
          Brand Governance & Verification
        </p>
      </div>

      <div className="relative mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-3xl sm:px-10 text-slate-200">
          {isSessionExpired && (
            <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>Session Expired (H11)</strong>
                <p className="mt-0.5 text-amber-400/90">
                  Your security session ended. Please sign in again to continue your work.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <strong>Sign In Failed</strong>
                <p className="mt-0.5 text-rose-400/90">{error}</p>
              </div>
            </div>
          )}

          {/* Quick Demo Login Section (N7: Demo data is labelled) */}
          <div className="mb-8 rounded-2xl border border-indigo-900/60 bg-indigo-950/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Quick Demo Access (Round 3)
                </span>
              </div>
              <span className="rounded-full bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                Labelled Demo
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Select a pre-configured role to immediately explore LoomGuard with authenticated permissions:
            </p>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((account) => {
                const isLoadingThis = demoBusy === account.role;
                return (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => handleDemoSignIn(account.role)}
                    disabled={busy || demoBusy !== null}
                    className={`group relative flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      account.role === 'creator'
                        ? 'border-indigo-500/40 bg-indigo-900/30 hover:border-indigo-400 hover:bg-indigo-900/50'
                        : account.role === 'manager'
                        ? 'border-amber-500/40 bg-amber-950/30 hover:border-amber-400 hover:bg-amber-950/50'
                        : 'border-emerald-500/40 bg-emerald-950/30 hover:border-emerald-400 hover:bg-emerald-950/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold capitalize text-white">
                        {account.role}
                      </span>
                      {isLoadingThis ? (
                        <LoaderCircle className="h-3 w-3 animate-spin text-white" />
                      ) : (
                        <ArrowRight className="h-3 w-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                      {account.role === 'creator'
                        ? 'Uploads & edits drafts'
                        : account.role === 'manager'
                        ? 'Waivers & approvals'
                        : 'Audits & claim waivers'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-slate-900 px-3 text-slate-500 font-medium">
                Or sign in with email
              </span>
            </div>
          </div>

          {/* Standard Email / Password Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || demoBusy !== null}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              {busy ? 'Authenticating...' : 'Sign in to LoomGuard'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Enforces server-side JWT verification per user session (Design Rule N5).
          </div>
        </div>
      </div>
    </div>
  );
}
