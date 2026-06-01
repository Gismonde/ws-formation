import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inflateRawSync } from 'zlib'

// Parse PPTX (ZIP format) using Node.js native zlib
// ZIP local file header structure: PK (0x50 0x4B) followed by header data
function parseZip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  let offset = 0

  while (offset < buffer.length - 4) {
    // Check for local file header signature: PK\x03\x04
    if (buffer[offset] !== 0x50 || buffer[offset + 1] !== 0x4B || 
        buffer[offset + 2] !== 0x03 || buffer[offset + 3] !== 0x04) {
      break
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    const uncompressedSize = buffer.readUInt32LE(offset + 22)
    const fileNameLength = buffer.readUInt16LE(offset + 26)
    const extraFieldLength = buffer.readUInt16LE(offset + 28)
    const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength)
    const dataOffset = offset + 30 + fileNameLength + extraFieldLength

    if (fileName && !fileName.endsWith('/')) {
      const compressedData = buffer.slice(dataOffset, dataOffset + compressedSize)
      try {
        let fileData: Buffer
        if (compressionMethod === 0) {
          fileData = compressedData
        } else if (compressionMethod === 8) {
          fileData = inflateRawSync(compressedData)
        } else {
          fileData = compressedData
        }
        files.set(fileName, fileData)
      } catch (e) {
        // Skip files that can't be decompressed
      }
    }

    offset = dataOffset + compressedSize
    // Handle data descriptors (signature PK 0x07 0x08)
    if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4B && 
        buffer[offset + 2] === 0x07 && buffer[offset + 3] === 0x08) {
      offset += 16
    }
  }

  return files
}

// Extract text from PPTX slide XML
function extractSlideContent(xml: string): { title: string; texts: string[] } {
  // Extract all text runs <a:t>...</a:t>
  const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
  const texts = textMatches
    .map(m => {
      const match = m.match(/<a:t[^>]*>([^<]*)<\/a:t>/)
      return match ? match[1].trim() : ''
    })
    .filter(t => t.length > 0)

  const title = texts[0] || 'Sans titre'
  const body = texts.slice(1).filter(t => t !== title)

  return { title, texts: body }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const formationId = formData.get('formationId') as string
    const moduleMode = formData.get('moduleMode') as string

    if (!file || !formationId) {
      return NextResponse.json({ error: 'Fichier et formationId requis' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse the PPTX ZIP
    const zipFiles = parseZip(buffer)

    // Get all slide files sorted by number
    const slideEntries = Array.from(zipFiles.entries())
      .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort(([a], [b]) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0')
        const numB = parseInt(b.match(/\d+/)?.[0] || '0')
        return numA - numB
      })

    if (slideEntries.length === 0) {
      return NextResponse.json({ error: 'Aucun slide trouve. Verifiez que le fichier est bien un .pptx' }, { status: 400 })
    }

    const slides = slideEntries.map(([, data]) => {
      const xml = data.toString('utf8')
      return extractSlideContent(xml)
    })

    // Get current max ordre for modules
    const { data: existingModules } = await supabase
      .from('modules')
      .select('ordre')
      .eq('formation_id', formationId)
      .order('ordre', { ascending: false })
      .limit(1)

    let moduleOrdre = (existingModules?.[0]?.ordre ?? 0) + 1
    let modulesCreated = 0

    if (moduleMode === 'one') {
      // One module with all slides as lessons
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
        const { data: lecon } = await supabase
          .from('lecons')
          .insert({ module_id: module.id, titre: slide.title, description: slide.texts.join(' ').substring(0, 1000), image_url: null, ordre: i + 1 })
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
      modulesCreated = 1
    } else {
      // Each slide = one module with one lesson
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        const { data: module } = await supabase
          .from('modules')
          .insert({ formation_id: formationId, titre: slide.title, ordre: moduleOrdre + i })
          .select()
          .single()

        if (!module) continue

        const { data: lecon } = await supabase
          .from('lecons')
          .insert({ module_id: module.id, titre: slide.title, description: slide.texts.join(' ').substring(0, 1000), image_url: null, ordre: 1 })
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
        modulesCreated++
      }
    }

    return NextResponse.json({
      success: true,
      slidesCount: slides.length,
      modulesCreated,
      message: `${slides.length} slides importees avec succes !`
    })

  } catch (error: any) {
    console.error('Import PPTX error:', error)
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 })
  }
}
