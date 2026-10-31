// Shared types and constants for the dashboard screens.
export type Obj = Record<string, any>;
export type Page =
	| "events"
	| "overview"
	| "eventForm"
	| "registrations"
	| "regForm"
	| "import"
	| "guests"
	| "guestForm"
	| "seating"
	| "tables"
	| "meals"
	| "reports"
	| "staff"
	| "activity";
export const nav: [string, Page][] = [
	["Events", "events"],
	["Registrations", "registrations"],
	["Guests", "guests"],
	["Seating", "seating"],
	["Meals", "meals"],
	["Reports", "reports"],
];
export const statuses = [
	"Pending",
	"Confirmed",
	"Paid",
	"Partially paid",
	"Unpaid",
	"Canceled",
];
export const actionLabels: Record<string, string> = {
	"event.create": "Created event",
	"event.clone": "Copied event",
	"event.update": "Updated event",
	"registration.create": "Added registration",
	"registration.update": "Updated registration",
	"registration.import": "Imported registrations",
	"guest.update": "Updated guest",
	"guest.remove": "Removed guest",
	"meal.configure": "Changed meal options",
	"tables.configure": "Changed tables",
	"seat.assign": "Assigned seat",
	"seat.clear": "Cleared seat",
	"staff.role": "Changed staff role",
	"staff.remove": "Removed staff member",
	"invite.cancel": "Cancelled invitation",
	"password.resetLink": "Created password reset link",
};
export const emptyRegistration = {
	buyer: "",
	email: "",
	phone: "",
	company: "",
	quantity: 1,
	source: "Phone",
	reference: "",
	status: "Pending",
	notes: "",
};

// Lookups over an event snapshot (registrations, guests, tables, meals, seats).
export function eventData(snap: Obj | null) {
	const regs: Obj[] = snap?.registrations || [],
		gs: Obj[] = snap?.guests || [],
		tables: Obj[] = snap?.tables || [],
		meals: Obj[] = snap?.meals || [],
		seats: Obj[] = snap?.seats || [];
	const taken = (t: string) => seats.filter((x) => x.tableId === t);
	const buyer = (r: Obj | undefined) => r?.buyer?.name || "";
	const registration = (g: Obj) => regs.find((r) => r.id === g.registrationId);
	const seat = (g: Obj) => seats.find((s) => s.guestId === g.id);
	const seatTable = (g: Obj) => tables.find((t) => t.id === seat(g)?.tableId);
	const meal = (g: Obj) =>
		meals.find((m) => m.id === g.mealOptionId)?.name || "";
	const registered = regs
		.filter((r) => r.status !== "Canceled")
		.reduce((a, r) => a + r.quantity, 0);
	const filterGuests = (status: string, tableId: string) =>
		gs.filter(
			(g) =>
				(status === "All" || registration(g)?.status === status) &&
				(tableId === "All" || seat(g)?.tableId === tableId),
		);
	return {
		event: snap?.event as Obj | undefined,
		regs,
		gs,
		tables,
		meals,
		seats,
		taken,
		buyer,
		registration,
		seat,
		seatTable,
		meal,
		registered,
		filterGuests,
	};
}
export type EventData = ReturnType<typeof eventData>;
