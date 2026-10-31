import { useDashboard } from "@/hooks/useDashboard";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";

export function GuestsScreen() {
	const { data, open, search, setSearch, setEdit, setSelected } =
		useDashboard();
	const { gs, buyer, registration, meal, seat, seatTable } = data;
	return (
		<>
			<ScreenTitle
				text="Guest directory"
				desc="Find guests, edit meals and seating preferences."
			/>
			<Panel title="Find a guest">
				<Field
					label="Search guest, purchaser or meal"
					value={search}
					onChange={setSearch}
				/>
				<Table
					heads={["Guest", "Purchaser", "Meal", "Table / seat", "Action"]}
					rows={gs
						.filter((g) =>
							[g.name, buyer(registration(g)), meal(g)]
								.join(" ")
								.toLowerCase()
								.includes(search.toLowerCase()),
						)
						.map((g) => [
							g.name,
							buyer(registration(g)),
							meal(g) || "Not selected",
							seatTable(g)
								? `${seatTable(g)!.name} / ${seat(g)!.seat}`
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
	);
}

export function GuestFormScreen() {
	const { data, snap, edit, setEdit, selected, loading, perform, open, base } =
		useDashboard();
	if (snap?.role === "viewer") return null;
	return (
		<>
			<ScreenTitle
				text="Edit guest"
				desc="Manage guest name, meal selection, and seating requests."
			/>
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
	);
}
