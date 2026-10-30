import { useState, useEffect } from 'react';
import { ArrowLeftRight, X, LoaderCircle } from 'lucide-react';
import { getDraftImageBlobUrl } from '../api/drafts.js';

/**
 * ImageDiffViewer component per contract_v2 §8:
 * "Versions of an image draft have a placeholder text [image name WxH sha256:...].
 *  Do not run the word diff view for image drafts; show the two images side by side instead (/image?version=n)."
 */
export default function ImageDiffViewer({
  draftId,
  fromVersion,
  toVersion,
  onClose,
  versions = [],
  onSelectVersions,
}) {
  const [fromBlobUrl, setFromBlobUrl] = useState(null);
  const [toBlobUrl, setToBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let url1 = null;
    let url2 = null;

    async function loadBlobs() {
      setLoading(true);
      try {
        const [b1, b2] = await Promise.all([
          getDraftImageBlobUrl(draftId, fromVersion, true),
          getDraftImageBlobUrl(draftId, toVersion, true),
        ]);
        if (!cancelled) {
          url1 = b1;
          url2 = b2;
          setFromBlobUrl(b1);
          setToBlobUrl(b2);
        }
      } catch (err) {
        void err;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBlobs();

    return () => {
      cancelled = true;
      if (url1) URL.revokeObjectURL(url1);
      if (url2) URL.revokeObjectURL(url2);
    };
  }, [draftId, fromVersion, toVersion]);

  const fallbackFromUrl = `/api/drafts/${encodeURIComponent(draftId)}/image?version=${encodeURIComponent(fromVersion)}&annotate=true`;
  const fallbackToUrl = `/api/drafts/${encodeURIComponent(draftId)}/image?version=${encodeURIComponent(toVersion)}&annotate=true`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-6"
    >
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Side-by-Side Image Version Comparison
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visual inspection between Version {fromVersion} and Version {toVersion}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {versions.length > 1 && onSelectVersions && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-medium">Compare:</span>
                <select
                  value={fromVersion}
                  onChange={(e) => onSelectVersions(Number(e.target.value), toVersion)}
                  className="field py-1 px-2 text-xs font-semibold rounded-lg"
                  aria-label="From image version"
                >
                  {versions.map((v) => (
                    <option key={`img-from-${v.n}`} value={v.n}>
                      v{v.n}
                    </option>
                  ))}
                </select>
                <span>→</span>
                <select
                  value={toVersion}
                  onChange={(e) => onSelectVersions(fromVersion, Number(e.target.value))}
                  className="field py-1 px-2 text-xs font-semibold rounded-lg"
                  aria-label="To image version"
                >
                  {versions.map((v) => (
                    <option key={`img-to-${v.n}`} value={v.n}>
                      v{v.n}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close image diff"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Side-by-side Images Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading && (
            <div className="flex items-center justify-center py-4 text-xs text-slate-500 gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Loading version images with annotations...</span>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Version From */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Version {fromVersion} (Previous)
                </span>
                <span className="text-[10px] text-slate-400">Baseline</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-slate-950/5 rounded-xl p-2 min-h-64">
                <img
                  src={fromBlobUrl || fallbackFromUrl}
                  alt={`Version ${fromVersion}`}
                  className="max-h-[460px] w-auto max-w-full object-contain rounded-lg"
                  onError={(e) => {
                    // Fallback visual if endpoint not available
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                />
                <div style={{ display: 'none' }} className="flex-col items-center justify-center text-center p-6 text-xs text-slate-500">
                  <span>Image bytes for Version {fromVersion}</span>
                </div>
              </div>
            </div>

            {/* Version To */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                  Version {toVersion} (Current Revision)
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold">Updated</span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-slate-950/5 rounded-xl p-2 min-h-64">
                <img
                  src={toBlobUrl || fallbackToUrl}
                  alt={`Version ${toVersion}`}
                  className="max-h-[460px] w-auto max-w-full object-contain rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                />
                <div style={{ display: 'none' }} className="flex-col items-center justify-center text-center p-6 text-xs text-slate-500">
                  <span>Image bytes for Version {toVersion}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
          <span>Side-by-side visual image comparison (contract_v2 §8).</span>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-xs font-medium">
            Close comparison
          </button>
        </div>
      </div>
    </div>
  );
}
