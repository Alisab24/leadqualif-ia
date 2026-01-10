import { supabase } from '../supabaseClient';

/**
 * Service pour la gestion des compteurs de documents
 * Numérotation légale et professionnelle
 */

export class DocumentCounterService {
  /**
   * Génère un numéro de document unique et séquentiel via RPC PostgreSQL
   * Format : FAC-2026-000001 ou DEV-2026-000001
   */
  static async generateDocumentNumber(type, userId) {
    try {
      console.log(`🔢 Génération numéro pour: type=${type}, org=${userId}`);
      
      // ✅ CORRECTION : Appel RPC avec la BONNE signature
      const { data, error } = await supabase.rpc(
        'generate_document_number',
        {
          p_organization_id: userId,
          p_type: type === 'facture' ? 'FAC' : 'DEV'
        }
      );

      if (error || !data) {
        console.error('❌ Erreur RPC generate_document_number:', error);
        throw new Error('Impossible de générer le numéro du document');
      }

      console.log(`✅ Numéro généré avec succès: ${data}`);
      
      return data;

    } catch (error) {
      console.error('❌ Erreur génération numéro document:', error);
      
      // Messages d'erreur plus clairs pour l'utilisateur
      if (error.message.includes('user_id est requis')) {
        throw new Error('Utilisateur non identifié. Veuillez vous reconnecter.');
      } else if (error.message.includes('Type doit être')) {
        throw new Error('Type de document invalide.');
      } else {
        throw new Error('Impossible de générer le numéro du document. Veuillez réessayer.');
      }
    }
  }

  /**
   * Génère le nom du fichier PDF professionnel
   * Format : Facture_FAC-2026-000001.pdf ou Devis_DEV-2026-000001.pdf
   */
  static generatePdfFileName(documentNumber, documentType) {
    try {
      if (!documentNumber) {
        return 'Document.pdf';
      }

      // Déterminer le préfixe du nom de fichier
      const prefix = documentType === 'facture' ? 'Facture' : 
                    documentType === 'devis' ? 'Devis' : 'Document';
      
      // Nettoyer le numéro de document pour le nom de fichier
      const cleanNumber = documentNumber.replace(/[^A-Z0-9-]/g, '_');
      
      return `${prefix}_${cleanNumber}.pdf`;
    } catch (error) {
      console.error('❌ Erreur génération nom fichier PDF:', error);
      return 'Document.pdf';
    }
  }

  /**
   * Convertit un montant en lettres (français)
   */
  static convertAmountToWords(amount, currency = 'EUR') {
    try {
      const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
                   'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
      const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
      
      const currencyNames = {
        'EUR': 'euro',
        'USD': 'dollar',
        'CAD': 'dollar canadien',
        'FCFA': 'franc CFA',
        'GBP': 'livre sterling',
        'CHF': 'franc suisse'
      };

      const currencyName = currencyNames[currency] || 'euro';
      
      if (amount === 0) {
        return `zéro ${currencyName}`;
      }

      let result = '';
      let remainingAmount = Math.floor(amount);
      
      // Gérer les milliers
      if (remainingAmount >= 1000) {
        const thousands = Math.floor(remainingAmount / 1000);
        if (thousands === 1) {
          result += 'mille ';
        } else {
          result += this.convertNumberToWords(thousands, units, tens) + ' mille ';
        }
        remainingAmount = remainingAmount % 1000;
      }
      
      // Gérer les centaines
      if (remainingAmount >= 100) {
        const hundreds = Math.floor(remainingAmount / 100);
        if (hundreds === 1) {
          result += 'cent ';
        } else {
          result += this.convertNumberToWords(hundreds, units, tens) + ' cent ';
        }
        remainingAmount = remainingAmount % 100;
      }
      
      // Gérer les dizaines et unités
      if (remainingAmount > 0) {
        result += this.convertNumberToWords(remainingAmount, units, tens);
      }
      
      // Ajouter la devise
      const euros = Math.floor(amount);
      const centimes = Math.round((amount - euros) * 100);
      
      result += ` ${currencyName}${euros > 1 ? 's' : ''}`;
      
      if (centimes > 0) {
        result += ` et ${centimes} centime${centimes > 1 ? 's' : ''}`;
      }
      
      return result.trim();
    } catch (error) {
      console.error('❌ Erreur conversion montant en lettres:', error);
      return `${amount} ${currency}`;
    }
  }

  /**
   * Convertit un nombre en lettres (utilitaire interne)
   */
  static convertNumberToWords(number, units, tens) {
    if (number < 20) {
      return units[number];
    } else if (number < 100) {
      const ten = Math.floor(number / 10);
      const unit = number % 10;
      let result = tens[ten];
      if (unit > 0) {
        result += '-' + units[unit];
      }
      return result;
    }
    return '';
  }

  /**
   * Formate le texte pour l'affichage du montant en lettres
   */
  static formatAmountInWords(amount, currency = 'EUR', showAmountInWords = true) {
    if (!showAmountInWords) {
      return null;
    }

    try {
      const amountInWords = this.convertAmountToWords(amount, currency);
      return `Arrêté la présente facture à la somme de ${amountInWords} TTC`;
    } catch (error) {
      console.error('❌ Erreur formatage montant en lettres:', error);
      return null;
    }
  }
}
