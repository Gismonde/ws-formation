import { CLINIQUE_INFO, cliniquesDe, cliniqueAffichee } from '@/lib/cliniques'

/** Petit badge texte « CMC » / « WSSC » (listes, tableaux). */
export function CliniqueBadge({ clinique, role }: { clinique: string | null | undefined; role?: string | null }) {
  const liste = cliniquesDe(cliniqueAffichee(clinique, role))
  if (liste.length === 0) {
    return <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Non assignée</span>
  }
  return (
    <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
      {liste.map(c => (
        <span key={c} style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
          background: CLINIQUE_INFO[c].fond, color: CLINIQUE_INFO[c].couleur, border: `1px solid ${CLINIQUE_INFO[c].couleur}33`,
        }}>
          {CLINIQUE_INFO[c].court}
        </span>
      ))}
    </span>
  )
}

/** Logo(s) officiel(s) de la ou des cliniques de l'employé (profil). */
export function CliniqueLogos({ clinique, hauteur = 48, partenaires = true }: { clinique: string | null | undefined; hauteur?: number; partenaires?: boolean }) {
  const liste = cliniquesDe(clinique)
  if (liste.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      {liste.flatMap(c => [
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c}
          src={CLINIQUE_INFO[c].logo}
          alt={CLINIQUE_INFO[c].nom}
          title={CLINIQUE_INFO[c].nom}
          style={{ height: hauteur, width: 'auto', borderRadius: '6px', objectFit: 'contain' }}
        />,
        // Logo partenaire (ex. GrS Montréal pour le CMC), un peu plus petit
        ...(partenaires ? (CLINIQUE_INFO[c].partenaires ?? []).map(p => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c + p.nom} src={p.logo} alt={p.nom} title={p.nom}
            style={{ height: Math.round(hauteur * 0.8), width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
        )) : []),
      ])}
    </div>
  )
}
