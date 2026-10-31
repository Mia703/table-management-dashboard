"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, query } from "@/lib/api";
import { eventData, type Obj, type Page } from "@/lib/dashboard";

// State shared by every dashboard screen: the organization's events, the active
// event's snapshot, the record being edited, and the current screen and messages.
function useDashboardState(userId: string) {
	const [page, setPage] = useState<Page>("events"),
		[collection, setCollection] = useState<Obj>({
			events: [],
			organizations: [],
		}),
		[active, setActive] = useState(""),
		[snap, setSnap] = useState<Obj | null>(null),
		[edit, setEdit] = useState<Obj>({}),
		[selected, setSelected] = useState(""),
		[search, setSearch] = useState(""),
		[error, setError] = useState(""),
		[notice, setNotice] = useState(""),
		[loading, setLoading] = useState(false);
	async function refreshList() {
		const d = await query("list");
		setCollection(d);
		if (!active && d.events?.length) setActive(d.events[0].id);
	}
	async function refreshSnap(id = active) {
		if (id) {
			setSnap(await query("snapshot", { eventId: id }));
		}
	}
	useEffect(() => {
		refreshList().catch((e) => setError(e.message));
	}, [userId]);
	useEffect(() => {
		if (active) refreshSnap(active).catch((e) => setError(e.message));
	}, [active, userId]);
	// Runs an API action, then reloads the event list and snapshot so every screen
	// shows the saved data. Returns the API result, or null if it failed.
	async function perform(action: string, payload: Obj = {}, next?: Page) {
		setLoading(true);
		setError("");
		setNotice("");
		try {
			const r = await api(action, payload);
			await refreshList();
			if (r.id && ["createEvent", "cloneEvent"].includes(action))
				setActive(r.id);
			else await refreshSnap();
			if (next) setPage(next);
			setNotice("Saved successfully.");
			return r;
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unable to save");
			return null;
		} finally {
			setLoading(false);
		}
	}
	const open = (p: Page) => {
		setPage(p);
		setSearch("");
		setNotice("");
		setError("");
	};
	const role: string | undefined = collection.role;
	return {
		userId,
		page,
		open,
		collection,
		orgId: collection.organizations?.[0]?.id as string | undefined,
		role,
		isAdmin: ["owner", "manager"].includes(role ?? ""),
		active,
		setActive,
		snap,
		data: eventData(snap),
		base: { eventId: active },
		edit,
		setEdit,
		selected,
		setSelected,
		search,
		setSearch,
		error,
		setError,
		notice,
		setNotice,
		loading,
		perform,
		refreshList,
	};
}

type Dashboard = ReturnType<typeof useDashboardState>;
const DashboardContext = createContext<Dashboard | null>(null);

export function DashboardProvider({
	userId,
	children,
}: {
	userId: string;
	children: React.ReactNode;
}) {
	const value = useDashboardState(userId);
	return (
		<DashboardContext.Provider value={value}>
			{children}
		</DashboardContext.Provider>
	);
}

export function useDashboard() {
	const ctx = useContext(DashboardContext);
	if (!ctx)
		throw new Error("useDashboard must be used inside DashboardProvider");
	return ctx;
}
