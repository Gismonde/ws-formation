// Envoi d'un formulaire par un employé.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { origineDepuis } from '@/lib/courriels'
import { formulairePourEmploye, validerReponses, numeroReponse, type Formulaire } from '@/lib/formulaires'
import { avertirReception } from '@/lib/formulaires-serveur'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await getActeur()
  if (!a) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const sb = serviceClient()
  const { data } = await sb.from('formulaires').select('*').eq('id', (await params).id).maybeSingle()
  const f = data as Formulaire | null
  // Ouvert à toute personne d'une clinique visée par le formulaire
  if (!f || !formulairePourEmploye(f, null, a.role === 'super_admin' ? 'LES_DEUX' : a.clinique)) {
    return NextResponse.json({ error: 'Formulaire introuvable ou fermé' }, { status: 404 })
  }
  const corps = await req.json().catch(() => ({})) as { reponses?: unknown }
  const v = validerReponses(f.champs, corps.reponses, 'employe')
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })

  const definition = { titre: f.titre, code: f.code, champs: f.champs, clinique: f.clinique }
  const { data: r, error } = await sb.from('formulaire_reponses')
    .insert({ formulaire_id: f.id, employe_id: a.id, definition, reponses: v.valeurs })
    .select('id, numero').single()
  if (error || !r) return NextResponse.json({ error: error?.message ?? 'Envoi impossible' }, { status: 500 })

  await logAudit({
    acteur_id: a.id, cible_employe_id: a.id, type_action: 'FORMULAIRE_SOUMIS',
    description: `Formulaire « ${f.titre} » envoyé (${numeroReponse(r.numero)})`, metadata: { formulaire_id: f.id, reponse_id: r.id }, ...ipEtAgent(req),
  })
  try { await avertirReception(sb, f, r, origineDepuis(req)) } catch (e) { console.error('[formulaires] courriel', e) }
  return NextResponse.json({ id: r.id, numero: numeroReponse(r.numero) })
}
