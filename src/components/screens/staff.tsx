import { useEffect, useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";
import type { Obj } from "@/lib/dashboard";
import {
	changeOwnPassword,
	createResetLink,
	loadStaff,
	staffAction,
	type StaffList,
} from "@/lib/staff";

export function StaffScreen() {
	const { userId, orgId, role, isAdmin, perform, setError, setNotice } =
		useDashboard();
	const [staff, setStaff] = useState<StaffList>({ rows: [], invites: [] }),
		[inviteForm, setInviteForm] = useState<Obj>({}),
		[invite, setInvite] = useState(""),
		[resetLink, setResetLink] = useState<Obj | null>(null),
		[pw, setPw] = useState<Obj>({});
	async function refreshStaff() {
		if (orgId && isAdmin) setStaff(await loadStaff(orgId));
	}
	useEffect(() => {
		refreshStaff().catch((e) => setError(e.message));
	}, [orgId, role]);
	const pending = staff.invites.filter((x) => !x.acceptedAt);

	async function runStaffAction(
		action: "staffRole" | "removeStaff" | "cancelInvite",
		payload: Obj,
		confirmText: string,
	) {
		if (!orgId) return;
		if (!confirm(confirmText)) {
			refreshStaff();
			return;
		}
		setError("");
		setNotice("");
		try {
			await staffAction(orgId, action, payload);
			await refreshStaff();
			setNotice("Saved successfully.");
		} catch (ex) {
			setError(ex instanceof Error ? ex.message : "Unable to save");
		}
	}
	async function makeResetLink(m: Obj) {
		if (!orgId) return;
		setError("");
		setResetLink(null);
		try {
			setResetLink({
				name: m.name,
				url: await createResetLink(orgId, m.userId),
			});
		} catch (ex) {
			setError(
				ex instanceof Error ? ex.message : "Unable to create reset link",
			);
		}
	}
	async function changePassword(ev: React.FormEvent) {
		ev.preventDefault();
		setError("");
		setNotice("");
		if (pw.next !== pw.confirm) {
			setError("New passwords do not match");
			return;
		}
		try {
			await changeOwnPassword(pw.current, pw.next);
			setPw({});
			setNotice("Password updated. Your other devices have been signed out.");
		} catch (ex) {
			setError(ex instanceof Error ? ex.message : "Unable to change password");
		}
	}

	return (
		<>
			<ScreenTitle
				text="Staff & Access"
				desc="Invitations and authorization for organization staff."
			/>
			{role === "owner" && (
				<Panel title="Invite a staff member">
					<Field
						label="Staff email"
						value={inviteForm.email || ""}
						onChange={(s) => setInviteForm({ ...inviteForm, email: s })}
					/>
					<Field
						label="Access role"
						value={inviteForm.role || "viewer"}
						onChange={(s) => setInviteForm({ ...inviteForm, role: s })}
						options={["viewer", "manager"]}
					/>
					<button
						onClick={async () => {
							const result = await perform("invite", {
								orgId,
								email: inviteForm.email,
								role: inviteForm.role || "viewer",
							});
							if (result) {
								setInvite(result.inviteUrl);
								refreshStaff();
							}
						}}
					>
						Create invitation link
					</button>
					{invite && (
						<div className="notice">
							Share this invitation link privately (expires in 7 days):
							<p style={{ overflowWrap: "anywhere" }}>{invite}</p>
							<button
								className="secondary"
								onClick={() => navigator.clipboard.writeText(invite)}
							>
								Copy link
							</button>
						</div>
					)}
				</Panel>
			)}
			{isAdmin && (
				<Panel title="Staff members">
					<p className="muted">
						If a staff member forgets their password, create a one-time reset
						link and share it with them privately. It expires in 1 hour and
						signs them out everywhere once used. Removing someone deletes their
						login; you can invite them again later.
						{role === "manager" &&
							" Managers can reset and remove viewers only."}
					</p>
					<Table
						heads={["Name", "Email", "Role", "Actions"]}
						rows={staff.rows.map((m) => {
							const self = m.userId === userId,
								canManage =
									!self &&
									m.role !== "owner" &&
									(role === "owner" || m.role === "viewer");
							return [
								m.name,
								m.email,
								role === "owner" && !self && m.role !== "owner" ? (
									<select
										aria-label={`Role for ${m.name}`}
										style={{ width: "auto" }}
										value={m.role}
										onChange={(x) =>
											runStaffAction(
												"staffRole",
												{ userId: m.userId, role: x.target.value },
												`Change ${m.name} to ${x.target.value}?`,
											)
										}
									>
										<option value="manager">manager</option>
										<option value="viewer">viewer</option>
									</select>
								) : (
									m.role
								),
								self ? (
									<span className="muted">You</span>
								) : (
									<div className="actions">
										{role === "owner" || m.role === "viewer" ? (
											<button
												className="secondary"
												onClick={() => makeResetLink(m)}
											>
												Create reset link
											</button>
										) : (
											<span className="muted">Ask the owner</span>
										)}
										{canManage && (
											<button
												className="secondary"
												onClick={() =>
													runStaffAction(
														"removeStaff",
														{ userId: m.userId },
														`Remove ${m.name} (${m.email})? This deletes their login and ends their access.`,
													)
												}
											>
												Remove
											</button>
										)}
									</div>
								),
							];
						})}
					/>
					{resetLink && (
						<div className="notice">
							Password reset link for {resetLink.name} (expires in 1 hour, works
							once):
							<p style={{ overflowWrap: "anywhere" }}>{resetLink.url}</p>
							<button
								className="secondary"
								onClick={() => navigator.clipboard.writeText(resetLink.url)}
							>
								Copy link
							</button>
						</div>
					)}
				</Panel>
			)}
			{role === "owner" && (
				<Panel title="Pending invitations">
					{pending.length ? (
						<Table
							heads={["Email", "Role", "Expires", ""]}
							rows={pending.map((x) => [
								x.email,
								x.role,
								new Date(x.expiresAt) < new Date()
									? "Expired"
									: new Date(x.expiresAt).toLocaleDateString(),
								<button
									className="secondary"
									onClick={() =>
										runStaffAction(
											"cancelInvite",
											{ inviteId: x.id },
											`Cancel the invitation for ${x.email}? The link will stop working.`,
										)
									}
								>
									Cancel
								</button>,
							])}
						/>
					) : (
						<p className="muted">No pending invitations.</p>
					)}
				</Panel>
			)}
			<Panel title="Change your password">
				<form onSubmit={changePassword}>
					<Field
						label="Current password"
						type="password"
						required
						value={pw.current}
						onChange={(s) => setPw({ ...pw, current: s })}
					/>
					<Field
						label="New password (at least 12 characters)"
						type="password"
						required
						value={pw.next}
						onChange={(s) => setPw({ ...pw, next: s })}
					/>
					<Field
						label="Confirm new password"
						type="password"
						required
						value={pw.confirm}
						onChange={(s) => setPw({ ...pw, confirm: s })}
					/>
					<button>Update password</button>
				</form>
			</Panel>
		</>
	);
}
