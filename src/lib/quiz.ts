// Format d'un bloc quiz (stocké en JSON dans content_blocks.contenu — compatible avec l'ancien format).

export type QuestionQuiz = {
  question: string
  reponses: string[]
  bonne_reponse: number
  explication?: string
}

export type Quiz = { questions: QuestionQuiz[] }

export function lireQuiz(contenu: string | null | undefined): Quiz {
  if (!contenu) return { questions: [] }
  try {
    const q = JSON.parse(contenu)
    if (q && Array.isArray(q.questions)) {
      return {
        questions: q.questions.map((x: Partial<QuestionQuiz>) => ({
          question: String(x.question ?? ''),
          reponses: Array.isArray(x.reponses) ? x.reponses.map(String) : ['', ''],
          bonne_reponse: Number.isInteger(x.bonne_reponse) ? Number(x.bonne_reponse) : 0,
          explication: x.explication ? String(x.explication) : '',
        })),
      }
    }
  } catch { /* contenu non JSON */ }
  return { questions: [] }
}

export function nouvelleQuestion(): QuestionQuiz {
  return { question: '', reponses: ['', ''], bonne_reponse: 0, explication: '' }
}
