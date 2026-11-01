import { useDashboard } from "@/hooks/useDashboard";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";

export function GuestsScreen() {
	const { data, open, search, setSearch, setEdit, setSelected, canEdit } =
		useDashboard();
	const { gs, buyer, registration, meal, seat, seatTable } = data;
	return (
		<>
			<ScreenTitle
				text="Guest Directory"
				desc="Find guests, edit meals and seating preferences."
			/>
			<Panel title="Find a Guest">
				<Field
					label="Search"
					placeholder="Guest, purchaser or meal"
					value={search}
					onChange={setSearch}
				/>
				<Table
					heads={[
						"Guest",
						"Purchaser",
						"Meal",
						"Table / Seat",
						...(canEdit ? ["Action"] : []),
					]}
					rows={gs
						.filter((g) =>
							[g.name, buyer(registration(g)), meal(g)]
								.join(" ")
								.toLowerCase()
								.includes(search.toLowerCase()),
						)
						.sort(
							(a, b) =>
								buyer(registration(a)).localeCompare(buyer(registration(b))) ||
								a.name.localeCompare(b.name),
						)
						.map((g) => [
							g.name,
							buyer(registration(g)),
							meal(g) || "Not selected",
							seatTable(g)
								? `${seatTable(g)!.name} / ${seat(g)!.seat}`
								: "Unassigned",
							...(canEdit
								? [
										<button
											className="secondary"
											onClick={() => {
												setSelected(g.id);
												setEdit({ ...g });
												open("guestForm");
											}}
										>
											Review / Edit
										</button>,
									]
								: []),
						])}
				/>
			</Panel>
		</>
	);
}

export function GuestFormScreen() {
	const { data, edit, setEdit, selected, loading, perform, open, base, canEdit } =
		useDashboard();
	if (!canEdit) return null;
	return (
		<>
			<ScreenTitle
				text="Edit Guest"
				desc="Manage guest name, meal selection, and seating requests."
			/>
			<Panel title="Guest Information">
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
						placeholder="e.g. Alex Rivera"
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
							{data.meals
								.filter((m) => m.active || m.id === edit.mealOptionId)
								.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name}
									</option>
								))}
						</select>
					</label>
					<Field
						label="Dietary and allergy notes"
						hint="Only owners and managers can see this."
						placeholder="e.g. Nut allergy, gluten-free"
						value={edit.diet}
						onChange={(s) => setEdit({ ...edit, diet: s })}
					/>
					<Field
						label="Preferred tablemates / seating request"
						placeholder="e.g. Seat with the Rivera party"
						value={edit.request}
						onChange={(s) => setEdit({ ...edit, request: s })}
					/>
					<div className="actions">
						<button disabled={loading}>Save Guest</button>
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
							Remove Guest
						</button>
					</div>
				</form>
			</Panel>
		</>
	);
}
