import { supabase } from '../supabaseClient';

/**
 * Service pour la gestion des compteurs de documents
 * Numérotation légale et professionnelle
 */

export class DocumentCounterService {
  /**
   * Génère un numéro de document unique et séquentiel
   * Format : FAC-2026-0007 ou DEV-2026-0012
   */
  static async generateDocumentNumber(type, userId) {
    try {
      const currentYear = new Date().getFullYear();
      
      // 1. Tenter de lire le compteur existant
      const { data: existingCounter, error: fetchError } = await supabase
        .from('document_counters')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('year', currentYear)
        .single();

      let newNumber;
      
      if (fetchError && fetchError.code === 'PGRST116') {
        // 2. Si inexistant → créer avec last_number = 1
        const { data: newCounter, error: insertError } = await supabase
          .from('document_counters')
          .insert({
            user_id: userId,
            type: type,
            year: currentYear,
            last_number: 1
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Erreur création compteur:', insertError);
          throw new Error('Impossible de créer le compteur de documents');
        }

        newNumber = 1;
        console.log(`📄 Nouveau compteur créé: ${type}-${currentYear}-${newNumber.toString().padStart(4, '0')}`);
      } else if (fetchError) {
        console.error('❌ Erreur lecture compteur:', fetchError);
        throw new Error('Impossible de lire le compteur de documents');
      } else {
        // 3. Si existant → incrémenter
        newNumber = existingCounter.last_number + 1;
        
        const { error: updateError } = await supabase
          .from('document_counters')
          .update({ last_number: newNumber })
          .eq('id', existingCounter.id);

        if (updateError) {
          console.error('❌ Erreur mise à jour compteur:', updateError);
          throw new Error('Impossible de mettre à jour le compteur');
        }

        console.log(`📄 Compteur incrémenté: ${type}-${currentYear}-${newNumber.toString().padStart(4, '0')}`);
      }

      // 4. Générer le numéro formaté
      const prefix = type === 'facture' ? 'FAC' : 'DEV';
      const formattedNumber = `${prefix}-${currentYear}-${newNumber.toString().padStart(4, '0')}`;
      
      return {
        formatted: formattedNumber,
        type: type,
        year: currentYear,
        number: newNumber
      };

    } catch (error) {
      console.error('❌ Erreur génération numéro document:', error);
      throw error;
    }
  }

  /**
   * Génère le nom du fichier PDF professionnel
   * Format : FAC-2026-0007-IMMO-NEXAPRO.pdf
   */
  static generatePdfFileName(documentNumber, agencyName, documentType) {
    try {
      // Nettoyer le nom de l'agence
      const cleanAgencyName = agencyName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const prefix = documentType === 'facture' ? 'FAC' : 'DEV';
      
      return `${documentNumber}-${cleanAgencyName}.pdf`;
    } catch (error) {
      console.error('❌ Erreur génération nom fichier PDF:', error);
      return `${documentNumber}.pdf`;
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
