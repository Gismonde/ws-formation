import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function PUT(request: Request) {
      try {
              // Verify the requesting user is an admin
        const serverSupabase = await createServerClient()
              const { data: { user } } = await serverSupabase.auth.getUser()
              if (!user) {
                        return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
              }

        const { data: emp } = await serverSupabase
                .from('employes')
                .select('role')
                .eq('auth_user_id', user.id)
                .single()

        if (!emp || emp.role !== 'admin') {
                  return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
        }

        const body = await request.json()
              const { id, prenom, nom, poste, departement_id, role, actif } = body

        if (!id) {
          return NextResponse.json({ error: 'ID employe manquant' }, { status: 400 })
        }

        const adminSupabase = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
                )

        const updateData: Record<string, unknown> = {}
                if (prenom !== undefined) updateData.prenom = prenom
              if (nom !== undefined) updateData.nom = nom
              if (poste !== undefined) updateData.poste = poste
              if (departement_id !== undefined) updateData.departement_id = departement_id || null
              if (role !== undefined) updateData.role = role
              if (actif !== undefined) updateData.actif = actif

        const { error } = await adminSupabase
                .from('employes')
                .update(updateData)
                .eq('id', id)

        if (error) {
                  console.error('Supabase update error:', error)
                  return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true })
      } catch (err) {
              console.error('Update employee route error:', err)
              return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
      }
}
