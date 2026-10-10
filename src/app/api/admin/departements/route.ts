import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, cliniquesAdministrees, peutVoirDepartement, ipEtAgent } from '@/lib/permissions'
import { estAdministrateur, Clinique } from '@/lib/cliniques'

function cliniqueValide(v: unknown): v is Clinique {
  return v === 'CMC' || v === 'WSSC'
}

// Créer un département (admin global : n'importe quelle clinique ; admin de clinique : la sienne)
export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !estAdministrateur(acteur.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

  const { nom, clinique } = await request.json()
  if (!nom || typeof nom !== 'string' || !nom.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  if (!cliniqueValide(clinique) || !cliniquesAdministrees(acteur).includes(clinique)) {
    return NextResponse.json({ error: 'Clinique hors de votre perimetre' }, { status: 403 })
  }

  const { data, error } = await serviceClient()
    .from('departements')
    .insert({ nom: nom.trim(), clinique })
    .select('id, nom, clinique')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'PARAMETRE_MODIFIE',
    description: `Departement cree : ${data.nom} (${clinique})`,
    metadata: { departement_id: data.id, clinique },
    ...ipEtAgent(request),
  })
  return NextResponse.json({ success: true, departement: data })
}

// Renommer un département ou (admin global seulement) changer sa clinique
export async function PATCH(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !estAdministrateur(acteur.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

  const { id, nom, clinique } = await request.json()
  const sb = serviceClient()
  const { data: dept } = await sb.from('departements').select('id, nom, clinique').eq('id', id).single()
  if (!dept || !peutVoirDepartement(acteur, dept)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

  const maj: Record<string, unknown> = {}
  if (typeof nom === 'string' && nom.trim()) maj.nom = nom.trim()
  if (clinique !== undefined && clinique !== dept.clinique) {
    if (acteur.role !== 'super_admin') {
      return NextResponse.json({ error: "Seul l'administrateur global peut changer la clinique d'un departement" }, { status: 403 })
    }
    if (!cliniqueValide(clinique)) return NextResponse.json({ error: 'Clinique invalide' }, { status: 400 })
    maj.clinique = clinique
  }
  if (Object.keys(maj).length === 0) return NextResponse.json({ success: true })

  const { error } = await sb.from('departements').update(maj).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'PARAMETRE_MODIFIE',
    description: `Departement modifie : ${dept.nom}`,
    metadata: { departement_id: id, avant: dept, apres: maj },
    ...ipEtAgent(request),
  })
  return NextResponse.json({ success: true })
}
