"use client";

import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function VerifyEmailClient() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  async function verify() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${api}/api/v1/identity/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await response.json()) as {
        sessionToken: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.message ?? "This link is invalid or expired.");
      window.localStorage.setItem("healthhack.sessionToken", body.sessionToken);
      setVerified(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not verify email.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto grid min-h-screen max-w-xl content-center gap-5 px-6">
      {verified ? (
        <CheckCircle2 className="text-[#106b5f]" size={36} />
      ) : (
        <MailCheck className="text-[#106b5f]" size={36} />
      )}
      <h1 className="text-3xl font-semibold">
        {verified ? "Email verified" : "Verify your email"}
      </h1>
      <p className="text-slate-600">
        {verified
          ? "Your email is confirmed. Continue with your education and skills."
          : "Confirm your email address to continue registration. This link expires after 24 hours."}
      </p>
      {(!token || error) && (
        <p role="alert" className="text-red-700">
          {error || "This verification link is missing its token."}
        </p>
      )}
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#106b5f] px-4 text-white disabled:opacity-60"
        disabled={busy || !token}
        onClick={() => {
          if (verified) router.push("/dashboard");
          else void verify();
        }}
        type="button"
      >
        {busy && <Loader2 size={18} className="animate-spin" />}
        {verified ? "Continue registration" : "Verify email"}
      </button>
      {error && (
        <a href="/login" className="text-[#106b5f] underline">
          Return to sign in
        </a>
      )}
    </main>
  );
}
