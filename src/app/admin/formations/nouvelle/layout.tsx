import { EnteteCreation } from '@/components/EnteteCreation'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><div className="mx-auto max-w-6xl"><EnteteCreation depart="zero" /></div>{children}</>
}
