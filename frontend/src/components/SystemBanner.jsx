import { useState, useEffect } from 'react';
import { AlertTriangle, Info, X, Database, Sparkles } from 'lucide-react';
import { getHealth } from '../api/drafts.js';

export default function SystemBanner() {
  const [health, setHealth] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      getHealth()
        .then((data) => {
          if (!cancelled && data) {
            setHealth(data);
          }
        })
        .catch(() => {});
    };

    check();
    // Periodically refresh health every 30s
    const interval = setInterval(check, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (dismissed || !health) return null;

  const isMemoryPersistence =
    health.persistence === 'memory' ||
    health.database === 'memory' ||
    (typeof health.database === 'object' && health.database?.connected === false);

  const isAiUnavailable =
    health.ai?.available === false ||
    (health.gemini_configured === false && health.ai_available === false);

  if (!isMemoryPersistence && !isAiUnavailable) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-300/40 text-amber-950 px-4 py-2.5 text-xs transition-all">
      <div className="mx-auto max-w-[1500px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {isMemoryPersistence && (
            <div className="flex items-center gap-1.5 font-medium">
              <Database className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                <strong>Ephemeral Storage:</strong> MongoDB is disconnected. Changes reside in server memory only (H19).
              </span>
            </div>
          )}

          {isAiUnavailable && (
            <div className="flex items-center gap-1.5 text-amber-900">
              <Sparkles className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span>
                <strong>Rule Engine Only:</strong> AI claims & tone check inactive ({health.ai?.last_error || 'quota limit/unconfigured'}). Rule checks are running locally (H15).
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-amber-800 hover:bg-amber-200/50 hover:text-amber-950 transition-colors"
          title="Dismiss banner for this session"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
