"use client";

import { Check, Loader2, Search, Send, Users, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { teamCall } from "./team-api";
import { ProfilePreview } from "./ProfilePreview";

const primary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded bg-[#106b5f] px-4 text-sm font-medium text-white disabled:opacity-50";
const secondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-4 text-sm disabled:opacity-50";
const input =
  "min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm";
type Candidate = {
  id: string;
  participantId: string;
  invited: boolean;
  profile: {
    fullName: string;
    college: string | null;
    branch: string | null;
    discipline: string | null;
    graduationYear: number | null;
    bio: string | null;
    skillExpertise: Array<{ name: string; expertise: string }>;
  } | null;
};
type RecruitingTeam = {
  id: string;
  name: string;
  teamCode: string;
  description: string | null;
  members: number;
  capacity: number;
};
type Discovery = {
  enabled: boolean;
  sentRequests: Array<{
    id: string;
    status: string;
    createdAt: string;
    team: { id: string; name: string; teamCode: string };
  }>;
  invitations: Array<{
    id: string;
    team: {
      id: string;
      name: string;
      teamCode: string;
      members: Array<{ user: { profile: { fullName: string } | null } }>;
    };
  }>;
};

export function FindTeammates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const search = useCallback(async (value: string) => {
    setLoading(true);
    setError("");
    try {
      setCandidates(
        await teamCall<Candidate[]>(`teammates?q=${encodeURIComponent(value)}`),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load teammates.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void search("");
  }, [search]);
  async function invite(id: string) {
    setBusyId(id);
    setError("");
    try {
      await teamCall(`teammates/${id}/invite`, {});
      await search(query);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not send invitation.",
      );
      return false;
    } finally {
      setBusyId("");
    }
  }
  return (
    <section className="grid min-w-0 gap-5">
      <h3 className="font-semibold">Find teammates</h3>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search(query);
        }}
      >
        <input
          className={`${input} flex-1`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Name or college"
          aria-label="Search teammates by name or college"
          maxLength={120}
        />
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded border border-gray-200"
          type="submit"
          title="Search teammates"
          aria-label="Search teammates"
          disabled={loading}
        >
          <Search size={17} />
        </button>
      </form>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Loader2
          className="animate-spin text-[#106b5f]"
          size={22}
          aria-label="Loading teammates"
        />
      ) : candidates.length ? (
        <div className="divide-y divide-gray-200">
          {candidates.map((candidate) => (
            <article className="grid gap-3 py-5 first:pt-0" key={candidate.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="break-words font-semibold">
                    {candidate.profile?.fullName ?? candidate.participantId}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    {candidate.participantId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ProfilePreview
                    kind="participant"
                    id={candidate.id}
                    name={
                      candidate.profile?.fullName ?? candidate.participantId
                    }
                    invited={candidate.invited}
                    onInvite={async () => {
                      if (!(await invite(candidate.id)))
                        throw new Error("Could not send invitation.");
                    }}
                  />
                  <button
                    className={candidate.invited ? secondary : primary}
                    type="button"
                    disabled={candidate.invited || Boolean(busyId)}
                    onClick={() => {
                      void invite(candidate.id);
                    }}
                  >
                    {busyId === candidate.id ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : candidate.invited ? (
                      <Check size={15} />
                    ) : (
                      <Send size={15} />
                    )}
                    {candidate.invited ? "Invitation sent" : "Send invitation"}
                  </button>
                </div>
              </div>
              <p className="break-words text-sm text-gray-600">
                {[
                  candidate.profile?.college,
                  candidate.profile?.branch,
                  candidate.profile?.discipline,
                  candidate.profile?.graduationYear,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
              {candidate.profile?.bio && (
                <p className="break-words text-sm leading-relaxed text-gray-600">
                  {candidate.profile.bio}
                </p>
              )}
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                {candidate.profile?.skillExpertise.map((skill) => (
                  <li key={skill.name}>
                    <strong>{skill.name}</strong>
                    <span className="ml-2 capitalize text-gray-500">
                      {skill.expertise.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <p className="py-8 text-sm text-gray-500">
          No available participants found.
        </p>
      )}
    </section>
  );
}

export function JoinFindTeam({
  onChanged,
}: {
  onChanged: () => Promise<void>;
}) {
  const [state, setState] = useState<Discovery | null>(null);
  const [teams, setTeams] = useState<RecruitingTeam[]>([]);
  const [tab, setTab] = useState("Teams recruiting");
  const opportunityTabs = [
    "Teams recruiting",
    "Team invitations",
    "Sent invitations",
  ];
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    const [discovery, available] = await Promise.all([
      teamCall<Discovery>("discovery"),
      teamCall<RecruitingTeam[]>("recruiting"),
    ]);
    setState(discovery);
    setTeams(available);
  }, []);
  useEffect(() => {
    void load().catch((caught: unknown) => {
      setError(
        caught instanceof Error ? caught.message : "Could not load teams.",
      );
    });
  }, [load]);
  useEffect(() => {
    if (confirming) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirming]);
  async function act(path: string, body: unknown, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await teamCall(path, body);
      await load();
      await onChanged();
      setMessage(success);
      setConfirming(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not complete action.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function join(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");
    await act(
      "join-requests",
      { code },
      "Join request sent. Awaiting leader approval.",
    );
  }
  async function search(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setTeams(
        await teamCall<RecruitingTeam[]>(
          `recruiting?q=${encodeURIComponent(query)}`,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not find teams.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <label id="looking-for-team" className="font-medium">
          Want to join a team
        </label>
        <button
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${state?.enabled ? "bg-[#106b5f]" : "bg-gray-300"}`}
          type="button"
          role="switch"
          aria-checked={Boolean(state?.enabled)}
          aria-labelledby="looking-for-team"
          disabled={busy || !state}
          onClick={() => {
            if (state?.enabled)
              void act(
                "discovery",
                { enabled: false },
                "Your profile is no longer listed in Find teammates.",
              );
            else setConfirming(true);
          }}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${state?.enabled ? "left-0.5 translate-x-5" : "left-0.5"}`}
          />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-[#106b5f]">
          {message}
        </p>
      )}
      <div className="grid min-h-80 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-gray-200 pb-6 lg:border-b-0 lg:border-r lg:pr-6">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              void join(event);
            }}
          >
            <h3 className="font-semibold">Join team</h3>
            <label className="grid gap-2 text-sm">
              <span>10-digit join code</span>
              <input
                className={input}
                name="code"
                inputMode="numeric"
                pattern="[0-9]{10}"
                minLength={10}
                maxLength={10}
                required
              />
            </label>
            <button className={primary} type="submit" disabled={busy}>
              <Users size={16} />
              Request to join
            </button>
          </form>
        </aside>
        <div className="min-w-0 pt-6 lg:pl-6 lg:pt-0">
          <div
            className="mb-5 flex gap-5 overflow-x-auto border-b border-gray-200"
            role="tablist"
            aria-label="Team opportunities"
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const current = opportunityTabs.indexOf(tab);
                const index =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? opportunityTabs.length - 1
                      : event.key === "ArrowRight"
                        ? (current + 1) % opportunityTabs.length
                        : (current - 1 + opportunityTabs.length) %
                          opportunityTabs.length;
                setTab(opportunityTabs[index] ?? "Teams recruiting");
                const buttons =
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  );
                buttons[index]?.focus();
              }
            }}
          >
            {opportunityTabs.map((label, index) => (
              <button
                className={`min-h-11 shrink-0 border-b-2 text-sm font-medium ${tab === label ? "border-[#106b5f] text-[#106b5f]" : "border-transparent text-gray-500"}`}
                key={label}
                type="button"
                role="tab"
                id={`opportunities-${String(index)}`}
                aria-controls="opportunities-panel"
                aria-selected={tab === label}
                tabIndex={tab === label ? 0 : -1}
                onClick={() => {
                  setTab(label);
                }}
              >
                {label}
                {index === 1 && state?.invitations.length
                  ? ` (${String(state.invitations.length)})`
                  : ""}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="opportunities-panel"
            aria-labelledby={`opportunities-${String(opportunityTabs.indexOf(tab))}`}
            tabIndex={0}
          >
            {tab === "Teams recruiting" ? (
              <>
                <form
                  className="mb-5 flex gap-2"
                  onSubmit={(event) => {
                    void search(event);
                  }}
                >
                  <input
                    className={`${input} flex-1`}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                    }}
                    placeholder="Team name"
                    aria-label="Search recruiting teams"
                    maxLength={120}
                  />
                  <button
                    className="grid h-10 w-10 shrink-0 place-items-center rounded border border-gray-200"
                    title="Search teams"
                    aria-label="Search teams"
                    disabled={busy}
                    type="submit"
                  >
                    <Search size={17} />
                  </button>
                </form>
                <div className="divide-y divide-gray-200">
                  {teams.map((team) => (
                    <article
                      className="grid gap-3 py-5 first:pt-0"
                      key={team.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="break-words font-semibold">
                            {team.name}
                          </h4>
                          <p className="mt-1 break-words text-xs text-gray-500">
                            {team.teamCode}
                          </p>
                        </div>
                        <ProfilePreview
                          kind="team"
                          id={team.id}
                          name={team.name}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {team.members} / {team.capacity} members
                      </p>
                      {team.description && (
                        <p className="break-words text-sm text-gray-600">
                          {team.description}
                        </p>
                      )}
                      <button
                        className={`${primary} w-fit`}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void act(
                            "join-requests",
                            { teamId: team.id },
                            "Join request sent. Awaiting leader approval.",
                          );
                        }}
                      >
                        <Send size={15} />
                        Request to join
                      </button>
                    </article>
                  ))}
                  {!teams.length && (
                    <p className="py-6 text-sm text-gray-500">
                      No teams recruiting right now.
                    </p>
                  )}
                </div>
              </>
            ) : tab === "Sent invitations" ? (
              <section className="grid gap-4">
                <h3 className="font-semibold">Sent invitations</h3>
                <div className="divide-y divide-gray-200">
                  {state?.sentRequests.map((request) => (
                    <article
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div className="min-w-0">
                        <h4 className="break-words font-medium">
                          {request.team.name}
                        </h4>
                        <p className="mt-1 break-words text-xs text-gray-500">
                          {request.team.teamCode}
                        </p>
                        <p className="mt-2 text-xs capitalize text-gray-500">
                          {request.status.toLowerCase()} /{" "}
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProfilePreview
                          kind="team"
                          id={request.team.id}
                          name={request.team.name}
                        />
                        {request.status === "PENDING" && (
                          <button
                            className={secondary}
                            disabled={busy}
                            type="button"
                            onClick={() => {
                              void act(
                                `join-requests/${request.id}/cancel`,
                                {},
                                "Join request revoked.",
                              );
                            }}
                          >
                            <X size={16} />
                            Revoke
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {state && !state.sentRequests.length && (
                    <p className="py-6 text-sm text-gray-500">
                      No sent invitations yet.
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <div className="divide-y divide-gray-200">
                {state?.invitations.map((invitation) => (
                  <article
                    className="grid gap-3 py-5 first:pt-0"
                    key={invitation.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="break-words font-semibold">
                        {invitation.team.name}
                      </h4>
                      <ProfilePreview
                        kind="team"
                        id={invitation.team.id}
                        name={invitation.team.name}
                      />
                    </div>
                    <p className="break-words text-xs text-gray-500">
                      {invitation.team.teamCode}
                    </p>
                    <p className="text-sm text-gray-600">
                      Team leader:{" "}
                      {invitation.team.members[0]?.user.profile?.fullName ??
                        "Team leader"}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className={primary}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void act(
                            `recruitment/${invitation.id}/accept`,
                            {},
                            "You joined the team.",
                          );
                        }}
                      >
                        <Check size={16} />
                        Accept
                      </button>
                      <button
                        className={secondary}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void act(
                            `recruitment/${invitation.id}/decline`,
                            {},
                            "Invitation declined.",
                          );
                        }}
                      >
                        <X size={16} />
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
                {state && !state.invitations.length && (
                  <p className="py-6 text-sm text-gray-500">
                    No team invitations yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => {
          setConfirming(false);
        }}
        className="w-[calc(100%_-_32px)] max-w-md rounded-lg border border-gray-200 bg-white p-6 text-[#242a30] backdrop:bg-black/40"
        aria-labelledby="discovery-consent-title"
      >
        <h3 id="discovery-consent-title" className="text-lg font-semibold">
          Want to join a team?
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          Team leaders will be able to see your profile, education details, and
          skills in Find teammates. They can send you invitations to join their
          team. You choose whether to accept.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          You can turn this off at any time. Your profile will be hidden and
          pending team invitations will be cancelled.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className={secondary}
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirming(false);
            }}
          >
            Cancel
          </button>
          <button
            className={primary}
            type="button"
            disabled={busy}
            onClick={() => {
              void act(
                "discovery",
                { enabled: true, consent: true },
                "Your profile is visible to team leaders in Find teammates.",
              );
            }}
          >
            {busy && <Loader2 className="animate-spin" size={16} />}OK, enable
            visibility
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </dialog>
    </div>
  );
}
