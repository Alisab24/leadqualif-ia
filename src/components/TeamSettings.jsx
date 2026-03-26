/**
 * TeamSettings — Gestion des membres de l'équipe par agence
 * Fonctionnalités : liste membres, inviter par lien, révoquer accès
 */
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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

export default function TeamSettings() {
  const { t } = useTranslation()
  const { userPlan, canAccess } = usePlanGuard()

  const ROLE_LABELS = {
    owner:  { label: t('team.roleOwner'),    color: 'bg-indigo-100 text-indigo-700', icon: '👑' },
    admin:  { label: t('team.roleAdmin'),    color: 'bg-purple-100 text-purple-700', icon: '🔧' },
    agent:  { label: t('team.roleAgent'),    color: 'bg-blue-100 text-blue-700',     icon: '👤' },
    viewer: { label: t('team.roleReadOnly'), color: 'bg-slate-100 text-slate-600',   icon: '👁' },
  }

  const ROLE_DESC = {
    admin:  t('team.roleDesc.admin'),
    agent:  t('team.roleDesc.agent'),
    viewer: t('team.roleDesc.viewer'),
  }
  const [members, setMembers]         = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('agent')
  const [inviting, setInviting]       = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)
  const [toast, setToast]             = useState(null)
  // Résolu depuis Supabase Auth — pas de props
  const [agencyId, setAgencyId]           = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  // ⚠️ Ne pas utiliser `?? 0` : l'opérateur ?? remplace aussi null par 0,
  // ce qui écrase la valeur null (= illimité) du plan enterprise.
  const limit         = userPlan in TEAM_LIMITS ? TEAM_LIMITS[userPlan] : 0
  const canInvite     = canAccess('multiUsers') || limit > 0
  const activeMembers = members.filter(m => m.role !== 'owner')
  const hasRoom       = limit === null || activeMembers.length < limit

  // ─── Init unique au montage ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr) console.error('[TeamSettings] auth error:', authErr)
        const user = authData?.user
        if (!user || cancelled) { setLoading(false); return }

        const uid = user.id
        console.log('[TeamSettings] uid:', uid)
        setCurrentUserId(uid)

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('user_id', uid)
          .maybeSingle()

        if (profileErr) console.warn('[TeamSettings] profile fetch error:', profileErr)
        if (cancelled) return

        const aid = profile?.agency_id || null
        console.log('[TeamSettings] agency_id:', aid)
        setAgencyId(aid)

        await loadTeam(aid, uid, user)
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

  // ─── Chargement équipe ───────────────────────────────────────────────────────
  // Note: profiles n'a pas de colonne `id` — on utilise user_id comme clé primaire
  const loadTeam = async (aid, uid, authUser = null) => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    try {
      // 1. Propre profil en premier (toujours accessible via user_id)
      const { data: selfProfile, error: selfErr } = await supabase
        .from('profiles')
        .select('user_id, nom_agence, nom_complet, email, created_at')
        .eq('user_id', uid)
        .maybeSingle()

      if (selfErr) console.warn('[TeamSettings] selfProfile error:', selfErr)
      console.log('[TeamSettings] selfProfile:', selfProfile)

      // Fallback si profil introuvable (utilise les données auth)
      const self = selfProfile
        ? { ...selfProfile, role: 'owner' }
        : authUser
          ? {
              user_id:     uid,
              email:       authUser.email,
              nom_complet: authUser.user_metadata?.full_name || authUser.email,
              nom_agence:  '',
              role:        'owner',
              created_at:  authUser.created_at,
            }
          : null

      // 2. Autres membres de l'agence
      let others = []
      if (aid) {
        // Essai avec colonne role (nécessite ADD_MULTI_USERS.sql)
        const { data: withRole, error: roleErr } = await supabase
          .from('profiles')
          .select('user_id, nom_agence, nom_complet, email, role, created_at')
          .eq('agency_id', aid)
          .neq('user_id', uid)
          .order('created_at', { ascending: true })

        if (!roleErr) {
          others = withRole || []
        } else {
          // Fallback sans role
          console.warn('[TeamSettings] fallback sans colonne role:', roleErr.message)
          const { data: withoutRole, error: noRoleErr } = await supabase
            .from('profiles')
            .select('user_id, nom_agence, nom_complet, email, created_at')
            .eq('agency_id', aid)
            .neq('user_id', uid)
            .order('created_at', { ascending: true })
          if (noRoleErr) console.warn('[TeamSettings] fallback error:', noRoleErr.message)
          others = (withoutRole || []).map(m => ({ ...m, role: 'agent' }))
        }
      }

      // 3. Liste finale : self toujours en premier
      setMembers([...(self ? [self] : []), ...others])

      // 4. Invitations en attente
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

  const fetchTeam = () => loadTeam(agencyId, currentUserId, null)

  // ─── Inviter ─────────────────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    if (!inviteEmail.includes('@')) {
      showToast(t('team.invalidEmail'), 'error')
      return
    }
    if (!hasRoom) {
      showToast(t('team.limitReached', { limit }), 'error')
      return
    }

    setInviting(true)
    try {
      const alreadyMember = members.some(m => m.email?.toLowerCase() === inviteEmail.toLowerCase())
      if (alreadyMember) {
        showToast(t('team.alreadyMember'), 'error')
        return
      }

      const alreadyInvited = invitations.some(i => i.email?.toLowerCase() === inviteEmail.toLowerCase())
      if (alreadyInvited) {
        showToast(t('team.alreadyInvited'), 'error')
        return
      }

      const { data: invitation, error } = await supabase
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

      const inviteLink = `${window.location.origin}/join/${invitation.token}`
      const agencyName = members.find(m => m.role === 'owner')?.nom_agence || 'LeadQualif'
      
      // Envoyer l'email d'invitation avec Resend
      const emailResponse = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          nom: agencyName,
          lienInvitation: inviteLink
        })
      })

      if (!emailResponse.ok) {
        console.warn('Email non envoyé:', await emailResponse.text())
        showToast(t('team.inviteCreatedNoEmail'))
      } else {
        showToast(t('team.inviteSent', { email: inviteEmail }))
      }

      setInviteEmail('')
      await fetchTeam()
    } catch (err) {
      console.error('Erreur invitation:', err)
      showToast(t('team.errors.inviteFailed'), 'error')
    } finally {
      setInviting(false)
    }
  }

  const copyInviteLink = (token) => {
    const link = `${window.location.origin}/join/${token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2500)
      showToast(t('common.copied'))
    })
  }

  // Révoquer une invitation en attente → DELETE (politique owner_delete_invitations)
  const revokeInvitation = async (id) => {
    const { error } = await supabase
      .from('agency_invitations')
      .delete()
      .eq('id', id)

    if (!error) {
      setInvitations(prev => prev.filter(i => i.id !== id))
      showToast(t('team.inviteRevoked'))
    } else {
      console.error('[revokeInvitation] error:', error)
      showToast('Erreur lors de la révocation de l\'invitation', 'error')
    }
  }

  // updateMemberRole et removeMember utilisent user_id (pas id)
  const updateMemberRole = async (memberUserId, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', memberUserId)

    if (!error) {
      setMembers(prev => prev.map(m => m.user_id === memberUserId ? { ...m, role: newRole } : m))
      showToast(t('team.roleUpdated'))
    } else {
      console.error('[updateMemberRole] error:', error)
      showToast('Erreur lors de la mise à jour du rôle', 'error')
    }
  }

  // Retirer un membre → met agency_id à null dans profiles
  // La politique profiles_owner_update_members autorise l'owner à faire cette mise à jour
  const removeMember = async (memberUserId, email) => {
    if (!window.confirm(t('team.removeConfirm', { name: email }))) return

    const { error } = await supabase
      .from('profiles')
      .update({ agency_id: null })
      .eq('user_id', memberUserId)

    if (!error) {
      setMembers(prev => prev.filter(m => m.user_id !== memberUserId))
      showToast(t('team.memberRemoved') || 'Membre retiré de l\'équipe')
    } else {
      console.error('[removeMember] error:', error)
      showToast('Erreur lors de la suppression du membre', 'error')
    }
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────────
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
              <p className="text-sm font-bold text-indigo-800">{t('team.teamActivated', { plan: userPlan })}</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                {limit === null
                  ? `${members.length} · ${t('team.unlimitedMembers')}`
                  : t('team.membersUsed', { used: activeMembers.length, limit })
                }
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-amber-800">{t('team.freePlanTitle')}</p>
              <p className="text-xs text-amber-700 mt-0.5">{t('team.freePlanDesc')}</p>
            </>
          )}
        </div>
        {!canInvite && (
          <a href="/settings?tab=facturation" className="shrink-0 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors">
            {t('team.upgradeBtn')}
          </a>
        )}
      </div>

      {/* ── Membres actuels ──────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            {t('team.memberCount', { count: members.length })}
          </h3>
          <button
            onClick={fetchTeam}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            {t('team.refresh')}
          </button>
        </div>

        {members.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-3xl mb-2">👤</p>
            <p className="text-sm text-slate-500 font-medium">{t('team.noMembersLoaded')}</p>
            <p className="text-xs text-slate-400 mt-1">
              {t('team.noMembersDesc')}
            </p>
            <button
              onClick={fetchTeam}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t('team.reloadTeam')}
            </button>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {members.map((m) => {
            const isMe          = m.user_id === currentUserId
            const isOwner       = m.role === 'owner'
            const amIOwner      = members.find(mb => mb.user_id === currentUserId)?.role === 'owner'
            const canEditRole   = amIOwner && !isOwner && !isMe  // seul l'owner peut changer les rôles
            const roleInfo      = ROLE_LABELS[m.role] || ROLE_LABELS.agent
            return (
              <div key={m.user_id} className="px-5 py-3.5 flex items-center gap-3">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isOwner ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {(m.nom_complet || m.email || '?').charAt(0).toUpperCase()}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {m.nom_complet || m.nom_agence || m.email}
                    {isMe && <span className="ml-2 text-xs text-slate-400 font-normal">{t('team.youLabel')}</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{m.email}</p>
                </div>

                {/* Rôle — sélecteur si owner courant, badge sinon */}
                <div className="shrink-0">
                  {canEditRole ? (
                    <select
                      value={m.role || 'agent'}
                      onChange={(e) => updateMemberRole(m.user_id, e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                    >
                      <option value="admin">🔧 {t('team.roleAdmin')}</option>
                      <option value="agent">👤 {t('team.roleAgent')}</option>
                      <option value="viewer">👁 {t('team.roleReadOnly')}</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${roleInfo.color}`}>
                      {roleInfo.icon} {roleInfo.label}
                    </span>
                  )}
                </div>

                {/* Retirer — seulement pour l'owner, sur les membres non-owner */}
                {amIOwner && !isOwner && !isMe && (
                  <button
                    onClick={() => removeMember(m.user_id, m.email)}
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
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">
          {t('team.inviteNewMember')}
        </h3>

        {/* Bandeau upgrade si plan Free */}
        {!canInvite && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl shrink-0">🔒</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">{t('team.paidOnlyTitle')}</p>
              <p className="text-xs text-amber-700 mt-0.5">{t('team.paidOnlyDesc')}</p>
            </div>
            <a
              href="/settings?tab=facturation"
              className="shrink-0 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
            >
              {t('team.upgradeBtn')}
            </a>
          </div>
        )}

        {/* Limite atteinte (plans payants) */}
        {canInvite && !hasRoom ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            {t('team.limitReached', { limit })}{' '}
            <a href="/settings?tab=facturation" className="font-semibold underline">{t('team.upgradeLinkText')}</a>
          </div>
        ) : (
          /* Formulaire — visible toujours, désactivé sur Free */
          <div className={`flex flex-col sm:flex-row gap-3 ${!canInvite ? 'opacity-50 pointer-events-none select-none' : ''}`}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canInvite && handleInvite()}
              placeholder="prenom@email.com"
              disabled={!canInvite}
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={!canInvite}
              className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
            >
              <option value="agent">👤 {t('team.roleAgent')}</option>
              <option value="admin">🔧 {t('team.roleAdmin')}</option>
              <option value="viewer">👁 {t('team.roleReadOnly')}</option>
            </select>
            <button
              onClick={canInvite ? handleInvite : undefined}
              disabled={!canInvite || inviting || !inviteEmail.trim()}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl
                         hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {inviting ? '…' : t('team.inviteBtn2')}
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

      {/* ── Invitations en attente ────────────────────────── */}
      {invitations.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">
              ⏳ {t('team.pendingInvites')} ({invitations.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('team.pendingDesc')}
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {invitations.map((inv) => {
              const roleInfo  = ROLE_LABELS[inv.role] || ROLE_LABELS.agent
              const expiresIn = Math.max(0, Math.ceil((new Date(inv.expires_at) - new Date()) / 86400000))
              return (
                <div key={inv.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-base shrink-0">
                    ✉️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{inv.email}</p>
                    <p className="text-xs text-slate-400">
                      <span className={`font-medium ${roleInfo.color.split(' ')[1]}`}>{roleInfo.icon} {roleInfo.label}</span>
                      {' · '}{t('team.expiresIn', { days: expiresIn })}
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
                      {copiedToken === inv.token ? `✓ ${t('common.copied')}` : t('team.copyLink')}
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

      {/* Message si owner seul + aucune invitation en attente */}
      {members.length === 1 && invitations.length === 0 && (
        <div className="text-center py-4 text-slate-400 text-sm">
          <p className="text-3xl mb-2">👥</p>
          {canInvite
            ? t('team.noTeamYet')
            : t('team.upgradeToTeam')}
        </div>
      )}
    </div>
  )
}
