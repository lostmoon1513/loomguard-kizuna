import { useState, useEffect } from 'react';
import { LoaderCircle, Server, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getHealth } from '../api/drafts.js';

export default function WakingScreen({ onAwake, onContinueDemo }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [awake, setAwake] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Connecting to Render backend...');

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let interval = null;

    interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    const ping = async () => {
      if (cancelled) return;
      try {
        const health = await getHealth();
        if (health && !cancelled) {
          setAwake(true);
          setStatusMessage('Backend is operational!');
          if (onAwake) {
            setTimeout(onAwake, 800);
          }
          return;
        }
      } catch {
        if (!cancelled) {
          setStatusMessage('Spinning up Render container (takes ~40–50s)...');
          // Poll every 5 seconds
          timer = setTimeout(ping, 5000);
        }
      }
    };

    ping();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [onAwake]);

  const manualRetry = async () => {
    setRetrying(true);
    try {
      const health = await getHealth();
      if (health) {
        setAwake(true);
        if (onAwake) onAwake();
      }
    } catch {
      // Still asleep
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-md px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/80 bg-slate-800 p-8 shadow-2xl text-center text-white">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-6">
          {awake ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          ) : (
            <Server className="h-8 w-8 text-indigo-400 animate-pulse" />
          )}
        </div>

        <h2 className="text-xl font-bold tracking-tight">
          {awake ? 'Backend is Ready!' : 'Waking the Server'}
        </h2>

        <p className="mt-2 text-sm text-slate-300 leading-relaxed">
          {awake
            ? 'Connection verified. Loading LoomGuard workspace...'
            : 'The API is hosted on Render free tier, which sleeps after inactivity and takes ~45–50 seconds to spin up.'}
        </p>

        {!awake && (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <span>{statusMessage}</span>
              <span>{elapsedSeconds}s</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(10, (elapsedSeconds / 50) * 100))}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {!awake && (
            <button
              onClick={manualRetry}
              disabled={retrying}
              className="btn-primary w-full justify-center py-2.5"
            >
              {retrying ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {retrying ? 'Checking connection...' : 'Check Connection Now'}
            </button>
          )}

          {onContinueDemo && (
            <button
              onClick={onContinueDemo}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 inline-flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              Continue with demo responses while waking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
