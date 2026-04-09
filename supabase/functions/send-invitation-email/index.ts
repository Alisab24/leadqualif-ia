// Supabase Edge Function — Création invitation + envoi email via Resend
// Deploy: npx supabase functions deploy send-invitation-email
// Secrets: RESEND_API_KEY, APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Paramètres ───────────────────────────────────────────
    const {
      agency_id,
      invite_email,
      role         = 'agent',
      agency_name  = 'LeadQualif',
      inviter_name = '',
    } = await req.json()

    if (!agency_id || !invite_email) {
      return new Response(
        JSON.stringify({ error: 'agency_id et invite_email sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Clients Supabase ─────────────────────────────────────
    const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY')
    const APP_URL           = Deno.env.get('APP_URL') || 'https://www.leadqualif.com'

    if (!SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client avec service role pour bypasser RLS
    const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Récupérer l'utilisateur qui fait la demande (depuis le JWT)
    const authHeader = req.headers.get('Authorization') || ''
    const userSb     = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user } } = await userSb.auth.getUser()
    const invitedBy = user?.id || '00000000-0000-0000-0000-000000000000'

    // ── 3. Créer ou renouveler l'invitation ────────────────────
    const normalizedEmail = invite_email.trim().toLowerCase()

    // Vérifier s'il existe déjà une invitation pending pour cet email dans cette agence
    const { data: existingInvite } = await adminSb
      .from('agency_invitations')
      .select('id, token')
      .eq('agency_id', agency_id)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle()

    let token: string
    let isRefresh = false

    if (existingInvite) {
      // Renouveler l'expiration et le token
      const newToken = crypto.randomUUID()
      await adminSb
        .from('agency_invitations')
        .update({
          token:      newToken,
          role,
          invited_by: invitedBy,
          expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        })
        .eq('id', existingInvite.id)
      token     = newToken
      isRefresh = true
    } else {
      // Créer une nouvelle invitation
      const { data: newInvite, error: insertErr } = await adminSb
        .from('agency_invitations')
        .insert({
          agency_id,
          invited_by:  invitedBy,
          email:       normalizedEmail,
          role,
          status:      'pending',
          expires_at:  new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        })
        .select('token')
        .single()

      if (insertErr) {
        console.error('Insert invitation error:', insertErr)
        return new Response(
          JSON.stringify({ error: `Création invitation: ${insertErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      token = newInvite.token
    }

    // ── 4. Construire le lien ───────────────────────────────────
    const inviteLink = `${APP_URL}/join/${token}`

    // ── 5. Envoyer l'email via Resend (optionnel si pas de clé) ─
    if (!RESEND_API_KEY) {
      // Pas de clé Resend → retourner quand même le lien pour copie manuelle
      return new Response(
        JSON.stringify({ success: true, token, invite_link: inviteLink, is_refresh: isRefresh, email_sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const roleLabels: Record<string, string> = {
      owner:  'Propriétaire',
      admin:  'Admin',
      agent:  'Agent',
      viewer: 'Lecture seule',
    }
    const roleLabel = roleLabels[role] || 'Agent'

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation à rejoindre ${agency_name}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px 40px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">👥</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Invitation à rejoindre l'équipe</h1>
            <p style="margin:8px 0 0;color:#c7d2fe;font-size:15px;">${agency_name}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">Bonjour,</p>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              <strong>${inviter_name || agency_name}</strong> vous invite à rejoindre l'espace de travail
              <strong>${agency_name}</strong> sur <strong>LeadQualif IA</strong>
              en tant que <strong>${roleLabel}</strong>.
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;">
              LeadQualif est un CRM intelligent pour agences — gérez vos leads,
              automatisez votre qualification et collaborez en équipe.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <a href="${inviteLink}"
                    style="display:inline-block;padding:14px 36px;background:#4f46e5;color:#ffffff;
                           text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;">
                    👥 Rejoindre ${agency_name} →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info box -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;color:#64748b;font-size:13px;font-weight:600;">ℹ️ Informations</p>
                  <ul style="margin:0;padding-left:18px;color:#64748b;font-size:13px;line-height:1.8;">
                    <li>Ce lien est valable <strong>7 jours</strong></li>
                    <li>Votre rôle : <strong>${roleLabel}</strong></li>
                    <li>Si vous avez déjà un compte, connectez-vous directement</li>
                  </ul>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
              Si le bouton ne fonctionne pas, copiez ce lien :<br/>
              <a href="${inviteLink}" style="color:#4f46e5;word-break:break-all;">${inviteLink}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Cet email a été envoyé automatiquement par LeadQualif IA.<br/>
              Si vous n'attendiez pas cet email, vous pouvez l'ignorer.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'LeadQualif IA <invitations@leadqualif.com>',
        to:      [normalizedEmail],
        subject: `👥 ${inviter_name || agency_name} vous invite à rejoindre ${agency_name} sur LeadQualif`,
        html,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Resend error:', resendData)
      // L'invitation est créée mais l'email a échoué → retourner quand même le lien
      return new Response(
        JSON.stringify({
          success:     true,
          token,
          invite_link: inviteLink,
          is_refresh:  isRefresh,
          email_sent:  false,
          email_error: resendData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, token, invite_link: inviteLink, is_refresh: isRefresh, email_sent: true, email_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
