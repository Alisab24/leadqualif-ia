import { Link } from 'react-router-dom'
import jsPDF from 'jspdf'

export default function Commercial() {
  // Génération de documents PDF
  const generateDocument = (type, title) => {
    const clientName = prompt(`Nom du client pour ${title}:`)
    if (!clientName) return

    const doc = new jsPDF()
    
    // En-tête
    doc.setFontSize(24)
    doc.text(title, 20, 30)
    
    // Informations client
    doc.setFontSize(14)
    doc.text(`Client: ${clientName}`, 20, 60)
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, 75)
    doc.text(`Agence: LeadQualif IA`, 20, 90)
    
    // Contenu spécifique selon le type
    doc.setFontSize(12)
    let content = ''
    
    switch(type) {
      case 'mandat':
        content = `MANDAT DE VENTE EXCLUSIF

Le soussigné, ${clientName}, donne mandat exclusif à l'agence LeadQualif IA 
pour la vente du bien immobilier situé à [Adresse du bien].

Durée du mandat: 3 mois
Prix de vente: [Montant] €
Honoraires: [Pourcentage]%

Fait à [Ville], le ${new Date().toLocaleDateString('fr-FR')}

Signature: ____________________`
        break
        
      case 'visite':
        content = `BON DE VISITE

Client: ${clientName}
Date de visite: ${new Date().toLocaleDateString('fr-FR')}
Bien visité: [Référence du bien]
Adresse: [Adresse du bien]

Observations:
[................................................................]
[................................................................]
[................................................................]

Le visiteur certifie avoir visité le bien dans son état actuel
et en a pris connaissance.

Signature visiteur: ____________________
Signature agent: ____________________`
        break
        
      case 'offre':
        content = `OFFRE D'ACHAT

Acheteur: ${clientName}
Adresse: [Adresse de l'acheteur]
Téléphone: [Téléphone]
Email: [Email]

Bien concerné: [Référence du bien]
Adresse: [Adresse du bien]

Offre d'achat: [Montant] €
Accompagnée de: [Type de financement]

Conditions particulières:
[................................................................]
[................................................................]

Validité de l'offre: 15 jours

Date: ${new Date().toLocaleDateString('fr-FR')}

Signature acheteur: ____________________`
        break
        
      case 'facture':
        content = `FACTURE D'HONORAIRES

Client: ${clientName}
Adresse: [Adresse du client]
Téléphone: [Téléphone]

Facture N°: FAC-${Date.now()}

Prestation: Honoraires de négociation immobilière
Référence bien: [Référence du bien]
Prix de vente: [Montant] €
Taux d'honoraires: [Pourcentage]%
Montant HT: [Montant] €
TVA (20%): [Montant] €
Montant TTC: [Montant] €

Mode de paiement: Virement bancaire
Échéance: 30 jours

Date d'émission: ${new Date().toLocaleDateString('fr-FR')}

Paiement à effectuer à:
LeadQualif IA
[IBAN]
[Banque]`
        break
    }
    
    // Ajouter le contenu
    const lines = content.split('\n')
    let yPosition = 120
    lines.forEach(line => {
      doc.text(line, 20, yPosition)
      yPosition += 8
    })
    
    // Pied de page
    doc.setFontSize(10)
    doc.text(`Document généré par LeadQualif IA - ${new Date().toLocaleDateString('fr-FR')}`, 20, 270)
    
    // Télécharger le PDF
    doc.save(`${type.toLowerCase().replace(/\s+/g, '-')}-${clientName.replace(/\s+/g, '-')}.pdf`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Espace Commercial</h1>
          <Link 
            to="/app" 
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            ← Retour au Dashboard
          </Link>
        </div>
        <p className="text-gray-600">Générez vos documents professionnels en un clic</p>
      </div>

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Carte Mandat de Vente */}
        <div 
          onClick={() => generateDocument('mandat', 'MANDAT DE VENTE EXCLUSIF')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">📜</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Mandat de Vente</h3>
            <p className="text-sm text-gray-600 mb-4">Générez un mandat de vente exclusif personnalisé</p>
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

        {/* Carte Bon de Visite */}
        <div 
          onClick={() => generateDocument('visite', 'BON DE VISITE')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">👁️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bon de Visite</h3>
            <p className="text-sm text-gray-600 mb-4">Créez un bon de visite pour vos clients</p>
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

        {/* Carte Offre d'Achat */}
        <div 
          onClick={() => generateDocument('offre', 'OFFRE D\'ACHAT')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Offre d'Achat</h3>
            <p className="text-sm text-gray-600 mb-4">Générez une offre d'achat formalisée</p>
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

        {/* Carte Facture d'Honoraires */}
        <div 
          onClick={() => generateDocument('facture', 'FACTURE D\'HONORAIRES')}
          className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border border-gray-100"
        >
          <div className="text-center">
            <div className="text-4xl mb-4">💶</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Facture d'Honoraires</h3>
            <p className="text-sm text-gray-600 mb-4">Émettez une facture d'honoraires professionnelle</p>
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
              <span>📄</span> PDF
            </div>
          </div>
        </div>

      </div>

      {/* Section d'information */}
      <div className="mt-12 bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h3 className="text-lg font-bold text-blue-900 mb-3">💡 Comment ça marche ?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">1.</span>
            <div>
              <strong>Cliquez</strong> sur le document souhaité
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">2.</span>
            <div>
              <strong>Saisissez</strong> le nom du client
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 font-bold">3.</span>
            <div>
              <strong>Téléchargez</strong> le PDF immédiatement
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">4</div>
          <div className="text-sm text-gray-600">Modèles disponibles</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-green-600">∞</div>
          <div className="text-sm text-gray-600">Générations illimitées</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">100%</div>
          <div className="text-sm text-gray-600">Professionnel</div>
        </div>
      </div>
    </div>
  )
}
