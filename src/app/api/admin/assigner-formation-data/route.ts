import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const serviceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { data: moi } = await serviceRole
      .from('employes')
      .select('id, role, departement_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!moi || (moi.role !== 'admin' && moi.role !== 'gestionnaire')) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const formationId = searchParams.get('formationId')

    if (!formationId) {
      return NextResponse.json({ error: 'formationId manquant' }, { status: 400 })
    }

    const [formationRes, employesRes, departementsRes] = await Promise.all([
      serviceRole
        .from('formations')
        .select('id, titre, description, categorie, niveau')
        .eq('id', formationId)
        .single(),
      serviceRole
        .from('employes')
        .select('id, prenom, nom, departement_id, departements(nom)')
        .eq('actif', true)
        .order('nom', { ascending: true }),
      serviceRole
        .from('departements')
        .select('id, nom')
        .order('nom', { ascending: true })
    ])

    if (!formationRes.data) {
      return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
    }

    const employes = (employesRes.data ?? []).map((e: any) => ({
      id: e.id,
      prenom: e.prenom,
      nom: e.nom,
      departement_id: e.departement_id,
      departement_nom: e.departements?.nom ?? null
    }))

    return NextResponse.json({
      formation: formationRes.data,
      employes,
      departements: departementsRes.data ?? [],
      userRole: moi.role,
      userDeptId: moi.departement_id
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
