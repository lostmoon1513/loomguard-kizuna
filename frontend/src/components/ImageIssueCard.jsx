import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Info,
  Palette,
} from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import WaiverPanel from './WaiverPanel.jsx';

/**
 * ImageIssueCard component for displaying visual findings:
 * - ACCESSIBILITY: WCAG 2.1 AA Contrast ratio, foreground/background colours, required ratio.
 * - COLOUR: K-Means palette match, nearest brand colour, Delta-E 2000 distance.
 * - LAYOUT / SECURITY.
 * Per contract_v2 §8: Pixel fixes cannot be directly applied via patch (422 FIX_BY_REUPLOAD).
 */
export default function ImageIssueCard({
  issue,
  index = 0,
  isSelected = false,
  onSelect,
  draftId,
  draftStatus,
  onWaiverDecided,
  onRequestException,
  disabled = false,
}) {
  const [isExceptionOpen, setIsExceptionOpen] = useState(false);
  const [exceptionNote, setExceptionNote] = useState(issue.exception_note || '');

  const measurement = issue.measurement || {};
  const isAccessibility = issue.category === 'ACCESSIBILITY' || measurement.kind === 'contrast';
  const isColour = issue.category === 'COLOUR' || measurement.kind === 'palette';

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border p-4 transition-all cursor-pointer ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50/20 ring-2 ring-indigo-200 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
      }`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Box pin indicator */}
          <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            {index + 1}
          </span>

          <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
            {issue.category}
          </span>

          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              issue.priority === 'mandatory'
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {issue.priority || 'advisory'}
          </span>
        </div>

        <StatusBadge status={issue.status} />
      </div>

      {/* Reason description */}
      <p className="text-xs text-slate-700 font-medium leading-relaxed mt-1">
        {issue.reason}
      </p>

      {/* Measurement Metrics Cards (contract_v2 §8) */}
      {isAccessibility && measurement.ratio !== undefined && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-rose-950">
            <span>WCAG 2.1 AA Contrast Ratio:</span>
            <span className="text-sm font-mono text-rose-700">
              {measurement.ratio}:1{' '}
              <span className="text-xs font-normal text-slate-500">
                (needs {measurement.required || '4.5'}:1)
              </span>
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-600">
            {measurement.foreground && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-2xs"
                  style={{ backgroundColor: measurement.foreground }}
                />
                Text: <span className="font-mono">{measurement.foreground}</span>
              </span>
            )}

            {measurement.background && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-2xs"
                  style={{ backgroundColor: measurement.background }}
                />
                Bg: <span className="font-mono">{measurement.background}</span>
              </span>
            )}
          </div>

          {issue.suggested_fixes?.[0] && (
            <div className="pt-2 border-t border-rose-200/60 text-[11px] text-emerald-900 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                Recommended fix: Use passing same-hue shade{' '}
                <span className="font-mono font-bold text-emerald-800">
                  {issue.suggested_fixes[0]}
                </span>{' '}
                in your design editor.
              </span>
            </div>
          )}
        </div>
      )}

      {isColour && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-amber-950">
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-amber-600" />
              <span>Brand Palette Delta-E Check:</span>
            </span>
            {measurement.delta_e00 !== undefined && (
              <span className="font-mono text-amber-800">
                ΔE: {measurement.delta_e00}{' '}
                <span className="text-[10px] text-slate-500 font-normal">
                  (threshold: {measurement.match_threshold || 12})
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            {measurement.colour && (
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-2xs"
                  style={{ backgroundColor: measurement.colour }}
                />
                Detected: <span className="font-mono">{measurement.colour}</span>
              </span>
            )}

            {measurement.nearest_brand && (
              <span className="flex items-center gap-1.5 text-indigo-950 font-semibold">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300 shadow-2xs"
                  style={{ backgroundColor: measurement.nearest_brand }}
                />
                Nearest Brand: <span className="font-mono">{measurement.nearest_brand}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Citation info */}
      {issue.citation && (
        <div className="mt-2.5 flex items-center gap-1 text-[11px] text-indigo-700">
          <BookOpen className="h-3 w-3" />
          <span>
            {issue.citation.doc} · {issue.citation.ref}
          </span>
        </div>
      )}

      {/* Pixel Fix Limitation Notice per contract_v2 §8 */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          Pixel findings cannot be rewritten in place. Update this graphic in your design tool and upload a new revision, or request an exception below.
        </span>
      </div>

      {/* Exception note callout */}
      {issue.exception_note && (
        <div className="mt-2.5 rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-xs text-violet-900">
          <strong className="block text-[10px] uppercase font-bold text-violet-800">
            Creator's Exception Request:
          </strong>
          <span className="italic mt-0.5 block">"{issue.exception_note}"</span>
        </div>
      )}

      {/* Request Exception Button / Form */}
      {['DRAFT', 'CHANGES_REQUESTED'].includes(draftStatus) && !issue.waiver?.state && (
        <div className="mt-3">
          {!isExceptionOpen ? (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                setIsExceptionOpen(true);
              }}
              className="btn-secondary text-[11px] py-1 px-2.5 text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>{issue.status === 'exception_requested' ? 'Update exception note' : 'Request exception'}</span>
            </button>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs"
            >
              <label className="font-semibold text-violet-900 block">
                Explain why this visual exception should be allowed:
              </label>
              <textarea
                rows={2}
                value={exceptionNote}
                onChange={(e) => setExceptionNote(e.target.value)}
                placeholder="e.g. Approved seasonal palette accent for holiday campaign."
                className="field text-xs"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsExceptionOpen(false)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={disabled || exceptionNote.trim().length < 3}
                  onClick={() => {
                    onRequestException && onRequestException(issue, exceptionNote.trim());
                    setIsExceptionOpen(false);
                  }}
                  className="btn-primary text-xs py-1 px-2.5 bg-violet-700 hover:bg-violet-800"
                >
                  Submit exception request
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Waiver decision panel if draft is in review */}
      <WaiverPanel
        draftId={draftId}
        issue={issue}
        draftStatus={draftStatus}
        onWaiverDecided={onWaiverDecided}
        disabled={disabled}
      />
    </div>
  );
}
