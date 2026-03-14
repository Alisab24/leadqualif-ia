// Supabase Edge Function — Envoi email invitation équipe via Resend
// Deploy: npx supabase functions deploy send-invitation-email
// Secret:  npx supabase secrets set RESEND_API_KEY=re_xxxx
//          npx supabase secrets set APP_URL=https://ton-app.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { inviteEmail, agencyName, inviterName, inviteLink, role } = await req.json()

    if (!inviteEmail || !inviteLink) {
      return new Response(
        JSON.stringify({ error: 'inviteEmail et inviteLink sont requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const roleLabels: Record<string, string> = {
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
  <title>Invitation à rejoindre ${agencyName}</title>
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
            <p style="margin:8px 0 0;color:#c7d2fe;font-size:15px;">${agencyName}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              Bonjour,
            </p>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              <strong>${inviterName || agencyName}</strong> vous invite à rejoindre l'espace de travail
              <strong>${agencyName}</strong> sur <strong>LeadQualif IA</strong>
              en tant que <strong>${roleLabel}</strong>.
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;">
              LeadQualif est un CRM intelligent pour agences SMMA et immobilières — gérez vos leads,
              automatisez votre qualification et collaborez en équipe.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <a href="${inviteLink}"
                    style="display:inline-block;padding:14px 36px;background:#4f46e5;color:#ffffff;
                           text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;
                           letter-spacing:0.2px;">
                    👥 Rejoindre ${agencyName} →
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
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
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

    // Appel API Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'LeadQualif IA <invitations@leadqualif.com>',
        to:      [inviteEmail],
        subject: `👥 ${inviterName || agencyName} vous invite à rejoindre ${agencyName} sur LeadQualif`,
        html,
      }),
    })

    const resendData = await res.json()

    if (!res.ok) {
      console.error('Resend error:', resendData)
      return new Response(
        JSON.stringify({ error: 'Échec envoi email', details: resendData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
