import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Settings() {
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if(user) {
        setUserId(user.id);
        getSettings(user.id);
      }
    });
  }, []);

  const getSettings = async (id) => {
    const { data } = await supabase.from('profiles').select('calendly_link').eq('user_id', id).single();
    if(data?.calendly_link) setLink(data.calendly_link);
  };

  const saveSettings = async () => {
    setLoading(true);
    await supabase.from('profiles').update({ calendly_link: link }).eq('user_id', userId);
    setLoading(false);
    alert('Sauvegardé !');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">⚙️ Paramètres</h1>
          <p className="text-slate-600">Gérez les paramètres de votre application</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lien Calendly
              </label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://calendly.com/votre-agence"
              />
              <p className="text-xs text-slate-500 mt-1">
                Lien pour la prise de RDV automatique
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
