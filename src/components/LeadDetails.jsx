import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { aiService } from '../services/ai'
import { formatDate, formatPhone, formatCurrency, getScoreColor, getUrgencyColor, getInterestLevelColor, getInterestLevelIcon, getInterestLevelDescription } from '../utils/format'

const LeadDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState('')
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [error, setError] = useState(null)

  const calendlyUrl = import.meta.env.VITE_CALENDLY_URL || 'https://calendly.com'

  useEffect(() => {
    loadLead()
  }, [id])

  const loadLead = async () => {
    try {
      setLoading(true)
      const { data: leadData, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      
      setLead(leadData)
      
      // Générer le résumé IA si pas déjà présent
      if (!leadData.resume_ia && leadData) {
        generateAISummary(leadData)
      } else if (leadData.resume_ia) {
        setSummary(leadData.resume_ia)
      }
    } catch (err) {
      console.error('Erreur lors du chargement du lead:', err)
      setError('Impossible de charger les détails du lead')
    } finally {
      setLoading(false)
    }
  }

  const generateAISummary = async (leadData) => {
    try {
      setGeneratingSummary(true)
      const aiSummary = await aiService.generateLeadSummary(leadData)
      setSummary(aiSummary)
      
      // Sauvegarder le résumé dans la base de données
      const { error: updateError } = await supabase
        .from('leads')
        .update({ resume_ia: aiSummary })
        .eq('id', id)
      
      if (updateError) throw updateError
    } catch (err) {
      console.error('Erreur lors de la génération du résumé:', err)
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleCalendlyClick = () => {
    window.open(calendlyUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error || 'Lead introuvable'}</p>
            <button onClick={() => navigate('/')} className="btn-primary">
              Retour au dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour au dashboard
        </button>
        <button
          onClick={handleCalendlyClick}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Proposer un RDV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Badge de classification */}
          {lead.niveau_interet && (
            <div className="card bg-gradient-to-r from-white to-gray-50 border-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{getInterestLevelIcon(lead.niveau_interet)}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700">Classification du lead</h3>
                    <p className="text-sm text-gray-500 mt-1">{getInterestLevelDescription(lead.niveau_interet)}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-bold border-2 ${getInterestLevelColor(lead.niveau_interet)}`}>
                  <span>{getInterestLevelIcon(lead.niveau_interet)}</span>
                  {lead.niveau_interet}
                </span>
              </div>
            </div>
          )}

          {/* Informations principales */}
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Informations du lead</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Nom complet</label>
                <p className="mt-1 text-lg text-gray-900">{lead.nom}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-lg text-gray-900">{lead.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Téléphone</label>
                <p className="mt-1 text-lg text-gray-900">{formatPhone(lead.telephone)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Source</label>
                <p className="mt-1 text-lg text-gray-900 capitalize">{lead.source?.replace('_', ' ') || 'Non spécifiée'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500">Message / Besoins</label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{lead.message || 'Aucun message'}</p>
              </div>
            </div>
          </div>

          {/* Résumé IA */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Résumé IA
              </h2>
              {!summary && !generatingSummary && (
                <button
                  onClick={() => generateAISummary(lead)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Générer
                </button>
              )}
            </div>
            {generatingSummary ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : summary ? (
              <p className="text-gray-700 leading-relaxed">{summary}</p>
            ) : (
              <p className="text-gray-400 italic">Aucun résumé disponible</p>
            )}
          </div>

          {/* Qualification détaillée */}
          {lead.qualification_data && (
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Analyse de qualification</h2>
              
              {lead.points_forts && lead.points_forts.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Points forts</h3>
                  <ul className="space-y-2">
                    {lead.points_forts.map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lead.points_attention && lead.points_attention.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Points d'attention</h3>
                  <ul className="space-y-2">
                    {lead.points_attention.map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lead.recommandations && lead.recommandations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommandations</h3>
                  <ul className="space-y-2">
                    {lead.recommandations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Score et métriques */}
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Métriques</h3>
            <div className="space-y-4">
              {lead.niveau_interet && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Niveau d'intérêt</label>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-base font-bold border ${getInterestLevelColor(lead.niveau_interet)}`}>
                      <span>{getInterestLevelIcon(lead.niveau_interet)}</span>
                      {lead.niveau_interet}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{getInterestLevelDescription(lead.niveau_interet)}</p>
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Score IA <span className="text-gray-400 cursor-help" title="Calculé automatiquement par l'IA selon le profil et la probabilité de conversion du lead.">ℹ️</span></label>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-lg font-bold ${getScoreColor(lead.score_qualification || 0)}`}>
                    {lead.score_qualification || 0}/100
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Budget estimé</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">{lead.budget_estime || 'Non spécifié'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Urgence</label>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(lead.urgence)}`}>
                    {lead.urgence || 'Non spécifiée'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Type de bien recherché</label>
                <p className="mt-1 text-gray-900 capitalize">{lead.type_bien_recherche || 'Non spécifié'}</p>
              </div>
              {lead.localisation_souhaitee && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Localisation souhaitée</label>
                  <p className="mt-1 text-gray-900">{lead.localisation_souhaitee}</p>
                </div>
              )}
            </div>
          </div>

          {/* Informations système */}
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Informations</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-500">Date de création</label>
                <p className="text-gray-900">{formatDate(lead.created_at)}</p>
              </div>
              {lead.updated_at && (
                <div>
                  <label className="text-gray-500">Dernière mise à jour</label>
                  <p className="text-gray-900">{formatDate(lead.updated_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeadDetails

