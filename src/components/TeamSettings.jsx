/**
 * TeamSettings — Gestion des membres de l'équipe par agence
 * Fonctionnalités : liste membres, inviter par lien, révoquer accès
 */
import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { usePlanGuard } from './PlanGuard'

// Limites membres par plan (hors propriétaire)
const TEAM_LIMITS = {
  free:       0,
  starter:    2,
  growth:     5,
  enterprise: null,  // illimité
  trialing:   5,
}

const ROLE_LABELS = {
  owner:  { label: 'Propriétaire', color: 'bg-indigo-100 text-indigo-700', icon: '👑' },
  admin:  { label: 'Admin',        color: 'bg-purple-100 text-purple-700', icon: '🔧' },
  agent:  { label: 'Agent',        color: 'bg-blue-100 text-blue-700',     icon: '👤' },
  viewer: { label: 'Lecture seule',color: 'bg-slate-100 text-slate-600',   icon: '👁' },
}

const ROLE_DESC = {
  admin:  'Accès complet sauf facturation et gestion des membres',
  agent:  'Peut créer et gérer des leads, générer des documents',
  viewer: 'Lecture seule — ne peut pas modifier les données',
}

export default function TeamSettings() {
  const { userPlan, canAccess } = usePlanGuard()
  const [members, setMembers]         = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('agent')
  const [inviting, setInviting]       = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)
  const [toast, setToast]             = useState(null)
  // Résolu depuis Supabase Auth — pas de props
  const [agencyId, setAgencyId]         = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  const limit         = TEAM_LIMITS[userPlan] ?? 0
  const canInvite     = canAccess('multiUsers') || limit > 0
  const activeMembers = members.filter(m => m.role !== 'owner')
  const hasRoom       = limit === null || activeMembers.length < limit
  // L'owner voit toujours ses membres (la liste est accessible sur tous les plans)
  const showMembers   = true

  // Init unique au montage : résoudre user + charger équipe en une seule passe
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        // 1. Récupérer l'utilisateur connecté
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) { setLoading(false); return }

        const uid = user.id
        setCurrentUserId(uid)

        // 2. Récupérer son profil pour obtenir agency_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', uid)
          .maybeSingle()

        if (cancelled) return
        const aid = profile?.agency_id || null
        setAgencyId(aid)

        // 3. Charger l'équipe directement (valeurs locales, pas depuis le state)
        await loadTeam(aid, uid)
      } catch (err) {
        console.error('[TeamSettings] init:', err)
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Chargement équipe — reçoit les valeurs directement pour éviter les closures stale
  const loadTeam = async (aid, uid) => {
    setLoading(true)
    try {
      // ── 1. Toujours charger son propre profil en premier ─────────────
      const { data: selfProfile } = await supabase
        .from('profiles')
        .select('id, user_id, nom_agence, nom_complet, email, created_at')
        .eq('user_id', uid)
        .maybeSingle()

      const self = selfProfile ? { ...selfProfile, role: 'owner' } : null

      // ── 2. Autres membres de l'agence (si agency_id connu) ───────────
      let others = []
      if (aid) {
        // Essai avec colonne role
        const { data: withRole, error: roleErr } = await supabase
          .from('profiles')
          .select('id, user_id, nom_agence, nom_complet, email, role, created_at')
          .eq('agency_id', aid)
          .neq('user_id', uid)
          .order('created_at', { ascending: true })

        if (!roleErr) {
          others = withRole || []
        } else {
          // Fallback sans role (migration ADD_MULTI_USERS.sql pas encore exécutée)
          console.warn('[TeamSettings] fallback sans colonne role:', roleErr.message)
          const { data: withoutRole } = await supabase
            .from('profiles')
            .select('id, user_id, nom_agence, nom_complet, email, created_at')
            .eq('agency_id', aid)
            .neq('user_id', uid)
            .order('created_at', { ascending: true })
          others = (withoutRole || []).map(m => ({ ...m, role: 'agent' }))
        }
      }

      // ── 3. Liste finale : self toujours en premier ────────────────────
      setMembers([...(self ? [self] : []), ...others])

      // ── 4. Invitations en attente ─────────────────────────────────────
      if (aid) {
        try {
          const { data: invites } = await supabase
            .from('agency_invitations')
            .select('*')
            .eq('agency_id', aid)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
          setInvitations(invites || [])
        } catch { setInvitations([]) }
      }
    } catch (err) {
      console.error('[TeamSettings] loadTeam:', err)
    } finally {
      setLoading(false)
    }
  }

  // Wrapper pour le bouton "rafraîchir" (utilise les states courants)
  const fetchTeam = () => loadTeam(agencyId, currentUserId)

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    if (!inviteEmail.includes('@')) {
      showToast('Adresse email invalide', 'error')
      return
    }
    if (!hasRoom) {
      showToast(`Limite de ${limit} membres atteinte pour votre plan`, 'error')
      return
    }

    setInviting(true)
    try {
      // Vérifier si déjà membre
      const alreadyMember = members.some(m => m.email?.toLowerCase() === inviteEmail.toLowerCase())
      if (alreadyMember) {
        showToast('Cet utilisateur est déjà membre de votre agence', 'error')
        return
      }

      // Vérifier si invitation déjà envoyée
      const alreadyInvited = invitations.some(i => i.email?.toLowerCase() === inviteEmail.toLowerCase())
      if (alreadyInvited) {
        showToast('Une invitation est déjà en attente pour cet email', 'error')
        return
      }

      const { data, error } = await supabase
        .from('agency_invitations')
        .insert({
          agency_id:  agencyId,
          invited_by: currentUserId,
          email:      inviteEmail.trim().toLowerCase(),
          role:       inviteRole,
        })
        .select()
        .single()

      if (error) throw error

      setInviteEmail('')
      await fetchTeam()
      showToast(`Invitation créée pour ${data.email}`)
    } catch (err) {
      console.error('Erreur invitation:', err)
      showToast('Erreur lors de la création de l\'invitation', 'error')
    } finally {
      setInviting(false)
    }
  }

  const copyInviteLink = (token) => {
    const link = `${window.location.origin}/join/${token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2500)
      showToast('Lien d\'invitation copié !')
    })
  }

  const revokeInvitation = async (id) => {
    const { error } = await supabase
      .from('agency_invitations')
      .update({ status: 'revoked' })
      .eq('id', id)

    if (!error) {
      setInvitations(prev => prev.filter(i => i.id !== id))
      showToast('Invitation révoquée')
    }
  }

  const updateMemberRole = async (profileId, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)

    if (!error) {
      setMembers(prev => prev.map(m => m.id === profileId ? { ...m, role: newRole } : m))
      showToast('Rôle mis à jour')
    }
  }

  const removeMember = async (profileId, email) => {
    if (!window.confirm(`Retirer ${email} de l'équipe ? Leur compte reste actif mais ils n'auront plus accès à vos données.`)) return

    const { error } = await supabase
      .from('profiles')
      .update({ agency_id: null })  // détache de l'agence
      .eq('id', profileId)

    if (!error) {
      setMembers(prev => prev.filter(m => m.id !== profileId))
      showToast(`${email} retiré de l'équipe`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white
          ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Bandeau plan */}
      <div className={`rounded-xl p-4 border flex items-start gap-3 ${
        canInvite ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <span className="text-xl shrink-0">{canInvite ? '👥' : '🔒'}</span>
        <div className="flex-1">
          {canInvite ? (
            <>
              <p className="text-sm font-bold text-indigo-800">
                Équipe activée — Plan {userPlan}
              </p>
              <p className="text-xs text-indigo-600 mt-0.5">
                {limit === null
                  ? `${members.length} membre${members.length > 1 ? 's' : ''} · membres illimités`
                  : `${activeMembers.length} / ${limit} membre${limit > 1 ? 's' : ''} supplémentaire${limit > 1 ? 's' : ''} utilisé${activeMembers.length > 1 ? 's' : ''}`
                }
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-amber-800">
                Multi-utilisateurs non disponible sur le plan Free
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Passez à un plan payant pour inviter des collègues dans votre espace.
              </p>
            </>
          )}
        </div>
        {!canInvite && (
          <a href="/settings?tab=facturation" className="shrink-0 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors">
            Upgrader →
          </a>
        )}
      </div>

      {/* ── Membres actuels ──────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Membres de l'équipe ({members.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {members.map((m) => {
            const isMe      = m.user_id === currentUserId
            const isOwner   = m.role === 'owner'
            const roleInfo  = ROLE_LABELS[m.role] || ROLE_LABELS.agent
            return (
              <div key={m.id} className="px-5 py-3.5 flex items-center gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
                  {(m.nom_complet || m.email || '?').charAt(0).toUpperCase()}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {m.nom_complet || m.nom_agence || m.email}
                    {isMe && <span className="ml-2 text-xs text-slate-400 font-normal">(vous)</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{m.email}</p>
                </div>

                {/* Rôle */}
                <div className="shrink-0">
                  {isOwner || isMe ? (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${roleInfo.color}`}>
                      {roleInfo.icon} {roleInfo.label}
                    </span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={(e) => updateMemberRole(m.id, e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="admin">🔧 Admin</option>
                      <option value="agent">👤 Agent</option>
                      <option value="viewer">👁 Lecture seule</option>
                    </select>
                  )}
                </div>

                {/* Retirer */}
                {!isOwner && !isMe && (
                  <button
                    onClick={() => removeMember(m.id, m.email)}
                    className="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Retirer de l'équipe"
                  >
                    🗑
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Inviter un membre ─────────────────────────────── */}
      {canInvite && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">
            ✉️ Inviter un nouveau membre
          </h3>

          {!hasRoom ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              ⚠️ Vous avez atteint la limite de {limit} membre{limit > 1 ? 's' : ''} pour votre plan.{' '}
              <a href="/settings?tab=facturation" className="font-semibold underline">Upgrader</a> pour en ajouter davantage.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="prenom@email.com"
                className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="agent">👤 Agent</option>
                <option value="admin">🔧 Admin</option>
                <option value="viewer">👁 Lecture seule</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl
                           hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {inviting ? '…' : '➕ Inviter'}
              </button>
            </div>
          )}

          {/* Description des rôles */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(ROLE_DESC).map(([role, desc]) => (
              <div key={role} className="text-xs text-slate-400 flex items-start gap-1.5">
                <span>{ROLE_LABELS[role].icon}</span>
                <span><span className="font-semibold text-slate-600">{ROLE_LABELS[role].label}</span> — {desc}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Invitations en attente ────────────────────────── */}
      {invitations.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">
              ⏳ Invitations en attente ({invitations.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Copiez le lien et envoyez-le par email ou WhatsApp — valable 7 jours.
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {invitations.map((inv) => {
              const roleInfo   = ROLE_LABELS[inv.role] || ROLE_LABELS.agent
              const expiresIn  = Math.max(0, Math.ceil((new Date(inv.expires_at) - new Date()) / 86400000))
              const inviteLink = `${window.location.origin}/join/${inv.token}`
              return (
                <div key={inv.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-base shrink-0">
                    ✉️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{inv.email}</p>
                    <p className="text-xs text-slate-400">
                      <span className={`font-medium ${roleInfo.color.split(' ')[1]}`}>{roleInfo.icon} {roleInfo.label}</span>
                      {' · '}expire dans {expiresIn} jour{expiresIn > 1 ? 's' : ''}
                    </p>
                  </div>
                  {/* Lien invite */}
                  <div className="shrink-0 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                    <span className="text-xs font-mono text-slate-500 max-w-[120px] truncate hidden sm:block">
                      /join/{inv.token.slice(0, 8)}…
                    </span>
                    <button
                      onClick={() => copyInviteLink(inv.token)}
                      className={`px-2 py-0.5 text-xs font-semibold rounded transition-colors ${
                        copiedToken === inv.token
                          ? 'bg-green-500 text-white'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {copiedToken === inv.token ? '✓ Copié !' : '📋 Copier'}
                    </button>
                  </div>
                  {/* Révoquer */}
                  <button
                    onClick={() => revokeInvitation(inv.id)}
                    className="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Révoquer l'invitation"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Message si aucun membre ni invitation */}
      {members.length <= 1 && invitations.length === 0 && canInvite && (
        <div className="text-center py-6 text-slate-400 text-sm">
          <p className="text-3xl mb-2">👥</p>
          Invitez vos premiers collaborateurs pour travailler en équipe.
        </div>
      )}
    </div>
  )
}
