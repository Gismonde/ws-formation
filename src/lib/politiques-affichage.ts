// Affichage du public visé par une politique (client + serveur).
import { CLINIQUE_EMPLOYE_LABEL, CliniqueEmploye } from '@/lib/cliniques'

type P = { clinique: CliniqueEmploye; departements: string[] }

export function publicDe(p: P, noms: Map<string, string>) {
  const cl = CLINIQUE_EMPLOYE_LABEL[p.clinique] ?? p.clinique
  if (!p.departements?.length) return `${cl} — toute la clinique`
  const liste = p.departements.map(d => noms.get(d) ?? '?')
  return `${cl} — ${liste.length > 3 ? `${liste.slice(0, 3).join(', ')} +${liste.length - 3}` : liste.join(', ')}`
}

