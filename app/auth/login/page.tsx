import { login } from './actions' // adjust path if needed

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">Log in</h1>

      <form action={login} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-gray-900 text-white px-3 py-2 text-sm hover:bg-gray-800"
        >
          Log in
        </button>
      </form>
    </main>
  )
}
