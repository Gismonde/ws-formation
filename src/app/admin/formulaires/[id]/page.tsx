import { notFound, redirect } from 'next/navigation'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutModifierFormulaire, type Formulaire, type Destinataire } from '@/lib/formulaires'
import { destinatairesPossibles } from '@/lib/formulaires-serveur'
import EditeurFormulaire from '@/components/formulaires/EditeurFormulaire'

export default async function ModifierFormulairePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await getActeur()
  if (!a) redirect('/login')
  const sb = serviceClient()
  const { data } = await sb.from('formulaires').select('*').eq('id', (await params).id).maybeSingle()
  const f = data as Formulaire | null
  if (!f || !peutModifierFormulaire(a, f)) notFound()
  const [{ personnes, departements }, { data: createur }] = await Promise.all([
    destinatairesPossibles(sb),
    f.cree_par ? sb.from('employes').select('prenom, nom').eq('id', f.cree_par).maybeSingle() : Promise.resolve({ data: null }),
  ])
  // Ancien destinataire unique → liste
  const destinataires: Destinataire[] = (f.destinataires ?? []).length ? f.destinataires! : f.destinataire_id ? [{ type: 'employe', id: f.destinataire_id }] : []
  return (
    <EditeurFormulaire id={f.id} personnes={personnes.filter(p => p.id !== f.cree_par)} departements={departements}
      createurNom={createur ? `${createur.prenom ?? ''} ${createur.nom ?? ''}`.trim() : '—'}
      initial={{ titre: f.titre, code: f.code, description: f.description, instructions: f.instructions, clinique: f.clinique, actif: f.actif, champs: f.champs,
        destinataires, anonyme_permis: f.anonyme_permis === true, message_anonymat: f.message_anonymat ?? null, ...('image' in f ? { image: f.image ?? null } : {}) }} />
  )
}
