import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { loadDemoKit } from '../api/brand.js';

/**
 * StartHereCard component per ROUND3_HANDOFF.md Step P7:
 * "First-run 'Start here' card with 3 steps and one-click buttons:
 *  1. load demo kit
 *  2. load a flawed sample draft
 *  3. load a sample banner.
 *  Dismissible, persisted in localStorage."
 */
export default function StartHereCard({
  onLoadSampleText,
  onLoadSampleBanner,
  onKitLoaded,
}) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('loomguard_start_here_dismissed') === 'true';
  });
  const [loadingKit, setLoadingKit] = useState(false);
  const [kitSuccess, setKitSuccess] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem('loomguard_start_here_dismissed', 'true');
    setDismissed(true);
  };

  const handleLoadDemoKit = async () => {
    setLoadingKit(true);
    try {
      await loadDemoKit();
      setKitSuccess(true);
      if (onKitLoaded) onKitLoaded();
    } catch (err) {
      void err;
    } finally {
      setLoadingKit(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 p-6 shadow-md shadow-indigo-100/50">
      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        aria-label="Dismiss Start Here guide"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            Start Here: 3-Minute Quickstart Journey
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test LoomGuard end-to-end with pre-configured brand assets and flawed sample drafts.
          </p>
        </div>
      </div>

      {/* 3 Step Cards Grid */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {/* Step 1 */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-2xs hover:border-indigo-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-indigo-700 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-100 text-[11px]">
                  1
                </span>
                Step 1
              </span>
              {kitSuccess && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Loaded
                </span>
              )}
            </div>
            <h3 className="text-xs font-bold text-slate-900">
              Load Demo Brand Kit
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Loads the Aurora brand guide, 15 approved fact rows, and terminology rules.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLoadDemoKit}
            disabled={loadingKit}
            className="btn-secondary mt-4 w-full justify-center text-xs py-1.5 font-semibold text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>{loadingKit ? 'Loading kit...' : kitSuccess ? 'Re-load demo kit' : 'Load demo kit'}</span>
          </button>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-2xs hover:border-indigo-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-indigo-700 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-100 text-[11px]">
                  2
                </span>
                Step 2
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Text Draft
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-900">
              Try Flawed Text Draft
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Loads a sample product announcement containing claim superlatives, slang, and pricing flaws.
            </p>
          </div>

          <button
            type="button"
            onClick={onLoadSampleText}
            className="btn-secondary mt-4 w-full justify-center text-xs py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Load sample text</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>

        {/* Step 3 */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-2xs hover:border-indigo-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-indigo-700 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-100 text-[11px]">
                  3
                </span>
                Step 3
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Graphic Banner
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-900">
              Try Sample Banner
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Switches to Image mode and checks a graphic banner for WCAG 2.1 AA contrast and color palette drift.
            </p>
          </div>

          <button
            type="button"
            onClick={onLoadSampleBanner}
            className="btn-secondary mt-4 w-full justify-center text-xs py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Load sample banner</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
