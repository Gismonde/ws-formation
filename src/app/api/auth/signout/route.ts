// Déconnexion (POST) : fin de session Supabase, journal d'audit, puis retour à la connexion.
// Clear-Site-Data efface aussi les pages gardées pour le mode hors ligne et les données locales :
// sur une tablette partagée, l'employé suivant ne retrouve rien du précédent.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { serviceClient } from '@/lib/permissions'

export async function POST(request: Request) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const { data: emp } = await serviceClient().from('employes').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (emp) {
      await logAudit({
        acteur_id: emp.id as string, type_action: 'DECONNEXION', description: 'Déconnexion',
        ip_address: request.headers.get('x-forwarded-for') ?? null, user_agent: request.headers.get('user-agent') ?? null,
      }).catch(() => {})
    }
    await sb.auth.signOut({ scope: 'local' })
  }
  const reponse = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  reponse.headers.set('Clear-Site-Data', '"cache", "storage"')
  for (const nom of ['ws_apercu', 'ws_apercu_prog']) reponse.cookies.delete(nom)
  return reponse
}
