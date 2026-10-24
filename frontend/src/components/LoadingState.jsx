
import { LoaderCircle } from 'lucide-react';

export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
