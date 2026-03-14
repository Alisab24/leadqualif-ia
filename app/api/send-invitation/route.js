import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { email, agencyName, inviteLink, role } = await request.json()

    if (!email || !inviteLink) {
      return Response.json(
        { error: 'Paramètres manquants: email, inviteLink' },
        { status: 400 }
      )
    }

    const roleLabels = {
      admin: 'Admin',
      agent: 'Agent',
      viewer: 'Lecture seule'
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Invitation à rejoindre ${agencyName || 'LeadQualif'}</h1>
          </div>
          <div class="content">
            <p>Bonjour,</p>
            <p>Vous avez été invité(e) à rejoindre l'équipe de <strong>${agencyName || 'LeadQualif'}</strong> avec le rôle <strong>${roleLabels[role] || role}</strong>.</p>
            <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation et accéder à l'espace de travail :</p>
            <div style="text-align: center;">
              <a href="${inviteLink}" class="button">Rejoindre l'équipe</a>
            </div>
            <p><em>Ce lien d'invitation expirera dans 7 jours.</em></p>
            <p>Si vous n'attendez pas cette invitation, vous pouvez ignorer cet email.</p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé via LeadQualif</p>
          </div>
        </div>
      </body>
      </html>
    `

    const { data, error } = await resend.emails.send({
      from: 'LeadQualif <noreply@leadqualif.com>',
      to: [email],
      subject: `Invitation à rejoindre ${agencyName || 'LeadQualif'}`,
      html,
    })

    if (error) {
      console.error('Erreur Resend invitation:', error)
      return Response.json(
        { error: 'Erreur envoi invitation', details: error },
        { status: 500 }
      )
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('Erreur API send-invitation:', err)
    return Response.json(
      { error: 'Erreur serveur', details: err.message },
      { status: 500 }
    )
  }
}
