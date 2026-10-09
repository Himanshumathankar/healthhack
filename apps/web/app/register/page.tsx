import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold">
          Create your HealthHack account
        </h1>
      </div>
      <RegisterForm />
      <p className="text-sm text-slate-600">
        Already registered?{" "}
        <a className="font-medium text-[#106b5f]" href="/login">
          Sign in
        </a>
      </p>
    </main>
  );
}
