// Accès hors assignation : inscription libre (« Commencer ») ou demande d'accès (« Demander »).
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { getEspace } from '@/lib/espace'
import { logAudit } from '@/lib/audit'
import { inscrireVolontaire } from '@/lib/formations-libres'
import { responsableAdmissible, adminConcerne } from '@/lib/cliniques'
import { chargerVersions } from '@/lib/langues-formation'
import { courrielsActifs, envoyerCourriels, gabarit, origineDepuis } from '@/lib/courriels'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const corps = await req.json().catch(() => ({}))
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique, publiee, acces_hors_assignation, responsable_id').eq('id', id).maybeSingle()
  const espace = await getEspace(moi)
  const mode = f?.acces_hors_assignation as string | undefined
  if (!f || !f.publiee || (mode !== 'libre' && mode !== 'demande') || !(espace.cliniquesContenu as string[]).includes(f.clinique)) {
    return NextResponse.json({ error: 'Formation non disponible' }, { status: 404 })
  }

  if (mode === 'libre') {
    const err = await inscrireVolontaire(sb, moi.id, id, moi.id)
    if (err) return NextResponse.json({ error: err }, { status: 500 })
    await logAudit({ acteur_id: moi.id, formation_id: id, type_action: 'INSCRIPTION_VOLONTAIRE', description: `Inscription volontaire : « ${f.titre} »`, metadata: { volontaire: true } })
    return NextResponse.json({ ok: true, statut: 'inscrit' })
  }

  // Sur demande : déjà inscrit → rien à demander
  const { data: deja } = await sb.from('assignations').select('formation_id').eq('employe_id', moi.id).eq('formation_id', id).maybeSingle()
  if (deja) return NextResponse.json({ ok: true, statut: 'inscrit' })
  const message = typeof corps.message === 'string' ? corps.message.trim().slice(0, 500) || null : null
  const { error } = await sb.from('demandes_acces_formation').upsert({
    formation_id: id, employe_id: moi.id, statut: 'en_attente', message, demandee_le: new Date().toISOString(),
    traitee_par: null, traitee_le: null, motif: null,
  }, { onConflict: 'formation_id,employe_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: moi.id, formation_id: id, type_action: 'DEMANDE_ACCES_ENVOYEE', description: `Demande d’accès : « ${f.titre} »`, metadata: { demande: true } })

  // Avis au responsable de la formation, sinon aux admins de la clinique
  if (courrielsActifs()) {
    let dest: { email: string | null; prenom: string | null }[] = []
    if (f.responsable_id) {
      const { data } = await sb.from('employes').select('email, prenom, actif, role, clinique').eq('id', f.responsable_id).maybeSingle()
      if (data && data.actif !== false && responsableAdmissible(data, f.clinique)) dest = [data]
    }
    if (!dest.length) {
      const { data } = await sb.from('employes').select('email, prenom, actif, clinique, role').eq('role', 'admin')
      dest = (data ?? []).filter(e => adminConcerne(e, f.clinique))
    }
    const origine = origineDepuis(req)
    // Les demandes de la version anglaise se traitent depuis la version française
    const racine = (await chargerVersions(sb, [id])).racine(id)
    const nom = `${moi.prenom ?? ''} ${moi.nom ?? ''}`.trim()
    await envoyerCourriels(dest.filter(d => d.email).map(d => {
      const { html, texte } = gabarit({
        origine, clinique: f.clinique, titre: 'Nouvelle demande d’accès à une formation',
        paragraphes: [`Bonjour ${d.prenom ?? ''},`.replace(' ,', ','), `${nom} demande l’accès à la formation « ${f.titre} ».`, ...(message ? [`Message : ${message}`] : []), 'Vous pouvez accepter ou refuser la demande dans l’onglet « Demandes d’accès » de la formation.'],
        bouton: { libelle: 'Voir les demandes', lien: `${origine}/formations/${racine}?onglet=demandes` },
      })
      return { a: d.email!, sujet: `Demande d’accès — ${f.titre}`, html, texte }
    }))
  }
  return NextResponse.json({ ok: true, statut: 'en_attente' })
}
