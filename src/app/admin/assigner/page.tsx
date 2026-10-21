import { redirect } from 'next/navigation'
import { getActeur, serviceClient, filtrerEmployes, departementsVisibles, cliniquesContenuVisibles, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin, cliniqueAffichee, CLINIQUE_EMPLOYE_LABEL } from '@/lib/cliniques'
import { peutPublierPolitiques, peutGererPolitique, type Politique } from '@/lib/politiques'
import AssignationGroupee from './AssignationGroupee'

const liste = (v: string | undefined) => (v ?? '').split(',').filter(Boolean)

export default async function AssignerPage({ searchParams }: { searchParams: Promise<{ formations?: string; politiques?: string; employes?: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role)) redirect('/dashboard/accueil')
  const sb = serviceClient()
  const sp = await searchParams

  const politiquesPermises = peutPublierPolitiques(acteur)
  const [{ data: formations }, { data: employes }, departements, { data: politiques }] = await Promise.all([
    sb.from('formations').select('id, titre, categorie, clinique, publiee, obligatoire').in('clinique', cliniquesContenuVisibles(acteur)).order('titre'),
    filtrerEmployes(sb.from('employes').select('id, prenom, nom, role, clinique, departement_id, departements(nom)').or('actif.is.null,actif.eq.true').order('nom'), acteur),
    departementsVisibles(acteur, sb),
    politiquesPermises ? sb.from('politiques').select('*').eq('actif', true).order('titre') : Promise.resolve({ data: [] as Politique[] }),
  ])

  return (
    <AssignationGroupee
      formations={(formations ?? []).map(f => ({ id: f.id, titre: f.titre, detail: [f.categorie, f.clinique === 'LES_DEUX' ? 'CMC + WSSC' : f.clinique, f.publiee ? null : 'brouillon'].filter(Boolean).join(' · '), obligatoire: f.obligatoire === true }))}
      politiques={((politiques ?? []) as Politique[]).filter(p => peutGererPolitique(acteur, p)).map(p => ({ id: p.id, titre: p.titre, detail: `${CLINIQUE_EMPLOYE_LABEL[p.clinique]} · v${p.version}` }))}
      employes={(employes ?? []).map(e => {
        const c = cliniqueAffichee(e.clinique, e.role)
        const d = e.departements as { nom?: string } | { nom?: string }[] | null
        return { id: e.id, nom: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim(), clinique: c ? CLINIQUE_EMPLOYE_LABEL[c] : '', departement_id: e.departement_id, departement: (Array.isArray(d) ? d[0]?.nom : d?.nom) ?? '' }
      })}
      departements={departements.map(d => ({ id: d.id, nom: d.nom }))}
      cliniques={acteur.role === 'gestionnaire' ? [] : cliniquesAdministrees(acteur)}
      politiquesPermises={politiquesPermises}
      preselection={{ formations: liste(sp.formations), politiques: liste(sp.politiques), employes: liste(sp.employes) }}
    />
  )
}
