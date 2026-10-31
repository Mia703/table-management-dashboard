import { useDashboard } from "@/hooks/useDashboard";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";

export function MealsScreen() {
	const { data, open, setEdit, setSelected, perform, base } = useDashboard();
	const { gs, meals, meal, seatTable } = data;
	const activeMeals = meals.filter((m) => m.active);
	return (
		<>
			<ScreenTitle
				text="Meals"
				desc="Count dinner selections and find missing meal choices."
			/>
			<div className="cards">
				{activeMeals.map((m) => (
					<div className="card" key={m.id}>
						<h3>{m.name}</h3>
						<div className="metric">
							{gs.filter((g) => g.mealOptionId === m.id).length}
						</div>
					</div>
				))}
				<div className="card">
					<h3>Not selected</h3>
					<div className="metric">
						{gs.filter((g) => !g.mealOptionId).length}
					</div>
				</div>
			</div>
			<Panel title="Configure meal options">
				<label>
					One choice per line
					<textarea
						rows={5}
						id="meal-list"
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
					Save meal choices
				</button>
			</Panel>
			<Panel title="Guest meal selections">
				<Table
					heads={["Guest", "Meal", "Table", "Action"]}
					rows={gs.map((g) => [
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
	);
}
