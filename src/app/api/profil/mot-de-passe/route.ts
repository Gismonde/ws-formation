// Remplacement d'un mot de passe temporaire (défini par un administrateur) par l'employé lui-même.
// Vérifie le mot de passe actuel, exige un nouveau mot de passe différent, puis lève l'obligation.
import { NextResponse } from 'next/server'
import { createClient as createJsClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/permissions'
import { regleMotDePasse } from '@/lib/mot-de-passe'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Session expirée. Veuillez vous reconnecter.' }, { status: 401 })

  const c = await request.json().catch(() => ({})) as { actuel?: string; nouveau?: string }
  const actuel = String(c.actuel ?? ''), nouveau = String(c.nouveau ?? '')
  const regle = regleMotDePasse(nouveau)
  if (regle) return NextResponse.json({ error: regle }, { status: 400 })
  if (nouveau === actuel) return NextResponse.json({ error: 'Le nouveau mot de passe doit être différent de l’actuel.' }, { status: 400 })

  // Vérification du mot de passe actuel avec un client isolé (ne touche pas à la session)
  const verif = createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: errVerif } = await verif.auth.signInWithPassword({ email: user.email, password: actuel })
  if (errVerif) return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 })
  await verif.auth.signOut({ scope: 'local' }).catch(() => {})

  const sb = serviceClient()
  const { error } = await sb.auth.admin.updateUserById(user.id, { password: nouveau, app_metadata: { mdp_temporaire: false } })
  if (error) return NextResponse.json({ error: /weak|pwned|leaked/i.test(error.message) ? 'Ce mot de passe est trop courant. Choisissez-en un autre.' : `Erreur lors de la modification : ${error.message}` }, { status: 400 })
  // Rafraîchit la session pour que la nouvelle valeur d'app_metadata soit prise en compte
  await supabase.auth.refreshSession().catch(() => {})

  const { data: emp } = await sb.from('employes').select('id').eq('auth_user_id', user.id).maybeSingle()
  if (emp) await logAudit({ acteur_id: emp.id, type_action: 'EMPLOYE_MODIFIE', description: 'Mot de passe temporaire remplacé par l’employé', cible_employe_id: emp.id })
  return NextResponse.json({ ok: true })
}
