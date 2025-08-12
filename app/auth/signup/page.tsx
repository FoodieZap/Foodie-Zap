'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        router.replace('/dashboard')
      }
    }
    checkSession()
  }, [router])
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMsg(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) return setError(error.message)

    // If email confirmation is disabled, you’ll get a session immediately.
    if (data?.session) {
      router.push('/dashboard')
    } else {
      setMsg('Check your email to confirm your account.')
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Sign up</h1>
      <p className="mt-1 text-sm text-gray-600">Create your account.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Minimum 6 characters"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/auth/login" className="text-gray-900 underline">
          Log in
        </a>
      </p>
    </main>
  )
}
