import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// =====================================================
// API : /api/droit-acces
// Loi 25 Quebec - Art. 27, 28, 28.1
// Droit d'acces et portabilite des renseignements personnels
// =====================================================
// GET : Exporter le dossier complet de l'employe authentifie (JSON)
// DELETE : Demander la suppression des donnees (envoi email au RPP)
// =====================================================

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const adminSupabase = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Profil employe
    const { data: employe } = await adminSupabase
      .from('employes')
      .select('id, nom, prenom, email, departement, actif, created_at')
      .eq('auth_user_id', user.id)
      .single()

    if (!employe) {
      return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
    }

    const employeId = employe.id

    // 2. Progressions et formations
    const { data: progressions } = await adminSupabase
      .from('progressions')
      .select('formation_id, module_id, statut, pourcentage_complete, date_debut, date_fin, updated_at')
      .eq('employe_id', employeId)

    // 3. Progressions par lecon
    const { data: lessonProgressions } = await adminSupabase
      .from('lesson_progressions')
      .select('lesson_id, statut, pourcentage_complete, date_debut, date_fin')
      .eq('employe_id', employeId)

    // 4. Certificats
    const { data: certificats } = await adminSupabase
      .from('certificats')
      .select('formation_id, numero_certificat, date_emission, date_expiration, note_finale, valide')
      .eq('employe_id', employeId)

    // 5. Assignations
    const { data: assignations } = await adminSupabase
      .from('assignations')
      .select('formation_id, date_assignation, date_echeance, priorite')
      .eq('employe_id', employeId)

    // 6. Preuves externes
    const { data: preuves } = await adminSupabase
      .from('preuves_externes')
      .select('formation_id, nom_fichier, type_fichier, statut, commentaire, soumis_le, valide_le')
      .eq('employe_id', employeId)

    // 6b. Preuves de lecture (vidéos obligatoires vues, attestations « J'ai lu et compris »)
    const { data: preuvesLecture } = await adminSupabase
      .from('preuves_lecture')
      .select('lesson_id, type, texte, created_at, ip_address')
      .eq('employe_id', employeId)

    // 7. Audit logs (actions de l'employe et actions le concernant)
    const { data: auditLogs } = await adminSupabase
      .from('audit_logs')
      .select('type_action, description, created_at, ip_address')
      .or(`acteur_id.eq.${employeId},cible_employe_id.eq.${employeId}`)
      .order('created_at', { ascending: false })
      .limit(500)

    // Construire le dossier complet
    const dossier = {
      export_info: {
        date_export: new Date().toISOString(),
        loi: 'Loi 25 - Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (Québec)',
        articles: 'Art. 27 (accès), Art. 28 (portabilité)',
        plateforme: 'WS Formation',
        rpp_contact: 'confidentialite@wssurgical.com',
      },
      profil: {
        id: employe.id,
        nom: employe.nom,
        prenom: employe.prenom,
        email: employe.email,
        departement: employe.departement,
        actif: employe.actif,
        date_creation_compte: employe.created_at,
      },
      formations: {
        assignations: assignations ?? [],
        progressions: progressions ?? [],
        progressions_par_lecon: lessonProgressions ?? [],
        certificats: certificats ?? [],
        preuves_externes: preuves ?? [],
        preuves_de_lecture: preuvesLecture ?? [],
      },
      journal_audit: {
        note: 'Les 500 derniers événements vous concernant (connexions, formations, certificats)',
        evenements: auditLogs ?? [],
      },
    }

    // Enregistrer cet export dans les audit logs
    await adminSupabase.from('audit_logs').insert({
      acteur_id: employeId,
      cible_employe_id: employeId,
      type_action: 'EXPORT_DONNEES',
      description: "Export du dossier personnel (droit d'accès, Loi 25) par l'employé",
      metadata: { source: 'api/droit-acces', articles: '27-28 Loi 25' },
    })

    const fileName = `dossier-${employe.prenom}-${employe.nom}-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(dossier, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[droit-acces] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE : Envoyer une demande d'effacement au RPP
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const adminSupabase = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: employe } = await adminSupabase
      .from('employes')
      .select('id, nom, prenom, email')
      .eq('auth_user_id', user.id)
      .single()

    if (!employe) {
      return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
    }

    // Enregistrer la demande d'effacement dans les audit logs
    const { error: erreurJournal } = await adminSupabase.from('audit_logs').insert({
      acteur_id: employe.id,
      cible_employe_id: employe.id,
      type_action: 'EMPLOYE_MODIFIE',
      description: `Demande d'effacement des données personnelles par ${employe.prenom} ${employe.nom} (${employe.email})`,
      metadata: {
        source: 'api/droit-acces',
        article: '28.1 Loi 25',
        action_requise: 'Le RPP doit traiter cette demande dans un délai de 30 jours',
        rpp: 'confidentialite@wssurgical.com',
      },
    })

    if (erreurJournal) {
      console.error('[droit-acces DELETE] Demande non enregistree', erreurJournal)
      return NextResponse.json({ error: "La demande n'a pas pu être enregistrée. Écrivez directement au RPP : confidentialite@wssurgical.com" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Demande d'effacement enregistrée. Le RPP vous contactera dans un délai de 30 jours.",
      rpp: 'confidentialite@wssurgical.com',
      article: 'Art. 28.1 Loi 25 Quebec',
    })
  } catch (err) {
    console.error('[droit-acces DELETE] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
          }
