
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  FileCheck2,
  RefreshCw,
  Search,
} from 'lucide-react';

import { getDrafts } from '../api/drafts.js';
import { getErrorMessage } from '../api/client.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingState from '../components/LoadingState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function ReviewQueue() {
  const [drafts, setDrafts] = useState([]);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setDrafts(await getDrafts(status || undefined));
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    async function loadDrafts() {
      if (!cancelled) await refresh();
    }
    loadDrafts();
    return () => { cancelled = true; };
  }, [refresh]);

  const visible = drafts.filter((draft) =>
    `${draft.title} ${draft.id} ${draft.author || ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <ErrorMessage
        message={error}
        onDismiss={() => setError('')}
      />

      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="eyebrow">Workflow overview</div>

            <h2 className="mt-2 text-lg font-bold text-slate-900">
              Draft review queue
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The list and statuses are returned by the backend. Open a
              draft to inspect its details.
            </p>
          </div>

          <button className="btn-secondary self-start" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh queue
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              className="field pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, ID, or author"
            />
          </label>

          <select
            className="field"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_REVIEW">In review</option>
            <option value="APPROVED">Approved</option>
            <option value="CHANGES_REQUESTED">Changes requested</option>
          </select>
        </div>
      </section>

      {loading ? (
        <LoadingState label="Loading review queue…" />
      ) : (
        <section className="space-y-2">
          {/* Column headers — desktop only */}
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_110px_110px_40px] gap-4 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 md:grid">
            <div>Draft</div>
            <div>Status</div>
            <div>Open issues</div>
            <div>Total issues</div>
            <div />
          </div>

          {visible.map((draft) => (
            <button
              key={draft.id}
              onClick={() =>
                navigate('/studio', {
                  state: { draftId: draft.id },
                })
              }
              className="group grid w-full grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-left shadow-sm shadow-slate-100/60 transition-all hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/40 md:grid-cols-[minmax(0,1fr)_150px_110px_110px_40px] md:items-center md:gap-4"
            >
              {/* Left accent stripe — mimics the card left border on hover */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-300 group-hover:bg-indigo-400 transition-colors shrink-0" />
                  <div className="truncate font-semibold text-slate-800">
                    {draft.title}
                  </div>
                </div>

                <div className="mt-1 ml-4 text-xs text-slate-400">
                  {draft.id} · {draft.author || 'Unknown author'} ·{' '}Updated{' '}
                  {draft.updated_at
                    ? new Date(draft.updated_at).toLocaleString()
                    : 'unknown'}
                </div>
              </div>

              <div>
                <StatusBadge status={draft.status} />
              </div>

              <div className="text-sm text-slate-600">
                <span className="text-slate-400 md:hidden">
                  Open issues:{' '}
                </span>
                <span className={`font-semibold ${(draft.open_issues ?? 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {draft.open_issues ?? 0}
                </span>
              </div>

              <div className="text-sm text-slate-600">
                <span className="text-slate-400 md:hidden">
                  Total issues:{' '}
                </span>
                {draft.total_issues ?? 0}
              </div>

              <div className="hidden text-slate-300 group-hover:text-indigo-500 transition-colors md:block">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </button>
          ))}

          {visible.length === 0 && (
            <div className="panel px-5 py-16 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-slate-100">
                <FileCheck2 className="h-8 w-8 text-slate-300" />
              </div>

              <h3 className="font-semibold text-slate-700">
                No drafts found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Try a different filter or check a draft in Studio.
              </p>

              <button
                className="btn-secondary mt-5"
                onClick={() => navigate('/studio')}
              >
                Open Studio
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
