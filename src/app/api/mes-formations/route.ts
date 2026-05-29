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

  // Try to get all formations with error info
  const { data: allData, error: allError, count } = await serviceClient
    .from('formations')
    .select('id, titre, obligatoire', { count: 'exact' })

  if (allError) {
    return NextResponse.json({ 
      formations: [], 
      debug: { error: allError.message, code: allError.code, hint: allError.hint }
    })
  }

  return NextResponse.json({ 
    formations: allData ?? [],
    debug: { count, hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY }
  })
}
