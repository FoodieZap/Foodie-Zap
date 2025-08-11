import { signIn } from "../../actions/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center">
      <form action={signIn} className="w-80 space-y-3">
        <h1 className="text-2xl font-bold">Log in</h1>
        <input name="email" type="email" placeholder="Email" className="w-full border p-2 rounded" />
        <input name="password" type="password" placeholder="Password" className="w-full border p-2 rounded" />
        <button className="w-full border p-2 rounded">Sign in</button>
        <a href="/signup" className="text-sm underline">Create an account</a>
      </form>
    </main>
  );
}
