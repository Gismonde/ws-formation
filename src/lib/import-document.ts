// Lecture d'un document (texte extrait d'un PDF, .txt, .md) en modules et leçons, avec déduction des métadonnées.

export interface BlocData {
  type: 'video' | 'file' | 'code' | 'link'
  contenu: string
}

export interface LeconData {
  titre: string
  description: string
  image_url?: string
  blocs?: BlocData[]
  duree_minutes?: number
}

export interface ModuleData {
  titre: string
  contenu: string
  duree_minutes: number
  lecons: LeconData[]
}


// ---- Auto-inference of formation metadata from document content ----
export function inferMetadata(text: string, titre: string, modules: ModuleData[]): {
  categorie: string
  niveau: string
  tags: string[]
  objectifs: string[]
} {
  const fullText = (titre + ' ' + text).toLowerCase()
  const moduleTitles = modules.map(m => m.titre).join(' ').toLowerCase()
  const combined = fullText + ' ' + moduleTitles

  // --- Category detection ---
  const categoryKeywords: Record<string, string[]> = {
    'Hygiène et sécurité': ['hygiène', 'hygiene', 'sécurité', 'securite', 'nettoyage', 'désinfection', 'stérilisation', 'epi', 'risque', 'accident', 'incendie'],
    'Gestion des soins': ['soin', 'patient', 'infirmier', 'médecin', 'clinique', 'traitement', 'médicament', 'diagnostic', 'chirurgie', 'soignant'],
    'Communication': ['communication', 'communiquer', 'écoute', 'message', 'relation', 'verbal', 'empathie', 'assertivité', 'feedback'],
    'Ressources humaines': ['ressources humaines', 'recrutement', 'entretien', 'congé', 'compétence', 'évaluation', 'onboarding'],
    'Qualité et conformité': ['qualité', 'conformité', 'iso', 'audit', 'certification', 'norme', 'protocole', 'accréditation', 'traçabilité'],
    'Informatique et systèmes': ['informatique', 'logiciel', 'système', 'numérique', 'excel', 'erp', 'réseau', 'cybersécurité', 'rgpd'],
    'Administration médicale': ['administrative', 'administration', 'dossier', 'facturation', 'codification', 'pmsi', 'assurance', 'admission'],
    'Gestion des risques': ['danger', 'précaution', 'prévention', 'vigilance', 'incident', 'événement indésirable'],
    'Formation du personnel': ['habilitation', 'tutorat', 'stagiaire', 'e-learning'],
  }

  let bestCategorie = ''
  let bestScore = 0
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    const score = keywords.reduce((acc, kw) => acc + (combined.split(kw).length - 1), 0)
    if (score > bestScore) { bestScore = score; bestCategorie = cat }
  }

  // --- Level detection ---
  let niveau = 'debutant'
  if (/avancé|expert|spécialis|niveau\s*3|senior|complexe/i.test(combined)) niveau = 'avance'
  else if (/intermédiaire|confirmé|niveau\s*2|approfondissement|perfectionnement/i.test(combined)) niveau = 'intermediaire'

  // --- Tags from title + module titles ---
  const stopWords = new Set(['de','du','des','le','la','les','un','une','et','ou','à','au','avec','pour','dans','sur','par','en','est','sont','cette','ce','ses','leur','leurs','qui','que','les','par','une'])
  const tagSource = (titre + ' ' + moduleTitles).replace(/[^a-zàâäéèêëîïôöùûüç\s]/gi, ' ')
  const wordFreq: Record<string, number> = {}
  tagSource.toLowerCase().split(/\s+/).forEach(w => {
    if (w.length >= 4 && !stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1
  })
  const tags = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w.charAt(0).toUpperCase() + w.slice(1))

  // --- Objectives from document text ---
  const objectifs: string[] = []
  const objRegex = /(?:objectif[s]?\s*:?\s*|l['\'']apprenant\s+(?:sera|pourra|saura|maîtrisera|comprendra)|vous\s+(?:saurez|pourrez|comprendrez|maîtriserez))([^.!?\n]{10,120})/gi
  let match
  while ((match = objRegex.exec(text)) !== null && objectifs.length < 4) {
    const obj = match[1]?.trim()
    if (obj && obj.length > 10) objectifs.push(obj.charAt(0).toUpperCase() + obj.slice(1))
  }
  if (objectifs.length === 0) {
    modules.slice(0, 3).forEach(m => { if (m.titre?.length > 5) objectifs.push('Maîtriser : ' + m.titre) })
  }

  return { categorie: bestCategorie, niveau, tags, objectifs }
}

