import { useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { PartyFields, partyPayload } from "./registrations";
import type { Obj } from "@/lib/dashboard";

const editable = ["Pending", "Unpaid"],
	payable = ["Pending", "Unpaid", "Partially paid"];

// Opens the event's payment page (e.g. a Stripe Payment Link) with the registration
// ID and email attached, so organizers can match the payment to this registration.
export function paymentHref(url: string, registrationId: string, email: string) {
	const u = new URL(url);
	u.searchParams.set("client_reference_id", registrationId);
	if (email) u.searchParams.set("prefilled_email", email);
	return u.toString();
}

// What an invited attendee sees: their event, their own registrations, a form
// to register (with their guests' names), and a Pay button.
export function AttendeeHome() {
	const { data: session } = authClient.useSession();
	const { collection, active, setActive, data, perform, loading, base } =
		useDashboard();
	const e = data.event;
	const [editing, setEditing] = useState<Obj | null>(null);
	const [form, setForm] = useState<Obj>({}),
		[renames, setRenames] = useState<Record<string, string>>({}),
		[extra, setExtra] = useState<string[]>([]);
	const open = e?.status === "Published";

	function startForm(r?: Obj) {
		setEditing(r ?? {});
		setRenames({});
		setExtra([]);
		setForm(
			r
				? {
						buyer: r.buyer?.name ?? "",
						email: r.buyer?.email ?? "",
						phone: r.buyer?.phone ?? "",
						quantity: r.quantity,
						notes: r.notes ?? "",
					}
				: {
						buyer: session?.user.name ?? "",
						email: session?.user.email ?? "",
						phone: "",
						quantity: 1,
						notes: "",
					},
		);
	}
	const existing = editing?.id
		? data.gs
				.filter((g) => g.registrationId === editing.id)
				.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
		: [];
	const quantity = Math.max(1, Number(form.quantity || 1));
	// If the attendee is already a guest on another active registration, a new
	// registration is only for other people, so they aren't added a second time.
	const sameName = (a: string, b: string) =>
		a.trim().toLowerCase() === b.trim().toLowerCase();
	const alreadyGuest =
		!editing?.id &&
		!!form.buyer?.trim() &&
		data.gs.some(
			(g) =>
				data.registration(g)?.status !== "Canceled" &&
				sameName(g.name, form.buyer),
		);

	async function save() {
		const party = partyPayload(
			!editing?.id,
			form.buyer,
			quantity,
			existing,
			renames,
			extra,
			!alreadyGuest,
		);
		const r = await perform("registration", {
			...base,
			data: {
				...form,
				quantity,
				company: "",
				reference: "",
				source: "Online registration",
				status: "Unpaid",
				names: party.names,
			},
			guests: party.guests,
			includePurchaser: party.includePurchaser,
			...(editing?.id ? { registrationId: editing.id } : {}),
		});
		if (r) setEditing(null);
	}

	if (!collection.events.length)
		return (
			<Panel title="No Event Yet">
				<p>
					You haven't been invited to an event yet. Use the invitation link the
					organizer sent you.
				</p>
			</Panel>
		);
	return (
		<>
			{collection.events.length > 1 && (
				<label>
					Event
					<select value={active} onChange={(x) => setActive(x.target.value)}>
						{collection.events.map((x: Obj) => (
							<option key={x.id} value={x.id}>
								{x.name}
							</option>
						))}
					</select>
				</label>
			)}
			{e && (
				<header>
					<h1>{e.name}</h1>
					<p className="muted">
						{e.date} · {e.venue}
					</p>
				</header>
			)}
			{!open && (
				<div className="notice">
					Registration opens once the organizer publishes this event.
				</div>
			)}
			{!editing && (
				<Panel title="Your Registrations">
					{data.regs.length ? (
						data.regs.map((r) => (
							<article className="card" key={r.id}>
								<p>
									<strong>
										{r.quantity} ticket{r.quantity === 1 ? "" : "s"}
									</strong>{" "}
									· <Badge value={r.status} />
								</p>
								<p className="muted">
									Guests:{" "}
									{data.gs
										.filter((g) => g.registrationId === r.id)
										.map((g) => g.name)
										.join(", ")}
								</p>
								<div className="actions">
									{e?.paymentUrl && payable.includes(r.status) && (
										<a
											className="pay-button"
											href={paymentHref(
												e.paymentUrl,
												r.id,
												r.buyer?.email || session?.user.email || "",
											)}
											target="_blank"
											rel="noopener noreferrer"
										>
											Pay Now
										</a>
									)}
									{open && editable.includes(r.status) && (
										<button className="secondary" onClick={() => startForm(r)}>
											Edit Registration
										</button>
									)}
								</div>
								{payable.includes(r.status) && (
									<p className="hint">
										{e?.paymentUrl
											? `Pay for ${r.quantity} ticket${r.quantity === 1 ? "" : "s"} on the next page. The organizer marks your registration Paid once your payment arrives.`
											: "The organizer will tell you how to pay."}
									</p>
								)}
							</article>
						))
					) : (
						<p className="muted">You haven't registered yet.</p>
					)}
					{open && (
						<button onClick={() => startForm()}>
							{data.regs.length ? "Register More Tickets" : "Register"}
						</button>
					)}
				</Panel>
			)}
			{editing && (
				<form
					onSubmit={(ev) => {
						ev.preventDefault();
						save();
					}}
				>
					<Panel title={editing.id ? "Edit Registration" : "Register"}>
						<div className="split">
							<Field
								label="Your full name"
								required
								placeholder="e.g. Jordan Smith"
								value={form.buyer}
								onChange={(s) => setForm({ ...form, buyer: s })}
							/>
							<Field
								label="Email address"
								type="email"
								hint="Your receipt and payment page use this email."
								placeholder="name@example.com"
								value={form.email}
								onChange={(s) => setForm({ ...form, email: s })}
							/>
							<Field
								label="Phone"
								type="tel"
								placeholder="Optional"
								value={form.phone}
								onChange={(s) => setForm({ ...form, phone: s })}
							/>
							<Field
								label="Number of tickets"
								type="number"
								min={1}
								required
								hint={
									alreadyGuest
										? "You're already on an earlier registration, so count only the extra people."
										: "Including yourself if you're attending."
								}
								value={form.quantity}
								onChange={(s) => setForm({ ...form, quantity: s })}
							/>
						</div>
						<Field
							label="Seating requests / notes"
							placeholder="e.g. Please seat us near the Rivera party"
							value={form.notes}
							onChange={(s) => setForm({ ...form, notes: s })}
						/>
					</Panel>
					<PartyFields
						quantity={quantity}
						existing={existing}
						renames={renames}
						setRenames={setRenames}
						extra={extra}
						setExtra={setExtra}
						purchaser={form.buyer}
						includePurchaser={!alreadyGuest}
					/>
					<div className="actions">
						<button disabled={loading}>
							{editing.id ? "Save Changes" : "Register"}
						</button>
						<button
							type="button"
							className="secondary"
							onClick={() => setEditing(null)}
						>
							Cancel
						</button>
					</div>
				</form>
			)}
		</>
	);
}
