// PUT { employes: [id…] } : équipe de La Passerelle (quel que soit leur rôle) — administrateur global seulement.
// L'équipe gère les éditions et l'encadré, voit les propositions reçues et reçoit un courriel à chaque proposition.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { peutChoisirEquipePasserelle, CLE_EQUIPE_PASSERELLE } from '@/lib/passerelle'

export async function PUT(req: Request) {
  const acteur = await getActeur()
  if (!peutChoisirEquipePasserelle(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const c = await req.json().catch(() => ({})) as { employes?: unknown }
  const ids = Array.from(new Set((Array.isArray(c.employes) ? c.employes : []).filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 50)
  const sb = serviceClient()
  const { data: valides } = ids.length ? await sb.from('employes').select('id, prenom, nom').in('id', ids).eq('actif', true) : { data: [] }
  const employes = (valides ?? []).map(e => e.id as string)
  const { error } = await sb.from('reglages').upsert({ cle: CLE_EQUIPE_PASSERELLE, valeur: { employes }, modifie_par: acteur!.id, modifie_le: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const noms = (valides ?? []).map(e => [e.prenom, e.nom].filter(Boolean).join(' ')).join(', ') || 'personne'
  await logAudit({ acteur_id: acteur!.id, type_action: 'PARAMETRE_MODIFIE', description: `La Passerelle : équipe = ${noms}`, metadata: { employes }, ...ipEtAgent(req) })
  return NextResponse.json({ employes })
}
