"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { teamCall } from "./team-api";

type Invitation = {
  id: string;
  status: string;
  createdAt: string;
  user: { participantId: string; profile: { fullName: string } | null };
};
export function SentTeamInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInvitations(await teamCall<Invitation[]>("recruitment/sent"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load sent invitations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function revoke(id: string) {
    setBusy(id);
    setError("");
    try {
      await teamCall(`recruitment/${id}/revoke`, {});
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not revoke invitation.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="grid gap-4">
      <h3 className="font-semibold">Sent invitations</h3>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Loader2
          className="animate-spin"
          size={22}
          aria-label="Loading invitations"
        />
      ) : invitations.length ? (
        <ul className="divide-y divide-gray-200">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <h4 className="break-words font-medium">
                  {invitation.user.profile?.fullName ??
                    invitation.user.participantId}
                </h4>
                <p className="mt-1 text-xs text-gray-500">
                  {invitation.user.participantId}
                </p>
                <p className="mt-2 text-xs capitalize text-gray-500">
                  {invitation.status.toLowerCase()} /{" "}
                  {new Date(invitation.createdAt).toLocaleDateString()}
                </p>
              </div>
              {invitation.status === "PENDING" && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-4 text-sm disabled:opacity-50"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    void revoke(invitation.id);
                  }}
                >
                  {busy === invitation.id ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Undo2 size={16} />
                  )}
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-sm text-gray-500">No sent invitations yet.</p>
      )}
    </section>
  );
}
