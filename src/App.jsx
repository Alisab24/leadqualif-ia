import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Imports des pages (Vérifie qu'ils existent)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Estimation from './pages/Estimation';
import DocumentsPage from './pages/DocumentsPage';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* 1. Routes Publiques */}
        <Route path="/" element={<Login />} />
        <Route path="/estimation" element={<Estimation />} />
        <Route path="/estimation/:agencyId" element={<Estimation />} />

        {/* 2. Routes Protégées (Avec Layout Menu) */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Redirection de secours */}
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
        </Route>
        
        {/* 3. Catch-all (404) -> Redirige vers Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
