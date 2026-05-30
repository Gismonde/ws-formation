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
  const [error, setError] = useState("")

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ]
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/.(pptx?|ppt)$/i)) {
      setError("Veuillez sélectionner un fichier PowerPoint (.ppt ou .pptx)")
      return
    }
    setError("")
    setFile(selectedFile)
    if (!titre) setTitre(selectedFile.name.replace(/.(pptx?|ppt)$/i, ""))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    handleFileChange(droppedFile)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError("Veuillez sélectionner un fichier PowerPoint"); return }
    if (!titre.trim()) { setError("Veuillez saisir un titre pour la formation"); return }

    setIsLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("titre", titre)
      formData.append("categorie", categorie)
      formData.append("niveau", niveau)

      const res = await fetch("/api/formations/depuis-pp", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur lors de la création de la formation")
      }

      const data = await res.json()
      router.push(`/admin/formations/${data.id}`)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
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
            border: `2px dashed ${isDragging ? "#7c3aed" : file ? "#16a34a" : "#d1d5db"}`,
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
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
              Titre de la formation *
            </label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Sécurité au travail — Niveau 1"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
              Catégorie
            </label>
            <input
              type="text"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Ex : Santé & Sécurité"
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
              Niveau
            </label>
            <select
              value={niveau}
              onChange={(e) => setNiveau(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                background: "#fff",
                boxSizing: "border-box",
              }}
            >
              <option value="debutant">Débutant</option>
              <option value="intermediaire">Intermédiaire</option>
              <option value="avance">Avancé</option>
            </select>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            color: "#dc2626",
            fontSize: "14px",
            marginBottom: "20px",
          }}>
            ⚠️ {error}
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
