import { notFound, redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutModifierFormulaire, cliniquesFormulairePossibles, type Formulaire } from '@/lib/formulaires'
import EditeurFormulaire from '@/components/formulaires/EditeurFormulaire'

export default async function ModifierFormulairePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await getActeur()
  if (!a) redirect('/login')
  const sb = serviceClient()
  const { data } = await sb.from('formulaires').select('*').eq('id', (await params).id).maybeSingle()
  const f = data as Formulaire | null
  if (!f || !peutModifierFormulaire(a, f)) notFound()
  const [{ data: admins }, { data: createur }] = await Promise.all([
    sb.from('employes').select('id, prenom, nom, role, clinique, actif').in('role', ['admin', 'super_admin']).or('actif.is.null,actif.eq.true').order('prenom'),
    f.cree_par ? sb.from('employes').select('prenom, nom').eq('id', f.cree_par).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const cliniques = Array.from(new Set([...cliniquesFormulairePossibles(a), f.clinique]))
  return (
    <EditeurFormulaire id={f.id} cliniques={cliniques} personnes={(admins ?? []).filter(p => p.id !== f.cree_par)}
      createurNom={createur ? `${createur.prenom ?? ''} ${createur.nom ?? ''}`.trim() : '—'}
      initial={{ titre: f.titre, code: f.code, description: f.description, instructions: f.instructions, clinique: f.clinique, destinataire_id: f.destinataire_id, actif: f.actif, champs: f.champs }} />
  )
}
