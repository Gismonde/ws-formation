// Ouvre le document d'une SOP : lien externe tel quel, ou PDF téléversé (lien signé de courte durée).
import { estExterne } from '@/lib/membres-externes'
// La SOP est lue avec la session de l'utilisateur : les règles d'accès (rôle, clinique) s'appliquent.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { estMediaPrive } from '@/lib/medias'
import { signerUrlsMedias } from '@/lib/medias-serveur'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  // Mot de passe temporaire pas encore remplacé : pas d'accès
  if (user?.app_metadata?.mdp_temporaire === true) return NextResponse.json({ error: 'Choisissez d’abord votre mot de passe (Mon compte › Sécurité).' }, { status: 403 })
  if (!user) return NextResponse.redirect(new URL('/login', _req.url))
  const { data: moi } = await sb.from('employes').select('externe').eq('auth_user_id', user.id).maybeSingle()
  if (estExterne(moi)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { data: sop } = await sb.from('sop').select('id, fichier_url').eq('id', id).maybeSingle()
  if (!sop?.fichier_url) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (!estMediaPrive(sop.fichier_url)) return NextResponse.redirect(sop.fichier_url)
  const liens = await signerUrlsMedias([sop.fichier_url])
  const lien = liens[sop.fichier_url]
  return lien ? NextResponse.redirect(lien) : NextResponse.json({ error: 'Document indisponible' }, { status: 404 })
}
