"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface QuestionForm {
  texte: string
  reponses: { texte: string; est_correcte: boolean }[]
}

const DRAFT_KEY = "depuis-pp-draft"

export default function DepuisPPPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [titre, setTitre] = useState("")
  const [categorie, setCategorie] = useState("")
  const [niveau, setNiveau] = useState("debutant")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0) // 0=idle, 1=creation, 2=import, 3=questionnaire
  const [error, setError] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [publierImmediatement, setPublierImmediatement] = useState(false)
  // Enrichissement
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [objectifs, setObjectifs] = useState<string[]>([])
  const [objectifInput, setObjectifInput] = useState("")
  const [imageCouverture, setImageCouverture] = useState<string | null>(null)
  const [prerequisIds, setPrerequisIds] = useState<string[]>([])
  const [formationsDisponibles, setFormationsDisponibles] = useState<{id: string, titre: string}[]>([])
  // Questionnaire
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { texte: "", reponses: [{ texte: "", est_correcte: true }, { texte: "", est_correcte: false }, { texte: "", est_correcte: false }] }
  ])
  const [seuilReussite, setSeuilReussite] = useState(70)

  // Load draft from localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        const d = JSON.parse(draft)
        if (d.titre) setTitre(d.titre)
        if (d.categorie) setCategorie(d.categorie)
        if (d.niveau) setNiveau(d.niveau)
        if (d.tags) setTags(d.tags)
        if (d.objectifs) setObjectifs(d.objectifs)
        if (d.seuilReussite) setSeuilReussite(d.seuilReussite)
        if (d.prerequisIds) setPrerequisIds(d.prerequisIds)
        if (d.imageCouverture) setImageCouverture(d.imageCouverture)
      }
    } catch {}
  }, [])

  // Auto-save draft
  useEffect(() => {
    if (titre) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ titre, categorie, niveau, tags, objectifs, seuilReussite, prerequisIds, imageCouverture }))
      } catch {}
    }
  }, [titre, categorie, niveau, tags, objectifs, seuilReussite, prerequisIds, imageCouverture])

  // Load formations for prereq
  useEffect(() => {
    const supabase = createClient()
    supabase.from("formations").select("id, titre").eq("est_publiee", true).order("titre").then(({ data }) => {
      if (data) setFormationsDisponibles(data)
    })
  }, [])

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ]
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(pptx?|ppt)$/i)) {
      setError(["Veuillez sélectionner un fichier PowerPoint (.ppt ou .pptx)"])
      return
    }
    setError([])
    setFile(selectedFile)
    if (!titre) setTitre(selectedFile.name.replace(/\.(pptx?|ppt)$/i, ""))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileChange(e.dataTransfer.files[0])
  }

  const handleCoverUpload = async (f: File) => {
    const fd = new FormData()
    fd.append("file", f)
    const res = await fetch("/api/upload-lesson-image", { method: "POST", body: fd })
    const d = await res.json()
    if (d.url) setImageCouverture(d.url)
  }

  const addQuestion = () => setQuestions(prev => [...prev, { texte: "", reponses: [{ texte: "", est_correcte: true }, { texte: "", est_correcte: false }, { texte: "", est_correcte: false }] }])
  const removeQuestion = (idx: number) => setQuestions(prev => prev.filter((_, i) => i !== idx))

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    if (!file) errs.push("Veuillez sélectionner un fichier PowerPoint")
    if (!titre.trim()) errs.push("Veuillez saisir un titre pour la formation")
    if (errs.length > 0) { setError(errs); return }
    setError([])
    setShowPreview(true)
  }

  const handleSubmit = async () => {
    setShowPreview(false)
    setIsLoading(true)
    setLoadingStep(1)
    setError([])
    let formationId: string | null = null

    try {
      const supabase = createClient()

      // Etape 1: Creation formation
      setLoadingStep(1)
      const { data: formation, error: errF } = await supabase
        .from("formations")
        .insert({
          titre,
          categorie,
          niveau,
          duree_heures: 1,
          est_publiee: publierImmediatement === true,
          tags: tags || [],
          objectifs: objectifs || [],
          image_couverture: imageCouverture || null,
          prerequis_ids: prerequisIds || [],
        })
        .select()
        .single()
      if (errF || !formation) throw new Error(errF?.message || "Erreur creation formation")
      formationId = formation.id

      // Etape 2: Import PPTX
      setLoadingStep(2)
      const formData = new FormData()
      formData.append("file", file!)
      formData.append("formationId", formation.id)
      const res = await fetch("/api/import-pptx", { method: "POST", body: formData })

      if (!res.ok) {
        const data = await res.json()
        // Rollback: delete orphan formation
        await supabase.from("formations").delete().eq("id", formation.id)
        throw new Error(data.error || "Erreur import PowerPoint - formation annulee")
      }

      // Update duration
      const { count: moduleCount } = await supabase
        .from("modules").select("id", { count: "exact", head: true }).eq("formation_id", formation.id)
      if (moduleCount && moduleCount > 0) {
        const estimatedDuration = Math.max(1, Math.round(moduleCount * 0.5 * 10) / 10)
        await supabase.from("formations").update({ duree_heures: estimatedDuration }).eq("id", formation.id)
      }

      // Etape 3: Questionnaire
      const validQuestions = questions.filter(q => q.texte.trim())
      if (validQuestions.length > 0) {
        setLoadingStep(3)
        const { data: questionnaire } = await supabase
          .from("questionnaires")
          .insert({ formation_id: formation.id, titre: "Questionnaire - " + titre, seuil_reussite: seuilReussite })
          .select().single()
        if (questionnaire) {
          for (let i = 0; i < validQuestions.length; i++) {
            const q = validQuestions[i]
            const { data: question } = await supabase
              .from("questions")
              .insert({ questionnaire_id: questionnaire.id, texte: q.texte, type: "qcm", ordre: i + 1 })
              .select().single()
            if (question) {
              const validR = q.reponses.filter(r => r.texte.trim())
              if (validR.length > 0) {
                await supabase.from("reponses_possibles").insert(
                  validR.map((r, ri) => ({ question_id: question.id, texte: r.texte, est_correcte: r.est_correcte, ordre: ri + 1 }))
                )
              }
            }
          }
        }
      }

      localStorage.removeItem(DRAFT_KEY)
      router.push("/admin/formations/" + formation.id)
    } catch (err: any) {
      setError([err.message])
      setIsLoading(false)
      setLoadingStep(0)
    }
  }

  const STEPS = ["Création de la formation", "Import des slides PPTX", "Création du questionnaire"]

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box" }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }
  const btnSecStyle: React.CSSProperties = { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", padding: "6px 12px", fontSize: "13px", cursor: "pointer" }
  const btnDangerStyle: React.CSSProperties = { background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "4px", padding: "3px 8px", fontSize: "12px", cursor: "pointer" }
  const btnStyle: React.CSSProperties = { background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 18px", fontSize: "14px", cursor: "pointer", fontWeight: "600" }

  // Loading overlay
  if (isLoading) {
    return (
      <div style={{ maxWidth: "500px", margin: "80px auto", padding: "40px", background: "#fff", borderRadius: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.1)", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "20px" }}>📊</div>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#111827", margin: "0 0 24px" }}>Création en cours...</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {STEPS.map((step, i) => {
            const stepNum = i + 1
            const isDone = loadingStep > stepNum
            const isActive = loadingStep === stepNum
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "10px", background: isDone ? "#f0fdf4" : isActive ? "#eff6ff" : "#f9fafb", border: "1px solid " + (isDone ? "#bbf7d0" : isActive ? "#bfdbfe" : "#e5e7eb") }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", background: isDone ? "#16a34a" : isActive ? "#2563eb" : "#d1d5db", color: "#fff", flexShrink: 0 }}>
                  {isDone ? "✓" : stepNum}
                </div>
                <span style={{ fontSize: "14px", fontWeight: isActive ? "600" : "400", color: isDone ? "#15803d" : isActive ? "#1d4ed8" : "#9ca3af" }}>
                  {step}{isActive ? "..." : ""}
                </span>
              </div>
            )
          })}
        </div>
        {error.length > 0 && (
          <div style={{ marginTop: "20px", padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "13px" }}>
            {error.map((e, i) => <div key={i}>⚠️ {e}</div>)}
          </div>
        )}
      </div>
    )
  }

  // Preview modal
  if (showPreview) {
    const validQs = questions.filter(q => q.texte.trim())
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", padding: "32px", background: "#fff", borderRadius: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.1)", fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", margin: "0 0 4px" }}>Aperçu avant création</h2>
        <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 24px" }}>Vérifiez les informations avant de lancer l&apos;import.</p>

        <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
          <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div><span style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Titre</span><p style={{ fontSize: "15px", fontWeight: "600", color: "#111827", margin: "4px 0 0" }}>{titre}</p></div>
              <div><span style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Niveau</span><p style={{ fontSize: "14px", color: "#374151", margin: "4px 0 0", textTransform: "capitalize" }}>{niveau}</p></div>
              {categorie && <div><span style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Catégorie</span><p style={{ fontSize: "14px", color: "#374151", margin: "4px 0 0" }}>{categorie}</p></div>}
              <div><span style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fichier</span><p style={{ fontSize: "14px", color: "#374151", margin: "4px 0 0" }}>{file?.name}</p></div>
            </div>
          </div>
          {(tags.length > 0 || objectifs.length > 0) && (
            <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
              {tags.length > 0 && <div style={{ marginBottom: "10px" }}><span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Tags</span><div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>{tags.map((t, i) => <span key={i} style={{ background: "#ede9fe", color: "#5b21b6", fontSize: "11px", padding: "1px 8px", borderRadius: "20px" }}>{t}</span>)}</div></div>}
              {objectifs.length > 0 && <div><span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Objectifs ({objectifs.length})</span>{objectifs.map((o, i) => <p key={i} style={{ fontSize: "12px", color: "#374151", margin: "4px 0 0" }}>✓ {o}</p>)}</div>}
            </div>
          )}
          {prerequisIds.length > 0 && (
            <div style={{ padding: "12px 16px", background: "#fefce8", borderRadius: "10px", border: "1px solid #fef08a" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#713f12" }}>⚠️ {prerequisIds.length} prérequis obligatoire{prerequisIds.length > 1 ? "s" : ""}</span>
            </div>
          )}
          {validQs.length > 0 && (
            <div style={{ padding: "12px 16px", background: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#15803d" }}>✓ Questionnaire : {validQs.length} question{validQs.length > 1 ? "s" : ""}, seuil {seuilReussite}%</span>
            </div>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#374151", marginBottom: "16px", cursor: "pointer" }}>
          <input type="checkbox" checked={publierImmediatement} onChange={e => setPublierImmediatement(e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
          <span>Publier immédiatement (visible par les apprenants)</span>
        </label>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setShowPreview(false)} style={btnSecStyle}>← Modifier</button>
          <button type="button" onClick={handleSubmit} style={{ ...btnStyle, background: "#7c3aed", boxShadow: "0 2px 8px rgba(124,58,237,0.35)" }}>
            📊 Confirmer et créer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <Link href="/admin/formations" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "#f3f4f6", color: "#374151", borderRadius: "8px", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>← Retour</Link>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#111827", margin: 0 }}>Créer depuis un PowerPoint</h1>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: "4px 0 0 0" }}>Importez un fichier .ppt ou .pptx pour générer une formation</p>
        </div>
      </div>

      <form onSubmit={handlePreview}>
        {/* Zone upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: "2px dashed " + (isDragging ? "#7c3aed" : file ? "#16a34a" : "#d1d5db"), borderRadius: "16px", padding: "48px 32px", textAlign: "center", cursor: "pointer", background: isDragging ? "#f5f3ff" : file ? "#f0fdf4" : "#fafafa", transition: "all 0.2s", marginBottom: "28px" }}
        >
          <input ref={fileInputRef} type="file" accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            style={{ display: "none" }} onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
          {file ? (
            <div>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📊</div>
              <p style={{ fontWeight: "600", color: "#16a34a", fontSize: "16px", margin: "0 0 4px" }}>{file.name}</p>
              <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Cliquez pour changer</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📂</div>
              <p style={{ fontWeight: "600", color: "#374151", fontSize: "16px", margin: "0 0 8px" }}>Glissez votre fichier PowerPoint ici</p>
              <p style={{ color: "#9ca3af", fontSize: "14px", margin: "0 0 16px" }}>ou cliquez pour parcourir vos fichiers</p>
              <span style={{ display: "inline-block", padding: "6px 14px", background: "#7c3aed", color: "#fff", borderRadius: "6px", fontSize: "13px", fontWeight: "600" }}>Choisir un fichier .ppt / .pptx</span>
            </div>
          )}
        </div>

        {/* Informations */}
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "28px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 20px" }}>Informations de la formation</h2>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Titre de la formation *</label>
            <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : Sécurité au travail — Niveau 1" style={{ ...inputStyle, borderColor: !titre.trim() ? "#ef4444" : "#d1d5db" }} />
            {!titre.trim() && <p style={{ color: "#dc2626", fontSize: "11px", margin: "2px 0 0" }}>Titre requis</p>}
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Catégorie</label>
            <input type="text" value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Ex : Santé & Sécurité" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Niveau</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={{ ...inputStyle, cursor: "pointer", background: "#fff" }}>
              <option value="debutant">Débutant</option>
              <option value="intermediaire">Intermédiaire</option>
              <option value="avance">Avancé</option>
            </select>
          </div>
        </div>

        {/* Enrichissement */}
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "28px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 20px" }}>Enrichissement (optionnel)</h2>
          <div style={{ display: "grid", gap: "20px" }}>
            {/* Image couverture */}
            <div>
              <label style={labelStyle}>Image de couverture</label>
              {imageCouverture ? (
                <div>
                  <img src={imageCouverture} alt="Couverture" style={{ maxWidth: "220px", maxHeight: "130px", borderRadius: "6px", border: "1px solid #e5e7eb", display: "block", marginBottom: "6px" }} />
                  <button type="button" onClick={() => setImageCouverture(null)} style={btnDangerStyle}>Retirer</button>
                </div>
              ) : (
                <label htmlFor="cover-img-pp" style={{ ...btnSecStyle, display: "inline-block", cursor: "pointer", fontSize: "12px" }}>
                  + Image de couverture
                  <input id="cover-img-pp" type="file" accept="image/*" style={{ display: "none" }} onChange={async e => { const f = e.target.files?.[0]; if (f) await handleCoverUpload(f) }} />
                </label>
              )}
            </div>
            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags / mots-clés</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                {tags.map((tag, ti) => (
                  <span key={ti} style={{ background: "#ede9fe", color: "#5b21b6", fontSize: "12px", padding: "2px 8px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "3px" }}>
                    {tag}<button type="button" onClick={() => setTags(prev => prev.filter((_, i) => i !== ti))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: "13px", padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input style={{ ...inputStyle, flex: 1 }} value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) { e.preventDefault(); setTags(p => [...p, tagInput.trim()]); setTagInput("") } }}
                  placeholder="Tag (Entrée ou virgule pour ajouter)" />
                <button type="button" onClick={() => { if (tagInput.trim()) { setTags(p => [...p, tagInput.trim()]); setTagInput("") } }} style={{ ...btnSecStyle, padding: "6px 12px" }}>+</button>
              </div>
            </div>
            {/* Objectifs */}
            <div>
              <label style={labelStyle}>Objectifs pédagogiques</label>
              <p style={{ fontSize: "11px", color: "#9ca3af", margin: "0 0 6px" }}>À la fin de cette formation, l&apos;apprenant saura...</p>
              {objectifs.map((obj, oi) => (
                <div key={oi} style={{ display: "flex", gap: "6px", marginBottom: "4px", alignItems: "center" }}>
                  <span style={{ color: "#10b981", fontSize: "12px" }}>✓</span>
                  <span style={{ flex: 1, fontSize: "13px", color: "#374151" }}>{obj}</span>
                  <button type="button" onClick={() => setObjectifs(prev => prev.filter((_, i) => i !== oi))} style={btnDangerStyle}>×</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: "6px" }}>
                <input style={{ ...inputStyle, flex: 1 }} value={objectifInput} onChange={e => setObjectifInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && objectifInput.trim()) { e.preventDefault(); setObjectifs(p => [...p, objectifInput.trim()]); setObjectifInput("") } }}
                  placeholder="Ex: utiliser le logiciel X..." />
                <button type="button" onClick={() => { if (objectifInput.trim()) { setObjectifs(p => [...p, objectifInput.trim()]); setObjectifInput("") } }} style={{ ...btnSecStyle, padding: "6px 12px" }}>+</button>
              </div>
            </div>
            {/* Prérequis */}
            <div>
              <label style={labelStyle}>Prérequis (formations obligatoires avant)</label>
              <p style={{ fontSize: "11px", color: "#9ca3af", margin: "0 0 6px" }}>Sélectionnez les formations que l&apos;apprenant doit avoir terminées avant d&apos;accéder à celle-ci.</p>
              {formationsDisponibles.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#9ca3af", fontStyle: "italic" }}>Aucune formation publiée disponible.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "8px" }}>
                  {formationsDisponibles.map(f => (
                    <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                      <input type="checkbox" checked={prerequisIds.includes(f.id)}
                        onChange={e => { if (e.target.checked) setPrerequisIds(prev => [...prev, f.id]); else setPrerequisIds(prev => prev.filter(id => id !== f.id)) }} />
                      <span style={{ color: "#374151" }}>{f.titre}</span>
                    </label>
                  ))}
                </div>
              )}
              {prerequisIds.length > 0 && <p style={{ fontSize: "11px", color: "#7c3aed", margin: "4px 0 0" }}>✓ {prerequisIds.length} prérequis sélectionné{prerequisIds.length > 1 ? "s" : ""}</p>}
            </div>
          </div>
        </div>

        {/* Questionnaire */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "700", margin: 0, color: "#111827" }}>Questionnaire (optionnel)</h2>
            <button type="button" onClick={addQuestion} style={{ ...btnStyle, padding: "6px 12px", fontSize: "13px" }}>+ Question</button>
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Seuil de réussite (%)</label>
            <input style={{ ...inputStyle, maxWidth: "120px" }} type="number" min={0} max={100} value={seuilReussite} onChange={e => setSeuilReussite(Number(e.target.value))} />
          </div>
          {questions.map((q, qi) => (
            <div key={qi} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "14px", marginBottom: "10px", background: "#f9fafb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#6b7280" }}>Question {qi + 1}</span>
                <button type="button" onClick={() => removeQuestion(qi)} style={btnDangerStyle}>Supprimer</button>
              </div>
              <input style={{ ...inputStyle, marginBottom: "8px" }} value={q.texte}
                onChange={e => setQuestions(prev => prev.map((q2, i) => i === qi ? { ...q2, texte: e.target.value } : q2))}
                placeholder="Texte de la question..." />
              {q.reponses.map((r, ri) => (
                <div key={ri} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                  <input type="radio" checked={r.est_correcte}
                    onChange={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.map((r2, j) => ({ ...r2, est_correcte: j === ri })) }))} />
                  <input style={{ ...inputStyle, flex: 1 }} value={r.texte}
                    onChange={e => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.map((r2, j) => j === ri ? { ...r2, texte: e.target.value } : r2) }))}
                    placeholder={"Réponse " + (ri + 1) + (r.est_correcte ? " (correcte)" : "")} />
                  {q.reponses.length > 2 && (
                    <button type="button" onClick={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: q2.reponses.filter((_, j) => j !== ri) }))} style={btnDangerStyle}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setQuestions(prev => prev.map((q2, i) => i !== qi ? q2 : { ...q2, reponses: [...q2.reponses, { texte: "", est_correcte: false }] }))}
                style={{ ...btnSecStyle, fontSize: "12px", marginTop: "4px" }}>+ Réponse</button>
            </div>
          ))}
        </div>

        {/* Erreurs */}
        {error.length > 0 && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "14px", marginBottom: "20px" }}>
            {error.map((e, i) => <div key={i}>⚠️ {e}</div>)}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <Link href="/admin/formations" style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", borderRadius: "8px", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>Annuler</Link>
          <button type="submit" disabled={!file} style={{ padding: "10px 24px", background: !file ? "#c4b5fd" : "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: !file ? "not-allowed" : "pointer", boxShadow: !file ? "none" : "0 2px 8px rgba(124,58,237,0.35)" }}>
            Aperçu avant création →
          </button>
        </div>
      </form>
    </div>
  )
}
