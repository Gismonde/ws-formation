// Affichage du public visé par une politique (client + serveur).
import { CLINIQUE_EMPLOYE_LABEL, CliniqueEmploye } from '@/lib/cliniques'

type P = { clinique: CliniqueEmploye; departements: string[]; employes?: string[] | null }

export function publicDe(p: P, noms: Map<string, string>) {
  const cl = CLINIQUE_EMPLOYE_LABEL[p.clinique] ?? p.clinique
  const nbEmployes = p.employes?.length ?? 0
  if (!p.departements?.length && !nbEmployes) return `${cl} — toute la clinique`
  const liste = (p.departements ?? []).map(d => noms.get(d) ?? '?')
  const depts = liste.length > 3 ? `${liste.slice(0, 3).join(', ')} +${liste.length - 3}` : liste.join(', ')
  const emps = nbEmployes ? `${nbEmployes} employé(s) désigné(s)` : ''
  return `${cl} — ${[depts, emps].filter(Boolean).join(' + ')}`
}
