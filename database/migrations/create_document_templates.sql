/**
 * ARCHITECTURE SaaS - Migration SQL pour les templates de documents
 * 
 * Création de la table pour stocker les templates HTML dynamiques
 * Extensible pour tous les types d'agences et documents
 */

-- Table pour les templates de documents
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(100) UNIQUE NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    template_description TEXT,
    agency_type VARCHAR(50) NOT NULL, -- 'immobilier', 'smma', etc.
    document_type VARCHAR(50) NOT NULL, -- 'devis', 'facture', 'mandat', etc.
    template_html TEXT NOT NULL,
    template_css TEXT,
    variables_schema JSONB, -- Schéma des variables requises
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT document_templates_unique_key UNIQUE (agency_type, document_type, version)
);

-- Index pour optimisation
CREATE INDEX IF NOT EXISTS idx_document_templates_key ON document_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(agency_type, document_type);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_templates_updated_at 
    BEFORE UPDATE ON document_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion des templates par défaut pour IMMOBILIER
INSERT INTO document_templates (template_key, template_name, template_description, agency_type, document_type, template_html, template_css, variables_schema) VALUES
('immobilier_devis_template', 'Devis Immobilier', 'Devis pour transactions immobilières', 'immobilier', 'devis', 
'<div class="document">
  <header class="document-header">
    <div class="agency-info">
      <h1>{{agency.nom_agence}}</h1>
      <p>{{agency.adresse_legale}}</p>
      <p>{{agency.telephone}} | {{agency.email}}</p>
    </div>
    <div class="document-info">
      <h2>DEVIS</h2>
      <p>Référence: {{reference}}</p>
      <p>Date: {{date_generation}}</p>
    </div>
  </header>
  
  <section class="client-info">
    <h3>Informations client</h3>
    <p><strong>Nom:</strong> {{client_nom}}</p>
    <p><strong>Email:</strong> {{client_email}}</p>
    <p><strong>Téléphone:</strong> {{client_telephone}}</p>
  </section>
  
  <section class="property-info">
    <h3>Informations du bien</h3>
    <div class="property-details">
      <div class="detail-row">
        <span class="label">Type de bien:</span>
        <span class="value">{{bien_type}}</span>
      </div>
      <div class="detail-row">
        <span class="label">Surface:</span>
        <span class="value">{{surface}} m²</span>
      </div>
      <div class="detail-row">
        <span class="label">Adresse:</span>
        <span class="value">{{adresse}}</span>
      </div>
      <div class="detail-row">
        <span class="label">Prix de vente:</span>
        <span class="value">{{prix_vente}} {{devise}}</span>
      </div>
    </div>
  </section>
  
  <section class="financial-info">
    <h3>Détails financiers</h3>
    <table class="financial-table">
      <tr>
        <td>Honoraires (5%):</td>
        <td class="amount">{{honoraires}} {{devise}}</td>
      </tr>
      <tr>
        <td>TVA (20%):</td>
        <td class="amount">{{tva}} {{devise}}</td>
      </tr>
      <tr class="total-row">
        <td><strong>Total:</strong></td>
        <td class="amount total">{{total_ttc}} {{devise}}</td>
      </tr>
    </table>
  </section>
  
  <footer class="document-footer">
    <p>Devis valable 30 jours</p>
    <p>{{agency.mentions_legales}}</p>
  </footer>
</div>',
'.document { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.document-header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
.agency-info h1 { margin: 0; color: #333; }
.document-info h2 { margin: 0; color: #666; font-size: 24px; }
.client-info, .property-info, .financial-info { margin-bottom: 30px; }
.property-details { background: #f5f5f5; padding: 15px; border-radius: 5px; }
.detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
.label { font-weight: bold; }
.value { color: #333; }
.financial-table { width: 100%; border-collapse: collapse; }
.financial-table td { padding: 10px; border-bottom: 1px solid #ddd; }
.amount { text-align: right; font-weight: bold; }
.total-row { background: #f0f0f0; font-weight: bold; }
.total { color: #2c5aa0; font-size: 18px; }
.document-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }',
'{"required": ["bien_type", "surface", "adresse", "prix_vente"], "calculations": ["honoraires", "tva", "total_ttc"], "defaults": {"devise": "EUR", "tva_rate": 0.20}}'),

('immobilier_facture_template', 'Facture Immobilier', 'Facture pour honoraires immobiliers', 'immobilier', 'facture',
'<div class="document">
  <header class="document-header">
    <div class="agency-info">
      <h1>{{agency.nom_agence}}</h1>
      <p>{{agency.adresse_legale}}</p>
      <p>{{agency.numero_siret}}</p>
    </div>
    <div class="document-info">
      <h2>FACTURE</h2>
      <p>Numéro: {{reference}}</p>
      <p>Date: {{date_generation}}</p>
    </div>
  </header>
  
  <section class="billing-info">
    <h3>Informations de facturation</h3>
    <p><strong>Client:</strong> {{client_nom}}</p>
    <p><strong>Adresse:</strong> {{client_adresse || "Non spécifiée"}}</p>
  </section>
  
  <section class="service-details">
    <h3>Prestations facturées</h3>
    <table class="service-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantité</th>
          <th>Prix unitaire</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Honoraires de négociation - {{bien_type}} {{surface}}m²</td>
          <td>1</td>
          <td>{{honoraires}} {{devise}}</td>
          <td>{{honoraires}} {{devise}}</td>
        </tr>
      </tbody>
    </table>
  </section>
  
  <section class="totals">
    <table class="totals-table">
      <tr>
        <td>Total HT:</td>
        <td class="amount">{{total_ht}} {{devise}}</td>
      </tr>
      <tr>
        <td>TVA (20%):</td>
        <td class="amount">{{tva}} {{devise}}</td>
      </tr>
      <tr class="total-row">
        <td><strong>Total TTC:</strong></td>
        <td class="amount total">{{total_ttc}} {{devise}}</td>
      </tr>
    </table>
  </section>
  
  <footer class="document-footer">
    <p>Échéance de paiement: 30 jours</p>
    <p>Mode de paiement: Virement bancaire</p>
    <p>{{agency.mentions_legales}}</p>
  </footer>
</div>',
'.document { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.document-header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
.service-table, .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.service-table th, .service-table td, .totals-table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
.service-table th { background: #f5f5f5; }
.amount { text-align: right; font-weight: bold; }
.total-row { background: #f0f0f0; font-weight: bold; }
.total { color: #2c5aa0; font-size: 18px; }',
'{"required": ["bien_type", "surface"], "calculations": ["honoraires", "total_ht", "tva", "total_ttc"], "defaults": {"devise": "EUR", "tva_rate": 0.20}}'),

('immobilier_mandat_template', 'Mandat Immobilier', 'Mandat de vente ou location', 'immobilier', 'mandat',
'<div class="document">
  <header class="document-header">
    <h1>MANDAT DE VENTE</h1>
    <p>Référence: {{reference}}</p>
    <p>Date: {{date_generation}}</p>
  </header>
  
  <section class="parties">
    <h3>Parties contractantes</h3>
    <div class="party">
      <h4>LE MANDANT:</h4>
      <p>{{client_nom}}</p>
      <p>{{client_adresse || "Adresse à compléter"}}</p>
    </div>
    <div class="party">
      <h4>LE MANDATAIRE:</h4>
      <p>{{agency.nom_agence}}</p>
      <p>{{agency.adresse_legale}}</p>
      <p>{{agency.numero_siret}}</p>
    </div>
  </section>
  
  <section class="property">
    <h3>Bien concerné</h3>
    <p><strong>Type:</strong> {{bien_type}}</p>
    <p><strong>Adresse:</strong> {{adresse}}</p>
    <p><strong>Surface:</strong> {{surface}} m²</p>
  </section>
  
  <section class="terms">
    <h3>Conditions du mandat</h3>
    <p><strong>Durée:</strong> {{duree_mandat}} mois</p>
    <p><strong>Type:</strong> Mandat {{exclusivite ? "exclusif" : "simple"}}</p>
    <p><strong>Commission:</strong> {{commission}} {{devise}}</p>
  </section>
  
  <section class="obligations">
    <h3>Obligations des parties</h3>
    <div class="obligation-block">
      <h4>Obligations du mandant:</h4>
      <ul>
        <li>Fournir tous les documents nécessaires</li>
        <li>Maintenir le bien en état de visite</li>
        <li>Ne pas chercher à contourner le mandat</li>
      </ul>
    </div>
    <div class="obligation-block">
      <h4>Obligations du mandataire:</h4>
      <ul>
        <li>Assurer la promotion du bien</li>
        <li>Organiser les visites</li>
        <li>Présenter les offres sérieuses</li>
      </ul>
    </div>
  </section>
  
  <footer class="signatures">
    <div class="signature-block">
      <p>Fait à {{lieu_signature || "____________"}}, le {{date_signature || "____________"}}</p>
      <div class="signature-lines">
        <div class="signature-line">
          <p>Le Mandant</p>
          <p>{{client_nom}}</p>
          <div class="line"></div>
        </div>
        <div class="signature-line">
          <p>Le Mandataire</p>
          <p>{{agency.nom_agence}}</p>
          <div class="line"></div>
        </div>
      </div>
    </div>
  </footer>
</div>',
'.document { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.document-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
.parties, .property, .terms, .obligations { margin-bottom: 30px; }
.party { background: #f5f5f5; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
.obligation-block { margin-bottom: 20px; }
.obligation-block ul { margin: 10px 0; padding-left: 20px; }
.signatures { margin-top: 40px; }
.signature-lines { display: flex; justify-content: space-between; margin-top: 30px; }
.signature-line { text-align: center; flex: 1; margin: 0 10px; }
.line { border-bottom: 1px solid #333; height: 50px; margin-top: 40px; }',
'{"required": ["bien_type", "adresse", "duree_mandat", "exclusivite"], "calculations": ["commission"], "defaults": {"devise": "EUR", "lieu_signature": "", "date_signature": ""}}');

-- Insertion des templates par défaut pour SMMA
INSERT INTO document_templates (template_key, template_name, template_description, agency_type, document_type, template_html, template_css, variables_schema) VALUES
('smma_devis_template', 'Devis SMMA', 'Devis pour services marketing digitaux', 'smma', 'devis',
'<div class="document">
  <header class="document-header">
    <div class="agency-info">
      <h1>{{agency.nom_agence}}</h1>
      <p>{{agency.adresse_legale}}</p>
      <p>{{agency.telephone}} | {{agency.email}}</p>
    </div>
    <div class="document-info">
      <h2>DEVIS</h2>
      <p>Référence: {{reference}}</p>
      <p>Date: {{date_generation}}</p>
    </div>
  </header>
  
  <section class="client-info">
    <h3>Informations client</h3>
    <p><strong>Entreprise:</strong> {{client_nom}}</p>
    <p><strong>Email:</strong> {{client_email}}</p>
    <p><strong>Téléphone:</strong> {{client_telephone}}</p>
  </section>
  
  <section class="services">
    <h3>Prestations proposées</h3>
    <div class="service-description">
      <p>{{services_inclus}}</p>
    </div>
  </section>
  
  <section class="financial-info">
    <h3>Détails financiers</h3>
    <table class="financial-table">
      <tr>
        <td>Budget mensuel:</td>
        <td class="amount">{{budget_mensuel}} {{devise}}</td>
      </tr>
      <tr>
        <td>Durée contrat:</td>
        <td class="amount">{{duree_contrat}} mois</td>
      </tr>
      <tr>
        <td>Total HT:</td>
        <td class="amount">{{total_ht}} {{devise}}</td>
      </tr>
      <tr>
        <td>TVA (20%):</td>
        <td class="amount">{{tva}} {{devise}}</td>
      </tr>
      <tr class="total-row">
        <td><strong>Total TTC:</strong></td>
        <td class="amount total">{{total_ttc}} {{devise}}</td>
      </tr>
    </table>
  </section>
  
  <footer class="document-footer">
    <p>Devis valable 15 jours</p>
    <p>{{agency.mentions_legales}}</p>
  </footer>
</div>',
'.document { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.document-header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
.agency-info h1 { margin: 0; color: #333; }
.document-info h2 { margin: 0; color: #666; font-size: 24px; }
.client-info, .services, .financial-info { margin-bottom: 30px; }
.service-description { background: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-line; }
.financial-table { width: 100%; border-collapse: collapse; }
.financial-table td { padding: 10px; border-bottom: 1px solid #ddd; }
.amount { text-align: right; font-weight: bold; }
.total-row { background: #f0f0f0; font-weight: bold; }
.total { color: #2c5aa0; font-size: 18px; }
.document-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }',
'{"required": ["services_inclus", "budget_mensuel", "duree_contrat"], "calculations": ["total_ht", "tva", "total_ttc", "setup_fee"], "defaults": {"devise": "EUR", "tva_rate": 0.20}}'),

('smma_facture_template', 'Facture SMMA', 'Facture pour services marketing', 'smma', 'facture',
'<div class="document">
  <header class="document-header">
    <div class="agency-info">
      <h1>{{agency.nom_agence}}</h1>
      <p>{{agency.adresse_legale}}</p>
      <p>{{agency.numero_siret}}</p>
    </div>
    <div class="document-info">
      <h2>FACTURE</h2>
      <p>Numéro: {{reference}}</p>
      <p>Date: {{date_generation}}</p>
    </div>
  </header>
  
  <section class="billing-info">
    <h3>Informations de facturation</h3>
    <p><strong>Client:</strong> {{client_nom}}</p>
    <p><strong>Période:</strong> {{periode_facturation}}</p>
  </section>
  
  <section class="service-details">
    <h3>Prestations facturées</h3>
    <table class="service-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Période</th>
          <th>Prix unitaire</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{services_inclus}}</td>
          <td>{{periode_facturation}}</td>
          <td>{{budget_mensuel}} {{devise}}</td>
          <td>{{total_ht}} {{devise}}</td>
        </tr>
      </tbody>
    </table>
  </section>
  
  <section class="totals">
    <table class="totals-table">
      <tr>
        <td>Total HT:</td>
        <td class="amount">{{total_ht}} {{devise}}</td>
      </tr>
      <tr>
        <td>TVA (20%):</td>
        <td class="amount">{{tva}} {{devise}}</td>
      </tr>
      <tr class="total-row">
        <td><strong>Total TTC:</strong></td>
        <td class="amount total">{{total_ttc}} {{devise}}</td>
      </tr>
    </table>
  </section>
  
  <footer class="document-footer">
    <p>Échéance de paiement: 30 jours</p>
    <p>Mode de paiement: Virement bancaire</p>
    <p>{{agency.mentions_legales}}</p>
  </footer>
</div>',
'.document { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.document-header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
.service-table, .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.service-table th, .service-table td, .totals-table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
.service-table th { background: #f5f5f5; }
.amount { text-align: right; font-weight: bold; }
.total-row { background: #f0f0f0; font-weight: bold; }
.total { color: #2c5aa0; font-size: 18px; }',
'{"required": ["services_inclus", "budget_mensuel", "periode_facturation"], "calculations": ["total_ht", "tva", "total_ttc"], "defaults": {"devise": "EUR", "tva_rate": 0.20}}'),

('smma_rapport_template', 'Rapport Performance SMMA', 'Rapport mensuel de performance', 'smma', 'rapport',
'<div class="document">
  <header class="document-header">
    <h1>RAPPORT DE PERFORMANCE</h1>
    <p>{{agency.nom_agence}}</p>
    <p>Période: {{periode_analyse}}</p>
  </header>
  
  <section class="summary">
    <h3>Résumé</h3>
    <div class="metrics-grid">
      <div class="metric">
        <h4>Score de performance</h4>
        <div class="score">{{performance_score}}%</div>
      </div>
      <div class="metric">
        <h4>Leads générés</h4>
        <div class="value">{{resultats_obtenus.leads_generes}}</div>
      </div>
      <div class="metric">
        <h4>Conversions</h4>
        <div class="value">{{resultats_obtenus.conversions}}</div>
      </div>
      <div class="metric">
        <h4>ROI estimé</h4>
        <div class="value">{{roi_estime}} {{devise}}</div>
      </div>
    </div>
  </section>
  
  <section class="details">
    <h3>Résultats détaillés</h3>
    <table class="results-table">
      <thead>
        <tr>
          <th>Indicateur</th>
          <th>Objectif</th>
          <th>Résultat</th>
          <th>Taux de réalisation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Leads générés</td>
          <td>{{kpi_principaux.objectif_leads}}</td>
          <td>{{resultats_obtenus.leads_generes}}</td>
          <td>{{Math.round((resultats_obtenus.leads_generes / kpi_principaux.objectif_leads) * 100)}}%</td>
        </tr>
        <tr>
          <td>Conversions</td>
          <td>{{kpi_principaux.objectif_conversions}}</td>
          <td>{{resultats_obtenus.conversions}}</td>
          <td>{{Math.round((resultats_obtenus.conversions / kpi_principaux.objectif_conversions) * 100)}}%</td>
        </tr>
      </tbody>
    </table>
  </section>
  
  <section class="analysis">
    <h3>Analyse et recommandations</h3>
    <div class="analysis-content">
      <p><strong>Performance globale:</strong> {{performance_score}}% de l''objectif atteint</p>
      <p><strong>ROI:</strong> {{roi_estime > 0 ? "Positif" : "Négatif"}} avec {{roi_estime}} {{devise}} de {{roi_estime > 0 ? "gain" : "perte"}}</p>
      <div class="recommendations">
        <h4>Recommandations:</h4>
        <ul>
          <li>{{performance_score >= 80 ? "Excellente performance, maintenir la stratégie actuelle" : performance_score >= 60 ? "Performance correcte, optimiser les campagnes" : "Performance faible, revoir la stratégie"}}</li>
          <li>{{roi_estime > 0 ? "Investissement rentable, envisager d''augmenter le budget" : "Investissement non rentable, optimiser les coûts ou améliorer les conversions"}}</li>
        </ul>
      </div>
    </div>
  </section>
  
  <footer class="document-footer">
    <p>Rapport généré le {{date_generation}}</p>
    <p>{{agency.nom_agence}} - {{agency.email}}</p>
  </footer>
</div>',
'.document { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.document-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
.summary, .details, .analysis { margin-bottom: 30px; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
.metric { text-align: center; padding: 15px; background: #f5f5f5; border-radius: 5px; }
.metric h4 { margin: 0 0 10px 0; font-size: 14px; }
.score, .value { font-size: 24px; font-weight: bold; color: #2c5aa0; }
.results-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.results-table th, .results-table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
.results-table th { background: #f5f5f5; }
.analysis-content { background: #f5f5f5; padding: 15px; border-radius: 5px; }
.recommendations { margin-top: 15px; }
.recommendations ul { margin: 10px 0; padding-left: 20px; }
.document-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }',
'{"required": ["periode_analyse", "kpi_principaux", "resultats_obtenus"], "calculations": ["performance_score", "roi_estime"], "defaults": {"devise": "EUR"}}');

-- Commentaire pour l'extensibilité future
/*
-- Pour ajouter un nouveau type d'agence (ex: consultant), ajouter simplement:
INSERT INTO document_templates (template_key, template_name, agency_type, document_type, template_html, ...)
VALUES ('consultant_devis_template', 'Devis Consultant', 'consultant', 'devis', 'HTML...', 'CSS...', '{"required": [...], "calculations": [...]}');

-- Le système est automatiquement extensible grâce à la structure AGENCY_CONFIGS dans le code
*/
