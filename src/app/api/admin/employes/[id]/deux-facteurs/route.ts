// Double authentification d'un employé (administrateur global seulement).
// GET : la 2FA est-elle activée ? DELETE : la réinitialise (téléphone perdu…) ; l'employé devra la reconfigurer.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

async function cible(id: string) {
  const acteur = await getActeur()
  if (!acteur || acteur.role !== 'super_admin') return { erreur: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const sb = serviceClient()
  const { data: emp } = await sb.from('employes').select('id, prenom, nom, email, auth_user_id').eq('id', id).maybeSingle()
  if (!emp?.auth_user_id) return { erreur: NextResponse.json({ error: 'Employé introuvable' }, { status: 404 }) }
  const { data, error } = await sb.auth.admin.mfa.listFactors({ userId: emp.auth_user_id })
  if (error) return { erreur: NextResponse.json({ error: error.message }, { status: 500 }) }
  return { acteur, sb, emp, facteurs: (data?.factors ?? []) }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await cible((await params).id)
  if ('erreur' in c) return c.erreur
  return NextResponse.json({ active: c.facteurs.some(f => f.status === 'verified') })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await cible((await params).id)
  if ('erreur' in c) return c.erreur
  for (const f of c.facteurs) {
    const { error } = await c.sb.auth.admin.mfa.deleteFactor({ id: f.id, userId: c.emp.auth_user_id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await logAudit({
    acteur_id: c.acteur.id, cible_employe_id: c.emp.id, type_action: 'EMPLOYE_MODIFIE',
    description: `Double authentification réinitialisée pour ${c.emp.prenom} ${c.emp.nom} (${c.emp.email})`,
    metadata: { facteurs_supprimes: c.facteurs.length }, ...ipEtAgent(req),
  })
  return NextResponse.json({ ok: true })
}
