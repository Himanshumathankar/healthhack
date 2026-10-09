"use client";
import {
  Crown,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserMinus,
} from "lucide-react";
import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { AdminDialog } from "./AdminDialog";
import { adminCall, type AdminIdentity } from "./admin-api";

type RecordItem = {
  id: string;
  name?: string;
  title?: string;
  subject?: string;
  description?: string | null;
  body?: string;
  message?: string;
  published?: boolean;
  active?: boolean;
  status?: string;
  assignedTo?: string | null;
  teamCode?: string;
  requiresMembers?: boolean;
  _count?: { members: number };
};
type TeamDetails = {
  id: string;
  name: string;
  teamCode: string;
  members: Array<{
    userId: string;
    role: string;
    user: { participantId: string; profile: { fullName: string } | null };
  }>;
};
type TeamInvitation = {
  id: string;
  kind: "request" | "invitation";
  user: { participantId: string; profile: { fullName: string } | null };
};
const field =
  "min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded bg-[#106b5f] px-4 text-sm text-white disabled:opacity-50";
const definitions = {
  Teams: "teams",
  Announcements: "announcements",
  Services: "services",
  Support: "support",
} as const;
export type OperationView = keyof typeof definitions;

export function AdminOperations({
  view,
  identity,
  initialCreate = false,
}: {
  view: OperationView;
  identity: AdminIdentity;
  initialCreate?: boolean;
}) {
  const resource = definitions[view];
  const [items, setItems] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ record: RecordItem | null } | null>(
    initialCreate ? { record: null } : null,
  );
  const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  async function showTeam(id: string) {
    setError("");
    try {
      setTeamDetails(await adminCall<TeamDetails>(`teams/${id}`));
      setTeamInvitations(
        identity.permissions.includes("org.teams.invitations.manage")
          ? await adminCall<TeamInvitation[]>(`teams/${id}/invitations`)
          : [],
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load team members.",
      );
    }
  }
  async function manageMember(memberId: string, action: "remove" | "leader") {
    if (
      !teamDetails ||
      !window.confirm(
        action === "remove"
          ? "Remove this member?"
          : "Assign this member as team leader?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminCall(`teams/${teamDetails.id}/members/${memberId}`, {
        action,
      });
      await showTeam(teamDetails.id);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not change team membership.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revokeInvitation(invitation: TeamInvitation) {
    if (!teamDetails) return;
    setBusy(true);
    setError("");
    try {
      await adminCall(
        `teams/${teamDetails.id}/invitations/${invitation.id}/revoke`,
        { kind: invitation.kind },
      );
      await showTeam(teamDetails.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not revoke invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  const allows = (operation: string) =>
    identity.permissions.includes(`org.${resource}.${operation}`);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adminCall<RecordItem[]>(resource));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load records.",
      );
    } finally {
      setLoading(false);
    }
  }, [resource]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const form = new FormData(event.currentTarget);
    const payload =
      view === "Announcements"
        ? {
            title: form.get("title"),
            body: form.get("body"),
            published: allows("publish")
              ? form.get("published") === "on"
              : (editor.record?.published ?? false),
          }
        : view === "Support"
          ? {
              subject: form.get("subject"),
              message: form.get("message"),
              status: form.get("status"),
              assignedTo: allows("assign")
                ? form.get("assignedTo") || null
                : (editor.record?.assignedTo ?? null),
            }
          : {
              name: form.get("name"),
              description: form.get("description"),
              ...(view === "Teams" && !editor.record
                ? { leaderParticipantId: form.get("leaderParticipantId") }
                : {}),
              ...(view === "Services"
                ? { active: form.get("active") === "on" }
                : { requiresMembers: form.get("requiresMembers") === "on" }),
            };
    setBusy(true);
    setError("");
    try {
      await adminCall(
        editor.record ? `${resource}/${editor.record.id}` : resource,
        payload,
      );
      setEditor(null);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save record.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: RecordItem) {
    if (
      !window.confirm(
        `Delete ${item.name ?? item.title ?? item.subject ?? "this record"}?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminCall(`${resource}/${item.id}/delete`, {});
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not delete record.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{view}</h1>
        {allows("create") && (
          <button
            className={button}
            type="button"
            onClick={() => {
              setEditor({ record: null });
              setError("");
            }}
          >
            <Plus size={16} />
            Create{" "}
            {view === "Teams"
              ? "team"
              : view === "Announcements"
                ? "announcement"
                : view === "Services"
                  ? "service"
                  : "ticket"}
          </button>
        )}
      </header>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Loader2 className="animate-spin" size={24} />
      ) : (
        <div className="overflow-x-auto border-y border-gray-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="p-3 font-medium">
                  {view === "Teams" ? "Team" : "Name / title"}
                </th>
                <th className="p-3 font-medium">
                  {view === "Teams" ? "Team ID" : "Details"}
                </th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3 font-medium">
                    {item.name ?? item.title ?? item.subject}
                  </td>
                  <td className="max-w-sm p-3 text-xs text-gray-500">
                    {item.teamCode ??
                      item.description ??
                      item.body ??
                      item.message}
                  </td>
                  <td className="p-3 text-xs">
                    {view === "Teams"
                      ? `${String(item._count?.members ?? 0)} members`
                      : view === "Announcements"
                        ? item.published
                          ? "Published"
                          : "Draft"
                        : view === "Services"
                          ? item.active
                            ? "Active"
                            : "Inactive"
                          : item.status}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {view === "Teams" && (
                        <button
                          className="grid h-9 w-9 place-items-center rounded border border-gray-200"
                          type="button"
                          title="View team members"
                          aria-label="View team members"
                          onClick={() => {
                            void showTeam(item.id);
                          }}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {allows("update") && (
                        <button
                          className="grid h-9 w-9 place-items-center rounded border border-gray-200"
                          title="Edit"
                          aria-label="Edit record"
                          type="button"
                          onClick={() => {
                            setEditor({ record: item });
                            setError("");
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {allows("delete") && (
                        <button
                          className="grid h-9 w-9 place-items-center rounded border border-red-200 text-red-700"
                          title="Delete"
                          aria-label="Delete record"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void remove(item);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <p className="p-8 text-sm text-gray-500">
              No {view.toLowerCase()} yet.
            </p>
          )}
        </div>
      )}
      {teamDetails && (
        <AdminDialog
          title={`Team members: ${teamDetails.name}`}
          onClose={() => {
            if (!busy) setTeamDetails(null);
          }}
        >
          <p className="mb-5 break-words font-mono text-xs text-gray-500">
            {teamDetails.teamCode}
          </p>
          <ul className="divide-y divide-gray-200">
            {teamDetails.members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {member.user.profile?.fullName ?? member.user.participantId}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {member.role.replaceAll("_", " ")} /{" "}
                    {member.user.participantId}
                  </p>
                </div>
                {allows("members.manage") && member.role !== "TEAM_LEADER" && (
                  <div className="flex gap-2">
                    <button
                      className="grid h-9 w-9 place-items-center rounded border border-gray-200"
                      title="Make team leader"
                      aria-label="Make team leader"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void manageMember(member.userId, "leader");
                      }}
                    >
                      <Crown size={16} />
                    </button>
                    <button
                      className="grid h-9 w-9 place-items-center rounded border border-red-200 text-red-700"
                      title="Remove member"
                      aria-label="Remove member"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void manageMember(member.userId, "remove");
                      }}
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!teamDetails.members.length && (
            <p className="text-sm text-gray-500">No team members.</p>
          )}
          {allows("invitations.manage") && (
            <section className="mt-6 border-t border-gray-200 pt-5">
              <h3 className="font-semibold">Pending requests & invitations</h3>
              {teamInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 py-4"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {invitation.user.profile?.fullName ??
                        invitation.user.participantId}
                    </p>
                    <p className="mt-1 text-xs capitalize text-gray-500">
                      {invitation.kind} / {invitation.user.participantId}
                    </p>
                  </div>
                  <button
                    className="rounded border border-gray-200 px-3 py-2 text-xs"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void revokeInvitation(invitation);
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
              {!teamInvitations.length && (
                <p className="mt-3 text-sm text-gray-500">
                  No pending requests or invitations.
                </p>
              )}
            </section>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </AdminDialog>
      )}
      {editor && (
        <AdminDialog
          title={`${editor.record ? "Edit" : "Create"} ${view === "Teams" ? "team" : view === "Announcements" ? "announcement" : view === "Services" ? "service" : "ticket"}`}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              void save(event);
            }}
          >
            {view === "Teams" && !editor.record && (
              <label className="grid gap-2 text-sm">
                <span>Team leader participant ID</span>
                <input
                  className={field}
                  name="leaderParticipantId"
                  placeholder="2026-12345678"
                  pattern="[0-9]{4}-[0-9]{8}"
                  required
                />
              </label>
            )}
            <label className="grid gap-2 text-sm">
              <span>
                {view === "Announcements"
                  ? "Title"
                  : view === "Support"
                    ? "Subject"
                    : "Name"}
              </span>
              <input
                className={field}
                name={
                  view === "Announcements"
                    ? "title"
                    : view === "Support"
                      ? "subject"
                      : "name"
                }
                defaultValue={
                  editor.record?.name ??
                  editor.record?.title ??
                  editor.record?.subject ??
                  ""
                }
                required
                minLength={3}
                maxLength={120}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>
                {view === "Announcements"
                  ? "Announcement"
                  : view === "Support"
                    ? "Message"
                    : "Description"}
              </span>
              <textarea
                className={field}
                name={
                  view === "Announcements"
                    ? "body"
                    : view === "Support"
                      ? "message"
                      : "description"
                }
                defaultValue={
                  editor.record?.description ??
                  editor.record?.body ??
                  editor.record?.message ??
                  ""
                }
                rows={5}
                minLength={view === "Teams" ? 0 : 3}
                maxLength={2000}
                required={view !== "Teams"}
              />
            </label>
            {view === "Announcements" && (
              <label className="flex items-center gap-3 text-sm">
                <input
                  className="h-4 w-4 accent-[#106b5f]"
                  name="published"
                  type="checkbox"
                  defaultChecked={editor.record?.published ?? false}
                  disabled={!allows("publish")}
                />
                Publish announcement
              </label>
            )}
            {view === "Services" && (
              <label className="flex items-center gap-3 text-sm">
                <input
                  className="h-4 w-4 accent-[#106b5f]"
                  name="active"
                  type="checkbox"
                  defaultChecked={editor.record?.active ?? true}
                />
                Active service
              </label>
            )}
            {view === "Teams" && (
              <label className="flex items-center gap-3 text-sm">
                <input
                  className="h-4 w-4 accent-[#106b5f]"
                  name="requiresMembers"
                  type="checkbox"
                  defaultChecked={editor.record?.requiresMembers ?? false}
                />
                Requires team members
              </label>
            )}
            {view === "Support" && (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Status</span>
                  <select
                    className={field}
                    name="status"
                    defaultValue={editor.record?.status ?? "OPEN"}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    {allows("resolve") && (
                      <option value="RESOLVED">Resolved</option>
                    )}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Assigned to</span>
                  <input
                    className={field}
                    name="assignedTo"
                    defaultValue={editor.record?.assignedTo ?? ""}
                    disabled={!allows("assign")}
                    maxLength={160}
                  />
                </label>
              </>
            )}
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button className={button} type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              Save
            </button>
          </form>
        </AdminDialog>
      )}
    </section>
  );
}

type Submission = {
  id: string;
  title: string;
  summary: string;
  status: string;
  submittedAt: string;
  team: { name: string; teamCode: string };
  reviews: Array<{
    reviewerId: string | null;
    score: number;
    feedback: string;
    published: boolean;
  }>;
};
export function SubmissionReview({ identity }: { identity: AdminIdentity }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems(await adminCall<Submission[]>("submissions"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load submissions.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function score(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await adminCall(`submissions/${selected.id}/review`, {
        score: Number(form.get("score")),
        feedback: form.get("feedback"),
        published: form.get("published") === "on",
      });
      setSelected(null);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save review.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Submissions & review</h1>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="p-3">Submission</th>
              <th className="p-3">Team</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">Reviews</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-3">{item.title}</td>
                <td className="p-3">{item.team.name}</td>
                <td className="p-3 text-xs">
                  {new Date(item.submittedAt).toLocaleString()}
                </td>
                <td className="p-3">{item.reviews.length}</td>
                <td className="p-3">
                  <button
                    className="text-sm text-[#106b5f]"
                    type="button"
                    onClick={() => {
                      setSelected(item);
                    }}
                  >
                    View / review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <p className="p-8 text-sm text-gray-500">No submissions yet.</p>
        )}
      </div>
      {selected && (
        <AdminDialog
          title={selected.title}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <p className="mb-5 whitespace-pre-wrap break-words text-sm text-gray-600">
            {selected.summary}
          </p>
          {selected.reviews.map((review, index) => (
            <p
              className="mb-4 border-b border-gray-200 pb-3 text-sm"
              key={index}
            >
              Score: {review.score} / 100
              <br />
              {review.feedback}
            </p>
          ))}
          {identity.permissions.includes("org.reviews.score") && (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                void score(event);
              }}
            >
              <label className="grid gap-2 text-sm">
                <span>Score / 100</span>
                <input
                  className={field}
                  name="score"
                  type="number"
                  min={0}
                  max={100}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Feedback</span>
                <textarea
                  className={field}
                  name="feedback"
                  rows={4}
                  minLength={3}
                  maxLength={5000}
                  required
                />
              </label>
              {identity.permissions.includes("org.reviews.publish") && (
                <label className="flex items-center gap-3 text-sm">
                  <input
                    className="h-4 w-4 accent-[#106b5f]"
                    type="checkbox"
                    name="published"
                  />
                  Publish review
                </label>
              )}
              {error && (
                <p className="text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              <button className={button} type="submit" disabled={busy}>
                <Save size={16} />
                Save review
              </button>
            </form>
          )}
        </AdminDialog>
      )}
    </section>
  );
}
