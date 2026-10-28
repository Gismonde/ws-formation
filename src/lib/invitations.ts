// Invitation d'un employé : lien sécurisé pour créer son mot de passe (aucun mot de passe saisi par l'admin).
import { chargerNotifications, composerNotification } from '@/lib/notifications-courriel'
import type { SupabaseClient } from '@supabase/supabase-js'
import { envoyerCourriels, gabarit } from '@/lib/courriels'

export type ResultatInvitation = {
  authUserId: string | null
  courrielEnvoye: boolean
  /** Lien à transmettre manuellement si le courriel n'a pas pu partir */
  lien: string | null
  erreur?: string
}

/**
 * - nouveau = true  : crée le compte de connexion (type « invite »)
 * - nouveau = false : compte existant, nouveau lien pour (re)définir le mot de passe (type « recovery »)
 */
export async function inviterEmploye(sb: SupabaseClient, params: {
  email: string; prenom: string; nom: string; clinique: string | null; origine: string; nouveau: boolean
}): Promise<ResultatInvitation> {
  const { email, prenom, nom, clinique, origine, nouveau } = params
  const { data, error } = await sb.auth.admin.generateLink(nouveau
    ? { type: 'invite', email, options: { data: { prenom, nom } } }
    : { type: 'recovery', email })
  if (error || !data?.properties?.hashed_token) {
    return { authUserId: null, courrielEnvoye: false, lien: null, erreur: error?.message ?? 'Lien impossible à générer' }
  }
  const type = nouveau ? 'invite' : 'recovery'
  const lien = `${origine}/bienvenue?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}`

  const cfg = nouveau ? await chargerNotifications(sb) : null
  const perso = nouveau ? composerNotification(cfg, 'compte_cree_admin', { a: email, origine, clinique, prenom, nom, lien }) : null
  if (nouveau && !perso) {
    // Notification désactivée : aucun courriel, le lien est transmis par l'administrateur
    return { authUserId: data.user?.id ?? null, courrielEnvoye: false, lien, erreur: 'notification_desactivee' }
  }
  const { html, texte } = perso ? { html: perso.html, texte: perso.texte } : gabarit({
    origine, clinique,
    titre: nouveau ? `Bienvenue ${prenom} !` : 'Accédez à votre portail de formation',
    paragraphes: nouveau
      ? [
          'Votre accès au portail de formation des employés vient d’être créé.',
          'Cliquez sur le bouton ci-dessous pour choisir votre mot de passe et activer votre compte. Vous y trouverez ensuite vos formations, vos certificats et les politiques de la clinique.',
          `Votre identifiant de connexion est : ${email}`,
        ]
      : [
          `Bonjour ${prenom},`,
          'Voici un nouveau lien pour choisir votre mot de passe et accéder au portail de formation.',
        ],
    bouton: { libelle: nouveau ? 'Créer mon mot de passe' : 'Choisir mon mot de passe', lien },
    piedDePage: 'Ce lien est personnel et expire rapidement. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.',
  })
  const envoi = await envoyerCourriels([{ a: email, sujet: perso ? perso.sujet : nouveau ? 'Activez votre accès au portail de formation' : 'Votre lien d’accès au portail de formation', html, texte }])
  const courrielEnvoye = envoi.envoyes === 1

  return {
    authUserId: data.user?.id ?? null,
    courrielEnvoye,
    lien: courrielEnvoye ? null : lien,
    erreur: courrielEnvoye ? undefined : envoi.erreur,
  }
}
