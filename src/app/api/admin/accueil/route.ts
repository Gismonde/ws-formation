// Modification de la page d'accueil d'une clinique : administrateurs (de cette clinique) et admin global seulement.
import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient, cliniquesAdministrees } from '@/lib/permissions'
import { estAdministrateur, type Clinique } from '@/lib/cliniques'
import { validerContenu, accueilParDefaut, type ContenuAccueil } from '@/lib/accueil'
import { lireLigneAccueil, partieAccueil } from '@/lib/accueil-serveur'
import { estLangue, type Langue } from '@/lib/i18n/base'
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
  const langue: Langue = estLangue(corps.langue) ? corps.langue : 'fr'
  const v = validerContenu(corps.contenu)
  if ('erreur' in v) return NextResponse.json({ error: v.erreur }, { status: 400 })

  // Les deux langues partagent une ligne : on garde la version de l'autre langue telle quelle
  const sb = serviceClient()
  const { ligne } = await lireLigneAccueil(sb, a.clinique)
  const fr = langue === 'fr' ? v.contenu : (partieAccueil(ligne, 'fr') ?? accueilParDefaut(a.clinique, 'fr'))
  const en = langue === 'en' ? v.contenu : partieAccueil(ligne, 'en')
  const contenu: ContenuAccueil & { en?: ContenuAccueil } = en ? { ...fr, en } : fr

  const { error } = await sb.from('pages_accueil').upsert({
    clinique: a.clinique, contenu, modifie_par: a.acteur.id, modifie_le: new Date().toISOString(),
  })
  if (error) {
    const absente = error.code === '42P01' || /pages_accueil/.test(error.message)
    return NextResponse.json({ error: absente ? 'Exécutez d’abord la migration conformite_suivi.sql dans Supabase.' : error.message }, { status: absente ? 503 : 500 })
  }
  await logAudit({
    acteur_id: a.acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Page d'accueil ${a.clinique} (${langue.toUpperCase()}) modifiée`,
    metadata: { page: 'accueil', clinique: a.clinique, langue }, ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })
  return NextResponse.json({ ok: true, contenu: v.contenu })
}

/** Rétablit le contenu par défaut. */
export async function DELETE(req: NextRequest) {
  const a = await autoriser(req.nextUrl.searchParams.get('clinique'))
  if ('erreur' in a) return a.erreur
  const langue: Langue = estLangue(req.nextUrl.searchParams.get('langue')) ? req.nextUrl.searchParams.get('langue') as Langue : 'fr'
  const sb = serviceClient()
  const { ligne } = await lireLigneAccueil(sb, a.clinique)
  // On ne remet par défaut que la langue demandée ; l'autre version est conservée
  const fr = partieAccueil(ligne, 'fr'), en = partieAccueil(ligne, 'en')
  const restant = langue === 'fr' ? (en ? { ...accueilParDefaut(a.clinique, 'fr'), en } : null) : fr
  const { error } = !ligne
    ? { error: null }
    : restant
      ? await sb.from('pages_accueil').update({ contenu: restant, modifie_par: a.acteur.id, modifie_le: new Date().toISOString() }).eq('clinique', a.clinique)
      : await sb.from('pages_accueil').delete().eq('clinique', a.clinique)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({
    acteur_id: a.acteur.id, type_action: 'PARAMETRE_MODIFIE', description: `Page d'accueil ${a.clinique} (${langue.toUpperCase()}) remise au contenu par défaut`,
    metadata: { page: 'accueil', clinique: a.clinique, langue }, ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })
  return NextResponse.json({ ok: true })
}
