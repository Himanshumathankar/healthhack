export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-semibold">Create your HealthHack account</h1>
      <form className="grid gap-4" action={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/identity/register`} method="post">
        <label className="grid gap-2">
          <span>Full name</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="fullName" required minLength={2} />
        </label>
        <label className="grid gap-2">
          <span>Email</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="email" required type="email" />
        </label>
        <label className="grid gap-2">
          <span>Password</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="password" required type="password" minLength={12} />
        </label>
        <button className="rounded-md bg-[#106b5f] px-4 py-3 font-medium text-white" type="submit">
          Create account
        </button>
      </form>
    </main>
  );
}
