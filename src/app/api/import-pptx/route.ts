import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Parse PPTX file (which is a ZIP containing XML files)
// Uses Node.js built-in modules only - no external dependencies
async function parsePptx(buffer: Buffer): Promise<{ slides: { title: string; texts: string[] }[] }> {
  // Dynamically import JSZip-like functionality using fflate (bundled with Next.js)
  // PPTX is a ZIP file with XML content
  const { unzipSync, strFromU8 } = await import('fflate')
  
  const uint8 = new Uint8Array(buffer)
  const unzipped = unzipSync(uint8)
  
  const slides: { title: string; texts: string[] }[] = []
  
  // Find slide files: ppt/slides/slide*.xml
  const slideKeys = Object.keys(unzipped)
    .filter(k => k.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0')
      const numB = parseInt(b.match(/\d+/)?.[0] || '0')
      return numA - numB
    })
  
  for (const key of slideKeys) {
    const xml = strFromU8(unzipped[key])
    
    // Extract text from XML - get all <a:t> tag contents
    const textMatches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || []
    const texts = textMatches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 0)
    
    // First text is usually the title
    const title = texts[0] || `Slide ${slides.length + 1}`
    const bodyTexts = texts.slice(1)
    
    slides.push({ title, texts: bodyTexts })
  }
  
  return { slides }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const formationId = formData.get('formationId') as string
    const moduleMode = formData.get('moduleMode') as string // 'one' | 'many'

    if (!file || !formationId) {
      return NextResponse.json({ error: 'Fichier et formationId requis' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const { slides } = await parsePptx(buffer)
    
    if (slides.length === 0) {
      return NextResponse.json({ error: 'Aucun slide trouve dans le fichier' }, { status: 400 })
    }

    // Get current max ordre for modules
    const { data: existingModules } = await supabase
      .from('modules')
      .select('ordre')
      .eq('formation_id', formationId)
      .order('ordre', { ascending: false })
      .limit(1)
    
    let moduleOrdre = (existingModules?.[0]?.ordre ?? 0) + 1
    const createdModules: any[] = []

    if (moduleMode === 'one') {
      // One module = one slide, each slide becomes a lecon
      const { data: module, error: modError } = await supabase
        .from('modules')
        .insert({ formation_id: formationId, titre: 'Import PowerPoint', ordre: moduleOrdre })
        .select()
        .single()
      
      if (modError || !module) {
        return NextResponse.json({ error: 'Erreur creation module: ' + modError?.message }, { status: 500 })
      }

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        const { data: lecon, error: leconError } = await supabase
          .from('lecons')
          .insert({ module_id: module.id, titre: slide.title, ordre: i + 1 })
          .select()
          .single()
        
        if (lecon && slide.texts.length > 0) {
          await supabase.from('blocs_contenu').insert({
            lecon_id: lecon.id,
            type: 'texte',
            contenu: slide.texts.join('\n'),
            ordre: 1
          })
        }
      }
      createdModules.push(module)

    } else {
      // Many modules: each slide becomes its own module with 1 lecon
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        
        const { data: module, error: modError } = await supabase
          .from('modules')
          .insert({ formation_id: formationId, titre: slide.title, ordre: moduleOrdre + i })
          .select()
          .single()
        
        if (modError || !module) continue

        const { data: lecon } = await supabase
          .from('lecons')
          .insert({ module_id: module.id, titre: slide.title, ordre: 1 })
          .select()
          .single()
        
        if (lecon && slide.texts.length > 0) {
          await supabase.from('blocs_contenu').insert({
            lecon_id: lecon.id,
            type: 'texte',
            contenu: slide.texts.join('\n'),
            ordre: 1
          })
        }
        createdModules.push(module)
      }
    }

    return NextResponse.json({ 
      success: true, 
      slidesCount: slides.length,
      modulesCreated: createdModules.length,
      message: `${slides.length} slides importees avec succes`
    })

  } catch (error: any) {
    console.error('Import PPTX error:', error)
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
