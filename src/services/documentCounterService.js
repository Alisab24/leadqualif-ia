import { supabase } from "../supabaseClient";

export const DocumentCounterService = {
  async generateDocumentNumber(type, agencyId) {
    if (!agencyId) {
      throw new Error("Agency / Organization ID manquant");
    }

    const docType = type === "facture" ? "FAC" : "DEV";

    console.log("🔢 Appel RPC generate_document_number", {
      p_organization_id: agencyId,
      p_type: docType
    });

    const { data, error } = await supabase.rpc(
      "generate_document_number",
      {
        p_organization_id: agencyId,
        p_type: docType
      }
    );

    if (error || !data) {
      console.error("❌ Erreur RPC generate_document_number:", error);
      throw new Error("Impossible de générer le numéro du document");
    }

    console.log("📄 Numéro de document généré:", data);
    return data;
  },

  /**
   * Génère le nom du fichier PDF professionnel
   * Format : Facture_FAC-2026-000001.pdf ou Devis_DEV-2026-000001.pdf
   */
  generatePdfFileName(documentNumber, documentType) {
    try {
      if (!documentNumber) {
        console.error(' documentNumber manquant pour generatePdfFileName');
        return 'Document.pdf';
      }

      // Déterminer le préfixe du nom de fichier
      const prefix = documentType === 'facture' ? 'Facture' : 
                    documentType === 'devis' ? 'Devis' : 'Document';
      
      // Nettoyer le numéro de document pour le nom de fichier
      const cleanNumber = documentNumber.replace(/[^A-Z0-9-]/g, '_');
      
      return `${prefix}_${cleanNumber}.pdf`;
    } catch (error) {
      console.error(' Erreur génération nom fichier PDF:', error);
      return 'Document.pdf';
    }
  },

  /**
   * Convertit un montant en lettres selon les standards légaux français
   * @param {number} amount - Montant à convertir
   * @returns {string} Montant en lettres formaté
   */
  formatAmountInWords(amount) {
    if (!amount || amount === 0) {
      return 'zéro euro';
    }

    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 
                   'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    const hundreds = ['', 'cent', 'deux cents', 'trois cents', 'quatre cents', 'cinq cents', 'six cents', 'sept cents', 'huit cents', 'neuf cents'];
    
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
      if (num < 1000000) {
        const thousand = Math.floor(num / 1000);
        const remainder = num % 1000;
        if (thousand === 1) return `mille ${convertNumberToWords(remainder)}`;
        return `${convertNumberToWords(thousand)} mille ${convertNumberToWords(remainder)}`;
      }
      return num.toString();
    };

    const euros = Math.floor(amount);
    const centimes = Math.round((amount - euros) * 100);
    
    let result = convertNumberToWords(euros);
    
    // Gestion du "un" vs "une" pour euro
    if (euros === 1) {
      result += ' euro';
    } else {
      result += ' euros';
    }
    
    // Ajouter les centimes si nécessaire
    if (centimes > 0) {
      if (centimes === 1) {
        result += ' et un centime';
      } else {
        result += ` et ${convertNumberToWords(centimes)} centimes`;
      }
    }
    
    return result;
  }
};
