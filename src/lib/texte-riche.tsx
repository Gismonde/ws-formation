// Mise en forme légère et sûre des blocs texte (aucun HTML injecté) :
//   **gras**, *italique*, listes « - » ou « • », listes numérotées « 1. », paragraphes.
import React from 'react'

function enLigne(texte: string, cle: string): React.ReactNode[] {
  const morceaux: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g
  let dernier = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(texte))) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index))
    const t = m[0]
    morceaux.push(t.startsWith('**')
      ? <strong key={`${cle}-${i++}`}>{t.slice(2, -2)}</strong>
      : <em key={`${cle}-${i++}`}>{t.slice(1, -1)}</em>)
    dernier = m.index + t.length
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier))
  return morceaux
}

export function TexteRiche({ texte }: { texte: string }) {
  const lignes = texte.replace(/\r\n/g, '\n').split('\n')
  const blocs: React.ReactNode[] = []
  let liste: { type: 'ul' | 'ol'; items: string[] } | null = null
  let paragraphe: string[] = []

  const viderParagraphe = () => {
    if (paragraphe.length) {
      const k = 'p' + blocs.length
      blocs.push(<p key={k} className="mb-3 last:mb-0">{paragraphe.flatMap((l, i) => i ? [<br key={k + i} />, ...enLigne(l, k + i)] : enLigne(l, k + i))}</p>)
      paragraphe = []
    }
  }
  const viderListe = () => {
    if (liste) {
      const k = 'l' + blocs.length
      const items = liste.items.map((it, i) => <li key={k + i}>{enLigne(it, k + i)}</li>)
      blocs.push(liste.type === 'ul'
        ? <ul key={k} className="list-disc pl-6 mb-3 space-y-1">{items}</ul>
        : <ol key={k} className="list-decimal pl-6 mb-3 space-y-1">{items}</ol>)
      liste = null
    }
  }

  for (const ligne of lignes) {
    const puce = ligne.match(/^\s*[-•]\s+(.*)$/)
    const num = ligne.match(/^\s*\d+[.)]\s+(.*)$/)
    if (puce || num) {
      viderParagraphe()
      const type = puce ? 'ul' : 'ol'
      if (!liste || liste.type !== type) { viderListe(); liste = { type, items: [] } }
      liste.items.push((puce ?? num)![1])
    } else if (!ligne.trim()) {
      viderParagraphe(); viderListe()
    } else {
      viderListe(); paragraphe.push(ligne)
    }
  }
  viderParagraphe(); viderListe()
  return <>{blocs}</>
}

export const STYLES_ENCADRE: Record<string, { libelle: string; icone: string; fond: string; bord: string; titre: string }> = {
  normal: { libelle: 'Texte', icone: '📝', fond: '#ffffff', bord: '#e5e7eb', titre: '#111827' },
  a_retenir: { libelle: 'À retenir', icone: '💡', fond: '#eff6ff', bord: '#bfdbfe', titre: '#1d4ed8' },
  attention: { libelle: 'Attention', icone: '⚠️', fond: '#fff7ed', bord: '#fed7aa', titre: '#c2410c' },
  procedure: { libelle: 'Procédure', icone: '✅', fond: '#f0fdf4', bord: '#bbf7d0', titre: '#15803d' },
  // Couleurs de la clinique de la formation (CMC : taupe, WSSC : marine) ; violet pour une formation commune sans clinique connue
  clinique: { libelle: 'Aux couleurs de la clinique', icone: '🏥', fond: '#f5f3ff', bord: '#8b5cf6', titre: '#5b21b6' },
}

/** Style d'encadré, avec les couleurs de la clinique pour l'encadré « clinique » */
export function styleEncadre(style: string, theme?: { couleur: string; fond: string } | null) {
  const s = STYLES_ENCADRE[style] ?? STYLES_ENCADRE.normal
  return style === 'clinique' && theme ? { ...s, fond: theme.fond, bord: theme.couleur, titre: theme.couleur } : s
}
