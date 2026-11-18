import Link from 'next/link'
import { redirect } from 'next/navigation'
import { i18n } from '@/lib/i18n/serveur'
import { getActeur, serviceClient } from '@/lib/permissions'
import { cliniquesDe } from '@/lib/cliniques'
import { chargerEquipe, peutChoisirEquipePasserelle, CLINIQUE_PASSERELLE } from '@/lib/passerelle'
import type { MembreComite } from '@/lib/comites'
import DestinatairesForm from './DestinatairesForm'

export const dynamic = 'force-dynamic'

// Administration → La Passerelle (administrateur global) : choisir l'équipe de La Passerelle.
// L'équipe gère ensuite le journal depuis le portail (La Passerelle → Gérer La Passerelle).
export default async function PasserelleAdminPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutChoisirEquipePasserelle(acteur)) redirect('/admin')
  const sb = serviceClient()
  const [equipe, { data: emps }, { data: comites }] = await Promise.all([
    chargerEquipe(sb),
    sb.from('employes').select('id, prenom, nom, poste, email, clinique, role, externe').eq('actif', true).order('nom'),
    sb.from('comites').select('nom, membres').ilike('nom', '%passerelle%'),
  ])
  const candidats = (emps ?? []).filter(e => !e.externe && (e.role === 'super_admin' || cliniquesDe(e.clinique as string | null).includes(CLINIQUE_PASSERELLE)))
    .map(e => ({ id: e.id as string, prenom: e.prenom as string | null, nom: e.nom as string | null, poste: e.poste as string | null, email: e.email as string | null }))
  const comite = (comites ?? [])[0] as { nom: string; membres: MembreComite[] } | undefined
  const membresComite = comite ? (comite.membres ?? []).map(m => m.employe_id).filter((x): x is string => !!x && candidats.some(c => c.id === x)) : []

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('La Passerelle')}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t('Choisissez l’équipe de La Passerelle. Ces employés, quel que soit leur rôle, gèrent le journal depuis le portail : éditions, brouillons, encadré « On veut vous lire ! » et propositions reçues.')}</p>
        </div>
        <Link href="/dashboard/passerelle/gestion" className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{t('Gérer La Passerelle')} →</Link>
      </div>
      <DestinatairesForm employes={candidats} choisis={equipe} comite={comite ? { nom: comite.nom, ids: membresComite } : null} />
    </div>
  )
}
