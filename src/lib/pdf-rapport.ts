// Rapports PDF (conformité, rapports, audit) générés côté serveur avec jsPDF.
// Polices standard (Helvetica, encodage WinAnsi) : accents français, « », ’ et tirets pris en charge ;
// les autres caractères (émojis, etc.) sont retirés pour ne pas produire de texte illisible.
import { jsPDF } from 'jspdf'
import { autoTable, type RowInput } from 'jspdf-autotable'

export type SectionPdf = {
  titre?: string
  sousTitre?: string
  entetes: string[]
  lignes: (string | number | null | undefined)[][]
  /** Largeurs relatives des colonnes (facultatif) */
  largeurs?: number[]
}

export type RapportPdf = {
  titre: string
  sousTitre?: string
  perimetre?: string
  genere_par?: string
  indicateurs?: [string, string | number][]
  sections: SectionPdf[]
  paysage?: boolean
}

// Caractères hors WinAnsi (cp1252) remplacés ou retirés
export function textePdf(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/[✓✔]/g, 'Oui')
    .replace(/[→]/g, '->')
    .replace(/[^\u0000-ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const GRIS = [107, 114, 128] as const
const FONCE = [17, 24, 39] as const

export function genererPdf(r: RapportPdf): Buffer {
  const doc = new jsPDF({ orientation: r.paysage === false ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' })
  const largeur = doc.internal.pageSize.getWidth()
  const marge = 14
  let y = 18

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...FONCE)
  doc.text(textePdf(r.titre), marge, y)
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GRIS)
  const meta = [
    r.sousTitre,
    r.perimetre ? `Périmètre : ${r.perimetre}` : null,
    `Généré le ${new Date().toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Toronto' })}${r.genere_par ? ` par ${r.genere_par}` : ''}`,
  ].filter(Boolean) as string[]
  for (const m of meta) { doc.text(textePdf(m), marge, y); y += 4.5 }
  y += 2

  if (r.indicateurs?.length) {
    const n = r.indicateurs.length
    const l = (largeur - marge * 2 - (n - 1) * 3) / n
    r.indicateurs.forEach(([libelle, valeur], i) => {
      const x = marge + i * (l + 3)
      doc.setDrawColor(229, 231, 235).setFillColor(249, 250, 251).roundedRect(x, y, l, 15, 2, 2, 'FD')
      doc.setFontSize(7.5).setTextColor(...GRIS).text(textePdf(libelle), x + 3, y + 5, { maxWidth: l - 6 })
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...FONCE).text(textePdf(valeur), x + 3, y + 12)
      doc.setFont('helvetica', 'normal')
    })
    y += 21
  }

  for (const s of r.sections) {
    if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 18 }
    if (s.titre) {
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...FONCE).text(textePdf(s.titre), marge, y)
      doc.setFont('helvetica', 'normal')
      y += 2
      if (s.sousTitre) { doc.setFontSize(8.5).setTextColor(...GRIS).text(textePdf(s.sousTitre), marge, y + 3.5); y += 4 }
    }
    const total = s.largeurs?.reduce((a, b) => a + b, 0)
    const dispo = largeur - marge * 2
    autoTable(doc, {
      startY: y + 2,
      head: [s.entetes.map(textePdf)],
      body: (s.lignes.length ? s.lignes.map(l => l.map(textePdf)) : [[{ content: 'Aucune donnée', colSpan: s.entetes.length, styles: { halign: 'center', textColor: [156, 163, 175] } }]]) as RowInput[],
      margin: { left: marge, right: marge },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, overflow: 'linebreak', textColor: [55, 65, 81] },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: total ? Object.fromEntries(s.largeurs!.map((w, i) => [i, { cellWidth: (w / total) * dispo }])) : undefined,
    })
    // @ts-expect-error lastAutoTable est ajouté par le greffon
    y = (doc.lastAutoTable?.finalY ?? y) + 8
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5).setTextColor(...GRIS)
    const h = doc.internal.pageSize.getHeight()
    doc.text('WS Formation — document confidentiel (Loi 25)', marge, h - 7)
    doc.text(`Page ${p} / ${pages}`, largeur - marge, h - 7, { align: 'right' })
  }
  return Buffer.from(doc.output('arraybuffer'))
}

export function reponsePdf(contenu: Buffer, nom: string): Response {
  return new Response(new Uint8Array(contenu), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nom}"`,
      'Cache-Control': 'no-store',
    },
  })
}
