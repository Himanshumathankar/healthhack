"use client";

import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { useEffect, useState, type SyntheticEvent } from "react";
import { registerSchema } from "@healthhack/contracts";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const inputClass = "min-w-0 rounded-md border border-slate-300 px-3 py-2";

export function RegisterForm() {
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setAvailability("");
      return;
    }
    setAvailability("Checking username...");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(
        `${api}/api/v1/identity/username-availability?username=${encodeURIComponent(username)}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not check username.");
          const body = (await response.json()) as { available: boolean };
          setAvailability(
            body.available ? "Username available" : "Username already taken",
          );
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setAvailability("Could not check username.");
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const parsed = registerSchema.safeParse(payload);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ?? "Check your account details.",
        );
      const response = await fetch(`${api}/api/v1/identity/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "Could not create account.");
      }
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create account.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="grid gap-4" role="status">
        <MailCheck size={36} className="text-[#106b5f]" />
        <h2 className="text-2xl font-semibold">Check your email</h2>
        <p>
          We sent a verification link to {email}. It is valid for 24 hours and
          can be used once.
        </p>
        <p className="text-sm text-slate-600">
          Verify your email to continue your registration.
        </p>
      </div>
    );

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {["firstName", "middleName", "lastName"].map((name, index) => (
          <label className="grid min-w-0 gap-2" key={name}>
            <span className="text-sm font-medium">
              {["First name", "Middle name (optional)", "Last name"][index]}
            </span>
            <input
              className={inputClass}
              name={name}
              autoComplete={
                ["given-name", "additional-name", "family-name"][index]
              }
              maxLength={60}
              required={index !== 1}
            />
          </label>
        ))}
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Email address</span>
        <input
          className={inputClass}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          required
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Username</span>
        <input
          className={inputClass}
          name="username"
          autoComplete="username"
          pattern="[a-zA-Z0-9_]{3,30}"
          title="3-30 letters, numbers or underscores"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
          }}
          required
        />
        <span className="text-sm text-slate-600" aria-live="polite">
          {availability ||
            "3-30 letters, numbers or underscores. Uppercase and lowercase count as the same username."}
        </span>
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Create password</span>
        <input
          className={inputClass}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          required
        />
      </label>
      <ul
        className="grid gap-1 text-sm text-slate-600"
        aria-label="Password requirements"
      >
        {[
          [password.length >= 12, "At least 12 characters"],
          [
            /[A-Z]/.test(password) && /[a-z]/.test(password),
            "Uppercase and lowercase letters",
          ],
          [/[0-9]/.test(password), "A number"],
          [/[^a-zA-Z0-9]/.test(password), "A special character"],
        ].map(([met, label]) => (
          <li key={String(label)} className={met ? "text-[#106b5f]" : ""}>
            {met ? "Met: " : "Required: "}
            {label}
          </li>
        ))}
      </ul>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Confirm password</span>
        <input
          className={inputClass}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#106b5f] px-4 font-medium text-white disabled:opacity-60"
        disabled={busy || availability === "Username already taken"}
        type="submit"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <ArrowRight size={18} />
        )}
        Create account
      </button>
    </form>
  );
}
