import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

// Imports Pages
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ResetPassword from './pages/ResetPassword';
import AuthConfirm from './pages/AuthConfirm';
import Dashboard from './pages/Dashboard';
import Estimation from './pages/Estimation';
import DocumentsPage from './pages/DocumentsPage';
import Settings from './pages/Settings';
import Stats from './pages/Stats';
import DocumentPreviewPage from './pages/DocumentPreviewPage';
import InvoiceQuoteDocument from './pages/InvoiceQuoteDocument';
import DocumentViewer from './components/DocumentViewer';
import LeadDetails from './components/LeadDetails';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Route racine "/" — redirige vers nexapro.tech SAUF si
 * l'URL contient un token Supabase (confirmation email).
 * Dans ce cas, on redirige vers /auth/confirm qui traite le token.
 */
function LeadQualifRedirect() {
  useEffect(() => {
    const hash   = window.location.hash;
    const search = window.location.search;
    // Supabase met le token dans le hash (#access_token=...) ou
    // la query string (?token_hash=...&type=signup)
    const hasAuthToken =
      hash.includes('access_token') ||
      hash.includes('error_code')   ||
      hash.includes('type=')        ||
      search.includes('token_hash');

    if (hasAuthToken) {
      // Préserve hash + query → /auth/confirm les traitera
      window.location.replace('/auth/confirm' + search + hash);
    } else {
      window.location.replace('https://nexapro.tech/leadqualif.html');
    }
  }, []);
  // Spinner pendant la détection
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

// Redirection /documents-center → /documents (en préservant les search params)
function DocumentsCenterRedirect() {
  const location = useLocation();
  return <Navigate to={`/documents${location.search}`} replace />;
}

// Redirection /join/:token → /signup?invite=TOKEN
function JoinInviteRedirect() {
  const { token } = useParams();
  return <Navigate to={`/signup?invite=${token}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LeadQualifRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/join/:token" element={<JoinInviteRedirect />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/estimation" element={<Estimation />} />
          <Route path="/estimation/:agencyId" element={<Estimation />} />

          {/* Private */}
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/lead/:id" element={<LeadDetails />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents-center" element={<DocumentsCenterRedirect />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
          </Route>
          
          {/* Pages de documents (protégées mais hors layout) */}
          <Route element={<PrivateRoute />}>
            <Route path="/documents/preview/:id" element={<DocumentPreviewPage />} />
            <Route path="/documents/:type(devis|facture)/:id" element={<InvoiceQuoteDocument />} />
            <Route path="/documents/view/:id" element={<DocumentViewer />} />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
