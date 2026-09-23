import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import DraftingHome from './pages/DraftingHome';

// Secondary pages are code-split so the dashboard loads fast.
const NewDraft = lazy(() => import('./pages/NewDraft'));
const DraftWorkspace = lazy(() => import('./pages/DraftWorkspace'));
const MyDocuments = lazy(() => import('./pages/MyDocuments'));
const Templates = lazy(() => import('./pages/Templates'));
const ReviewDocument = lazy(() => import('./pages/ReviewDocument'));
const CompareDocuments = lazy(() => import('./pages/CompareDocuments'));
const LimitationCalculator = lazy(() => import('./pages/LimitationCalculator'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DraftingHome />} />
        {/* Entry points used by the main Legal Lens site ("Explore") */}
        <Route path="legal-drafting" element={<Navigate to="/" replace />} />
        <Route path="drafting" element={<Navigate to="/" replace />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="draft/new" element={<NewDraft />} />
        <Route path="draft/:docId" element={<DraftWorkspace />} />
        <Route path="documents" element={<MyDocuments />} />
        <Route path="templates" element={<Templates />} />
        <Route path="review" element={<ReviewDocument />} />
        <Route path="compare" element={<CompareDocuments />} />
        <Route path="limitation" element={<LimitationCalculator />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
