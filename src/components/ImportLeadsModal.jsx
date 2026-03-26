/**
 * ImportLeadsModal — Import de leads depuis un fichier CSV ou Excel
 * Flux : Upload → Prévisualisation + validation → Import Supabase → Résultats
 */
import React, { useState, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

// ── Colonnes acceptées (noms flexibles) ───────────────────────────
const COL_MAP = {
  nom:               ['nom', 'name', 'prenom nom', 'prénom nom', 'full name', 'contact', 'client'],
  email:             ['email', 'mail', 'e-mail', 'courriel'],
  telephone:         ['telephone', 'téléphone', 'tel', 'tél', 'phone', 'mobile'],
  source:            ['source', 'origine', 'canal', 'provenance'],
  statut:            ['statut', 'status', 'état', 'etat', 'stage'],
  budget:            ['budget', 'prix', 'price', 'montant', 'budget immo', 'budget immobilier'],
  budget_marketing:  ['budget marketing', 'budget_marketing', 'retainer', 'mensuel', 'forfait'],
  secteur_activite:  ['secteur', 'secteur activite', 'secteur_activite', 'industrie', 'industry', 'domaine'],
  type_service:      ['type service', 'type_service', 'service', 'prestation'],
  adresse:           ['adresse', 'address', 'ville', 'city', 'localisation'],
  notes:             ['notes', 'note', 'commentaire', 'commentaires', 'description', 'remarque'],
  score:             ['score', 'score ia', 'score_ia', 'note lead'],
}

// Normalise un header de colonne CSV
const normalizeHeader = (h) => (h || '').toLowerCase().trim()
  .replace(/[_\-\s]+/g, ' ')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Résout le champ NexaPro pour un header CSV donné
const resolveField = (header) => {
  const h = normalizeHeader(header)
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    if (aliases.some(a => normalizeHeader(a) === h || h.includes(normalizeHeader(a)))) return field
  }
  return null
}

// Statuts valides
const STATUTS_VALIDES = ['À traiter', 'Contacté', 'RDV planifié', 'En négociation', 'Gagné', 'Perdu', 'Archivé']
const SOURCES_VALIDES = ['site_web', 'facebook_ads', 'google_ads', 'instagram', 'linkedin',
                         'referral', 'bouche_a_oreille', 'tiktok', 'youtube', 'email', 'autre']

// ── Template CSV téléchargeable ───────────────────────────────────
const TEMPLATE_IMMO = [
  ['nom', 'email', 'telephone', 'budget', 'statut', 'source', 'adresse', 'notes'],
  ['Jean Dupont', 'jean@email.com', '0601020304', '350000', 'À traiter', 'site_web', 'Lyon 69000', 'Recherche T3 avec jardin'],
  ['Marie Martin', 'marie@email.com', '0612345678', '180000', 'Contacté', 'facebook_ads', 'Paris 75001', 'Primo-accédant'],
]
const TEMPLATE_SMMA = [
  ['nom', 'email', 'telephone', 'budget_marketing', 'secteur_activite', 'statut', 'source', 'notes'],
  ['Restaurant Le Bon', 'contact@lebon.fr', '0601020304', '1500', 'restauration', 'À traiter', 'instagram', 'Veut développer sa visibilité'],
  ['E-shop Mode', 'hello@mode.fr', '0712345678', '2500', 'e-commerce', 'Contacté', 'google_ads', 'Budget publicitaire disponible'],
]

