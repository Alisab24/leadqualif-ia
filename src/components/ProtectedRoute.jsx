import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children }) => {
  // Vérifier l'authentification via localStorage
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true'
  
  // Optionnel : Vérifier si la session n'a pas expiré (24h)
  const loginTime = localStorage.getItem('loginTime')
  const isSessionValid = loginTime ? 
    (Date.now() - new Date(loginTime).getTime()) < 24 * 60 * 60 * 1000 : 
    false

  useEffect(() => {
    // Si non authentifié ou session expirée, nettoyer et rediriger
    if (!isAuthenticated || !isSessionValid) {
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('loginTime')
    }
  }, [isAuthenticated, isSessionValid])

  if (!isAuthenticated || !isSessionValid) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute






