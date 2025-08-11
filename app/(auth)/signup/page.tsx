import { signUp } from "../../actions/auth";

export default function SignupPage() {
  return (
    <main className="min-h-screen grid place-items-center">
      <form action={signUp} className="w-80 space-y-3">
        <h1 className="text-2xl font-bold">Sign up</h1>
        <input name="email" type="email" placeholder="Email" className="w-full border p-2 rounded" />
        <input name="password" type="password" placeholder="Password" className="w-full border p-2 rounded" />
        <button className="w-full border p-2 rounded">Create account</button>
        <a href="/login" className="text-sm underline">Already have an account?</a>
      </form>
    </main>
  );
}
