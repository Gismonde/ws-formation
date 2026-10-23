// Rattrapage du suivi fait hors ligne : rejoue, dans l'ordre, les actions gardées sur la tablette.
// Les mêmes contrôles qu'en ligne s'appliquent (employé connecté, vidéos obligatoires, attestation…).
import { NextResponse } from 'next/server'
import { getActeur } from '@/lib/permissions'
import { enregistrerVideoVue, attesterLecture, terminerLecon } from '@/lib/actions/suivi'

type Action = { type: 'video' | 'attestation' | 'terminer'; id: string; le: string }
const UUID = /^[0-9a-f-]{36}$/i

export async function POST(req: Request) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { actions?: Action[] }
  const actions = (Array.isArray(b.actions) ? b.actions : []).filter(a => a && UUID.test(a.id) && ['video', 'attestation', 'terminer'].includes(a.type)).slice(0, 200)
  // Vidéos d'abord, puis attestations, puis leçons terminées (qui en dépendent)
  const ordre = { video: 0, attestation: 1, terminer: 2 }
  actions.sort((x, y) => ordre[x.type] - ordre[y.type])
  const restantes: Action[] = []
  for (const a of actions) {
    try {
      if (a.type === 'video') await enregistrerVideoVue(a.id)
      else if (a.type === 'attestation') await attesterLecture(a.id)
      else await terminerLecon(a.id) // refus (leçon incomplète) : définitif, on ne réessaie pas indéfiniment
    } catch { restantes.push(a) }
  }
  return NextResponse.json({ restantes })
}
