'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'

type S = { id: string; jour: string; heures: string; lieu: string | null; restantes: number; places: number; ouverte: boolean }

export default function InscriptionEvenement({ evenementId, maSeance, seances }: {
  evenementId: string
  maSeance: { id: string; statut: string; present: boolean | null; peutAnnuler: boolean; limite: string } | null
  seances: S[]
}) {
  const { t, loc } = useT()
  const router = useRouter()
  const confirmer = useConfirmer()
  const [envoi, setEnvoi] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)

  async function sInscrire(s: S) {
    if (maSeance && maSeance.id !== s.id && !(await confirmer({ message: t('Changer pour la séance du {jour} ? Votre inscription actuelle sera annulée.', { jour: s.jour }), bouton: t('Changer de séance') }))) return
    setEnvoi(s.id); setMsg(null)
    const r = await fetch(`/api/evenements/${evenementId}/inscription`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seanceId: s.id }) })
    const d = await r.json().catch(() => ({}))
    setEnvoi(null)
    if (!r.ok) { setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setMsg({ ok: true, texte: d.statut === 'inscrit' ? t('Vous êtes inscrit(e) ! Une confirmation vous est envoyée par courriel.') : t('La séance est complète : vous êtes sur la liste d’attente. Vous serez prévenu(e) si une place se libère.') })
    router.refresh()
  }

  async function annuler() {
    if (!(await confirmer({ message: t('Annuler votre inscription ?'), bouton: t('Me désinscrire'), danger: true }))) return
    setEnvoi('annuler'); setMsg(null)
    const r = await fetch(`/api/evenements/${evenementId}/inscription`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    setEnvoi(null)
    if (!r.ok) { setMsg({ ok: false, texte: d.error ?? t('Erreur') }); return }
    setMsg({ ok: true, texte: t('Inscription annulée.') })
    router.refresh()
  }

  const carte: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px 20px' }
  const bouton = (principal: boolean): React.CSSProperties => ({ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', border: principal ? 'none' : '1px solid #d1d5db', background: principal ? 'var(--accent-clinique, #4f46e5)' : '#fff', color: principal ? '#fff' : '#374151' })

  return (
    <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
      {msg && <div style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#991b1b', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>{msg.texte}</div>}

      {maSeance && (
        <div style={{ ...carte, borderColor: maSeance.statut === 'inscrit' ? '#bbf7d0' : '#c7d2fe', background: maSeance.statut === 'inscrit' ? '#f0fdf4' : '#eef2ff' }}>
          <div style={{ fontWeight: 600, color: '#111827' }}>
            {maSeance.present === true ? '✓ ' + t('Vous avez participé à cette formation.') : maSeance.statut === 'inscrit' ? '✓ ' + t('Vous êtes inscrit(e)') : t('Vous êtes sur la liste d’attente')}
          </div>
          {(() => { const s = seances.find(x => x.id === maSeance.id); return s ? <div style={{ fontSize: '14px', color: '#374151', marginTop: '4px', textTransform: 'none' }}>{s.jour} · {s.heures}{s.lieu ? ` · ${s.lieu}` : ''}</div> : null })()}
          {maSeance.present === null && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', alignItems: 'center' }}>
              {maSeance.statut === 'inscrit' && <a href={`/api/evenements/${evenementId}/calendrier?seance=${maSeance.id}`} style={{ ...bouton(false), textDecoration: 'none' }}>📅 {t('Ajouter à mon calendrier')}</a>}
              {maSeance.peutAnnuler
                ? <button type="button" disabled={!!envoi} onClick={annuler} style={bouton(false)}>{t('Me désinscrire')}</button>
                : <span style={{ fontSize: '12px', color: '#6b7280' }}>{t('Désinscription possible jusqu’au {date}. Contactez le responsable pour toute question.', { date: new Date(maSeance.limite).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>}
            </div>
          )}
        </div>
      )}

      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '8px 0 0' }}>{maSeance ? t('Toutes les dates') : t('Choisissez une date')}</h2>
      {seances.length === 0 && <p style={{ fontSize: '14px', color: '#6b7280' }}>{t('Aucune date pour le moment.')}</p>}
      {seances.map(s => {
        const mienne = maSeance?.id === s.id
        return (
          <div key={s.id} style={{ ...carte, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', opacity: s.ouverte ? 1 : 0.6 }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{s.jour}</div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>{s.heures}{s.lieu ? ` · ${s.lieu}` : ''}</div>
              <div style={{ fontSize: '12px', marginTop: '2px', color: s.restantes > 0 ? '#166534' : '#b45309' }}>
                {s.restantes > 0 ? t('{n} place(s) disponible(s) sur {p}', { n: s.restantes, p: s.places }) : t('Complet')}
              </div>
            </div>
            {mienne ? <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>{t('Ma séance')}</span>
              : s.ouverte && maSeance?.present !== true ? (
                <button type="button" disabled={!!envoi} onClick={() => sInscrire(s)} style={bouton(true)}>
                  {envoi === s.id ? '…' : s.restantes > 0 ? (maSeance ? t('Choisir cette date') : t('M’inscrire')) : t('Liste d’attente')}
                </button>
              ) : !s.ouverte ? <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('Terminée')}</span> : null}
          </div>
        )
      })}
    </div>
  )
}
