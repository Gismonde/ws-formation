// Traitement d'une suggestion : statut et réponse visible par l'employé.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutTraiterSuggestion, STATUTS_SUGGESTION, type Suggestion } from '@/lib/suggestions'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const sb = serviceClient()
  const { data: s } = await sb.from('suggestions').select('*').eq('id', id).maybeSingle()
  if (!s || !peutTraiterSuggestion(acteur, s as Suggestion)) return NextResponse.json({ error: 'Suggestion introuvable' }, { status: 404 })
  const b = await req.json().catch(() => ({})) as { statut?: string; reponse?: string }
  const maj: Record<string, unknown> = {}
  if (b.statut !== undefined) {
    if (!STATUTS_SUGGESTION.some(x => x.id === b.statut)) return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 })
    maj.statut = b.statut
  }
  if (typeof b.reponse === 'string') {
    maj.reponse = b.reponse.trim().slice(0, 1000) || null
    maj.repondu_par = acteur.id
    maj.repondu_le = new Date().toISOString()
  }
  const { error } = await sb.from('suggestions').update(maj).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
