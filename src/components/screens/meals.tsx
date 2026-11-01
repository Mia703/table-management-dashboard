import { useDashboard } from "@/hooks/useDashboard";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";
import type { Obj } from "@/lib/dashboard";

export function MealsScreen() {
	const { data, open, setEdit, setSelected, perform, base, canEdit } =
		useDashboard();
	const { gs, meals, seatTable, buyer, registration } = data;
	const activeMeals = meals.filter((m) => m.active);
	const live = gs.filter((g) => registration(g)?.status !== "Canceled");
	// One group per meal (including retired options someone still has), then "Not selected".
	const groups: { id: string; name: string; guests: Obj[] }[] = [
		...meals
			.filter((m) => m.active || live.some((g) => g.mealOptionId === m.id))
			.map((m) => ({
				id: m.id,
				name: m.active ? m.name : `${m.name} (retired)`,
				guests: live.filter((g) => g.mealOptionId === m.id),
			})),
		{
			id: "none",
			name: "Not Selected",
			guests: live.filter((g) => !g.mealOptionId),
		},
	];
	return (
		<>
			<ScreenTitle
				text="Meals"
				desc="Guests grouped by meal choice, and who still needs to choose."
			/>
			<div className="cards">
				{groups.map((grp) => (
					<a
						key={grp.id}
						href={`#meal-${grp.id}`}
						className="card"
						style={{ textDecoration: "none", color: "inherit" }}
					>
						<h3>{grp.name}</h3>
						<div className="metric">{grp.guests.length}</div>
					</a>
				))}
			</div>
			{groups.map((grp) => (
				<section key={grp.id} id={`meal-${grp.id}`}>
					<Panel title={`${grp.name} (${grp.guests.length})`}>
						{grp.guests.length ? (
							<Table
								heads={["Guest", "Purchaser", "Table", ...(canEdit ? ["Action"] : [])]}
								rows={grp.guests
									.sort((a, b) => a.name.localeCompare(b.name))
									.map((g) => [
										g.name,
										buyer(registration(g)),
										seatTable(g)?.name || "Unassigned",
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
														{grp.id === "none" ? "Choose Meal" : "Change"}
													</button>,
												]
											: []),
									])}
							/>
						) : (
							<p className="muted">Nobody yet.</p>
						)}
					</Panel>
				</section>
			))}
			{canEdit && (
				<Panel title="Configure Meal Options">
					<label>
						One choice per line
						<span className="hint">
							Removing a line retires that option; guests who already chose it
							keep their choice.
						</span>
						<textarea
							rows={5}
							id="meal-list"
							placeholder={"Chicken\nBeef\nVegetarian"}
							defaultValue={activeMeals.map((m) => m.name).join("\n")}
						/>
					</label>
					<button
						onClick={() =>
							perform(
								"meals",
								{
									...base,
									names: (
										document.getElementById("meal-list") as HTMLTextAreaElement
									).value
										.split("\n")
										.map((x) => x.trim())
										.filter(Boolean),
								},
								"meals",
							)
						}
					>
						Save Meal Choices
					</button>
				</Panel>
			)}
		</>
	);
}
