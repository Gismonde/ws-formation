"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function DepuisPPPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [titre, setTitre] = useState("")
  const [categorie, setCategorie] = useState("")
  const [niveau, setNiveau] = useState("debutant")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string[]>([])
  // Enrichissement
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [objectifs, setObjectifs] = useState<string[]>([])
  const [objectifInput, setObjectifInput] = useState("")
  const [imageCouverture, setImageCouverture] = useState<string | null>(null)

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
    const droppedFile = e.dataTransfer.files[0]
    handleFileChange(droppedFile)
  }

  const handleCoverUpload = async (f: File) => {
    const fd = new FormData()
    fd.append("file", f)
    const res = await fetch("/api/upload-lesson-image", { method: "POST", body: fd })
    const d = await res.json()
    if (d.url) setImageCouverture(d.url)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    if (!file) errs.push("Veuillez sélectionner un fichier PowerPoint")
    if (!titre.trim()) errs.push("Veuillez saisir un titre pour la formation")
    if (errs.length > 0) { setError(errs); return }

    setIsLoading(true)
    setError([])

    try {
      const formData = new FormData()
      formData.append("file", file!)
      formData.append("titre", titre)
      formData.append("categorie", categorie)
      formData.append("niveau", niveau)
      formData.append("tags", JSON.stringify(tags))
      formData.append("objectifs", JSON.stringify(objectifs))
      if (imageCouverture) formData.append("image_couverture", imageCouverture)

      const res = await fetch("/api/import-pptx", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur lors de la création de la formation")
      }

      const data = await res.json()
      router.push("/admin/formations/" + data.id)
    } catch (err: any) {
      setError([err.message])
      setIsLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "6px",
  }
  const btnSecStyle: React.CSSProperties = {
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "13px",
    cursor: "pointer",
  }
  const btnDangerStyle: React.CSSProperties = {
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    borderRadius: "4px",
    padding: "3px 8px",
    fontSize: "12px",
    cursor: "pointer",
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <Link href="/admin/formations" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          background: "#f3f4f6",
          color: "#374151",
          borderRadius: "8px",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: "500",
        }}>
          ← Retour
        </Link>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#111827", margin: 0 }}>
            Créer depuis un PowerPoint
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: "4px 0 0 0" }}>
            Importez un fichier .ppt ou .pptx pour générer une formation
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Zone upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed " + (isDragging ? "#7c3aed" : file ? "#16a34a" : "#d1d5db"),
            borderRadius: "16px",
            padding: "48px 32px",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging ? "#f5f3ff" : file ? "#f0fdf4" : "#fafafa",
            transition: "all 0.2s",
            marginBottom: "28px",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            style={{ display: "none" }}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />

          {file ? (
            <div>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📊</div>
              <p style={{ fontWeight: "600", color: "#16a34a", fontSize: "16px", margin: "0 0 4px" }}>{file.name}</p>
              <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB · Cliquez pour changer
              </p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📂</div>
              <p style={{ fontWeight: "600", color: "#374151", fontSize: "16px", margin: "0 0 8px" }}>
                Glissez votre fichier PowerPoint ici
              </p>
              <p style={{ color: "#9ca3af", fontSize: "14px", margin: "0 0 16px" }}>
                ou cliquez pour parcourir vos fichiers
              </p>
              <span style={{
                display: "inline-block",
                padding: "6px 14px",
                background: "#7c3aed",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
              }}>
                Choisir un fichier .ppt / .pptx
              </span>
            </div>
          )}
        </div>

        {/* Informations de la formation */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          border: "1px solid #e5e7eb",
          padding: "28px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 20px" }}>
            Informations de la formation
          </h2>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Titre de la formation *</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Sécurité au travail — Niveau 1"
              style={{ ...inputStyle, borderColor: !titre.trim() ? "#ef4444" : "#d1d5db" }}
            />
            {!titre.trim() && <p style={{ color: "#dc2626", fontSize: "11px", margin: "2px 0 0" }}>Titre requis</p>}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Catégorie</label>
            <input
              type="text"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Ex : Santé & Sécurité"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Niveau</label>
            <select
              value={niveau}
              onChange={(e) => setNiveau(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", background: "#fff" }}
            >
              <option value="debutant">Débutant</option>
              <option value="intermediaire">Intermédiaire</option>
              <option value="avance">Avancé</option>
            </select>
          </div>
        </div>

        {/* Enrichissement */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          border: "1px solid #e5e7eb",
          padding: "28px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#111827", margin: "0 0 20px" }}>
            Enrichissement (optionnel)
          </h2>
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
                  <input id="cover-img-pp" type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                    const f = e.target.files?.[0]
                    if (f) await handleCoverUpload(f)
                  }} />
                </label>
              )}
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags / mots-clés</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
                {tags.map((tag, ti) => (
                  <span key={ti} style={{ background: "#ede9fe", color: "#5b21b6", fontSize: "12px", padding: "2px 8px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "3px" }}>
                    {tag}
                    <button type="button" onClick={() => setTags(prev => prev.filter((_, i) => i !== ti))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: "13px", padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                      e.preventDefault()
                      setTags(p => [...p, tagInput.trim()])
                      setTagInput("")
                    }
                  }}
                  placeholder="Tag (Entrée ou virgule pour ajouter)"
                />
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
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={objectifInput}
                  onChange={e => setObjectifInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && objectifInput.trim()) {
                      e.preventDefault()
                      setObjectifs(p => [...p, objectifInput.trim()])
                      setObjectifInput("")
                    }
                  }}
                  placeholder="Ex: utiliser le logiciel X..."
                />
                <button type="button" onClick={() => { if (objectifInput.trim()) { setObjectifs(p => [...p, objectifInput.trim()]); setObjectifInput("") } }} style={{ ...btnSecStyle, padding: "6px 12px" }}>+</button>
              </div>
            </div>

          </div>
        </div>

        {/* Erreurs */}
        {error.length > 0 && (
          <div style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            color: "#dc2626",
            fontSize: "14px",
            marginBottom: "20px",
          }}>
            {error.map((e, i) => <div key={i}>⚠️ {e}</div>)}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <Link href="/admin/formations" style={{
            padding: "10px 20px",
            background: "#f3f4f6",
            color: "#374151",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: "500",
          }}>
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isLoading || !file}
            style={{
              padding: "10px 24px",
              background: isLoading || !file ? "#c4b5fd" : "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: isLoading || !file ? "not-allowed" : "pointer",
              boxShadow: isLoading || !file ? "none" : "0 2px 8px rgba(124,58,237,0.35)",
            }}
          >
            {isLoading ? "Création en cours..." : "📊 Créer la formation"}
          </button>
        </div>
      </form>
    </div>
  )
}
