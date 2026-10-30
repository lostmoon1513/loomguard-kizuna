import { useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  FileText,
  GitCommitVertical,
  History,
  ShieldAlert,
  Upload,
  User,
} from 'lucide-react';

export default function VersionTimeline({
  versions = [],
  currentVersion = 1,
  onCompare,
  onUploadRevision,
  disabled = false,
}) {
  const [selectedFrom, setSelectedFrom] = useState(1);
  const [selectedTo, setSelectedTo] = useState(currentVersion);

  // Sort versions descending (newest on top)
  const sortedVersions = [...versions].sort((a, b) => b.n - a.n);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Version History ({versions.length} revision{versions.length === 1 ? '' : 's'})
          </h3>
        </div>

        {onUploadRevision && (
          <button
            type="button"
            onClick={onUploadRevision}
            disabled={disabled}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5 text-indigo-600" />
            <span>Upload new revision</span>
          </button>
        )}
      </div>

      {/* Quick Compare Selector Bar (when 2+ versions) */}
      {versions.length > 1 && onCompare && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="font-semibold text-slate-800">Compare any two versions:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedFrom}
              onChange={(e) => setSelectedFrom(Number(e.target.value))}
              className="field py-1 px-2 text-xs font-semibold rounded-lg bg-white"
              aria-label="From version"
            >
              {versions.map((v) => (
                <option key={`sel-from-${v.n}`} value={v.n}>
                  v{v.n} ({v.note || `Version ${v.n}`})
                </option>
              ))}
            </select>

            <span className="text-slate-400 font-bold">→</span>

            <select
              value={selectedTo}
              onChange={(e) => setSelectedTo(Number(e.target.value))}
              className="field py-1 px-2 text-xs font-semibold rounded-lg bg-white"
              aria-label="To version"
            >
              {versions.map((v) => (
                <option key={`sel-to-${v.n}`} value={v.n}>
                  v{v.n} ({v.note || `Version ${v.n}`})
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={selectedFrom === selectedTo}
              onClick={() => onCompare(selectedFrom, selectedTo)}
              className="btn-primary py-1 px-3 text-xs disabled:opacity-50"
            >
              View diff
            </button>
          </div>
        </div>
      )}

      {/* Timeline List */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {sortedVersions.map((v) => {
          const isCurrent = v.n === currentVersion;
          const openMandatory = v.counts?.open_mandatory ?? 0;
          const totalIssues = v.counts?.total ?? 0;

          return (
            <div
              key={v.n}
              className={`relative rounded-2xl border p-4 transition-all ${
                isCurrent
                  ? 'border-indigo-300 bg-white shadow-xs shadow-indigo-100/40 ring-1 ring-indigo-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {/* Timeline dot */}
              <div
                className={`absolute -left-[27px] top-4 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[10px] font-bold ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {v.n}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    Version {v.n}
                  </span>

                  {isCurrent && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      Current
                    </span>
                  )}

                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      v.role === 'manager'
                        ? 'bg-amber-100 text-amber-800'
                        : v.role === 'reviewer'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {v.role || 'creator'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>{v.at ? new Date(v.at).toLocaleString() : 'Just now'}</span>
                </div>
              </div>

              {/* Author & Note */}
              <div className="mt-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">
                  {v.author || 'Author'}
                </span>
                {v.note && (
                  <span className="ml-1 text-slate-500">
                    — “{v.note}”
                  </span>
                )}
              </div>

              {/* Counts & Actions footer */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {openMandatory > 0 ? (
                    <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      {openMandatory} open mandatory
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Mandatory resolved
                    </span>
                  )}
                  <span className="text-slate-400 text-[11px]">
                    {totalIssues} total finding{totalIssues === 1 ? '' : 's'}
                  </span>
                </div>

                {v.n > 1 && onCompare && (
                  <button
                    type="button"
                    onClick={() => onCompare(v.n - 1, v.n)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Diff v{v.n - 1} → v{v.n}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
