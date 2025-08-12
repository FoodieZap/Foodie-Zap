'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadUser() {
      // Get the current user session
      const { data } = await supabase.auth.getUser()
      const user = data.user

      if (!isMounted) return

      // Redirect to /login if no user
      if (!user) {
        router.replace('/auth/login')
        return
      }

      setEmail(user.email ?? null)
      setLoading(false)
    }

    loadUser()

    // Session listener for login/logout events
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.replace('/auth/login')
      }
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  if (loading) {
    return <main className="p-6 text-gray-600">Loading…</main>
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-700">Signed in as {email}</p>

      <button
        onClick={signOut}
        className="mt-6 rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
      >
        Sign out
      </button>
    </main>
  )
}
