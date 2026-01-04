import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">LQ</span>
              </div>
              <span className="ml-3 text-2xl font-light text-gray-900">LeadQualif</span>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center space-x-8">
              <nav className="hidden md:flex space-x-6">
                <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Fonctionnalités</a>
                <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Tarifs</a>
                <a href="#security" className="text-gray-600 hover:text-gray-900 transition-colors">Sécurité</a>
              </nav>
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  to="/estimation"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium"
                >
                  Essai Gratuit
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
              🇫🇷 🇧🇪 🇱🇺 Disponible en France, Belgique, Luxembourg
            </span>
          </div>
          <h1 className="text-6xl font-light text-gray-900 mb-6 leading-tight">
            Le Cockpit de l'<span className="font-semibold">Agence Immobilière</span><br/>
            Moderne
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Générez des mandats, gérez vos prospects et facturez en un clic.<br/>
            Conforme RGPD • Documents juridiques professionnels • Support prioritaire
          </p>
          <div className="flex justify-center space-x-6">
            <Link
              to="/estimation"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium text-lg shadow-lg"
            >
              Démarrer Gratuitement
            </Link>
            <Link
              to="/login"
              className="border border-gray-300 text-gray-700 px-8 py-4 rounded-xl hover:bg-gray-50 transition-all font-medium text-lg"
            >
              Espace Client
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-gray-900 mb-4">
              Tout ce dont votre agence a besoin
            </h2>
            <p className="text-xl text-gray-600">
              Une plateforme complète pour optimiser votre activité
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Pipeline Intelligent</h3>
              <p className="text-gray-600">
                Suivez vos prospects du premier contact jusqu'à la signature, avec un aperçu visuel de votre activité.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">📄</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Documents Juridiques</h3>
              <p className="text-gray-600">
                Générez mandats, compromis et factures conformes à la législation française et européenne.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Conformité RGPD</h3>
              <p className="text-gray-600">
                Hébergement en Europe, chiffrement des données et outils de consentement intégrés.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-gray-900 mb-4">
              Tarifs simples et transparents
            </h2>
            <p className="text-xl text-gray-600">
              Sans engagement, annulez à tout moment
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Starter</h3>
              <p className="text-gray-600 mb-6">Pour les agents indépendants</p>
              <div className="mb-6">
                <span className="text-5xl font-light text-gray-900">49</span>
                <span className="text-gray-600"> € / mois</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">1 utilisateur</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Gestion illimitée de prospects</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Pipeline des ventes</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Documents standards</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span className="text-gray-700">Support par email</span>
                </li>
              </ul>
              <Link
                to="/estimation"
                className="w-full bg-gray-900 text-white py-3 rounded-xl hover:bg-gray-800 transition-all font-medium text-center block"
              >
                Essayer Gratuitement
              </Link>
            </div>

            {/* Business */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl p-8 border-2 border-blue-700 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-6 py-2 rounded-full text-sm font-medium">
                Recommandé
              </div>
              <h3 className="text-2xl font-semibold mb-2">Business</h3>
              <p className="text-blue-100 mb-6">Pour les agences immobilières</p>
              <div className="mb-6">
                <span className="text-5xl font-light">149</span>
                <span className="text-blue-100"> € / mois</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <span className="text-white mr-3">✓</span>
                  <span>5 collaborateurs inclus</span>
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-3">✓</span>
                  <span>Logo et branding personnalisés</span>
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-3">✓</span>
                  <span>Documents juridiques avancés</span>
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-3">✓</span>
                  <span>Intégrations API</span>
                </li>
                <li className="flex items-center">
                  <span className="text-white mr-3">✓</span>
                  <span>Support prioritaire 24/7</span>
                </li>
              </ul>
              <Link
                to="/estimation"
                className="w-full bg-white text-blue-600 py-3 rounded-xl hover:bg-gray-100 transition-all font-semibold text-center block"
              >
                Démarrer l'Essai
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Trust */}
      <section id="security" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-light text-gray-900 mb-12">
            Sécurité et Confiance
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🇪🇺</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Hébergement Européen</h3>
              <p className="text-gray-600">Données stockées en France, conformes RGPD</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔐</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Chiffrement SSL</h3>
              <p className="text-gray-600">Communications et données sécurisées</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📋</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Documents Juridiques</h3>
              <p className="text-gray-600">Modèles conformes droit français</p>
            </div>
          </div>

          {/* Payment Badges */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Paiement Sécurisé</h3>
            <div className="flex justify-center items-center space-x-8">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">💳</span>
                <span className="text-gray-700">Stripe</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🔵</span>
                <span className="text-gray-700">Visa</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🔴</span>
                <span className="text-gray-700">Mastercard</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🟡</span>
                <span className="text-gray-700">Maestro</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Transactions sécurisées et cryptées • Paiement en euros • Facturation française
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">LQ</span>
                </div>
                <span className="ml-3 text-2xl font-light">LeadQualif</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Le cockpit de l'agence immobilière moderne.<br/>
                Conçu pour les professionnels européens.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-6">Produit</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Intégrations</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-6">Support</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Centre d'aide</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Statut du service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Webinaires</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-6">Légal</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Mentions légales</a></li>
                <li><a href="#" className="hover:text-white transition-colors">CGU</a></li>
                <li><a href="#" className="hover:text-white transition-colors">RGPD</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 mb-4 md:mb-0">
              © 2024 LeadQualif. Tous droits réservés.
            </p>
            <div className="flex items-center space-x-6 text-gray-400">
              <span>🇫🇷 France</span>
              <span>🇧🇪 Belgique</span>
              <span>🇱🇺 Luxembourg</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
