import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Pencil,
  ShieldAlert,
  X,
} from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

const severityBorderClass = {
  high: 'border-l-rose-500',
  medium: 'border-l-amber-400',
  low: 'border-l-sky-400',
};

const severityBadgeClass = {
  high: 'bg-rose-100 text-rose-700 border border-rose-200',
  medium: 'bg-amber-100 text-amber-800 border border-amber-200',
  low: 'bg-sky-100 text-sky-700 border border-sky-200',
};

export default function IssueCard({
  issue,
  disabled = false,
  onAccept,
  onEdit,
  onException,
}) {
  const [mode, setMode] = useState('');
  const [prevQuote, setPrevQuote] = useState(issue.quote);
  const [editText, setEditText] = useState(issue.quote || '');
  const [note, setNote] = useState(issue.exception_note || '');
  const [fix, setFix] = useState(
    issue.suggested_fixes?.[0] || '',
  );

  if (prevQuote !== issue.quote) {
    setPrevQuote(issue.quote);
    setEditText(issue.quote || '');
  }

  // Always derive activeFix so it is GUARANTEED to be a valid member of current issue.suggested_fixes
  const activeFix = issue.suggested_fixes?.includes(fix)
    ? fix
    : (issue.suggested_fixes?.[0] || '');

  const isAI = issue.source?.includes('gemini');
  const canAct = !disabled && ['open', 'exception_requested'].includes(issue.status);
  const severity = issue.severity || 'low';

  return (
    <article
      className={`rounded-xl border border-slate-200 bg-white border-l-4 ${
        severityBorderClass[severity] || severityBorderClass.low
      } overflow-hidden shadow-sm shadow-slate-100/60 transition-shadow hover:shadow-md hover:shadow-slate-100`}
    >
      <div className="p-4">
        {/* Badge row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
              severityBadgeClass[severity] || severityBadgeClass.low
            }`}
          >
            {severity} severity
          </span>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
            {issue.category}
          </span>

          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
            {isAI ? 'AI-assisted' : 'Rule-based'}
          </span>

          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              issue.priority === 'mandatory'
                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {issue.priority || 'advisory'}
          </span>

          <div className="ml-auto">
            <StatusBadge status={issue.status} />
          </div>
        </div>

        {/* Quote block */}
        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
          <p className="font-mono text-sm text-slate-700 leading-relaxed">
            &ldquo;{issue.quote}&rdquo;
          </p>
        </div>

        {/* Reason */}
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {issue.reason}
        </p>

        {issue.claim_status && (
          <p className="mt-2 text-xs font-semibold text-slate-700">
            Claim status: <span className="font-bold">{issue.claim_status}</span>{' '}
            <span className="font-normal text-slate-500">
              (claims without evidence are unverified, not automatically false)
            </span>
          </p>
        )}

        {issue.needs_review && (
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-800">
            <ShieldAlert className="h-4 w-4" />
            Needs human review
          </p>
        )}

        {/* Citation chip */}
        {issue.citation && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 cursor-default">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-500" />

            <span>
              <strong className="text-indigo-900">
                {issue.citation.doc}
              </strong>
              {' · '}
              {issue.citation.ref}
              {issue.citation.rule_id
                ? ` · ${issue.citation.rule_id}`
                : ''}
            </span>
          </div>
        )}

        {issue.exception_note && (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-900">
            <div className="flex items-center gap-1.5 font-bold text-violet-800">
              <AlertTriangle className="h-3.5 w-3.5 text-violet-600" />
              <span>Exception requested with explanatory note:</span>
            </div>
            <p className="mt-1 text-slate-700 italic">"{issue.exception_note}"</p>
          </div>
        )}

        {canAct && (
          <div className="mt-4 space-y-3">
            {issue.suggested_fixes?.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Suggested phrase-level fix
                </label>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="field min-w-0 flex-1"
                    value={activeFix}
                    onChange={(event) => setFix(event.target.value)}
                    disabled={disabled}
                  >
                    {issue.suggested_fixes.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <button
                    className="btn-secondary"
                    disabled={disabled || !activeFix}
                    onClick={() => onAccept(issue, activeFix)}
                  >
                    <Check className="h-4 w-4" />
                    Accept fix
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                className={`btn-secondary ${mode === 'edit' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : ''}`}
                disabled={disabled}
                onClick={() => {
                  if (mode !== 'edit') setEditText(issue.quote || '');
                  setMode(mode === 'edit' ? '' : 'edit');
                }}
              >
                <Pencil className="h-4 w-4" />
                {mode === 'edit' ? 'Cancel edit' : 'Update phrase in card'}
              </button>

              <button
                className={`btn-secondary ${mode === 'exception' ? 'border-violet-400 bg-violet-50 text-violet-700' : ''}`}
                disabled={disabled}
                onClick={() => {
                  if (mode !== 'exception') setNote(issue.exception_note || '');
                  setMode(mode === 'exception' ? '' : 'exception');
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                {issue.status === 'exception_requested' ? 'Update exception note' : 'Request exception'}
              </button>
            </div>

            {mode === 'edit' && (
              <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                <label className="text-xs font-semibold text-indigo-900">
                  Replacement phrase (updates this phrase in the draft text and reruns checks):
                </label>

                <input
                  className="field bg-white"
                  maxLength={300}
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  placeholder="Enter replacement phrase..."
                />

                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    disabled={
                      disabled ||
                      !editText.trim() ||
                      editText.includes('\n')
                    }
                    onClick={() => {
                      onEdit(issue, editText.trim());
                      setMode('');
                    }}
                  >
                    Save phrase & recheck
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setMode('')}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mode === 'exception' && (
              <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                <label className="text-xs font-semibold text-violet-900">
                  Explain why this phrase should be allowed:
                </label>

                <textarea
                  className="field min-h-20 bg-white"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Provide a reason (at least 3 characters) for the manager to review..."
                />

                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    disabled={disabled || note.trim().length < 3}
                    onClick={() => {
                      onException(issue, note.trim());
                      setMode('');
                    }}
                  >
                    {issue.status === 'exception_requested' ? 'Save updated exception note' : 'Send exception request'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setMode('')}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
