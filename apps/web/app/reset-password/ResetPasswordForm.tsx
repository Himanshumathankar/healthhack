"use client";
import { Loader2, LockKeyhole } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type SyntheticEvent } from "react";
import { resetPasswordSchema } from "@healthhack/contracts";
export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      token,
    };
    try {
      const parsed = resetPasswordSchema.safeParse(body);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ?? "Check your password.",
        );
      const api =
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
      const response = await fetch(`${api}/api/v1/identity/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? "Could not reset password.");
      }
      window.localStorage.removeItem("healthhack.sessionToken");
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not reset password.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto grid min-h-screen max-w-lg content-center gap-5 px-6 py-8">
      <LockKeyhole size={30} className="text-[#106b5f]" />
      <h1 className="text-2xl font-semibold">
        {done ? "Password reset" : "Create a new password"}
      </h1>
      {done ? (
        <a className="text-[#106b5f] underline" href="/login">
          Sign in with your new password
        </a>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <p className="text-sm text-gray-600">
            Use at least 12 characters, uppercase and lowercase letters, a
            number and a special character.
          </p>
          <label className="grid gap-2 text-sm">
            <span>New password</span>
            <input
              className="rounded border border-gray-300 px-3 py-2"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Confirm password</span>
            <input
              className="rounded border border-gray-300 px-3 py-2"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-[#106b5f] px-4 text-white disabled:opacity-50"
            type="submit"
            disabled={busy || !token}
          >
            {busy && <Loader2 className="animate-spin" size={16} />}Reset
            password
          </button>
          {!token && (
            <p className="text-sm text-red-700">
              The reset link is missing its token.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
