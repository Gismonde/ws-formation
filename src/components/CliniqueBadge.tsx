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

/** Logo(s) officiel(s) de la ou des cliniques (+ partenaires, ex. GrS Montréal pour le CMC).
 *  Chaque logo tient dans la même boîte (largeur × hauteur max) : les logos larges prennent toute
 *  la largeur, les logos carrés (WSSC) toute la hauteur — le rendu reste équilibré.
 *  « colonne » : barre latérale (empilés, centrés, séparés par un filet) ; « ligne » : bannières. */
export function CliniqueLogos({ clinique, hauteur = 48, largeur, partenaires = true, disposition = 'ligne' }: {
  clinique: string | null | undefined; hauteur?: number; largeur?: number; partenaires?: boolean; disposition?: 'ligne' | 'colonne'
}) {
  const liste = cliniquesDe(clinique)
  if (liste.length === 0) return null
  const larg = largeur ?? Math.round(hauteur * 3.6)
  const logos = liste.flatMap(c => [
    { cle: c, src: CLINIQUE_INFO[c].logo, nom: CLINIQUE_INFO[c].nom, echelle: 1 },
    ...(partenaires ? (CLINIQUE_INFO[c].partenaires ?? []).map(p => ({ cle: c + p.nom, src: p.logo, nom: p.nom, echelle: p.echelle ?? 1 })) : []),
  ])
  const colonne = disposition === 'colonne'
  return (
    <div style={{ display: 'flex', flexDirection: colonne ? 'column' : 'row', alignItems: 'center', justifyContent: colonne ? 'center' : 'flex-start', gap: colonne ? '10px' : '18px', flexWrap: colonne ? 'nowrap' : 'wrap', width: colonne ? '100%' : undefined }}>
      {logos.map((l, i) => (
        <div key={l.cle} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden style={colonne ? { width: '60%', height: '1px', background: '#e5e7eb' } : { width: '1px', alignSelf: 'stretch', background: '#e5e7eb' }} />}
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: hauteur, width: colonne ? '100%' : undefined, maxWidth: larg }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.src} alt={l.nom} title={l.nom} style={{ maxHeight: Math.round(hauteur * l.echelle), maxWidth: Math.round(100 * l.echelle) + '%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
          </span>
        </div>
      ))}
    </div>
  )
}
