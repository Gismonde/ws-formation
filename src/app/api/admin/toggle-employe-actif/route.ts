import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, peutGererEmploye, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'

export async function PATCH(request: Request) {
  try {
    const acteur = await getActeur()
    if (!acteur) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    if (!aAccesAdmin(acteur.role)) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

    const { id, actif } = await request.json()
    if (!id || typeof actif !== 'boolean') {
      return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
    }

    const sb = serviceClient()
    const { data: cible } = await sb
      .from('employes')
      .select('id, auth_user_id, role, clinique, departement_id')
      .eq('id', id)
      .single()

    if (!cible || !peutGererEmploye(acteur, cible)) {
      return NextResponse.json({ error: 'Acces refuse - employe hors de votre perimetre' }, { status: 403 })
    }

    // Archivage : fermer les sessions de l'employé
    if (!actif && cible.auth_user_id) {
      await sb.auth.admin.signOut(cible.auth_user_id)
    }

    const { error } = await sb.from('employes').update({ actif }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await logAudit({
      acteur_id: acteur.id,
      type_action: 'EMPLOYE_MODIFIE',
      description: actif ? 'Employe reactive' : 'Employe archive',
      cible_employe_id: id,
      metadata: { actif },
      ...ipEtAgent(request),
    })

    return NextResponse.json({ success: true, actif })
  } catch (err) {
    console.error('toggle-employe-actif error:', err)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}
