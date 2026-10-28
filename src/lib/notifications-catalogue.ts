// Notifications par courriel : catalogue des types (Admin → Paramètres → Notifications), textes par défaut,
// variables et gabarit visuel (logos, « Bonjour Prénom Nom, », message, bouton vers l'activité, pied de page).
// Fichier pur (utilisable côté navigateur pour l'aperçu et côté serveur pour l'envoi).
import { CLINIQUE_INFO, THEME_CLINIQUE, cliniquesDe, type Clinique } from '@/lib/cliniques'

export type Groupe = 'cours' | 'evenements' | 'liste_attente' | 'comptes' | 'validation' | 'superviseurs' | 'formateurs' | 'paiement' | 'sondages'
export const GROUPES: { id: Groupe; titre: string }[] = [
  { id: 'cours', titre: 'Formations en ligne' },
  { id: 'evenements', titre: 'Événements et séances (occurrences)' },
  { id: 'liste_attente', titre: 'Liste d’attente' },
  { id: 'comptes', titre: 'Comptes et invitations' },
  { id: 'validation', titre: 'Inscriptions avec validation' },
  { id: 'superviseurs', titre: 'Superviseurs' },
  { id: 'formateurs', titre: 'Formateurs' },
  { id: 'sondages', titre: 'Sondages' },
  { id: 'paiement', titre: 'Paiement et achats par un tiers' },
]

export type ModeleNotification = { sujet: string; message: string; bouton: string }
export type TypeNotification = {
  cle: string
  libelle: string
  groupe: Groupe
  /** Envoyée aujourd'hui par WS Formation (sinon : modèle prêt, envoi à venir ou non utilisé) */
  envoyee: boolean
  defaut: ModeleNotification
}

const m = (sujet: string, message: string, bouton = 'Accéder à mon activité'): ModeleNotification => ({ sujet, message, bouton })
const T = (cle: string, libelle: string, groupe: Groupe, envoyee: boolean, defaut: ModeleNotification): TypeNotification => ({ cle, libelle, groupe, envoyee, defaut })

