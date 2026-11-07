import { chargerNotifications, composerNotification } from '@/lib/notifications-courriel'
import type { Courriel } from '@/lib/courriels'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getActeur, filtrerEmployes, peutVoirEmploye, peutVoirDepartement, peutVoirContenu, employeConcerneParClinique } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { envoyerCourriels, gabarit, origineDepuis, courrielsActifs } from '@/lib/courriels'
import { comptesActives } from '@/lib/comptes-actives'
import { chargerVersions, languesEmployes } from '@/lib/langues-formation'

const serviceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const moi = await getActeur()
    if (!moi || !aAccesAdmin(moi)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { formationId, type, cibleId, dateEcheance } = body

    if (!formationId || !type || !cibleId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // La formation doit appartenir à une clinique de l'acteur
    const { data: formationCible } = await serviceRole
      .from('formations').select('id, clinique, publiee').eq('id', formationId).single()
    if (!formationCible || !peutVoirContenu(moi, formationCible.clinique)) {
      return NextResponse.json({ error: 'Formation introuvable ou hors de votre périmètre' }, { status: 403 })
    }
    if (!formationCible.publiee) {
      return NextResponse.json({ error: 'Cette formation doit être validée puis publiée avant d’être assignée.' }, { status: 400 })
    }

    let employeIds: string[] = []

    if (type === 'employe') {
      const { data: emp } = await serviceRole
        .from('employes')
        .select('id, role, clinique, departement_id, externe')
        .eq('id', cibleId)
        .single()
      // Un acteur peut s'assigner une formation à lui-même
      if (!emp || (emp.id !== moi.id && !peutVoirEmploye(moi, emp))) {
        return NextResponse.json({ error: 'Accès refusé : employé hors de votre périmètre' }, { status: 403 })
      }
      if (emp.id !== moi.id && !employeConcerneParClinique(emp.clinique, formationCible.clinique)) {
        return NextResponse.json({ error: 'Cette formation est réservée à une autre clinique que celle de cet employé' }, { status: 400 })
      }
      employeIds = [cibleId]
    } else if (type === 'departement') {
      const { data: dept } = await serviceRole
        .from('departements')
        .select('id, clinique')
        .eq('id', cibleId)
        .single()
      if (!dept || !peutVoirDepartement(moi, dept)) {
        return NextResponse.json({ error: 'Accès refusé : département hors de votre périmètre' }, { status: 403 })
      }

      const { data: emps } = await filtrerEmployes(serviceRole
        .from('employes')
        .select('id, role, clinique, departement_id')
        .eq('departement_id', cibleId)
        .eq('actif', true), moi)
      // Seulement les employés de la clinique de la formation
      employeIds = (emps ?? []).filter((e: any) => employeConcerneParClinique(e.clinique, formationCible.clinique)).map((e: any) => e.id)
    } else {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    if (employeIds.length === 0) {
      return NextResponse.json({ assigned: 0, skipped: 0, message: 'Aucun employé à assigner' })
    }

    // Versions FR / EN : chacun reçoit la version de sa langue de formation ; une version déjà assignée compte
    const versions = await chargerVersions(serviceRole, [formationId])
    const langues = await languesEmployes(serviceRole, employeIds)
    const { data: existing } = await serviceRole
      .from('assignations')
      .select('employe_id')
      .in('formation_id', versions.famille(formationId))
      .in('employe_id', employeIds)

    const alreadyAssigned = new Set((existing ?? []).map((a: any) => a.employe_id))
    const toAssign = employeIds.filter(id => !alreadyAssigned.has(id))

    if (toAssign.length === 0) {
      return NextResponse.json({ assigned: 0, skipped: employeIds.length, message: 'Déjà assignée à tous' })
    }

    const versionDe = new Map(toAssign.map(empId => [empId, versions.versionPour(formationId, langues.get(empId) ?? 'fr')]))
    const rows = toAssign.map(empId => ({
      employe_id: empId,
      formation_id: versionDe.get(empId)!,
      assigne_par: moi.id,
      date_assignation: new Date().toISOString(),
      ...(dateEcheance ? { date_echeance: dateEcheance } : {})
    }))

    const { error } = await serviceRole.from('assignations').insert(rows)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the audit event
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
    const ua = req.headers.get('user-agent') ?? null
    await Promise.all(toAssign.map(empId =>
      logAudit({
        acteur_id: moi.id,
        type_action: 'FORMATION_ASSIGNEE',
        description: 'Formation assignée à un employé',
        formation_id: versionDe.get(empId)!,
        cible_employe_id: empId,
        ip_address: ip,
        user_agent: ua,
      })
    ))

    // Courriel « Nouvelle formation disponible » (si l'envoi est configuré et non désactivé)
    let courriels = 0
    if (body.notifier !== false && courrielsActifs()) {
      const [{ data: formationsV }, { data: dest }] = await Promise.all([
        serviceRole.from('formations').select('id, titre').in('id', Array.from(new Set(versionDe.values()))),
        serviceRole.from('employes').select('id, prenom, nom, email, clinique, actif, auth_user_id').in('id', toAssign),
      ])
      const origine = origineDepuis(req)
      const echeance = dateEcheance
        ? new Date(dateEcheance + (String(dateEcheance).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-CA', { dateStyle: 'long' })
        : null
      const cfg = await chargerNotifications(serviceRole)
      // Compte pas encore activé (mot de passe pas créé) : courriel retenu, envoyé à l'activation
      const actives = await comptesActives(serviceRole, (dest ?? []).map((e: any) => e.auth_user_id))
      const envoi = await envoyerCourriels((dest ?? []).filter((e: any) => e.actif !== false && e.email && e.auth_user_id && actives.has(e.auth_user_id)).map((e: any) => composerNotification(cfg, 'inscription_cours_assignation', {
        a: e.email, origine, clinique: e.clinique, prenom: e.prenom, nom: e.nom,
        vars: { activite: (formationsV ?? []).find((f: any) => f.id === versionDe.get(e.id))?.titre ?? 'Formation', date: echeance ?? '', echeance: echeance ? `À compléter avant le ${echeance}.` : 'Vous pouvez la suivre dès maintenant, à votre rythme.' },
        lien: `${origine}/formations/${versionDe.get(e.id) ?? formationId}`,
      })).filter((c): c is Courriel => !!c))
      courriels = envoi.envoyes
    }

    return NextResponse.json({
      assigned: toAssign.length,
      skipped: alreadyAssigned.size,
      courriels,
      message: `${toAssign.length} assignation(s) créée(s)`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
        }
