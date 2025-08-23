import { logout } from './actions'

export default function LogoutPage() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">Log out</h1>

      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="rounded bg-gray-900 text-white px-3 py-2 text-sm hover:bg-gray-800"
        >
          Log out
        </button>
      </form>
    </main>
  )
}
