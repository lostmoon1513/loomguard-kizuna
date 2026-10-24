
import { AlertCircle, X } from 'lucide-react';

export default function ErrorMessage({ message, onDismiss }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

      <p className="flex-1">{message}</p>

      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss error">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
