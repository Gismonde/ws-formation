// Archiver ou réactiver plusieurs employés à la fois. POST { ids: string[], actif: boolean }
// Chaque employé est vérifié (peutGererEmploye) ; ceux hors périmètre, ou soi-même, sont ignorés et comptés.
import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, peutGererEmploye, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

const MAX = 200

export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const corps = await request.json().catch(() => ({}))
  const ids: string[] = Array.isArray(corps.ids) ? Array.from(new Set(corps.ids.filter((x: unknown) => typeof x === 'string'))) : []
  if (typeof corps.actif !== 'boolean' || ids.length === 0) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  if (ids.length > MAX) return NextResponse.json({ error: `${MAX} employés au maximum à la fois` }, { status: 400 })
  const actif: boolean = corps.actif

  const sb = serviceClient()
  const { data: cibles } = await sb.from('employes').select('id, auth_user_id, role, clinique, departement_id, actif, prenom, nom').in('id', ids)
  const aTraiter = (cibles ?? []).filter(c => peutGererEmploye(acteur, c) && (c.actif !== false) !== actif)
  const ignores = ids.length - aTraiter.length

  if (aTraiter.length) {
    const { error } = await sb.from('employes').update({ actif }).in('id', aTraiter.map(c => c.id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const meta = ipEtAgent(request)
  await Promise.all(aTraiter.map(async c => {
    if (!actif && c.auth_user_id) await sb.auth.admin.signOut(c.auth_user_id).catch(() => null)
    await logAudit({
      acteur_id: acteur.id, type_action: 'EMPLOYE_MODIFIE', cible_employe_id: c.id,
      description: actif ? 'Employé réactivé (action groupée)' : 'Employé archivé (action groupée)',
      metadata: { actif, groupe: aTraiter.length }, ...meta,
    })
  }))

  return NextResponse.json({ traites: aTraiter.length, ignores })
}
