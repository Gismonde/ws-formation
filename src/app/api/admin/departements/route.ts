import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, ipEtAgent } from '@/lib/permissions'
import { estAdministrateur } from '@/lib/cliniques'

// Les départements sont communs aux deux cliniques : un seul nom par département.

// Créer un département (administrateurs)
export async function POST(request: Request) {
  const acteur = await getActeur()
  if (!acteur || !estAdministrateur(acteur.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { nom } = await request.json()
  const propre = typeof nom === 'string' ? nom.trim() : ''
  if (!propre) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const sb = serviceClient()
  const { data: existants } = await sb.from('departements').select('id, nom')
  if ((existants ?? []).some((d: { nom: string }) => d.nom.trim().toLowerCase() === propre.toLowerCase())) {
    return NextResponse.json({ error: `Le département « ${propre} » existe déjà.` }, { status: 400 })
  }

  const { data, error } = await sb.from('departements').insert({ nom: propre }).select('id, nom').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'PARAMETRE_MODIFIE',
    description: `Département créé : ${data.nom}`,
    metadata: { departement_id: data.id },
    ...ipEtAgent(request),
  })
  return NextResponse.json({ success: true, departement: data })
}

// Renommer un département (administrateur global seulement)
export async function PATCH(request: Request) {
  const acteur = await getActeur()
  if (!acteur || acteur.role !== 'super_admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id, nom } = await request.json()
  const propre = typeof nom === 'string' ? nom.trim() : ''
  if (!id || !propre) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })

  const sb = serviceClient()
  const { data: dept } = await sb.from('departements').select('id, nom').eq('id', id).single()
  if (!dept) return NextResponse.json({ error: 'Département introuvable' }, { status: 404 })

  const { data: existants } = await sb.from('departements').select('id, nom')
  if ((existants ?? []).some((d: { id: string; nom: string }) => d.id !== id && d.nom.trim().toLowerCase() === propre.toLowerCase())) {
    return NextResponse.json({ error: `Le département « ${propre} » existe déjà.` }, { status: 400 })
  }

  const { error } = await sb.from('departements').update({ nom: propre }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logAudit({
    acteur_id: acteur.id,
    type_action: 'PARAMETRE_MODIFIE',
    description: `Département renommé : ${dept.nom} -> ${propre}`,
    metadata: { departement_id: id },
    ...ipEtAgent(request),
  })
  return NextResponse.json({ success: true })
}
