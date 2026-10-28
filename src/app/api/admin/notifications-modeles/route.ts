// Admin → Paramètres → Notifications : modèles de courriel (GET), modification (PUT), courriel test (POST).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { CATALOGUE, typeDe } from '@/lib/notifications-catalogue'
import { chargerNotifications, composerNotification } from '@/lib/notifications-courriel'
import { courrielsActifs, envoyerCourriels, origineDepuis } from '@/lib/courriels'
import { logAudit } from '@/lib/audit'

const MIGRATION = 'Exécutez d’abord supabase/migrations/notifications_modeles.sql dans Supabase.'
const absente = (e: { code?: string; message: string }) => e.code === '42P01' || /notifications_(modeles|reglages)/.test(e.message)
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '')

async function admin() {
  const a = await getActeur()
  return a && (a.role === 'super_admin' || a.role === 'admin') ? a : null
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const sb = serviceClient()
  const { error } = await sb.from('notifications_modeles').select('cle', { head: true, count: 'exact' })
  const cfg = await chargerNotifications(sb)
  return NextResponse.json({
    migration: error ? (absente(error) ? MIGRATION : error.message) : null,
    courrielsActifs: courrielsActifs(),
    reglages: cfg.reglages,
    modeles: Object.fromEntries(Array.from(cfg.modeles.entries())),
    catalogue: CATALOGUE.map(t => t.cle),
  })
}

export async function PUT(req: Request) {
  const a = await admin()
  if (!a) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const corps = await req.json().catch(() => ({}))
  const sb = serviceClient()

  if (corps.reglages) {
    const r = corps.reglages
    const { error } = await sb.from('notifications_reglages').upsert({
      id: 1, contact_libelle: texte(r.contact_libelle, 80) || null, contact_courriel: texte(r.contact_courriel, 200) || null,
      contact_telephone: texte(r.contact_telephone, 40) || null, modifie_le: new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: absente(error) ? MIGRATION : error.message }, { status: 500 })
    await logAudit({ acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE', description: 'Notifications : coordonnées du pied de courriel modifiées' })
    return NextResponse.json({ ok: true })
  }

  const type = typeDe(String(corps.cle ?? ''))
  if (!type) return NextResponse.json({ error: 'Type de notification inconnu' }, { status: 400 })
  if (corps.reinitialiser === true) {
    const { error } = await sb.from('notifications_modeles').delete().eq('cle', type.cle)
    if (error) return NextResponse.json({ error: absente(error) ? MIGRATION : error.message }, { status: 500 })
    await logAudit({ acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE', description: `Notifications : « ${type.libelle} » remise par défaut` })
    return NextResponse.json({ ok: true })
  }
  const ligne = {
    cle: type.cle, actif: corps.actif !== false,
    sujet: texte(corps.sujet, 200) || null, message: texte(corps.message, 4000) || null, bouton: texte(corps.bouton, 60) || null,
    modifie_le: new Date().toISOString(), modifie_par: a.id,
  }
  const { error } = await sb.from('notifications_modeles').upsert(ligne)
  if (error) return NextResponse.json({ error: absente(error) ? MIGRATION : error.message }, { status: 500 })
  await logAudit({ acteur_id: a.id, type_action: 'PARAMETRE_MODIFIE', description: `Notifications : « ${type.libelle} » ${ligne.actif ? 'modifiée' : 'désactivée'}` })
  return NextResponse.json({ ok: true })
}

/** Courriel test envoyé à la personne connectée, avec des valeurs d'exemple. */
export async function POST(req: Request) {
  const a = await admin()
  if (!a) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (!courrielsActifs()) return NextResponse.json({ error: 'L’envoi de courriels n’est pas encore configuré.' }, { status: 400 })
  const corps = await req.json().catch(() => ({}))
  const type = typeDe(String(corps.cle ?? ''))
  if (!type || !a.email) return NextResponse.json({ error: 'Type inconnu ou adresse manquante' }, { status: 400 })
  const cfg = await chargerNotifications(serviceClient())
  cfg.modeles.set(type.cle, { cle: type.cle, actif: true, sujet: texte(corps.sujet, 200) || null, message: texte(corps.message, 4000) || null, bouton: texte(corps.bouton, 60) || null })
  const origine = origineDepuis(req)
  const c = composerNotification(cfg, type.cle, {
    a: a.email, origine, clinique: a.clinique, prenom: a.prenom, nom: a.nom, lien: `${origine}/dashboard`,
    vars: { activite: 'Formation d’exemple', date: 'jeudi 5 novembre 2026', echeance: 'À compléter avant le 5 novembre 2026.', lieu: 'Lieu : salle de formation', detail: 'Elle est à terminer d’ici le 5 novembre 2026 (dans 7 jours).', progression: '40', calendrier: '' },
  })
  if (!c) return NextResponse.json({ error: 'Courriel impossible à composer' }, { status: 400 })
  const r = await envoyerCourriels([{ ...c, sujet: '[TEST] ' + c.sujet }])
  return r.envoyes ? NextResponse.json({ ok: true, a: a.email }) : NextResponse.json({ error: r.erreur ?? 'Envoi impossible' }, { status: 500 })
}
