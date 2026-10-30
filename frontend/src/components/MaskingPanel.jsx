import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  EyeOff,
  HelpCircle,
  Key,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

/**
 * MaskingPanel component strictly adhering to contract_v2 §8 & Design Rule N2:
 * "Show 'N values were hidden from the AI' with the kinds; items[].preview is a short,
 *  partly hidden label, never the full value. Audit gets a masked event. Managers edit
 *  confidential terms with PUT /api/brand/terms (confidential:[{term, kind}]).
 *  If masking fails the AI checks are skipped and the check note says so."
 */
export default function MaskingPanel({
  maskSummary,
  draftKind = 'text',
  checks = [],
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { role } = useAuth();
  const navigate = useNavigate();

  // Graphic banner drafts cannot have text masked inside pixels (contract_v2 §8)
  if (draftKind === 'image') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="font-bold text-amber-900">
                Image Privacy Notice (Masking Limitation)
              </strong>
              <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Masking Not Supported
              </span>
            </div>
            <p className="mt-1 leading-relaxed text-amber-900/90">
              Text inside graphic banners cannot be masked. If your banner contains confidential internal names,
              revenue figures, or personal emails, please disable optional AI checks before submission.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if masking failed (Fail-Closed principle, Rule N2)
  const maskingCheck = checks.find((c) => c.name === 'masking');
  const isMaskingFailed =
    maskSummary?.failed ||
    maskSummary?.error ||
    maskingCheck?.status === 'failed';

  if (isMaskingFailed) {
    return (
      <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/80 p-4 text-xs text-rose-950 shadow-sm">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-rose-950">
              Masking Failed — AI Checks Skipped (Fail-Closed Rule N2)
            </strong>
            <p className="mt-1 text-rose-900 leading-relaxed">
              Confidential terms could not be safely masked before calling Gemini AI. To prevent accidental data leaks,
              all external AI checks were halted. Findings reflect local rule-based evaluations only.
            </p>
            {maskingCheck?.note && (
              <p className="mt-1 font-mono text-[11px] text-rose-800">
                Diagnostic: {maskingCheck.note}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If no summary available, nothing to show
  if (!maskSummary) {
    return null;
  }

  const count = maskSummary.count || maskSummary.items?.length || 0;
  const byKind = maskSummary.by_kind || {};
  const items = maskSummary.items || [];
  const aiUsed = maskSummary.ai_used !== false;

  // Kind icons and styling
  const kindConfig = {
    confidential: {
      label: 'Confidential terms',
      icon: Lock,
      bg: 'bg-violet-100 text-violet-800 border-violet-200',
    },
    email: {
      label: 'Email addresses',
      icon: Mail,
      bg: 'bg-sky-100 text-sky-800 border-sky-200',
    },
    phone: {
      label: 'Phone numbers',
      icon: Phone,
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    card: {
      label: 'Card / Account numbers',
      icon: CreditCard,
      bg: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    key: {
      label: 'API Keys / Secrets',
      icon: Key,
      bg: 'bg-rose-100 text-rose-800 border-rose-200',
    },
  };

  if (count === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>
            <strong>Privacy check:</strong> No sensitive PII or confidential terms detected.
            {aiUsed ? ' Checked with AI.' : ' AI disabled.'}
          </span>
        </div>
        {role === 'manager' && (
          <button
            type="button"
            onClick={() => navigate('/brand')}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
          >
            Manage confidential terms <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/40 p-4 shadow-2xs">
      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700 shrink-0">
            <EyeOff className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {count} {count === 1 ? 'value was' : 'values were'} hidden from the AI
              </h3>
              <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                Rule N2 Protected
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">
              Rule checks ran locally on your original document. Before sending text to Gemini AI, sensitive
              terms were replaced with anonymized tokens so private data never left your system.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === 'manager' && (
            <button
              type="button"
              onClick={() => navigate('/brand')}
              className="btn-secondary text-[11px] py-1 px-2.5"
              title="Configure brand kit confidential terms"
            >
              <Tag className="h-3 w-3" />
              <span>Edit terms</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="btn-secondary text-xs py-1 px-2.5"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Hide tokens' : 'Show tokens'}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Breakdown chips by category */}
      <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-100">
        <span className="text-[11px] font-semibold text-slate-500 mr-1">
          Hidden by kind:
        </span>
        {Object.entries(byKind).map(([kind, num]) => {
          if (!num || num <= 0) return null;
          const conf = kindConfig[kind] || {
            label: kind,
            icon: Shield,
            bg: 'bg-slate-100 text-slate-800 border-slate-200',
          };
          const Icon = conf.icon;
          return (
            <span
              key={kind}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${conf.bg}`}
            >
              <Icon className="h-3 w-3" />
              <span>
                {num} {conf.label}
              </span>
            </span>
          );
        })}
      </div>

      {/* Expandable Safe Masked Tokens Table */}
      {isExpanded && items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-indigo-100">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span>Redacted Token Placeholders</span>
            <span className="text-[11px] font-normal text-slate-500">
              Only safe partial previews shown (contract §8)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3.5 py-2">Token in AI Prompt</th>
                  <th className="px-3.5 py-2">Kind</th>
                  <th className="px-3.5 py-2">Safe Masked Preview</th>
                  <th className="px-3.5 py-2">Privacy Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {items.map((item, idx) => {
                  const conf = kindConfig[item.kind] || {
                    label: item.kind,
                    bg: 'bg-slate-100 text-slate-800',
                  };
                  return (
                    <tr key={item.token || idx} className="hover:bg-slate-50/50">
                      <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-indigo-700">
                        {item.token || `[MASKED_${idx + 1}]`}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${conf.bg}`}
                        >
                          {item.kind}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-900 font-semibold">
                        {item.preview || '***'}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-emerald-700">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" />
                          Never sent to Gemini
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-slate-400" />
            <span>
              Real full values were processed in local memory only. The audit log recorded a{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700">
                masked
              </code>{' '}
              event.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
