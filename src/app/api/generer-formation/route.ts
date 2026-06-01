import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'

const CATEGORIES = [
  'Administration médicale',
  'Gestion des soins',
  'Hygiène et sécurité',
  'Ressources humaines',
  'Qualité et conformité',
  'Informatique et systèmes',
  'Formation du personnel',
  'Gestion des risques',
  'Communication',
]

interface LeconInput {
  titre: string
  description: string
  image_url?: string
}

interface ModuleInput {
  titre: string
  contenu: string
  duree_minutes: number
  ordre: number
  lecons?: LeconInput[]
}

interface ReponseInput {
  texte: string
  est_correcte: boolean
}

interface QuestionInput {
  texte: string
  reponses: ReponseInput[]
}

export async function POST(req: NextRequest) {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json()
  const { titre, description, categorie, niveau, duree_heures, modules, questionnaire } = body

  if (!titre?.trim()) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  }
  if (!modules || modules.length === 0) {
    return NextResponse.json({ error: 'Au moins un module requis' }, { status: 400 })
  }

  // 1. Create formation
  const { data: formation, error: formationError } = await adminClient
    .from('formations')
    .insert({
      titre: titre.trim(),
      description: description?.trim() || null,
      categorie: CATEGORIES.includes(categorie) ? categorie : CATEGORIES[0],
      niveau: ['debutant', 'intermediaire', 'avance'].includes(niveau) ? niveau : 'debutant',
      duree_heures: duree_heures || 1,
      est_publiee: false,
    })
    .select()
    .single()

  if (formationError || !formation) {
    return NextResponse.json({ error: formationError?.message || 'Erreur création formation' }, { status: 500 })
  }

  // 2. Create modules
  const { data: insertedModules, error: modulesError } = await adminClient
    .from('modules')
    .insert(
      (modules as ModuleInput[]).map((m, i) => ({
        formation_id: formation.id,
        titre: m.titre?.trim() || ('Module ' + (i + 1)),
        contenu: m.contenu?.trim() || '',
        duree_minutes: m.duree_minutes || 30,
        ordre: i + 1,
      }))
    )
    .select()

  if (modulesError || !insertedModules) {
    return NextResponse.json({ error: modulesError?.message || 'Erreur création modules' }, { status: 500 })
  }

  // 3. Create leçons + blocs_contenu par module
  for (let mIdx = 0; mIdx < (modules as ModuleInput[]).length; mIdx++) {
    const m = (modules as ModuleInput[])[mIdx]
    const insertedModule = insertedModules[mIdx]
    if (!insertedModule) continue

    // 3a. Insert module content as bloc if contenu exists
    if (m.contenu?.trim()) {
      await adminClient.from('blocs_contenu').insert({
        lecon_id: null,
        module_id: insertedModule.id,
        type: 'texte',
        contenu: m.contenu.trim(),
        ordre: 1,
      }).select()
    }

    if (!m.lecons || m.lecons.length === 0) continue

    // 3b. Insert leçons
    const leconsToInsert = m.lecons.map((l, j) => ({
      module_id: insertedModule.id,
      titre: l.titre?.trim() || ('Leçon ' + (j + 1)),
      description: l.description?.trim() || '',
      image_url: l.image_url || null,
      ordre: j + 1,
      est_obligatoire: true,
    }))

    const { data: insertedLecons, error: leconsError } = await adminClient
      .from('lessons')
      .insert(leconsToInsert)
      .select()

    if (leconsError) {
      console.error('Leçons insert error:', leconsError.message)
      continue
    }

    // 3c. Insert blocs_contenu for each leçon that has description
    if (insertedLecons) {
      const blocsToInsert = insertedLecons
        .map((lecon, j) => {
          const desc = m.lecons![j]?.description?.trim()
          if (!desc) return null
          return {
            lecon_id: lecon.id,
            type: 'texte',
            contenu: desc,
            ordre: 1,
          }
        })
        .filter(Boolean)

      if (blocsToInsert.length > 0) {
        const { error: blocsError } = await adminClient
          .from('blocs_contenu')
          .insert(blocsToInsert)
        if (blocsError) {
          console.error('Blocs contenu insert error (non-fatal):', blocsError.message)
        }
      }
    }
  }

  // 4. Create questionnaire if provided
  if (questionnaire && questionnaire.questions && questionnaire.questions.length > 0) {
    const { data: quiz, error: quizError } = await adminClient
      .from('questionnaires')
      .insert({
        formation_id: formation.id,
        titre: questionnaire.titre || ('Questionnaire - ' + titre.trim()),
        seuil_reussite: questionnaire.seuil_reussite || 70,
      })
      .select()
      .single()

    if (!quizError && quiz) {
      const validQuestions = (questionnaire.questions as QuestionInput[]).filter(q => q.texte?.trim())
      for (let qi = 0; qi < validQuestions.length; qi++) {
        const q = validQuestions[qi]
        const { data: question, error: questionError } = await adminClient
          .from('questions')
          .insert({
            questionnaire_id: quiz.id,
            texte: q.texte.trim(),
            type: 'qcm',
            ordre: qi + 1,
          })
          .select()
          .single()

        if (!questionError && question) {
          const validReponses = q.reponses.filter(r => r.texte?.trim())
          if (validReponses.length > 0) {
            await adminClient.from('reponses_possibles').insert(
              validReponses.map((r, ri) => ({
                question_id: question.id,
                texte: r.texte.trim(),
                est_correcte: r.est_correcte,
                ordre: ri + 1,
              }))
            )
          }
        }
      }
    }
  }

  await logAudit({
    acteur_id: user.id,
    type_action: 'FORMATION_CREEE',
    description: 'Formation générée depuis document: ' + titre.trim(),
    formation_id: formation.id,
  })

  return NextResponse.json({ success: true, formation_id: formation.id })
}
