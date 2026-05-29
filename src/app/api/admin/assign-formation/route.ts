import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

    // Get current user role from employes table (service role to avoid RLS recursion)
    const { data: moi } = await serviceRole
      .from('employes')
      .select('id, role, departement_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!moi || (moi.role !== 'admin' && moi.role !== 'gestionnaire')) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const body = await req.json()
    const { formationId, type, cibleId, dateEcheance } = body

    if (!formationId || !type || !cibleId) {
      return NextResponse.json({ error: 'Parametres manquants' }, { status: 400 })
    }

    let employeIds: string[] = []

    if (type === 'employe') {
      // Assign to a specific employee
      // If gestionnaire, verify the employee belongs to their department
      if (moi.role === 'gestionnaire') {
        const { data: emp } = await serviceRole
          .from('employes')
          .select('id, departement_id')
          .eq('id', cibleId)
          .single()
        if (!emp || emp.departement_id !== moi.departement_id) {
          return NextResponse.json({ error: 'Acces refuse - hors de votre departement' }, { status: 403 })
        }
      }
      employeIds = [cibleId]
    } else if (type === 'departement') {
      // Assign to all active employees in the department
      // If gestionnaire, verify it's their own department
      if (moi.role === 'gestionnaire' && cibleId !== moi.departement_id) {
        return NextResponse.json({ error: 'Acces refuse - hors de votre departement' }, { status: 403 })
      }
      const { data: emps } = await serviceRole
        .from('employes')
        .select('id')
        .eq('departement_id', cibleId)
        .eq('actif', true)
      employeIds = (emps ?? []).map((e: any) => e.id)
    } else {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    if (employeIds.length === 0) {
      return NextResponse.json({ assigned: 0, skipped: 0, message: 'Aucun employe trouve' })
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

    return NextResponse.json({
      assigned: toAssign.length,
      skipped: alreadyAssigned.size,
      message: `${toAssign.length} assignation(s) creee(s)`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
