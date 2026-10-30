import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import BrandSetup from './pages/BrandSetup.jsx';
import Studio from './pages/Studio.jsx';
import ReviewQueue from './pages/ReviewQueue.jsx';
import ManagerReview from './pages/ManagerReview.jsx';
import Insights from './pages/Insights.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public authentication route */}
        <Route path="/login" element={<Login />} />

        {/* Authenticated workspace routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/studio" replace />} />
          <Route path="studio" element={<Studio />} />
          {/* Deep link for specific draft (H10, Section 6.2) */}
          <Route path="drafts/:id" element={<Studio />} />
          <Route path="brand" element={<BrandSetup />} />
          <Route path="reviews" element={<ReviewQueue />} />

          {/* Role-restricted management & compliance views */}
          <Route
            path="manager"
            element={
              <ProtectedRoute allowedRoles={['manager', 'reviewer']}>
                <ManagerReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="insights"
            element={
              <ProtectedRoute allowedRoles={['manager', 'reviewer']}>
                <Insights />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
