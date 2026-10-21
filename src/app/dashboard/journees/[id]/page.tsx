import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'
import { contenuJournee, CHAMPS_JOURNEE, type Journee } from '@/lib/journees'
import { signerUrlsMedias } from '@/lib/medias-serveur'
import { i18n } from '@/lib/i18n/serveur'

// « Ma journée de formation » : tout ce que l'employé doit compléter ou visionner, avec son avancement.
export default async function MaJourneePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const { t, loc } = await i18n()
  const sb = serviceClient()
  const { data } = await sb.from('journees_formation').select(CHAMPS_JOURNEE).eq('id', id).eq('modele', false).maybeSingle()
  const j = data as Journee | null
  if (!j || !j.employe_ids.includes(acteur.id)) notFound()

  const c = await contenuJournee(sb, j)
  const formations = c.formations.filter(f => f.publiee)
  const etat = await chargerEtatsFormations(sb, [acteur.id], formations.map(f => f.id))
  const { data: confs } = c.politiques.length
    ? await sb.from('politiques_confirmations').select('politique_id, version').eq('employe_id', acteur.id).in('politique_id', c.politiques.map(p => p.id))
    : { data: [] as { politique_id: string; version: number }[] }
  const confirmee = (p: { id: string; version: number }) => (confs ?? []).some(x => x.politique_id === p.id && x.version === p.version)
  const liens = await signerUrlsMedias(c.librairie.map(l => l.url))
  const total = formations.length + c.politiques.length
  const faits = formations.filter(f => estComplete(etat(acteur.id, f.id).statut)).length + c.politiques.filter(confirmee).length
  const date = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString(loc, { dateStyle: 'long' }) : null)

  const Ligne = ({ href, externe, icone, titre, fait, statut }: { href: string; externe?: boolean; icone: string; titre: string; fait?: boolean; statut: string }) => (
    <li>
      <a href={href} {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', textDecoration: 'none', color: '#111827' }}>
        <span style={{ fontSize: '18px' }}>{fait ? '✅' : icone}</span>
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{titre}</span>
        <span style={{ fontSize: '12px', color: fait ? '#16a34a' : '#6b7280', fontWeight: 600 }}>{statut}</span>
      </a>
    </li>
  )
  const bloc = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', marginBottom: '18px', overflow: 'hidden' } as const
  const titreBloc = { fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', margin: 0 } as const

  return (
    <div style={{ maxWidth: '820px' }}>
      <Link href="/dashboard/accueil" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>← {t('Accueil')}</Link>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '8px 0 4px' }}>{t('Journée de formation — {nom}', { nom: j.nom })}</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 16px' }}>
        {[j.raison, date(j.date_journee), j.date_echeance ? t('À compléter avant le {date}', { date: date(j.date_echeance)! }) : null].filter(Boolean).join(' · ')}
      </p>
      {j.note && <p style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', margin: '0 0 18px' }}>{j.note}</p>}
      {total > 0 && (
        <div style={{ ...bloc, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            <span>{t('Avancement')}</span><span>{faits}/{total}</span>
          </div>
          <div style={{ height: '8px', borderRadius: '99px', background: '#f3f4f6', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((faits / total) * 100)}%`, height: '100%', background: 'var(--accent-clinique)' }} />
          </div>
        </div>
      )}
      {formations.length > 0 && (
        <section style={bloc}>
          <h2 style={titreBloc}>🎓 {t('Formations à compléter')}</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {formations.map(f => {
              const s = etat(acteur.id, f.id).statut
              return <Ligne key={f.id} href={`/formations/${f.id}`} icone="🎓" titre={f.titre} fait={estComplete(s)} statut={estComplete(s) ? t('Complétée') : s === 'en_cours' ? t('En cours') : t('À faire')} />
            })}
          </ul>
        </section>
      )}
      {c.politiques.length > 0 && (
        <section style={bloc}>
          <h2 style={titreBloc}>📜 {t('Politiques à lire et confirmer')}</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {c.politiques.map(p => <Ligne key={p.id} href={`/dashboard/politiques/${p.id}`} icone="📜" titre={p.titre} fait={confirmee(p)} statut={confirmee(p) ? t('Confirmée') : t('À confirmer')} />)}
          </ul>
        </section>
      )}
      {c.librairie.length > 0 && (
        <section style={bloc}>
          <h2 style={titreBloc}>📚 {t('Informations à visionner')}</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {c.librairie.map(l => <Ligne key={l.id} href={liens[l.url] ?? l.url} externe icone={l.type === 'video' ? '🎬' : '🔗'} titre={l.titre} statut={t('Ouvrir')} />)}
          </ul>
        </section>
      )}
    </div>
  )
}
