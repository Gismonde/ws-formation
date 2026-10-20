import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getActeur, filtrerEmployes, departementsVisibles, peutVoirContenu, employeConcerneParClinique } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

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

    const moi = await getActeur()
    if (!moi || !aAccesAdmin(moi.role)) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const formationId = searchParams.get('formationId')

    if (!formationId) {
      return NextResponse.json({ error: 'formationId manquant' }, { status: 400 })
    }

    const [formationRes, employesRes, departementsListe] = await Promise.all([
      serviceRole
        .from('formations')
        .select('id, titre, description, categorie, niveau, clinique')
        .eq('id', formationId)
        .single(),
      filtrerEmployes(serviceRole
        .from('employes')
        .select('id, prenom, nom, clinique, departement_id, departements(nom)')
        .eq('actif', true)
        .order('nom', { ascending: true }), moi),
      departementsVisibles(moi, serviceRole)
    ])

    if (!formationRes.data || !peutVoirContenu(moi, formationRes.data.clinique)) {
      return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
    }

    // Seuls les employés de la clinique de la formation peuvent la recevoir
    const employes = (employesRes.data ?? []).filter((e: any) => employeConcerneParClinique(e.clinique, formationRes.data.clinique)).map((e: any) => ({
      id: e.id,
      prenom: e.prenom,
      nom: e.nom,
      departement_id: e.departement_id,
      departement_nom: e.departements?.nom ?? null,
      clinique: e.clinique ?? null
    }))

    return NextResponse.json({
      formation: formationRes.data,
      employes,
      departements: departementsListe.map(d => ({ id: d.id, nom: d.nom })),
      userRole: moi.role,
      userDeptId: moi.departement_id
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
