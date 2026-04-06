/**
 * POST /api/email/send
 * Envoie un email via Resend API et le stocke dans conversations.
 *
 * Body : { leadId, subject, message, replyToThreadId? }
 * Headers : Authorization: Bearer <token>
 *
 * Env : RESEND_API_KEY, RESEND_FROM_EMAIL
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Config Supabase manquante' })

  const resendKey   = process.env.RESEND_API_KEY
  const fromEmail   = process.env.RESEND_FROM_EMAIL || 'noreply@leadqualif.com'
  if (!resendKey) return res.status(503).json({ error: 'RESEND_API_KEY non configuré' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  const { leadId, subject, message, replyToThreadId } = req.body || {}
  if (!leadId || !subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'leadId, subject et message requis' })
  }

  try {
    // 1. Profil agent
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, nom_complet, nom_agence, email')
      .eq('user_id', user.id)
      .single()
    if (!profile?.agency_id) return res.status(403).json({ error: 'Agence introuvable' })

    // 2. Lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, nom, email, agency_id')
      .eq('id', leadId)
      .eq('agency_id', profile.agency_id)
      .single()
    if (leadErr || !lead) return res.status(404).json({ error: 'Lead introuvable' })
    if (!lead.email) return res.status(400).json({ error: 'Ce lead n\'a pas d\'email' })

    // 3. Générer un thread ID (ou réutiliser celui existant)
    const threadId = replyToThreadId || `thread-${leadId}-${Date.now()}`
    const senderName = profile.nom_complet || profile.nom_agence || 'L\'équipe'
    const fromField  = `${senderName} <${fromEmail}>`

    // 4. Envoyer via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    fromField,
        to:      [lead.email],
        subject: subject.trim(),
        html:    `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${message.trim().replace(/\n/g, '<br>')}</div>`,
        text:    message.trim(),
      }),
    })

    const resendData = await resendRes.json()
    if (!resendRes.ok) {
      throw new Error(`Resend ${resendRes.status}: ${resendData.message || JSON.stringify(resendData)}`)
    }

    // 5. Stocker dans conversations
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        lead_id:         lead.id,
        agency_id:       profile.agency_id,
        channel:         'email',
        direction:       'outbound',
        subject:         subject.trim(),
        content:         message.trim(),
        email_thread_id: threadId,
        from_email:      fromEmail,
        to_email:        lead.email,
        sender_name:     senderName,
        status:          'sent',
        read_at:         new Date().toISOString(),
      })
      .select()
      .single()

    if (convErr) console.error('[email/send] Insert error:', JSON.stringify(convErr))

    return res.status(200).json({
      success:    true,
      message_id: conv?.id,
      thread_id:  threadId,
      resend_id:  resendData.id,
    })
  } catch (err) {
    console.error('[email/send] Error:', err)
    return res.status(500).json({ error: err.message || 'Erreur serveur' })
  }
}
