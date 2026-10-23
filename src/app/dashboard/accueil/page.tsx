import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { CLINIQUE_INFO, estAdministrateur } from '@/lib/cliniques'
import { chargerAccueil } from '@/lib/accueil-serveur'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'
import GalerieVisite from './GalerieVisite'
import { badgesEmploye } from '@/lib/badges'
import { i18n } from '@/lib/i18n/serveur'

const externe = (lien: string) => /^https?:\/\//.test(lien)

export default async function AccueilPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  const sb = serviceClient()
  const { t, langue } = await i18n()

  // Formations à faire (dans l'espace actif)
  const { data: assignations } = await sb.from('assignations').select('formation_id').eq('employe_id', acteur.id)
  const ids = (assignations ?? []).map(a => a.formation_id as string)
  const { data: formations } = ids.length
    ? await sb.from('formations').select('id').in('id', ids).eq('publiee', true).in('clinique', espace.cliniquesContenu)
    : { data: [] as { id: string }[] }
  const etat = await chargerEtatsFormations(sb, [acteur.id], (formations ?? []).map(f => f.id))
  const aFaire = (formations ?? []).filter(f => !estComplete(etat(acteur.id, f.id).statut)).length

  if (!espace.actif) {
    return (
      <div style={{ maxWidth: '900px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827' }}>{t('Bonjour {prenom} !', { prenom: acteur.prenom ?? '' })}</h1>
        <p style={{ color: '#6b7280' }}>{t('Aucune clinique n’est encore associée à votre compte. Votre administrateur pourra vous en attribuer une.')}</p>
        <Link href="/dashboard" style={{ display: 'inline-block', marginTop: '12px', color: 'var(--accent-clinique)', fontWeight: 600 }}>{t('Voir mes formations')} →</Link>
      </div>
    )
  }

  const { contenu, disponible } = await chargerAccueil(sb, espace.actif, langue)
  const info = CLINIQUE_INFO[espace.actif]
  // Journées de formation en cours pour cet employé
  const { data: journees } = await sb.from('journees_formation').select('id, nom, raison, date_journee, date_echeance')
    .eq('modele', false).contains('employe_ids', [acteur.id]).order('cree_le', { ascending: false }).limit(3)
  const { banniere, cartes, visite, infos } = contenu
  // Badges obtenus (aperçu) et avancement des parcours
  const { data: moi } = await sb.from('employes').select('id, clinique, role, departement_id, poste').eq('id', acteur.id).single()
  const badges = moi ? await badgesEmploye(sb, moi).catch(() => []) : []
  const obtenus = badges.filter(b => b.obtenu)
  const avancement = new Map(badges.filter(b => b.famille === 'parcours').map(b => [b.id.slice('journee:'.length), b.progression]))

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Bannière */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', background: '#fff', borderRadius: '18px', overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={info.logo} alt={info.nom} style={{ height: '44px', width: 'auto' }} />
            {(info.partenaires ?? []).map(p => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.nom} src={p.logo} alt={p.nom} title={p.nom} style={{ height: '38px', width: 'auto' }} />
            ))}
          </div>
          <h1 style={{ fontSize: '28px', lineHeight: 1.2, fontWeight: 700, color: 'var(--accent-clinique-fonce)', margin: 0 }}>{banniere.titre}</h1>
          <p style={{ color: '#4b5563', fontSize: '15px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{banniere.texte}</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            <Link href="/dashboard" style={{ padding: '10px 18px', borderRadius: '10px', background: 'var(--accent-clinique)', color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
              🎓 {t('Mes formations')}{aFaire > 0 ? ` (${t('{n} à faire', { n: aFaire })})` : ''}
            </Link>
            {estAdministrateur(acteur.role) && (
              <Link href="/admin/accueil" style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e5e7eb', color: '#374151', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }} title={t('Visible uniquement par les administrateurs et l’administrateur global')}>✏️ {t('Modifier cette page · admin')}</Link>
            )}
          </div>
        </div>
        {banniere.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banniere.image} alt="" style={{ width: '100%', height: '100%', minHeight: '260px', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
        )}
      </section>

      {(journees ?? []).length > 0 && (
        <section style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
          {(journees ?? []).map(j => (
            <Link key={j.id} href={`/dashboard/journees/${j.id}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', borderRadius: '14px', background: 'var(--accent-clinique)', color: '#fff', textDecoration: 'none' }}>
              <span style={{ fontSize: '24px' }}>🗓️</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '15px' }}>{t('Journée de formation — {nom}', { nom: j.nom })}</span>
                <span style={{ display: 'block', fontSize: '13px', opacity: 0.85 }}>{j.date_echeance ? t('À compléter avant le {date}', { date: new Date(j.date_echeance + 'T12:00:00').toLocaleDateString(langue === 'en' ? 'en-CA' : 'fr-CA', { dateStyle: 'long' }) }) : j.raison}</span>
              </span>
              {avancement.get(j.id) && <span style={{ fontWeight: 700, fontSize: '14px', background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: '99px' }}>{avancement.get(j.id)!.fait}/{avancement.get(j.id)!.total}</span>}
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('Voir')} →</span>
            </Link>
          ))}
        </section>
      )}

      {badges.length > 0 && (
        <Link href="/dashboard/badges" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '14px 18px', borderRadius: '14px', background: '#fff', border: '1px solid #e5e7eb', textDecoration: 'none', color: '#111827', marginBottom: '24px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>🏅 {t('Mes badges')}</span>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{t('{n}/{total} obtenu(s)', { n: obtenus.length, total: badges.length })}</span>
          <span style={{ flex: 1, display: 'flex', gap: '6px', fontSize: '22px' }} aria-hidden>{obtenus.slice(0, 10).map(b => <span key={b.id} title={t(b.titre, b.vars)}>{b.icone}</span>)}</span>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--accent-clinique)' }}>{t('Voir')} →</span>
        </Link>
      )}

      {/* Cartes (liens et informations) */}
      {cartes.length > 0 && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {cartes.map((c, i) => {
            const corps = (
              <>
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" loading="lazy" style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: '14px 16px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{c.titre}{c.lien && externe(c.lien) ? ' ↗' : ''}</h2>
                  {c.texte && <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{c.texte}</p>}
                </div>
              </>
            )
            const style: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', textDecoration: 'none', display: 'block' }
            if (!c.lien) return <div key={i} style={style}>{corps}</div>
            return externe(c.lien)
              ? <a key={i} href={c.lien} target="_blank" rel="noopener noreferrer" style={style}>{corps}</a>
              : <Link key={i} href={c.lien} style={style}>{corps}</Link>
          })}
        </section>
      )}

      {/* Visite virtuelle */}
      {visite.photos.length > 0 && (
        <section id="visite" style={{ marginBottom: '32px', scrollMarginTop: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{visite.titre || t('Visite virtuelle')}</h2>
          {visite.texte && <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 14px' }}>{visite.texte}</p>}
          <GalerieVisite photos={visite.photos} />
        </section>
      )}

      {infos && (
        <section style={{ background: 'var(--accent-clinique-clair)', borderRadius: '14px', padding: '16px 20px', color: 'var(--accent-clinique-fonce)', fontSize: '14px', whiteSpace: 'pre-line' }}>
          📍 {infos}
        </section>
      )}
      {!disponible && estAdministrateur(acteur.role) && (
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px' }}>Contenu par défaut. Exécutez la migration conformite_suivi.sql pour pouvoir le modifier.</p>
      )}
    </div>
  )
}
