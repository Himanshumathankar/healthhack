"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Save,
  Search,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import {
  organizationModules,
  organizationPermissions,
} from "@healthhack/contracts";
import { AdminDialog } from "./AdminDialog";
import { adminCall, type AdminIdentity } from "./admin-api";

type Role = {
  id: string;
  name: string;
  description: string | null;
  builtInKey: string | null;
  users: number;
  permissions: string[];
};
type User = {
  id: string;
  email: string;
  username: string | null;
  participantId: string;
  globalRole: string | null;
  organizationRoleId: string | null;
  organizationRole: { name: string } | null;
  suspendedAt: string | null;
  lastSignInAt: string | null;
  profile: { fullName: string } | null;
};
type UserPage = {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
};
type Session = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  user: { email: string; profile: { fullName: string } | null };
};
type Audit = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  after: unknown;
  actor: { email: string; profile: { fullName: string } | null } | null;
};
type UserAction = "role" | "suspend" | "restore" | "delete" | "reset-password";
const field =
  "min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded bg-[#106b5f] px-4 text-sm font-medium text-white disabled:opacity-50";
const tabs = [
  { name: "All users", permission: "org.users.read" },
  { name: "Role manager", permission: "org.roles.read" },
  { name: "Permission catalog", permission: "org.roles.read" },
  { name: "Sessions", permission: "org.sessions.read" },
  { name: "Audit log", permission: "org.audit.read" },
];
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Never signed in";

