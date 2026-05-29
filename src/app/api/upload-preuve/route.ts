import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the current employee
  const { data: employe } = await serviceClient
    .from('employes')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) return NextResponse.json({ error: 'Employe non trouve' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const formationId = formData.get('formation_id') as string
  const formationTitreAutre = (formData.get('formation_titre_autre') as string) || ''

  const isAutre = formationId === 'autre'

  if (!file) {
    return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
  }
  if (!isAutre && !formationId) {
    return NextResponse.json({ error: 'Formation requise' }, { status: 400 })
  }
  if (isAutre && !formationTitreAutre.trim()) {
    return NextResponse.json({ error: 'Veuillez preciser le nom de la formation' }, { status: 400 })
  }

  // Validate file type (PDF, images)
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Type de fichier non supporte. Utilisez PDF, JPG ou PNG.' }, { status: 400 })
  }

  // Max size 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop grand (max 10MB)' }, { status: 400 })
  }

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop()
  const folderKey = isAutre ? 'autre' : formationId
  const fileName = `${employe.id}/${folderKey}/${Date.now()}.${ext}`
  const fileBuffer = await file.arrayBuffer()

  const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from('preuves')
    .upload(fileName, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return NextResponse.json({ error: 'Erreur upload: ' + uploadError.message }, { status: 500 })
  }

  // Build nom_fichier: include autre info if needed
  const nomFichier = isAutre
    ? `[AUTRE: ${formationTitreAutre}] ${file.name}`
    : file.name

  // Create DB record
  const { data: preuve, error: dbError } = await serviceClient
    .from('preuves_externes')
    .insert({
      employe_id: employe.id,
      formation_id: isAutre ? null : formationId,
      fichier_url: uploadData.path,
      nom_fichier: nomFichier,
      type_fichier: file.type,
      statut: 'en_attente',
    })
    .select()
    .single()

  if (dbError) {
    console.error('DB error:', dbError)
    return NextResponse.json({ error: 'Erreur base de donnees: ' + dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, preuve })
}
