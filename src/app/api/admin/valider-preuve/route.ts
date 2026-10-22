import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'
import { getActeur, peutVoirEmploye } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

export async function PATCH(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
      )

  const admin = await getActeur()
  if (!admin || !aAccesAdmin(admin)) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { preuve_id, statut, commentaire } = await request.json()

  if (!preuve_id || !statut) {
        return NextResponse.json({ error: 'preuve_id et statut requis' }, { status: 400 })
  }

  if (!['valide', 'refuse'].includes(statut)) {
        return NextResponse.json({ error: 'Statut invalide. Utilisez valide ou refuse.' }, { status: 400 })
  }

  // La preuve doit appartenir à un employé du périmètre (et pas à soi-même)
  const { data: existante } = await serviceClient
      .from('preuves_externes')
      .select('id, employe_id')
      .eq('id', preuve_id)
      .single()
  const { data: proprietaire } = existante
    ? await serviceClient.from('employes').select('id, clinique, departement_id').eq('id', existante.employe_id).single()
    : { data: null }
  if (!existante || !proprietaire || existante.employe_id === admin.id || !peutVoirEmploye(admin, proprietaire)) {
        return NextResponse.json({ error: 'Accès refusé - preuve hors de votre périmètre' }, { status: 403 })
  }

  const { data: preuve, error } = await serviceClient
      .from('preuves_externes')
      .update({
              statut,
              commentaire: commentaire ?? null,
              valide_par: admin.id,
              valide_le: new Date().toISOString(),
              updated_at: new Date().toISOString(),
      })
      .eq('id', preuve_id)
      .select()
      .single()

  if (error) {
        return NextResponse.json({ error: 'Erreur: ' + error.message }, { status: 500 })
  }

  // Log l'action admin
  const actionType = statut === 'valide' ? 'PREUVE_VALIDEE' : 'PREUVE_REFUSEE'
    await logAudit({
          acteur_id: admin.id,
          type_action: actionType,
          description: `Preuve ${preuve_id} ${statut === 'valide' ? 'validée' : 'refusée'} par l'admin`,
          cible_employe_id: preuve?.employe_id ?? null,
          metadata: { preuve_id, statut, commentaire: commentaire ?? null },
          ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
          user_agent: request.headers.get('user-agent') ?? null,
    })

  return NextResponse.json({ success: true, preuve })
}
