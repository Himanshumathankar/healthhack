"use client";
import {
  Activity,
  Bell,
  CircleHelp,
  ClipboardCheck,
  Home,
  LogOut,
  Megaphone,
  Menu,
  RefreshCw,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminCall, type AdminIdentity } from "./admin-api";
import { UsersRoles } from "./UsersRoles";
import {
  AdminOperations,
  SubmissionReview,
  type OperationView,
} from "./AdminOperations";
import styles from "../dashboard/dashboard.module.css";

const navigation = [
  { name: "Home", icon: Home, permissions: ["org.dashboard.read"] },
  { name: "Teams", icon: Users, permissions: ["org.teams.read"] },
  {
    name: "Submissions & review",
    icon: ClipboardCheck,
    permissions: ["org.submissions.read"],
  },
  { name: "Services", icon: Wrench, permissions: ["org.services.read"] },
  {
    name: "Users & roles",
    icon: ShieldCheck,
    permissions: [
      "org.users.read",
      "org.roles.read",
      "org.sessions.read",
      "org.audit.read",
    ],
  },
  {
    name: "Announcements",
    icon: Megaphone,
    permissions: ["org.announcements.read"],
  },
  { name: "Support", icon: CircleHelp, permissions: ["org.support.read"] },
];
type Overview = {
  users: number;
  teams: number;
  suspended: number;
  verified: number;
  pendingRequests: number;
  announcements: number;
  tickets: number;
};
export function AdminClient() {
  const router = useRouter();
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [view, setView] = useState("Home");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [createAnnouncement, setCreateAnnouncement] = useState(false);
  const load = useCallback(async () => {
    const account = await adminCall<AdminIdentity>("me");
    setIdentity(account);
    if (account.permissions.includes("org.dashboard.read"))
      setOverview(await adminCall<Overview>("overview"));
  }, []);
  useEffect(() => {
    if (!window.localStorage.getItem("healthhack.sessionToken")) {
      router.replace("/login");
      return;
    }
    void load().catch((caught: unknown) => {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load organization workspace.",
      );
    });
  }, [load, router]);
  if (error || !identity)
    return (
      <main className="mx-auto grid min-h-screen max-w-lg content-center gap-4 px-6">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold">
              Organization workspace unavailable
            </h1>
            <p className="text-sm text-gray-600">{error}</p>
            <a className="text-[#106b5f] underline" href="/login">
              Sign in
            </a>
            <a className="text-sm text-gray-500" href="/dashboard">
              Participant workspace
            </a>
          </>
        ) : (
          <RefreshCw className="animate-spin" size={24} />
        )}
      </main>
    );
  const visible = navigation.filter((item) =>
    item.permissions.some((permission) =>
      identity.permissions.includes(permission),
    ),
  );
  if (!visible.length)
    return (
      <main className="mx-auto grid min-h-screen max-w-lg content-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">
          No organization permissions assigned
        </h1>
        <p className="text-sm text-gray-600">
          Your role does not currently grant access to any organization views.
        </p>
        <a
          className="text-[#106b5f] underline"
          href="/dashboard?workspace=participant"
        >
          Participant workspace
        </a>
      </main>
    );
  const selected = visible.some((item) => item.name === view)
    ? view
    : (visible[0]?.name ?? "Home");
  function navigate(next: string, create = false) {
    setCreateAnnouncement(create);
    setView(next);
    setMenu(false);
    setNotifications(false);
  }
  function signOut() {
    window.localStorage.removeItem("healthhack.sessionToken");
    router.replace("/login");
  }
  return (
    <div className={styles.dashboard}>
      {menu && (
        <button
          className={styles.backdrop}
          aria-label="Close navigation"
          type="button"
          onClick={() => {
            setMenu(false);
          }}
        />
      )}
      <aside
        className={[styles.sidebar, menu ? styles.sidebarOpen : ""].join(" ")}
      >
        <a className={styles.brand} href="/admin">
          <span className={styles.logo}>
            <Activity size={25} />
          </span>
          <span>
            HealthHack
            <span className={styles.brandYear}>Organization admin</span>
          </span>
        </a>
        <div className={styles.sidebarLabel}>ORGANIZATION WORKSPACE</div>
        <nav className={styles.navigation} aria-label="Organization navigation">
          {visible.map(({ name, icon: Icon }) => (
            <button
              className={
                selected === name ? styles.activeNav : styles.navButton
              }
              key={name}
              aria-current={selected === name ? "page" : undefined}
              type="button"
              onClick={() => {
                navigate(name);
              }}
            >
              <Icon size={18} />
              <span className="min-w-0 break-words text-sm">{name}</span>
            </button>
          ))}
        </nav>
        <a
          className="mx-6 mt-6 text-xs text-[#106b5f] underline"
          href="/dashboard?workspace=participant"
        >
          Participant workspace
        </a>
        <div className={styles.sidebarFooter}>
          <span className={styles.avatar}>
            <ShieldCheck size={19} />
          </span>
          <div className={styles.identity}>
            <strong>{identity.name}</strong>
            <span>{identity.role}</span>
          </div>
          <button
            className={styles.iconButton}
            title="Sign out"
            aria-label="Sign out"
            type="button"
            onClick={signOut}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <button
              className={[styles.iconButton, styles.mobileMenu].join(" ")}
              aria-label="Open navigation"
              title="Open navigation"
              type="button"
              onClick={() => {
                setMenu(true);
              }}
            >
              <Menu size={20} />
            </button>
            <span>Organization workspace</span>
            <strong>{selected}</strong>
          </div>
          <div className={styles.notificationArea}>
            <button
              className={styles.iconButton}
              title="Notifications"
              aria-label="Notifications"
              aria-expanded={notifications}
              type="button"
              onClick={() => {
                setNotifications(!notifications);
              }}
            >
              <Bell size={20} />
            </button>
            {notifications && (
              <div className={styles.notificationPanel}>
                <div className={styles.sectionHeading}>
                  <h2>Notifications</h2>
                  <button
                    className={styles.iconButton}
                    type="button"
                    aria-label="Close notifications"
                    title="Close notifications"
                    onClick={() => {
                      setNotifications(false);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <p>No new notifications.</p>
              </div>
            )}
          </div>
        </header>
        <main className={styles.content}>
          {selected === "Home" ? (
            <>
              <header className={styles.welcome}>
                <div>
                  <p className={styles.eyebrow}>ORGANIZATION ADMINISTRATION</p>
                  <h1>
                    Welcome,{" "}
                    {identity.superAdmin ? "Super admin" : identity.name}
                  </h1>
                  <p className="mt-3 text-sm text-gray-500">{identity.email}</p>
                </div>
                <span className={styles.status}>
                  <ShieldCheck size={16} />
                  {identity.role}
                </span>
              </header>
              <section className="border border-gray-200 bg-white p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2>Status</h2>
                  <button
                    className={styles.iconButton}
                    title="Refresh status"
                    aria-label="Refresh status"
                    type="button"
                    onClick={() => {
                      void load().catch((caught: unknown) => {
                        setError(
                          caught instanceof Error
                            ? caught.message
                            : "Could not refresh.",
                        );
                      });
                    }}
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                  {[
                    ["Users", overview?.users],
                    ["Teams", overview?.teams],
                    ["Verified emails", overview?.verified],
                    ["Suspended", overview?.suspended],
                    ["Join requests", overview?.pendingRequests],
                    ["Announcements", overview?.announcements],
                    ["Open support tickets", overview?.tickets],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-xs text-gray-500">{label}</dt>
                      <dd className="mt-2 text-2xl font-semibold">
                        {value ?? 0}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              {identity.permissions.includes("org.announcements.create") && (
                <button
                  className="inline-flex min-h-12 w-fit items-center gap-3 rounded border border-gray-200 bg-white px-5 text-sm font-medium text-[#106b5f]"
                  type="button"
                  onClick={() => {
                    navigate("Announcements", true);
                  }}
                >
                  <Megaphone size={18} />
                  Create announcement
                </button>
              )}
              <section className="border border-gray-200 bg-white p-6">
                <h2>Quick access</h2>
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {visible
                    .filter((item) => item.name !== "Home")
                    .map(({ name, icon: Icon }) => (
                      <button
                        className="flex min-h-20 flex-col items-start justify-center gap-3 border-b border-gray-200 py-3 text-left text-sm hover:text-[#106b5f]"
                        key={name}
                        type="button"
                        onClick={() => {
                          navigate(name);
                        }}
                      >
                        <Icon size={24} />
                        <span>{name}</span>
                      </button>
                    ))}
                </div>
              </section>
            </>
          ) : selected === "Users & roles" ? (
            <UsersRoles identity={identity} />
          ) : selected === "Submissions & review" ? (
            <SubmissionReview identity={identity} />
          ) : (
            <AdminOperations
              initialCreate={selected === "Announcements" && createAnnouncement}
              key={selected}
              view={selected as OperationView}
              identity={identity}
            />
          )}
        </main>
      </div>
    </div>
  );
}
