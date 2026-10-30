
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  Pencil,
  Sparkles,
  X,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  History,
  Upload,
  Image as ImageIcon,
  Palette,
  FileText,
} from 'lucide-react';

import {
  createDraft,
  createImageDraft,
  getDraftImageBlobUrl,
  getDemoDrafts,
  getDraft,
  getMockDraft,
  recheckDraft,
  submitDraft,
  actOnIssue,
  getHealth,
  addComment,
  updateDraft,
  getVersions,
  getVersionText,
  getDiff,
  uploadRevision,
} from '../api/drafts.js';
import ImageUploadZone from '../components/ImageUploadZone.jsx';
import ImageViewer from '../components/ImageViewer.jsx';
import ImageIssueCard from '../components/ImageIssueCard.jsx';
import ImageDiffViewer from '../components/ImageDiffViewer.jsx';
import VersionTimeline from '../components/VersionTimeline.jsx';
import DiffViewer from '../components/DiffViewer.jsx';
import CommentThread from '../components/CommentThread.jsx';
import AuditList from '../components/AuditList.jsx';
import MaskingPanel from '../components/MaskingPanel.jsx';
import StartHereCard from '../components/StartHereCard.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import { grantOrDenyWaiver } from '../api/drafts.js';
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
  const [versionsList, setVersionsList] = useState([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [diffModalData, setDiffModalData] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionText, setRevisionText] = useState('');
  const [revisionFile, setRevisionFile] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [draftType, setDraftType] = useState('text');
  const [draftImageUrl, setDraftImageUrl] = useState(null);
  const [activeIssueId, setActiveIssueId] = useState(null);
  const [imageDiffModalData, setImageDiffModalData] = useState(null);

  const { id: draftIdFromParam } = useParams();
  const draftIdFromNav = location.state?.draftId;
  const effectiveDraftId = draftIdFromNav || draftIdFromParam;

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

  const isImageDraft = draft?.kind === 'image' || Boolean(draft?.image);

  // Fetch authenticated image blob for image drafts (P4 / contract_v2 §8)
  useEffect(() => {
    let cancelled = false;
    let url = null;

    async function loadImg() {
      if (!draft?.id || (draft.kind !== 'image' && !draft.image)) {
        setDraftImageUrl((prev) => (prev !== null ? null : prev));
        return;
      }

      try {
        const blobUrl = await getDraftImageBlobUrl(draft.id, null, false);
        if (!cancelled && blobUrl) {
          url = blobUrl;
          setDraftImageUrl(blobUrl);
        }
      } catch (err) {
        void err;
      }
    }

    loadImg();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft?.id, draft?.revision, draft?.kind, draft?.image]);

  const handleCheckImage = async ({ file: imgFile, title: imgTitle, useAi: imgUseAi }) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const created = await createImageDraft({
        file: imgFile,
        title: imgTitle,
        useAi: imgUseAi,
      });

      setDraft(created);
      setText(created.text || '');
      setTitle(created.title || imgFile.name);
      setNotice('Image draft checked by the backend. Review brand palette and visual findings below.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

    // Load draft when navigated here from ReviewQueue or via /drafts/:id deep link (H10).
  useEffect(() => {
    if (!effectiveDraftId) return;
    let cancelled = false;
    async function loadDraftFromNavigation() {
      setLoadingDraft(true);
      setError('');
      try {
        const d = await getDraft(effectiveDraftId);
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
  }, [effectiveDraftId]);


  // Sync and fetch draft version history (P2 / contract_v2)
  useEffect(() => {
    if (!draft?.id) return;

    let cancelled = false;
    async function fetchVersions() {
      try {
        const v = await getVersions(draft.id);
        if (!cancelled && Array.isArray(v) && v.length > 0) {
          setVersionsList(v);
          return;
        }
      } catch (err) { void err; }

      if (!cancelled) {
        if (Array.isArray(draft.versions) && draft.versions.length > 0) {
          setVersionsList(draft.versions);
        } else {
          setVersionsList([
            {
              n: 1,
              author: draft.author || 'creator',
              role: 'creator',
              at: draft.created_at || new Date().toISOString(),
              note: 'Initial draft',
              counts: {
                total: draft.issues?.length || 0,
                open_mandatory: (draft.issues || []).filter(
                  (i) => i.status === 'open' && i.priority === 'mandatory'
                ).length,
              },
              chars: draft.text?.length || 0,
            },
          ]);
        }
      }
    }

    fetchVersions();
    return () => { cancelled = true; };
  }, [draft]);

  const openDiff = async (fromVer, toVer) => {
    setDiffLoading(true);
    setDiffModalData({ from: fromVer, to: toVer, ops: [], stats: null });
    try {
      let oldText = '';
      let newText = draft.text || '';
      try {
        const vOld = await getVersionText(draft.id, fromVer);
        if (vOld?.text) oldText = vOld.text;
        const vNew = await getVersionText(draft.id, toVer);
        if (vNew?.text) newText = vNew.text;
      } catch (err) { void err; }

      const diffResult = await getDiff(draft.id, fromVer, toVer, oldText, newText);
      setDiffModalData(diffResult);
    } catch (err) {
      setError(getErrorMessage(err));
      setDiffModalData(null);
    } finally {
      setDiffLoading(false);
    }
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
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAddCommentWithReply = async (commentText, parentId) => {
    if (!draft?.id) return;
    setBusy(true);
    setError('');

    try {
      const updated = await addComment(draft.id, commentText, undefined, parentId);
      setDraft(updated);
      setNotice(parentId ? 'Reply posted.' : 'Comment added.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUploadRevision = async (e) => {
    e?.preventDefault();
    if (!draft?.id) return;
    if (!revisionFile && revisionText.trim().length < 3) {
      setError('Please provide revised text or choose a supported file.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const updated = await uploadRevision(draft.id, {
        text: revisionFile ? undefined : revisionText.trim(),
        file: revisionFile,
        note: revisionNote.trim() || undefined,
      });

      setDraft(updated);
      setText(updated.text);
      setDraftEditText(updated.text);
      setIsRevisionModalOpen(false);
      setRevisionFile(null);
      setRevisionText('');
      setRevisionNote('');
      setNotice(`Revision uploaded successfully as Version ${updated.revision || 'new'}. Findings updated.`);

      if (Array.isArray(updated.versions) && updated.versions.length) {
        setVersionsList(updated.versions);
      } else {
        const v = await getVersions(draft.id);
        if (v) setVersionsList(v);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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

  const handleLoadSampleBanner = () => {
    setDraftType('image');
    // Pre-populate sample graphic banner name
    setTitle('Aurora Product Launch Banner (1200x630)');
    setNotice('Switched to Graphic Banner mode. Select or drop a banner image to inspect color palette, WCAG contrast, and logo placement.');
  };

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
        draft.revision,
      );

      setDraft(updated);
      setText(updated.text);
      setNotice(label);
    } catch (error) {
      if (error?.response?.status === 409) {
        const msg = getErrorMessage(error);
        setError(`${msg} Reloading latest version...`);
        try {
          const fresh = await getDraft(draft.id);
          setDraft(fresh);
          setText(fresh.text);
        } catch (err) { void err; }
      } else {
        setError(getErrorMessage(error));
      }
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

      {/* Quickstart Onboarding Card (P7 / ROUND3_HANDOFF) */}
      <StartHereCard
        onLoadSampleText={loadSample}
        onLoadSampleBanner={handleLoadSampleBanner}
        onKitLoaded={async () => {
          try {
            const b = await getBrand();
            setBrand(b);
            setNotice('Aurora Demo Brand Kit loaded successfully.');
          } catch (err) { void err; }
        }}
      />

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

        {/* Draft Type Switcher (Document/Text vs Banner Image) */}
        <div className="mt-5 flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => setDraftType('text')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
              draftType === 'text'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Document / Text Draft</span>
          </button>

          <button
            type="button"
            onClick={() => setDraftType('image')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
              draftType === 'image'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>Graphic / Banner Image</span>
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-700">
              contract §8
            </span>
          </button>
        </div>

        {draftType === 'image' ? (
          <div className="mt-5">
            <ImageUploadZone
              onCheckImage={handleCheckImage}
              disabled={busy}
            />
          </div>
        ) : (
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
        )}
      </section>

      {loadingDraft && (
        <SkeletonCard type="draft" />
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
                    {isImageDraft && draft.image
                      ? `${draft.image.width} × ${draft.image.height} px · ${draft.image.format || 'PNG'} · ${(draft.image.bytes / 1024).toFixed(0)} KB`
                      : `${draft.text?.length ?? 0} characters`
                    } · Kit version {draft.kit_version ?? 'unknown'}
                  </p>
                </div>

                <StatusBadge status={draft.status} />
              </div>

              {/* Version History & Actions Toolbar (P2 / contract_v2) */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      Version {draft.revision || (versionsList.length ? versionsList[versionsList.length - 1]?.n : 1)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {versionsList.length} revision{versionsList.length === 1 ? '' : 's'} recorded
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {versionsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => isImageDraft ? setImageDiffModalData({ from: versionsList[0].n, to: versionsList[versionsList.length - 1].n }) : openDiff(versionsList[0].n, versionsList[versionsList.length - 1].n)}
                        className="btn-secondary text-xs py-1 px-2.5"
                        title="Compare first and latest version"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Compare diff</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowTimeline((prev) => !prev)}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      <History className="h-3.5 w-3.5 text-slate-600" />
                      <span>{showTimeline ? 'Hide history' : 'Version history'}</span>
                      {showTimeline ? (
                        <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>

                    {['DRAFT', 'CHANGES_REQUESTED'].includes(draft.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevisionText(draft.text || '');
                          setIsRevisionModalOpen(true);
                        }}
                        disabled={busy || useMock}
                        className="btn-secondary text-xs py-1 px-2.5 text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/50"
                        title="Upload a new revision with an optional note"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>New revision</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Version Timeline */}
                {showTimeline && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <VersionTimeline
                      versions={versionsList}
                      currentVersion={draft.revision || 1}
                      onCompare={(from, to) => isImageDraft ? setImageDiffModalData({ from, to }) : openDiff(from, to)}
                      onUploadRevision={
                        ['DRAFT', 'CHANGES_REQUESTED'].includes(draft.status)
                          ? () => {
                              setRevisionText(draft.text || '');
                              setIsRevisionModalOpen(true);
                            }
                          : null
                      }
                      disabled={busy || useMock}
                    />
                  </div>
                )}
              </div>

              {isImageDraft ? (
                <div className="mt-4 space-y-4">
                  <ImageViewer
                    imageUrl={draftImageUrl}
                    issues={filteredIssues}
                    activeIssueId={activeIssueId}
                    onSelectIssue={(id) => setActiveIssueId(id)}
                    imageMeta={draft.image}
                  />

                  {draft.palette && Array.isArray(draft.palette) && draft.palette.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2.5">
                        <span className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Palette className="h-4 w-4 text-indigo-600" />
                          Detected Brand Palette ({draft.palette.length} Dominant Colors)
                        </span>
                        <span className="text-[11px] font-normal text-slate-400">
                          K-Means Clustering · WCAG / Delta-E
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {draft.palette.map((p, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs shadow-2xs"
                          >
                            <span
                              className="h-4 w-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                              style={{ backgroundColor: p.hex }}
                            />
                            <span className="font-mono font-bold text-slate-800">{p.hex}</span>
                            <span className="text-[11px] text-slate-500">{(p.share * 100).toFixed(0)}%</span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                p.on_brand
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {p.on_brand ? 'On-brand' : `ΔE ${p.delta_e ?? p.delta_e00 ?? 'off'}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}

              {/* Masking Disclosure Panel (P5 / contract_v2 §8) */}
              <div className="mt-4">
                <MaskingPanel
                  maskSummary={draft.mask_summary}
                  draftKind={draft.kind}
                  checks={draft.checks}
                />
              </div>

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

              {/* Threaded Discussion Section (P3 / contract_v2) */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <CommentThread
                  comments={draft.comments || []}
                  onAddComment={handleAddCommentWithReply}
                  disabled={busy}
                />
              </div>

              {/* Draft Audit Trail Section (P3 / contract_v2) */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <AuditList auditEvents={draft.audit || []} />
              </div>
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
                  <option value="waived">Waived</option>
                  <option value="mandatory">Mandatory only</option>
                </select>
              </div>

              <div className="space-y-3">
                {isImageDraft ? (
                  filteredIssues.map((issue, idx) => (
                    <ImageIssueCard
                      key={issue.id || `img_iss_${idx}`}
                      issue={issue}
                      index={idx}
                      isSelected={activeIssueId === issue.id}
                      onSelect={() => setActiveIssueId(issue.id)}
                      draftId={draft.id}
                      draftStatus={draft.status}
                      onWaiverDecided={handleWaiverDecided}
                      onRequestException={(item, note) =>
                        act(
                          item,
                          {
                            action: 'request_exception',
                            note,
                          },
                          'Exception request recorded.',
                        )
                      }
                      disabled={
                        busy ||
                        useMock ||
                        !['DRAFT', 'CHANGES_REQUESTED', 'IN_REVIEW'].includes(
                          draft.status,
                        )
                      }
                    />
                  ))
                ) : (
                  filteredIssues.map((issue) => (
                    <IssueCard
                      key={`${issue.id}_${issue.quote}_${issue.start}`}
                      issue={issue}
                      draftId={draft.id}
                      draftStatus={draft.status}
                      onWaiverDecided={handleWaiverDecided}
                      disabled={
                        busy ||
                        useMock ||
                        !['DRAFT', 'CHANGES_REQUESTED', 'IN_REVIEW'].includes(
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
                  ))
                )}

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

      {/* Diff Viewer Modal (P2 / contract_v2) */}
      {diffModalData && (
        <DiffViewer
          diffData={diffModalData}
          loading={diffLoading}
          onClose={() => setDiffModalData(null)}
          versions={versionsList}
          fromVersion={diffModalData.from}
          toVersion={diffModalData.to}
          onSelectVersions={openDiff}
        />
      )}

      {/* Side-by-Side Image Diff Viewer Modal (P4 / contract_v2 §8) */}
      {imageDiffModalData && (
        <ImageDiffViewer
          draftId={draft.id}
          fromVersion={imageDiffModalData.from}
          toVersion={imageDiffModalData.to}
          onClose={() => setImageDiffModalData(null)}
          versions={versionsList}
          onSelectVersions={(from, to) => setImageDiffModalData({ from, to })}
        />
      )}

      {/* Upload Revision Dialog Modal (P2 / contract_v2) */}
      {isRevisionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    Upload New Draft Revision
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Increments revision number, re-runs rule checks, and preserves version history.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadRevision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Revision note / change description (optional)
                </label>
                <input
                  type="text"
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  placeholder="e.g. Revised claim in paragraph 2, fixed terminology"
                  className="field text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isImageDraft ? 'Upload replacement image (PNG, JPG)' : 'Upload file (.md, .txt, .docx, .pdf)'}
                </label>
                <div className="flex items-center gap-2">
                  <label className="btn-secondary cursor-pointer text-xs py-1.5 px-3">
                    <FileUp className="h-3.5 w-3.5" />
                    <span>Choose replacement {isImageDraft ? 'image' : 'file'}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept={isImageDraft ? 'image/png,image/jpeg,image/jpg' : '.md,.txt,.docx,.pdf,text/plain,application/pdf'}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setRevisionFile(f);
                        if (f) setRevisionText('');
                      }}
                    />
                  </label>
                  {revisionFile && (
                    <span className="text-xs text-indigo-700 font-medium">
                      Selected: {revisionFile.name}
                    </span>
                  )}
                </div>
              </div>

              {!revisionFile && !isImageDraft && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Or paste revised text directly:
                  </label>
                  <textarea
                    rows={6}
                    value={revisionText}
                    onChange={(e) => setRevisionText(e.target.value)}
                    className="field font-mono text-xs leading-relaxed"
                    placeholder="Paste revised draft content here..."
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRevisionModalOpen(false)}
                  className="btn-secondary text-xs"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || (!revisionFile && revisionText.trim().length < 3)}
                  className="btn-primary text-xs"
                >
                  {busy ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  <span>Submit revision & recheck</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
