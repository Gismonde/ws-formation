import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { evenementsDeLEmploye, limiteDesinscription, peutSeDesinscrire, seanceOuverte, typeEvenement, fondEvenement, emojiEvenement } from '@/lib/evenements'
import { i18n } from '@/lib/i18n/serveur'
import InscriptionEvenement from './InscriptionEvenement'
import BoutonInteret from './BoutonInteret'

export const dynamic = 'force-dynamic'

export default async function EvenementEmployePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc } = await i18n()
  const x = (await evenementsDeLEmploye(serviceClient(), acteur)).find(e => e.ev.id === id)
  if (!x) notFound()
  const { ev, seances, mienne } = x
  const ma = mienne ? seances.find(s => s.id === mienne.seance_id) ?? null : null
  const fmt = (d: string) => new Date(d).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const h = (d: string) => new Date(d).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 16px' }}>
      <Link href="/dashboard/evenements" style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>{t('← Événements')}</Link>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', marginTop: '12px' }}>
        {ev.image
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ev.image} alt="" style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', display: 'block' }} />
          : <div style={{ height: '150px', background: fondEvenement(ev).hero, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }} aria-hidden>{emojiEvenement(ev)}</div>}
        <div style={{ padding: '20px 24px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, background: typeEvenement(ev).fond, color: typeEvenement(ev).couleur, padding: '3px 10px', borderRadius: '999px', marginRight: '6px' }}>{typeEvenement(ev).emoji} {t(typeEvenement(ev).libelle)}</span>
          {ev.obligatoire && <span style={{ fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px' }}>{t('Formation obligatoire')}</span>}
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '8px 0' }}>{ev.titre}</h1>
          <div style={{ fontSize: '14px', color: '#374151', display: 'grid', gap: '4px' }}>
            {ev.lieu && <div>📍 {ev.lieu}</div>}
            {ev.responsable && <div>👤 {ev.responsable}</div>}
            {ev.duree_minutes && <div>⏱ {t('{n} minutes de formation', { n: ev.duree_minutes })}</div>}
          </div>
          {ev.description && <p style={{ fontSize: '14px', color: '#4b5563', whiteSpace: 'pre-line', marginTop: '12px', lineHeight: 1.6 }}>{ev.description}</p>}
        </div>
      </div>

      {ev.date_a_venir && !seances.some(s => seanceOuverte(s)) ? (
        <BoutonInteret evenementId={ev.id} interesse={await (async () => {
          const { data } = await serviceClient().from('evenements_interets').select('employe_id').eq('evenement_id', ev.id).eq('employe_id', acteur.id).maybeSingle()
          return !!data
        })()} />
      ) : <InscriptionEvenement
        evenementId={ev.id}
        participer={typeEvenement(ev).id !== 'formation'}
        maSeance={ma ? { id: ma.id, statut: mienne!.statut, present: mienne!.present ?? null, peutAnnuler: mienne!.statut === 'attente' || peutSeDesinscrire(ma, ev.desinscription_heures), limite: limiteDesinscription(ma, ev.desinscription_heures).toISOString() } : null}
        seances={seances.filter(s => !s.annulee).map(s => ({ id: s.id, jour: fmt(s.debut), heures: `${h(s.debut)} – ${h(s.fin)}`, lieu: s.lieu, restantes: s.restantes, places: s.places, ouverte: seanceOuverte(s) }))}
      />}
    </div>
  )
}