export const CATALOGUE: TypeNotification[] = [
  // Formations en ligne
  T('suivi_post_formation', 'Suivi post-formation', 'cours', false, m('Suivi de votre formation : {activite}', 'Ceci est un message automatisé pour faire le suivi de votre formation {activite}.')),
  T('rappel_expiration', 'Rappel pour l’expiration du cours', 'cours', true, m('Certificat à renouveler : {activite}', 'Ceci est un message automatisé pour vous rappeler que la validité de l’activité de formation {activite} {detail}.\nPour rester en règle, refaites la formation et son questionnaire afin d’obtenir un nouveau certificat.', 'Refaire la formation')),
  T('rappel_completer', 'Rappel pour compléter l’activité', 'cours', true, m('Rappel : {activite}', 'Ceci est un message automatisé pour vous rappeler de compléter l’activité de formation {activite}.\n{detail}\nAvancement actuel : {progression} %.')),
  T('rappel_expiration_envoye', 'Rappel d’expiration du cours envoyé', 'cours', false, m('Rappel d’expiration envoyé : {activite}', 'Un rappel d’expiration a été envoyé pour l’activité {activite}.')),
  T('inscription_cours_assignation', 'Message de confirmation d’inscription à un cours en ligne par assignation', 'cours', true, m('Nouvelle formation : {activite}', 'Ceci est un message automatique pour vous informer de votre inscription à l’activité : {activite}.\n{echeance}', 'Accéder à mon activité')),
  T('inscription_cours', 'Message de confirmation d’inscription à un cours en ligne', 'cours', false, m('Inscription confirmée : {activite}', 'Ceci est un message automatique pour vous confirmer votre inscription à l’activité : {activite}.')),
  T('inscription_cours_nouvel_utilisateur', 'Message de confirmation d’inscription d’un nouvel utilisateur à un cours en ligne par assignation', 'cours', false, m('Bienvenue — {activite}', 'Votre compte a été créé et vous êtes inscrit(e) à l’activité : {activite}.')),
  T('achevement_apprenant', 'Message de confirmation de l’achèvement du cours envoyé à l’apprenant', 'cours', false, m('Formation terminée : {activite}', 'Félicitations ! Vous avez terminé l’activité de formation {activite}.', 'Voir mon certificat')),
  T('annulation_par_utilisateur', 'Message de confirmation d’annulation d’une inscription à une activité par l’utilisateur', 'cours', false, m('Inscription annulée : {activite}', 'Votre inscription à l’activité {activite} a bien été annulée.')),
  T('assignation_validee', 'Message informant l’utilisateur que son inscription par assignation a été validée', 'cours', false, m('Inscription validée : {activite}', 'Ceci est un message automatique pour vous informer de la validation de votre inscription à l’activité : {activite}.')),

  // Événements / occurrences
  T('rappel_evenement', 'Notification de rappel pour l’événement', 'evenements', true, m('Rappel : {activite}', 'Ceci est un rappel : vous êtes inscrit(e) à l’activité {activite}.\nDate : {date}\n{lieu}', 'Voir mon inscription')),
  T('inscription_occurrence', 'Message de confirmation d’inscription à une occurrence', 'evenements', true, m('Inscription confirmée : {activite}', 'Ceci est un message automatique pour vous confirmer votre inscription à l’activité : {activite}.\nDate : {date}\n{lieu}\n{calendrier}', 'Voir mon inscription')),
  T('inscription_occurrence_assignation', 'Message de confirmation d’inscription à une occurrence par assignation', 'evenements', false, m('Inscription : {activite}', 'Vous avez été inscrit(e) à l’activité : {activite}.\nDate : {date}')),
  T('inscription_occurrence_nouvel_utilisateur', 'Message de confirmation d’inscription d’un nouvel utilisateur à une occurrence par assignation', 'evenements', false, m('Bienvenue — {activite}', 'Votre compte a été créé et vous êtes inscrit(e) à l’activité : {activite}.')),
  T('notification_inscription_occurrence', 'Message de notification de l’inscription d’un utilisateur à une occurrence', 'evenements', false, m('Nouvelle inscription : {activite}', '{nom_complet} s’est inscrit(e) à l’activité {activite}.')),
  T('modification_occurrence', 'Message de modification d’une occurrence', 'evenements', true, m('Changement : {activite}', 'Une séance de l’activité {activite} à laquelle vous êtes inscrit(e) a été modifiée.\nNouvelle date : {date}\n{lieu}\n{calendrier}', 'Voir mon inscription')),
  T('annulation_occurrence', 'Message d’annulation d’une occurrence', 'evenements', true, m('Annulation : {activite}', 'L’activité {activite} est annulée. Votre inscription est annulée automatiquement.', 'Mes événements')),
  T('nouvelle_session_participants', 'Informer les participants qu’ils ont une nouvelle session', 'evenements', true, m('Nouvelle formation en présentiel : {activite}', 'Une nouvelle séance de l’activité {activite} est ouverte aux inscriptions.', 'S’inscrire')),
  T('session_annulee_participants', 'Informer les participants d’une session annulée', 'evenements', true, m('Séance annulée : {activite}', 'La séance du {date} de l’activité {activite} est annulée. Vous pouvez vous inscrire à une autre date dans votre portail.')),
  T('presence_confirmee_nouveau_compte', 'Invitation pour un nouvel utilisateur à compléter son compte lorsque sa présence à une activité est confirmée', 'evenements', false, m('Complétez votre compte', 'Votre présence à l’activité {activite} est confirmée. Complétez votre compte pour accéder à votre dossier.', 'Compléter mon compte')),

  // Liste d'attente
  T('liste_attente_ouverture', 'Notification d’une nouvelle ouverture pour les utilisateurs de la liste d’attente', 'liste_attente', true, m('Une place s’est libérée : {activite}', 'Bonne nouvelle : une place s’est libérée. Vous êtes maintenant inscrit(e) à l’activité {activite}.\nDate : {date}\n{lieu}\n{calendrier}', 'Voir mon inscription')),
  T('liste_attente_disponibilites', 'Notification des nouvelles disponibilités pour les utilisateurs de la liste d’attente', 'liste_attente', false, m('Nouvelles disponibilités : {activite}', 'De nouvelles dates sont disponibles pour l’activité {activite}.')),
  T('liste_attente_inviter', 'Inviter l’utilisateur, inscrit sur la liste d’attente, à aller s’inscrire à l’activité', 'liste_attente', false, m('Inscrivez-vous : {activite}', 'Vous êtes sur la liste d’attente de l’activité {activite}. Des places sont disponibles : inscrivez-vous dès maintenant.', 'S’inscrire')),

  // Comptes
  T('compte_cree_admin', 'Message envoyé au propriétaire du compte nouvellement créé par l’administrateur', 'comptes', true, m('Activez votre accès au portail de formation', 'Votre accès au portail de formation vient d’être créé. Cliquez sur le bouton ci-dessous pour choisir votre mot de passe et activer votre compte.\nVotre identifiant de connexion est : {courriel}', 'Créer mon mot de passe')),
  T('invitation_completer_compte', 'Invitation pour l’utilisateur à compléter son compte créé par invitation par email', 'comptes', false, m('Complétez votre compte', 'Vous avez été invité(e) au portail de formation. Complétez votre compte pour commencer.', 'Compléter mon compte')),
  T('valider_courriel', 'Invitation pour l’utilisateur à valider son adresse courriel', 'comptes', false, m('Validez votre adresse courriel', 'Merci de confirmer votre adresse courriel en cliquant sur le bouton ci-dessous.', 'Valider mon adresse')),
  T('acces_autre_plateforme', 'Informer l’utilisateur de son accès à la plateforme (l’utilisateur existe sur une autre plateforme)', 'comptes', false, m('Votre accès au portail de formation', 'Vous avez maintenant accès au portail de formation avec votre compte existant.')),
  T('compte_admin_propre_courriel', 'Information sur le nouveau compte créé par l’administrateur en utilisant sa propre adresse courriel', 'comptes', false, m('Nouveau compte créé', 'Un compte a été créé par l’administrateur avec votre adresse courriel.')),

  // Validation
  T('validation_refusee', 'Message de validation refusée d’une inscription', 'validation', false, m('Inscription refusée : {activite}', 'Votre demande d’inscription à l’activité {activite} n’a pas été acceptée.')),
  T('cours_validation', 'Message de confirmation d’inscription à un cours en ligne nécessitant une validation', 'validation', false, m('Demande reçue : {activite}', 'Votre demande d’inscription à l’activité {activite} est reçue et doit être validée.')),
  T('cours_assignation_validation', 'Message de confirmation d’inscription à un cours en ligne par assignation nécessitant une validation', 'validation', false, m('Inscription à valider : {activite}', 'Votre inscription à l’activité {activite} doit être validée.')),
  T('cours_nouvel_utilisateur_validation', 'Message de confirmation d’inscription d’un nouvel utilisateur à un cours en ligne par assignation nécessitant une validation', 'validation', false, m('Inscription à valider : {activite}', 'Votre compte a été créé ; votre inscription à l’activité {activite} doit être validée.')),
  T('occurrence_validation', 'Message de confirmation d’inscription à une occurrence nécessitant une validation', 'validation', false, m('Demande reçue : {activite}', 'Votre demande d’inscription à l’activité {activite} est reçue et doit être validée.')),
  T('occurrence_assignation_validation', 'Message de confirmation d’inscription à une occurrence par assignation nécessitant une validation', 'validation', false, m('Inscription à valider : {activite}', 'Votre inscription à l’activité {activite} doit être validée.')),
  T('occurrence_nouvel_utilisateur_validation', 'Message de confirmation d’inscription d’un nouvel utilisateur à une occurrence par assignation nécessitant une validation', 'validation', false, m('Inscription à valider : {activite}', 'Votre compte a été créé ; votre inscription à l’activité {activite} doit être validée.')),
  T('courriels_validation_inscription', 'Message de notification aux courriels de validation à l’inscription d’un utilisateur', 'validation', false, m('Inscription à valider : {activite}', '{nom_complet} demande à s’inscrire à l’activité {activite}.', 'Valider l’inscription')),
  T('courriels_validation_desinscription', 'Message de notification aux courriels de validation à la désinscription d’un utilisateur', 'validation', false, m('Désinscription : {activite}', '{nom_complet} s’est désinscrit(e) de l’activité {activite}.')),

  // Superviseurs
  T('superviseur_validation_acceptee', 'Message de notification au superviseur que la validation d’une de ses assignations a été acceptée', 'superviseurs', false, m('Assignation acceptée : {activite}', 'La validation de l’assignation de {nom_complet} à l’activité {activite} a été acceptée.')),
  T('superviseur_validation_refusee', 'Message de notification au superviseur du refus de la validation d’une de ses assignations', 'superviseurs', false, m('Assignation refusée : {activite}', 'La validation de l’assignation de {nom_complet} à l’activité {activite} a été refusée.')),
  T('achevement_superviseur', 'Message de confirmation de l’achèvement du cours envoyée au superviseur', 'superviseurs', false, m('Formation terminée : {nom_complet}', '{nom_complet} a terminé l’activité de formation {activite}.', 'Voir le dossier')),
  T('licences_occurrences_superviseur', 'Message de confirmation d’assignation de licences d’occurrences à un superviseur', 'superviseurs', false, m('Licences assignées : {activite}', 'Des licences pour l’activité {activite} vous ont été assignées.')),
  T('licences_cours_superviseur', 'Message de confirmation d’assignation de licences de cours en ligne à un superviseur', 'superviseurs', false, m('Licences assignées : {activite}', 'Des licences pour le cours en ligne {activite} vous ont été assignées.')),

  // Formateurs
  T('formateur_ajoute', 'Informer les formateurs qu’ils ont été ajoutés à une occurrence', 'formateurs', false, m('Vous animez : {activite}', 'Vous avez été ajouté(e) comme formateur à l’activité {activite} ({date}).')),
  T('formateur_retire', 'Informer les formateurs qu’ils ont été retirés d’une occurrence', 'formateurs', false, m('Retiré de : {activite}', 'Vous n’animez plus l’activité {activite} ({date}).')),
  T('formateur_nouvelle_session', 'Informer les formateurs d’une nouvelle session', 'formateurs', false, m('Nouvelle séance : {activite}', 'Une nouvelle séance de l’activité {activite} a été créée ({date}).')),
  T('formateur_session_annulee', 'Informer les formateurs d’une session annulée', 'formateurs', false, m('Séance annulée : {activite}', 'La séance du {date} de l’activité {activite} est annulée.')),
  T('formateur_changement', 'Informer les formateurs d’un changement à une occurrence', 'formateurs', false, m('Changement : {activite}', 'Une séance de l’activité {activite} que vous animez a été modifiée ({date}).')),

  // Sondages
  T('invitation_sondage', 'Invitation à aller remplir le sondage', 'sondages', true, m('Votre avis sur {activite}', 'Merci pour votre participation ! Donnez-nous votre avis sur l’activité {activite} en 1 minute : vos réponses sont anonymes.', 'Répondre au sondage')),

  // Paiement / tiers
  T('paiement_facturation_attente', 'Message informant l’utilisateur que son inscription est en attente de paiement sur facturation', 'paiement', false, m('Paiement en attente : {activite}', 'Votre inscription à l’activité {activite} est en attente du paiement sur facturation.')),
  T('paiement_carte_accepte', 'Message informant l’utilisateur que son inscription est acceptée et qu’il peut procéder au paiement par carte de crédit', 'paiement', false, m('Paiement requis : {activite}', 'Votre inscription à l’activité {activite} est acceptée. Vous pouvez procéder au paiement par carte de crédit.', 'Payer')),
  T('paiement_facturation_refuse', 'Message informant l’utilisateur que le paiement sur facturation de son inscription a été refusé', 'paiement', false, m('Paiement refusé : {activite}', 'Le paiement sur facturation de votre inscription à l’activité {activite} a été refusé.')),
  T('paiement_facturation_accepte', 'Message informant l’utilisateur que le paiement sur facturation de son inscription a été accepté', 'paiement', false, m('Paiement accepté : {activite}', 'Le paiement sur facturation de votre inscription à l’activité {activite} a été accepté.')),
  T('acces_debloque_carte', 'Message informant l’utilisateur que l’accès au cours est débloqué après un paiement par carte de crédit', 'paiement', false, m('Accès débloqué : {activite}', 'Merci pour votre paiement : l’accès à l’activité {activite} est débloqué.')),
  T('courriels_paiement_inscription', 'Message de notification aux courriels de paiement sur facturation à l’inscription d’un utilisateur', 'paiement', false, m('Facturation : inscription de {nom_complet}', '{nom_complet} s’est inscrit(e) à l’activité {activite} (paiement sur facturation).')),
  T('courriels_paiement_desinscription', 'Message de notification aux courriels de paiement sur facturation à la désinscription d’un utilisateur', 'paiement', false, m('Facturation : désinscription de {nom_complet}', '{nom_complet} s’est désinscrit(e) de l’activité {activite} (paiement sur facturation).')),
  T('tiers_cours_validation', 'Message de confirmation d’une inscription à un cours en ligne acheté par un tiers nécessitant une validation', 'paiement', false, m('Inscription à valider : {activite}', 'Votre inscription à l’activité {activite}, achetée par un tiers, doit être validée.')),
  T('tiers_cours', 'Message de confirmation d’inscription à un cours en ligne acheté par un tiers', 'paiement', false, m('Inscription confirmée : {activite}', 'Votre inscription à l’activité {activite}, achetée par un tiers, est confirmée.')),
  T('tiers_occurrence_validation', 'Message de confirmation d’inscription à une occurrence achetée par un tiers nécessitant une validation', 'paiement', false, m('Inscription à valider : {activite}', 'Votre inscription à l’activité {activite}, achetée par un tiers, doit être validée.')),
  T('tiers_occurrence', 'Message de confirmation d’inscription à une occurrence achetée par un tiers', 'paiement', false, m('Inscription confirmée : {activite}', 'Votre inscription à l’activité {activite}, achetée par un tiers, est confirmée.')),
  T('tiers_completer_compte', 'Invitation à compléter son compte suite à l’achat d’un cours par un tiers', 'paiement', false, m('Complétez votre compte', 'Un cours a été acheté pour vous. Complétez votre compte pour y accéder.', 'Compléter mon compte')),
  T('tiers_accepte_paiement', 'Inscription par un tiers acceptée – Paiement requis', 'paiement', false, m('Paiement requis : {activite}', 'L’inscription par un tiers à l’activité {activite} est acceptée. Un paiement est requis.', 'Payer')),
  T('tiers_validation_refusee', 'Inscription par un tiers – validation refusée', 'paiement', false, m('Inscription refusée : {activite}', 'L’inscription par un tiers à l’activité {activite} a été refusée.')),
]

