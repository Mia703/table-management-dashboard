import { useDashboard } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";

export function SeatingScreen() {
	const { data, open, selected, setSelected, setError, perform, base } =
		useDashboard();
	const { gs, tables, seats, taken, seat, registration, meal, buyer } = data;
	const table = tables.find((t) => t.id === selected);
	return (
		<>
			<ScreenTitle
				text="Seating"
				desc="Select a numbered table to view and edit seating assignments."
			/>
			<div className="actions">
				<button onClick={() => open("tables")}>Configure tables</button>
				<button className="secondary" onClick={() => open("reports")}>
					Print table rosters
				</button>
			</div>
			<Panel title="Tables at a glance">
				<p>
					{
						gs.filter((g) => !seat(g) && registration(g)?.status !== "Canceled")
							.length
					}{" "}
					unassigned guests.
				</p>
				<div className="table-grid">
					{tables.map((t) => (
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
			{table && (
				<Panel title={"Assignments for " + table.name}>
					<Table
						heads={["Seat", "Guest", "Meal", "Recorded status"]}
						rows={Array.from({ length: table.capacity || 0 }, (_, i) => {
							const a = seats.find(
									(x) => x.tableId === selected && x.seat === i + 1,
								),
								g = gs.find((x) => x.id === a?.guestId);
							return [
								i + 1,
								g?.name || "Available",
								g ? meal(g) : "",
								g ? <Badge value={registration(g)?.status} /> : null,
							];
						})}
					/>
					<div className="actions">
						<button className="secondary" onClick={() => setSelected("")}>
							Close table details
						</button>
					</div>
				</Panel>
			)}
			<Panel title="Assign or move a guest">
				<p className="muted">
					Use the keyboard-accessible controls. Existing assignments cannot be
					overwritten.
				</p>
				<label>
					Guest
					<select id="seat-guest">
						<option value="">Choose guest</option>
						{gs
							.filter((g) => registration(g)?.status !== "Canceled")
							.map((g) => (
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
						{tables.map((t) => (
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
								document.getElementById("seat-guest") as HTMLSelectElement
							).value,
							tableId = (
								document.getElementById("seat-table") as HTMLSelectElement
							).value,
							number = (
								document.getElementById("seat-number") as HTMLInputElement
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
	);
}

export function TablesScreen() {
	const { data, edit, setEdit, loading, perform, base } = useDashboard();
	const { tables } = data;
	return (
		<>
			<ScreenTitle
				text="Configure tables"
				desc="Change the table count and default capacity without losing assignments."
			/>
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
					Changes that strand assigned guests or exceed event capacity are
					rejected.
				</div>
				<button
					disabled={loading}
					onClick={() =>
						perform(
							"tables",
							{
								...base,
								count: Number(edit.count ?? tables.length),
								capacity: Number(edit.capacity ?? tables[0]?.capacity ?? 10),
							},
							"seating",
						)
					}
				>
					Save table settings
				</button>
			</Panel>
		</>
	);
}
