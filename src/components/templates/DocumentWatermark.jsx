/**
 * DocumentWatermark — Filigrane automatique selon le statut du document
 * Utilisable dans tous les templates React (MandatTemplate, FactureTemplate, DevisTemplate…)
 * S'affiche en impression et à l'écran, sur chaque page PDF.
 */
import React from 'react';

// ─── Configuration des statuts ──────────────────────────────
export const WATERMARK_CONFIG = {
  brouillon: {
    text: 'BROUILLON',
    color: '#9ca3af',       // gris
    opacity: 0.18,
  },
  généré: {
    text: 'GÉNÉRÉ',
    color: '#a855f7',       // violet
    opacity: 0.15,
  },
  envoyé: {
    text: 'ENVOYÉ',
    color: '#3b82f6',       // bleu
    opacity: 0.15,
  },
  signé: {
    text: 'SIGNÉ',
    color: '#22c55e',       // vert
    opacity: 0.18,
  },
  annulé: {
    text: 'ANNULÉ',
    color: '#ef4444',       // rouge
    opacity: 0.22,
  },
};

// ─── Composant ──────────────────────────────────────────────
/**
 * @param {string} statut  - Statut du document (brouillon | généré | envoyé | signé | annulé)
 * @param {boolean} print  - true = position fixed (répété sur chaque page PDF)
 */
export default function DocumentWatermark({ statut, print = true }) {
  if (!statut) return null;

  const config = WATERMARK_CONFIG[statut?.toLowerCase()];
  if (!config) return null;

  const style = {
    position: print ? 'fixed' : 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: '110px',
    fontWeight: '900',
    fontFamily: 'Inter, Arial, sans-serif',
    letterSpacing: '0.1em',
    color: config.color,
    opacity: config.opacity,
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: 9999,
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <div style={style} aria-hidden="true">
        {config.text}
      </div>
      {/* Répétition bas de page pour les documents longs */}
      <div style={{ ...style, top: '80%' }} aria-hidden="true">
        {config.text}
      </div>
      <style>{`
        @media print {
          .doc-watermark {
            position: fixed !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}

// ─── Utilitaire CSS pour generateDocumentHtml.js ──────────────
/**
 * Retourne le bloc CSS + HTML du filigrane pour injection dans du HTML pur.
 * @param {string} statut
 * @returns {{ css: string, html: string }}
 */
export function getWatermarkHtml(statut) {
  if (!statut) return { css: '', html: '' };
  const config = WATERMARK_CONFIG[statut?.toLowerCase()];
  if (!config) return { css: '', html: '' };

  const css = `
    .doc-watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 110px;
      font-weight: 900;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      letter-spacing: 0.1em;
      color: ${config.color};
      opacity: ${config.opacity};
      pointer-events: none;
      user-select: none;
      z-index: 9999;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc-watermark-bottom {
      position: fixed;
      top: 80%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 110px;
      font-weight: 900;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      letter-spacing: 0.1em;
      color: ${config.color};
      opacity: ${config.opacity};
      pointer-events: none;
      user-select: none;
      z-index: 9999;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  `;

  const html = `
    <div class="doc-watermark" aria-hidden="true">${config.text}</div>
    <div class="doc-watermark-bottom" aria-hidden="true">${config.text}</div>
  `;

  return { css, html };
}
