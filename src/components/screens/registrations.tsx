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
	const {
		data,
		snap,
		open,
		search,
		setSearch,
		setEdit,
		setSelected,
		canEdit,
		perform,
		base,
		loading,
	} = useDashboard();
	const { regs, buyer } = data;
	const [statusFilter, setStatusFilter] = useState("All"),
		[picked, setPicked] = useState<string[]>([]),
		[bulkStatus, setBulkStatus] = useState("Paid");
	const shown = regs.filter(
		(r) =>
			(statusFilter === "All" || r.status === statusFilter) &&
			[buyer(r), r.buyer?.email, r.source, r.status, r.reference]
				.join(" ")
				.toLowerCase()
				.includes(search.toLowerCase()),
	);
	const allPicked = shown.length > 0 && shown.every((r) => picked.includes(r.id));
	const toggle = (id: string) =>
		setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
	async function setStatus(ids: string[], status: string) {
		const r = await perform("registrationStatus", {
			...base,
			registrationIds: ids,
			status,
		});
		if (r) setPicked([]);
	}
	return (
		<>
			<ScreenTitle
				text="Registrations"
				desc="Search purchasers and manage registration and payment status."
			/>
			{canEdit && (
				<div className="actions">
					<button
						onClick={() => {
							setSelected("");
							setEdit({ ...emptyRegistration });
							open("regForm");
						}}
					>
						Add Registration
					</button>
					<button className="secondary" onClick={() => open("import")}>
						Import CSV / Excel
					</button>
				</div>
			)}
			<Panel title="Find a Registration">
				<div className="split">
					<Field
						label="Search"
						placeholder="Purchaser, email, reference, source or status"
						value={search}
						onChange={setSearch}
					/>
					<Field
						label="Show status"
						hint="Pick Unpaid or Pending to find registrations waiting on payment."
						value={statusFilter}
						onChange={(s) => {
							setStatusFilter(s);
							setPicked([]);
						}}
						options={["All", ...statuses]}
					/>
				</div>
				{canEdit && (
					<div className="bulk-bar">
						<label className="check">
							<input
								type="checkbox"
								checked={allPicked}
								onChange={() =>
									setPicked(allPicked ? [] : shown.map((r) => r.id))
								}
							/>
							Select all shown
						</label>
						<Field
							label="Set status of selected to"
							value={bulkStatus}
							onChange={setBulkStatus}
							options={statuses}
						/>
						<button
							disabled={loading || picked.length === 0}
							onClick={() => setStatus(picked, bulkStatus)}
						>
							Apply to {picked.length} Selected
						</button>
					</div>
				)}
				<Table
					heads={[
						...(canEdit ? [""] : []),
						"Purchaser",
						"Tickets",
						"Source",
						"Status",
						"Reference",
						"Action",
					]}
					rows={shown.map((r) => [
						...(canEdit
							? [
									<input
										type="checkbox"
										aria-label={`Select ${buyer(r)}`}
										style={{ width: 22, minHeight: 22 }}
										checked={picked.includes(r.id)}
										onChange={() => toggle(r.id)}
									/>,
								]
							: []),
						<>
							{buyer(r)}
							<p className="muted">{r.buyer?.email}</p>
						</>,
						r.quantity,
						r.source,
						canEdit ? (
							<select
								aria-label={`Status for ${buyer(r)}`}
								style={{ width: "auto" }}
								value={r.status}
								disabled={loading}
								onChange={(x) => setStatus([r.id], x.target.value)}
							>
								{statuses.map((s) => (
									<option key={s}>{s}</option>
								))}
							</select>
						) : (
							<Badge value={r.status} />
						),
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
							{canEdit ? "Review / Edit" : "View"}
						</button>,
					])}
				/>
			</Panel>
			<Panel title="Import History">
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

// Name inputs for everyone on a registration. On a new registration the
// purchaser is guest 1, so only the additional guests get inputs, unless the
// purchaser is already a guest on another registration (includePurchaser=false),
// in which case every ticket gets a name field.
export function PartyFields({
	quantity,
	existing,
	renames,
	setRenames,
	extra,
	setExtra,
	purchaser,
	includePurchaser = true,
	disabled = false,
}: {
	quantity: number;
	existing: Obj[];
	renames: Record<string, string>;
	setRenames: (r: Record<string, string>) => void;
	extra: string[];
	setExtra: (e: string[]) => void;
	purchaser: string;
	includePurchaser?: boolean;
	disabled?: boolean;
}) {
	const isNew = existing.length === 0;
	const firstNew = firstNewGuest(isNew, includePurchaser, existing);
	const newCount = Math.max(0, quantity - firstNew + 1);
	if (isNew && includePurchaser && quantity <= 1) return null;
	return (
		<fieldset className="panel" disabled={disabled}>
			<h2>
				{!isNew
					? "Guests on This Registration"
					: includePurchaser
						? "Additional Guests"
						: "Guest Names"}
			</h2>
			<p className="hint">
				{!isNew
					? "Correct any guest names here. New tickets add a name field below."
					: includePurchaser
						? `Guest 1 is the purchaser${purchaser ? ` (${purchaser})` : ""}. Enter the names of the other ${quantity - 1} guest(s). Leave a name blank if it isn't known yet.`
						: `${purchaser || "The purchaser"} is already a guest on an earlier registration, so these tickets are for other people. Enter a name for each one, or leave it blank if it isn't known yet.`}
			</p>
			{existing.map((g, i) => (
				<Field
					key={g.id}
					label={`Guest ${i + 1}`}
					value={renames[g.id] ?? g.name}
					onChange={(s) => setRenames({ ...renames, [g.id]: s })}
				/>
			))}
			{Array.from({ length: newCount }, (_, i) => (
				<Field
					key={`new-${i}`}
					label={`Guest ${firstNew + i}`}
					placeholder="Full name"
					value={extra[i] ?? ""}
					onChange={(s) => {
						const next = [...extra];
						next[i] = s;
						setExtra(next);
					}}
				/>
			))}
		</fieldset>
	);
}

function firstNewGuest(isNew: boolean, includePurchaser: boolean, existing: Obj[]) {
	if (!isNew) return existing.length + 1;
	return includePurchaser ? 2 : 1;
}

// Turns the party fields into the API's `names` (new guests) and `guests` (renames).
export function partyPayload(
	isNew: boolean,
	buyerName: string,
	quantity: number,
	existing: Obj[],
	renames: Record<string, string>,
	extra: string[],
	includePurchaser = true,
) {
	const firstNew = firstNewGuest(isNew, includePurchaser, existing);
	const newNames = Array.from(
		{ length: Math.max(0, quantity - firstNew + 1) },
		(_, i) => (extra[i] ?? "").trim(),
	);
	return {
		names: isNew && includePurchaser ? [buyerName, ...newNames] : newNames,
		includePurchaser: isNew ? includePurchaser : undefined,
		guests: existing
			.filter((g) => renames[g.id] !== undefined && renames[g.id].trim() && renames[g.id] !== g.name)
			.map((g) => ({ id: g.id, name: renames[g.id].trim() })),
	};
}

export function RegistrationFormScreen() {
	const { data, edit, setEdit, selected, loading, perform, open, base, canEdit } =
		useDashboard();
	const existing = selected
		? data.gs
				.filter((g) => g.registrationId === selected)
				.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
		: [];
	const [renames, setRenames] = useState<Record<string, string>>({}),
		[extra, setExtra] = useState<string[]>([]);
	const quantity = Math.max(1, Number(edit.quantity || 1));
	async function saveRegistration() {
		const party = partyPayload(
			!selected,
			edit.buyer,
			quantity,
			existing,
			renames,
			extra,
		);
		await perform(
			"registration",
			{
				...base,
				data: { ...edit, quantity, names: party.names },
				guests: party.guests,
				includePurchaser: party.includePurchaser,
				...(selected ? { registrationId: selected } : {}),
			},
			"registrations",
		);
	}
	return (
		<>
			<ScreenTitle
				text={!canEdit ? "Registration" : selected ? "Edit Registration" : "Add Registration"}
				desc="Record a purchaser, their guests, ticket quantity and payment status."
			/>
			<form
				onSubmit={(ev) => {
					ev.preventDefault();
					saveRegistration();
				}}
			>
				<fieldset className="panel" disabled={!canEdit}>
					<h2>Purchaser and Registration</h2>
					<div className="split">
						<Field
							label="Purchaser full name"
							required
							placeholder="e.g. Jordan Smith"
							value={edit.buyer}
							onChange={(s) => setEdit({ ...edit, buyer: s })}
						/>
						<Field
							label="Email address"
							type="email"
							placeholder="name@example.com"
							value={edit.email}
							onChange={(s) => setEdit({ ...edit, email: s })}
						/>
						<Field
							label="Phone"
							type="tel"
							placeholder="e.g. (555) 123-4567"
							value={edit.phone}
							onChange={(s) => setEdit({ ...edit, phone: s })}
						/>
						<Field
							label="Company"
							hint="Optional. Organization or sponsor the purchaser represents."
							placeholder="e.g. Acme Corp"
							value={edit.company}
							onChange={(s) => setEdit({ ...edit, company: s })}
						/>
						<Field
							label="Ticket quantity"
							type="number"
							min={1}
							required
							hint="Total tickets, including the purchaser if they're attending."
							value={edit.quantity}
							onChange={(s) => setEdit({ ...edit, quantity: s })}
						/>
						<Field
							label="Reference / check number"
							hint="Optional. An order number, check number or payment ID to match this to a payment."
							placeholder="e.g. Order #10482"
							value={edit.reference}
							onChange={(s) => setEdit({ ...edit, reference: s })}
						/>
						<Field
							label="Source"
							hint="How this registration came in, e.g. Phone, Email, Eventbrite."
							placeholder="e.g. Phone"
							value={edit.source}
							onChange={(s) => setEdit({ ...edit, source: s })}
						/>
						<Field
							label="Status"
							hint="Payment or confirmation status. Mark Paid once payment is received."
							value={edit.status}
							onChange={(s) => setEdit({ ...edit, status: s })}
							options={statuses}
						/>
					</div>
					<Field
						label="Seating requests / notes"
						placeholder="e.g. Please seat near the Rivera party"
						value={edit.notes}
						onChange={(s) => setEdit({ ...edit, notes: s })}
					/>
					{selected && (
						<div className="notice">
							Changing a registration to Canceled releases seating assignments
							but preserves the historical record.
						</div>
					)}
				</fieldset>
				<PartyFields
					quantity={quantity}
					existing={existing}
					renames={renames}
					setRenames={setRenames}
					extra={extra}
					setExtra={setExtra}
					purchaser={edit.buyer}
					disabled={!canEdit}
				/>
				<div className="actions">
					{canEdit && <button disabled={loading}>Save Registration</button>}
					<button
						className="secondary"
						type="button"
						onClick={() => open("registrations")}
					>
						{canEdit ? "Cancel" : "Back"}
					</button>
				</div>
			</form>
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
				text="Import Registrations"
				desc="Select a CSV or Excel export; review before committing new records."
			/>
			<Panel title="Choose a Spreadsheet">
				<Field
					label="Source / platform"
					hint="Where this file came from. Used to spot duplicates if you import the same export again."
					placeholder="e.g. Eventbrite"
					value={source}
					onChange={setSource}
				/>
				<label>
					CSV or Excel file
					<span className="hint">
						Expected columns include purchaser/name, email, quantity, status, and
						reference. Files are read in your browser and not stored on the
						server.
					</span>
					<input
						type="file"
						accept=".csv,.xlsx,.xls"
						onChange={(x) => {
							const f = x.target.files?.[0];
							if (f) readSpreadsheet(f);
						}}
					/>
				</label>
			</Panel>
			{importRows.length > 0 && (
				<Panel title="Review Import Before Saving">
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
						Confirm Safe New Rows
					</button>
				</Panel>
			)}
		</>
	);
}
