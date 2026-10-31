import { useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";
import { statuses } from "@/lib/dashboard";
import { downloadReport } from "@/lib/spreadsheet";

export function ReportsScreen() {
	const { data } = useDashboard();
	const {
		event: e,
		regs,
		meals,
		tables,
		buyer,
		registration,
		seat,
		seatTable,
		meal,
	} = data;
	const [report, setReport] = useState("Guest list"),
		[filterStatus, setFilterStatus] = useState("All"),
		[filterTable, setFilterTable] = useState("All");
	const filtered = data.filterGuests(filterStatus, filterTable);
	return (
		<>
			<ScreenTitle
				text="Reports & printing"
				desc="Preview, print, or download event-day reports."
			/>
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
							{tables.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</div>
				</div>
				<div className="actions">
					<button onClick={() => window.print()}>Print / Save as PDF</button>
					<button
						className="secondary"
						onClick={() =>
							downloadReport(report, filterStatus, filterTable, data)
						}
					>
						Download Excel
					</button>
				</div>
			</Panel>
			<Panel title={`${report} — ${e?.name || ""}`}>
				<p>
					<strong>Event date:</strong> {e?.date} · <strong>Venue:</strong>{" "}
					{e?.venue}
				</p>
				{report === "Meal summary" ? (
					<Table
						heads={["Meal", "Count"]}
						rows={[
							...meals
								.filter((m) => m.active)
								.map((m) => [
									m.name,
									filtered.filter((g) => g.mealOptionId === m.id).length,
								]),
							["Not selected", filtered.filter((g) => !g.mealOptionId).length],
						]}
					/>
				) : report === "Registration status summary" ? (
					<Table
						heads={["Purchaser", "Tickets", "Source", "Status"]}
						rows={regs
							.filter(
								(r) => filterStatus === "All" || r.status === filterStatus,
							)
							.map((r) => [buyer(r), r.quantity, r.source, r.status])}
					/>
				) : (
					<Table
						heads={["Guest", "Purchaser", "Table", "Meal"]}
						rows={filtered
							.filter((g) => report !== "Unassigned guests" || !seat(g))
							.filter((g) => report !== "Missing meals" || !g.mealOptionId)
							.sort((a, b) =>
								report === "Table rosters"
									? (seatTable(a)?.number || 999) -
										(seatTable(b)?.number || 999)
									: a.name.localeCompare(b.name),
							)
							.map((g) => [
								g.name,
								buyer(registration(g)),
								seatTable(g)?.name || "Unassigned",
								meal(g) || "Not selected",
							])}
					/>
				)}
			</Panel>
		</>
	);
}
