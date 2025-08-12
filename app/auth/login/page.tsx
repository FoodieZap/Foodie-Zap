import Link from 'next/link'
import { login } from './actions'

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const err = searchParams?.error

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Log in</h1>
      <p className="mt-1 text-sm text-gray-600">Use your email and password.</p>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {/* One action -> one button */}
      <form action={login} className="mt-6 space-y-4" method="post">
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="••••••••"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
        <button className="w-full rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800">
          Log in
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        No account?{' '}
        <Link href="/auth/signup" className="text-gray-900 underline">
          Sign up
        </Link>
      </p>
    </main>
  )
}
