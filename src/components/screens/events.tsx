import { useDashboard } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { ScreenTitle } from "./screen-title";
import { emptyRegistration, nav, type Obj } from "@/lib/dashboard";

export function EventsScreen() {
	const { collection, open, setActive, setEdit, setSelected, perform, canEdit } =
		useDashboard();
	return (
		<>
			<ScreenTitle
				text="Events"
				desc="Choose an event, create a new one, or clone last year’s configuration."
			/>
			{canEdit && (
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
								paymentUrl: "",
								seatingEnabled: true,
								mealsEnabled: true,
							});
							open("eventForm");
						}}
					>
						Create Event
					</button>
				</div>
			)}
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
								Open Event
							</button>
							{canEdit && (
								<button
									className="secondary"
									onClick={() =>
										perform("cloneEvent", { eventId: x.id }, "overview")
									}
								>
									Clone Event
								</button>
							)}
						</div>
					</article>
				))}
			</div>
		</>
	);
}

export function OverviewScreen() {
	const { data, open, setEdit, setSelected, canEdit } = useDashboard();
	const { event: e, gs, regs, registration, seat, registered } = data;
	if (!e) return null;
	const live = gs.filter((g) => registration(g)?.status !== "Canceled");
	return (
		<>
			<ScreenTitle
				text="Event Overview"
				desc="A quick summary of attendance and items requiring attention."
			/>
			{canEdit && (
				<div className="actions">
					<button
						onClick={() => {
							setEdit({ ...e, paymentUrl: e.paymentUrl ?? "" });
							setSelected(e.id);
							open("eventForm");
						}}
					>
						Edit Event
					</button>
					<button
						className="secondary"
						onClick={() => {
							setEdit({ ...emptyRegistration });
							setSelected("");
							open("regForm");
						}}
					>
						Add Registration
					</button>
					<button className="secondary" onClick={() => open("import")}>
						Import Spreadsheet
					</button>
				</div>
			)}
			<div className="cards">
				{[
					["Event Capacity", e.capacity],
					["Registered Seats", registered],
					["Seats Available", Math.max(0, e.capacity - registered)],
					["Guest Records", live.length],
					["Guests Not Seated", live.filter((g) => !seat(g)).length],
					["Missing Meals", live.filter((g) => !g.mealOptionId).length],
					[
						"Pending Registrations",
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
			<Panel title="Next Actions">
				<div className="actions">
					{nav.slice(1).map(([l, p]) => (
						<button key={p} className="secondary" onClick={() => open(p)}>
							{l}
						</button>
					))}
				</div>
				<div className="notice">
					Status reflects manual entry, an attendee's own registration, or an
					external platform. This app does not collect or verify payments.
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
				text={selected ? "Edit Event" : "Create Event"}
				desc="Configure event details and optional guest features."
			/>
			<Panel title="Event Details">
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
							placeholder="e.g. 2027 Scholarship Dinner & Dance"
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
							placeholder="e.g. Community Civic Center"
							value={edit.venue}
							onChange={(s) => setEdit({ ...edit, venue: s })}
						/>
						<Field
							label="Maximum capacity"
							required
							type="number"
							min={1}
							hint="Total seats you can sell. Registrations can't go over this."
							placeholder="e.g. 200"
							value={edit.capacity}
							onChange={(s) => setEdit({ ...edit, capacity: s })}
						/>
						<Field
							label="Status"
							hint="Attendees can only register while the event is Published."
							value={edit.status}
							onChange={(s) => setEdit({ ...edit, status: s })}
							options={["Draft", "Published", "Closed", "Completed", "Archived"]}
						/>
						<Field
							label="Registration source"
							hint="Where most tickets are sold or recorded, e.g. Eventbrite, your website, or phone. Used as a label only."
							placeholder="e.g. Eventbrite"
							value={edit.source}
							onChange={(s) => setEdit({ ...edit, source: s })}
						/>
					</div>
					<Field
						label="Payment link"
						type="url"
						hint="Optional. Where attendees pay after registering, e.g. a Stripe Payment Link. Leave empty to hide the Pay button."
						placeholder="https://buy.stripe.com/…"
						value={edit.paymentUrl}
						onChange={(s) => setEdit({ ...edit, paymentUrl: s })}
					/>
					<div className="actions">
						<label className="check">
							<input
								type="checkbox"
								checked={!!edit.seatingEnabled}
								onChange={(x) =>
									setEdit({ ...edit, seatingEnabled: x.target.checked })
								}
							/>
							Enable seating
						</label>
						<label className="check">
							<input
								type="checkbox"
								checked={!!edit.mealsEnabled}
								onChange={(x) =>
									setEdit({ ...edit, mealsEnabled: x.target.checked })
								}
							/>
							Enable meals
						</label>
					</div>
					<div className="actions">
						<button disabled={loading}>Save Event</button>
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
