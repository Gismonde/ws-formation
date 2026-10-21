// Sélection des voix de lecture audio : seulement des voix naturelles et professionnelles,
// dans la langue de l'interface. Les voix « fantaisie » (effets, chuchotement, robot…) et les
// anciennes voix synthétiques (Eloquence) sont retirées.

const FANTAISIE = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged', 'good news', 'hysterical', 'jester',
  'organ', 'pipe organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'fred', 'junior', 'kathy', 'ralph',
  'princess', 'agnes', 'bruce', 'vicki', 'victoria',
  // Eloquence (voix synthétiques anciennes, au son robotique)
  'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley', 'grand-mère', 'grand-père',
]

/** Voix acceptable : pas une voix fantaisie ni Eloquence. */
export function voixProfessionnelle(nom: string): boolean {
  const n = nom.toLowerCase().replace(/\(.*?\)/g, ' ')
  return !FANTAISIE.some(f => new RegExp(`(^|\\s)${f}(\\s|$)`).test(n.trim()) || n.trim().startsWith(f + ' '))
}

/** Score de qualité : voix neuronales / améliorées d'abord. */
export function scoreVoix(nom: string, local: boolean): number {
  const n = nom.toLowerCase()
  let s = 0
  if (/natural|neural|naturelle/.test(n)) s += 40
  if (/premium|enhanced|améliorée|amélioré/.test(n)) s += 30
  if (/online|google|microsoft/.test(n)) s += 20
  if (local) s += 1
  return s
}

type Voix = { name: string; lang: string; localService: boolean }

/** Voix proposées pour une langue (fr / en), triées de la meilleure à la moins bonne. */
export function voixPour<T extends Voix>(toutes: T[], langue: 'fr' | 'en'): T[] {
  const dansLaLangue = toutes.filter(v => v.lang.toLowerCase().startsWith(langue) && voixProfessionnelle(v.name))
  const liste = dansLaLangue.length ? dansLaLangue : toutes.filter(v => voixProfessionnelle(v.name))
  // Canada d'abord pour le français, puis qualité
  const region = (v: Voix) => (langue === 'fr' && /ca/i.test(v.lang) ? 5 : 0)
  return [...liste].sort((a, b) => (scoreVoix(b.name, b.localService) + region(b)) - (scoreVoix(a.name, a.localService) + region(a)) || a.name.localeCompare(b.name))
}