const downloadTemplate = (agencyType) => {
  const rows = agencyType === 'smma' ? TEMPLATE_SMMA : TEMPLATE_IMMO
  const csv  = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `template_import_leads_${agencyType}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Composant principal ───────────────────────────────────────────
export default function ImportLeadsModal({ onClose, onSuccess, agencyId, agencyType = 'immobilier' }) {
  const [step, setStep]         = useState('upload')  // upload | preview | importing | done
  const [parsedRows, setParsedRows] = useState([])
  const [fieldMap, setFieldMap] = useState({})         // { csvHeader: nexapField }
  const [errors, setErrors]     = useState([])
  const [results, setResults]   = useState(null)       // { ok, failed, total }
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  // ── Parsing ─────────────────────────────────────────────────────
  const parseFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data, meta }) => processRows(data, meta.fields || []),
        error: (err) => setErrors([`Erreur lecture CSV : ${err.message}`]),
      })
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb    = XLSX.read(e.target.result, { type: 'array' })
          const ws    = wb.Sheets[wb.SheetNames[0]]
          const data  = XLSX.utils.sheet_to_json(ws, { defval: '' })
          const cols  = data.length > 0 ? Object.keys(data[0]) : []
          processRows(data, cols)
        } catch (err) {
          setErrors([`Erreur lecture Excel : ${err.message}`])
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setErrors(['Format non supporté. Utilisez un fichier .csv, .xlsx ou .xls'])
    }
  }

  const processRows = (data, headers) => {
    if (data.length === 0) {
      setErrors(['Le fichier est vide ou ne contient pas de données.'])
      return
    }
    // Construire la map header → champ NexaPro
    const map = {}
    headers.forEach(h => {
      const field = resolveField(h)
      if (field) map[h] = field
    })
    setFieldMap(map)
    setParsedRows(data.slice(0, 500))  // max 500 leads par import
    setErrors([])
    setStep('preview')
  }

  // ── Conversion ligne CSV → objet lead ───────────────────────────
  const rowToLead = (row) => {
    const get = (field) => {
      const header = Object.entries(fieldMap).find(([, f]) => f === field)?.[0]
      return header ? (row[header] || '').toString().trim() : ''
    }

    const nom = get('nom')
    if (!nom) return null   // ligne ignorée si pas de nom

    const budgetRaw = get('budget')
    const budgetMktRaw = get('budget_marketing')

    const statut = STATUTS_VALIDES.includes(get('statut')) ? get('statut') : 'À traiter'
    const source = SOURCES_VALIDES.includes(get('source')) ? get('source') : 'autre'

    return {
      agency_id:        agencyId,
      nom:              nom,
      email:            get('email') || null,
      telephone:        get('telephone') || null,
      statut,
      source,
      budget:           budgetRaw ? (parseInt(budgetRaw.replace(/[^0-9]/g, '')) || null) : null,
      budget_marketing: budgetMktRaw || null,
      secteur_activite: get('secteur_activite') || null,
      type_service:     get('type_service') || null,
      adresse:          get('adresse') || null,
      message:          get('notes') || null,   // colonne DB = message (pas notes)
      score:            get('score') ? (parseInt(get('score')) || null) : null,
      score_qualification: get('score') ? (parseInt(get('score')) || null) : null,
      created_at:       new Date().toISOString(),
    }
  }

  // ── Import Supabase ──────────────────────────────────────────────
  const handleImport = async () => {
    setStep('importing')
    const leads = parsedRows.map(rowToLead).filter(Boolean)

    if (leads.length === 0) {
      setErrors(['Aucun lead valide trouvé (colonne "nom" obligatoire).'])
      setStep('preview')
      return
    }

    // Insérer par batchs de 50
    let ok = 0
    let failed = 0
    const BATCH = 50
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH)
      const { error } = await supabase.from('leads').insert(batch)
      if (error) {
        console.error('Batch error:', error)
        failed += batch.length
      } else {
        ok += batch.length
      }
    }

    setResults({ ok, failed, total: leads.length })
    setStep('done')
    if (ok > 0 && onSuccess) onSuccess(ok)
  }

  // ── Prévisualisation ─────────────────────────────────────────────
  const validLeads  = parsedRows.filter(r => {
    const h = Object.entries(fieldMap).find(([, f]) => f === 'nom')?.[0]
    return h && (r[h] || '').toString().trim() !== ''
  })
  const skippedCount = parsedRows.length - validLeads.length

  // ── UI helpers ────────────────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📥</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Importer des leads</h2>
              <p className="text-xs text-slate-400">CSV ou Excel · max 500 leads par import</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Étapes */}
            <div className="hidden sm:flex items-center gap-1 text-xs">
              {['upload', 'preview', 'done'].map((s, i) => (
                <React.Fragment key={s}>
                  <span className={`px-2 py-1 rounded-full font-semibold ${
                    step === s || (step === 'importing' && s === 'preview')
                      ? 'bg-indigo-600 text-white'
                      : ['preview', 'done'].indexOf(s) <= ['upload', 'preview', 'importing', 'done'].indexOf(step) - 1
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {i + 1}. {s === 'upload' ? 'Fichier' : s === 'preview' ? 'Vérifier' : 'Résultat'}
                  </span>
                  {i < 2 && <span className="text-slate-300">→</span>}
                </React.Fragment>
              ))}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── ÉTAPE 1 : Upload ─────────────────────────── */}
          {step === 'upload' && (
            <div className="space-y-5 max-w-lg mx-auto">

              {/* Zone de dépôt */}
              <div
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && parseFile(e.target.files[0])}
                />
                <div className="text-5xl mb-3">📂</div>
                <p className="text-base font-semibold text-slate-700">Glissez votre fichier ici</p>
                <p className="text-sm text-slate-400 mt-1">ou cliquez pour sélectionner</p>
                <p className="text-xs text-slate-300 mt-3">Formats : .csv · .xlsx · .xls</p>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  {errors.map((e, i) => <p key={i}>⚠️ {e}</p>)}
                </div>
              )}

              {/* Télécharger template */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  📋 Pas de fichier prêt ? Téléchargez notre template
                </p>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => downloadTemplate('immobilier')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
                  >
                    🏠 Template Immobilier
                  </button>
                  <button
                    onClick={() => downloadTemplate('smma')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors"
                  >
                    📱 Template SMMA
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Les colonnes obligatoires sont : <strong>nom</strong>. Toutes les autres sont optionnelles.
                </p>
              </div>

              {/* Colonnes reconnues */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Colonnes reconnues automatiquement</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COL_MAP).map(([field, aliases]) => (
                    <span key={field} className="px-2 py-1 bg-white border border-blue-100 rounded-lg text-xs text-slate-600">
                      <span className="font-semibold text-blue-700">{field}</span>
                      <span className="text-slate-400"> · {aliases[0]}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : Prévisualisation ──────────────── */}
          {(step === 'preview' || step === 'importing') && (
            <div className="space-y-4">

              {/* Résumé */}
              <div className="flex flex-wrap gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-xl font-bold text-green-700">{validLeads.length}</p>
                    <p className="text-xs text-green-600">leads valides</p>
                  </div>
                </div>
                {skippedCount > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-xl font-bold text-yellow-700">{skippedCount}</p>
                      <p className="text-xs text-yellow-600">lignes ignorées (sans nom)</p>
                    </div>
                  </div>
                )}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span className="text-lg">🗂️</span>
                  <div>
                    <p className="text-sm font-bold text-slate-600">
                      {Object.values(fieldMap).filter(Boolean).join(', ') || 'Aucune colonne reconnue'}
                    </p>
                    <p className="text-xs text-slate-400">colonnes mappées</p>
                  </div>
                </div>
              </div>

              {Object.keys(fieldMap).length === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  ⚠️ Aucune colonne reconnue. Vérifiez que vos en-têtes correspondent aux noms attendus ou utilisez notre template.
                </div>
              )}

              {/* Table de prévisualisation */}
              {validLeads.length > 0 && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">#</th>
                        {Object.entries(fieldMap).map(([header, field]) => (
                          <th key={header} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                            <span className="text-indigo-600">{field}</span>
                            <span className="text-slate-300 font-normal ml-1">({header})</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {validLeads.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                          {Object.keys(fieldMap).map((header) => (
                            <td key={header} className="px-3 py-2 text-slate-700 max-w-[160px] truncate">
                              {row[header] || <span className="text-slate-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validLeads.length > 10 && (
                    <div className="px-4 py-2 bg-slate-50 text-xs text-slate-400 border-t border-slate-100">
                      … et {validLeads.length - 10} autres leads (aperçu limité à 10 lignes)
                    </div>
                  )}
                </div>
              )}

              {step === 'importing' && (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 shrink-0" />
                  <p className="text-sm font-medium text-indigo-700">Import en cours… ne fermez pas cette fenêtre.</p>
                </div>
              )}
            </div>
          )}

          {/* ── ÉTAPE 3 : Résultats ─────────────────────── */}
          {step === 'done' && results && (
            <div className="space-y-4 max-w-md mx-auto text-center">
              <div className="text-6xl mb-2">{results.failed === 0 ? '🎉' : '⚠️'}</div>
              <h3 className="text-xl font-bold text-slate-900">Import terminé</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                  <p className="text-4xl font-black text-green-600">{results.ok}</p>
                  <p className="text-sm text-green-700 font-medium mt-1">leads importés</p>
                </div>
                <div className={`rounded-2xl p-5 border ${results.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-4xl font-black ${results.failed > 0 ? 'text-red-600' : 'text-slate-300'}`}>{results.failed}</p>
                  <p className={`text-sm font-medium mt-1 ${results.failed > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                    {results.failed > 0 ? 'erreurs' : 'aucune erreur'}
                  </p>
                </div>
              </div>

              {results.failed > 0 && (
                <p className="text-sm text-slate-500">
                  Les leads en erreur n'ont pas été importés. Vérifiez votre fichier et réessayez.
                </p>
              )}

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
                >
                  Voir mes leads →
                </button>
                <button
                  onClick={() => { setStep('upload'); setParsedRows([]); setResults(null); setErrors([]) }}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Nouvel import
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(step === 'preview') && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <button
              onClick={() => { setStep('upload'); setParsedRows([]); setErrors([]) }}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              ← Changer de fichier
            </button>
            <button
              onClick={handleImport}
              disabled={validLeads.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm
                         hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              📥 Importer {validLeads.length} lead{validLeads.length > 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
