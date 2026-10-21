// Politiques actives proposées dans l'éditeur de leçons (« Choisir dans la librairie » → Politiques).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutVoirContenu } from '@/lib/permissions'
import { peutVoirLibrairie } from '@/lib/librairie'

export async function GET() {
  const acteur = await getActeur()
  if (!acteur || !peutVoirLibrairie(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { data, error } = await serviceClient().from('politiques').select('id, titre, clinique, version').eq('actif', true).order('titre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const elements = (data ?? []).filter(p => peutVoirContenu(acteur, p.clinique)).map(p => ({
    id: p.id, type: 'politique', titre: p.titre, url: `/dashboard/politiques/${p.id}`, categorie: `Politique · v${p.version}`,
    description: null, nom_fichier: null, clinique: p.clinique, archive: false, source: null, modifie_le: '',
  }))
  return NextResponse.json({ elements })
}
