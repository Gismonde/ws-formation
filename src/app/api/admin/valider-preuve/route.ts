import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify the user is admin or gestionnaire
  const { data: admin } = await serviceClient
    .from('employes')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin || !['admin', 'gestionnaire'].includes(admin.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { preuve_id, statut, commentaire } = await request.json()

  if (!preuve_id || !statut) {
    return NextResponse.json({ error: 'preuve_id et statut requis' }, { status: 400 })
  }

  if (!['valide', 'refuse'].includes(statut)) {
    return NextResponse.json({ error: 'Statut invalide. Utilisez valide ou refuse.' }, { status: 400 })
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

  return NextResponse.json({ success: true, preuve })
}
