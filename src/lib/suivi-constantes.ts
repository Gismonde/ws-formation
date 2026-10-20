export const TEXTE_ATTESTATION_DEFAUT = "J'ai lu et compris le contenu de cette leçon et je m'engage à l'appliquer."
export const TEXTE_ATTESTATION_DEFAUT_EN = 'I have read and understood the content of this lesson and I agree to apply it.'

/** Engagement par défaut dans la langue de l'employé (le texte affiché est celui conservé comme preuve). */
export function texteAttestationDefaut(langue: 'fr' | 'en'): string {
  return langue === 'en' ? TEXTE_ATTESTATION_DEFAUT_EN : TEXTE_ATTESTATION_DEFAUT
}
