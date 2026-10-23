// Copie de travail d'une formation publiée.
//   POST   (id = formation publiée) : crée la copie ou renvoie celle en cours
//   PUT    (id = copie) { note }    : applique la copie approuvée à la formation publiée
//   DELETE (id = copie)             : abandonne la copie
import { NextResponse } from 'next/server'
import { getActeur } from '@/lib/permissions'
import { creerCopieTravail, appliquerCopieTravail, abandonnerCopieTravail } from '@/lib/copie-travail'

type Ctx = { params: Promise<{ id: string }> }

function reponse<T>(r: { ok: true; data: T } | { ok: false; erreur: string; statut?: number }) {
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.erreur }, { status: r.statut ?? 400 })
}

export async function POST(_req: Request, { params }: Ctx) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return reponse(await creerCopieTravail(acteur, (await params).id))
}

export async function PUT(req: Request, { params }: Ctx) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const corps = await req.json().catch(() => ({})) as { note?: string }
  return reponse(await appliquerCopieTravail(acteur, (await params).id, typeof corps.note === 'string' ? corps.note : ''))
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return reponse(await abandonnerCopieTravail(acteur, (await params).id))
}
