
import { useCallback, useEffect, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  addComment,
  decideDraft,
  getDraft,
  getDrafts,
} from '../api/drafts.js';
import { getErrorMessage } from '../api/client.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingState from '../components/LoadingState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import HighlightedDraft from '../components/HighlightedDraft.jsx';
import ImageViewer from '../components/ImageViewer.jsx';
import WaiverPanel from '../components/WaiverPanel.jsx';
import CommentThread from '../components/CommentThread.jsx';
import AuditList from '../components/AuditList.jsx';
import MaskingPanel from '../components/MaskingPanel.jsx';
import { grantOrDenyWaiver, getDraftImageBlobUrl } from '../api/drafts.js';

export default function ManagerReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role = 'creator' } = useOutletContext() || {};

  const [rows, setRows] = useState([]);
  const [draftId, setDraftId] = useState(
    location.state?.draftId || '',
  );
  const [draft, setDraft] = useState(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [managerImageUrl, setManagerImageUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let url = null;

    async function loadImg() {
      if (!draft?.id || (draft.kind !== 'image' && !draft.image)) {
        setManagerImageUrl((prev) => (prev !== null ? null : prev));
        return;
      }

      try {
        const b = await getDraftImageBlobUrl(draft.id, null, false);
        if (!cancelled && b) {
          url = b;
          setManagerImageUrl(b);
        }
      } catch (err) { void err; }
    }

    loadImg();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft?.id, draft?.revision, draft?.kind, draft?.image]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRows = useCallback(async () => {
    try {
      const data = await getDrafts('IN_REVIEW');

      setRows(data);

      setDraftId((prev) => prev || (data.length ? data[0].id : ''));
    } catch (error) {
      if (error?.response?.data?.error?.code === 'PENDING_EXCEPTIONS') {
        setError('Cannot approve: There are undecided exception requests that must be granted or denied first.');
      } else if (error?.response?.data?.error?.code === 'OPEN_MANDATORY_ISSUES') {
        setError('Cannot approve: Mandatory issues remain open that have not been fixed or granted a waiver.');
      } else {
        setError(getErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDraft(null);
      return;
    }

    try {
      setDraft(await getDraft(id));
    } catch (error) {
      setError(getErrorMessage(error));
      setDraft(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadReviewRows() {
      await loadRows();
    }
    if (!cancelled) loadReviewRows();
    return () => { cancelled = true; };
  }, [loadRows]);

  useEffect(() => {
    let cancelled = false;
    async function loadReviewDetail() {
      if (!cancelled) await loadDetail(draftId);
    }
    loadReviewDetail();
    return () => { cancelled = true; };
  }, [draftId, loadDetail]);

  const creatorNote = (draft?.comments || [])
    .slice()
    .reverse()
    .find((c) => c.role === 'creator' || (c.author && c.author !== 'manager')) || null;

  const exceptionIssues = (draft?.issues || []).filter(
    (issue) => issue.status === 'exception_requested' || Boolean(issue.exception_note),
  );

  const otherIssues = (draft?.issues || []).filter(
    (issue) => issue.status !== 'exception_requested' && !issue.exception_note,
  );

  const refresh = async () => {
    setLoading(true);
    await loadRows();
    await loadDetail(draftId);
    setLoading(false);
  };

  const handleWaiverDecided = async (issueId, decision, reason) => {
    if (!draft?.id) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const updated = await grantOrDenyWaiver(draft.id, issueId, decision, reason);
      setDraft(updated);
      setNotice(`Waiver ${decision === 'grant' ? 'granted' : 'denied'} for issue.`);
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAddCommentWithReply = async (text, parentId) => {
    if (!draft?.id) return;
    setBusy(true);
    setError('');

    try {
      const updated = await addComment(draft.id, text, undefined, parentId);
      setDraft(updated);
      setNotice(parentId ? 'Reply posted.' : 'Comment added.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };



  const decide = async (decision) => {
    if (!draft) {
      return;
    }

    if (
      decision === 'request_changes' &&
      !decisionComment.trim()
    ) {
      setError('Add a comment explaining the requested changes.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await decideDraft(
        draft.id,
        decision,
        decisionComment.trim(),
      );

      setNotice(
        `Decision recorded. Draft status: ${result.status}.`,
      );
      setDecisionComment('');

      await loadDetail(draft.id);
      await loadRows();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorMessage
        message={error}
        onDismiss={() => setError('')}
      />

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {role === 'reviewer' && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>Compliance Reviewer View</strong>
            <p className="mt-1">
              You can review findings, add comments/replies, and grant waivers for CLAIM issues. Final approval and change requests are restricted to Managers.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold">Awaiting decision</h2>
              <p className="mt-1 text-xs text-slate-500">
                Drafts in IN_REVIEW
              </p>
            </div>

            <button
              className="rounded-lg border border-slate-200 p-2 text-slate-500"
              onClick={refresh}
              aria-label="Refresh manager queue"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : (
            <div className="mt-4 space-y-2">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setDraftId(row.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    draftId === row.id
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-800">
                    {row.title}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {row.id} · {row.open_issues} open issues
                  </div>
                </button>
              ))}

              {rows.length === 0 && (
                <div className="rounded-xl bg-slate-50 p-5 text-center">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" />

                  <p className="mt-2 text-sm font-semibold">
                    Queue is clear
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    No drafts currently await a manager decision.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="min-w-0">
          {!draft ? (
            <div className="panel p-8 text-center">
              <ShieldCheck className="mx-auto h-9 w-9 text-slate-300" />

              <h2 className="mt-3 font-semibold">
                Select a submitted draft
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose a draft from the queue to review its content and
                comments.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="panel p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">Manager decision</div>

                    <h2 className="mt-2 break-words text-lg font-bold">
                      {draft.title}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {draft.id} · Author: {draft.author || 'Unknown'}
                    </p>
                  </div>

                  <StatusBadge status={draft.status} />
                </div>

                {creatorNote && (
                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-indigo-600" />
                        <span>Creator's Note ({creatorNote.author || 'Creator'})</span>
                      </div>
                      <span className="text-indigo-600/75 text-[11px]">
                        {creatorNote.created_at ? new Date(creatorNote.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-indigo-950 font-medium">
                      "{creatorNote.text}"
                    </p>
                  </div>
                )}

                <div className="mt-5 rounded-xl border border-slate-200 p-4">
                  {draft.kind === 'image' || Boolean(draft.image) ? (
                    <ImageViewer
                      imageUrl={managerImageUrl}
                      issues={draft.issues || []}
                      imageMeta={draft.image}
                    />
                  ) : (
                    <HighlightedDraft
                      text={draft.text || ''}
                      issues={draft.issues || []}
                    />
                  )}
                </div>

                {/* Masking Disclosure Panel (P5 / contract_v2 §8) */}
                <div className="mt-4">
                  <MaskingPanel
                    maskSummary={draft.mask_summary}
                    draftKind={draft.kind}
                    checks={draft.checks}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-lg bg-slate-100 px-3 py-2">
                    {draft.issues?.length || 0} current findings
                  </span>

                  <span className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">
                    {draft.issues?.filter(
                      (issue) =>
                        issue.status === 'open' &&
                        issue.priority === 'mandatory',
                    ).length || 0}{' '}
                    open mandatory
                  </span>

                  {exceptionIssues.length > 0 && (
                    <span className="rounded-lg bg-violet-100 px-3 py-2 font-bold text-violet-800">
                      {exceptionIssues.length} exception{exceptionIssues.length === 1 ? '' : 's'} requested
                    </span>
                  )}
                </div>

                {/* Requested Exceptions Section */}
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-violet-600" />
                      <h3 className="font-bold text-slate-900">
                        Requested Exceptions & Explanatory Notes ({exceptionIssues.length})
                      </h3>
                    </div>
                    {exceptionIssues.length > 0 ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                        Human review needed
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        No exceptions requested
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Review each creator justification and explanatory note below before deciding to approve or request changes.
                  </p>

                  {exceptionIssues.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {exceptionIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="rounded-xl border-2 border-violet-300 bg-violet-50/40 p-4 shadow-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-violet-700 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                              Exception Requested
                            </span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                              {issue.category}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                issue.priority === 'mandatory'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {issue.priority || 'advisory'}
                            </span>
                            {issue.citation && (
                              <div className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500">
                                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                                <span>
                                  {issue.citation.doc} · {issue.citation.ref}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 font-mono text-sm text-slate-900">
                            “{issue.quote}”
                          </div>

                          <p className="mt-2 text-xs leading-relaxed text-slate-600">
                            <strong className="text-slate-800">Rule finding:</strong> {issue.reason}
                          </p>

                          {/* Prominent Creator Explanatory Note Callout */}
                          <div className="mt-3 rounded-xl border border-violet-300 bg-white p-3.5 shadow-xs">
                            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-900">
                              <MessageSquare className="h-4 w-4 text-violet-600" />
                              Creator's Explanatory Note / Reason for Exception:
                            </div>
                            <p className="mt-1.5 text-sm font-semibold leading-relaxed text-violet-950 whitespace-pre-wrap">
                              "{issue.exception_note || 'No explanatory note provided.'}"
                            </p>
                          </div>

                          {/* Waiver Decision Action Form (P3 / contract_v2) */}
                          <WaiverPanel
                            draftId={draft.id}
                            issue={issue}
                            draftStatus={draft.status}
                            onWaiverDecided={handleWaiverDecided}
                            disabled={busy}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {otherIssues.length > 0 && (
                    <div className="mt-5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Other Findings ({otherIssues.length})
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {otherIssues.map((issue) => (
                          <div
                            key={issue.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <StatusBadge status={issue.status} />
                              <span className="font-semibold text-slate-800">{issue.category}</span>
                              <span className="font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                                “{issue.quote}”
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1">{issue.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Threaded Discussion (P3 / contract_v2) */}
              <div className="panel p-5 sm:p-6">
                <CommentThread
                  comments={draft.comments || []}
                  onAddComment={handleAddCommentWithReply}
                  disabled={busy}
                />
              </div>

              {/* Draft Audit Trail (P3 / contract_v2) */}
              <div className="panel p-5 sm:p-6">
                <AuditList auditEvents={draft.audit || []} />
              </div>

              {draft.status === 'IN_REVIEW' ? (
                <div className="panel p-5 sm:p-6">
                  <h3 className="font-bold">Record decision</h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Approval is always a human decision. Requesting changes
                    requires a clear comment.
                  </p>

                  <textarea
                    className="field mt-4 min-h-24"
                    value={decisionComment}
                    onChange={(event) =>
                      setDecisionComment(event.target.value)
                    }
                    placeholder="Optional approval note, or explain requested changes…"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      disabled={busy || role !== 'manager'}
                      onClick={() => decide('approve')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve draft
                    </button>

                    <button
                      className="btn-secondary"
                      disabled={
                        busy ||
                        role !== 'manager' ||
                        decisionComment.trim().length === 0
                      }
                      onClick={() => decide('request_changes')}
                    >
                      <XCircle className="h-4 w-4" />
                      Request changes
                    </button>

                    <button
                      className="btn-secondary"
                      onClick={() =>
                        navigate(`/drafts/${draft.id}`, {
                          state: { draftId: draft.id },
                        })
                      }
                    >
                      Open in Studio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel p-5">
                  <p className="text-sm text-slate-600">
                    This draft is no longer awaiting a decision. Current
                    status: <strong>{draft.status}</strong>.
                  </p>

                  <button
                    className="btn-secondary mt-3"
                    onClick={() =>
                      navigate(`/drafts/${draft.id}`, {
                        state: { draftId: draft.id },
                      })
                    }
                  >
                    Open draft in Studio
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
