import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Commercial from './pages/Commercial';
import Login from './pages/Login';
import Landing from './pages/Landing';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Route publique : Landing Page */}
        <Route path="/" element={<Landing />} />
        
        {/* Route publique : Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Routes protégées sous /app */}
        <Route path="/app" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/app/commercial" element={
          <ProtectedRoute>
            <Commercial />
          </ProtectedRoute>
        } />
        
        {/* Routes publiques pour les formulaires */}
        <Route path="/estimation" element={<Navigate to="/estimation.html" replace />} />
        <Route path="/merci" element={<Navigate to="/merci.html" replace />} />
        
        {/* Route par défaut : rediriger vers la landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;