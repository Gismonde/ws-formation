// Création d'un formulaire (administrateur global, ou administrateur autorisé).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { peutCreerFormulaires } from '@/lib/formulaires'
import { validerFormulaire, tableAbsente, MIGRATION_FORMULAIRES } from '@/lib/formulaires-serveur'

export async function POST(req: Request) {
  const a = await getActeur()
  if (!a || !peutCreerFormulaires(a)) return NextResponse.json({ error: 'Création de formulaires non autorisée' }, { status: 403 })
  const sb = serviceClient()
  const v = await validerFormulaire(sb, a, await req.json().catch(() => ({})))
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })
  const { data, error } = await sb.from('formulaires').insert({ ...v.valeurs, cree_par: a.id }).select('id').single()
  if (error) return NextResponse.json({ error: tableAbsente(error) ? MIGRATION_FORMULAIRES : error.message }, { status: 500 })
  await logAudit({ acteur_id: a.id, type_action: 'FORMULAIRE_CREE', description: `Formulaire « ${v.valeurs.titre} » créé`, metadata: { formulaire_id: data.id }, ...ipEtAgent(req) })
  return NextResponse.json({ id: data.id })
}
