import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">LQ</span>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">LeadQualif</span>
            </div>
            
            {/* Boutons */}
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Se connecter
              </Link>
              <Link
                to="/estimation"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Essai Gratuit
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Le CRM Immobilier N°1 en Afrique
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Générez des mandats, gérez vos prospects et facturez en un clic.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/estimation"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
            >
              Commencer Gratuitement
            </Link>
            <Link
              to="/login"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium text-lg"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* Section Prix */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choisissez votre formule
            </h2>
            <p className="text-gray-600">
              Sans engagement, annulez à tout moment
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Solo */}
            <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Solo</h3>
              <p className="text-gray-600 mb-6">Pour les agents indépendants</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">10.000</span>
                <span className="text-gray-600"> FCFA / mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  1 utilisateur
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Gestion des prospects
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Pipeline des ventes
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Support par email
                </li>
              </ul>
              <Link
                to="/estimation"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center block"
              >
                Essayer Gratuitement
              </Link>
            </div>

            {/* Agence */}
            <div className="bg-blue-600 text-white rounded-lg shadow-lg p-8 border-2 border-blue-700 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                Plus Populaire
              </div>
              <h3 className="text-2xl font-bold mb-2">Agence</h3>
              <p className="text-blue-100 mb-6">Pour les équipes immobilières</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">35.000</span>
                <span className="text-blue-100"> FCFA / mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="text-white mr-2">✓</span>
                  5 utilisateurs
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-2">✓</span>
                  Gestion des prospects
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-2">✓</span>
                  Pipeline des ventes
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-2">✓</span>
                  Documents personnalisés
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-2">✓</span>
                  Support prioritaire
                </li>
              </ul>
              <Link
                to="/estimation"
                className="w-full bg-white text-blue-600 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium text-center block"
              >
                Essayer Gratuitement
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LQ</span>
                </div>
                <span className="ml-2 text-xl font-bold">LeadQualif</span>
              </div>
              <p className="text-gray-400">
                Le CRM immobilier pour les professionnels en Afrique.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Centre d'aide</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Statut</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
                <li><a href="#" className="hover:text-white transition-colors">CGU</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Sécurité</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 LeadQualif. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
