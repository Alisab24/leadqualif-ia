/**
 * MandatIAGenerator — Génération IA des clauses de mandat
 * Phase 3 : Suggestions de clauses + prix via GPT-4o-mini
 *
 * Usage :
 *   <MandatIAGenerator lead={lead} agency={agency} onClauses={handleClauses} />
 */
import React, { useState } from 'react'
import { aiService } from '../services/ai'

// ─── Icônes légères inline ────────────────────────────────────────────────────
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM5 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>
  </svg>
)

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
  </svg>
)

// ─── Composant ────────────────────────────────────────────────────────────────
export default function MandatIAGenerator({ lead = {}, agency = {}, onClauses }) {
  const [loading, setLoading]   = useState(false)
  const [clauses, setClauses]   = useState(null)
  const [error, setError]       = useState(null)
  const [expanded, setExpanded] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await aiService.generateMandatClauses(lead, agency)
      setClauses(result)
      setExpanded(true)
      if (onClauses) onClauses(result)
    } catch (err) {
      console.error('MandatIAGenerator error:', err)
      setError('Erreur lors de la génération. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Rendu d'une liste de clauses ──────────────────────────────────────────
  const ClauseList = ({ items = [] }) => (
    <ul className="space-y-1 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <span className="mt-0.5 text-green-500 flex-shrink-0"><CheckIcon /></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )

  // ─── Badge IA / Fallback ───────────────────────────────────────────────────
  const Badge = ({ generated }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      generated
        ? 'bg-purple-100 text-purple-700'
        : 'bg-gray-100 text-gray-600'
    }`}>
      <SparklesIcon />
      {generated ? 'Clauses IA' : 'Clauses standard'}
    </span>
  )

  return (
    <div className="border border-purple-200 rounded-xl bg-purple-50 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600 rounded-lg text-white">
            <SparklesIcon />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Générer les clauses avec l'IA</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Clauses personnalisées + suggestions de prix basées sur le profil du lead
            </p>
          </div>
        </div>

        <button
          onClick={clauses ? () => setExpanded(e => !e) : handleGenerate}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            loading
              ? 'bg-purple-300 text-white cursor-wait'
              : clauses
              ? 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50'
              : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Génération…
            </>
          ) : clauses ? (
            expanded ? '▲ Réduire' : '▼ Voir les clauses'
          ) : (
            <>
              <SparklesIcon />
              Générer
            </>
          )}
        </button>
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div className="mx-5 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Résultats ── */}
      {clauses && expanded && (
        <div className="border-t border-purple-200 bg-white px-5 py-5 space-y-5">

          <div className="flex items-center justify-between">
            <Badge generated={clauses.ia_generated} />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs text-purple-600 hover:underline disabled:opacity-50"
            >
              ↺ Regénérer
            </button>
          </div>

          {/* Objet */}
          <section>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Objet du mandat</h4>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{clauses.objet_mandat}</p>
          </section>

          {/* Prix + Commission */}
          <div className="grid grid-cols-2 gap-4">
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Prix suggéré</h4>
              <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-lg p-3">{clauses.prix_suggere}</p>
            </section>
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Commission</h4>
              <p className="text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg p-3">{clauses.commission}</p>
            </section>
          </div>

          {/* Durée + Exclusivité */}
          <div className="grid grid-cols-2 gap-4">
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Durée</h4>
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{clauses.duree}</p>
            </section>
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Type</h4>
              <p className={`text-sm font-semibold rounded-lg p-3 ${
                clauses.exclusivite
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-gray-50 text-gray-700'
              }`}>
                {clauses.exclusivite ? '🔒 Mandat exclusif' : '📋 Mandat simple'}
              </p>
            </section>
          </div>

          {/* Clause d'exclusivité */}
          {clauses.clause_exclusivite && (
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Clause d'exclusivité</h4>
              <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3 italic">
                {clauses.clause_exclusivite}
              </p>
            </section>
          )}

          {/* Obligations */}
          <div className="grid grid-cols-2 gap-4">
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Obligations du mandataire</h4>
              <div className="bg-blue-50 rounded-lg p-3">
                <ClauseList items={clauses.obligations_mandataire} />
              </div>
            </section>
            <section>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Obligations du mandant</h4>
              <div className="bg-gray-50 rounded-lg p-3">
                <ClauseList items={clauses.obligations_mandant} />
              </div>
            </section>
          </div>

          {/* Résiliation */}
          <section>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Clause de résiliation</h4>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{clauses.clause_resiliation}</p>
          </section>

          {/* Mentions ALUR */}
          <section>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Mentions légales ALUR</h4>
            <p className="text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-lg p-3">{clauses.mentions_alur}</p>
          </section>

          {/* Recommandation agent */}
          {clauses.recommandation_agent && (
            <section className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">💡 Recommandation pour l'agent</h4>
              <p className="text-sm text-gray-800 bg-purple-50 rounded-lg p-3">{clauses.recommandation_agent}</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
