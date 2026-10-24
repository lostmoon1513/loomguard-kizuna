
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  Send,
  MessageSquare,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';

import {
  createDraft,
  getDemoDrafts,
  getDraft,
  getMockDraft,
  recheckDraft,
  submitDraft,
  actOnIssue,
  getHealth,
  addComment,
  updateDraft,
} from '../api/drafts.js';
import { getBrand } from '../api/brand.js';
import { getErrorMessage } from '../api/client.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import IssueCard from '../components/IssueCard.jsx';
import LoadingState from '../components/LoadingState.jsx';
import HighlightedDraft from '../components/HighlightedDraft.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Studio() {
  const location = useLocation();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [useAi, setUseAi] = useState(true);
  const [draft, setDraft] = useState(null);
  const [brand, setBrand] = useState(null);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sampleNames, setSampleNames] = useState([]);
  const [sampleKey, setSampleKey] = useState('flawed_1');
  const [filter, setFilter] = useState('all');
  const [submitNote, setSubmitNote] = useState('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftEditText, setDraftEditText] = useState('');

  const draftIdFromNav = location.state?.draftId;

  // Fetch brand kit, backend health, and demo samples on mount.
  useEffect(() => {
    let cancelled = false;
    getBrand()
      .then((data) => { if (!cancelled) setBrand(data); })
      .catch(() => {});
    getHealth()
      .then((data) => { if (!cancelled) setHealth(data); })
      .catch(() => {});
    getDemoDrafts()
      .then((data) => { if (!cancelled && data) setSampleNames(Object.keys(data)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load draft when navigated here from ReviewQueue (BUG-5: abort on unmount).
  useEffect(() => {
    if (!draftIdFromNav) return;
    let cancelled = false;
    async function loadDraftFromNavigation() {
      setLoadingDraft(true);
      setError('');
      try {
        const d = await getDraft(draftIdFromNav);
        if (!cancelled) {
          setDraft(d);
          setText(d.text || '');
          setTitle(d.title || '');
          setDraftEditText(d.text || '');
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    }
    loadDraftFromNavigation();
    return () => { cancelled = true; };
  }, [draftIdFromNav]);

  const managerFeedback = useMemo(() => {
    if (!draft) return null;
    const lastChangeDecision = [...(draft.decisions || [])]
      .reverse()
      .find((d) => d.decision === 'request_changes');
    if (lastChangeDecision?.comment) {
      return {
        manager: lastChangeDecision.manager || 'Manager',
        comment: lastChangeDecision.comment,
        created_at: lastChangeDecision.created_at,
      };
    }
    const lastManagerComment = [...(draft.comments || [])]
      .reverse()
      .find((c) => c.role === 'manager');
    if (lastManagerComment?.text) {
      return {
        manager: lastManagerComment.author || 'Manager',
        comment: lastManagerComment.text,
        created_at: lastManagerComment.created_at,
      };
    }
    return null;
  }, [draft]);

  const saveDraftTextAndRecheck = async () => {
    if (!draft?.id || !draftEditText.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateDraft(draft.id, draftEditText.trim(), title);
      setDraft(updated);
      setText(updated.text);
      setIsEditingText(false);
      setNotice('Draft text updated and rechecked against brand kit.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const issues = useMemo(() => draft?.issues || [], [draft?.issues]);

  const filteredIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          filter === 'all' ||
          issue.status === filter ||
          (filter === 'mandatory' &&
            issue.priority === 'mandatory'),
      ),
    [issues, filter],
  );

  const openMandatory = issues.filter(
    (issue) =>
      issue.status === 'open' &&
      issue.priority === 'mandatory',
  ).length;

  const loadSample = async () => {
    setBusy(true);
    setError('');

    try {
      const samples = await getDemoDrafts();
      const sampleText = samples[sampleKey];

      if (!sampleText) {
        throw new Error(
          `The backend did not return the sample '${sampleKey}'.`,
        );
      }

      setText(sampleText);
      setTitle(`${sampleKey.replaceAll('_', ' ')} sample`);
      setFile(null);
      setDraft(null);
      setNotice(
        'Sample text loaded. Select “Check draft” to run the backend checks.',
      );
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const loadMock = async () => {
    setBusy(true);
    setError('');

    try {
      const sample = await getMockDraft();

      setDraft(sample);
      setText(sample.text);
      setTitle(sample.title);
      setNotice(
        'Loaded the fixed mock response. This is a display fixture, not a newly checked draft.',
      );
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const checkDraft = async (event) => {
    event.preventDefault();

    if (!file && text.trim().length < 3) {
      setError(
        'Paste at least 3 characters or choose a supported draft file.',
      );
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const created = await createDraft({
        text,
        file,
        title,
        useAi,
        author: localStorage.getItem('loomguard-user') || 'creator',
      });

      setDraft(created);
      setText(created.text);
      setTitle(created.title);
      setFile(null);
      setNotice(
        'Draft checked by the backend. Review findings and their source citations below.',
      );
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const act = async (issue, payload, label) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const updated = await actOnIssue(
        draft.id,
        issue.id,
        payload,
      );

      setDraft(updated);
      setText(updated.text);
      setNotice(label);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    if (!draft?.id) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const updated = await recheckDraft(draft.id);

      setDraft(updated);
      setText(updated.text);
      setNotice(
        'Recheck completed. Findings now reflect the backend response.',
      );
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!draft?.id) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      if (submitNote.trim()) {
        await addComment(draft.id, submitNote.trim());
        setSubmitNote('');
      }
      const result = await submitDraft(draft.id);
      const updated = await getDraft(draft.id);

      setDraft(updated);
      setNotice(`Draft submitted for review. Current status: ${result.status}.`);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const useMock = draft?.id === 'dr_mock_001';

  return (
    <div className="space-y-6">
      <ErrorMessage
        message={error}
        onDismiss={() => setError('')}
      />

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}

      {health && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              health.status === 'ok'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            Backend: {health.status}
          </span>

          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600">
            Database:{' '}
            {typeof health.database === 'object'
              ? health.database.status ||
                JSON.stringify(health.database)
              : String(health.database ?? 'unknown')}
          </span>

          <span
            className={`rounded-full px-2.5 py-1 ${
              health.gemini_configured
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            Gemini key{' '}
            {health.gemini_configured
              ? 'configured'
              : 'not configured'}
          </span>
        </div>
      )}

      {brand && !brand.ready && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="text-sm text-amber-900">
              No brand kit is loaded
            </strong>

            <p className="mt-1 text-sm text-amber-800">
              Load the demo kit or upload sources before checking a draft.
            </p>
          </div>

          <button
            className="btn-secondary"
            onClick={() => navigate('/brand')}
          >
            Set up brand kit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="eyebrow">Pre-publication check</div>

            <h2 className="mt-2 text-lg font-bold">
              Review content, don’t generate it
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Check claims and wording against approved sources. Every
              finding uses backend-provided text offsets and citations;
              approval remains a human decision.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-4 w-4" />
            Rule checks + optional AI
          </div>
        </div>

        <form onSubmit={checkDraft} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <label className="block text-sm font-semibold">
              Draft title

              <input
                className="field mt-2"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Product launch announcement"
              />
            </label>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-sm font-semibold">
                Try a sample draft
              </div>

              <div className="mt-2 flex gap-2">
                <select
                  className="field min-w-0"
                  value={sampleKey}
                  onChange={(event) => setSampleKey(event.target.value)}
                >
                  {(
                    sampleNames.length
                      ? sampleNames
                      : ['flawed_1', 'flawed_2', 'flawed_3', 'clean']
                  ).map((name) => (
                    <option key={name} value={name}>
                      {name.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={busy}
                  onClick={loadSample}
                >
                  <FlaskConical className="h-4 w-4" />
                  Load
                </button>
              </div>
            </div>
          </div>

          <label className="block text-sm font-semibold">
            Paste draft text

            <textarea
              className="field mt-2 min-h-48 resize-y leading-6"
              value={text}
              onChange={(event) => {
                setText(event.target.value);

                if (file) {
                  setFile(null);
                }
              }}
              placeholder="Paste the draft you want to check…"
            />
          </label>

          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">
                Or upload a draft file
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Backend parser supports .md, .txt, .docx and text-based PDF files.
              </p>

              {file && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-700">
                    Selected: {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-300"
                    title="Remove selected file"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                </div>
              )}
            </div>

            <label className="btn-secondary cursor-pointer">
              <FileUp className="h-4 w-4" />
              Choose file

              <input
                className="hidden"
                type="file"
                accept=".md,.txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] || null;
                  if (chosen && chosen.size > 10 * 1024 * 1024) {
                    setError('File exceeds the 10 MB limit. Please select a smaller file.');
                    event.target.value = '';
                    return;
                  }
                  setFile(chosen);
                  if (chosen) {
                    setText('');
                    setError('');
                  }
                }}
              />
            </label>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(event) => setUseAi(event.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Enable optional AI checks
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={loadMock}
              >
                <ClipboardCheck className="h-4 w-4" />
                Load mock response
              </button>

              <button
                className="btn-primary px-6 py-3 text-base" type="submit"
                disabled={busy || (!file && text.trim().length < 3)}
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Check draft
              </button>
            </div>
          </div>
        </form>
      </section>

      {loadingDraft && (
        <LoadingState label="Loading draft details…" />
      )}

      {draft && !loadingDraft && (
        <>
          {!draft.ai_available && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

              <div>
                <strong>
                  AI checks unavailable. Rule-based checks only.
                </strong>

                <p className="mt-1 text-amber-800">
                  Treat the findings as the available rule-check results;
                  AI-derived checks were not available for this run.
                </p>
              </div>
            </div>
          )}

          {useMock && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
              This is the fixed mock response from the backend, for UI
              verification only. Actions are disabled because it is not a
              stored draft.
            </div>
          )}

          {draft.status === 'CHANGES_REQUESTED' && (
            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base font-bold text-rose-950">
                      Changes Requested by Manager
                    </strong>
                    {managerFeedback?.manager && (
                      <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-900">
                        Reviewer: {managerFeedback.manager}
                      </span>
                    )}
                    {managerFeedback?.created_at && (
                      <span className="text-xs text-rose-600">
                        {new Date(managerFeedback.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {managerFeedback?.comment ? (
                    <div className="mt-2.5 rounded-xl border border-rose-200 bg-white p-3.5">
                      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-rose-950">
                        "{managerFeedback.comment}"
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-rose-800">
                      The manager requested updates on this draft before approval.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-rose-700">
                    Review the requested changes above. You can edit the text directly below or accept phrase fixes, then recheck and submit again.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section className="panel min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">Draft text</div>

                  <h2 className="mt-2 break-words text-lg font-bold">
                    {draft.title}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {draft.text?.length ?? 0} characters · Kit version{' '}
                    {draft.kit_version ?? 'unknown'}
                  </p>
                </div>

                <StatusBadge status={draft.status} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {isEditingText ? 'Editing full draft text' : 'Marked findings in text'}
                </span>
                <button
                  type="button"
                  className="btn-secondary text-xs py-1 px-2.5"
                  disabled={busy || useMock || !['DRAFT', 'CHANGES_REQUESTED'].includes(draft.status)}
                  onClick={() => {
                    setIsEditingText((prev) => !prev);
                    setDraftEditText(draft.text || '');
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditingText ? 'View highlights' : 'Edit text directly'}
                </button>
              </div>

              {isEditingText ? (
                <div className="mt-3 space-y-3">
                  <textarea
                    className="field min-h-56 leading-relaxed"
                    value={draftEditText}
                    onChange={(e) => setDraftEditText(e.target.value)}
                    placeholder="Edit draft text..."
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy || draftEditText.trim().length < 3}
                      onClick={saveDraftTextAndRecheck}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Save edits and recheck
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        setIsEditingText(false);
                        setDraftEditText(draft.text || '');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <HighlightedDraft
                    text={draft.text || ''}
                    issues={issues}
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                  {issues.length} finding{issues.length === 1 ? '' : 's'}
                </span>

                <span className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {openMandatory} open mandatory
                </span>

                <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {issues.filter((issue) =>
                    ['accepted', 'edited'].includes(issue.status),
                  ).length}{' '}
                  resolved before recheck
                </span>
              </div>

              {['DRAFT', 'CHANGES_REQUESTED'].includes(draft.status) && (
                <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <label className="block text-xs font-semibold text-slate-700">
                    Note for reviewer / manager (optional)
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="field flex-1"
                      value={submitNote}
                      onChange={(event) => setSubmitNote(event.target.value)}
                      placeholder="e.g. Addressed requested changes, updated pricing, ready for review..."
                      maxLength={1000}
                    />
                    <button
                      className="btn-primary shrink-0"
                      disabled={
                        busy ||
                        useMock ||
                        openMandatory > 0
                      }
                      onClick={submit}
                    >
                      <Send className="h-4 w-4" />
                      Submit for review
                    </button>
                  </div>
                  {openMandatory > 0 && (
                    <p className="mt-1.5 text-xs text-rose-600 font-medium">
                      Resolve or request an exception for {openMandatory} open mandatory issue{openMandatory === 1 ? '' : 's'} before submitting.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  disabled={
                    busy ||
                    useMock ||
                    !['DRAFT', 'CHANGES_REQUESTED'].includes(draft.status)
                  }
                  onClick={recheck}
                >
                  <RefreshCw className="h-4 w-4" />
                  Recheck draft
                </button>

                {draft.status === 'IN_REVIEW' && (
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      navigate('/manager', {
                        state: { draftId: draft.id },
                      })
                    }
                  >
                    Open manager review
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {(draft.comments || []).length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    Review comments & history ({(draft.comments || []).length})
                  </div>
                  <div className="mt-3 space-y-2 max-h-52 overflow-y-auto">
                    {(draft.comments || []).map((c) => (
                      <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <div className="flex justify-between items-center text-slate-500 mb-1">
                          <strong className="text-slate-800">
                            {c.author || 'Reviewer'}
                            <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              c.role === 'manager' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {c.role || 'user'}
                            </span>
                          </strong>
                          <span>{c.created_at ? new Date(c.created_at).toLocaleTimeString() : ''}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-slate-700">{c.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="min-w-0">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="eyebrow">Findings & evidence</div>
                  <h2 className="mt-1 text-lg font-bold">
                    Review findings
                  </h2>
                </div>

                <select
                  className="field sm:max-w-52 font-medium"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All findings</option>
                  <option value="open">Open</option>
                  <option value="accepted">Accepted</option>
                  <option value="edited">Edited</option>
                  <option value="exception_requested">
                    Exception requested
                  </option>
                  <option value="mandatory">Mandatory only</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredIssues.map((issue) => (
                  <IssueCard
                    key={`${issue.id}_${issue.quote}_${issue.start}`}
                    issue={issue}
                    disabled={
                      busy ||
                      useMock ||
                      !['DRAFT', 'CHANGES_REQUESTED'].includes(
                        draft.status,
                      )
                    }
                    onAccept={(item, chosenFix) =>
                      act(
                        item,
                        {
                          action: 'accept',
                          chosen_fix: chosenFix,
                        },
                        'Fix accepted and checks rerun.',
                      )
                    }
                    onEdit={(item, newText) =>
                      act(
                        item,
                        {
                          action: 'edit',
                          new_text: newText,
                        },
                        'Phrase updated and checks rerun.',
                      )
                    }
                    onException={(item, note) =>
                      act(
                        item,
                        {
                          action: 'request_exception',
                          note,
                        },
                        'Exception request recorded.',
                      )
                    }
                  />
                ))}

                {filteredIssues.length === 0 && (
                  <div className="panel p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />

                    <h3 className="mt-3 font-semibold">
                      No findings in this view
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      The selected filter has no matching issues.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
