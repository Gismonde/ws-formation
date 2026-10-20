import { NextRequest, NextResponse } from 'next/server'
import { getActeur, cliniquesContenuGerables } from '@/lib/permissions'
import { ESPACE_COOKIE, espacesPossibles, VUE_ADMIN_COOKIE, vuesAdminPossibles } from '@/lib/cliniques'

/** Change l'espace affiché (CMC / WSSC) pour un employé rattaché aux deux cliniques. */
export async function POST(req: NextRequest) {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const corps = await req.json().catch(() => ({}))
  const options = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 }

  // Vue de l'espace Admin : CMC, WSSC ou les deux (« TOUS »)
  if ('vue' in corps) {
    const vue = corps.vue
    const vues = vuesAdminPossibles(moi.clinique, moi.role)
    if (vue !== 'TOUS' && !vues.includes(vue)) return NextResponse.json({ error: 'Vue non autorisée' }, { status: 403 })
    const res = NextResponse.json({ ok: true, vue })
    if (vue === 'TOUS') res.cookies.delete(VUE_ADMIN_COOKIE)
    else {
      res.cookies.set(VUE_ADMIN_COOKIE, vue, options)
      // L'espace employé suit le même choix
      if (espacesPossibles(moi.clinique, moi.role).includes(vue)) res.cookies.set(ESPACE_COOKIE, vue, options)
    }
    return res
  }

  const { espace } = corps
  const possibles = espacesPossibles(moi.clinique, moi.role)
  if (!possibles.includes(espace)) {
    return NextResponse.json({ error: 'Espace non autorisé' }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true, espace })
  res.cookies.set(ESPACE_COOKIE, espace, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 60 * 60 * 24 * 365,
  })
  return res
}

/** Cliniques pour lesquelles l'utilisateur peut créer du contenu (formulaires de formation / SOP). */
export async function GET() {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json({ gerables: cliniquesContenuGerables(moi) })
}
