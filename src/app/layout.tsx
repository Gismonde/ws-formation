import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
  title: "WS Formation",
  description: "Plateforme de formations en ligne",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh", margin: 0 }}>
        <main style={{ flex: 1 }}>
          {children}
        </main>

        <footer style={{
          borderTop: "1px solid #e5e7eb",
          padding: "16px 24px",
          background: "#f9fafb",
          fontSize: "12px",
          color: "#6b7280",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}>
          <span>
            &copy; {new Date().getFullYear()} WS Formation &mdash; Conforme a la Loi 25 (Quebec)
          </span>
          <span style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Link href="/confidentialite" style={{ color: "#6b7280", textDecoration: "underline" }}>
              Politique de confidentialite
            </Link>
            <a href="mailto:confidentialite@wssurgical.com" style={{ color: "#6b7280", textDecoration: "underline" }}>
              RPP: confidentialite@wssurgical.com
            </a>
          </span>
        </footer>
      </body>
    </html>
  )
}
