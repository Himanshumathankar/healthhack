import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold">Sign in to HealthHack</h1>
        <p className="text-sm text-slate-600">Continue to your participant dashboard.</p>
      </div>
      <LoginForm />
      <p className="text-sm text-slate-600">
        Need an account?{" "}
        <a className="font-medium text-[#106b5f]" href="/register">
          Register
        </a>
      </p>
    </main>
  );
}
