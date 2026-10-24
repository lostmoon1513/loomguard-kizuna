
import {
  Check,
  Clock,
  FileEdit,
  Loader2,
  Pencil,
  XCircle,
} from 'lucide-react';

const config = {
  DRAFT: {
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Pencil,
    label: 'Draft',
  },
  CHECKING: {
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Loader2,
    label: 'Checking',
    spin: true,
  },
  IN_REVIEW: {
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Clock,
    label: 'In Review',
  },
  APPROVED: {
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: Check,
    label: 'Approved',
  },
  CHANGES_REQUESTED: {
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: XCircle,
    label: 'Changes Requested',
  },
  open: {
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: XCircle,
    label: 'open',
  },
  accepted: {
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: Check,
    label: 'accepted',
  },
  edited: {
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: FileEdit,
    label: 'edited',
  },
  exception_requested: {
    cls: 'bg-violet-50 text-violet-800 border-violet-200',
    icon: Clock,
    label: 'exception requested',
  },
};

const fallback = {
  cls: 'bg-slate-100 text-slate-600 border-slate-200',
  icon: Pencil,
  label: null,
};

export default function StatusBadge({ status = 'DRAFT' }) {
  const cfg = config[status] || fallback;
  const Icon = cfg.icon;
  const displayLabel = cfg.label || (status ?? 'DRAFT').replaceAll('_', ' ');

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.cls}`}
    >
      <Icon
        className={`h-3 w-3 shrink-0 ${cfg.spin ? 'animate-spin' : ''}`}
      />
      {displayLabel}
    </span>
  );
}
