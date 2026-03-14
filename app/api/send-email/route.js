import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { to, subject, html, from } = await request.json()

    if (!to || !subject || !html) {
      return Response.json(
        { error: 'Paramètres manquants: to, subject, html' },
        { status: 400 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: from || 'LeadQualif <noreply@leadqualif.com>',
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return Response.json(
        { error: 'Erreur envoi email', details: error },
        { status: 500 }
      )
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('Erreur API send-email:', err)
    return Response.json(
      { error: 'Erreur serveur', details: err.message },
      { status: 500 }
    )
  }
}
