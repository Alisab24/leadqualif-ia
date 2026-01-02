import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children, session }) => {
  if (!session) {
    console.log('No session, redirecting to login')
    return <Navigate to="/login" replace />
  }

  console.log('Session valid, accessing protected route')
  return children
}

export default ProtectedRoute






