// Traitement d'une demande d'accès à une formation : responsable de la formation ou admin de la clinique.
import { NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { inscrireVolontaire, peutTraiterDemandes } from '@/lib/formations-libres'
import { courrielsActifs, envoyerCourriels, gabarit, origineDepuis } from '@/lib/courriels'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const corps = await req.json().catch(() => ({}))
  const decision = corps.decision === 'acceptee' ? 'acceptee' : corps.decision === 'refusee' ? 'refusee' : null
  if (!decision || typeof corps.demandeId !== 'string') return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  const sb = serviceClient()
  const { data: f } = await sb.from('formations').select('id, titre, clinique, responsable_id').eq('id', id).maybeSingle()
  if (!f || !peutTraiterDemandes(moi, f)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { data: d } = await sb.from('demandes_acces_formation').select('id, employe_id, statut').eq('id', corps.demandeId).eq('formation_id', id).maybeSingle()
  if (!d) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  const motif = typeof corps.motif === 'string' ? corps.motif.trim().slice(0, 500) || null : null

  if (decision === 'acceptee') {
    const err = await inscrireVolontaire(sb, d.employe_id, id, moi.id)
    if (err) return NextResponse.json({ error: err }, { status: 500 })
  }
  const { error } = await sb.from('demandes_acces_formation').update({ statut: decision, motif, traitee_par: moi.id, traitee_le: new Date().toISOString() }).eq('id', d.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ acteur_id: moi.id, formation_id: id, type_action: 'DEMANDE_ACCES_TRAITEE', cible_employe_id: d.employe_id, description: `Demande d’accès ${decision === 'acceptee' ? 'acceptée' : 'refusée'} : « ${f.titre} »`, metadata: { demande: d.id, employe: d.employe_id } })

  if (courrielsActifs()) {
    const { data: e } = await sb.from('employes').select('email, prenom').eq('id', d.employe_id).maybeSingle()
    if (e?.email) {
      const origine = origineDepuis(req)
      const ok = decision === 'acceptee'
      const { html, texte } = gabarit({
        origine, clinique: f.clinique, titre: ok ? 'Demande d’accès acceptée' : 'Demande d’accès refusée',
        paragraphes: [`Bonjour ${e.prenom ?? ''},`.replace(' ,', ','), ok
          ? `Votre demande d’accès à la formation « ${f.titre} » a été acceptée. Vous la retrouvez dans « Mes formations ».`
          : `Votre demande d’accès à la formation « ${f.titre} » a été refusée.`, ...(motif ? [`Motif : ${motif}`] : [])],
        ...(ok ? { bouton: { libelle: 'Commencer la formation', lien: `${origine}/formations/${id}` } } : {}),
      })
      await envoyerCourriels([{ a: e.email, sujet: `${ok ? 'Accès accepté' : 'Accès refusé'} — ${f.titre}`, html, texte }])
    }
  }
  return NextResponse.json({ ok: true })
}
