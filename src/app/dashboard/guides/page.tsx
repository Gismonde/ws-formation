import ListeCommunications from '@/components/ListeCommunications'

export const dynamic = 'force-dynamic'

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ pour?: string }> }) {
  const { pour } = await searchParams
  return <ListeCommunications categorie="guide" pour={pour === 'patients' ? 'patients' : 'employes'} />
}
