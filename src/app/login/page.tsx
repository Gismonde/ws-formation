export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">WS</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">WS Formation</h1>
          <p className="text-gray-500 mt-1">Connectez-vous à votre compte</p>
        </div>
        <form action="/api/auth/login" method="POST" className="space-y-5">
          {params.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              Email ou mot de passe incorrect.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="vous@wsformation.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition duration-200"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  )
}
