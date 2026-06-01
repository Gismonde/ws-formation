import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
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
  contenu: string
}

interface ModuleInput {
  titre: string
  contenu: string
  duree_minutes: number
  ordre: number
  lecons?: LeconInput[]
}

interface FormationInput {
  titre: string
  description: string
  categorie: string
  niveau: string
  duree_heures: number
  modules: ModuleInput[]
}

export async function POST(req: NextRequest) {
  try {
    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body: FormationInput = await req.json()
    const { titre, description, categorie, niveau, duree_heures, modules } = body

    if (!titre?.trim()) {
      return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })
    }
    if (!modules || modules.length === 0) {
      return NextResponse.json({ error: 'Au moins un module est requis' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create the formation
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

    // Create modules
    const modulesToInsert = modules.map((m, i) => ({
      formation_id: formation.id,
      titre: m.titre?.trim() || `Module ${i + 1}`,
      contenu: m.contenu?.trim() || '',
      duree_minutes: m.duree_minutes || 30,
      ordre: i + 1,
    }))

    const { data: insertedModules, error: modulesError } = await adminClient
      .from('modules')
      .insert(modulesToInsert)
      .select('id, ordre')

    if (modulesError || !insertedModules) {
      // Rollback: delete the formation
      await adminClient.from('formations').delete().eq('id', formation.id)
      return NextResponse.json({ error: modulesError?.message || 'Erreur modules' }, { status: 500 })
    }

    // Create lecons for each module
    const leconsToInsert = modules.flatMap((m, i) => {
      const moduleId = insertedModules.find(mod => mod.ordre === i + 1)?.id
      if (!moduleId || !m.lecons || m.lecons.length === 0) return []
      return m.lecons.map((l, j) => ({
        module_id: moduleId,
        titre: l.titre?.trim() || `Leçon ${j + 1}`,
        contenu: l.contenu?.trim() || '',
        ordre: j + 1,
      }))
    })

    if (leconsToInsert.length > 0) {
      const { error: leconsError } = await adminClient
        .from('lecons')
        .insert(leconsToInsert)
      if (leconsError) {
        console.error('Leçons insert error (non-fatal):', leconsError.message)
      }
    }

    // Log audit
    await logAudit({
      acteur_id: user.id,
      type_action: 'FORMATION_CREEE',
      description: `Formation générée depuis document: ${titre.trim()}`,
      formation_id: formation.id,
    })

    return NextResponse.json({ success: true, formation_id: formation.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
