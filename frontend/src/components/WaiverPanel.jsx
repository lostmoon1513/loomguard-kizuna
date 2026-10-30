import { useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle, AlertCircle, LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';

/**
 * WaiverPanel component adhering to contract_v2:
 * POST /api/drafts/{id}/issues/{iid}/waiver
 * Body: { decision: "grant" | "deny", reason: string (3+ chars) }
 * Roles: Manager (any issue), Reviewer (CLAIM category issues only)
 * Condition: Only while draft is IN_REVIEW
 */
export default function WaiverPanel({
  draftId: _draftId,
  issue,
  draftStatus,
  onWaiverDecided,
  disabled = false,
}) {
  const { role } = useAuth();
  const [decision, setDecision] = useState('grant'); // 'grant' | 'deny'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // If issue is already waived or denied, show the record
  if (issue.waiver?.state || issue.status === 'waived') {
    const isGranted = issue.waiver?.state === 'granted' || issue.status === 'waived';
    return (
      <div
        className={`mt-3 rounded-xl border p-3.5 text-xs ${
          isGranted
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
            : 'border-rose-200 bg-rose-50/70 text-rose-950'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
            {isGranted ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600" />
            )}
            <span>Waiver {isGranted ? 'Granted' : 'Denied'}</span>
          </div>
          {issue.waiver?.by && (
            <span className="text-[10px] text-slate-500 font-medium">
              By: {issue.waiver.by} ({issue.waiver.role || 'manager'})
              {issue.waiver.at && ` · ${new Date(issue.waiver.at).toLocaleDateString()}`}
            </span>
          )}
        </div>
        {issue.waiver?.reason && (
          <p className="mt-1.5 font-medium leading-relaxed">
            "{issue.waiver.reason}"
          </p>
        )}
      </div>
    );
  }

  // Can this user decide waivers?
  const isManager = role === 'manager';
  const isReviewerClaim = role === 'reviewer' && issue.category === 'CLAIM';
  const canDecideWaiver = isManager || isReviewerClaim;
  const isDraftInReview = draftStatus === 'IN_REVIEW';

  // If user cannot decide waiver or not in review, show note only
  if (!canDecideWaiver || !isDraftInReview) {
    if (issue.status === 'exception_requested') {
      return (
        <div className="mt-2 text-xs text-violet-700 font-medium flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            {!isDraftInReview
              ? 'Waivers can be granted once the draft is submitted for review.'
              : role === 'reviewer'
              ? 'Reviewers can only waive CLAIM category issues (Manager approval needed).'
              : 'Awaiting manager or reviewer waiver decision.'}
          </span>
        </div>
      );
    }
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError('Please provide a specific waiver reason (at least 3 characters).');
      return;
    }

    setBusy(true);
    setError('');

    try {
      if (onWaiverDecided) {
        await onWaiverDecided(issue.id, decision, reason.trim());
        setIsOpen(false);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
      {!isOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-violet-900 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-violet-600" />
            <span>Exception Requested — Decision Required</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            disabled={disabled}
            className="btn-primary text-xs py-1 px-3 bg-violet-700 hover:bg-violet-800"
          >
            Grant / Deny Waiver
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-bold text-slate-800">
              Waiver Decision ({role === 'reviewer' ? 'Compliance Reviewer' : 'Manager'})
            </strong>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-medium"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded-lg border border-rose-200">
              {error}
            </div>
          )}

          {/* Decision Radios */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <label className="flex items-center gap-1.5 cursor-pointer text-emerald-800">
              <input
                type="radio"
                name={`waiver-decision-${issue.id}`}
                value="grant"
                checked={decision === 'grant'}
                onChange={() => setDecision('grant')}
                className="accent-emerald-600"
              />
              <span>Grant Waiver (waive issue)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-rose-800">
              <input
                type="radio"
                name={`waiver-decision-${issue.id}`}
                value="deny"
                checked={decision === 'deny'}
                onChange={() => setDecision('deny')}
                className="accent-rose-600"
              />
              <span>Deny (keep mandatory)</span>
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Required decision reason (min 3 chars):
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision === 'grant'
                  ? 'e.g. Legal counsel approved this specific wording for Q4 campaign.'
                  : 'e.g. Brand guideline strictly prohibits superlative claims without source.'
              }
              className="field text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-secondary text-xs py-1 px-2.5"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || reason.trim().length < 3}
              className={`btn-primary text-xs py-1 px-3 ${
                decision === 'deny'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : decision === 'grant' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              <span>{decision === 'grant' ? 'Confirm Grant' : 'Confirm Deny'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
