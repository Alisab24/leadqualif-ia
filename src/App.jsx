import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
        {/* Route Publique (Login) */}
        <Route path="/" element={<Login />} />

        {/* Route Publique (Estimation pour les clients) */}
        <Route path="/estimation" element={<Estimation />} />
        <Route path="/estimation/:agencyId" element={<Estimation />} />

        {/* Routes Protégées (Toutes celles avec le Menu Latéral) */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<Settings />} />
          
          {/* Redirection par défaut si on est perdu */}
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Catch all - Redirige vers login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
