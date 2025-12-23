import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Vérifier si l'utilisateur est déjà connecté au chargement
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      // Vérifier si l'utilisateur est connecté en appelant le dashboard
      const response = await fetch('http://localhost:5000/dashboard', {
        method: 'GET',
        credentials: 'include', // Important pour envoyer les cookies de session
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUser(data.user)
        }
      } else {
        // 401 est normal si l'utilisateur n'est pas connecté
        if (response.status !== 401) {
          console.warn('[AUTH] Erreur inattendue lors de la vérification:', response.status)
        }
        setUser(null)
      }
    } catch (error) {
      // Ne pas afficher d'erreur si c'est juste que le serveur n'est pas accessible
      // (cela peut arriver au chargement initial)
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('[AUTH] Serveur non accessible. Assurez-vous que le serveur Flask est lancé.')
      } else {
        console.error('[AUTH] Erreur lors de la vérification du statut:', error)
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      const response = await fetch('http://localhost:5000/login', {
        method: 'POST',
        credentials: 'include', // Important pour recevoir les cookies de session
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      // Vérifier si la réponse est OK avant de parser le JSON
      if (!response.ok) {
        // Essayer de parser le JSON d'erreur
        let errorData
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : null
        } catch {
          errorData = { message: `Erreur HTTP ${response.status}` }
        }
        return { 
          success: false, 
          message: errorData?.message || `Erreur HTTP ${response.status}: ${response.statusText}` 
        }
      }

      const data = await response.json()

      if (data.status === 'success') {
        setUser(data.user)
        return { success: true, user: data.user }
      } else {
        return { success: false, message: data.message || 'Erreur de connexion' }
      }
    } catch (error) {
      console.error('[AUTH] Erreur lors de la connexion:', error)
      
      // Messages d'erreur plus détaillés
      let errorMessage = 'Erreur de connexion au serveur'
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Impossible de se connecter au serveur. Vérifiez que le serveur Flask est lancé sur http://localhost:5000'
      } else if (error.message) {
        errorMessage = `Erreur: ${error.message}`
      }
      
      return { success: false, message: errorMessage }
    }
  }

  const logout = async () => {
    try {
      await fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      console.error('[AUTH] Erreur lors de la déconnexion:', error)
    } finally {
      setUser(null)
    }
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider')
  }
  return context
}






