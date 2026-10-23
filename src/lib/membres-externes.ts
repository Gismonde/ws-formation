// Membres externes (côté CMC) : personnes qui ne sont pas employées de la clinique
// (partenaires, stagiaires, sous-traitants…) mais qui suivent les formations.
// Elles ont exactement les fonctions et autorisations d'un employé : rôle « employe »,
// avec un simple marqueur « externe » et le nom de leur organisation.

/** Le statut externe est offert pour les membres du CMC (ou des deux cliniques). */
export function externeOffert(clinique: string | null | undefined): boolean {
  return clinique === 'CMC' || clinique === 'LES_DEUX'
}

/** Valeurs à enregistrer (fonction pure, testée). Hors CMC ou pour un autre rôle qu'employé : pas externe. */
export function valeursExterne(
  demande: { externe?: unknown; organisation?: unknown },
  role: string, clinique: string | null | undefined,
): { externe: boolean; organisation: string | null } {
  const externe = demande.externe === true && role === 'employe' && externeOffert(clinique)
  const org = typeof demande.organisation === 'string' ? demande.organisation.trim().slice(0, 120) : ''
  return { externe, organisation: externe && org ? org : null }
}