export function parseDocumentIntoModules(text: string): { titre: string; description: string; modules: ModuleData[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

  // --- Detect PowerPoint PDF format (=== Diapositive markers added by PDF extractor) ---
  const slidePattern = /^===\s*Diapositive\s+(\d+)\s*\/\s*(\d+)\s*===$/i
  const isPptPdf = lines.some(l => slidePattern.test(l))

  if (isPptPdf) {
    // ---- Parse individual slides ----
    const slides: Array<{ num: number; total: number; content: string[] }> = []
    let currentSlide: { num: number; total: number; content: string[] } | null = null

    // Patterns to skip: page numbers, "Narration" headers, repetitive footers
    const skipLine = (line: string) =>
      /^Narration\s*:?$/i.test(line) ||
      /^Diapositive\s+\d+\s*\/\s*\d+$/i.test(line) ||
      /^\d+\s*\/\s*\d+$/.test(line) ||
      /^\[.*\]$/.test(line) ||
      line.length < 2

    for (const line of lines) {
      const m = slidePattern.exec(line)
      if (m) {
        if (currentSlide) slides.push(currentSlide)
        currentSlide = { num: parseInt(m[1]), total: parseInt(m[2]), content: [] }
      } else if (currentSlide) {
        if (!skipLine(line)) {
          currentSlide.content.push(line)
        }
      }
    }
    if (currentSlide) slides.push(currentSlide)

    if (slides.length === 0) {
      return { titre: 'Formation sans titre', description: '', modules: [{ titre: 'Module 1', contenu: '', duree_minutes: 30, lecons: [] }] }
    }

    // ---- Extract doc title and description from first slide ----
    const firstContent = slides[0]?.content ?? []
    const docTitle = firstContent[0]?.substring(0, 100) ?? 'Formation'
    let docDescription = firstContent.slice(1, 4).join(' ').substring(0, 200)

    // ---- Detect section-title slides as module boundaries ----
    // A "title slide" has short content (≤3 lines) AND first line is ≤60 chars
    // OR the first line is ALL-CAPS (section header style)
    const isTitleSlide = (slide: { num: number; total: number; content: string[] }) => {
      const c = slide.content
      if (c.length === 0) return false
      const firstLine = c[0]
      if (firstLine.length > 80) return false
      // Short slide with few lines
      if (c.length <= 2 && firstLine.length <= 60) return true
      // ALL CAPS heading
      if (/^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ\s\d:.,\-–—]{4,}$/.test(firstLine)) return true
      // Numbered section (e.g. "1. Introduction", "Section 2 -")
      if (/^(\d+[.)]\s+|[IVXLCDM]+\.\s+|Section\s+\d+|Chapitre\s+\d+|Module\s+\d+|Partie\s+\d+)/i.test(firstLine)) return true
      return false
    }

    // ---- Group slides into modules ----
    // Strategy: slides that look like "title slides" start a new module
    // Skip slide 1 (document title slide) — start grouping from slide 2
    const contentSlides = slides.slice(1) // skip title slide

    const moduleGroups: Array<{ title: string; slides: typeof contentSlides }> = []
    let currentGroup: { title: string; slides: typeof contentSlides } | null = null

    for (const slide of contentSlides) {
      if (isTitleSlide(slide) || currentGroup === null) {
        if (currentGroup) moduleGroups.push(currentGroup)
        currentGroup = { title: slide.content[0]?.substring(0, 80) ?? ('Section ' + slide.num), slides: [] }
        // Don't add the title slide itself as a lesson if it has no body content
        if (slide.content.length > 1) {
          currentGroup.slides.push(slide)
        }
      } else {
        currentGroup.slides.push(slide)
      }
    }
    if (currentGroup) moduleGroups.push(currentGroup)

    // ---- Fallback: if no section boundaries found, split evenly ----
    const finalGroups = moduleGroups.length > 0 && moduleGroups.some(g => g.slides.length > 0)
      ? moduleGroups
      : (() => {
          const numMod = Math.max(1, Math.round(contentSlides.length / 5))
          const perMod = Math.ceil(contentSlides.length / numMod)
          const fallback: typeof moduleGroups = []
          for (let i = 0; i < contentSlides.length; i += perMod) {
            const chunk = contentSlides.slice(i, i + perMod)
            const modNum = fallback.length + 1
            fallback.push({
              title: chunk[0]?.content[0]?.substring(0, 80) ?? ('Module ' + modNum),
              slides: chunk,
            })
          }
          return fallback
        })()

    // ---- Build ModuleData array ----
    const pptModules: ModuleData[] = finalGroups.map((group, gi) => {
      const lecons: LeconData[] = group.slides.map(slide => {
        const sc = slide.content
        // Find best title: first non-empty line that is not a repetition of the module title
        const rawTitle = sc[0]?.substring(0, 80) ?? ('Diapositive ' + slide.num)
        // Build description from remaining lines
        const desc = sc.slice(1).join('\n').substring(0, 500)
        return { titre: rawTitle, description: desc, duree_minutes: 5 }
      })

      const contenu = group.slides.map(s => s.content.join('\n')).join('\n\n')
      const moduleNum = gi + 1
      return {
        titre: group.title || ('Module ' + moduleNum),
        contenu: contenu.substring(0, 1000),
        duree_minutes: Math.max(15, lecons.length * 5),
        lecons,
      }
    })

    // Enrich description with module titles
    const modulesTitles = pptModules.map(m => m.titre).filter(t => t).slice(0, 6).join(', ')
    if (modulesTitles) {
      const intro = docDescription ? docDescription + ' ' : ''
      docDescription = (intro + 'Cette formation aborde ' + pptModules.length + ' module' + (pptModules.length > 1 ? 's' : '') + ' : ' + modulesTitles + '.').substring(0, 600)
    }
    return { titre: docTitle, description: docDescription, modules: pptModules }
  }

  // --- Standard document parsing (txt, md, etc.) ---
  let docTitle = ''
  let docDescription = ''
  const modules: ModuleData[] = []

  const isHeading = (line: string) => {
    return (
      /^#{1,3}\s+.+/.test(line) ||
      /^\d+\.\s+.{3,}/.test(line) ||
      /^[A-Z][A-Z\s]{4,}:?$/.test(line) ||
      /^={3,}|-{3,}/.test(line) ||
      /^(Section|Chapitre|Partie|Module|Étape|Step|Article)\s+\d+/i.test(line)
    )
  }

  const cleanHeading = (line: string) =>
    line.replace(/^#{1,3}\s+/, '').replace(/^\d+\.\s+/, '').replace(/:$/, '').trim()

  let currentModule: ModuleData | null = null
  let firstHeadingFound = false
  let preambleLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!firstHeadingFound) {
      if (isHeading(line)) {
        firstHeadingFound = true
        if (!docTitle) {
          docTitle = cleanHeading(line)
        } else {
          currentModule = { titre: cleanHeading(line), contenu: '', duree_minutes: 30, lecons: [] }
        }
        docDescription = preambleLines.join(' ').substring(0, 300)
        preambleLines = []
      } else {
        if (!docTitle) {
          docTitle = line
        } else {
          preambleLines.push(line)
        }
      }
      continue
    }

    if (isHeading(line)) {
      if (currentModule && (currentModule.titre || currentModule.contenu)) {
        modules.push(currentModule)
      }
      currentModule = { titre: cleanHeading(line), contenu: '', duree_minutes: 30, lecons: [] }
    } else {
      if (!currentModule) {
        currentModule = { titre: 'Introduction', contenu: '', duree_minutes: 30, lecons: [] }
      }
      currentModule.contenu += (currentModule.contenu ? '\n' : '') + line
    }
  }

  if (currentModule && (currentModule.titre || currentModule.contenu)) {
    modules.push(currentModule)
  }

  if (modules.length === 0 && lines.length > 0) {
    if (!docTitle) docTitle = lines[0]
    const chunks = text.split(/\n{2,}/).filter(c => c.trim().length > 20)
    chunks.forEach((chunk, i) => {
      const chunkLines = chunk.split('\n').map(l => l.trim()).filter(Boolean)
      modules.push({
        titre: chunkLines[0].substring(0, 80) || ('Section ' + (i + 1)),
        contenu: chunkLines.slice(1).join('\n').substring(0, 1000),
        duree_minutes: 30,
        lecons: [],
      })
    })
  }

  modules.forEach(m => {
    const wordCount = m.contenu.split(/\s+/).length
    m.duree_minutes = Math.max(15, Math.min(120, Math.round(wordCount / 10) * 5))
  })

  // Enrich description with module titles for standard docs
  const stdModuleTitles = modules.map(m => m.titre).filter(t => t).slice(0, 6).join(', ')
  if (stdModuleTitles && modules.length > 1) {
    const intro2 = docDescription ? docDescription + ' ' : ''
    docDescription = (intro2 + 'Cette formation aborde ' + modules.length + ' module' + (modules.length > 1 ? 's' : '') + ' : ' + stdModuleTitles + '.').substring(0, 600)
  }
  return { titre: docTitle || 'Formation sans titre', description: docDescription, modules }
}

/** Extrait le texte d'un PDF (une section par page) dans le navigateur. */
export async function texteDuPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/build/pdf.worker.min.mjs'
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  let texte = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    texte += '\n=== Diapositive ' + i + ' / ' + pdf.numPages + ' ===\n' + content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n'
  }
  return texte
}
