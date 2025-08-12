import { redirect } from 'next/navigation'
import { createClientServer } from '../../lib/supabase'
import { signOut } from '../actions/auth'

export default async function Dashboard() {
  const supabase = createClientServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/auth/login')

  return (
    <main className="min-h-screen grid place-items-center">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Welcome, {data.user.email}</h1>
        <form action={signOut}>
          <button className="border px-4 py-2 rounded">Sign out</button>
        </form>
      </div>
    </main>
  )
}
