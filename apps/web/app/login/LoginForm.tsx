"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SyntheticEvent, useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      identifier: getFormString(formData, "email"),
      password: getFormString(formData, "password"),
    };

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/identity/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(getApiMessage(body) ?? "Could not sign in.");
      }

      const auth = (await response.json()) as {
        sessionToken: string;
        user: { organizationAccess: boolean };
      };
      window.localStorage.setItem("healthhack.sessionToken", auth.sessionToken);
      router.push(auth.user.organizationAccess ? "/admin" : "/dashboard");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">
          Email or username
        </span>
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="email"
          autoComplete="username"
          required
          type="text"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          name="password"
          required
          type="password"
        />
      </label>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#106b5f] px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden className="animate-spin" size={18} />
        ) : (
          <ArrowRight aria-hidden size={18} />
        )}
        Sign in
      </button>
    </form>
  );
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getApiMessage(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return undefined;
}
