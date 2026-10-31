"use client";
import { authClient } from "@/lib/auth-client";
import { api, query } from "@/lib/api";

export type StaffList = {
	rows: Record<string, any>[];
	invites: Record<string, any>[];
};

export function loadStaff(orgId: string): Promise<StaffList> {
	return query("staff", { orgId });
}

export function staffAction(
	orgId: string,
	action: "staffRole" | "removeStaff" | "cancelInvite",
	payload: Record<string, unknown>,
) {
	return api(action, { orgId, ...payload });
}

export async function createResetLink(orgId: string, userId: string) {
	const r = await api("resetLink", { orgId, userId });
	return r.resetUrl as string;
}

// Values come from the form the user typed into; nothing is hard-coded.
export async function changeOwnPassword(current: string, next: string) {
	const r = await authClient.changePassword({
		currentPassword: current, // ggignore
		newPassword: next, // ggignore
		revokeOtherSessions: true,
	});
	if (r.error) throw new Error(r.error.message || "Unable to change password");
}
