import { useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Columns2,
  FileText,
  Minus,
  Plus,
  Rows2,
  X,
} from 'lucide-react';

/**
 * Accessible DiffViewer component adhering to WCAG AA and contract_v2.
 * Renders server-side diff ops with semantic <ins> and <del> tags and text markers (+ / -).
 */
export default function DiffViewer({
  diffData,
  loading = false,
  onClose,
  versions = [],
  fromVersion,
  toVersion,
  onSelectVersions,
}) {
  const [viewMode, setViewMode] = useState('inline'); // 'inline' | 'split'

  if (!diffData && !loading) return null;

  const { from = fromVersion, to = toVersion, ops = [], stats } = diffData || {};

  // Build old and new text slices for split view
  const oldTokens = [];
  const newTokens = [];

  if (viewMode === 'split') {
    ops.forEach((item, idx) => {
      if (item.op === 'equal') {
        oldTokens.push({ ...item, key: `eq-old-${idx}` });
        newTokens.push({ ...item, key: `eq-new-${idx}` });
      } else if (item.op === 'delete') {
        oldTokens.push({ ...item, key: `del-${idx}` });
      } else if (item.op === 'insert') {
        newTokens.push({ ...item, key: `ins-${idx}` });
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-viewer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-6"
    >
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h3 id="diff-viewer-title" className="text-base font-bold text-slate-900 leading-tight">
                Version Comparison Diff
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Word-level differences between Version {from} and Version {to}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Version Selectors if available */}
            {versions.length > 1 && onSelectVersions && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mr-2">
                <span className="font-medium">Compare:</span>
                <select
                  value={from}
                  onChange={(e) => onSelectVersions(Number(e.target.value), to)}
                  className="field py-1 px-2 text-xs font-semibold rounded-lg"
                  aria-label="From version"
                >
                  {versions.map((v) => (
                    <option key={`from-${v.n}`} value={v.n}>
                      v{v.n}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400">→</span>
                <select
                  value={to}
                  onChange={(e) => onSelectVersions(from, Number(e.target.value))}
                  className="field py-1 px-2 text-xs font-semibold rounded-lg"
                  aria-label="To version"
                >
                  {versions.map((v) => (
                    <option key={`to-${v.n}`} value={v.n}>
                      v{v.n}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setViewMode('inline')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                  viewMode === 'inline'
                    ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                    : 'hover:text-slate-900'
                }`}
                title="Unified inline view"
              >
                <Rows2 className="h-3.5 w-3.5" />
                <span>Inline</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                  viewMode === 'split'
                    ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                    : 'hover:text-slate-900'
                }`}
                title="Side-by-side split view"
              >
                <Columns2 className="h-3.5 w-3.5" />
                <span>Side-by-side</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors ml-1"
              aria-label="Close diff viewer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Diff Stats Summary Bar */}
        {stats && (
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-white px-6 py-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <Plus className="h-3.5 w-3.5" />
                {stats.added_words ?? 0} added
              </span>
              <span className="flex items-center gap-1 font-semibold text-rose-700">
                <Minus className="h-3.5 w-3.5" />
                {stats.removed_words ?? 0} removed
              </span>
              <span className="text-slate-400">
                {stats.unchanged_words ?? 0} unchanged words
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-emerald-500" /> Green = Inserted
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-xs bg-rose-500" /> Red = Deleted
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500 text-sm">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span>Calculating word-level diff...</span>
            </div>
          ) : ops.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <h4 className="font-semibold text-slate-800">No text changes</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Version {from} and Version {to} have identical text content.
              </p>
            </div>
          ) : viewMode === 'inline' ? (
            /* Inline Unified View */
            <div className="rounded-2xl border border-slate-200 bg-white p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap select-text shadow-xs">
              {ops.map((item, idx) => {
                if (item.op === 'insert') {
                  return (
                    <ins
                      key={idx}
                      className="bg-emerald-100 text-emerald-950 font-semibold px-1 py-0.5 rounded-sm mx-0.5 no-underline border-b-2 border-emerald-400"
                      title="Added in this revision"
                    >
                      <span className="sr-only">[Added: ]</span>
                      <span className="text-emerald-700 font-bold select-none mr-0.5">[+]</span>
                      {item.text}
                    </ins>
                  );
                }
                if (item.op === 'delete') {
                  return (
                    <del
                      key={idx}
                      className="bg-rose-100 text-rose-950 line-through px-1 py-0.5 rounded-sm mx-0.5 border-b-2 border-rose-300 opacity-80"
                      title="Removed in this revision"
                    >
                      <span className="sr-only">[Removed: ]</span>
                      <span className="text-rose-700 font-bold select-none mr-0.5">[-]</span>
                      {item.text}
                    </del>
                  );
                }
                return <span key={idx} className="text-slate-800">{item.text}</span>;
              })}
            </div>
          ) : (
            /* Split View (Two Columns) */
            <div className="grid gap-4 md:grid-cols-2">
              {/* Old Version Column */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  Version {from} (Previous)
                </div>
                <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800">
                  {oldTokens.map((item) => {
                    if (item.op === 'delete') {
                      return (
                        <del
                          key={item.key}
                          className="bg-rose-100 text-rose-950 line-through px-1 py-0.5 rounded-sm mx-0.5"
                        >
                          {item.text}
                        </del>
                      );
                    }
                    return <span key={item.key}>{item.text}</span>;
                  })}
                </div>
              </div>

              {/* New Version Column */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5 text-indigo-500" />
                  Version {to} (Newer)
                </div>
                <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800">
                  {newTokens.map((item) => {
                    if (item.op === 'insert') {
                      return (
                        <ins
                          key={item.key}
                          className="bg-emerald-100 text-emerald-950 font-semibold px-1 py-0.5 rounded-sm mx-0.5 no-underline"
                        >
                          {item.text}
                        </ins>
                      );
                    }
                    return <span key={item.key}>{item.text}</span>;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
          <span>Accessible word-level diff (ops-based per contract v2).</span>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-xs font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
