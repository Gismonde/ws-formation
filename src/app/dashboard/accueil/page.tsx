import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { CLINIQUE_INFO, estAdministrateur } from '@/lib/cliniques'
import { chargerAccueil } from '@/lib/accueil-serveur'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'
import GalerieVisite from './GalerieVisite'

const externe = (lien: string) => /^https?:\/\//.test(lien)

export default async function AccueilPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const espace = await getEspace(acteur)
  const sb = serviceClient()

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
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827' }}>Bonjour {acteur.prenom} !</h1>
        <p style={{ color: '#6b7280' }}>Aucune clinique n’est encore associée à votre compte. Votre administrateur pourra vous en attribuer une.</p>
        <Link href="/dashboard" style={{ display: 'inline-block', marginTop: '12px', color: 'var(--accent-clinique)', fontWeight: 600 }}>Voir mes formations →</Link>
      </div>
    )
  }

  const { contenu, disponible } = await chargerAccueil(sb, espace.actif)
  const info = CLINIQUE_INFO[espace.actif]
  const { banniere, cartes, visite, infos } = contenu

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Bannière */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', background: '#fff', borderRadius: '18px', overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={info.logo} alt={info.nom} style={{ height: '44px', width: 'auto', alignSelf: 'flex-start' }} />
          <h1 style={{ fontSize: '28px', lineHeight: 1.2, fontWeight: 700, color: 'var(--accent-clinique-fonce)', margin: 0 }}>{banniere.titre}</h1>
          <p style={{ color: '#4b5563', fontSize: '15px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{banniere.texte}</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            <Link href="/dashboard" style={{ padding: '10px 18px', borderRadius: '10px', background: 'var(--accent-clinique)', color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
              🎓 Mes formations{aFaire > 0 ? ` (${aFaire} à faire)` : ''}
            </Link>
            {estAdministrateur(acteur.role) && (
              <Link href="/admin/accueil" style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e5e7eb', color: '#374151', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>✏️ Modifier cette page</Link>
            )}
          </div>
        </div>
        {banniere.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banniere.image} alt="" style={{ width: '100%', height: '100%', minHeight: '260px', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
        )}
      </section>

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
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{visite.titre || 'Visite virtuelle'}</h2>
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
