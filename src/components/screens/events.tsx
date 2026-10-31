import { useDashboard } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { ScreenTitle } from "./screen-title";
import { emptyRegistration, nav, type Obj } from "@/lib/dashboard";

export function EventsScreen() {
	const { collection, open, setActive, setEdit, setSelected, perform } =
		useDashboard();
	return (
		<>
			<ScreenTitle
				text="Events"
				desc="Choose an event, create a new one, or clone last year’s configuration."
			/>
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
	);
}

export function OverviewScreen() {
	const { data, open, setEdit, setSelected } = useDashboard();
	const { event: e, gs, regs, registration, seat, registered } = data;
	if (!e) return null;
	const live = gs.filter((g) => registration(g)?.status !== "Canceled");
	return (
		<>
			<ScreenTitle
				text="Event overview"
				desc="A quick summary of attendance and items requiring attention."
			/>
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
						setEdit({ ...emptyRegistration });
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
					["Guest records", live.length],
					["Guests not seated", live.filter((g) => !seat(g)).length],
					["Missing meals", live.filter((g) => !g.mealOptionId).length],
					[
						"Pending registrations",
						regs.filter((r) =>
							["Pending", "Unpaid", "Partially paid"].includes(r.status),
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
						<button key={p} className="secondary" onClick={() => open(p)}>
							{l}
						</button>
					))}
				</div>
				<div className="notice">
					Status reflects manual entry or an external platform. This app does
					not collect or verify payments.
				</div>
			</Panel>
		</>
	);
}

export function EventFormScreen() {
	const { collection, edit, setEdit, selected, loading, perform, open } =
		useDashboard();
	return (
		<>
			<ScreenTitle
				text={selected ? "Edit event" : "Create event"}
				desc="Configure event details and optional guest features."
			/>
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
	);
}
