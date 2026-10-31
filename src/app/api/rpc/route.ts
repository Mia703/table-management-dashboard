import { NextRequest, NextResponse } from "next/server";
import { db, transaction, type Tx } from "@/db";
import {
	organizations,
	members,
	events,
	eventTables,
	mealOptions,
	categories,
	purchasers,
	registrations,
	guests,
	seatAssignments,
	importBatches,
	audit,
	invitations,
	user,
} from "@/db/schema";
import { eq, and, inArray, sql, desc, isNull } from "drizzle-orm";
import { identity, membership, eventAccess } from "@/lib/access";
import { createResetLink } from "@/lib/password-reset";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { randomBytes } from "node:crypto";
export const runtime = "nodejs";
const str = z.string().trim();
const uuid = z.string().uuid();
const eventInput = z.object({
	name: str.min(2),
	date: str.min(8),
	venue: str.min(2),
	capacity: z.coerce.number().int().min(1).max(5000),
	status: z
		.enum(["Draft", "Published", "Closed", "Completed", "Archived"])
		.default("Draft"),
	source: str.default("External platform"),
	seatingEnabled: z.boolean().default(true),
	mealsEnabled: z.boolean().default(true),
});
const regInput = z.object({
	buyer: str.min(1),
	email: z.string().trim().email().or(z.literal("")),
	phone: str.default(""),
	company: str.default(""),
	quantity: z.coerce.number().int().min(1).max(500),
	source: str.min(1),
	reference: str.default(""),
	status: z.enum([
		"Pending",
		"Confirmed",
		"Paid",
		"Partially paid",
		"Unpaid",
		"Canceled",
	]),
	notes: str.default(""),
	names: z.array(str).optional(),
});
class Fail extends Error {
	constructor(
		message: string,
		public status = 400,
	) {
		super(message);
	}
}
// Expected failures (bad input, permissions, conflicts) go back to the user; anything
// else is unexpected, so it is reported to Sentry and the details stay server-side.
function handleError(e: unknown) {
	if (e instanceof Fail) return fail(e.message, e.status);
	if (e instanceof z.ZodError)
		return fail(e.issues.map((i) => i.message).join("; "));
	const msg = e instanceof Error ? e.message : String(e);
	if (/Authentication required/.test(msg)) return fail(msg, 401);
	if (/Access denied|Read-only|Restricted|Event not found/.test(msg))
		return fail(msg, /Event not found/.test(msg) ? 404 : 403);
	// Unique-index conflicts mean another change got there first (e.g. a seat).
	if (/duplicate key|unique constraint/i.test(msg))
		return fail("Someone else just changed this. Refresh and try again.", 409);
	Sentry.captureException(e);
	return fail("Something went wrong. Please try again.", 500);
}
async function emailOf(userId: string) {
	const [u] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, userId));
	return u?.email ?? userId;
}
async function lockEvent(tx: Tx, eventId: string) {
	const [e] = await tx
		.select()
		.from(events)
		.where(eq(events.id, eventId))
		.for("update");
	if (!e) throw new Fail("Event not found", 404);
	return e;
}
function fail(message: string, status = 400) {
	return NextResponse.json({ error: message }, { status });
}
async function log(
	org: string,
	event: string | null,
	actor: string,
	action: string,
	details = "",
) {
	await db.insert(audit).values({
		organizationId: org,
		eventId: event,
		actorId: actor,
		action,
		details,
	});
}
async function assertEventMembers(eventId: string) {
	const ctx = await eventAccess(eventId);
	return ctx;
}
async function listEvents() {
	const u = await identity();
	const ms = await db.select().from(members).where(eq(members.userId, u.id));
	if (!ms.length) return { organizations: [], events: [] };
	const os = await db
		.select()
		.from(organizations)
		.where(
			inArray(
				organizations.id,
				ms.map((x) => x.organizationId),
			),
		);
	const es = await db
		.select()
		.from(events)
		.where(
			inArray(
				events.organizationId,
				ms.map((x) => x.organizationId),
			),
		)
		.orderBy(desc(events.createdAt));
	return { organizations: os, events: es, role: ms[0].role };
}
async function snapshot(eventId: string) {
	const { event, role } = await assertEventMembers(eventId);
	const [ts, meals, cats, regs, batches] = await Promise.all([
		db
			.select()
			.from(eventTables)
			.where(eq(eventTables.eventId, eventId))
			.orderBy(eventTables.number),
		db.select().from(mealOptions).where(eq(mealOptions.eventId, eventId)),
		db.select().from(categories).where(eq(categories.eventId, eventId)),
		db
			.select()
			.from(registrations)
			.where(eq(registrations.eventId, eventId))
			.orderBy(desc(registrations.createdAt)),
		db
			.select()
			.from(importBatches)
			.where(eq(importBatches.eventId, eventId))
			.orderBy(desc(importBatches.createdAt)),
	]);
	const ps = regs.length
		? await db
				.select()
				.from(purchasers)
				.where(
					inArray(
						purchasers.id,
						regs.map((r) => r.purchaserId),
					),
				)
		: [];
	const gs = regs.length
		? await db
				.select()
				.from(guests)
				.where(
					inArray(
						guests.registrationId,
						regs.map((r) => r.id),
					),
				)
		: [];
	const seats = gs.length
		? await db
				.select()
				.from(seatAssignments)
				.where(
					inArray(
						seatAssignments.guestId,
						gs.map((g) => g.id),
					),
				)
		: [];
	const pmap = new Map(ps.map((p) => [p.id, p]));
	return {
		event,
		tables: ts,
		meals,
		categories: cats,
		registrations: regs.map((r) => ({ ...r, buyer: pmap.get(r.purchaserId) })),
		guests: gs.map((g) => (role === "viewer" ? { ...g, diet: null } : g)),
		seats,
		batches,
		role,
	};
}
export async function GET(req: NextRequest) {
	try {
		const action = req.nextUrl.searchParams.get("action");
		if (action === "list") return NextResponse.json(await listEvents());
		if (action === "snapshot") {
			const id = uuid.parse(req.nextUrl.searchParams.get("eventId"));
			return NextResponse.json(await snapshot(id));
		}
		if (action === "staff") {
			const org = uuid.parse(req.nextUrl.searchParams.get("orgId"));
			await membership(org, false, true);
			const rows = await db
				.select({
					userId: members.userId,
					role: members.role,
					name: user.name,
					email: user.email,
				})
				.from(members)
				.innerJoin(user, eq(members.userId, user.id))
				.where(eq(members.organizationId, org));
			const invites = await db
				.select({
					id: invitations.id,
					email: invitations.email,
					role: invitations.role,
					expiresAt: invitations.expiresAt,
					acceptedAt: invitations.acceptedAt,
				})
				.from(invitations)
				.where(eq(invitations.organizationId, org));
			return NextResponse.json({ rows, invites });
		}
		if (action === "activity") {
			const org = uuid.parse(req.nextUrl.searchParams.get("orgId"));
			await membership(org, false, true);
			const rows = await db
				.select({
					id: audit.id,
					createdAt: audit.createdAt,
					action: audit.action,
					details: audit.details,
					actor: user.name,
					event: events.name,
				})
				.from(audit)
				.leftJoin(user, eq(audit.actorId, user.id))
				.leftJoin(events, eq(audit.eventId, events.id))
				.where(eq(audit.organizationId, org))
				.orderBy(desc(audit.createdAt))
				.limit(200);
			return NextResponse.json({ rows });
		}
		return fail("Unknown action", 404);
	} catch (e) {
		return handleError(e);
	}
}
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const action = z.string().parse(body.action);
		if (action === "bootstrap") {
			const u = await identity();
			if (
				u.email.toLowerCase() !==
				process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase()
			)
				return fail(
					"Only BOOTSTRAP_ADMIN_EMAIL can initialize an organization",
					403,
				);
			const existing = await db.select().from(organizations).limit(1);
			if (existing.length)
				return fail(
					"GatherWell has already been initialized for its single organization",
					403,
				);
			const name = str.min(2).parse(body.name);
			await transaction(async (tx) => {
				const [o] = await tx.insert(organizations).values({ name }).returning();
				await tx
					.insert(members)
					.values({ organizationId: o.id, userId: u.id, role: "owner" });
			});
			return NextResponse.json({ ok: true });
		}
		if (action === "createEvent") {
			const org = uuid.parse(body.orgId);
			const m = await membership(org, true);
			const data = eventInput.parse(body.data);
			const e = await transaction(async (tx) => {
				const [e] = await tx
					.insert(events)
					.values({ ...data, organizationId: org })
					.returning();
				await tx.insert(eventTables).values(
					Array.from({ length: 10 }, (_, i) => ({
						eventId: e.id,
						number: i + 1,
						name: `Table ${i + 1}`,
						capacity: 10,
					})),
				);
				await tx.insert(mealOptions).values(
					["Chicken", "Beef", "Fish", "Vegetarian"].map((name) => ({
						eventId: e.id,
						name,
					})),
				);
				await tx
					.insert(categories)
					.values({ eventId: e.id, name: "General Admission" });
				return e;
			});
			await log(org, e.id, m.user.id, "event.create");
			return NextResponse.json({ id: e.id });
		}
		if (action === "cloneEvent") {
			const src = await eventAccess(uuid.parse(body.eventId), true);
			const [ts, ms, cs] = await Promise.all([
				db
					.select()
					.from(eventTables)
					.where(eq(eventTables.eventId, src.event.id)),
				db
					.select()
					.from(mealOptions)
					.where(eq(mealOptions.eventId, src.event.id)),
				db
					.select()
					.from(categories)
					.where(eq(categories.eventId, src.event.id)),
			]);
			const copy = await transaction(async (tx) => {
				const [copy] = await tx
					.insert(events)
					.values({
						organizationId: src.event.organizationId,
						name: src.event.name + " (Copy)",
						date: src.event.date,
						venue: src.event.venue,
						capacity: src.event.capacity,
						status: "Draft",
						source: src.event.source,
						mealsEnabled: src.event.mealsEnabled,
						seatingEnabled: src.event.seatingEnabled,
						clonedFrom: src.event.id,
					})
					.returning();
				if (ts.length)
					await tx.insert(eventTables).values(
						ts.map((t) => ({
							eventId: copy.id,
							number: t.number,
							name: t.name,
							capacity: t.capacity,
						})),
					);
				if (ms.length)
					await tx.insert(mealOptions).values(
						ms.map((x) => ({
							eventId: copy.id,
							name: x.name,
							active: x.active,
						})),
					);
				if (cs.length)
					await tx
						.insert(categories)
						.values(cs.map((x) => ({ eventId: copy.id, name: x.name })));
				return copy;
			});
			await log(
				copy.organizationId,
				copy.id,
				src.user.id,
				"event.clone",
				src.event.id,
			);
			return NextResponse.json({ id: copy.id });
		}
		if (action === "updateEvent") {
			const ctx = await eventAccess(uuid.parse(body.eventId), true);
			const data = eventInput.parse(body.data);
			await transaction(async (tx) => {
				await lockEvent(tx, ctx.event.id);
				const [occupied] = await tx
					.select({
						n: sql<number>`coalesce(sum(${registrations.quantity}),0)`,
					})
					.from(registrations)
					.where(
						and(
							eq(registrations.eventId, ctx.event.id),
							sql`${registrations.status} <> 'Canceled'`,
						),
					);
				if (data.capacity < Number(occupied.n))
					throw new Fail("Capacity cannot be below active registered seats");
				await tx.update(events).set(data).where(eq(events.id, ctx.event.id));
			});
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				"event.update",
			);
			return NextResponse.json({ ok: true });
		}
		if (action === "registration") {
			const ctx = await eventAccess(uuid.parse(body.eventId), true);
			const data = regInput.parse(body.data);
			const exclude = body.registrationId
				? uuid.parse(body.registrationId)
				: undefined;
			const id = await transaction(async (tx) => {
				// Locking the event row serializes capacity checks for this event.
				const event = await lockEvent(tx, ctx.event.id);
				const all = await tx
					.select()
					.from(registrations)
					.where(eq(registrations.eventId, event.id));
				const used = all
					.filter((x) => x.status !== "Canceled" && x.id !== exclude)
					.reduce((s, x) => s + x.quantity, 0);
				if (data.status !== "Canceled" && used + data.quantity > event.capacity)
					throw new Fail("Event capacity exceeded");
				if (exclude) {
					const [old] = all.filter((r) => r.id === exclude);
					if (!old)
						throw new Fail("Registration does not belong to event", 403);
					const current = await tx
						.select()
						.from(guests)
						.where(eq(guests.registrationId, exclude));
					if (data.quantity < current.length)
						throw new Fail(
							"This registration has more guests than tickets. Remove guests in the Guest directory first (removing a guest also lowers the ticket quantity).",
						);
					await tx
						.update(purchasers)
						.set({
							name: data.buyer,
							email: data.email,
							phone: data.phone,
							company: data.company,
						})
						.where(eq(purchasers.id, old.purchaserId));
					await tx
						.update(registrations)
						.set({
							quantity: data.quantity,
							source: data.source,
							reference: data.reference,
							status: data.status,
							notes: data.notes,
							updatedAt: new Date(),
						})
						.where(eq(registrations.id, exclude));
					if (data.status === "Canceled" && current.length)
						await tx.delete(seatAssignments).where(
							inArray(
								seatAssignments.guestId,
								current.map((g) => g.id),
							),
						);
					if (data.quantity > current.length)
						await tx.insert(guests).values(
							Array.from(
								{ length: data.quantity - current.length },
								(_, i) => ({
									registrationId: exclude,
									name: `Guest ${current.length + i + 1} (name pending)`,
								}),
							),
						);
					return exclude;
				}
				const [p] = await tx
					.insert(purchasers)
					.values({
						organizationId: event.organizationId,
						name: data.buyer,
						email: data.email,
						phone: data.phone,
						company: data.company,
					})
					.returning();
				const [r] = await tx
					.insert(registrations)
					.values({
						eventId: event.id,
						purchaserId: p.id,
						quantity: data.quantity,
						source: data.source,
						reference: data.reference,
						status: data.status,
						notes: data.notes,
					})
					.returning();
				await tx.insert(guests).values(
					Array.from({ length: data.quantity }, (_, i) => ({
						registrationId: r.id,
						name: data.names?.[i] || `Guest ${i + 1} (name pending)`,
					})),
				);
				return r.id;
			});
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				exclude ? "registration.update" : "registration.create",
				id,
			);
			return NextResponse.json({ id });
		}
		if (action === "guest") {
			const ctx = await eventAccess(uuid.parse(body.eventId), true, true);
			const guestId = uuid.parse(body.guestId);
			const found = await db
				.select({ g: guests })
				.from(guests)
				.innerJoin(registrations, eq(guests.registrationId, registrations.id))
				.where(
					and(eq(guests.id, guestId), eq(registrations.eventId, ctx.event.id)),
				);
			if (!found.length) return fail("Guest not found", 404);
			const name = str.min(1).parse(body.name);
			const meal = body.mealId ? uuid.parse(body.mealId) : null;
			if (meal) {
				const [opt] = await db
					.select()
					.from(mealOptions)
					.where(
						and(
							eq(mealOptions.id, meal),
							eq(mealOptions.eventId, ctx.event.id),
						),
					);
				if (!opt) return fail("Invalid meal");
			}
			await db
				.update(guests)
				.set({
					name,
					mealOptionId: meal,
					diet: str.parse(body.diet || ""),
					request: str.parse(body.request || ""),
				})
				.where(eq(guests.id, guestId));
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				"guest.update",
				guestId,
			);
			return NextResponse.json({ ok: true });
		}
		if (action === "removeGuest") {
			// Removing a guest also lowers the registration's ticket quantity by one;
			// their seat assignment is deleted with them.
			const ctx = await eventAccess(uuid.parse(body.eventId), true);
			const guestId = uuid.parse(body.guestId);
			const removed = await transaction(async (tx) => {
				await lockEvent(tx, ctx.event.id);
				const [found] = await tx
					.select({ name: guests.name, registrationId: guests.registrationId })
					.from(guests)
					.innerJoin(registrations, eq(guests.registrationId, registrations.id))
					.where(
						and(
							eq(guests.id, guestId),
							eq(registrations.eventId, ctx.event.id),
						),
					);
				if (!found) throw new Fail("Guest not found", 404);
				const siblings = await tx
					.select({ id: guests.id })
					.from(guests)
					.where(eq(guests.registrationId, found.registrationId));
				if (siblings.length <= 1)
					throw new Fail(
						"This is the only guest on the registration. Cancel the registration instead.",
					);
				await tx.delete(guests).where(eq(guests.id, guestId));
				await tx
					.update(registrations)
					.set({ quantity: siblings.length - 1, updatedAt: new Date() })
					.where(eq(registrations.id, found.registrationId));
				return found;
			});
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				"guest.remove",
				`${removed.name} (${guestId})`,
			);
			return NextResponse.json({ ok: true });
		}
		if (action === "meals") {
			const ctx = await eventAccess(uuid.parse(body.eventId), true);
			const names = z.array(str.min(1)).min(1).max(50).parse(body.names);
			await transaction(async (tx) => {
				const old = await tx
					.select()
					.from(mealOptions)
					.where(eq(mealOptions.eventId, ctx.event.id));
				for (const item of old)
					await tx
						.update(mealOptions)
						.set({ active: names.includes(item.name) })
						.where(eq(mealOptions.id, item.id));
				const existing = new Set(old.map((m) => m.name));
				const fresh = [...new Set(names)].filter((n) => !existing.has(n));
				if (fresh.length)
					await tx
						.insert(mealOptions)
						.values(fresh.map((name) => ({ eventId: ctx.event.id, name })));
			});
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				"meal.configure",
			);
			return NextResponse.json({ ok: true });
		}
		if (action === "tables") {
			const ctx = await eventAccess(uuid.parse(body.eventId), true);
			const count = z.coerce.number().int().min(0).max(300).parse(body.count),
				capacity = z.coerce.number().int().min(1).max(100).parse(body.capacity);
			await transaction(async (tx) => {
				const event = await lockEvent(tx, ctx.event.id);
				if (count * capacity > event.capacity)
					throw new Fail("Table capacity exceeds event capacity");
				const list = await tx
					.select()
					.from(eventTables)
					.where(eq(eventTables.eventId, event.id));
				for (const t of list) {
					const occupied = await tx
						.select()
						.from(seatAssignments)
						.where(eq(seatAssignments.tableId, t.id));
					if (t.number > count && occupied.length)
						throw new Fail(`Table ${t.number} has assigned guests`);
					if (occupied.some((s) => s.seat > capacity))
						throw new Fail(
							`Table ${t.number} contains a seat above the new capacity`,
						);
				}
				for (const t of list) {
					if (t.number > count)
						await tx.delete(eventTables).where(eq(eventTables.id, t.id));
					else
						await tx
							.update(eventTables)
							.set({ capacity })
							.where(eq(eventTables.id, t.id));
				}
				const existing = new Set(list.map((x) => x.number));
				const newTables = Array.from({ length: count }, (_, i) => i + 1).filter(
					(i) => !existing.has(i),
				);
				if (newTables.length)
					await tx.insert(eventTables).values(
						newTables.map((n) => ({
							eventId: event.id,
							number: n,
							name: `Table ${n}`,
							capacity,
						})),
					);
			});
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				"tables.configure",
			);
			return NextResponse.json({ ok: true });
		}
		if (action === "seat") {
			const ctx = await eventAccess(uuid.parse(body.eventId), true);
			const guestId = uuid.parse(body.guestId);
			const tableId = body.tableId ? uuid.parse(body.tableId) : null;
			const detail = await transaction(async (tx) => {
				const [match] = await tx
					.select({ id: guests.id, status: registrations.status })
					.from(guests)
					.innerJoin(registrations, eq(guests.registrationId, registrations.id))
					.where(
						and(
							eq(guests.id, guestId),
							eq(registrations.eventId, ctx.event.id),
						),
					);
				if (!match || match.status === "Canceled")
					throw new Fail("Guest not eligible");
				await tx
					.delete(seatAssignments)
					.where(eq(seatAssignments.guestId, guestId));
				if (!tableId) return null;
				const [t] = await tx
					.select()
					.from(eventTables)
					.where(
						and(
							eq(eventTables.id, tableId),
							eq(eventTables.eventId, ctx.event.id),
						),
					);
				if (!t) throw new Fail("Table not found");
				const seat = z.coerce
					.number()
					.int()
					.min(1)
					.max(t.capacity)
					.parse(body.seat);
				const [occupied] = await tx
					.select()
					.from(seatAssignments)
					.where(
						and(
							eq(seatAssignments.tableId, tableId),
							eq(seatAssignments.seat, seat),
						),
					);
				if (occupied) throw new Fail("Seat already occupied", 409);
				// The unique (table, seat) index still guards a simultaneous assignment.
				await tx.insert(seatAssignments).values({ guestId, tableId, seat });
				return `${guestId} ${tableId} ${seat}`;
			});
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				detail ? "seat.assign" : "seat.clear",
				detail ?? guestId,
			);
			return NextResponse.json({ ok: true });
		}
		if (action === "import") {
			const ctx = await eventAccess(uuid.parse(body.eventId), true);
			const source = str.min(1).parse(body.source),
				fileName = str.min(1).parse(body.fileName);
			const rows = z
				.array(regInput.extend({ externalKey: str.min(1) }))
				.max(2000)
				.parse(body.rows);
			// The whole import is all-or-nothing: a failure part way leaves no partial rows.
			const { added, skipped } = await transaction(async (tx) => {
				const event = await lockEvent(tx, ctx.event.id);
				const existing = await tx
					.select()
					.from(registrations)
					.where(eq(registrations.eventId, event.id));
				const keys = new Set(
					existing
						.filter((r) => r.externalKey)
						.map((r) => `${r.source}:${r.externalKey}`),
				);
				const local = new Set<string>();
				let added = 0,
					skipped = 0;
				let used = existing
					.filter((r) => r.status !== "Canceled")
					.reduce((s, r) => s + r.quantity, 0);
				for (const r of rows) {
					const key = `${source}:${r.externalKey}`;
					if (keys.has(key) || local.has(key)) {
						skipped++;
						continue;
					}
					local.add(key);
					if (r.status !== "Canceled" && used + r.quantity > event.capacity) {
						skipped++;
						continue;
					}
					const [p] = await tx
						.insert(purchasers)
						.values({
							organizationId: event.organizationId,
							name: r.buyer,
							email: r.email,
							phone: r.phone,
							company: r.company,
						})
						.returning();
					const [reg] = await tx
						.insert(registrations)
						.values({
							eventId: event.id,
							purchaserId: p.id,
							quantity: r.quantity,
							source,
							reference: r.reference,
							status: r.status,
							notes: r.notes,
							externalKey: r.externalKey,
						})
						.returning();
					await tx.insert(guests).values(
						Array.from({ length: r.quantity }, (_, i) => ({
							registrationId: reg.id,
							name: r.names?.[i] || `Guest ${i + 1} (name pending)`,
						})),
					);
					used += r.status === "Canceled" ? 0 : r.quantity;
					added++;
				}
				await tx.insert(importBatches).values({
					eventId: event.id,
					source,
					fileName,
					added,
					skipped,
					review: 0,
					byUser: ctx.user.id,
				});
				return { added, skipped };
			});
			await log(
				ctx.event.organizationId,
				ctx.event.id,
				ctx.user.id,
				"registration.import",
				JSON.stringify({ added, skipped }),
			);
			return NextResponse.json({ added, skipped });
		}
		if (action === "invite") {
			const org = uuid.parse(body.orgId),
				ctx = await membership(org, true);
			if (ctx.role !== "owner")
				return fail("Only organization owner may invite staff", 403);
			const email = z.string().email().parse(body.email).toLowerCase(),
				role = z.enum(["manager", "viewer"]).parse(body.role);
			const token = randomBytes(24).toString("hex");
			await db.insert(invitations).values({
				organizationId: org,
				email,
				role,
				token,
				expiresAt: new Date(Date.now() + 7 * 86400000),
			});
			return NextResponse.json({
				inviteUrl: `${process.env.BETTER_AUTH_URL}/login?invite=${token}`,
			});
		}
		if (action === "resetLink") {
			// Owner may reset anyone; managers may reset viewers only, so a manager
			// can never take over the owner or another manager.
			const org = uuid.parse(body.orgId),
				ctx = await membership(org, true);
			const targetId = str.min(1).parse(body.userId);
			const [target] = await db
				.select()
				.from(members)
				.where(
					and(eq(members.organizationId, org), eq(members.userId, targetId)),
				);
			if (!target) return fail("Staff member not found", 404);
			if (ctx.role !== "owner" && target.role !== "viewer")
				return fail("Managers may only create reset links for viewers", 403);
			const resetUrl = await createResetLink(targetId);
			await log(
				org,
				null,
				ctx.user.id,
				"password.resetLink",
				await emailOf(targetId),
			);
			return NextResponse.json({ resetUrl });
		}
		if (action === "staffRole" || action === "removeStaff") {
			// Owner manages everyone but themself; managers may only remove viewers.
			// Nobody can be promoted to owner from the app.
			const org = uuid.parse(body.orgId),
				ctx = await membership(org, true);
			const targetId = str.min(1).parse(body.userId);
			if (targetId === ctx.user.id)
				return fail("You cannot change your own access", 403);
			const [target] = await db
				.select()
				.from(members)
				.where(
					and(eq(members.organizationId, org), eq(members.userId, targetId)),
				);
			if (!target) return fail("Staff member not found", 404);
			if (target.role === "owner")
				return fail("The owner cannot be changed or removed", 403);
			if (action === "staffRole") {
				if (ctx.role !== "owner")
					return fail("Only the organization owner may change roles", 403);
				const role = z.enum(["manager", "viewer"]).parse(body.role);
				await db
					.update(members)
					.set({ role })
					.where(
						and(eq(members.organizationId, org), eq(members.userId, targetId)),
					);
				await log(
					org,
					null,
					ctx.user.id,
					"staff.role",
					`${await emailOf(targetId)} → ${role}`,
				);
				return NextResponse.json({ ok: true });
			}
			if (ctx.role !== "owner" && target.role !== "viewer")
				return fail("Managers may only remove viewers", 403);
			// Single-organization app: removing staff deletes their login too, which
			// also ends their sessions. They can be re-invited later.
			const [gone] = await db
				.select({ email: user.email })
				.from(user)
				.where(eq(user.id, targetId));
			await transaction(async (tx) => {
				await tx.delete(user).where(eq(user.id, targetId));
				if (gone)
					await tx
						.delete(invitations)
						.where(
							and(
								eq(invitations.organizationId, org),
								eq(invitations.email, gone.email.toLowerCase()),
							),
						);
			});
			await log(
				org,
				null,
				ctx.user.id,
				"staff.remove",
				gone?.email ?? targetId,
			);
			return NextResponse.json({ ok: true });
		}
		if (action === "cancelInvite") {
			const org = uuid.parse(body.orgId),
				ctx = await membership(org, true);
			if (ctx.role !== "owner")
				return fail("Only organization owner may cancel invitations", 403);
			const id = uuid.parse(body.inviteId);
			const [inv] = await db
				.delete(invitations)
				.where(
					and(
						eq(invitations.id, id),
						eq(invitations.organizationId, org),
						isNull(invitations.acceptedAt),
					),
				)
				.returning();
			if (!inv) return fail("Invitation not found or already accepted", 404);
			await log(org, null, ctx.user.id, "invite.cancel", inv.email);
			return NextResponse.json({ ok: true });
		}
		if (action === "acceptInvite") {
			const u = await identity();
			const token = str.min(1).parse(body.token);
			const [inv] = await db
				.select()
				.from(invitations)
				.where(eq(invitations.token, token));
			if (
				!inv ||
				inv.acceptedAt ||
				inv.expiresAt < new Date() ||
				inv.email !== u.email.toLowerCase()
			)
				return fail(
					"Invitation is invalid, expired or email does not match",
					403,
				);
			await transaction(async (tx) => {
				await tx
					.insert(members)
					.values({
						organizationId: inv.organizationId,
						userId: u.id,
						role: inv.role,
					})
					.onConflictDoNothing();
				await tx
					.update(invitations)
					.set({ acceptedAt: new Date() })
					.where(eq(invitations.id, inv.id));
			});
			return NextResponse.json({ ok: true });
		}
		return fail("Unknown action", 404);
	} catch (e) {
		return handleError(e);
	}
}
