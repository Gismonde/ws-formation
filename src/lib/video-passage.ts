// Passage d'une vidéo (début / fin) et questions en cours de vidéo : lecture, validation, affichage des temps.

export type QuestionVideo = { id: string; temps: number; question: string; choix: string[]; bonne: number; explication?: string }

/** « 2:15 », « 1:02:03 », « 135 » ou « 2m15 » → secondes (null si invalide). */
export function lireTemps(texte: string): number | null {
  const s = texte.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s))
  const hms = s.match(/^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)s?)?$/)
  if (hms && (hms[1] || hms[2])) return (Number(hms[1] ?? 0) * 3600) + (Number(hms[2] ?? 0) * 60) + Number(hms[3] ?? 0)
  const parties = s.split(':')
  if (parties.length < 2 || parties.length > 3 || parties.some(p => !/^\d+$/.test(p))) return null
  const n = parties.map(Number)
  if (n.slice(1).some(x => x >= 60)) return null
  return n.reduce((acc, x) => acc * 60 + x, 0)
}

/** 135 → « 2:15 », 3723 → « 1:02:03 ». */
export function ecrireTemps(secondes: number | null | undefined): string {
  if (secondes == null || !Number.isFinite(secondes)) return ''
  const t = Math.max(0, Math.round(secondes))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const deux = (x: number) => String(x).padStart(2, '0')
  return h ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`
}

export type Passage = { debut: number; fin: number | null }

/** Passage valide lu dans les métadonnées du bloc (null = vidéo entière). */
export function passageDe(meta: Record<string, unknown> | null | undefined): Passage | null {
  const p = meta?.passage as { debut?: unknown; fin?: unknown } | undefined
  if (!p) return null
  const debut = Number(p.debut ?? 0), fin = p.fin == null ? null : Number(p.fin)
  if (!Number.isFinite(debut) || debut < 0) return null
  if (fin !== null && (!Number.isFinite(fin) || fin <= debut)) return null
  if (debut === 0 && fin === null) return null
  return { debut, fin }
}

/** Questions valides, triées par temps (dans le passage s'il y en a un). */
export function questionsDe(meta: Record<string, unknown> | null | undefined): QuestionVideo[] {
  const brut = Array.isArray(meta?.questions_video) ? (meta!.questions_video as QuestionVideo[]) : []
  const p = passageDe(meta)
  return brut
    .filter(q => q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.choix)
      && q.choix.filter(c => String(c).trim()).length >= 2 && Number.isInteger(q.bonne) && q.bonne >= 0 && q.bonne < q.choix.length
      && Number.isFinite(q.temps) && q.temps >= 0)
    .filter(q => !p || (q.temps >= p.debut && (p.fin === null || q.temps <= p.fin)))
    .sort((a, b) => a.temps - b.temps)
}

/** Durée à regarder : le passage, ou toute la vidéo. */
export function dureeARegarder(passage: Passage | null, dureeTotale: number): number {
  if (!passage) return dureeTotale
  return Math.max(0, (passage.fin ?? dureeTotale) - passage.debut)
}

/** Première question pas encore répondue dont le moment est atteint. */
export function questionAPoser(questions: QuestionVideo[], repondues: string[], temps: number): QuestionVideo | null {
  return questions.find(q => !repondues.includes(q.id) && temps >= q.temps) ?? null
}
