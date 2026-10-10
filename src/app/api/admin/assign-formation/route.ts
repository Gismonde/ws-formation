import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { getActeur, filtrerEmployes, peutVoirEmploye, peutVoirDepartement } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { envoyerCourriels, gabarit, origineDepuis, courrielsActifs } from '@/lib/courriels'

const serviceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const moi = await getActeur()
    if (!moi || !aAccesAdmin(moi.role)) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const body = await req.json()
    const { formationId, type, cibleId, dateEcheance } = body

    if (!formationId || !type || !cibleId) {
      return NextResponse.json({ error: 'Parametres manquants' }, { status: 400 })
    }

    let employeIds: string[] = []

    if (type === 'employe') {
      const { data: emp } = await serviceRole
        .from('employes')
        .select('id, role, clinique, departement_id')
        .eq('id', cibleId)
        .single()
      // Un acteur peut s'assigner une formation à lui-même
      if (!emp || (emp.id !== moi.id && !peutVoirEmploye(moi, emp))) {
        return NextResponse.json({ error: 'Acces refuse - employe hors de votre perimetre' }, { status: 403 })
      }
      employeIds = [cibleId]
    } else if (type === 'departement') {
      const { data: dept } = await serviceRole
        .from('departements')
        .select('id, clinique')
        .eq('id', cibleId)
        .single()
      if (!dept || !peutVoirDepartement(moi, dept)) {
        return NextResponse.json({ error: 'Acces refuse - departement hors de votre perimetre' }, { status: 403 })
      }

      const { data: emps } = await filtrerEmployes(serviceRole
        .from('employes')
        .select('id, role, clinique, departement_id')
        .eq('departement_id', cibleId)
        .eq('actif', true), moi)
      employeIds = (emps ?? []).map((e: any) => e.id)
    } else {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    if (employeIds.length === 0) {
      return NextResponse.json({ assigned: 0, skipped: 0, message: 'Aucun employe a assigner' })
    }

    // Check existing assignments to avoid duplicates
    const { data: existing } = await serviceRole
      .from('assignations')
      .select('employe_id')
      .eq('formation_id', formationId)
      .in('employe_id', employeIds)

    const alreadyAssigned = new Set((existing ?? []).map((a: any) => a.employe_id))
    const toAssign = employeIds.filter(id => !alreadyAssigned.has(id))

    if (toAssign.length === 0) {
      return NextResponse.json({ assigned: 0, skipped: employeIds.length, message: 'Deja assigne pour tous' })
    }

    const rows = toAssign.map(empId => ({
      employe_id: empId,
      formation_id: formationId,
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
        description: 'Formation assignee a un employe',
        formation_id: formationId,
        cible_employe_id: empId,
        ip_address: ip,
        user_agent: ua,
      })
    ))

    // Courriel « Nouvelle formation disponible » (si l'envoi est configuré et non désactivé)
    let courriels = 0
    if (body.notifier !== false && courrielsActifs()) {
      const [{ data: formation }, { data: dest }] = await Promise.all([
        serviceRole.from('formations').select('titre, description').eq('id', formationId).single(),
        serviceRole.from('employes').select('id, prenom, email, clinique, actif').in('id', toAssign),
      ])
      const origine = origineDepuis(req)
      const echeance = dateEcheance
        ? new Date(dateEcheance + (String(dateEcheance).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-CA', { dateStyle: 'long' })
        : null
      const envoi = await envoyerCourriels((dest ?? []).filter((e: any) => e.actif !== false && e.email).map((e: any) => {
        const { html, texte } = gabarit({
          origine, clinique: e.clinique,
          titre: 'Nouvelle formation disponible',
          paragraphes: [
            `Bonjour ${e.prenom},`,
            `La formation « ${formation?.titre ?? 'Formation'} » vous a été assignée dans votre portail.`,
            ...(formation?.description ? [String(formation.description).slice(0, 300)] : []),
            echeance ? `À compléter avant le ${echeance}.` : 'Vous pouvez la suivre dès maintenant, à votre rythme.',
          ],
          bouton: { libelle: 'Commencer la formation', lien: `${origine}/formations/${formationId}` },
        })
        return { a: e.email, sujet: `Nouvelle formation : ${formation?.titre ?? ''}`.trim(), html, texte }
      }))
      courriels = envoi.envoyes
    }

    return NextResponse.json({
      assigned: toAssign.length,
      skipped: alreadyAssigned.size,
      courriels,
      message: `${toAssign.length} assignation(s) creee(s)`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
        }
