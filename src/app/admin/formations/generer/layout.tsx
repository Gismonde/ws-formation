import { EnteteCreation } from '@/components/EnteteCreation'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 20px' }}><EnteteCreation depart="document" /></div>{children}</>
}
