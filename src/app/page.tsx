"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { nav, type Obj, type Page } from "@/lib/dashboard";
import { DashboardProvider, useDashboard } from "@/hooks/useDashboard";
import { Field } from "@/components/ui/field";
import {
  EventFormScreen,
  EventsScreen,
  OverviewScreen,
} from "@/components/screens/events";
import {
  ImportScreen,
  RegistrationFormScreen,
  RegistrationsScreen,
} from "@/components/screens/registrations";
import { GuestFormScreen, GuestsScreen } from "@/components/screens/guests";
import { SeatingScreen, TablesScreen } from "@/components/screens/seating";
import { MealsScreen } from "@/components/screens/meals";
import { ReportsScreen } from "@/components/screens/reports";
import { StaffScreen } from "@/components/screens/staff";
import { ActivityScreen } from "@/components/screens/activity";
import { AttendeeHome } from "@/components/screens/attendee";

const screens: Record<Page, () => React.ReactNode> = {
  events: EventsScreen,
  overview: OverviewScreen,
  eventForm: EventFormScreen,
  registrations: RegistrationsScreen,
  regForm: RegistrationFormScreen,
  import: ImportScreen,
  guests: GuestsScreen,
  guestForm: GuestFormScreen,
  seating: SeatingScreen,
  tables: TablesScreen,
  meals: MealsScreen,
  reports: ReportsScreen,
  staff: StaffScreen,
  activity: ActivityScreen,
};

function useSignOut() {
  const router = useRouter();
  return () => authClient.signOut().then(() => router.push("/login"));
}

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  if (isPending)
    return (
      <main id="main" className="content">
        Loading your account…
      </main>
    );
  if (!session?.user)
    return (
      <main id="main" className="auth">
        <div className="panel">
          <h1>GatherWell</h1>
          <p>
            Sign in to manage registrations, guests, seating, meals and reports.
          </p>
          <button onClick={() => router.push("/login")}>Sign In</button>
        </div>
      </main>
    );
  return (
    <DashboardProvider userId={session.user.id}>
      <Dashboard />
    </DashboardProvider>
  );
}

function OrganizationSetup() {
  const { perform, refreshList, loading, error } = useDashboard();
  const signOut = useSignOut();
  const [newOrg, setNewOrg] = useState("");
  return (
    <main id="main" className="auth">
      <div className="panel">
        <h1>Organization Setup</h1>
        <p>
          This account is not yet authorized for an organization. If you are the
          bootstrap administrator, create the first organization. Otherwise, use
          the invitation link sent by your administrator.
        </p>
        <Field
          label="Organization name"
          placeholder="e.g. Riverside Community Foundation"
          hint="Shown to your staff. Only the bootstrap administrator can create it, once."
          value={newOrg}
          onChange={setNewOrg}
        />
        <button
          disabled={loading}
          onClick={() =>
            perform("bootstrap", { name: newOrg }).then(() => refreshList())
          }
        >
          Create First Organization
        </button>
        {error && <div className="notice error">{error}</div>}
        <div className="actions">
          <button className="secondary" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
}

function Dashboard() {
  const {
    page,
    open,
    collection,
    active,
    setActive,
    error,
    notice,
    realRole,
    canPreview,
    preview,
    setPreview,
  } = useDashboard();
  const signOut = useSignOut();
  const [menu, setMenu] = useState(false);
  // On phones and tablets the menu also closes with the Escape key.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  const go = (p: Page) => {
    open(p);
    setMenu(false);
  };
  if (collection.organizations?.length === 0) return <OrganizationSetup />;
  if (realRole === "attendee") return <AttendeeShell />;
  const Screen = screens[page];
  return (
    <div className="shell">
      <aside
        id="main-menu"
        className={"sidebar " + (menu ? "open" : "")}
        aria-label="Main menu"
      >
        <div className="sidebar-head">
          <div className="brand">
            GatherWell<small>Event administration</small>
          </div>
          <button
            className="mobile-close"
            aria-label="Close menu"
            onClick={() => setMenu(false)}
          >
            ✕
          </button>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(([label, p]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              aria-current={page === p ? "page" : undefined}
              onClick={() => go(p)}
            >
              {label}
            </button>
          ))}
        </nav>
        <hr className="my-5" />
        <button onClick={() => go("staff")}>Staff & Access</button>
        <button onClick={() => go("activity")}>Change History</button>
        {canPreview && (
          <button
            aria-pressed={preview}
            onClick={() => {
              setPreview(!preview);
              go("events");
            }}
          >
            {preview ? "Exit Viewer Preview" : "Preview as Viewer"}
          </button>
        )}
        <button onClick={signOut}>Sign Out</button>
      </aside>
      <div className="main">
        <header className="top no-print">
          <button
            className="mobile-toggle secondary"
            aria-expanded={menu}
            aria-controls="main-menu"
            onClick={() => setMenu(!menu)}
          >
            ☰ Menu
          </button>
          <strong>Social Event Guest & Registration Management</strong>
          <select
            aria-label="Active event"
            style={{ width: "auto", maxWidth: 340 }}
            value={active}
            onChange={(x) => {
              setActive(x.target.value);
              open("overview");
            }}
          >
            <option value="">Select Event</option>
            {collection.events.map((x: Obj) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </header>
        <main className="content" id="main">
          {preview && (
            <div className="preview-banner" role="status">
              <span>
                <strong>Previewing as Viewer.</strong> This is what read-only
                staff see. Nothing can be changed while previewing.
              </span>
              <button className="secondary" onClick={() => setPreview(false)}>
                Exit Preview
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <Screen />
        </main>
      </div>
    </div>
  );
}

// Invited attendees get a single page: their event, their registrations, and Pay.
function AttendeeShell() {
  const { error, notice } = useDashboard();
  const signOut = useSignOut();
  return (
    <main id="main" className="content" style={{ maxWidth: 820 }}>
      <div className="top" style={{ marginBottom: 20, borderRadius: 12 }}>
        <div className="brand" style={{ color: "#123423", padding: 0 }}>
          GatherWell<small>Event registration</small>
        </div>
        <button className="secondary" onClick={signOut}>
          Sign Out
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <AttendeeHome />
    </main>
  );
}
