import React from 'react';

export default function FallbackPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="text-center">
          <span className="text-8xl mb-6 block">🔧</span>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Configuration Requise</h1>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6 text-left">
            <h2 className="text-lg font-semibold text-amber-800 mb-3">⚠️ Variables d'Environnement Manquantes</h2>
            <p className="text-amber-700 mb-4">
              L'application nécessite la configuration des variables d'environnement Supabase pour fonctionner.
            </p>
            
            <div className="space-y-2 text-sm text-amber-600">
              <p><strong>VITE_SUPABASE_URL:</strong> URL de votre projet Supabase</p>
              <p><strong>VITE_SUPABASE_ANON_KEY:</strong> Clé anonyme de votre projet Supabase</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h2 className="text-lg font-semibold text-blue-800 mb-3">🚀 Pour les développeurs</h2>
            <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
              <li>Copiez <code className="bg-blue-100 px-2 py-1 rounded">.env.example</code> vers <code className="bg-blue-100 px-2 py-1 rounded">.env.local</code></li>
              <li>Remplissez les variables avec vos vraies valeurs Supabase</li>
              <li>Redémarrez le serveur de développement</li>
            </ol>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-left">
            <h2 className="text-lg font-semibold text-green-800 mb-3">☁️ Pour le déploiement (Vercel)</h2>
            <ol className="text-sm text-green-700 space-y-2 list-decimal list-inside">
              <li>Allez dans les settings de votre projet Vercel</li>
              <li>Ajoutez les variables d'environnement dans "Environment Variables"</li>
              <Li>Redéployez l'application</Li>
            </ol>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🔄 Actualiser la page
            </button>
            <button
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              🗄️ Ouvrir Supabase Dashboard
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Si vous êtes un utilisateur et voyez cette page, veuillez contacter l'administrateur de l'application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
