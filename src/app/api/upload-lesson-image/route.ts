import { getActeur, peutCreerFormations, peutCreerEvenements } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    // Images des formations et des événements
    const auteur = await getActeur()
    if (!peutCreerFormations(auteur) && !peutCreerEvenements(auteur)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
          return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
        }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
          return NextResponse.json({ error: 'Type non pris en charge. Utilisez JPG, PNG, GIF ou WebP.' }, { status: 400 })
        }

    if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json({ error: 'Image trop grande (max 10MB)' }, { status: 400 })
        }

    // Extension déduite du type réel (jamais du nom fourni par l'utilisateur)
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' } as Record<string, string>)[file.type]
    const fileName = `${user.id}/${Date.now()}.${ext}`
    const fileBuffer = await file.arrayBuffer()

    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from('lesson-images')
      .upload(fileName, fileBuffer, {
              contentType: file.type,
              upsert: false,
            })

    if (uploadError) {
          return NextResponse.json({ error: 'Erreur upload: ' + uploadError.message }, { status: 500 })
        }

    const { data: { publicUrl } } = serviceClient.storage
      .from('lesson-images')
      .getPublicUrl(uploadData.path)

    return NextResponse.json({ success: true, url: publicUrl })
  }
