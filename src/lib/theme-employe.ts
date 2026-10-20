// Thème visuel (couleurs, logo, nom) de l'espace employé actif : CMC ou WSSC. Côté serveur.
import { getActeur } from '@/lib/permissions'
import { getEspace, type Espace } from '@/lib/espace'
import { THEME_CLINIQUE, THEME_NEUTRE, variablesTheme, type ThemeClinique } from '@/lib/cliniques'

export async function themeEmploye(): Promise<{ espace: Espace; theme: ThemeClinique; variables: Record<string, string> }> {
  const acteur = await getActeur()
  const espace = await getEspace(acteur)
  const theme = espace.actif ? THEME_CLINIQUE[espace.actif] : THEME_NEUTRE
  return { espace, theme, variables: variablesTheme(theme) }
}
