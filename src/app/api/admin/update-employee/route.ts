import { valeursExterne } from '@/lib/membres-externes'
import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getActeur, serviceClient, peutGererEmploye, validerAttribution, ipEtAgent } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { droitsDe, droitsAEnregistrer, changementsDroits, AUCUN_DROIT } from '@/lib/droits'

export async function PUT(request: Request) {
  try {
    const acteur = await getActeur()
    if (!acteur) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await request.json()
    const { id, prenom, nom, poste, actif } = body
    if (!id) return NextResponse.json({ error: 'ID employé manquant' }, { status: 400 })

    const sb = serviceClient()
    const { data: cible } = await sb
      .from('employes')
      .select('*')
      .eq('id', id)
      .single()

    if (!cible || !peutGererEmploye(acteur, cible)) {
      return NextResponse.json({ error: 'Accès refusé : employé hors de votre périmètre' }, { status: 403 })
    }

    // Rôle, clinique et département : on valide la combinaison finale
    const attribution = await validerAttribution(acteur, {
      role: body.role ?? cible.role,
      clinique: body.clinique !== undefined ? body.clinique : cible.clinique,
      departement_id: body.departement_id !== undefined ? body.departement_id : cible.departement_id,
    }, sb)
    if ('erreur' in attribution) return NextResponse.json({ error: attribution.erreur }, { status: 403 })

    const updateData: Record<string, unknown> = { ...attribution.valeurs }
    if (prenom !== undefined) updateData.prenom = prenom
    if (nom !== undefined) updateData.nom = nom
    if (poste !== undefined) updateData.poste = poste
    if (typeof actif === 'boolean') updateData.actif = actif
    // Membre externe (CMC) : recalculé selon le rôle et la clinique finale
    if (body.externe !== undefined || cible.externe) {
      const ext = valeursExterne(body.externe !== undefined ? body : { externe: cible.externe, organisation: cible.organisation }, attribution.valeurs.role, attribution.valeurs.clinique)
      if (ext.externe !== !!cible.externe || ext.organisation !== (cible.organisation ?? null)) Object.assign(updateData, ext)
    }
    // Droits du gestionnaire : modifiables par les administrateurs seulement ; retirés si la personne n'est plus gestionnaire
    const avant = droitsDe(cible)
    const apres = (acteur.role === 'super_admin' || acteur.role === 'admin')
      ? droitsAEnregistrer(attribution.valeurs.role, body, avant, attribution.valeurs.clinique)
      : attribution.valeurs.role === 'gestionnaire' ? avant : { ...AUCUN_DROIT }
    Object.assign(updateData, apres)
    const changements = changementsDroits(avant, apres)

    const { error } = await sb.from('employes').update(updateData).eq('id', id)
    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (changements.length) {
      await logAudit({
        acteur_id: acteur.id, type_action: 'EMPLOYE_MODIFIE', cible_employe_id: id,
        description: `Droits modifiés pour ${cible.prenom ?? ''} ${cible.nom ?? ''} : ${changements.join(', ')}`.replace('  ', ' '),
        metadata: { droits: { avant, apres } }, ...ipEtAgent(request),
      })
    }

    if (actif === false && cible.actif !== false && cible.auth_user_id) {
      await sb.auth.admin.signOut(cible.auth_user_id)
    }

    await logAudit({
      acteur_id: acteur.id,
      type_action: 'EMPLOYE_MODIFIE',
      description: 'Dossier employé modifié',
      cible_employe_id: id,
      metadata: {
        avant: { role: cible.role, clinique: cible.clinique, departement_id: cible.departement_id, actif: cible.actif },
        apres: updateData,
      },
      ...ipEtAgent(request),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update employee route error:', err)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}
