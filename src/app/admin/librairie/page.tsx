import { redirect } from 'next/navigation'
import { getActeur, cliniquesAdministrees } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { peutVoirLibrairie, cliniquesLibrairiePossibles } from '@/lib/librairie'
import GestionLibrairie from './GestionLibrairie'

export default async function LibrairiePage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!aAccesAdmin(acteur.role) || !peutVoirLibrairie(acteur)) redirect('/admin')
  const peutImporter = (acteur.role === 'super_admin' || acteur.role === 'admin') && cliniquesAdministrees(acteur).includes('CMC')
  return <GestionLibrairie cliniques={cliniquesLibrairiePossibles(acteur)} peutImporter={peutImporter} />
}
