import { notFound, redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { THEME_CLINIQUE, THEME_NEUTRE } from '@/lib/cliniques'
import { formulairePourEmploye, valeursPreremplies, type Formulaire } from '@/lib/formulaires'
import RemplirFormulaire from '@/components/formulaires/RemplirFormulaire'

export default async function RemplirFormulairePage({ params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  const sb = serviceClient()
  const { data } = await sb.from('formulaires').select('*').eq('id', (await params).id).maybeSingle()
  const f = data as Formulaire | null
  if (!f || !formulairePourEmploye(f, null, acteur.role === 'super_admin' ? 'LES_DEUX' : acteur.clinique)) notFound()
  const espace = await getEspace(acteur)
  const theme = espace.actif ? THEME_CLINIQUE[espace.actif] : THEME_NEUTRE
  let departement: string | null = null
  if (acteur.departement_id) {
    const { data: d } = await sb.from('departements').select('nom').eq('id', acteur.departement_id).maybeSingle()
    departement = d?.nom ?? null
  }
  const initiales = valeursPreremplies(f.champs, { prenom: acteur.prenom, nom: acteur.nom, email: acteur.email, poste: acteur.poste, departement })
  return (
    <RemplirFormulaire formulaireId={f.id} titre={f.titre} code={f.code} description={f.description} instructions={f.instructions}
      champs={f.champs} initiales={initiales} accent={theme.accent} anonymePermis={f.anonyme_permis === true} messageAnonymat={f.message_anonymat ?? null} />
  )
}
