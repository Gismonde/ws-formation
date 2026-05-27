import Link from 'next/link'

export default function ConformitePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Conformité</h1>
        <p className="text-gray-500 mb-8">Suivi de la conformité réglementaire des employés.</p>
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-gray-600 font-semibold">Module en cours de développement</p>
          <p className="text-gray-400 text-sm mt-1">Disponible prochainement</p>
        </div>
      </div>
    </div>
  )
}
