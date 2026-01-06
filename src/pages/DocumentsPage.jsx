import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import DocumentManager from '../components/DocumentManager'; // On réutilise le moteur !

export default function DocumentsPage() {
  // Page simple qui affiche tous les documents de l'agence (vue globale)
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center py-20">
      <span className="text-6xl mb-4 block">🏗️</span>
      <h3 className="text-xl font-bold text-slate-800">Espace Global en construction</h3>
      <p className="text-slate-500 mt-2">Pour générer un document, allez sur le <b>Dashboard</b> et cliquez sur un Lead.</p>
    </div>
  );
}
