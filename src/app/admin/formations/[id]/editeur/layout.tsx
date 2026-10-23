import GardeModificationFormation from '@/components/GardeModificationFormation'

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GardeModificationFormation formationId={id}>{children}</GardeModificationFormation>
}
