import { useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";
import type { Obj } from "@/lib/dashboard";

export function SeatingScreen() {
	const { data, open, selected, setSelected, canEdit } = useDashboard();
	const { gs, tables, seats, taken, seat, registration, meal } = data;
	const table = tables.find((t) => t.id === selected);
	return (
		<>
			<ScreenTitle
				text="Seating"
				desc="Assign guests to tables, then select a table to see its seats."
			/>
			<div className="actions">
				{canEdit && (
					<button onClick={() => open("tables")}>Configure Tables</button>
				)}
				<button className="secondary" onClick={() => open("reports")}>
					Print Table Rosters
				</button>
			</div>
			{canEdit && <AssignGuest />}
			<div className="seating-layout">
				<Panel title="Tables at a Glance">
					<p>
						{
							gs.filter(
								(g) => !seat(g) && registration(g)?.status !== "Canceled",
							).length
						}{" "}
						unassigned guests.
					</p>
					<div className="table-grid">
						{tables.map((t) => {
							const used = taken(t.id).length,
								full = used >= t.capacity;
							return (
								<button
									className={
										"table-button" +
										(full ? " full" : "") +
										(t.id === selected ? " selected" : "")
									}
									key={t.id}
									aria-pressed={t.id === selected}
									onClick={() => setSelected(t.id)}
								>
									<strong>{t.name}</strong>
									<p>
										{used} of {t.capacity} assigned
									</p>
									<div className="progress">
										<span style={{ width: `${(100 * used) / t.capacity}%` }} />
									</div>
									{full ? "Full" : `${t.capacity - used} open`}
								</button>
							);
						})}
					</div>
				</Panel>
				{table ? (
					<Panel title={`Assignments for ${table.name}`}>
						<Table
							heads={["Seat", "Guest", "Meal", "Status"]}
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
								Close Table Details
							</button>
						</div>
					</Panel>
				) : (
					<Panel title="Table Details">
						<p className="muted">
							Select a table on the left to see who is in each seat.
						</p>
					</Panel>
				)}
			</div>
		</>
	);
}

// Guest picker grouped by purchaser (A–Z), with each party's guests A–Z.
function guestGroups(data: ReturnType<typeof useDashboard>["data"]) {
	const { gs, registration, buyer } = data;
	const active = gs.filter((g) => registration(g)?.status !== "Canceled");
	const byReg = new Map<string, Obj[]>();
	for (const g of active)
		byReg.set(g.registrationId, [...(byReg.get(g.registrationId) || []), g]);
	return [...byReg.entries()]
		.map(([regId, guests]) => ({
			regId,
			purchaser: buyer(registration(guests[0])) || "Unknown purchaser",
			guests: guests.sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.sort((a, b) => a.purchaser.localeCompare(b.purchaser));
}

function AssignGuest() {
	const { data, perform, base, loading, setError } = useDashboard();
	const { gs, tables, taken, seat, seatTable } = data;
	const [guestId, setGuestId] = useState(""),
		[tableId, setTableId] = useState(""),
		[seatNo, setSeatNo] = useState(""),
		[withParty, setWithParty] = useState(true);
	const guest = gs.find((g) => g.id === guestId);
	const others = guest ? data.party(guest).filter((g) => g.id !== guest.id) : [];
	const groups = guestGroups(data);
	return (
		<Panel title="Assign or Move a Guest">
			<p className="muted">
				Existing assignments can't be overwritten. Choose Unassigned to clear a
				guest's seat.
			</p>
			<div className="split">
				<label>
					Guest
					<span className="hint">Grouped by purchaser, A–Z.</span>
					<select value={guestId} onChange={(x) => setGuestId(x.target.value)}>
						<option value="">Choose guest</option>
						{groups.map((grp) => (
							<optgroup key={grp.regId} label={grp.purchaser}>
								{grp.guests.map((g) => (
									<option key={g.id} value={g.id}>
										{g.name}
										{seat(g) ? ` — ${seatTable(g)?.name}, seat ${seat(g)!.seat}` : ""}
									</option>
								))}
							</optgroup>
						))}
					</select>
				</label>
				<label>
					Table
					<span className="hint">Full tables can't be chosen.</span>
					<select value={tableId} onChange={(x) => setTableId(x.target.value)}>
						<option value="">Unassigned</option>
						{tables.map((t) => {
							const open = t.capacity - taken(t.id).length;
							return (
								<option
									key={t.id}
									value={t.id}
									disabled={open <= 0 && seatTable(guest ?? {})?.id !== t.id}
								>
									{t.name} ({open > 0 ? `${open} open` : "full"})
								</option>
							);
						})}
					</select>
				</label>
			</div>
			<Field
				label="Seat number"
				type="number"
				min={1}
				hint="Optional. Leave blank to use the next open seat."
				placeholder="Next open seat"
				value={seatNo}
				onChange={setSeatNo}
			/>
			{tableId && others.length > 0 && (
				<label className="check">
					<input
						type="checkbox"
						checked={withParty}
						onChange={(x) => setWithParty(x.target.checked)}
					/>
					Also seat the other {others.length} guest
					{others.length === 1 ? "" : "s"} from this registration at the same
					table
				</label>
			)}
			<button
				disabled={loading}
				onClick={async () => {
					if (!guestId) {
						setError("Choose a guest");
						return;
					}
					const r = await perform(
						"seat",
						{
							...base,
							guestId,
							tableId: tableId || null,
							...(seatNo ? { seat: seatNo } : {}),
							withParty: !!tableId && withParty && others.length > 0,
						},
						"seating",
					);
					if (r) {
						setGuestId("");
						setSeatNo("");
					}
				}}
			>
				Save Seating Assignment
			</button>
		</Panel>
	);
}

export function TablesScreen() {
	const { data, edit, setEdit, loading, perform, base } = useDashboard();
	const { tables } = data;
	return (
		<>
			<ScreenTitle
				text="Configure Tables"
				desc="Change the table count and default capacity without losing assignments."
			/>
			<Panel title="Table Settings">
				<Field
					label="Number of tables"
					type="number"
					min={0}
					hint="Tables are numbered 1, 2, 3… Removing tables that have guests is blocked."
					value={edit.count ?? tables.length}
					onChange={(s) => setEdit({ ...edit, count: s })}
				/>
				<Field
					label="Seats per table"
					type="number"
					min={1}
					hint="Applies to every table. Tables × seats can't exceed the event's capacity."
					value={edit.capacity ?? tables[0]?.capacity ?? 10}
					onChange={(s) => setEdit({ ...edit, capacity: s })}
				/>
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
					Save Table Settings
				</button>
			</Panel>
		</>
	);
}