export const VARIABLES: { cle: string; aide: string }[] = [
  { cle: 'prenom', aide: 'Prénom' }, { cle: 'nom', aide: 'Nom' }, { cle: 'nom_complet', aide: 'Prénom et nom' },
  { cle: 'activite', aide: 'Nom de la formation ou de l’événement (mis en couleur)' }, { cle: 'date', aide: 'Date (échéance, séance…)' },
  { cle: 'echeance', aide: 'Phrase sur l’échéance (« À compléter avant le … »)' }, { cle: 'detail', aide: 'Précision du rappel (date d’échéance, jours restants, retard…)' }, { cle: 'progression', aide: 'Avancement en %' }, { cle: 'lieu', aide: 'Lieu de la séance' }, { cle: 'calendrier', aide: 'Lien pour ajouter la séance au calendrier' }, { cle: 'courriel', aide: 'Adresse courriel de la personne' },
]

export type ReglagesNotifications = { contact_courriel: string; contact_telephone: string; contact_libelle: string }
export const REGLAGES_DEFAUT: ReglagesNotifications = { contact_courriel: '', contact_telephone: '', contact_libelle: 'Pour nous joindre' }

export const typeDe = (cle: string) => CATALOGUE.find(t => t.cle === cle)

const echapper = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Remplace {variable} ; variable inconnue ou vide → retirée (texte brut). */
export function remplir(texte: string, vars: Record<string, string | null | undefined>): string {
  return texte.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Gabarit visuel du courriel (inspiré du modèle GrS/CMC). Renvoie aussi la version texte. */
export function rendreCourriel(p: {
  origine: string
  clinique: string | null
  /** Ligne de salutation : « Bonjour {nom_complet}, » (nom mis en couleur) ; null = titre seul */
  destinataire: string | null
  titre?: string | null
  /** Message (une ligne = un paragraphe), {activite} sera mis en couleur */
  message: string
  vars: Record<string, string | null | undefined>
  bouton?: { libelle: string; lien: string } | null
  reglages?: Partial<ReglagesNotifications>
}): { html: string; texte: string } {
  const cl = cliniquesDe(p.clinique ?? 'LES_DEUX') as Clinique[]
  const accent = cl.length === 1 ? THEME_CLINIQUE[cl[0]].accent : '#7d5a8e'
  const logos: { src: string; alt: string }[] = []
  for (const c of cl) {
    for (const part of CLINIQUE_INFO[c].partenaires ?? []) logos.push({ src: p.origine + part.logo, alt: part.nom })
    logos.push({ src: p.origine + CLINIQUE_INFO[c].logo, alt: CLINIQUE_INFO[c].nom })
  }
  const enTete = logos.map((l, i) => (i ? '<td style="padding:0 14px"><div style="width:1px;height:56px;background:#9ca3af"></div></td>' : '') + `<td><img src="${l.src}" alt="${echapper(l.alt)}" height="56" style="height:56px;border:0;display:block"></td>`).join('')
  const activite = p.vars.activite ?? ''
  const marque = '\u0000ACT\u0000'
  const brut = remplir(p.message, { ...p.vars, activite: activite ? marque : '' })
  const paragraphes = brut.split('\n').map(l => l.trim()).filter(Boolean)
  const versHtml = (l: string) => echapper(l).split(marque).join(`<span style="color:${accent};font-weight:600">${echapper(activite)}</span>`)
  const corps = paragraphes.map(l => `<p style="margin:0 0 14px;font-size:17px;line-height:1.55;color:#1f2937">${versHtml(l)}</p>`).join('')
  const salut = p.destinataire
    ? `<h1 style="margin:0 0 36px;font-size:26px;font-weight:600;color:#111827">Bonjour <span style="color:${accent}">${echapper(p.destinataire)}</span>,</h1>`
    : p.titre ? `<h1 style="margin:0 0 28px;font-size:24px;font-weight:600;color:#111827">${echapper(p.titre)}</h1>` : ''
  const r = { ...REGLAGES_DEFAUT, ...(p.reglages ?? {}) }
  const btn = p.bouton ? `
<tr><td style="background:#e5e7eb;padding:40px 32px;text-align:center">
  <p style="margin:0 0 22px;font-size:16px;color:#1f2937">Vous pouvez consulter cette activité<br>en cliquant sur le lien suivant :</p>
  <a href="${p.bouton.lien}" style="display:inline-block;background:#3f3f46;color:${accent === '#7d5a8e' ? '#d8c4e2' : '#ffffff'};text-decoration:none;font-weight:600;font-size:16px;padding:13px 26px;border-radius:999px">${echapper(p.bouton.libelle)}</a>
  <p style="margin:18px 0 0;font-size:11px;color:#6b7280;word-break:break-all">${echapper(p.bouton.lien)}</p>
</td></tr>` : ''
  const contact = r.contact_courriel || r.contact_telephone
    ? `<td width="50%" style="background:#d1d5db;padding:22px 20px;font-size:13px;color:#111827;vertical-align:top">${echapper(r.contact_libelle || 'Pour nous joindre')}<br>${r.contact_courriel ? `<a href="mailto:${echapper(r.contact_courriel)}" style="color:#111827;font-size:15px">${echapper(r.contact_courriel)}</a><br>` : ''}${echapper(r.contact_telephone)}</td>`
    : ''
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:'Trebuchet MS',Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td align="center" style="padding:8px 24px 18px;border-bottom:1px solid #e5e7eb"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${enTete}</tr></table></td></tr>
<tr><td style="padding:48px 40px 40px">${salut}${corps}</td></tr>${btn}
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="background:#f3f4f6;padding:22px 32px;font-size:15px;color:#111827;vertical-align:middle">Merci de ne pas répondre<br>à ce message généré<br>automatiquement.</td>${contact}
</tr></table></td></tr>
</table></td></tr></table></body></html>`
  const texte = [p.destinataire ? `Bonjour ${p.destinataire},` : (p.titre ?? ''), '', ...remplir(p.message, p.vars).split('\n').filter(Boolean),
    ...(p.bouton ? ['', `${p.bouton.libelle} : ${p.bouton.lien}`] : []), '', 'Merci de ne pas répondre à ce message généré automatiquement.',
    ...(r.contact_courriel || r.contact_telephone ? [`${r.contact_libelle} : ${[r.contact_courriel, r.contact_telephone].filter(Boolean).join(' · ')}`] : [])].join('\n')
  return { html, texte }
}
