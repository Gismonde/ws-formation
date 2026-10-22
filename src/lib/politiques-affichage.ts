// Affichage du public visé par une politique (client + serveur).
import { CLINIQUE_EMPLOYE_LABEL, CliniqueEmploye } from '@/lib/cliniques'

type P = { clinique: CliniqueEmploye; departements: string[]; employes?: string[] | null; roles?: string[] | null; postes?: string[] | null }
type Trad = (s: string, v?: Record<string, string | number>) => string

const ident: Trad = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? ''))

export function publicDe(p: P, noms: Map<string, string>, t: Trad = ident) {
  const cl = CLINIQUE_EMPLOYE_LABEL[p.clinique] ?? p.clinique
  const parts: string[] = []
  const liste = (p.departements ?? []).map(d => noms.get(d) ?? '?')
  if (liste.length) parts.push(liste.length > 3 ? `${liste.slice(0, 3).join(', ')} +${liste.length - 3}` : liste.join(', '))
  const roles = (p.roles ?? []).map(r => (r === 'gestionnaire' ? t('Gestionnaires') : r === 'admin' ? t('Administrateurs') : r))
  if (roles.length) parts.push(roles.join(', '))
  const postes = p.postes ?? []
  if (postes.length) parts.push(postes.length > 2 ? `${postes.slice(0, 2).join(', ')} +${postes.length - 2}` : postes.join(', '))
  const nb = p.employes?.length ?? 0
  if (nb) parts.push(t('{n} employé(s) désigné(s)', { n: nb }))
  if (!parts.length) return `${cl} — ${t('toute la clinique')}`
  return `${cl} — ${parts.join(' + ')}`
}
