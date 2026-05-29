export default function LoginPage({
  searchParams,
}: {
  searchParams: any
}) {
  const errorMsg = searchParams?.error === 'archived'
    ? 'Votre compte a été désactivé. Contactez votre administrateur.'
    : searchParams?.error
    ? 'Email ou mot de passe incorrect'
    : null

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f4ff',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏥</div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', color: '#1e40af' }}>WS Formation</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Plateforme de formations en ligne</p>
        </div>

        <form method="POST" action="/api/auth/login">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              placeholder="votre@email.com"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
              Mot de passe
            </label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              placeholder="••••••••"
            />
          </div>

          {errorMsg && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '10px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#1e40af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  )
}
