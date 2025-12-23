import React from 'react';
import Dashboard from './pages/Dashboard';

// IMPORTANT : On importe les fournisseurs de données (Contextes)
// Assurez-vous que les chemins './context/...' correspondent bien à vos dossiers
import { AuthProvider } from './context/AuthContext';
import { LeadsProvider } from './context/LeadsContext';

function App() {
  return (
    // On enveloppe le Dashboard avec les fournisseurs (Providers)
    // L'ordre est important : Auth (Sécurité) englobe souvent le reste
    <AuthProvider>
      <LeadsProvider>
        <Dashboard />
      </LeadsProvider>
    </AuthProvider>
  );
}

export default App;