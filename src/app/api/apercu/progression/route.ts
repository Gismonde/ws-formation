// Mode employé : leçon « terminée » gardée dans un cookie (rien en base). POST { formationId, leconId } ; DELETE pour recommencer.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/lib/permissions'
import { COOKIE_APERCU, COOKIE_PROGRESSION, DUREE_APERCU_S, ecrireProgression, lireProgression, modeApercu } from '@/lib/apercu-employe'

export async function POST(req: Request) {
  const { formationId, leconId } = await req.json().catch(() => ({})) as { formationId?: string; leconId?: string }
  const { data: f } = formationId ? await serviceClient().from('formations').select('id, clinique').eq('id', formationId).maybeSingle() : { data: null }
  if (!f || !leconId || !(await modeApercu(f)).actif) return NextResponse.json({ error: 'Mode employé inactif' }, { status: 400 })
  const c = await cookies()
  const valeur = ecrireProgression([...lireProgression(c.get(COOKIE_PROGRESSION)?.value), leconId])
  const r = NextResponse.json({ ok: true, termineeLe: new Date().toISOString() })
  r.cookies.set(COOKIE_PROGRESSION, valeur, { path: '/', httpOnly: true, sameSite: 'lax', secure: new URL(req.url).protocol === 'https:', maxAge: DUREE_APERCU_S })
  return r
}

export async function DELETE(req: Request) {
  const c = await cookies()
  if (!c.get(COOKIE_APERCU)?.value) return NextResponse.json({ ok: true })
  const r = NextResponse.json({ ok: true })
  r.cookies.set(COOKIE_PROGRESSION, '', { path: '/', httpOnly: true, sameSite: 'lax', secure: new URL(req.url).protocol === 'https:', maxAge: DUREE_APERCU_S })
  return r
}
