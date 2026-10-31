import { useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";
import { emptyRegistration, statuses, type Obj } from "@/lib/dashboard";
import { parseRegistrationFile, type ImportRow } from "@/lib/spreadsheet";

export function RegistrationsScreen() {
	const { data, snap, open, search, setSearch, setEdit, setSelected } =
		useDashboard();
	const { regs, buyer } = data;
	return (
		<>
			<ScreenTitle
				text="Registrations"
				desc="Search purchasers and manage externally recorded registration status."
			/>
			<div className="actions">
				<button
					onClick={() => {
						setSelected("");
						setEdit({ ...emptyRegistration });
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
						.filter((r) =>
							[buyer(r), r.buyer?.email, r.source, r.status, r.reference]
								.join(" ")
								.toLowerCase()
								.includes(search.toLowerCase()),
						)
						.map((r) => [
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
	);
}

export function RegistrationFormScreen() {
	const { edit, setEdit, selected, loading, perform, open, base } =
		useDashboard();
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
	return (
		<>
			<ScreenTitle
				text={selected ? "Edit registration" : "Add registration"}
				desc="Record a purchaser, ticket quantity and externally reported status."
			/>
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
							Guest placeholder records will be created automatically. Complete
							their names and meals from the Guests screen.
						</div>
					)}
					{selected && (
						<div className="notice">
							Changing a registration to Canceled releases seating assignments
							but preserves the historical record.
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
	);
}

export function ImportScreen() {
	const { data, base, loading, perform, setError, setNotice } = useDashboard();
	const [importRows, setImportRows] = useState<ImportRow[]>([]),
		[importName, setImportName] = useState(""),
		[source, setSource] = useState("External registration platform");
	async function readSpreadsheet(file: File) {
		setError("");
		try {
			setImportRows(await parseRegistrationFile(file, source, data.regs));
			setImportName(file.name);
		} catch (ex) {
			setError(ex instanceof Error ? ex.message : "File could not be read");
		}
	}
	return (
		<>
			<ScreenTitle
				text="Import registrations"
				desc="Select a CSV or Excel export; review before committing new records."
			/>
			<Panel title="Choose a spreadsheet">
				<Field label="Source / platform" value={source} onChange={setSource} />
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
					Expected columns include purchaser/name, email, quantity, status, and
					reference. Import files are read locally by your browser and not
					stored on the server.
				</p>
			</Panel>
			{importRows.length > 0 && (
				<Panel title="Review import before saving">
					<p>
						<strong>{importName}</strong> · {importRows.length} rows ·{" "}
						{importRows.filter((x) => x.decision === "New").length} new ·{" "}
						{importRows.filter((x) => x.decision !== "New").length} flagged
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
						Only valid new rows will be imported. Existing external references
						are not overwritten or deleted.
					</div>
					<button
						disabled={loading || !importRows.some((r) => r.decision === "New")}
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
	);
}
