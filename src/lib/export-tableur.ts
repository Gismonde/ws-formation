// Exports tableur (Excel .xlsx et CSV) côté serveur, pour les rapports de conformité et d'audit.
// CSV : séparateur « ; » et BOM UTF-8, pour qu'Excel (paramètres régionaux français) l'ouvre correctement.
import ExcelJS from 'exceljs'

export type Colonne<T> = {
  titre: string
  valeur: (ligne: T) => string | number | Date | null | undefined
  /** Largeur en caractères (Excel) */
  largeur?: number
}

export type Feuille<T> = { nom: string; colonnes: Colonne<T>[]; lignes: T[] }

/** Nom d'onglet Excel valide : 31 caractères max, sans \ / ? * [ ] :, unique dans le classeur. */
export function nomOnglet(nom: string, dejaPris: Set<string>): string {
  const base = (nom.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim() || 'Feuille').slice(0, 31)
  let candidat = base
  for (let i = 2; dejaPris.has(candidat.toLowerCase()); i++) {
    const suffixe = ` (${i})`
    candidat = base.slice(0, 31 - suffixe.length) + suffixe
  }
  dejaPris.add(candidat.toLowerCase())
  return candidat
}

/** Classeur Excel : une feuille par entrée, en-tête en gras figé, filtres automatiques. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function classeurExcel(feuilles: Feuille<any>[], meta?: { titre?: string; auteur?: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = meta?.auteur ?? 'WS Formation'
  wb.created = new Date()
  if (meta?.titre) wb.title = meta.titre
  const pris = new Set<string>()
  for (const f of feuilles) {
    const ws = wb.addWorksheet(nomOnglet(f.nom, pris), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = f.colonnes.map(c => ({ header: c.titre, width: c.largeur ?? Math.max(12, c.titre.length + 2) }))
    for (const l of f.lignes) ws.addRow(f.colonnes.map(c => c.valeur(l) ?? ''))
    const entete = ws.getRow(1)
    entete.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    entete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
    entete.alignment = { vertical: 'middle' }
    if (f.colonnes.length > 0) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: f.colonnes.length } }
    }
  }
  if (feuilles.length === 0) wb.addWorksheet('Vide')
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function celluleCsv(v: string | number | Date | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  // Neutralise les formules (injection CSV) et protège les séparateurs
  const sur = /^[=+\-@\t\r]/.test(s) ? "'" + s : s
  return /[;"\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fichierCsv<T>(colonnes: Colonne<T>[], lignes: T[]): string {
  const entete = colonnes.map(c => celluleCsv(c.titre)).join(';')
  const corps = lignes.map(l => colonnes.map(c => celluleCsv(c.valeur(l))).join(';'))
  return '﻿' + [entete, ...corps].join('\r\n')
}

/** Nom de fichier sûr : lettres, chiffres, tirets. */
export function nomFichier(base: string, extension: string): string {
  const propre = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${propre || 'export'}-${new Date().toISOString().slice(0, 10)}.${extension}`
}

/** Réponse HTTP de téléchargement. */
export function reponseFichier(contenu: Buffer | string, nom: string): Response {
  const type = nom.endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : nom.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/octet-stream'
  const corps = typeof contenu === 'string' ? contenu : new Uint8Array(contenu)
  return new Response(corps, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${nom}"`,
      'Cache-Control': 'no-store',
    },
  })
}
