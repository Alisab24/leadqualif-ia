import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n.js'  // initialise i18next avant le rendu

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("FATAL: Impossible de trouver l'élément 'root' dans index.html");
  document.body.innerHTML = `
    <div style="padding:20px; text-align:center; font-family:Arial, sans-serif;">
      <h1 style="color:red;">Erreur Critique : Élément Root manquant</h1>
      <p>Vérifiez que le fichier index.html contient bien &lt;div id="root"&gt;&lt;/div&gt;</p>
    </div>
  `;
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Crash au démarrage de React:", error);
    rootElement.innerHTML = `
      <div style="padding:20px; text-align:center; font-family:Arial, sans-serif;">
        <h1>🚨 Oups ! Une erreur est survenue.</h1>
        <p style="color:red; font-weight:bold;">${error.message}</p>
        <p>Ouvrez la console (F12) pour plus de détails.</p>
        <button onclick="window.location.reload()" style="padding:10px 20px; background:#007bff; color:white; border:none; border-radius:5px; cursor:pointer;">
          🔄 Actualiser la page
        </button>
      </div>
    `;
  }
}
