// Suivi d'une leçon en ligne : vidéo vue, « J'ai lu et compris », leçon terminée.
// Route stable (contrairement aux actions serveur, elle continue de fonctionner sur une page ouverte
// avant une mise en ligne). Mêmes contrôles que les actions serveur.
import { NextResponse } from 'next/server'
import { getActeur } from '@/lib/permissions'
import { enregistrerVideoVue, attesterLecture, terminerLecon } from '@/lib/actions/suivi'

const UUID = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ ok: false, erreur: 'Non authentifié' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { type?: string; id?: string }
  if (!b.id || !UUID.test(b.id)) return NextResponse.json({ ok: false, erreur: 'Identifiant invalide' }, { status: 400 })
  if (b.type === 'video') return NextResponse.json(await enregistrerVideoVue(b.id))
  if (b.type === 'attestation') return NextResponse.json(await attesterLecture(b.id))
  if (b.type === 'terminer') return NextResponse.json(await terminerLecon(b.id))
  return NextResponse.json({ ok: false, erreur: 'Action inconnue' }, { status: 400 })
}
