"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { api, query } from "@/lib/api";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
type Obj = Record<string, any>;
type Page =
	| "events"
	| "overview"
	| "eventForm"
	| "registrations"
	| "regForm"
	| "import"
	| "guests"
	| "guestForm"
	| "seating"
	| "tables"
	| "meals"
	| "reports"
	| "staff"
	| "activity";
const nav: [string, Page][] = [
	["Events", "events"],
	["Registrations", "registrations"],
	["Guests", "guests"],
	["Seating", "seating"],
	["Meals", "meals"],
	["Reports", "reports"],
];
const actionLabels: Record<string, string> = {
	"event.create": "Created event",
	"event.clone": "Copied event",
	"event.update": "Updated event",
	"registration.create": "Added registration",
	"registration.update": "Updated registration",
	"registration.import": "Imported registrations",
	"guest.update": "Updated guest",
	"guest.remove": "Removed guest",
	"meal.configure": "Changed meal options",
	"tables.configure": "Changed tables",
	"seat.assign": "Assigned seat",
	"seat.clear": "Cleared seat",
	"staff.role": "Changed staff role",
	"staff.remove": "Removed staff member",
	"invite.cancel": "Cancelled invitation",
	"password.resetLink": "Created password reset link",
};
const statuses = [
	"Pending",
	"Confirmed",
	"Paid",
	"Partially paid",
	"Unpaid",
	"Canceled",
];
function Badge({ value }: { value: string }) {
	return (
		<span className={"pill " + value.toLowerCase().replaceAll(" ", "-")}>
			{value}
		</span>
	);
}
function Field({
	label,
	value,
	onChange,
	type = "text",
	required = false,
	options,
}: {
	label: string;
	value: any;
	onChange: (s: string) => void;
	type?: string;
	required?: boolean;
	options?: string[];
}) {
	return (
		<div className="field">
			<label>
				{label}
				{options ? (
					<select
						value={value ?? ""}
						onChange={(e) => onChange(e.target.value)}
					>
						{options.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				) : (
					<input
						type={type}
						required={required}
						value={value ?? ""}
						onChange={(e) => onChange(e.target.value)}
					/>
				)}
			</label>
		</div>
	);
}
function Panel({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="panel">
			<h2>{title}</h2>
			{children}
		</section>
	);
}
function Table({
	heads,
	rows,
}: {
	heads: string[];
	rows: React.ReactNode[][];
}) {
	return (
		<div className="table-wrap">
			<table>
				<thead>
					<tr>
						{heads.map((h, i) => (
							<th key={i}>{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((r, i) => (
						<tr key={i}>
							{r.map((c, j) => (
								<td key={j}>{c}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
export default function Home() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
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
		[loading, setLoading] = useState(false),
		[menu, setMenu] = useState(false),
		[importRows, setImportRows] = useState<Obj[]>([]),
		[importName, setImportName] = useState(""),
		[source, setSource] = useState("External registration platform"),
		[report, setReport] = useState("Guest list"),
		[filterStatus, setFilterStatus] = useState("All"),
		[filterTable, setFilterTable] = useState("All"),
		[newOrg, setNewOrg] = useState(""),
		[invite, setInvite] = useState(""),
		[resetLink, setResetLink] = useState<Obj | null>(null),
		[staff, setStaff] = useState<Obj>({ rows: [], invites: [] });
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
		if (session?.user) refreshList().catch((e) => setError(e.message));
	}, [session?.user?.id]);
	useEffect(() => {
		if (active && session?.user)
			refreshSnap(active).catch((e) => setError(e.message));
	}, [active, session?.user?.id]);
	const orgId = collection.organizations?.[0]?.id,
		isAdmin = ["owner", "manager"].includes(collection.role);
	async function refreshStaff() {
		if (orgId && isAdmin) setStaff(await query("staff", { orgId }));
	}
	useEffect(() => {
		if (page === "staff") refreshStaff().catch((e) => setError(e.message));
		setResetLink(null);
	}, [page, orgId, collection.role]);
	const [pw, setPw] = useState<Obj>({}),
		[activity, setActivity] = useState<Obj[]>([]);
	useEffect(() => {
		if (page === "activity" && orgId && isAdmin)
			query("activity", { orgId })
				.then((d) => setActivity(d.rows))
				.catch((e) => setError(e.message));
	}, [page, orgId, isAdmin]);
	async function staffAction(
		action: string,
		payload: Obj,
		confirmText: string,
	) {
		if (!confirm(confirmText)) {
			refreshStaff();
			return;
		}
		setError("");
		setNotice("");
		try {
			await api(action, { orgId, ...payload });
			await refreshStaff();
			setNotice("Saved successfully.");
		} catch (ex) {
			setError(ex instanceof Error ? ex.message : "Unable to save");
		}
	}
	async function changePassword(ev: React.FormEvent) {
		ev.preventDefault();
		setError("");
		setNotice("");
		if (pw.next !== pw.confirm) {
			setError("New passwords do not match");
			return;
		}
		const r = await authClient.changePassword({
			currentPassword: pw.current,
			newPassword: pw.next,
			revokeOtherSessions: true,
		});
		if (r.error) {
			setError(r.error.message || "Unable to change password");
			return;
		}
		setPw({});
		setNotice("Password updated. Your other devices have been signed out.");
	}
	async function createResetLink(m: Obj) {
		setError("");
		setResetLink(null);
		try {
			const r = await api("resetLink", { orgId, userId: m.userId });
			setResetLink({ name: m.name, url: r.resetUrl });
		} catch (ex) {
			setError(
				ex instanceof Error ? ex.message : "Unable to create reset link",
			);
		}
	}
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
	const e = snap?.event;
	const regs = snap?.registrations || [],
		gs = snap?.guests || [],
		tables = snap?.tables || [],
		meals = snap?.meals || [],
		seats = snap?.seats || [];
	const taken = (t: string) => seats.filter((x: Obj) => x.tableId === t);
	const buyer = (r: Obj) => r.buyer?.name || "";
	const registration = (g: Obj) =>
		regs.find((r: Obj) => r.id === g.registrationId);
	const seat = (g: Obj) => seats.find((s: Obj) => s.guestId === g.id);
	const seatTable = (g: Obj) =>
		tables.find((t: Obj) => t.id === seat(g)?.tableId);
	const meal = (g: Obj) =>
		meals.find((m: Obj) => m.id === g.mealOptionId)?.name || "";
	const activeRegs = regs.filter((r: Obj) => r.status !== "Canceled");
	const registered = activeRegs.reduce(
		(a: number, r: Obj) => a + r.quantity,
		0,
	);
	const base = { eventId: active };
	const open = (p: Page) => {
		setPage(p);
		setSearch("");
		setNotice("");
		setError("");
	};
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
	if (collection.organizations?.length === 0)
		return (
			<main id="main" className="auth">
				<div className="panel">
					<h1>Organization setup</h1>
					<p>
						This account is not yet authorized for an organization. If you are
						the bootstrap administrator, create the first organization.
						Otherwise, use the invitation link sent by your administrator.
					</p>
					<Field
						label="Organization name"
						value={newOrg}
						onChange={setNewOrg}
					/>
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
						<button
							className="secondary"
							onClick={() =>
								authClient.signOut().then(() => router.push("/login"))
							}
						>
							Sign out
						</button>
					</div>
				</div>
			</main>
		);
	async function saveRegistration() {
		const data = {
			...edit,
			quantity: Number(edit.quantity || 1),
			names: edit.names || [],
		};
		await perform(
			"registration",
			{ ...base, data, ...(selected ? { registrationId: selected } : {}) },
			"registrations",
		);
	}
	async function readSpreadsheet(file: File) {
		setError("");
		try {
			if (file.size > 5_000_000) throw Error("Maximum import size is 5 MB");
			const buffer = await file.arrayBuffer();
			const book = XLSX.read(buffer, { type: "array", cellDates: false });
			const data = XLSX.utils.sheet_to_json<Obj>(
				book.Sheets[book.SheetNames[0]],
				{ defval: "", raw: false },
			);
			if (!data.length) throw Error("Spreadsheet is empty");
			if (data.length > 2000) throw Error("Maximum 2,000 rows per import");
			const norm = (o: Obj, patterns: string[]) => {
				const key = Object.keys(o).find((k) =>
					patterns.some((p) => k.toLowerCase().trim().includes(p)),
				);
				return key ? String(o[key] || "").trim() : "";
			};
			const known = new Set(
				regs
					.filter((r: Obj) => r.externalKey)
					.map((r: Obj) => `${r.source}:${r.externalKey}`),
			);
			const rows = data.map((r, i) => {
				const buyer = norm(r, [
						"buyer",
						"purchaser",
						"full name",
						"customer name",
						"registrant",
						"name",
					]),
					email = norm(r, ["email"]),
					q =
						Number(norm(r, ["quantity", "tickets", "attendees", "seats"])) || 1,
					status = norm(r, ["status"]) || "Pending",
					ref = norm(r, [
						"reference",
						"external id",
						"order id",
						"confirmation",
						"transaction id",
					]),
					key = ref || `${email.toLowerCase()}:${buyer.toLowerCase()}:${q}`,
					valid =
						buyer.length > 0 &&
						q > 0 &&
						q <= 500 &&
						statuses.includes(status) &&
						!!key;
				return {
					buyer,
					email,
					quantity: q,
					source,
					reference: ref,
					status,
					externalKey: key,
					phone: norm(r, ["phone"]),
					company: norm(r, ["company", "organization"]),
					notes: "",
					decision: !valid
						? "Review"
						: known.has(`${source}:${key}`)
							? "Duplicate"
							: "New",
					row: i + 2,
				};
			});
			const seen = new Set<string>();
			rows.forEach((r) => {
				if (r.decision === "New") {
					if (seen.has(r.externalKey)) r.decision = "Duplicate";
					seen.add(r.externalKey);
				}
			});
			setImportRows(rows);
			setImportName(file.name);
		} catch (ex) {
			setError(ex instanceof Error ? ex.message : "File could not be read");
		}
	}
	function download() {
		const filtered = filteredGuests();
		let header: string[] = [],
			rows: any[][] = [];
		if (report === "Meal summary") {
			header = ["Meal", "Count"];
			rows = [
				...meals.map((m: Obj) => [
					m.name,
					filtered.filter((g: Obj) => g.mealOptionId === m.id).length,
				]),
				["Not selected", filtered.filter((g: Obj) => !g.mealOptionId).length],
			];
		} else if (report === "Registration status summary") {
			header = [
				"Purchaser",
				"Tickets",
				"Source",
				"Recorded status",
				"Reference",
			];
			rows = regs
				.filter((r: Obj) => filterStatus === "All" || r.status === filterStatus)
				.map((r: Obj) => [
					buyer(r),
					r.quantity,
					r.source,
					r.status,
					r.reference,
				]);
		} else {
			header = ["Guest", "Purchaser", "Table", "Seat", "Meal", "Status"];
			rows = filtered
				.filter((g: Obj) => report !== "Unassigned guests" || !seat(g))
				.filter((g: Obj) => report !== "Missing meals" || !g.mealOptionId)
				.map((g: Obj) => [
					g.name,
					buyer(registration(g)),
					seatTable(g)?.name || "Unassigned",
					seat(g)?.seat || "",
					meal(g) || "Not selected",
					registration(g)?.status,
				]);
		}
		const sanitized = rows.map((row) =>
			row.map((x) =>
				typeof x === "string" && /^[=+@\-\t\r]/.test(x) ? `'${x}` : x,
			),
		);
		const book = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(
			book,
			XLSX.utils.aoa_to_sheet([header, ...sanitized]),
			"Report",
		);
		XLSX.writeFile(
			book,
			`gatherwell-${report.toLowerCase().replaceAll(" ", "-")}.xlsx`,
		);
	}
	function filteredGuests() {
		return gs.filter(
			(g: Obj) =>
				(filterStatus === "All" || registration(g)?.status === filterStatus) &&
				(filterTable === "All" || seat(g)?.tableId === filterTable),
		);
	}
	function title(text: string, desc: string) {
		return (
			<header>
				<p className="muted">
					{e?.name || "GatherWell"} / {text}
				</p>
				<h1>{text}</h1>
				<p className="muted">{desc}</p>
			</header>
		);
	}
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
				<button
					onClick={() => authClient.signOut().then(() => router.push("/login"))}
				>
					Sign out
				</button>
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
					{page === "events" && (
						<>
							{title(
								"Events",
								"Choose an event, create a new one, or clone last year’s configuration.",
							)}
							<div className="actions">
								<button
									onClick={() => {
										setSelected("");
										setEdit({
											name: "",
											date: "",
											venue: "",
											capacity: 100,
											status: "Draft",
											source: "External platform",
											seatingEnabled: true,
											mealsEnabled: true,
										});
										open("eventForm");
									}}
								>
									Create event
								</button>
							</div>
							<div className="cards">
								{collection.events.map((x: Obj) => (
									<article className="card" key={x.id}>
										<h2>{x.name}</h2>
										<p>
											{x.date} · {x.venue}
										</p>
										<p>
											<Badge value={x.status} /> · Capacity {x.capacity}
										</p>
										<div className="actions">
											<button
												onClick={() => {
													setActive(x.id);
													open("overview");
												}}
											>
												Open event
											</button>
											<button
												className="secondary"
												onClick={() =>
													perform("cloneEvent", { eventId: x.id }, "overview")
												}
											>
												Clone event
											</button>
										</div>
									</article>
								))}
							</div>
						</>
					)}
					{page === "overview" && e && (
						<>
							{title(
								"Event overview",
								"A quick summary of attendance and items requiring attention.",
							)}
							<div className="actions">
								<button
									onClick={() => {
										setEdit({ ...e });
										setSelected(e.id);
										open("eventForm");
									}}
								>
									Edit event
								</button>
								<button
									className="secondary"
									onClick={() => {
										setEdit({
											buyer: "",
											email: "",
											phone: "",
											company: "",
											quantity: 1,
											source: "Phone",
											reference: "",
											status: "Pending",
											notes: "",
										});
										setSelected("");
										open("regForm");
									}}
								>
									Add registration
								</button>
								<button className="secondary" onClick={() => open("import")}>
									Import spreadsheet
								</button>
							</div>
							<div className="cards">
								{[
									["Event capacity", e.capacity],
									["Registered seats", registered],
									["Seats available", Math.max(0, e.capacity - registered)],
									[
										"Guest records",
										gs.filter(
											(g: Obj) => registration(g)?.status !== "Canceled",
										).length,
									],
									[
										"Guests not seated",
										gs.filter(
											(g: Obj) =>
												registration(g)?.status !== "Canceled" && !seat(g),
										).length,
									],
									[
										"Missing meals",
										gs.filter(
											(g: Obj) =>
												registration(g)?.status !== "Canceled" &&
												!g.mealOptionId,
										).length,
									],
									[
										"Pending registrations",
										regs.filter((r: Obj) =>
											["Pending", "Unpaid", "Partially paid"].includes(
												r.status,
											),
										).length,
									],
								].map(([a, b]) => (
									<div className="card" key={String(a)}>
										<h3>{a}</h3>
										<div className="metric">{b}</div>
									</div>
								))}
							</div>
							<Panel title="Next actions">
								<div className="actions">
									{nav.slice(1).map(([l, p]) => (
										<button
											key={p}
											className="secondary"
											onClick={() => open(p)}
										>
											{l}
										</button>
									))}
								</div>
								<div className="notice">
									Status reflects manual entry or an external platform. This app
									does not collect or verify payments.
								</div>
							</Panel>
						</>
					)}
					{page === "eventForm" && (
						<>
							{title(
								selected ? "Edit event" : "Create event",
								"Configure event details and optional guest features.",
							)}
							<Panel title="Event details">
								<form
									onSubmit={async (ev) => {
										ev.preventDefault();
										await perform(
											selected ? "updateEvent" : "createEvent",
											selected
												? { eventId: selected, data: edit }
												: { orgId: collection.organizations[0].id, data: edit },
											"overview",
										);
									}}
								>
									<div className="split">
										<Field
											label="Event name"
											required
											value={edit.name}
											onChange={(s) => setEdit({ ...edit, name: s })}
										/>
										<Field
											label="Event date"
											type="date"
											required
											value={edit.date}
											onChange={(s) => setEdit({ ...edit, date: s })}
										/>
										<Field
											label="Venue"
											required
											value={edit.venue}
											onChange={(s) => setEdit({ ...edit, venue: s })}
										/>
										<Field
											label="Maximum capacity"
											required
											type="number"
											value={edit.capacity}
											onChange={(s) => setEdit({ ...edit, capacity: s })}
										/>
										<Field
											label="Status"
											value={edit.status}
											onChange={(s) => setEdit({ ...edit, status: s })}
											options={[
												"Draft",
												"Published",
												"Closed",
												"Completed",
												"Archived",
											]}
										/>
										<Field
											label="Registration source"
											value={edit.source}
											onChange={(s) => setEdit({ ...edit, source: s })}
										/>
									</div>
									<div className="actions">
										<label>
											<input
												style={{ width: 25, minHeight: 25 }}
												type="checkbox"
												checked={!!edit.seatingEnabled}
												onChange={(x) =>
													setEdit({ ...edit, seatingEnabled: x.target.checked })
												}
											/>{" "}
											Enable seating
										</label>
										<label>
											<input
												style={{ width: 25, minHeight: 25 }}
												type="checkbox"
												checked={!!edit.mealsEnabled}
												onChange={(x) =>
													setEdit({ ...edit, mealsEnabled: x.target.checked })
												}
											/>{" "}
											Enable meals
										</label>
									</div>
									<div className="actions">
										<button disabled={loading}>Save event</button>
										<button
											type="button"
											className="secondary"
											onClick={() => open("events")}
										>
											Cancel
										</button>
									</div>
								</form>
							</Panel>
						</>
					)}
					{page === "registrations" && (
						<>
							{title(
								"Registrations",
								"Search purchasers and manage externally recorded registration status.",
							)}
							<div className="actions">
								<button
									onClick={() => {
										setSelected("");
										setEdit({
											buyer: "",
											email: "",
											phone: "",
											company: "",
											quantity: 1,
											source: "Phone",
											reference: "",
											status: "Pending",
											notes: "",
										});
										open("regForm");
									}}
								>
									Add registration
								</button>
								<button className="secondary" onClick={() => open("import")}>
									Import CSV / Excel
								</button>
							</div>
							<Panel title="Find a registration">
								<Field
									label="Search purchaser, email, reference, source or status"
									value={search}
									onChange={setSearch}
								/>
								<Table
									heads={[
										"Purchaser",
										"Tickets",
										"Source",
										"Recorded status",
										"Reference",
										"Action",
									]}
									rows={regs
										.filter((r: Obj) =>
											[
												buyer(r),
												r.buyer?.email,
												r.source,
												r.status,
												r.reference,
											]
												.join(" ")
												.toLowerCase()
												.includes(search.toLowerCase()),
										)
										.map((r: Obj) => [
											<>
												{buyer(r)}
												<p className="muted">{r.buyer?.email}</p>
											</>,
											r.quantity,
											r.source,
											<Badge value={r.status} />,
											r.reference,
											<button
												className="secondary"
												onClick={() => {
													setSelected(r.id);
													setEdit({
														...r,
														buyer: buyer(r),
														email: r.buyer?.email || "",
														phone: r.buyer?.phone || "",
														company: r.buyer?.company || "",
													});
													open("regForm");
												}}
											>
												Review / edit
											</button>,
										])}
								/>
							</Panel>
							<Panel title="Import history">
								<Table
									heads={["Date", "Source", "File", "Added", "Skipped"]}
									rows={(snap?.batches || []).map((b: Obj) => [
										new Date(b.createdAt).toLocaleDateString(),
										b.source,
										b.fileName,
										b.added,
										b.skipped,
									])}
								/>
							</Panel>
						</>
					)}
					{page === "regForm" && (
						<>
							{title(
								selected ? "Edit registration" : "Add registration",
								"Record a purchaser, ticket quantity and externally reported status.",
							)}
							<Panel title="Purchaser and registration">
								<form
									onSubmit={(ev) => {
										ev.preventDefault();
										saveRegistration();
									}}
								>
									<div className="split">
										{[
											["Purchaser full name", "buyer"],
											["Email address", "email"],
											["Phone", "phone"],
											["Company", "company"],
											["Ticket quantity", "quantity"],
											["Reference / check number", "reference"],
											["Source", "source"],
										].map(([label, key]) => (
											<Field
												key={key}
												label={label}
												value={edit[key]}
												type={
													key === "quantity"
														? "number"
														: key === "email"
															? "email"
															: "text"
												}
												required={["buyer", "quantity"].includes(key)}
												onChange={(s) => setEdit({ ...edit, [key]: s })}
											/>
										))}
										<Field
											label="Recorded status"
											value={edit.status}
											onChange={(s) => setEdit({ ...edit, status: s })}
											options={statuses}
										/>
									</div>
									<Field
										label="Seating requests / notes"
										value={edit.notes}
										onChange={(s) => setEdit({ ...edit, notes: s })}
									/>
									{!selected && (
										<div className="notice">
											Guest placeholder records will be created automatically.
											Complete their names and meals from the Guests screen.
										</div>
									)}
									{selected && (
										<div className="notice">
											Changing a registration to Canceled releases seating
											assignments but preserves the historical record.
										</div>
									)}
									<div className="actions">
										<button disabled={loading}>Save registration</button>
										<button
											className="secondary"
											type="button"
											onClick={() => open("registrations")}
										>
											Cancel
										</button>
									</div>
								</form>
							</Panel>
						</>
					)}
					{page === "import" && (
						<>
							{title(
								"Import registrations",
								"Select a CSV or Excel export; review before committing new records.",
							)}
							<Panel title="Choose a spreadsheet">
								<Field
									label="Source / platform"
									value={source}
									onChange={setSource}
								/>
								<label>
									CSV or Excel file
									<input
										type="file"
										accept=".csv,.xlsx,.xls"
										onChange={(x) => {
											const f = x.target.files?.[0];
											if (f) readSpreadsheet(f);
										}}
									/>
								</label>
								<p className="muted">
									Expected columns include purchaser/name, email, quantity,
									status, and reference. Import files are read locally by your
									browser and not stored on the server.
								</p>
							</Panel>
							{importRows.length > 0 && (
								<Panel title="Review import before saving">
									<p>
										<strong>{importName}</strong> · {importRows.length} rows ·{" "}
										{importRows.filter((x) => x.decision === "New").length} new
										· {importRows.filter((x) => x.decision !== "New").length}{" "}
										flagged
									</p>
									<Table
										heads={[
											"Decision",
											"Row",
											"Purchaser",
											"Email",
											"Qty",
											"Status",
											"Reference",
										]}
										rows={importRows.map((r) => [
											<Badge value={r.decision} />,
											r.row,
											r.buyer,
											r.email,
											r.quantity,
											r.status,
											r.reference,
										])}
									/>
									<div className="notice">
										Only valid new rows will be imported. Existing external
										references are not overwritten or deleted.
									</div>
									<button
										disabled={
											loading || !importRows.some((r) => r.decision === "New")
										}
										onClick={async () => {
											const r = await perform(
												"import",
												{
													...base,
													source,
													fileName: importName,
													rows: importRows
														.filter((r) => r.decision === "New")
														.map(({ decision, row, ...rest }) => rest),
												},
												"registrations",
											);
											if (r) {
												setImportRows([]);
												setNotice(
													`Import complete: ${r.added} added, ${r.skipped} skipped.`,
												);
											}
										}}
									>
										Confirm safe new rows
									</button>
								</Panel>
							)}
						</>
					)}
					{page === "guests" && (
						<>
							{title(
								"Guest directory",
								"Find guests, edit meals and seating preferences.",
							)}
							<Panel title="Find a guest">
								<Field
									label="Search guest, purchaser or meal"
									value={search}
									onChange={setSearch}
								/>
								<Table
									heads={[
										"Guest",
										"Purchaser",
										"Meal",
										"Table / seat",
										"Action",
									]}
									rows={gs
										.filter((g: Obj) =>
											[g.name, buyer(registration(g)), meal(g)]
												.join(" ")
												.toLowerCase()
												.includes(search.toLowerCase()),
										)
										.map((g: Obj) => [
											g.name,
											buyer(registration(g)),
											meal(g) || "Not selected",
											seatTable(g)
												? `${seatTable(g).name} / ${seat(g).seat}`
												: "Unassigned",
											<button
												className="secondary"
												onClick={() => {
													setSelected(g.id);
													setEdit({ ...g });
													open("guestForm");
												}}
											>
												Review / edit
											</button>,
										])}
								/>
							</Panel>
						</>
					)}
					{page === "guestForm" && snap?.role !== "viewer" && (
						<>
							{title(
								"Edit guest",
								"Manage guest name, meal selection, and seating requests.",
							)}
							<Panel title="Guest information">
								<form
									onSubmit={(ev) => {
										ev.preventDefault();
										perform(
											"guest",
											{
												...base,
												guestId: selected,
												name: edit.name,
												mealId: edit.mealOptionId || null,
												diet: edit.diet || "",
												request: edit.request || "",
											},
											"guests",
										);
									}}
								>
									<Field
										label="Guest full name"
										required
										value={edit.name}
										onChange={(s) => setEdit({ ...edit, name: s })}
									/>
									<label>
										Meal choice
										<select
											value={edit.mealOptionId || ""}
											onChange={(x) =>
												setEdit({ ...edit, mealOptionId: x.target.value })
											}
										>
											<option value="">Not selected</option>
											{meals
												.filter(
													(m: Obj) => m.active || m.id === edit.mealOptionId,
												)
												.map((m: Obj) => (
													<option key={m.id} value={m.id}>
														{m.name}
													</option>
												))}
										</select>
									</label>
									<Field
										label="Dietary and allergy notes (restricted to manager/owner)"
										value={edit.diet}
										onChange={(s) => setEdit({ ...edit, diet: s })}
									/>
									<Field
										label="Preferred tablemates / seating request"
										value={edit.request}
										onChange={(s) => setEdit({ ...edit, request: s })}
									/>
									<div className="actions">
										<button disabled={loading}>Save guest</button>
										<button
											className="secondary"
											type="button"
											onClick={() => open("guests")}
										>
											Cancel
										</button>
										<button
											className="secondary"
											type="button"
											disabled={loading}
											onClick={() => {
												if (
													confirm(
														`Remove ${edit.name}? Their seat is cleared and the registration's ticket quantity goes down by one.`,
													)
												)
													perform(
														"removeGuest",
														{ ...base, guestId: selected },
														"guests",
													);
											}}
										>
											Remove guest
										</button>
									</div>
								</form>
							</Panel>
						</>
					)}
					{page === "seating" && (
						<>
							{title(
								"Seating",
								"Select a numbered table to view and edit seating assignments.",
							)}
							<div className="actions">
								<button onClick={() => open("tables")}>Configure tables</button>
								<button className="secondary" onClick={() => open("reports")}>
									Print table rosters
								</button>
							</div>
							<Panel title="Tables at a glance">
								<p>
									{
										gs.filter(
											(g: Obj) =>
												!seat(g) && registration(g)?.status !== "Canceled",
										).length
									}{" "}
									unassigned guests.
								</p>
								<div className="table-grid">
									{tables.map((t: Obj) => (
										<button
											className="table-button"
											key={t.id}
											onClick={() => setSelected(t.id)}
										>
											<strong>{t.name}</strong>
											<p>
												{taken(t.id).length} of {t.capacity} assigned
											</p>
											<div className="progress">
												<span
													style={{
														width: `${(100 * taken(t.id).length) / t.capacity}%`,
													}}
												/>
											</div>
											{t.capacity - taken(t.id).length} open
										</button>
									))}
								</div>
							</Panel>
							{selected && tables.some((t: Obj) => t.id === selected) && (
								<Panel
									title={
										"Assignments for " +
										tables.find((t: Obj) => t.id === selected)?.name
									}
								>
									<Table
										heads={["Seat", "Guest", "Meal", "Recorded status"]}
										rows={Array.from(
											{
												length:
													tables.find((t: Obj) => t.id === selected)
														?.capacity || 0,
											},
											(_, i) => {
												const a = seats.find(
														(x: Obj) =>
															x.tableId === selected && x.seat === i + 1,
													),
													g = gs.find((x: Obj) => x.id === a?.guestId);
												return [
													i + 1,
													g?.name || "Available",
													g ? meal(g) : "",
													g ? <Badge value={registration(g)?.status} /> : null,
												];
											},
										)}
									/>
									<div className="actions">
										<button
											className="secondary"
											onClick={() => setSelected("")}
										>
											Close table details
										</button>
									</div>
								</Panel>
							)}
							<Panel title="Assign or move a guest">
								<p className="muted">
									Use the keyboard-accessible controls. Existing assignments
									cannot be overwritten.
								</p>
								<label>
									Guest
									<select id="seat-guest">
										<option value="">Choose guest</option>
										{gs
											.filter(
												(g: Obj) => registration(g)?.status !== "Canceled",
											)
											.map((g: Obj) => (
												<option key={g.id} value={g.id}>
													{g.name} — {buyer(registration(g))}
												</option>
											))}
									</select>
								</label>
								<label>
									Table
									<select id="seat-table" defaultValue="">
										<option value="">Unassigned</option>
										{tables.map((t: Obj) => (
											<option key={t.id} value={t.id}>
												{t.name}
											</option>
										))}
									</select>
								</label>
								<label>
									Seat number
									<input
										id="seat-number"
										type="number"
										min={1}
										placeholder="Enter available seat number"
									/>
								</label>
								<button
									onClick={() => {
										const guestId = (
												document.getElementById(
													"seat-guest",
												) as HTMLSelectElement
											).value,
											tableId = (
												document.getElementById(
													"seat-table",
												) as HTMLSelectElement
											).value,
											number = (
												document.getElementById(
													"seat-number",
												) as HTMLInputElement
											).value;
										if (!guestId) {
											setError("Choose a guest");
											return;
										}
										perform(
											"seat",
											{
												...base,
												guestId,
												tableId: tableId || null,
												seat: number || 1,
											},
											"seating",
										);
									}}
								>
									Save seating assignment
								</button>
							</Panel>
						</>
					)}
					{page === "tables" && (
						<>
							{title(
								"Configure tables",
								"Change the table count and default capacity without losing assignments.",
							)}
							<Panel title="Table settings">
								<Field
									label="Number of tables"
									type="number"
									value={edit.count ?? tables.length}
									onChange={(s) => setEdit({ ...edit, count: s })}
								/>
								<Field
									label="Seats per table"
									type="number"
									value={edit.capacity ?? tables[0]?.capacity ?? 10}
									onChange={(s) => setEdit({ ...edit, capacity: s })}
								/>
								<div className="notice">
									Changes that strand assigned guests or exceed event capacity
									are rejected.
								</div>
								<button
									disabled={loading}
									onClick={() =>
										perform(
											"tables",
											{
												...base,
												count: Number(edit.count ?? tables.length),
												capacity: Number(
													edit.capacity ?? tables[0]?.capacity ?? 10,
												),
											},
											"seating",
										)
									}
								>
									Save table settings
								</button>
							</Panel>
						</>
					)}
					{page === "meals" && (
						<>
							{title(
								"Meals",
								"Count dinner selections and find missing meal choices.",
							)}
							<div className="cards">
								{meals
									.filter((m: Obj) => m.active)
									.map((m: Obj) => (
										<div className="card" key={m.id}>
											<h3>{m.name}</h3>
											<div className="metric">
												{gs.filter((g: Obj) => g.mealOptionId === m.id).length}
											</div>
										</div>
									))}
								<div className="card">
									<h3>Not selected</h3>
									<div className="metric">
										{gs.filter((g: Obj) => !g.mealOptionId).length}
									</div>
								</div>
							</div>
							<Panel title="Configure meal options">
								<label>
									One choice per line
									<textarea
										rows={5}
										id="meal-list"
										defaultValue={meals
											.filter((m: Obj) => m.active)
											.map((m: Obj) => m.name)
											.join("\n")}
									/>
								</label>
								<button
									onClick={() =>
										perform(
											"meals",
											{
												...base,
												names: (
													document.getElementById(
														"meal-list",
													) as HTMLTextAreaElement
												).value
													.split("\n")
													.map((x) => x.trim())
													.filter(Boolean),
											},
											"meals",
										)
									}
								>
									Save meal choices
								</button>
							</Panel>
							<Panel title="Guest meal selections">
								<Table
									heads={["Guest", "Meal", "Table", "Action"]}
									rows={gs.map((g: Obj) => [
										g.name,
										meal(g) || "Missing selection",
										seatTable(g)?.name || "Unassigned",
										<button
											className="secondary"
											onClick={() => {
												setSelected(g.id);
												setEdit({ ...g });
												open("guestForm");
											}}
										>
											Update
										</button>,
									])}
								/>
							</Panel>
						</>
					)}
					{page === "reports" && (
						<>
							{title(
								"Reports & printing",
								"Preview, print, or download event-day reports.",
							)}
							<Panel title="Choose report">
								<div className="split">
									<Field
										label="Report type"
										value={report}
										onChange={setReport}
										options={[
											"Guest list",
											"Table rosters",
											"Meal summary",
											"Registration status summary",
											"Unassigned guests",
											"Missing meals",
										]}
									/>
									<Field
										label="Status"
										value={filterStatus}
										onChange={setFilterStatus}
										options={["All", ...statuses]}
									/>
									<div className="field">
										<label>Table</label>
										<select
											value={filterTable}
											onChange={(x) => setFilterTable(x.target.value)}
										>
											<option value="All">All</option>
											{tables.map((t: Obj) => (
												<option key={t.id} value={t.id}>
													{t.name}
												</option>
											))}
										</select>
									</div>
								</div>
								<div className="actions">
									<button onClick={() => window.print()}>
										Print / Save as PDF
									</button>
									<button className="secondary" onClick={download}>
										Download Excel
									</button>
								</div>
							</Panel>
							<Panel title={`${report} — ${e?.name || ""}`}>
								<p>
									<strong>Event date:</strong> {e?.date} ·{" "}
									<strong>Venue:</strong> {e?.venue}
								</p>
								{report === "Meal summary" ? (
									<Table
										heads={["Meal", "Count"]}
										rows={[
											...meals
												.filter((m: Obj) => m.active)
												.map((m: Obj) => [
													m.name,
													filteredGuests().filter(
														(g: Obj) => g.mealOptionId === m.id,
													).length,
												]),
											[
												"Not selected",
												filteredGuests().filter((g: Obj) => !g.mealOptionId)
													.length,
											],
										]}
									/>
								) : report === "Registration status summary" ? (
									<Table
										heads={["Purchaser", "Tickets", "Source", "Status"]}
										rows={regs
											.filter(
												(r: Obj) =>
													filterStatus === "All" || r.status === filterStatus,
											)
											.map((r: Obj) => [
												buyer(r),
												r.quantity,
												r.source,
												r.status,
											])}
									/>
								) : (
									<Table
										heads={["Guest", "Purchaser", "Table", "Meal"]}
										rows={filteredGuests()
											.filter(
												(g: Obj) => report !== "Unassigned guests" || !seat(g),
											)
											.filter(
												(g: Obj) =>
													report !== "Missing meals" || !g.mealOptionId,
											)
											.sort((a: Obj, b: Obj) =>
												report === "Table rosters"
													? (seatTable(a)?.number || 999) -
														(seatTable(b)?.number || 999)
													: a.name.localeCompare(b.name),
											)
											.map((g: Obj) => [
												g.name,
												buyer(registration(g)),
												seatTable(g)?.name || "Unassigned",
												meal(g) || "Not selected",
											])}
									/>
								)}
							</Panel>
						</>
					)}
					{page === "staff" && (
						<>
							{title(
								"Staff & Access",
								"Invitations and authorization for organization staff.",
							)}
							{collection.role === "owner" && (
								<Panel title="Invite a staff member">
									<Field
										label="Staff email"
										value={edit.email || ""}
										onChange={(s) => setEdit({ ...edit, email: s })}
									/>
									<Field
										label="Access role"
										value={edit.role || "viewer"}
										onChange={(s) => setEdit({ ...edit, role: s })}
										options={["viewer", "manager"]}
									/>
									<button
										onClick={async () => {
											const result = await perform("invite", {
												orgId: collection.organizations[0].id,
												email: edit.email,
												role: edit.role || "viewer",
											});
											if (result) {
												setInvite(result.inviteUrl);
												refreshStaff();
											}
										}}
									>
										Create invitation link
									</button>
									{invite && (
										<div className="notice">
											Share this invitation link privately (expires in 7 days):
											<p style={{ overflowWrap: "anywhere" }}>{invite}</p>
											<button
												className="secondary"
												onClick={() => navigator.clipboard.writeText(invite)}
											>
												Copy link
											</button>
										</div>
									)}
								</Panel>
							)}
							{isAdmin && (
								<Panel title="Staff members">
									<p className="muted">
										If a staff member forgets their password, create a one-time
										reset link and share it with them privately. It expires in 1
										hour and signs them out everywhere once used. Removing
										someone deletes their login; you can invite them again
										later.
										{collection.role === "manager" &&
											" Managers can reset and remove viewers only."}
									</p>
									<Table
										heads={["Name", "Email", "Role", "Actions"]}
										rows={staff.rows.map((m: Obj) => {
											const self = m.userId === session.user.id,
												canManage =
													!self &&
													m.role !== "owner" &&
													(collection.role === "owner" || m.role === "viewer");
											return [
												m.name,
												m.email,
												collection.role === "owner" &&
												!self &&
												m.role !== "owner" ? (
													<select
														aria-label={`Role for ${m.name}`}
														style={{ width: "auto" }}
														value={m.role}
														onChange={(x) =>
															staffAction(
																"staffRole",
																{ userId: m.userId, role: x.target.value },
																`Change ${m.name} to ${x.target.value}?`,
															)
														}
													>
														<option value="manager">manager</option>
														<option value="viewer">viewer</option>
													</select>
												) : (
													m.role
												),
												self ? (
													<span className="muted">You</span>
												) : (
													<div className="actions">
														{collection.role === "owner" ||
														m.role === "viewer" ? (
															<button
																className="secondary"
																onClick={() => createResetLink(m)}
															>
																Create reset link
															</button>
														) : (
															<span className="muted">Ask the owner</span>
														)}
														{canManage && (
															<button
																className="secondary"
																onClick={() =>
																	staffAction(
																		"removeStaff",
																		{ userId: m.userId },
																		`Remove ${m.name} (${m.email})? This deletes their login and ends their access.`,
																	)
																}
															>
																Remove
															</button>
														)}
													</div>
												),
											];
										})}
									/>
									{resetLink && (
										<div className="notice">
											Password reset link for {resetLink.name} (expires in 1
											hour, works once):
											<p style={{ overflowWrap: "anywhere" }}>
												{resetLink.url}
											</p>
											<button
												className="secondary"
												onClick={() =>
													navigator.clipboard.writeText(resetLink.url)
												}
											>
												Copy link
											</button>
										</div>
									)}
								</Panel>
							)}
							{collection.role === "owner" && (
								<Panel title="Pending invitations">
									{staff.invites.filter((x: Obj) => !x.acceptedAt).length ? (
										<Table
											heads={["Email", "Role", "Expires", ""]}
											rows={staff.invites
												.filter((x: Obj) => !x.acceptedAt)
												.map((x: Obj) => [
													x.email,
													x.role,
													new Date(x.expiresAt) < new Date()
														? "Expired"
														: new Date(x.expiresAt).toLocaleDateString(),
													<button
														className="secondary"
														onClick={() =>
															staffAction(
																"cancelInvite",
																{ inviteId: x.id },
																`Cancel the invitation for ${x.email}? The link will stop working.`,
															)
														}
													>
														Cancel
													</button>,
												])}
										/>
									) : (
										<p className="muted">No pending invitations.</p>
									)}
								</Panel>
							)}
							<Panel title="Change your password">
								<form onSubmit={changePassword}>
									<Field
										label="Current password"
										type="password"
										required
										value={pw.current}
										onChange={(s) => setPw({ ...pw, current: s })}
									/>
									<Field
										label="New password (at least 12 characters)"
										type="password"
										required
										value={pw.next}
										onChange={(s) => setPw({ ...pw, next: s })}
									/>
									<Field
										label="Confirm new password"
										type="password"
										required
										value={pw.confirm}
										onChange={(s) => setPw({ ...pw, confirm: s })}
									/>
									<button>Update password</button>
								</form>
							</Panel>
						</>
					)}
					{page === "activity" && (
						<>
							{title(
								"Change History",
								"The latest 200 changes made in GatherWell.",
							)}
							<Panel title="Recent changes">
								{isAdmin ? (
									activity.length ? (
										<Table
											heads={["When", "Who", "What", "Event", "Details"]}
											rows={activity.map((a: Obj) => [
												new Date(a.createdAt).toLocaleString(),
												a.actor || "Removed user",
												actionLabels[a.action] || a.action,
												a.event || "",
												a.details || "",
											])}
										/>
									) : (
										<p className="muted">No changes recorded yet.</p>
									)
								) : (
									<p className="muted">
										Only owners and managers can view change history.
									</p>
								)}
							</Panel>
						</>
					)}
				</main>
			</div>
		</div>
	);
}
