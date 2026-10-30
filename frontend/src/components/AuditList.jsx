import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck2,
  FilePlus,
  History,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Upload,
  User,
} from 'lucide-react';

/**
 * AuditList component rendering draft.audit[] event trail per contract_v2:
 * Types: created, checked, fix_accepted, edited, revision_uploaded, exception_requested,
 *        waiver_granted, waiver_denied, waiver_expired, submitted, comment, decision, masked
 */
export default function AuditList({ auditEvents = [] }) {
  const [filterType, setFilterType] = useState('all');

  const getEventBadge = (type) => {
    switch (type) {
      case 'waiver_granted':
        return {
          icon: ShieldCheck,
          label: 'Waiver Granted',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'waiver_denied':
        return {
          icon: ShieldX,
          label: 'Waiver Denied',
          className: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'waiver_expired':
        return {
          icon: AlertTriangle,
          label: 'Waiver Expired',
          className: 'bg-amber-100 text-amber-900 border-amber-200',
        };
      case 'exception_requested':
        return {
          icon: AlertTriangle,
          label: 'Exception Requested',
          className: 'bg-violet-100 text-violet-800 border-violet-200',
        };
      case 'submitted':
        return {
          icon: Send,
          label: 'Submitted for Review',
          className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
      case 'decision':
        return {
          icon: FileCheck2,
          label: 'Review Decision',
          className: 'bg-slate-100 text-slate-800 border-slate-200',
        };
      case 'fix_accepted':
        return {
          icon: CheckCircle2,
          label: 'Fix Accepted',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'edited':
        return {
          icon: Edit3,
          label: 'Text Edited',
          className: 'bg-sky-100 text-sky-800 border-sky-200',
        };
      case 'revision_uploaded':
        return {
          icon: Upload,
          label: 'Revision Uploaded',
          className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
      case 'comment':
        return {
          icon: MessageSquare,
          label: 'Comment Added',
          className: 'bg-slate-100 text-slate-700 border-slate-200',
        };
      case 'masked':
        return {
          icon: ShieldAlert,
          label: 'Sensitive Data Masked',
          className: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      default:
        return {
          icon: History,
          label: type.replaceAll('_', ' '),
          className: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const filteredEvents = auditEvents.filter((ev) => {
    if (filterType === 'all') return true;
    if (filterType === 'waivers') {
      return ['waiver_granted', 'waiver_denied', 'waiver_expired', 'exception_requested'].includes(ev.type);
    }
    return ev.type === filterType;
  });

  // Reverse chronological
  const displayEvents = [...filteredEvents].reverse();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Audit Trail ({auditEvents.length} event{auditEvents.length === 1 ? '' : 's'})
          </h4>
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="field text-xs py-1 px-2"
          aria-label="Filter audit events"
        >
          <option value="all">All Events</option>
          <option value="waivers">Waivers & Exceptions</option>
          <option value="revision_uploaded">Revisions</option>
          <option value="decision">Decisions</option>
          <option value="comment">Comments</option>
        </select>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {displayEvents.length > 0 ? (
          displayEvents.map((ev, index) => {
            const badge = getEventBadge(ev.type);
            const Icon = badge.icon;
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{badge.label}</span>
                    </span>
                    <strong className="text-slate-800">{ev.actor || 'System'}</strong>
                    {ev.role && (
                      <span className="text-[10px] text-slate-400 capitalize">
                        ({ev.role})
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {ev.at ? new Date(ev.at).toLocaleString() : 'Recent'}
                  </span>
                </div>

                {ev.detail && (
                  <p className="text-slate-600 text-xs font-mono bg-slate-50 p-2 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {typeof ev.detail === 'object'
                      ? JSON.stringify(ev.detail, null, 2)
                      : String(ev.detail)}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
            No audit records match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
