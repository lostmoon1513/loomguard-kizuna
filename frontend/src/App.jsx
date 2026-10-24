
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import BrandSetup from './pages/BrandSetup.jsx';
import Studio from './pages/Studio.jsx';
import ReviewQueue from './pages/ReviewQueue.jsx';
import ManagerReview from './pages/ManagerReview.jsx';
import Insights from './pages/Insights.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/studio" replace />} />
        <Route path="studio" element={<Studio />} />
        <Route path="brand" element={<BrandSetup />} />
        <Route path="reviews" element={<ReviewQueue />} />
        <Route path="manager" element={<ManagerReview />} />
        <Route path="insights" element={<Insights />} />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Route>
    </Routes>
  );
}
