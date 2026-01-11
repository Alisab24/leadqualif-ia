/**
 * Générateur de HTML pour documents (Stripe-like)
 * Génère le HTML d'un document à partir des données structurées
 * Prêt pour production et server-side rendering
 */

/**
 * Génère le HTML d'un document
 * @param {Object} params - Paramètres du document
 * @param {Object} params.document - Données du document
 * @param {Object} params.agencyProfile - Profil de l'agence
 * @param {Object} params.lead - Données du lead
 * @param {Object} params.docType - Type de document
 * @returns {string} HTML complet du document
 */
export const generateDocumentHtml = ({ document, agencyProfile, lead, docType }) => {
  // 🎯 VALIDATION DES DONNÉES
  if (!document || !agencyProfile || !lead || !docType) {
    throw new Error('Données manquantes pour la génération du HTML');
  }

  // 🎯 EXTRACTION DES DONNÉES AGRÉGÉES
  const {
    number,
    metadata,
    financialData,
    items
  } = document;

  const {
    nom_legal,
    nom_agence,
    email,
    telephone,
    adresse_legale,
    logo_url,
    devise,
    symbole_devise,
    mention_legale,
    conditions_paiement,
    numero_enregistrement,
    statut_juridique
  } = agencyProfile;

  const {
    nom: clientNom,
    email: clientEmail,
    telephone: clientTelephone,
    adresse: clientAdresse
  } = lead;

  // 🎯 GÉNÉRATION DU HTML
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${docType.label} ${number} - ${clientNom}</title>
    <style>
        /* Reset et styles de base */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: #ffffff;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .agency-info {
            flex: 1;
        }
        
        .logo {
            max-width: 120px;
            max-height: 60px;
            margin-bottom: 10px;
        }
        
        .agency-name {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .agency-details {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.4;
        }
        
        .document-info {
            text-align: right;
            font-size: 14px;
            color: #6b7280;
        }
        
        .document-number {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .document-date {
            font-size: 14px;
            color: #6b7280;
        }
        
        /* Client */
        .client-section {
            margin-bottom: 30px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .client-info {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
        }
        
        .client-name {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .client-details {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
        }
        
        /* Tableau */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .items-table th {
            background: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #2c3e50;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
        }
        
        .items-table .description {
            max-width: 300px;
        }
        
        .items-table .quantity {
            text-align: center;
            width: 80px;
        }
        
        .items-table .unit-price {
            text-align: right;
            width: 120px;
        }
        
        .items-table .total {
            text-align: right;
            width: 120px;
            font-weight: 600;
        }
        
        /* Totaux */
        .totals-section {
            margin-top: 30px;
            text-align: right;
        }
        
        .totals-table {
            display: inline-block;
            border-collapse: collapse;
            font-size: 14px;
        }
        
        .totals-table td {
            padding: 8px 12px;
            text-align: right;
        }
        
        .totals-table .label {
            font-weight: normal;
            color: #6b7280;
            width: 150px;
        }
        
        .totals-table .amount {
            font-weight: 600;
            color: #2c3e50;
            width: 120px;
        }
        
        .totals-table .grand-total {
            background: #f3f4f6;
            font-weight: bold;
            font-size: 16px;
            border-top: 2px solid #e5e7eb;
        }
        
        /* Métadonnées */
        .metadata {
            margin-top: 30px;
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
            font-style: italic;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
        }
        
        /* Footer */
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
        }
        
        .legal-info {
            margin-bottom: 15px;
        }
        
        .payment-terms {
            font-size: 11px;
            color: #9ca3af;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .container {
                padding: 20px 10px;
            }
            
            .header {
                flex-direction: column;
                gap: 20px;
            }
            
            .document-info {
                text-align: left;
            }
            
            .items-table {
                font-size: 12px;
            }
            
            .items-table th,
            .items-table td {
                padding: 8px 6px;
            }
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .container {
                padding: 20px;
                max-width: 100%;
            }
            
            .header {
                page-break-inside: avoid;
            }
            
            .items-table {
                page-break-inside: avoid;
            }
            
            .totals-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="agency-info">
                ${logo_url ? `<img src="${logo_url}" alt="${nom_agence}" class="logo">` : ''}
                <div class="agency-name">${nom_legal || nom_agence}</div>
                <div class="agency-details">
                    ${adresse_legale ? `<div>${adresse_legale}</div>` : ''}
                    ${email ? `<div>Email: ${email}</div>` : ''}
                    ${telephone ? `<div>Tél: ${telephone}</div>` : ''}
                    ${numero_enregistrement ? `<div>N° ${numero_enregistrement}</div>` : ''}
                </div>
            </div>
            <div class="document-info">
                <div class="document-number">${docType.label} ${number}</div>
                <div class="document-date">Date: ${new Date().toLocaleDateString('fr-FR')}</div>
            </div>
        </header>

        <!-- Client -->
        <section class="client-section">
            <h2 class="section-title">Client</h2>
            <div class="client-info">
                <div class="client-name">${clientNom}</div>
                <div class="client-details">
                    ${clientEmail ? `<div>Email: ${clientEmail}</div>` : ''}
                    ${clientTelephone ? `<div>Téléphone: ${clientTelephone}</div>` : ''}
                    ${clientAdresse ? `<div>Adresse: ${clientAdresse}</div>` : ''}
                </div>
            </div>
        </section>

        <!-- Articles -->
        ${items && items.length > 0 ? `
        <section>
            <h2 class="section-title">Détails</h2>
            <table class="items-table">
                <thead>
                    <tr>
                        <th class="description">Description</th>
                        <th class="quantity">Quantité</th>
                        <th class="unit-price">Prix unitaire</th>
                        <th class="total">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td class="description">${item.description}</td>
                            <td class="quantity">${item.quantity || 1}</td>
                            <td class="unit-price">${item.unitPrice ? `${item.unitPrice} ${symbole_devise || '€'}` : '-'}</td>
                            <td class="total">${item.total ? `${item.total} ${symbole_devise || '€'}` : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </section>
        ` : ''}

        <!-- Totaux -->
        ${financialData && financialData.totals ? `
        <section class="totals-section">
            <table class="totals-table">
                ${financialData.totals.map(total => `
                    <tr class="${total.label.includes('TOTAL') ? 'grand-total' : ''}">
                        <td class="label">${total.label}</td>
                        <td class="amount">${total.amount} ${symbole_devise || '€'}</td>
                    </tr>
                `).join('')}
            </table>
        </section>
        ` : ''}

        <!-- Métadonnées -->
        ${metadata && metadata.amountInWords ? `
        <div class="metadata">
            <strong>${metadata.amountInWords}</strong>
        </div>
        ` : ''}

        <!-- Footer -->
        <footer class="footer">
            <div class="legal-info">
                ${statut_juridique ? `<div>${statut_juridique}</div>` : ''}
                ${mention_legale ? `<div>${mention_legale}</div>` : ''}
            </div>
            ${conditions_paiement ? `
            <div class="payment-terms">
                <strong>Conditions de paiement:</strong><br>
                ${conditions_paiement}
            </div>
            ` : ''}
        </footer>
    </div>
</body>
</html>
  `;

  return html.trim();
};

/**
 * Génère le HTML pour un devis (IMMO)
 */
export const generateDevisHtml = (params) => {
  return generateDocumentHtml({ ...params, docType: { id: 'devis', label: 'Devis' } });
};

/**
 * Génère le HTML pour une facture (IMMO)
 */
export const generateFactureHtml = (params) => {
  return generateDocumentHtml({ ...params, docType: { id: 'facture', label: 'Facture' } });
};

/**
 * Génère le HTML pour un mandat (IMMO)
 */
export const generateMandatHtml = (params) => {
  return generateDocumentHtml({ ...params, docType: { id: 'mandat', label: 'Mandat' } });
};

/**
 * Génère le HTML pour un contrat (SMMA)
 */
export const generateContratHtml = (params) => {
  return generateDocumentHtml({ ...params, docType: { id: 'contrat', label: 'Contrat' } });
};

export default {
  generateDocumentHtml,
  generateDevisHtml,
  generateFactureHtml,
  generateMandatHtml,
  generateContratHtml
};
