/**
 * Page de signature électronique — accessible sans authentification
 * URL : /sign/:token
 * Flux : email client → lien unique → client dessine signature → sauvegarde Supabase
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

export default function SignPage() {
  const { token } = useParams();
  const canvasRef  = useRef(null);
  const isDrawing  = useRef(false);
  const lastPos    = useRef(null);

  const [doc,        setDoc]        = useState(null);
  const [status,     setStatus]     = useState('loading'); // loading | ready | signing | signed | error | expired
  const [errorMsg,   setErrorMsg]   = useState('');
  const [signerName, setSignerName] = useState('');
  const [hasDrawn,   setHasDrawn]   = useState(false);
  const [agreed,     setAgreed]     = useState(false);

  // ── Charger le document via le token ──────────────────────────────────────
  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Token manquant.'); return; }
    fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign-info', token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus('error'); setErrorMsg(data.error); return; }
        if (data.already_signed) { setStatus('signed'); return; }
        setDoc(data.document);
        setSignerName(data.document.client_nom || '');
        setStatus('ready');
      })
      .catch(() => { setStatus('error'); setErrorMsg('Impossible de charger le document.'); });
  }, [token]);

  // ── Canvas setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, [status]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    isDrawing.current = true;
    const canvas = canvasRef.current;
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  }, []);

  const stopDraw = useCallback(() => { isDrawing.current = false; }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // ── Soumettre la signature ────────────────────────────────────────────────
  const handleSign = async () => {
    if (!hasDrawn)    { alert('Veuillez dessiner votre signature.'); return; }
    if (!signerName.trim()) { alert('Veuillez entrer votre nom complet.'); return; }
    if (!agreed)      { alert('Veuillez cocher la case d\'acceptation.'); return; }

    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');

    setStatus('signing');
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign-submit', token, signatureData, signerName: signerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus('ready');
        alert(`Erreur : ${data.error || 'Veuillez réessayer.'}`);
      } else {
        setStatus('signed');
      }
    } catch {
      setStatus('ready');
      alert('Erreur réseau. Veuillez réessayer.');
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  const styles = {
    page:    { minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' },
    card:    { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: '540px', overflow: 'hidden' },
    header:  { background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '24px 28px', color: '#fff' },
    body:    { padding: '24px 28px' },
    label:   { fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' },
    value:   { fontSize: '14px', color: '#111827', marginBottom: '16px' },
    canvas:  { width: '100%', height: '160px', border: '2px dashed #d1d5db', borderRadius: '8px', cursor: 'crosshair', background: '#fff', touchAction: 'none', display: 'block' },
    btn:     { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '700', marginTop: '8px' },
    btnPrim: { background: '#10b981', color: '#fff' },
    btnSec:  { background: '#f1f5f9', color: '#374151', fontSize: '13px', padding: '10px', marginTop: '6px' },
    input:   { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
    check:   { display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '16px', fontSize: '12px', color: '#374151' },
    hr:      { border: 'none', borderTop: '1px solid #f1f5f9', margin: '20px 0' },
  };

  if (status === 'loading') return (
    <div style={styles.page}>
      <div style={{ ...styles.card, padding: '48px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
        <p style={{ color: '#6b7280' }}>Chargement du document...</p>
      </div>
    </div>
  );

  if (status === 'signed') return (
    <div style={styles.page}>
      <div style={{ ...styles.card, padding: '48px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ color: '#111827', marginBottom: '8px' }}>Document signé</h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Votre signature a bien été enregistrée. Vous pouvez fermer cette page.
        </p>
      </div>
    </div>
  );

  if (status === 'error' || status === 'expired') return (
    <div style={styles.page}>
      <div style={{ ...styles.card, padding: '48px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <h2 style={{ color: '#111827', marginBottom: '8px' }}>Lien invalide</h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>{errorMsg || 'Ce lien de signature est invalide ou expiré.'}</p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* Logo / Branding */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>Signature électronique sécurisée</div>
      </div>

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Document à signer</div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>{doc?.titre || doc?.reference || 'Document'}</h1>
          {doc?.reference && <div style={{ fontSize: '12px', opacity: 0.7 }}>Réf. {doc.reference}</div>}
        </div>

        <div style={styles.body}>
          {/* Infos document */}
          <div style={styles.label}>Destinataire</div>
          <div style={styles.value}>{doc?.client_nom || '—'} {doc?.client_email ? `(${doc.client_email})` : ''}</div>

          {doc?.total_ttc && <>
            <div style={styles.label}>Montant TTC</div>
            <div style={styles.value}><strong>{Number(doc.total_ttc).toLocaleString('fr-FR')} {doc.devise || '€'}</strong></div>
          </>}

          <div style={styles.hr} />

          {/* Nom du signataire */}
          <div style={{ marginBottom: '16px' }}>
            <label style={styles.label}>Votre nom complet *</label>
            <input
              style={styles.input}
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Prénom Nom"
              disabled={status === 'signing'}
            />
          </div>

          {/* Zone de signature */}
          <div style={styles.label}>Votre signature *</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>Dessinez votre signature ci-dessous avec votre souris ou votre doigt</div>
          <canvas
            ref={canvasRef}
            width={480}
            height={160}
            style={styles.canvas}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <button onClick={clearCanvas} style={{ ...styles.btn, ...styles.btnSec }}>
            🗑 Effacer et recommencer
          </button>

          {/* Checkbox accord */}
          <div style={styles.check}>
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: '2px', flexShrink: 0 }}
              disabled={status === 'signing'}
            />
            <label htmlFor="agree">
              Je reconnais avoir lu et compris le document <strong>«&nbsp;{doc?.titre || doc?.reference}&nbsp;»</strong> et j'accepte d'y apposer ma signature électronique, qui a la même valeur légale qu'une signature manuscrite.
            </label>
          </div>

          {/* Bouton signer */}
          <button
            onClick={handleSign}
            disabled={status === 'signing' || !hasDrawn || !agreed || !signerName.trim()}
            style={{
              ...styles.btn, ...styles.btnPrim,
              opacity: (status === 'signing' || !hasDrawn || !agreed || !signerName.trim()) ? 0.5 : 1,
              cursor:  (status === 'signing' || !hasDrawn || !agreed || !signerName.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'signing' ? '⏳ Enregistrement...' : '✍️ Signer le document'}
          </button>

          <div style={{ marginTop: '16px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
            🔒 Signature sécurisée — date et heure enregistrées automatiquement
          </div>
        </div>
      </div>
    </div>
  );
}
