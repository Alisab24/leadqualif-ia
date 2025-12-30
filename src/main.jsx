import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Assurez-vous que ce chemin est bon, sinon mettez './api/router' si vous êtes déjà dans src
import Router from './src/api/router' 
import { LeadsProvider } from './context/LeadsContext'

// 👇 C'EST CETTE LIGNE QUI CHARGE LE DESIGN PC (TAILWIND)
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LeadsProvider>
    <BrowserRouter>
      <Router />
    </BrowserRouter>
    </LeadsProvider>
  </React.StrictMode>
)