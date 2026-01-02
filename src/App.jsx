import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Commercial from './pages/Commercial';

// IMPORTANT : On importe les fournisseurs de données (Contextes)
// Assurez-vous que les chemins './context/...' correspondent bien à vos dossiers
import { AuthProvider } from './context/AuthContext';
import { LeadsProvider } from './context/LeadsContext';

function App() {
  return (
    <AuthProvider>
      <LeadsProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/commercial" element={<Commercial />} />
          </Routes>
        </Router>
      </LeadsProvider>
    </AuthProvider>
  );
}

export default App;