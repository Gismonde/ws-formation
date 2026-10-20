import { redirect } from 'next/navigation'

// Ancienne adresse du journal d'audit
export default function AncienJournal() {
  redirect('/admin/audit')
}
