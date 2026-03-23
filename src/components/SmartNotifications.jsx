/**
 * SmartNotifications.jsx
 * Système de notifications intelligentes — Phase 2 Point 9
 *
 * Alertes gérées :
 *  • Lead chaud sans contact depuis 48h
 *  • X nouveaux leads cette semaine
 *  • Taux de conversion en baisse
 *  • Quota leads proche (Starter/Free)
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';

// ── Clé de stockage pour les notifs déjà vues ──
const SEEN_KEY = 'smart_notifs_seen';

function getSeenIds() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function markSeen(id) {
  const seen = getSeenIds();
  if (!seen.includes(id)) {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
  }
}

// ────────// ──────────────────────────────
// Hook : construire la liste des notifications
// ──────────────────────────────────────
export function useSmartNotifications(agencyId) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const buildNotifications = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);

    try {
      const now = new Date();
      const notifs = [];

      const since48h = new Date(now - 48 * 60 * 60 * 1000).toISOString();

      // ── 1. Leads chauds "À traiter" sans contact depuis 48h ──
      // Utilise niveau_interet (température IA) et score_qualification, PAS qualification (= statut pipeline)
      const { data: hotUntouched } = await supabase
        .from('leads')
        .select('id, nom, niveau_interet, score_qualification, score_ia, score, statut, updated_at')
        .eq('agency_id', agencyId)
        .eq('statut', 'À traiter')
        .lt('updated_at', since48h)
        .limit(5);

      // Filtrer côté client : chauds = niveau_interet chaud OU score >= 70
      const hotNotContacted = (hotUntouched || []).filter(l => {
        const niv = (l.niveau_interet || '').toLowerCase().replace('tiède','tiede');
        const score = l.score_qualification || l.score_ia || l.score || 0;
        return niv === 'chaud' || score >= 70;
      });

      if (hotNotContacted.length > 0) {
        const id = `hot_not_contacted_${hotNotContacted.map(l => l.id).join('_')}`;
        notifs.push({
          id,
          type: 'warning',
          icon: '🔥',
          title: t('alerts.hotLeads', { count: hotNotContacted.length }),
          body: hotNotContacted.slice(0, 3).map(l => l.nom).join(', ') + (hotNotContacted.length > 3 ? ` +${hotNotContacted.length - 3}` : '') + ' — Contactez-les maintenant !',
          action: { label: 'Voir le pipeline', href: '/dashboard' },
          priority: 1,
        });
      }

      // ── 1b. Leads chauds "Contacté" bloqués depuis 48h (pas avancés vers Négociation) ──
      const { data: hotStalled } = await supabase
        .from('leads')
        .select('id, nom, niveau_interet, score_qualification, score_ia, score, statut, updated_at')
        .eq('agency_id', agencyId)
        .in('statut', ['Contacté', 'Offre en cours'])
        .lt('updated_at', since48h)
        .limit(5);

      const hotStalledFiltered = (hotStalled || []).filter(l => {
        const niv = (l.niveau_interet || '').toLowerCase().replace('tiède','tiede');
        const score = l.score_qualification || l.score_ia || l.score || 0;
        return niv === 'chaud' || score >= 70;
      });

      if (hotStalledFiltered.length > 0) {
        const id = `hot_stalled_${hotStalledFiltered.map(l => l.id).join('_')}`;
        notifs.push({
          id,
          type: 'alert',
          icon: '⚡',
          title: t('alerts.hotLeads', { count: hotStalledFiltered.length }),
          body: hotStalledFiltered.slice(0, 3).map(l => `${l.nom} (${l.statut})`).join(', ') + (hotStalledFiltered.length > 3 ? ` +${hotStalledFiltered.length - 3}` : '') + ' — Relancez pour passer en Négociation.',
          action: { label: 'Voir le pipeline', href: '/dashboard' },
          priority: 1,
        });
      }

      // ── 2. Nouveaux leads cette semaine ──
      const monday = new Date(now);
      monday.setDate(now.getDate() - now.getDay() + 1);
      monday.setHours(0, 0, 0, 0);

      const { count: newLeadsCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .gte('created_at', monday.toISOString());

      if (newLeadsCount && newLeadsCount >= 3) {
        const id = `new_leads_week_${monday.toISOString().slice(0, 10)}`;
        notifs.push({
          id,
          type: 'info',
          icon: '📈',
          title: `${newLeadsCount} nouveaux leads cette semaine`,
          body: 'Bonne dynamique ! Pensez à les qualifier rapidement.',
          action: { label: 'Voir les leads', href: '/dashboard' },
          priority: 3,
        });
      }

      // ── 3. Taux de conversion en baisse (comparaison mois N vs N-1) ──
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      const [thisRes, lastRes, thisWon, lastWon] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).gte('created_at', thisMonthStart),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('statut', 'Gagné').gte('created_at', thisMonthStart),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('statut', 'Gagné').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
      ]);

      const thisTotal = thisRes.count || 0;
      const lastTotal = lastRes.count || 0;
      const thisRate  = thisTotal > 0 ? (thisWon.count || 0) / thisTotal : 0;
      const lastRate  = lastTotal > 0 ? (lastWon.count || 0) / lastTotal : 0;

      if (lastRate > 0 && thisTotal >= 5 && thisRate < lastRate * 0.9) {
        const drop = Math.round((1 - thisRate / lastRate) * 100);
        const id = `conv_drop_${now.getFullYear()}_${now.getMonth()}`;
        notifs.push({
          id,
          type: 'alert',
          icon: '📉',
          title: `Taux de conversion en baisse de ${drop}% ce mois`,
          body: `${Math.round(lastRate * 100)}% → ${Math.round(thisRate * 100)}% · Analysez vos leads pour identifier les blocages.`,
          action: { label: 'Voir les stats', href: '/stats' },
          priority: 2,
        });
      }

      // ── Filtrer celles déjà vues (sauf urgentes) ──
      const seen = getSeenIds();
      const filtered = notifs
        .filter(n => n.priority <= 1 || !seen.includes(n.id)) // les priorité 1 restent toujours visibles
        .sort((a, b) => a.priority - b.priority);

      setNotifications(filtered);
    } catch (err) {
      console.error('[SmartNotifications]', err);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    buildNotifications();
    // Rafraîchir toutes les 10 minutes
    const interval = setInterval(buildNotifications, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [buildNotifications]);

  const dismiss = (id) => {
    markSeen(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return { notifications, loading, dismiss, refresh: buildNotifications };
}

// ──// ──────────────────────────────
// Composant : Cloche de notifications (icône dans le header)
// ──────────────────────────────────────
export function NotificationBell({ agencyId }) {
  const { notifications, dismiss } = useSmartNotifications(agencyId);
  const [open, setOpen] = useState(false);

  const count = notifications.length;

  const typeStyle = {
    warning: 'border-l-4 border-orange-400 bg-orange-50',
    info:    'border-l-4 border-blue-400 bg-blue-50',
    alert:   'border-l-4 border-red-400 bg-red-50',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        title={count > 0 ? `${count} notification${count > 1 ? 's' : ''}` : 'Aucune notification'}
      >
        🔔
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-sm font-bold text-slate-800">Notifications</span>
              {count > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{count} actives</span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {count === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <span className="text-2xl block mb-2">✅</span>
                  <p className="text-sm">Tout est à jour</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`p-4 ${typeStyle[n.type] || ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="text-lg shrink-0">{n.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-800 leading-tight">{n.title}</p>
                          {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                          {n.action && (
                            <a
                              href={n.action.href}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1 block"
                              onClick={() => setOpen(false)}
                            >
                              {n.action.label} →
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => dismiss(n.id)}
                        className="text-slate-300 hover:text-slate-500 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ────────// ──────────────────────────────
// Composant : Bannières inline dans le Dashboard
// ──────────────────────────────────────
export function NotificationBanners({ agencyId }) {
  const { notifications, dismiss } = useSmartNotifications(agencyId);

  // N'afficher que les notifications de priorité 1 (urgentes) en bannière
  const urgent = notifications.filter(n => n.priority === 1);
  if (urgent.length === 0) return null;

  const typeStyle = {
    warning: 'bg-orange-50 border-orange-200 text-orange-800',
    alert:   'bg-red-50 border-red-200 text-red-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className="space-y-2">
      {urgent.map(n => (
        <div key={n.id} className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${typeStyle[n.type] || typeStyle.info}`}>
          <div className="flex items-center gap-2">
            <span>{n.icon}</span>
            <span className="font-medium">{n.title}</span>
            {n.body && <span className="text-xs opacity-70 hidden sm:block">— {n.body}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {n.action && (
              <a href={n.action.href} className="text-xs font-semibold underline hover:no-underline">
                {n.action.label}
              </a>
            )}
            <button onClick={() => dismiss(n.id)} className="text-current opacity-40 hover:opacity-70 text-xs">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
