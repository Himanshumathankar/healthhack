"use client";

import {
  Activity,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Home,
  LogOut,
  Megaphone,
  Menu,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { RegistrationProfile } from "./RegistrationSteps";
import styles from "./dashboard.module.css";
import { TeamWorkspace } from "./TeamWorkspace";
import { PublishedAnnouncements } from "./PublishedAnnouncements";

export type DashboardUser = {
  globalRole?: string | null;
  organizationRoleId?: string | null;
  id: string;
  participantId: string;
  username: string | null;
  email: string;
  emailVerifiedAt: string | null;
  profile: RegistrationProfile | null;
  participants: Array<{ id: string; participantCode: string; status: string }>;
  teamMemberships: Array<{
    role: string;
    team: { id: string; teamCode: string; name: string; status: string };
  }>;
};

const navigation = [
  { name: "Home", icon: Home },
  { name: "My team", icon: Users },
  { name: "Progress", icon: TrendingUp },
  { name: "Services", icon: Wrench },
  { name: "Announcements", icon: Megaphone },
  { name: "Support", icon: CircleHelp },
];

export function DashboardShell({
  user,
  completed,
  signOut,
  children,
  onRefresh,
}: {
  user: DashboardUser;
  completed: boolean;
  signOut: () => void;
  children: ReactNode;
  onRefresh: () => void;
}) {
  const [view, setView] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const name = user.profile?.fullName ?? user.email;
  const registered = Boolean(
    user.profile?.registrationCompletedAt || completed,
  );
  const steps = [
    {
      label: "Email verification",
      detail: user.email,
      done: Boolean(user.emailVerifiedAt),
    },
    {
      label: "Education details",
      detail: user.profile?.college ?? "College, year, branch and discipline",
      done:
        Boolean(
          user.profile?.college &&
          user.profile.passoutDate &&
          user.profile.studyYear &&
          user.profile.branch &&
          user.profile.discipline,
        ) || completed,
    },
    {
      label: "Skills and expertise",
      detail: user.profile?.skillExpertise.length
        ? `${String(user.profile.skillExpertise.length)} skills added`
        : "Add your skills and expertise levels",
      done: registered,
    },
    {
      label: "Team membership",
      detail: user.teamMemberships[0]?.team.name ?? "No team yet",
      done: user.teamMemberships.length > 0,
    },
  ];
  const progress = Math.round(
    (steps.filter((step) => step.done).length / steps.length) * 100,
  );
  function navigate(next: string) {
    setView(next);
    setMenuOpen(false);
    setNotificationsOpen(false);
  }

  const progressView = (
    <section className={styles.progress} aria-labelledby="progress-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>YOUR JOURNEY</p>
          <h2 id="progress-title">Progress</h2>
        </div>
        <span className={styles.percentage}>{progress}%</span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Participant progress"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${String(progress)}%` }} />
      </div>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.label}>
            <span className={step.done ? styles.done : styles.stepNumber}>
              {step.done ? <Check size={15} aria-hidden /> : index + 1}
            </span>
            <div>
              <h3>{step.label}</h3>
              <p>{step.detail}</p>
            </div>
            <span
              className={step.done ? styles.completeLabel : styles.pendingLabel}
            >
              {step.done ? "Complete" : "Pending"}
            </span>
          </li>
        ))}
      </ol>
      {!registered && (
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            navigate("Home");
          }}
        >
          Continue registration
          <ArrowRight size={16} />
        </button>
      )}
    </section>
  );

  return (
    <div className={styles.dashboard}>
      {menuOpen && (
        <button
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => {
            setMenuOpen(false);
          }}
          type="button"
        />
      )}
      <aside
        className={[styles.sidebar, menuOpen ? styles.sidebarOpen : ""].join(
          " ",
        )}
      >
        <a className={styles.brand} href="/dashboard">
          <span className={styles.logo}>
            <Activity size={25} aria-hidden />
          </span>
          <span>
            HealthHack<span className={styles.brandYear}>2027</span>
          </span>
        </a>
        <div className={styles.sidebarLabel}>PARTICIPANT WORKSPACE</div>
        <nav className={styles.navigation} aria-label="Dashboard navigation">
          {navigation.map(({ name: item, icon: Icon }) => (
            <button
              key={item}
              className={view === item ? styles.activeNav : styles.navButton}
              aria-current={view === item ? "page" : undefined}
              type="button"
              onClick={() => {
                navigate(item);
              }}
            >
              <Icon size={19} aria-hidden />
              <span>{item}</span>
              {view === item && (
                <ChevronRight className={styles.navArrow} size={16} />
              )}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button
            className={styles.profileButton}
            type="button"
            onClick={() => {
              navigate("Profile");
            }}
          >
            <span className={styles.avatar}>
              <UserRound size={19} aria-hidden />
            </span>
            <span className={styles.identity}>
              <strong>{name}</strong>
              <span>{user.username ? `@${user.username}` : user.email}</span>
            </span>
          </button>
          <button
            className={styles.iconButton}
            title="Sign out"
            aria-label="Sign out"
            onClick={signOut}
            type="button"
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
              title="Open navigation"
              aria-label="Open navigation"
              onClick={() => {
                setMenuOpen(true);
              }}
              type="button"
            >
              <Menu size={21} />
            </button>
            <span>Participant workspace</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className={styles.notificationArea}>
            <button
              className={styles.iconButton}
              title="Notifications"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              type="button"
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
              }}
            >
              <Bell size={21} />
            </button>
            {notificationsOpen && (
              <div className={styles.notificationPanel}>
                <div className={styles.sectionHeading}>
                  <h2>Notifications</h2>
                  <button
                    className={styles.iconButton}
                    title="Close notifications"
                    aria-label="Close notifications"
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
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
          {view === "Home" && (
            <section className={styles.welcome}>
              <div>
                <p className={styles.eyebrow}>HEALTHHACK 2027</p>
                <h1>{`Welcome, ${name}`}</h1>
                <p className={styles.participantId}>
                  Participant ID <span>{user.participantId}</span>
                </p>
                <div className={styles.teamSummary}>
                  <span>Team</span>
                  {user.teamMemberships[0] ? (
                    <>
                      <strong>{user.teamMemberships[0].team.name}</strong>
                      <span>Team ID</span>
                      <code>{user.teamMemberships[0].team.teamCode}</code>
                    </>
                  ) : (
                    <>
                      <strong>Not joined</strong>
                      <button
                        className={styles.textButton}
                        type="button"
                        onClick={() => {
                          navigate("My team");
                        }}
                      >
                        Join now
                        <ArrowRight size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <span
                className={registered ? styles.status : styles.pendingStatus}
              >
                <ShieldCheck size={16} />
                {registered ? "Registration complete" : "Registration pending"}
              </span>
            </section>
          )}

          {view === "Home" && (
            <>
              <section className={styles.announcement}>
                <div className={styles.sectionHeading}>
                  <h2>
                    <Megaphone size={19} />
                    Hackathon announcements
                  </h2>
                  <button
                    className={styles.textButton}
                    type="button"
                    onClick={() => {
                      navigate("Announcements");
                    }}
                  >
                    View all
                    <ArrowRight size={15} />
                  </button>
                </div>
                <PublishedAnnouncements compact />
              </section>
              <div className={styles.mainGrid}>
                <div className={styles.primaryColumn}>
                  {!registered ? (
                    <section className={styles.registration}>
                      {children}
                    </section>
                  ) : (
                    progressView
                  )}
                </div>
                <aside className={styles.privateAnnouncements}>
                  <h2>
                    <Bell size={18} />
                    Private announcements
                  </h2>
                  <div className={styles.privateEmpty}>
                    <span className={styles.emptyIcon}>
                      <Bell size={26} />
                    </span>
                    <h3>You&apos;re all caught up</h3>
                    <p>No private announcements yet.</p>
                  </div>
                  <div className={styles.privateFooter}>
                    Only visible to you
                  </div>
                </aside>
              </div>
            </>
          )}
          {view === "Progress" && progressView}
          {view === "My team" && <TeamWorkspace onRefresh={onRefresh} />}
          {view === "Announcements" && (
            <section className={styles.viewSection}>
              <h2>Hackathon announcements</h2>
              <PublishedAnnouncements />
              <h2 className={styles.subheading}>Private announcements</h2>
              <p className={styles.emptyInline}>
                No private announcements yet.
              </p>
            </section>
          )}
          {view === "Services" && (
            <section className={styles.viewSection}>
              <h2>Participant services</h2>
              <div className={styles.serviceRows}>
                <button
                  type="button"
                  onClick={() => {
                    navigate("Profile");
                  }}
                >
                  <UserRound size={22} />
                  <span>
                    <strong>My profile</strong>
                    <span>Account and education details</span>
                  </span>
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate("Progress");
                  }}
                >
                  <TrendingUp size={22} />
                  <span>
                    <strong>Registration progress</strong>
                    <span>Your participant checklist</span>
                  </span>
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate("My team");
                  }}
                >
                  <Users size={22} />
                  <span>
                    <strong>My team</strong>
                    <span>Memberships and team codes</span>
                  </span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
          )}
          {view === "Support" && (
            <section className={styles.viewSection}>
              <h2>Support</h2>
              <div className={styles.faq}>
                <details>
                  <summary>Where is my participant ID?</summary>
                  <p>
                    Your ID appears at the top of your dashboard after you are
                    enrolled as an event participant.
                  </p>
                </details>
                <details>
                  <summary>How do I complete registration?</summary>
                  <p>
                    Verify your email, then complete your education details and
                    skills on Home.
                  </p>
                  <button
                    className={styles.textButton}
                    type="button"
                    onClick={() => {
                      navigate("Home");
                    }}
                  >
                    Go to Home
                    <ArrowRight size={16} />
                  </button>
                </details>
                <details>
                  <summary>Where can I see my team?</summary>
                  <p>
                    Open My team to view your current memberships and team IDs.
                  </p>
                </details>
              </div>
            </section>
          )}
          {view === "Profile" && (
            <section className={styles.viewSection}>
              <h2>My profile</h2>
              <dl className={styles.profileDetails}>
                {[
                  ["Name", name],
                  ["Username", user.username ? `@${user.username}` : "Not set"],
                  ["Email", user.email],
                  ["College", user.profile?.college ?? "Not provided"],
                  [
                    "Pass-out date",
                    user.profile?.passoutDate?.slice(0, 10) ?? "Not provided",
                  ],
                  [
                    "Year of study",
                    user.profile?.studyYear
                      ? `Year ${String(user.profile.studyYear)}`
                      : "Not provided",
                  ],
                  ["Branch", user.profile?.branch ?? "Not provided"],
                  ["Discipline", user.profile?.discipline ?? "Not provided"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <h2 className={styles.subheading}>Skills and expertise</h2>
              {user.profile?.skillExpertise.length ? (
                <ul className={styles.skillList}>
                  {user.profile.skillExpertise.map((skill) => (
                    <li key={skill.name}>
                      <strong>{skill.name}</strong>
                      <span>{skill.expertise.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyInline}>No skills added yet.</p>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