export function UsersRoles({ identity }: { identity: AdminIdentity }) {
  const visibleTabs = tabs.filter((tab) =>
    identity.permissions.includes(tab.permission),
  );
  const [tab, setTab] = useState(visibleTabs[0]?.name ?? "All users");
  const [users, setUsers] = useState<UserPage | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userAction, setUserAction] = useState<{
    user: User;
    action: UserAction;
  } | null>(null);
  const [roleEditor, setRoleEditor] = useState<{ role: Role | null } | null>(
    null,
  );
  const [permissionRole, setPermissionRole] = useState<Role | null>(null);
  const [grants, setGrants] = useState<string[]>([]);
  const allowed = (permission: string) =>
    identity.permissions.includes(permission);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "All users")
        setUsers(
          await adminCall<UserPage>(
            `users?q=${encodeURIComponent(query)}&page=${String(page)}`,
          ),
        );
      if (
        (tab === "All users" && identity.superAdmin) ||
        tab === "Role manager"
      )
        setRoles(await adminCall<Role[]>("roles"));
      if (tab === "Sessions")
        setSessions(await adminCall<Session[]>("sessions"));
      if (tab === "Audit log") setAudit(await adminCall<Audit[]>("audit"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load users and roles.",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, query, page, identity.superAdmin]);
  useEffect(() => {
    void load();
  }, [load]);

  async function perform(path: string, body: unknown, close: () => void) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminCall<{ message?: string }>(path, body);
      close();
      setNotice(result.message ?? "Changes saved.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitUser(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userAction) return;
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    if (userAction.action === "role")
      await perform(
        `users/${userAction.user.id}/role`,
        { roleId: form.get("roleId") || null, password },
        () => {
          setUserAction(null);
        },
      );
    else
      await perform(
        `users/${userAction.user.id}/action`,
        { action: userAction.action, password, reason: form.get("reason") },
        () => {
          setUserAction(null);
        },
      );
  }
  async function submitRole(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roleEditor) return;
    const form = new FormData(event.currentTarget);
    await perform(
      roleEditor.role ? `roles/${roleEditor.role.id}` : "roles",
      { name: form.get("name"), description: form.get("description") },
      () => {
        setRoleEditor(null);
      },
    );
  }
  async function submitPermissions(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissionRole) return;
    const form = new FormData(event.currentTarget);
    await perform(
      `roles/${permissionRole.id}/permissions`,
      { permissions: grants, password: form.get("password") },
      () => {
        setPermissionRole(null);
      },
    );
  }

  return (
    <section className="grid min-w-0 gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Users & roles</h1>
        {tab === "Role manager" && allowed("org.roles.create") && (
          <button
            className={button}
            type="button"
            onClick={() => {
              setRoleEditor({ role: null });
              setError("");
            }}
          >
            <Plus size={16} />
            Custom role
          </button>
        )}
      </header>
      <div
        className="flex gap-6 overflow-x-auto border-b border-gray-200"
        role="tablist"
        aria-label="Users and roles views"
      >
        {visibleTabs.map((item) => (
          <button
            key={item.name}
            className={`min-h-12 shrink-0 border-b-2 text-sm font-medium ${tab === item.name ? "border-[#106b5f] text-[#106b5f]" : "border-transparent text-gray-500"}`}
            type="button"
            role="tab"
            aria-selected={tab === item.name}
            onClick={() => {
              setTab(item.name);
              setError("");
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-[#106b5f]" role="status">
          <Check className="mr-2 inline" size={15} />
          {notice}
        </p>
      )}
      {loading ? (
        <Loader2
          className="animate-spin"
          size={24}
          aria-label="Loading users and roles"
        />
      ) : tab === "All users" ? (
        <>
          <form
            className="flex max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQuery(draftQuery);
              if (draftQuery === query && page === 1) void load();
            }}
          >
            <input
              className={`${field} flex-1`}
              aria-label="Search users"
              placeholder="Name, email or username"
              value={draftQuery}
              onChange={(event) => {
                setDraftQuery(event.target.value);
              }}
            />
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded border border-gray-200"
              title="Search users"
              aria-label="Search users"
              type="submit"
            >
              <Search size={17} />
            </button>
          </form>
          <div className="overflow-x-auto border-y border-gray-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="p-3 font-medium">User</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Last sign-in</th>
                  <th className="p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users?.items.map((user) => (
                  <tr key={user.id}>
                    <td className="p-3">
                      <p className="font-medium">
                        {user.profile?.fullName ?? user.username ?? user.email}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{user.email}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {user.participantId}
                      </p>
                    </td>
                    <td className="p-3">
                      {user.globalRole === "SUPER_ADMIN"
                        ? "Super admin"
                        : (user.organizationRole?.name ?? "Participant")}
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          user.suspendedAt ? "text-red-700" : "text-[#106b5f]"
                        }
                      >
                        {user.suspendedAt ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {date(user.lastSignInAt)}
                    </td>
                    <td className="p-3">
                      <details className="min-w-36">
                        <summary className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs">
                          <Settings size={15} />
                          Action
                        </summary>
                        <div className="mt-2 grid gap-1 border-l-2 border-gray-200 pl-2">
                          {identity.superAdmin && (
                            <button
                              className="py-1 text-left text-xs"
                              type="button"
                              onClick={() => {
                                setUserAction({ user, action: "role" });
                                setError("");
                              }}
                            >
                              Change role
                            </button>
                          )}
                          {allowed("org.users.suspend") && (
                            <button
                              className="py-1 text-left text-xs"
                              type="button"
                              onClick={() => {
                                setUserAction({
                                  user,
                                  action: user.suspendedAt
                                    ? "restore"
                                    : "suspend",
                                });
                                setError("");
                              }}
                            >
                              {user.suspendedAt
                                ? "Restore user"
                                : "Suspend user"}
                            </button>
                          )}
                          {allowed("org.users.delete") && (
                            <button
                              className="py-1 text-left text-xs text-red-700"
                              type="button"
                              onClick={() => {
                                setUserAction({ user, action: "delete" });
                                setError("");
                              }}
                            >
                              Delete user
                            </button>
                          )}
                          {allowed("org.users.password.reset") && (
                            <button
                              className="py-1 text-left text-xs"
                              type="button"
                              onClick={() => {
                                setUserAction({
                                  user,
                                  action: "reset-password",
                                });
                                setError("");
                              }}
                            >
                              Reset password
                            </button>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users && !users.items.length && (
              <p className="p-6 text-sm text-gray-500">No users found.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
            <p>
              {users?.total ?? 0} users / Page {page}
            </p>
            <div className="flex gap-2">
              <button
                className="grid h-9 w-9 place-items-center rounded border border-gray-200 disabled:opacity-30"
                type="button"
                title="Previous page"
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1);
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                className="grid h-9 w-9 place-items-center rounded border border-gray-200 disabled:opacity-30"
                type="button"
                title="Next page"
                aria-label="Next page"
                disabled={!users || page * users.pageSize >= users.total}
                onClick={() => {
                  setPage(page + 1);
                }}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : tab === "Role manager" ? (
        <div className="overflow-x-auto border-y border-gray-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Users</th>
                <th className="p-3 font-medium">Permissions</th>
                <th className="p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className="p-3">
                    <strong>{role.name}</strong>
                    <p className="mt-1 text-xs text-gray-500">
                      {role.builtInKey
                        ? "Built-in role"
                        : role.description || "Custom role"}
                    </p>
                  </td>
                  <td className="p-3">{role.users}</td>
                  <td className="p-3">{role.permissions.length}</td>
                  <td className="p-3">
                    <details>
                      <summary className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs">
                        <Settings size={15} />
                        Action
                      </summary>
                      <div className="mt-2 grid gap-2">
                        <button
                          className="text-left text-xs"
                          type="button"
                          onClick={() => {
                            setPermissionRole(role);
                            setGrants(role.permissions);
                            setError("");
                          }}
                        >
                          Manage role
                        </button>
                        {!role.builtInKey && allowed("org.roles.update") && (
                          <button
                            className="text-left text-xs"
                            type="button"
                            onClick={() => {
                              setRoleEditor({ role });
                            }}
                          >
                            Edit role
                          </button>
                        )}
                        {!role.builtInKey && allowed("org.roles.delete") && (
                          <button
                            className="text-left text-xs text-red-700"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(`Delete the ${role.name} role?`)
                              )
                                void perform(
                                  `roles/${role.id}/delete`,
                                  {},
                                  () => {},
                                );
                            }}
                          >
                            Delete role
                          </button>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "Permission catalog" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="p-3">Module</th>
                <th className="p-3">Operation</th>
                <th className="p-3">Permission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {organizationPermissions.map((permission) => (
                <tr key={permission.key}>
                  <td className="p-3">{permission.module}</td>
                  <td className="p-3 capitalize">
                    {permission.action.replaceAll(".", " ")}
                  </td>
                  <td className="p-3 font-mono text-xs">{permission.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "Sessions" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Started</th>
                <th className="p-3">Expires</th>
                <th className="p-3">IP address</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="p-3">{session.user.email}</td>
                  <td className="p-3 text-xs">{date(session.createdAt)}</td>
                  <td className="p-3 text-xs">{date(session.expiresAt)}</td>
                  <td className="p-3 text-xs">
                    {session.ipAddress ?? "Unknown"}
                  </td>
                  <td className="p-3">
                    {allowed("org.sessions.revoke") && (
                      <button
                        className="text-xs text-red-700"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Revoke this sign-in session?"))
                            void perform(
                              `sessions/${session.id}/revoke`,
                              {},
                              () => {},
                            );
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sessions.length && (
            <p className="p-6 text-sm text-gray-500">No active sessions.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Record</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-3 text-xs">{date(entry.createdAt)}</td>
                  <td className="p-3 text-xs">
                    {entry.actor?.email ?? "System"}
                  </td>
                  <td className="p-3 text-xs">{entry.action}</td>
                  <td className="p-3 text-xs">{entry.entityType}</td>
                  <td className="p-3">
                    <details>
                      <summary className="cursor-pointer text-xs">View</summary>
                      <pre className="mt-2 max-w-xs whitespace-pre-wrap break-words text-xs">
                        {JSON.stringify(entry.after, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {userAction && (
        <AdminDialog
          title={
            userAction.action === "role"
              ? "Change role"
              : userAction.action === "reset-password"
                ? "Reset password"
                : `${userAction.action === "delete" ? "Delete" : userAction.action === "restore" ? "Restore" : "Suspend"} user`
          }
          onClose={() => {
            if (!busy) setUserAction(null);
          }}
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              void submitUser(event);
            }}
          >
            <p className="break-words text-sm text-gray-600">
              {userAction.user.profile?.fullName ?? userAction.user.email}
            </p>
            {userAction.action === "role" ? (
              <label className="grid gap-2 text-sm">
                <span>Organization role</span>
                <select
                  className={field}
                  name="roleId"
                  defaultValue={userAction.user.organizationRoleId ?? ""}
                >
                  <option value="">Participant / no organization access</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Reason</span>
                  <textarea
                    className={field}
                    name="reason"
                    minLength={3}
                    maxLength={500}
                    required
                    rows={3}
                  />
                </label>
                {userAction.action === "delete" && (
                  <p className="text-sm text-red-700">
                    This deactivates the account, ends its sessions and removes
                    its membership. Audit history is retained.
                  </p>
                )}
              </>
            )}
            <label className="grid gap-2 text-sm">
              <span>Your password</span>
              <input
                className={field}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
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
              Confirm
            </button>
          </form>
        </AdminDialog>
      )}
      {roleEditor && (
        <AdminDialog
          title={roleEditor.role ? "Edit role" : "Create custom role"}
          onClose={() => {
            if (!busy) setRoleEditor(null);
          }}
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              void submitRole(event);
            }}
          >
            <label className="grid gap-2 text-sm">
              <span>Role name</span>
              <input
                className={field}
                name="name"
                defaultValue={roleEditor.role?.name ?? ""}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Description</span>
              <textarea
                className={field}
                name="description"
                defaultValue={roleEditor.role?.description ?? ""}
                maxLength={500}
                rows={3}
              />
            </label>
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button className={button} disabled={busy} type="submit">
              <Save size={16} />
              Save role
            </button>
          </form>
        </AdminDialog>
      )}
      {permissionRole && (
        <AdminDialog
          title={`Manage role: ${permissionRole.name}`}
          wide
          onClose={() => {
            if (!busy) setPermissionRole(null);
          }}
        >
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              void submitPermissions(event);
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="p-3">Module</th>
                    <th className="p-3">Operation</th>
                    <th className="p-3">Allow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {organizationModules.flatMap((module) =>
                    module.actions.map((operation) => {
                      const key = `org.${module.key}.${operation}`;
                      const reserved = organizationPermissions.some(
                        (permission) =>
                          permission.key === key && permission.superAdminOnly,
                      );
                      return (
                        <tr key={key}>
                          <td className="p-3">{module.name}</td>
                          <td className="p-3 capitalize">
                            {operation.replaceAll(".", " ")}
                            {reserved && (
                              <span className="ml-2 text-xs normal-case text-gray-400">
                                Super admin only
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              className="h-4 w-4 accent-[#106b5f]"
                              type="checkbox"
                              aria-label={`Allow ${module.name} ${operation}`}
                              checked={grants.includes(key)}
                              disabled={
                                !identity.superAdmin ||
                                permissionRole.builtInKey === "SUPER_ADMIN" ||
                                reserved ||
                                busy
                              }
                              onChange={(event) => {
                                setGrants(
                                  event.target.checked
                                    ? [...grants, key]
                                    : grants.filter((grant) => grant !== key),
                                );
                              }}
                            />
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
            {identity.superAdmin &&
              permissionRole.builtInKey !== "SUPER_ADMIN" && (
                <>
                  <label className="grid gap-2 text-sm">
                    <span>Your password</span>
                    <input
                      className={field}
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  {error && (
                    <p className="text-sm text-red-700" role="alert">
                      {error}
                    </p>
                  )}
                  <button className={button} type="submit" disabled={busy}>
                    <Save size={16} />
                    Save permissions
                  </button>
                </>
              )}
          </form>
        </AdminDialog>
      )}
    </section>
  );
}
