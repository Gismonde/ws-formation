// api/mes-formations/route.ts - v2
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let employe: { id: string } | null = null
  const { data: emp1 } = await serviceClient
    .from('employes').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (emp1) {
    employe = emp1
  } else if (user.email) {
    const { data: emp2 } = await serviceClient
      .from('employes').select('id').eq('email', user.email).maybeSingle()
    employe = emp2
  }

  let formations: any[] = []

  if (employe) {
    const { data: assignations } = await serviceClient
      .from('assignations').select('formation_id').eq('employe_id', employe.id)
    const formationIds = assignations?.map((a: any) => a.formation_id) ?? []

    if (formationIds.length > 0) {
      const { data: assigned } = await serviceClient
        .from('formations').select('id, titre').in('id', formationIds)
      formations = assigned ?? []
    }
  }

  // If no formations found, show all
  if (formations.length === 0) {
    const { data: all } = await serviceClient
      .from('formations').select('id, titre')
    formations = all ?? []
  }

  return NextResponse.json({ formations })
}
