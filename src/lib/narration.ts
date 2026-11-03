// Narration audio des leçons.
// Chaque bloc peut porter metadata.narration : un texte lu à voix haute mais jamais affiché
// (ex. une image seule, commentée par la voix). Sans narration, un bloc de texte est lu tel quel.

type BlocLu = { type: string; contenu?: string | null; metadata?: Record<string, unknown> | null }

/** Texte de narration d'un bloc (non affiché), ou null. */
export function narrationDe(b: BlocLu): string | null {
  const n = b.metadata?.narration
  return typeof n === 'string' && n.trim() ? n.trim() : null
}

/** Nettoie le Markdown / HTML pour la synthèse vocale. */
export function texteParlable(brut: string): string {
  return brut
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[ \t]*[-*•][ \t]+/gm, '')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/[#*_>`~|]/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim()
}

/** Ce que la voix lit pour une suite de blocs : la narration si elle existe, sinon le texte affiché. */
export function texteAudio(blocs: BlocLu[], intro?: string | null): string {
  const parties = [intro ?? '']
  for (const b of blocs) {
    const n = narrationDe(b)
    if (n) parties.push(n)
    else if (b.type === 'text' && b.contenu) parties.push(b.contenu)
  }
  return parties.map(p => texteParlable(p)).filter(Boolean).join(' ')
}

/** Découpe en morceaux d'environ `max` caractères, aux fins de phrase (certains navigateurs coupent les longues lectures). */
export function morceaux(texte: string, max = 220): string[] {
  const phrases = texte.match(/[^.!?…]+[.!?…]+["»)]*\s*|[^.!?…]+$/g) ?? [texte]
  const out: string[] = []
  let courant = ''
  for (const p of phrases) {
    if ((courant + p).length > max && courant) { out.push(courant.trim()); courant = '' }
    if (p.length > max) {
      for (const mot of p.split(/\s+/)) {
        if ((courant + ' ' + mot).length > max && courant) { out.push(courant.trim()); courant = '' }
        courant += (courant ? ' ' : '') + mot
      }
    } else courant += p
  }
  if (courant.trim()) out.push(courant.trim())
  return out
}
