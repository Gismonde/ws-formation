import { NextRequest, NextResponse } from 'next/server'
import { getActeur, cliniquesContenuGerables } from '@/lib/permissions'
import { ESPACE_COOKIE, espacesPossibles } from '@/lib/cliniques'

/** Change l'espace affiché (CMC / WSSC) pour un employé rattaché aux deux cliniques. */
export async function POST(req: NextRequest) {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const { espace } = await req.json().catch(() => ({}))
  const possibles = espacesPossibles(moi.clinique, moi.role)
  if (!possibles.includes(espace)) {
    return NextResponse.json({ error: 'Espace non autorise' }, { status: 403 })
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
  if (!moi) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  return NextResponse.json({ gerables: cliniquesContenuGerables(moi) })
}
