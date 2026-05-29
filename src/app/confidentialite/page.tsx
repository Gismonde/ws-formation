import Link from 'next/link'
import React from 'react'

export const metadata = {
  title: 'Politique de confidentialite | WS Formation',
  description: 'Politique de confidentialite conforme a la Loi 25 du Quebec.',
}

export default function ConfidentialitePage() {
  const today = '29 mai 2026'
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', color: '#1a1f36', lineHeight: '1.7' }}>

      <div style={{ marginBottom: '40px' }}>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none' }}>&larr; Retour au tableau de bord</Link>
        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '16px 0 8px' }}>Politique de confidentialite</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
          Conforme a la <strong>Loi 25</strong> &mdash; Loi modernisant des dispositions legislatives en matiere de protection des renseignements personnels (Quebec)<br />
          Derniere mise a jour : <strong>{today}</strong>
        </p>
      </div>

      <Section title="1. Responsable de la protection des renseignements personnels (RPP)">
        <p>
          Conformement a l&apos;article 3.1 de la Loi 25, WS Formation a designe un <strong>Responsable de la protection des renseignements personnels (RPP)</strong>.
        </p>
        <InfoBox>
          <strong>Titre :</strong> Responsable de la protection des renseignements personnels<br />
          <strong>Courriel :</strong> <a href="mailto:confidentialite@wssurgical.com" style={{ color: '#6366f1' }}>confidentialite@wssurgical.com</a><br />
          <strong>Organisation :</strong> WS Formation / WS Surgical<br />
        </InfoBox>
        <p>
          Toute demande d&apos;acces, de rectification, de portabilite ou d&apos;effacement doit etre adressee au RPP.
        </p>
      </Section>

      <Section title="2. Renseignements personnels collectes">
        <p>Les renseignements personnels suivants sont collectes :</p>
        <Table rows={[
          ["Nom et prenom", "Identification de l'employe"],
          ["Adresse courriel", "Authentification et communications"],
          ["Departement", "Gestion des formations par departement"],
          ["Progression dans les formations", "Suivi de la conformite reglementaire"],
          ["Certificats obtenus", "Preuve de completion (CNESST, assurances)"],
          ["Adresse IP", "Securite et audit immuable (exigence legale)"],
          ["Horodatage des connexions", "Tracabilite et audit (exigence legale)"],
          ["Preuves de formation externe", "Validation des acquis hors plateforme"],
        ]} />
      </Section>

      <Section title="3. Finalites de la collecte">
        <ul style={{ paddingLeft: '20px' }}>
          <li>Gestion des formations obligatoires (CNESST, securite au travail)</li>
          <li>Conformite reglementaire aupres des organismes d&apos;inspection</li>
          <li>Emission de certificats de completion</li>
          <li>Securite de la plateforme et detection des fraudes</li>
          <li>Conservation d&apos;un journal d&apos;audit immuable (5 ans minimum, exigence legale)</li>
        </ul>
      </Section>

      <Section title="4. Duree de conservation">
        <Table rows={[
          ["Donnees de profil employe actif", "Duree de l'emploi + 5 ans"],
          ["Progressions et resultats", "5 ans apres la derniere activite"],
          ["Certificats", "5 ans (exigence CNESST / assurances)"],
          ["Journal d'audit (audit logs)", "5 ans - purge automatique mensuelle via pg_cron"],
          ["Adresses IP dans les logs", "5 ans (inclus dans l'audit log)"],
          ["Donnees d'un employe inactif", "Anonymisation ou suppression sur demande au RPP"],
        ]} />
      </Section>

      <Section title="5. Hebergement et fournisseurs tiers (EFVP)">
        <Table rows={[
          ["Supabase (base de donnees)", "Canada Central - ca-central-1 (Montreal, Quebec)", "Donnees au repos au Canada"],
          ["Vercel (hebergement application)", "Serveurs distribues (transit uniquement)", "Aucune persistance hors Canada"],
        ]} headers={["Fournisseur", "Localisation", "EFVP"]} />
        <p style={{ marginTop: '16px', fontSize: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px' }}>
          <strong>Resultat EFVP :</strong> Les donnees personnelles au repos demeurent exclusivement dans la region canadienne de Supabase (ca-central-1, Montreal). Risque residuel juge <strong>faible</strong>.
        </p>
      </Section>

      <Section title="6. Vos droits (art. 27, 28 et 28.1 Loi 25)">
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>Droit d&apos;acces :</strong> Consulter l&apos;ensemble de vos renseignements personnels.</li>
          <li><strong>Droit de rectification :</strong> Corriger des informations inexactes.</li>
          <li><strong>Droit a la portabilite :</strong> Exporter votre dossier complet (format JSON).</li>
          <li><strong>Droit a l&apos;effacement :</strong> Demander la suppression de vos donnees, sous reserve des obligations legales de conservation.</li>
          <li><strong>Droit de plainte :</strong> Deposer une plainte aupres de la CAI.</li>
        </ul>
        <p style={{ marginTop: '12px' }}>
          Delai de reponse : <strong>30 jours</strong> conformement a la Loi 25.<br />
          Contact RPP : <a href="mailto:confidentialite@wssurgical.com" style={{ color: '#6366f1' }}>confidentialite@wssurgical.com</a>
        </p>
      </Section>

      <Section title="7. Securite des renseignements personnels">
        <ul style={{ paddingLeft: '20px' }}>
          <li>Authentification securisee via Supabase Auth (JWT, chiffrement des mots de passe)</li>
          <li>Controle d&apos;acces par role (admin, gestionnaire, employe)</li>
          <li>Row Level Security (RLS) sur toutes les tables</li>
          <li>Chiffrement en transit (HTTPS/TLS) et au repos (AES-256)</li>
          <li>Journal d&apos;audit immuable (INSERT uniquement)</li>
          <li>Purge automatique des logs apres 5 ans (pg_cron)</li>
        </ul>
      </Section>

      <Section title="8. Contact et recours">
        <p>
          RPP : <a href="mailto:confidentialite@wssurgical.com" style={{ color: '#6366f1' }}>confidentialite@wssurgical.com</a>
        </p>
        <p>
          Commission d&apos;acces a l&apos;information du Quebec (CAI) :<br />
          <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>www.cai.gouv.qc.ca</a> &mdash; 1 888 528-7741
        </p>
      </Section>

    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1f36', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '16px' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', fontSize: '14px', lineHeight: '1.8' }}>
      {children}
    </div>
  )
}

function Table({ rows, headers }: { rows: string[][]; headers?: string[] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        {headers && (
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#6b7280', fontSize: '12px', borderBottom: '2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 14px', color: j === 0 ? '#111827' : '#4b5563', fontWeight: j === 0 ? '600' : '400' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
        }
