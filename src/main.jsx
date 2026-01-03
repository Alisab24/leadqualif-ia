import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // L'import crucial
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* On active le moteur de routage ici pour toute l'app */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
