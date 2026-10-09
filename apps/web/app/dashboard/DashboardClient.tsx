"use client";

import { MailWarning, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RegistrationSteps } from "./RegistrationSteps";

import { DashboardShell, type DashboardUser } from "./DashboardShell";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  async function resendVerification() {
    setResending(true);
    setResendMessage("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/identity/resend-verification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${window.localStorage.getItem("healthhack.sessionToken") ?? ""}`,
          },
        },
      );
      const body: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          getApiMessage(body) ?? "Could not send verification email.",
        );
      setResendMessage(
        "Verification email sent. Your new link is valid for 24 hours.",
      );
    } catch (caught) {
      setResendMessage(
        caught instanceof Error
          ? caught.message
          : "Could not send verification email.",
      );
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    const token = window.localStorage.getItem("healthhack.sessionToken");
    if (!token) {
      router.replace("/login");
      return;
    }

    fetch(`${apiBaseUrl}/api/v1/identity/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) {
            window.localStorage.removeItem("healthhack.sessionToken");
            router.replace("/login");
          }
          const body: unknown = await response.json().catch(() => null);
          throw new Error(getApiMessage(body) ?? "Could not load dashboard.");
        }
        return response.json() as Promise<DashboardUser>;
      })
      .then((loadedUser) => {
        if (
          (loadedUser.globalRole || loadedUser.organizationRoleId) &&
          new URL(window.location.href).searchParams.get("workspace") !==
            "participant"
        ) {
          router.replace("/admin");
          return;
        }
        setUser(loadedUser);
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load dashboard.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router, completed, refreshVersion]);

  function signOut() {
    window.localStorage.removeItem("healthhack.sessionToken");
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7fbfb] text-[#10201f]">
        <div className="inline-flex items-center gap-3 text-sm text-slate-600">
          <RefreshCw aria-hidden className="animate-spin" size={18} />
          Loading dashboard
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="mx-auto grid min-h-screen max-w-xl content-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Dashboard unavailable</h1>
        <p className="text-slate-600">{error ?? "Please sign in again."}</p>
        <a
          className="w-fit rounded-md bg-[#106b5f] px-4 py-2 font-medium text-white"
          href="/login"
        >
          Sign in
        </a>
      </main>
    );
  }

  return (
    <DashboardShell
      user={user}
      completed={completed}
      signOut={signOut}
      onRefresh={() => {
        setRefreshVersion((version) => version + 1);
      }}
    >
      {!user.emailVerifiedAt ? (
        <div className="grid gap-4">
          <MailWarning className="text-amber-600" size={28} />
          <h2 className="font-semibold">Verify your email</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Check your inbox and confirm your email using the verification link.
            The link expires after 24 hours.
          </p>
          <button
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[#106b5f] disabled:opacity-50"
            type="button"
            disabled={resending}
            onClick={() => {
              void resendVerification();
            }}
          >
            <RefreshCw size={16} className={resending ? "animate-spin" : ""} />
            Resend verification email
          </button>
          {resendMessage && (
            <p className="text-sm" role="status">
              {resendMessage}
            </p>
          )}
        </div>
      ) : !user.profile?.registrationCompletedAt && !completed ? (
        <RegistrationSteps
          profile={user.profile}
          onComplete={() => {
            setCompleted(true);
          }}
        />
      ) : null}
    </DashboardShell>
  );
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
