import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save intended URL for redirect after sign in (H10)
    sessionStorage.setItem('loomguard_redirect_url', location.pathname + location.search);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="mx-auto max-w-lg mt-12 p-6 panel text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Your current role (<span className="font-semibold text-slate-900 uppercase">{role}</span>) does not have permission to access this view. This section requires <span className="font-medium text-indigo-700">{allowedRoles.join(' or ')}</span> access.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a href="/studio" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Return to Studio
          </a>
        </div>
      </div>
    );
  }

  return children;
}
