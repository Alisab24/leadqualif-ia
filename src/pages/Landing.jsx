import React from 'react'
import { Link } from 'react-router-dom'
import { Brain, Shield, FileText, ArrowRight, CheckCircle, Star, Zap, Lock } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Brain size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">LeadQualif</h1>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-semibold">IA</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium transition">
              Connexion
            </Link>
            <Link 
              to="/login" 
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Accéder au Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full mb-6">
            <Zap size={16} />
            <span className="text-sm font-semibold">Nouveau : Génération IA de Mandats de Vente</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            L'Assistant IA des<br />
            <span className="text-blue-600">Mandataires Immobiliers d'Élite</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Ne perdez plus votre temps. LeadQualif qualifie vos prospects 24/7 et génère vos mandats conformes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              to="/login" 
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 group"
            >
              Démarrer l'essai gratuit
              <ArrowRight size={20} className="group-hover:translate-x-1 transition" />
            </Link>
            <a 
              href="/estimation" 
              target="_blank"
              className="bg-white text-gray-700 px-8 py-4 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              Voir un exemple
              <Star size={20} />
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              <span>Essai 14 jours</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              <span>Sans carte bancaire</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              <span>Annulation anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section "Pourquoi nous ?" */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Pourquoi nous ?</h2>
            <p className="text-xl text-gray-600">La solution conçue pour les professionnels de l'immobilier français</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Brain size={24} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Filtrage Anti-Touristes</h3>
              <p className="text-gray-600 leading-relaxed">
                Notre IA score chaque lead de 0 à 10. Concentrez-vous sur les acquéreurs financés et qualifiés.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <FileText size={24} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Administratif Automatisé</h3>
              <p className="text-gray-600 leading-relaxed">
                Génération de Mandats de Vente et Bons de Visite en 1 clic. Conforme loi Hoguet.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Shield size={24} className="text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Conformité & Sécurité</h3>
              <p className="text-gray-600 leading-relaxed">
                Vos données protégées, vos documents archivés. Hébergement France/UE.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Tarifs simples et transparents</h2>
            <p className="text-xl text-gray-600">Choisissez l'offre qui correspond à votre activité</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl border border-gray-200">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">Gratuit</span>
                </div>
                <p className="text-gray-600 mt-2">Pour tester et démarrer</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="text-gray-700">10 leads par mois</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="text-gray-700">IA basique de qualification</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="text-gray-700">Support par email</span>
                </li>
              </ul>
              
              <Link 
                to="/login" 
                className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition text-center block"
              >
                Commencer gratuitement
              </Link>
            </div>
            
            <div className="bg-blue-600 text-white p-8 rounded-xl relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 text-xs px-3 py-1 rounded-full font-semibold">
                POPULAIRE
              </div>
              
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">99€</span>
                  <span className="text-blue-100">/mois</span>
                </div>
                <p className="text-blue-100 mt-2">Pour les professionnels exigeants</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-white" />
                  <span>Leads illimités</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-white" />
                  <span>IA Avancée avec scoring 0-10</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-white" />
                  <span>Génération PDF (Mandats, Devis)</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-white" />
                  <span>Support Prioritaire 24/7</span>
                </li>
              </ul>
              
              <Link 
                to="/login" 
                className="w-full bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition text-center block"
              >
                Démarrer l'essai gratuit
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Brain size={20} className="text-white" />
            </div>
            <h3 className="text-lg font-bold">LeadQualif France</h3>
          </div>
          <p className="text-gray-400 mb-4">Tous droits réservés.</p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition">Mentions Légales</a>
            <a href="#" className="hover:text-white transition">CGU</a>
            <a href="#" className="hover:text-white transition">Confidentialité</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
