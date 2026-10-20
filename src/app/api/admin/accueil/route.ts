// Modification de la page d'accueil d'une clinique : administrateurs (de cette clinique) et admin global seulement.
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesAdministrees } from '@/lib/permissions'
import { estAdministrateur, type Clinique } from '@/lib/cliniques'
import { validerContenu } from '@/lib/accueil'
import { logAudit } from '@/lib/audit'

async function autoriser(clinique: unknown) {
  const acteur = await getActeur()
  if (!acteur || !estAdministrateur(acteur.role)) return { erreur: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) }
  if (!cliniquesAdministrees(acteur).includes(clinique as Clinique)) return { erreur: NextResponse.json({ error: 'Clinique hors de votre périmètre' }, { status: 403 }) }
  return { acteur, clinique: clinique as Clinique }
}

export async function PUT(req: NextRequest) {
  const corps = await req.json().catch(() => ({}))
  const a = await autoriser(corps.clinique)
  if ('erreur' in a) return a.erreur
  const v = validerContenu(corps.contenu)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })

  const { error } = await serviceClient().from('pages_accueil').upsert({
    clinique: a.clinique, contenu: v.contenu, modifie_par: a.acteur.id, modifie_le: new Date().toISOString(),
  })
  if (error) {
    const absente = error.code === '42P01' || /pages_accueil/.test(error.message)
    return NextResponse.json({ error: absente ? 'Exécutez d’abord la migration conformite_suivi.sql dans Supabase.' : error.message }, { status: absente ? 503 : 500 })
  }
  await logAudit({
    acteur_id: a.acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Page d'accueil ${a.clinique} modifiée`,
    metadata: { page: 'accueil', clinique: a.clinique }, ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })
  return NextResponse.json({ ok: true, contenu: v.contenu })
}

/** Rétablit le contenu par défaut. */
export async function DELETE(req: NextRequest) {
  const a = await autoriser(req.nextUrl.searchParams.get('clinique'))
  if ('erreur' in a) return a.erreur
  const { error } = await serviceClient().from('pages_accueil').delete().eq('clinique', a.clinique)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({
    acteur_id: a.acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Page d'accueil ${a.clinique} remise au contenu par défaut`,
    metadata: { page: 'accueil', clinique: a.clinique }, ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })
  return NextResponse.json({ ok: true })
}
