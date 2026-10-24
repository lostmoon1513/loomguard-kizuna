
import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Database,
  FileUp,
  LoaderCircle,
  RefreshCw,
  Search,
  Tag,
} from 'lucide-react';
import {
  getBrand,
  loadDemoKit,
  searchBrand,
  updateTerms,
  uploadBrandKit,
} from '../api/brand.js';
import { getErrorMessage } from '../api/client.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingState from '../components/LoadingState.jsx';

const statIcons = {
  'Guide pages': BookOpen,
  'Guide chunks': Database,
  'Approved fact rows': CheckCircle2,
  'Terminology rules': Tag,
};

function Stat({ label, value, note }) {
  const Icon = statIcons[label] || BookOpen;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-100/60 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight text-slate-900">
        {value ?? '—'}
      </div>
      {note && (
        <div className="text-xs text-slate-500 leading-5">{note}</div>
      )}
    </div>
  );
}

export default function BrandSetup() {
  const [brand, setBrand] = useState(null);
  const [guide, setGuide] = useState(null);
  const [facts, setFacts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('guide');
  const [results, setResults] = useState([]);
  const [termsJson, setTermsJson] = useState('');
  const [termsEditorOpen, setTermsEditorOpen] = useState(false);

  const refresh = useCallback(async () => {
    const data = await getBrand();
    setBrand(data);
  }, []);

  useEffect(() => {
  async function loadBrand() {
    try {
      await refresh();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }

  loadBrand();
}, [refresh]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const data = await action();

      if (data?.ready !== undefined) {
        setBrand(data);
      }

      await refresh();
      setMessage('Brand kit updated successfully.');
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submitUpload = () => {
    if (!guide || !facts) {
      setError(
        'Select both a PDF brand guide and a CSV approved-facts file.',
      );
      return;
    }

    run(() => uploadBrandKit(guide, facts));
  };

  const search = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setResults(await searchBrand(query.trim(), source));
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const editTerms = () => {
    setTermsJson('');
    setTermsEditorOpen(true);
    setMessage(
      'The brand endpoint exposes terminology counts, not the current term values. Enter the complete replacement payload below before saving.',
    );
  };

  const saveTerms = async () => {
    try {
      const parsed = JSON.parse(termsJson);

      setBusy(true);
      setError('');

      await updateTerms(parsed);
      await refresh();

      setMessage('Terminology settings saved.');
    } catch (error) {
      setError(
        error instanceof SyntaxError
          ? 'Terms must be valid JSON with banned, preferred, and hex_codes fields.'
          : getErrorMessage(error),
      );
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

      {message && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      {!brand ? (
        <LoadingState label="Loading brand kit…" />
      ) : (
        <>
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="eyebrow">Current source of truth</div>
                <h2 className="mt-2 text-lg font-bold text-slate-900">
                  Brand kit overview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  The checks use the currently loaded guide, approved
                  facts, and terminology.
                </p>
              </div>

              <div
                className={`self-start rounded-full border px-3 py-1.5 text-xs font-bold ${
                  brand.ready
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {brand.ready
                  ? `✓ Kit ready · v${brand.kit_version}`
                  : 'No kit loaded'}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Guide pages"
                value={brand.guide?.pages}
                note={brand.guide?.file || 'No guide file'}
              />

              <Stat
                label="Guide chunks"
                value={brand.guide?.chunks}
                note={`${brand.guide?.mandatory ?? 0} mandatory rules`}
              />

              <Stat
                label="Approved fact rows"
                value={brand.facts?.rows}
                note={brand.facts?.file || 'No facts file'}
              />

              <Stat
                label="Terminology rules"
                value={
                  (brand.terms?.banned ?? 0) +
                  (brand.terms?.preferred ?? 0)
                }
                note={`${brand.terms?.banned ?? 0} banned · ${
                  brand.terms?.preferred ?? 0
                } preferred`}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-medium">
                Retrieval: {brand.retrieval_mode || 'unknown'}
              </span>

              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-medium">
                Vector search:{' '}
                {brand.vector_search
                  ? 'enabled'
                  : 'not available; keyword retrieval'}
              </span>

              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-medium">
                {brand.guide?.with_exceptions ?? 0} rules with exceptions
              </span>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            {/* Upload section */}
            <div className="panel p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <FileUp className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-slate-900">Upload brand sources</h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Both source files are required. The backend accepts a PDF
                guide and CSV approved facts.
              </p>

              {/* Drag-and-drop styled zone */}
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Brand guide{' '}
                    <span className="font-normal text-slate-400">(.pdf)</span>
                  </span>

                  <div className="mt-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-300 hover:bg-indigo-50/30">
                    <input
                      className="field border-0 bg-transparent p-0 focus:ring-0"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => {
                        const f = event.target.files?.[0] || null;
                        if (f && f.size > 10 * 1024 * 1024) {
                          setError('Brand guide PDF exceeds the 10 MB limit.');
                          event.target.value = '';
                          return;
                        }
                        setGuide(f);
                      }}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Approved facts{' '}
                    <span className="font-normal text-slate-400">(.csv)</span>
                  </span>

                  <div className="mt-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-300 hover:bg-indigo-50/30">
                    <input
                      className="field border-0 bg-transparent p-0 focus:ring-0"
                      type="file"
                      accept="text/csv,.csv"
                      onChange={(event) => {
                        const f = event.target.files?.[0] || null;
                        if (f && f.size > 10 * 1024 * 1024) {
                          setError('Approved facts CSV exceeds the 10 MB limit.');
                          event.target.value = '';
                          return;
                        }
                        setFacts(f);
                      }}
                    />
                  </div>
                </label>

                <button
                  className="btn-primary w-full"
                  onClick={submitUpload}
                  disabled={busy || !guide || !facts}
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  Upload and index sources
                </button>

                <button
                  className="btn-secondary w-full"
                  disabled={busy}
                  onClick={() => run(loadDemoKit)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Load demo kit
                </button>
              </div>
            </div>

            {/* Search section */}
            <div className="panel p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Search className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-slate-900">Search brand evidence</h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Search the backend index and inspect its returned citations.
              </p>

              <form onSubmit={search} className="mt-5 space-y-3">
                <input
                  className="field"
                  minLength={2}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. uptime, tone, approved price"
                  required
                />

                <div className="flex gap-3">
                  <select
                    className="field"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                  >
                    <option value="guide">Brand guide</option>
                    <option value="facts">Approved facts</option>
                  </select>

                  <button className="btn-primary shrink-0" type="submit">
                    <Search className="h-4 w-4" />
                    Search
                  </button>
                </div>
              </form>

              <div className="mt-4 space-y-3">
                {results.map((item, index) => (
                  <div
                    key={`${item.citation?.ref || 'result'}-${index}`}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-2">
                      <strong className="text-slate-800">{item.citation?.doc}</strong>

                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-700">
                        {item.citation?.ref}
                        {item.citation?.rule_id
                          ? ` · ${item.citation.rule_id}`
                          : ''}
                      </span>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                      {item.item?.text ||
                        item.text ||
                        item.content ||
                        item.chunk ||
                        JSON.stringify(item.item || item)}
                    </p>
                  </div>
                ))}

                {results.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <Search className="mx-auto h-6 w-6 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">
                      Search results will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Terminology configuration</h2>
                <p className="mt-1 text-sm text-slate-500">
                  The API returns counts only, not existing term values.
                  Saving replaces the full terms configuration. Required
                  shape: banned, preferred, hex_codes.
                </p>
              </div>

              <button
                className="btn-secondary"
                onClick={editTerms}
              >
                Open JSON editor
              </button>
            </div>

            {termsEditorOpen && (
              <div className="mt-4 space-y-3">
                <textarea
                  className="field min-h-52 font-mono text-xs"
                  value={termsJson}
                  onChange={(event) => setTermsJson(event.target.value)}
                  spellCheck="false"
                  placeholder={`{
  "banned": [{"term": "example", "reason": "reason"}],
  "preferred": [{"avoid": "old phrase", "use": "preferred phrase"}],
  "hex_codes": ["#334155"]
}`}
                />

                <button
                  className="btn-primary"
                  disabled={busy || !termsJson.trim()}
                  onClick={saveTerms}
                >
                  Save terminology
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
