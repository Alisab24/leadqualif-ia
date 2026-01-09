import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Imports Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Estimation from './pages/Estimation';
import DocumentsPage from './pages/DocumentsPage';
import DocumentsCenter from './pages/DocumentsCenter';
import Settings from './pages/Settings';
import Stats from './pages/Stats';
import DocumentPreviewPage from './pages/DocumentPreviewPage';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />
        <Route path="/estimation" element={<Estimation />} />
        <Route path="/estimation/:agencyId" element={<Estimation />} />

        {/* Private */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents-center" element={<DocumentsCenter />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
        </Route>
        
        {/* Page de prévisualisation de document (hors layout) */}
        <Route path="/documents/preview/:id" element={<DocumentPreviewPage />} />
        
        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
