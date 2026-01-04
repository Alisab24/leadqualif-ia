import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() { 
  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          ✨ LeadQualif IA
        </div>
        <div className="flex gap-4">
          <Link to="/app" className="text-slate-600 hover:text-blue-600 font-medium px-4 py-2">Connexion</Link>
          <Link to="/estimation" className="bg-blue-600 text-white px-5 py-2 rounded-full font-bold hover:bg-blue-700 transition">
            Essai Gratuit
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="text-center py-20 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
            🚀 Nouveau : L'IA qui qualifie vos leads 24/7
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 leading-tight">
            Arrêtez de perdre vos commissions dans vos e-mails.
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            La plupart des agences perdent 30% de leurs revenus par manque de suivi. 
            LeadQualif IA centralise, qualifie et relance vos prospects à votre place.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <Link to="/estimation" className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 shadow-xl shadow-blue-200 transition transform hover:-translate-y-1">
              Démarrer mon essai gratuit
            </Link>
            <a href="#demo" className="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl text-lg font-bold hover:bg-gray-50 transition">
              Voir la démo
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-400">Aucune carte bancaire requise • Annulation à tout moment</p>
        </div>
      </header>

      {/* VISUAL PREUVE (SCREENSHOT) */}
      <section id="demo" className="py-10 px-4">
        <div className="max-w-6xl mx-auto bg-slate-900 rounded-2xl p-4 shadow-2xl ring-1 ring-slate-900/10">
          {/* Simulation d'interface Dashboard */}
          <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 aspect-video relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <p className="text-slate-400 font-medium">✨ Visualisation du Pipeline Intelligent & Actions Rapides</p>
            </div>
            {/* Ici on mettrait une vraie image plus tard */}
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Tout ce dont vous avez besoin pour closer</h2>
            <p className="text-slate-500">Une suite d'outils conçue pour les agents modernes.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl mb-6">⚡️</div>
              <h3 className="text-xl font-bold mb-3">Actions Rapides</h3>
              <p className="text-slate-600">WhatsApp, Email, RDV en un clic. Plus de copier-coller, plus d'erreurs. Gagnez 1h par jour.</p>
            </div>
            {/* Card 2 */}
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-green-100 transition">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl mb-6">💰</div>
              <h3 className="text-xl font-bold mb-3">Scoring & Potentiel</h3>
              <p className="text-slate-600">Identifiez immédiatement les leads à 20 000€ de commission. Ne perdez plus de temps sur les curieux.</p>
            </div>
            {/* Card 3 */}
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-100 transition">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl mb-6">📄</div>
              <h3 className="text-xl font-bold mb-3">Documents Auto</h3>
              <p className="text-slate-600">Générez mandats et offres depuis la fiche client. Vos dossiers sont toujours prêts et centralisés.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Des tarifs simples et transparents</h2>
            <p className="text-slate-400">Rentabilisé dès le premier RDV décroché.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* STARTER */}
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Starter</div>
              <div className="text-4xl font-bold mb-6">29€<span className="text-lg text-slate-500 font-normal">/mois</span></div>
              <ul className="space-y-4 mb-8 text-slate-300">
                <li>✅ 1 Utilisateur</li>
                <li>✅ Pipeline Visuel</li>
                <li>✅ Actions Rapides (WhatsApp/Mail)</li>
                <li>✅ Historique Illimité</li>
              </ul>
              <Link to="/estimation" className="block w-full py-3 bg-slate-700 hover:bg-slate-600 text-center rounded-lg font-bold transition">Choisir Starter</Link>
            </div>
            {/* PRO */}
            <div className="bg-blue-600 p-8 rounded-2xl border border-blue-500 transform md:-translate-y-4 shadow-2xl relative">
              <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">POPULAIRE</div>
              <div className="text-sm font-bold text-blue-100 uppercase tracking-wide mb-2">Pro</div>
              <div className="text-4xl font-bold mb-6">79€<span className="text-lg text-blue-200 font-normal">/mois</span></div>
              <ul className="space-y-4 mb-8 text-white">
                <li>✅ <strong>Tout du Starter, plus :</strong></li>
                <li>✅ Templates Personnalisés</li>
                <li>✅ Statistiques Avancées</li>
                <li>✅ Génération de Documents</li>
                <li>✅ Support Prioritaire</li>
              </ul>
              <Link to="/estimation" className="block w-full py-3 bg-white text-blue-600 hover:bg-blue-50 text-center rounded-lg font-bold transition">Démarrer l'essai Pro</Link>
            </div>
            {/* AGENCE */}
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Agence</div>
              <div className="text-4xl font-bold mb-6">Sur Devis</div>
              <ul className="space-y-4 mb-8 text-slate-300">
                <li>✅ Multi-Comptes</li>
                <li>✅ Branding (Logo Agence)</li>
                <li>✅ Accompagnement Dédié</li>
                <li>✅ Formation Équipe</li>
              </ul>
              <a href="mailto:contact@leadqualif.com" className="block w-full py-3 bg-slate-700 hover:bg-slate-600 text-center rounded-lg font-bold transition">Nous Contacter</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 py-12 text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <span className="font-bold text-white text-lg">LeadQualif IA</span>
            <p className="mt-2">Le CRM immobilier nouvelle génération.</p>
          </div>
          <div className="flex gap-6">
            <span>🔒 Paiement Sécurisé (Stripe)</span>
            <span>🇪🇺 Hébergé en Europe (RGPD)</span>
          </div>
          <div>
            © 2026 LeadQualif. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
