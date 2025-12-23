import { Routes, Route, Navigate } from 'react-router-dom'
import Qualify from '../../pages/Qualify'
import Dashboard from '../../pages/Dashboard'
import Login from '../../pages/Login'
import ProtectedRoute from '../../components/ProtectedRoute'

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Qualify />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
