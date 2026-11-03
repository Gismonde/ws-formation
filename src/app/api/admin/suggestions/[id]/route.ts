// Traitement d'une suggestion : statut et réponse visible par l'employé.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { peutTraiterSuggestion, STATUTS_SUGGESTION, TYPES_SUGGESTION, type Suggestion } from '@/lib/suggestions'
import { courrielsActifs, envoyerCourriels, gabarit, origineDepuis } from '@/lib/courriels'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acteur = await getActeur()
  if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const sb = serviceClient()
  const { data: s } = await sb.from('suggestions').select('*').eq('id', id).maybeSingle()
  if (!s || !peutTraiterSuggestion(acteur, s as Suggestion)) return NextResponse.json({ error: 'Suggestion introuvable' }, { status: 404 })
  const b = await req.json().catch(() => ({})) as { statut?: string; reponse?: string; assigne_a?: string | null }
  const maj: Record<string, unknown> = {}
  let nouvelAssigne: { prenom: string | null; email: string | null } | null = null
  if (b.assigne_a !== undefined) {
    if (b.assigne_a) {
      // La personne assignée doit elle-même pouvoir traiter cette suggestion
      const { data: p } = await sb.from('employes').select('id, prenom, email, role, clinique, actif').eq('id', b.assigne_a).maybeSingle()
      if (!p || p.actif === false || !peutTraiterSuggestion(p, s as Suggestion)) return NextResponse.json({ error: 'Cette personne ne peut pas traiter cette suggestion' }, { status: 400 })
      if (p.id !== acteur.id && p.id !== s.assigne_a) nouvelAssigne = p
    }
    maj.assigne_a = b.assigne_a || null
    maj.assigne_le = b.assigne_a ? new Date().toISOString() : null
  }
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
  if (error) return NextResponse.json({ error: /assigne/.test(error.message) ? 'Exécutez d’abord supabase/migrations/suggestions_assignation.sql dans Supabase.' : error.message }, { status: 500 })
  // Courriel à la personne qui reçoit la suggestion à traiter (sans le contenu de la suggestion)
  if (nouvelAssigne?.email && courrielsActifs()) {
    const origine = origineDepuis(req)
    const type = TYPES_SUGGESTION.find(x => x.id === s.type)?.libelle ?? 'Suggestion'
    const { html, texte } = gabarit({
      origine, clinique: s.clinique === 'CMC' || s.clinique === 'WSSC' ? s.clinique : null, titre: 'Suggestion à traiter',
      paragraphes: [`Bonjour ${nouvelAssigne.prenom ?? ''},`.replace(' ,', ','), `${acteur.prenom ?? ''} ${acteur.nom ?? ''} vous a assigné une suggestion d’employé à traiter (${type}).`.trim()],
      bouton: { libelle: 'Voir mes suggestions à traiter', lien: `${origine}/admin/suggestions?assignees=moi` },
    })
    await envoyerCourriels([{ a: nouvelAssigne.email, sujet: 'Suggestion à traiter — WS Formation', html, texte }]).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
