import ListeHorsLigne from './ListeHorsLigne'

// Page affichée sans réseau quand la page demandée n'a pas été téléchargée.
export const dynamic = 'force-static'

export default function HorsLignePage() {
  return (
    <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <ListeHorsLigne />
    </div>
  )
}
