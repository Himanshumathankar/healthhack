"use client";

import {
  ArrowLeft,
  ClipboardCheck,
  FileText,
  Settings,
  Check,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { teamCall as call } from "./team-api";
import { FindTeammates, JoinFindTeam } from "./TeamDiscovery";
import { SentTeamInvitations } from "./SentTeamInvitations";

type Person = {
  id: string;
  participantId: string;
  profile: { fullName: string } | null;
};
type Team = {
  id: string;
  name: string;
  teamCode: string;
  joinCode?: string;
  requiresMembers: boolean;
  track: { name: string } | null;
  problemStatement: { title: string; body: string } | null;
  members: Array<{ userId: string; role: string; user: Person }>;
};
type Request = { id: string; status: string; user: Person };
type MyTeam = {
  membership: { role: string; team: Team } | null;
  requests: Request[];
  pendingRequests: Array<{
    id: string;
    status: string;
    team: { name: string; teamCode: string };
  }>;
};
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded bg-[#106b5f] px-5 text-sm font-medium text-white disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[#d8dfdf] px-5 text-sm font-medium disabled:opacity-50";
const field =
  "min-w-0 rounded border border-[#d8dfdf] bg-white px-3 py-2 text-sm";

export function TeamWorkspace({ onRefresh }: { onRefresh: () => void }) {
  const [data, setData] = useState<MyTeam | null>(null);
  const [mode, setMode] = useState<"start" | "create" | "join">("start");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("Team details");
  const [memberTab, setMemberTab] = useState("Find teammates");
  const load = useCallback(async () => {
    setData(await call<MyTeam>("mine"));
  }, []);
  useEffect(() => {
    void load().catch((caught: unknown) => {
      setError(
        caught instanceof Error ? caught.message : "Could not load team.",
      );
    });
  }, [load]);

  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await call(path, body);
      await load();
      onRefresh();
      setMode("start");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not complete team action.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await action("", { name: values.name });
  }
  async function discoveryChanged() {
    await load();
    onRefresh();
  }
  const team = data?.membership?.team;
  const leader = data?.membership?.role === "TEAM_LEADER";
  const tabs = [
    { name: "Team details", icon: Users },
    { name: "Theme & submission", icon: FileText },
    ...(leader
      ? [
          { name: "Members", icon: Users },
          { name: "Review", icon: ClipboardCheck },
          { name: "Settings", icon: Settings },
        ]
      : []),
  ];
  const memberViews = ["Find teammates", "Request members", "Sent invitations"];
  const activeTab = tabs.some((item) => item.name === tab)
    ? tab
    : "Team details";
  const members = team ? (
    <div>
      {activeTab !== "Members" && (
        <h3 className="mb-3 font-semibold">Members</h3>
      )}
      <ul className="divide-y divide-gray-200">
        {team.members.map((member) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 py-4"
            key={member.userId}
          >
            <div className="min-w-0">
              <p className="break-words font-medium">
                {member.user.profile?.fullName ?? member.user.participantId}
                {member.role === "TEAM_LEADER" && (
                  <Crown className="ml-2 inline text-amber-600" size={16} />
                )}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {member.user.participantId}
              </p>
            </div>
            {leader &&
              activeTab === "Members" &&
              member.role !== "TEAM_LEADER" && (
                <div className="flex gap-2">
                  <button
                    className="grid h-9 w-9 place-items-center rounded border border-gray-200"
                    title="Transfer leadership"
                    aria-label={`Transfer leadership to ${member.user.profile?.fullName ?? member.user.participantId}`}
                    disabled={busy}
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Transfer team leadership to this member?",
                        )
                      )
                        void action(
                          `${team.id}/members/${member.userId}/leader`,
                        );
                    }}
                  >
                    <Crown size={16} />
                  </button>
                  <button
                    className="grid h-9 w-9 place-items-center rounded border border-red-200 text-red-700"
                    title="Remove member"
                    aria-label={`Remove ${member.user.profile?.fullName ?? member.user.participantId}`}
                    disabled={busy}
                    type="button"
                    onClick={() => {
                      if (window.confirm("Remove this member from the team?"))
                        void action(
                          `${team.id}/members/${member.userId}/remove`,
                        );
                    }}
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              )}
          </li>
        ))}
      </ul>
    </div>
  ) : null;
  const leaveButton = team ? (
    <button
      className={`${secondary} w-fit text-red-700`}
      type="button"
      disabled={busy}
      onClick={() => {
        if (
          window.confirm(
            leader && team.members.length === 1
              ? "Leave and close this team?"
              : "Leave this team?",
          )
        )
          void action("leave");
      }}
    >
      <LogOut size={16} />
      Leave team
    </button>
  ) : null;

  return (
    <section className="grid gap-6 border border-[#e3e6e9] bg-white p-5 sm:p-7">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My team</h1>
        <button
          className="grid h-9 w-9 place-items-center rounded hover:bg-gray-100"
          title="Refresh team"
          aria-label="Refresh team"
          type="button"
          disabled={busy}
          onClick={() => {
            void load().catch((caught: unknown) => {
              setError(
                caught instanceof Error ? caught.message : "Could not refresh.",
              );
            });
          }}
        >
          <RefreshCw size={17} />
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
      {!data ? (
        <div className="grid min-h-52 place-items-center">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : team ? (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-xl font-semibold">{team.name}</h3>
              <p className="mt-2 break-words text-xs text-gray-500">
                {team.teamCode}
              </p>
            </div>
            <span className="text-xs text-[#106b5f]">
              {leader ? "Team leader" : "Team member"}
            </span>
          </header>
          <div
            className="-mx-5 overflow-x-auto border-b border-gray-200 px-5 sm:-mx-7 sm:px-7"
            role="tablist"
            aria-label="My team tabs"
            onKeyDown={(event) => {
              const current = tabs.findIndex((item) => item.name === activeTab);
              const nextIndex =
                event.key === "ArrowRight"
                  ? (current + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (current - 1 + tabs.length) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : null;
              if (nextIndex !== null) {
                event.preventDefault();
                const item = tabs[nextIndex];
                if (item) {
                  setTab(item.name);
                  const buttons =
                    event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]',
                    );
                  buttons[nextIndex]?.focus();
                }
              }
            }}
          >
            <div className="flex min-w-max gap-6">
              {tabs.map(({ name, icon: Icon }, index) => (
                <button
                  className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium ${activeTab === name ? "border-[#106b5f] text-[#106b5f]" : "border-transparent text-gray-500 hover:text-gray-800"}`}
                  type="button"
                  role="tab"
                  id={`team-tab-${String(index)}`}
                  aria-controls="team-tab-panel"
                  aria-selected={activeTab === name}
                  tabIndex={activeTab === name ? 0 : -1}
                  key={name}
                  onClick={() => {
                    setTab(name);
                    setError("");
                    setMessage("");
                  }}
                >
                  <Icon size={17} aria-hidden />
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div
            id="team-tab-panel"
            role="tabpanel"
            aria-labelledby={`team-tab-${String(tabs.findIndex((item) => item.name === activeTab))}`}
            tabIndex={0}
            className="grid min-h-72 content-start gap-6"
          >
            {activeTab === "Team details" && (
              <>
                <dl className="grid gap-5 border-b border-gray-200 pb-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-gray-500">Team name</dt>
                    <dd className="mt-2 break-words font-medium">
                      {team.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Team ID</dt>
                    <dd className="mt-2 break-words font-mono text-sm">
                      {team.teamCode}
                    </dd>
                  </div>
                </dl>
                {members}
                {!leader && leaveButton}
              </>
            )}
            {activeTab === "Theme & submission" && (
              <>
                <section className="grid gap-4">
                  <h3 className="font-semibold">Theme</h3>
                  <p className="text-sm text-gray-600">
                    {team.track?.name ?? "No theme selected."}
                  </p>
                </section>
                <section className="grid gap-4 border-t border-gray-200 pt-5">
                  <h3 className="font-semibold">Problem statement</h3>
                  {team.problemStatement ? (
                    <>
                      <p className="font-medium">
                        {team.problemStatement.title}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">
                        {team.problemStatement.body}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No problem statement selected.
                    </p>
                  )}
                </section>
                <section className="grid gap-4 border-t border-gray-200 pt-5">
                  <h3 className="font-semibold">Submission</h3>
                  <p className="text-sm text-gray-500">No submission yet.</p>
                </section>
              </>
            )}
            {activeTab === "Members" && leader && (
              <div className="-mx-5 -mb-5 grid min-h-[430px] border-t border-gray-200 sm:-mx-7 sm:-mb-7 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside
                  className="min-w-0 border-b border-gray-200 p-5 sm:p-7 lg:border-b-0 lg:border-r"
                  aria-label="Team member roster"
                >
                  <h3 className="font-semibold">Team members</h3>
                  <p className="mt-2 text-xs text-gray-500">
                    {team.members.length} members
                  </p>
                  {members}
                </aside>
                <div className="min-w-0">
                  <div
                    className="flex gap-6 overflow-x-auto border-b border-gray-200 px-5 sm:px-7"
                    role="tablist"
                    aria-label="Members views"
                    onKeyDown={(event) => {
                      if (
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      ) {
                        event.preventDefault();
                        const current = memberViews.indexOf(memberTab);
                        const index =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? memberViews.length - 1
                              : event.key === "ArrowRight"
                                ? (current + 1) % memberViews.length
                                : (current - 1 + memberViews.length) %
                                  memberViews.length;
                        setMemberTab(memberViews[index] ?? "Find teammates");
                        const buttons =
                          event.currentTarget.querySelectorAll<HTMLButtonElement>(
                            '[role="tab"]',
                          );
                        buttons[index]?.focus();
                      }
                    }}
                  >
                    {memberViews.map((label, index) => (
                      <button
                        type="button"
                        role="tab"
                        id={`members-view-${String(index)}`}
                        aria-controls="members-view-panel"
                        aria-selected={memberTab === label}
                        tabIndex={memberTab === label ? 0 : -1}
                        key={label}
                        className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 text-sm font-medium ${memberTab === label ? "border-[#106b5f] text-[#106b5f]" : "border-transparent text-gray-500"}`}
                        onClick={() => {
                          setMemberTab(label);
                          setError("");
                          setMessage("");
                        }}
                      >
                        {label}
                        {index === 1 && (
                          <span className="text-xs">
                            {data.requests.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div
                    id="members-view-panel"
                    role="tabpanel"
                    aria-labelledby={`members-view-${String(memberViews.indexOf(memberTab))}`}
                    tabIndex={0}
                    className="p-5 sm:p-7"
                  >
                    {memberTab === "Find teammates" ? (
                      <FindTeammates />
                    ) : memberTab === "Sent invitations" ? (
                      <SentTeamInvitations />
                    ) : (
                      <section>
                        <h3 className="mb-3 font-semibold">Join requests</h3>
                        {data.requests.length ? (
                          <ul className="divide-y divide-gray-200">
                            {data.requests.map((request) => (
                              <li
                                className="flex flex-wrap items-center justify-between gap-3 py-4"
                                key={request.id}
                              >
                                <div>
                                  <p>
                                    {request.user.profile?.fullName ??
                                      request.user.participantId}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {request.user.participantId}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    className={primary}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      void action(
                                        `join-requests/${request.id}/approve`,
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
                                      void action(
                                        `join-requests/${request.id}/reject`,
                                      );
                                    }}
                                  >
                                    <X size={16} />
                                    Reject
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="py-4 text-sm text-gray-500">
                            No pending join requests.
                          </p>
                        )}
                      </section>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "Review" && leader && (
              <section>
                <h3 className="font-semibold">Review</h3>
                <p className="mt-4 text-sm text-gray-500">No reviews yet.</p>
              </section>
            )}
            {activeTab === "Settings" && leader && (
              <>
                <section className="flex items-center justify-between gap-4 border-b border-gray-200 pb-5">
                  <h3 id="team-recruitment-label" className="font-semibold">
                    Requires team members
                  </h3>
                  <button
                    className={`relative h-6 w-11 shrink-0 rounded-full ${team.requiresMembers ? "bg-[#106b5f]" : "bg-gray-300"}`}
                    type="button"
                    role="switch"
                    aria-labelledby="team-recruitment-label"
                    aria-checked={team.requiresMembers}
                    disabled={busy}
                    onClick={() => {
                      void action("recruitment-settings", {
                        enabled: !team.requiresMembers,
                      });
                    }}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${team.requiresMembers ? "translate-x-5" : ""}`}
                    />
                  </button>
                </section>
                <section className="grid gap-3 border-b border-gray-200 pb-6">
                  <h3 className="font-semibold">Join code</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="bg-gray-100 px-3 py-2">
                      {team.joinCode}
                    </code>
                    <button
                      className="grid h-9 w-9 place-items-center rounded hover:bg-gray-100"
                      title="Copy join code"
                      aria-label="Copy join code"
                      type="button"
                      onClick={() => {
                        if (team.joinCode)
                          void navigator.clipboard
                            .writeText(team.joinCode)
                            .then(() => {
                              setMessage("Join code copied.");
                            })
                            .catch(() => {
                              setError("Could not copy join code.");
                            });
                      }}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </section>
                <section className="grid gap-4 border-t border-gray-200 pt-5">
                  <h3 className="font-semibold">Team membership</h3>
                  {leaveButton}
                </section>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {mode === "start" ? (
            <div className="grid min-h-64 content-center justify-items-center gap-5">
              <Users className="text-[#85958e]" size={36} />
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  className={primary}
                  type="button"
                  onClick={() => {
                    setMode("create");
                    setError("");
                  }}
                >
                  <Plus size={18} />
                  Create Team
                </button>
                <button
                  className={secondary}
                  type="button"
                  onClick={() => {
                    setMode("join");
                    setError("");
                  }}
                >
                  <Search size={18} />
                  Join / Find Team
                </button>
              </div>
            </div>
          ) : (
            <div
              className={
                mode === "create"
                  ? "mx-auto grid w-full max-w-lg gap-5 py-6"
                  : "grid w-full gap-5 py-6"
              }
            >
              <button
                className="inline-flex w-fit items-center gap-2 text-sm"
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode("start");
                }}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              {mode === "create" ? (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    void submit(event);
                  }}
                >
                  <h3 className="text-xl font-semibold">Create Team</h3>
                  <label className="grid gap-2">
                    <span className="text-sm">Team name</span>
                    <input
                      className={field}
                      name="name"
                      minLength={2}
                      maxLength={120}
                      placeholder="ALFA"
                      required
                    />
                  </label>
                  <button className={primary} disabled={busy} type="submit">
                    {busy ? (
                      <Loader2 className="animate-spin" size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    Create Team
                  </button>
                </form>
              ) : (
                <>
                  <JoinFindTeam onChanged={discoveryChanged} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
