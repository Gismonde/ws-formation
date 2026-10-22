// Courriels liés aux politiques (nouvelle politique, nouvelle version, rappel).
import type { SupabaseClient } from '@supabase/supabase-js'
import { courrielsActifs, envoyerCourriels, gabarit } from '@/lib/courriels'
import { estVise, Politique, EmployeVise } from '@/lib/politiques'

export type MotifCourriel = 'nouvelle' | 'version' | 'rappel'

/**
 * Avertit les employés visés. Si `destinataires` est fourni, seuls ceux-là sont avertis
 * (ex. rappel aux employés en attente dans la portée de l'acteur).
 */
export async function avertirPolitique(sb: SupabaseClient, p: Politique, origine: string, motif: MotifCourriel, destinataires?: EmployeVise[]) {
  if (!courrielsActifs()) return { envoyes: 0, erreur: 'non_configure' as string | undefined }
  let liste = destinataires
  if (!liste) {
    const { data } = await sb.from('employes').select('id, prenom, nom, email, role, clinique, departement_id, poste, actif')
      .or('actif.is.null,actif.eq.true')
    liste = ((data ?? []) as EmployeVise[]).filter(e => estVise(p, e))
  }
  const titre = {
    nouvelle: 'Nouvelle politique à lire',
    version: 'Politique mise à jour : nouvelle confirmation requise',
    rappel: 'Rappel : politique à confirmer',
  }[motif]
  const intro = {
    nouvelle: `Une nouvelle politique a été publiée dans votre portail : « ${p.titre} ».`,
    version: `La politique « ${p.titre} » a été mise à jour (version ${p.version}).`,
    rappel: `Vous n’avez pas encore confirmé la lecture de la politique « ${p.titre} ».`,
  }[motif]
  return envoyerCourriels(liste.filter(e => e.email).map(e => {
    const { html, texte } = gabarit({
      origine, clinique: e.clinique,
      titre,
      paragraphes: [
        `Bonjour ${e.prenom ?? ''},`.replace(' ,', ','),
        intro,
        ...(motif === 'version' && p.note_version ? [`Ce qui change : ${p.note_version}`] : []),
        'Merci de la lire et de confirmer « J’ai lu et compris » dans votre portail.',
      ],
      bouton: { libelle: 'Lire la politique', lien: `${origine}/dashboard/politiques/${p.id}` },
    })
    return { a: e.email!, sujet: `${titre} — ${p.titre}`, html, texte }
  }))
}
