"use client";
import { useState } from "react";
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
					<button onClick={() => router.push("/login")}>Sign in</button>
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
				<h1>Organization setup</h1>
				<p>
					This account is not yet authorized for an organization. If you are the
					bootstrap administrator, create the first organization. Otherwise, use
					the invitation link sent by your administrator.
				</p>
				<Field label="Organization name" value={newOrg} onChange={setNewOrg} />
				<button
					disabled={loading}
					onClick={() =>
						perform("bootstrap", { name: newOrg }).then(() => refreshList())
					}
				>
					Create first organization
				</button>
				{error && <div className="notice error">{error}</div>}
				<div className="actions">
					<button className="secondary" onClick={signOut}>
						Sign out
					</button>
				</div>
			</div>
		</main>
	);
}

function Dashboard() {
	const { page, open, collection, active, setActive, error, notice } =
		useDashboard();
	const signOut = useSignOut();
	const [menu, setMenu] = useState(false);
	if (collection.organizations?.length === 0) return <OrganizationSetup />;
	const Screen = screens[page];
	return (
		<div className="shell">
			<aside className={"sidebar " + (menu ? "open" : "")}>
				<div className="brand">
					GatherWell<small>Event administration</small>
				</div>
				<nav aria-label="Main navigation">
					{nav.map(([label, p]) => (
						<button
							key={p}
							className={page === p ? "active" : ""}
							aria-current={page === p ? "page" : undefined}
							onClick={() => {
								open(p);
								setMenu(false);
							}}
						>
							{label}
						</button>
					))}
				</nav>
				<hr className="my-5" />
				<button onClick={() => open("staff")}>Staff & Access</button>
				<button onClick={() => open("activity")}>Change History</button>
				<button onClick={signOut}>Sign out</button>
			</aside>
			<div className="main">
				<header className="top no-print">
					<button
						className="mobile-toggle secondary"
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
						<option value="">Select event</option>
						{collection.events.map((x: Obj) => (
							<option key={x.id} value={x.id}>
								{x.name}
							</option>
						))}
					</select>
				</header>
				<main className="content" id="main">
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
