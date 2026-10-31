import * as XLSX from "xlsx";
import { statuses, type EventData, type Obj } from "@/lib/dashboard";

export type ImportRow = {
	buyer: string;
	email: string;
	quantity: number;
	source: string;
	reference: string;
	status: string;
	externalKey: string;
	phone: string;
	company: string;
	notes: string;
	decision: "New" | "Duplicate" | "Review";
	row: number;
};

// Reads a CSV/XLSX export in the browser and marks each row New, Duplicate or Review.
// The file never leaves the browser; only confirmed rows are sent to the server.
export async function parseRegistrationFile(
	file: File,
	source: string,
	regs: Obj[],
): Promise<ImportRow[]> {
	if (file.size > 5_000_000) throw Error("Maximum import size is 5 MB");
	const buffer = await file.arrayBuffer();
	const book = XLSX.read(buffer, { type: "array", cellDates: false });
	const data = XLSX.utils.sheet_to_json<Obj>(book.Sheets[book.SheetNames[0]], {
		defval: "",
		raw: false,
	});
	if (!data.length) throw Error("Spreadsheet is empty");
	if (data.length > 2000) throw Error("Maximum 2,000 rows per import");
	const norm = (o: Obj, patterns: string[]) => {
		const key = Object.keys(o).find((k) =>
			patterns.some((p) => k.toLowerCase().trim().includes(p)),
		);
		return key ? String(o[key] || "").trim() : "";
	};
	const known = new Set(
		regs
			.filter((r) => r.externalKey)
			.map((r) => `${r.source}:${r.externalKey}`),
	);
	const rows = data.map((r, i): ImportRow => {
		const buyer = norm(r, [
				"buyer",
				"purchaser",
				"full name",
				"customer name",
				"registrant",
				"name",
			]),
			email = norm(r, ["email"]),
			q = Number(norm(r, ["quantity", "tickets", "attendees", "seats"])) || 1,
			status = norm(r, ["status"]) || "Pending",
			ref = norm(r, [
				"reference",
				"external id",
				"order id",
				"confirmation",
				"transaction id",
			]),
			key = ref || `${email.toLowerCase()}:${buyer.toLowerCase()}:${q}`,
			valid =
				buyer.length > 0 &&
				q > 0 &&
				q <= 500 &&
				statuses.includes(status) &&
				!!key;
		return {
			buyer,
			email,
			quantity: q,
			source,
			reference: ref,
			status,
			externalKey: key,
			phone: norm(r, ["phone"]),
			company: norm(r, ["company", "organization"]),
			notes: "",
			decision: !valid
				? "Review"
				: known.has(`${source}:${key}`)
					? "Duplicate"
					: "New",
			row: i + 2,
		};
	});
	const seen = new Set<string>();
	rows.forEach((r) => {
		if (r.decision === "New") {
			if (seen.has(r.externalKey)) r.decision = "Duplicate";
			seen.add(r.externalKey);
		}
	});
	return rows;
}

// Builds the chosen report as an .xlsx download. Cells starting with = + @ - are
// prefixed with ' so spreadsheet apps don't run them as formulas.
export function downloadReport(
	report: string,
	filterStatus: string,
	filterTable: string,
	data: EventData,
) {
	const { regs, meals, buyer, registration, seat, seatTable, meal } = data;
	const filtered = data.filterGuests(filterStatus, filterTable);
	let header: string[] = [],
		rows: any[][] = [];
	if (report === "Meal summary") {
		header = ["Meal", "Count"];
		rows = [
			...meals.map((m) => [
				m.name,
				filtered.filter((g) => g.mealOptionId === m.id).length,
			]),
			["Not selected", filtered.filter((g) => !g.mealOptionId).length],
		];
	} else if (report === "Registration status summary") {
		header = ["Purchaser", "Tickets", "Source", "Recorded status", "Reference"];
		rows = regs
			.filter((r) => filterStatus === "All" || r.status === filterStatus)
			.map((r) => [buyer(r), r.quantity, r.source, r.status, r.reference]);
	} else {
		header = ["Guest", "Purchaser", "Table", "Seat", "Meal", "Status"];
		rows = filtered
			.filter((g) => report !== "Unassigned guests" || !seat(g))
			.filter((g) => report !== "Missing meals" || !g.mealOptionId)
			.map((g) => [
				g.name,
				buyer(registration(g)),
				seatTable(g)?.name || "Unassigned",
				seat(g)?.seat || "",
				meal(g) || "Not selected",
				registration(g)?.status,
			]);
	}
	const sanitized = rows.map((row) =>
		row.map((x) =>
			typeof x === "string" && /^[=+@\-\t\r]/.test(x) ? `'${x}` : x,
		),
	);
	const book = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(
		book,
		XLSX.utils.aoa_to_sheet([header, ...sanitized]),
		"Report",
	);
	XLSX.writeFile(
		book,
		`gatherwell-${report.toLowerCase().replaceAll(" ", "-")}.xlsx`,
	);
}
