import { supabase } from "../supabaseClient";

// ============================================================
// 🔢 Correspondance type → préfixe de numérotation
// ============================================================
export const DOC_TYPE_PREFIX = {
  facture:       'FAC',
  devis:         'DEV',
  mandat:        'MAN',
  bon_de_visite: 'BDV',
  offre_achat:   'OFF',
  rapport:       'RAP',
  contrat:       'CTR',
};

// Label humain pour chaque type
export const DOC_TYPE_LABEL = {
  facture:       'Facture',
  devis:         'Devis',
  mandat:        'Mandat',
  bon_de_visite: 'Bon de visite',
  offre_achat:   "Offre d'achat",
  rapport:       'Rapport',
  contrat:       'Contrat',
};

// Icône emoji pour chaque type
export const DOC_TYPE_ICON = {
  facture:       '🧾',
  devis:         '💰',
  mandat:        '✍️',
  bon_de_visite: '🏠',
  offre_achat:   '🤝',
  rapport:       '📊',
  contrat:       '📋',
};

export const DocumentCounterService = {
  /**
   * Génère un numéro de document unique via la fonction RPC Supabase.
   * Format : FAC-2026-000001 / MAN-2026-000001 / etc.
   *
   * @param {string} type - Le type du document (clé de DOC_TYPE_PREFIX)
   * @param {string} agencyId - L'UUID de l'agence (= user_id pour comptes solo)
   * @returns {Promise<string>} Le numéro de document
   */
  async generateDocumentNumber(type, agencyId) {
    if (!agencyId) {
      throw new Error("Agency / Organization ID manquant");
    }

    const docType = DOC_TYPE_PREFIX[type] ?? 'DOC';

    console.log("🔢 Appel RPC generate_document_number", {
      p_organization_id: agencyId,
      p_type: docType,
    });

    const { data, error } = await supabase.rpc("generate_document_number", {
      p_organization_id: agencyId,
      p_type: docType,
    });

    if (error || !data) {
      console.error("❌ Erreur RPC generate_document_number:", error);
      throw new Error("Impossible de générer le numéro du document");
    }

    console.log("📄 Numéro de document généré:", data);
    return data;
  },

  /**
   * Génère le nom de fichier PDF professionnel.
   * Format : Facture_FAC-2026-000001.pdf / Mandat_MAN-2026-000001.pdf
   *
   * @param {string} documentNumber - Ex: "FAC-2026-000001"
   * @param {string} documentType   - Clé de DOC_TYPE_LABEL
   * @returns {string}
   */
  generatePdfFileName(documentNumber, documentType) {
    try {
      if (!documentNumber) {
        console.error('❌ documentNumber manquant pour generatePdfFileName');
        return 'Document.pdf';
      }

      const label = DOC_TYPE_LABEL[documentType] ?? 'Document';
      const cleanNumber = documentNumber.replace(/[^A-Z0-9-]/g, '_');
      return `${label.replace(/\s/g, '_')}_${cleanNumber}.pdf`;
    } catch (error) {
      console.error('❌ Erreur génération nom fichier PDF:', error);
      return 'Document.pdf';
    }
  },

  /**
   * Convertit un montant en lettres selon les standards légaux français.
   *
   * @param {number} amount - Montant à convertir
   * @param {string} [devise='euro'] - Devise en lettres (ex: 'euro', 'franc')
   * @returns {string}
   */
  formatAmountInWords(amount, devise = 'euro') {
    if (!amount || amount === 0) return `zéro ${devise}`;

    const units = [
      '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
      'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
    ];
    const tens = [
      '', 'dix', 'vingt', 'trente', 'quarante', 'cinquante',
      'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix',
    ];
    const hundreds = [
      '', 'cent', 'deux cents', 'trois cents', 'quatre cents', 'cinq cents',
      'six cents', 'sept cents', 'huit cents', 'neuf cents',
    ];

    const convertNumberToWords = (num) => {
      if (num === 0) return '';
      if (num < 20) return units[num];
      if (num < 100) {
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        if (unit === 0) return tens[ten];
        if (ten === 7) return `soixante-${units[unit + 10]}`;
        if (ten === 9) return `quatre-vingt-${units[unit + 10]}`;
        return `${tens[ten]}-${units[unit]}`;
      }
      if (num < 1000) {
        const hundred = Math.floor(num / 100);
        const remainder = num % 100;
        if (remainder === 0) return hundreds[hundred];
        if (hundred === 1) return `cent ${convertNumberToWords(remainder)}`;
        return `${hundreds[hundred]} ${convertNumberToWords(remainder)}`;
      }
      if (num < 1_000_000) {
        const thousand = Math.floor(num / 1000);
        const remainder = num % 1000;
        const prefix = thousand === 1 ? 'mille' : `${convertNumberToWords(thousand)} mille`;
        return remainder === 0 ? prefix : `${prefix} ${convertNumberToWords(remainder)}`;
      }
      return num.toString();
    };

    const euros = Math.floor(amount);
    const centimes = Math.round((amount - euros) * 100);

    const deviseLabel = euros <= 1 ? devise : `${devise}s`;
    let result = `${convertNumberToWords(euros)} ${deviseLabel}`;

    if (centimes > 0) {
      const centLabel = centimes === 1 ? 'centime' : 'centimes';
      result += ` et ${convertNumberToWords(centimes)} ${centLabel}`;
    }

    return result;
  },
};
