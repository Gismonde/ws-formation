// Ouvre le document d'une preuve externe (stockage privé « preuves ») par un lien signé de courte durée.
// Accès : l'employé pour ses propres preuves ; l'équipe (admin, gestionnaire) pour les employés de son périmètre.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutVoirEmploye } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const sb = serviceClient()
  const { data: preuve } = await sb.from('preuves_externes').select('id, employe_id, fichier_url').eq('id', id).maybeSingle()
  if (!preuve?.fichier_url) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  if (preuve.employe_id !== acteur.id) {
    const { data: proprietaire } = await sb.from('employes').select('id, role, clinique, departement_id, externe').eq('id', preuve.employe_id).maybeSingle()
    if (!aAccesAdmin(acteur) || !proprietaire || !peutVoirEmploye(acteur, proprietaire)) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    }
  }

  // Anciennes preuves : URL complète déjà enregistrée
  if (/^https:\/\//.test(preuve.fichier_url)) return NextResponse.redirect(preuve.fichier_url)
  const { data, error } = await sb.storage.from('preuves').createSignedUrl(preuve.fichier_url, 120)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Document indisponible' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
