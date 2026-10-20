import Link from 'next/link'
import React from 'react'
import { i18n } from '@/lib/i18n/serveur'

export const metadata = {
  title: 'Politique de confidentialité | WS Formation',
  description: 'Politique de confidentialité conforme à la Loi 25 du Québec.',
}

export default async function ConfidentialitePage() {
  const { t, langue } = await i18n()
  const today = '29 mai 2026'
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: 'clamp(24px, 6vw, 48px) 16px', fontFamily: 'system-ui, sans-serif', color: '#1a1f36', lineHeight: '1.7' }}>

      <div style={{ marginBottom: '40px' }}>
        <Link href="/dashboard/accueil" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none' }}>{t('← Retour à l’accueil')}</Link>
        {langue === 'en' && (
          <p lang="en" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', margin: '16px 0 0' }}>
            {t('Cette politique est rédigée en français.')}
          </p>
        )}
        <h1 lang="fr" style={{ fontSize: '28px', fontWeight: '700', margin: '16px 0 8px' }}>Politique de confidentialité</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
          Conforme à la <strong>Loi 25</strong> &mdash; Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (Québec)<br />
          Dernière mise à jour : <strong>{today}</strong>
        </p>
      </div>

      <Section title="1. Responsable de la protection des renseignements personnels (RPP)">
        <p>
          Conformément à l&apos;article 3.1 de la Loi 25, WS Formation a désigné un <strong>Responsable de la protection des renseignements personnels (RPP)</strong>.
        </p>
        <InfoBox>
          <strong>Titre :</strong> Responsable de la protection des renseignements personnels<br />
          <strong>Courriel :</strong> <a href="mailto:confidentialite@wssurgical.com" style={{ color: '#6366f1' }}>confidentialite@wssurgical.com</a><br />
          <strong>Organisation :</strong> WS Formation / WS Surgical<br />
        </InfoBox>
        <p>
          Toute demande d&apos;accès, de rectification, de portabilité ou d&apos;effacement doit être adressée au RPP.
        </p>
      </Section>

      <Section title="2. Renseignements personnels collectés">
        <p>Les renseignements personnels suivants sont collectés :</p>
        <Table rows={[
          ["Nom et prénom", "Identification de l'employé"],
          ["Adresse courriel", "Authentification et communications"],
          ["Département", "Gestion des formations par département"],
          ["Progression dans les formations", "Suivi de la conformité réglementaire"],
          ["Certificats obtenus", "Preuve de réussite (CNESST, assurances)"],
          ["Adresse IP", "Sécurité et audit immuable (exigence légale)"],
          ["Horodatage des connexions", "Traçabilité et audit (exigence légale)"],
          ["Preuves de formation externe", "Validation des acquis hors plateforme"],
        ]} />
      </Section>

      <Section title="3. Finalités de la collecte">
        <ul style={{ paddingLeft: '20px' }}>
          <li>Gestion des formations obligatoires (CNESST, sécurité au travail)</li>
          <li>Conformité réglementaire auprès des organismes d&apos;inspection</li>
          <li>Émission de certificats de réussite</li>
          <li>Sécurité de la plateforme et détection des fraudes</li>
          <li>Conservation d&apos;un journal d&apos;audit immuable (5 ans minimum, exigence légale)</li>
        </ul>
      </Section>

      <Section title="4. Durée de conservation">
        <Table rows={[
          ["Données de profil d'un employé actif", "Durée de l'emploi + 5 ans"],
          ["Progressions et résultats", "5 ans après la dernière activité"],
          ["Certificats", "5 ans (exigence CNESST / assurances)"],
          ["Journal d'audit (audit logs)", "5 ans — purge automatique mensuelle (pg_cron)"],
          ["Adresses IP dans les logs", "5 ans (inclus dans l'audit log)"],
          ["Données d'un employé inactif", "Anonymisation ou suppression sur demande au RPP"],
        ]} />
      </Section>

      <Section title="5. Hébergement et fournisseurs tiers (EFVP)">
        <Table rows={[
          ["Supabase (base de données)", "Canada Central — ca-central-1 (Montréal, Québec)", "Données au repos au Canada"],
          ["Vercel (hébergement de l'application)", "Serveurs distribués (transit uniquement)", "Aucune persistance hors Canada"],
        ]} headers={["Fournisseur", "Localisation", "EFVP"]} />
        <p style={{ marginTop: '16px', fontSize: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px' }}>
          <strong>Résultat EFVP :</strong> Les données personnelles au repos demeurent exclusivement dans la région canadienne de Supabase (ca-central-1, Montréal). Risque résiduel jugé <strong>faible</strong>.
        </p>
      </Section>

      <Section title="6. Vos droits (art. 27, 28 et 28.1 Loi 25)">
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>Droit d&apos;accès :</strong> Consulter l&apos;ensemble de vos renseignements personnels.</li>
          <li><strong>Droit de rectification :</strong> Corriger des informations inexactes.</li>
          <li><strong>Droit à la portabilité :</strong> Exporter votre dossier complet (format JSON).</li>
          <li><strong>Droit à l&apos;effacement :</strong> Demander la suppression de vos données, sous réserve des obligations légales de conservation.</li>
          <li><strong>Droit de plainte :</strong> Déposer une plainte auprès de la CAI.</li>
        </ul>
        <p style={{ marginTop: '12px' }}>
          Délai de réponse : <strong>30 jours</strong>, conformément à la Loi 25.<br />
          Contact RPP : <a href="mailto:confidentialite@wssurgical.com" style={{ color: '#6366f1' }}>confidentialite@wssurgical.com</a>
        </p>
      </Section>

      <Section title="7. Sécurité des renseignements personnels">
        <ul style={{ paddingLeft: '20px' }}>
          <li>Authentification sécurisée via Supabase Auth (JWT, chiffrement des mots de passe)</li>
          <li>Contrôle d&apos;accès par rôle (admin, gestionnaire, employé)</li>
          <li>Sécurité au niveau des lignes (RLS) sur toutes les tables</li>
          <li>Chiffrement en transit (HTTPS/TLS) et au repos (AES-256)</li>
          <li>Journal d&apos;audit immuable (INSERT uniquement)</li>
          <li>Purge automatique des journaux après 5 ans (pg_cron)</li>
        </ul>
      </Section>

      <Section title="8. Contact et recours">
        <p>
          RPP : <a href="mailto:confidentialite@wssurgical.com" style={{ color: '#6366f1' }}>confidentialite@wssurgical.com</a>
        </p>
        <p>
          Commission d&apos;accès à l&apos;information du Québec (CAI) :<br />
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
