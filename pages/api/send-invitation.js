import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Méthode non autorisée. Utilisez POST.' })
  }

  try {
    const { email, nom, lienInvitation } = req.body

    if (!email || !nom || !lienInvitation) {
      return res.status(400).json({
        error: true,
        message: 'Paramètres manquants: email, nom, lienInvitation'
      })
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation LeadQualif</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f9fafb;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #1f2937;
            font-size: 20px;
            margin: 0 0 20px 0;
          }
          .content p {
            margin: 0 0 20px 0;
            color: #4b5563;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
            transition: all 0.2s ease;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 12px -1px rgba(59, 130, 246, 0.4);
          }
          .footer {
            background: #f3f4f6;
            padding: 20px 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          .footer p {
            margin: 0;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎯 LeadQualif</div>
            <h1>Vous êtes invité à rejoindre une équipe</h1>
            <p>${nom} vous invite à collaborer</p>
          </div>
          
          <div class="content">
            <h2>Bonjour,</h2>
            <p>Vous avez été invité(e) à rejoindre l'espace de travail LeadQualif de <strong>${nom}</strong>.</p>
            <p>Rejoignez l'équipe pour accéder aux leads, documents et collaborer efficacement.</p>
            
            <div class="button-container">
              <a href="${lienInvitation}" class="button">Rejoindre l'équipe</a>
            </div>
            
            <p><em>Ce lien d'invitation expirera dans 7 jours.</em></p>
            <p>Si vous n'attendez pas cette invitation, vous pouvez ignorer cet email.</p>
          </div>
          
          <div class="footer">
            <p>Cet email a été envoyé via LeadQualif</p>
            <p>© 2024 LeadQualif. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const { data, error } = await resend.emails.send({
      from: 'noreply@send.leadqualif.com',
      to: [email],
      subject: `Invitation à rejoindre ${nom} sur LeadQualif`,
      html,
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return res.status(500).json({
        error: true,
        message: 'Erreur envoi email',
        details: error
      })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('Erreur API send-invitation:', err)
    return res.status(500).json({
      error: true,
      message: 'Erreur serveur',
      details: err.message
    })
  }
}
