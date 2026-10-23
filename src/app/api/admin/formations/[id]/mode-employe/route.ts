// Entrer dans le mode employé (ou en sortir avec ?sortir=1).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient, peutVoirContenu, peutCreerFormations } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { COOKIE_APERCU, COOKIE_PROGRESSION, DUREE_APERCU_S } from '@/lib/apercu-employe'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur)) return NextResponse.redirect(new URL('/login', req.url), 303)
  const opts = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: url.protocol === 'https:' }

  if (url.searchParams.get('sortir') === '1') {
    const retour = url.searchParams.get('retour') === 'fiche' || !peutCreerFormations(acteur) ? `/admin/formations/${id}` : `/admin/formations/${id}/editeur`
    const r = NextResponse.redirect(new URL(retour, req.url), 303)
    r.cookies.set(COOKIE_APERCU, '', { ...opts, httpOnly: false, maxAge: 0 })
    r.cookies.set(COOKIE_PROGRESSION, '', { ...opts, maxAge: 0 })
    return r
  }

  const { data: f } = await serviceClient().from('formations').select('id, clinique').eq('id', id).maybeSingle()
  if (!f || !peutVoirContenu(acteur, f.clinique)) return NextResponse.redirect(new URL('/admin/formations', req.url), 303)
  const r = NextResponse.redirect(new URL(`/apercu-employe/${id}${url.searchParams.get('retour') ? '?retour=' + encodeURIComponent(url.searchParams.get('retour')!) : ''}`, req.url), 303)
  // Lisible par le navigateur (simple identifiant) : les pages client sautent alors tout enregistrement
  r.cookies.set(COOKIE_APERCU, id, { ...opts, httpOnly: false, maxAge: DUREE_APERCU_S })
  r.cookies.set(COOKIE_PROGRESSION, '', { ...opts, maxAge: DUREE_APERCU_S }) // on repart de zéro
  return r
}
