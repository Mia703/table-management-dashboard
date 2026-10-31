import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { verification } from "@/db/schema";

const RESET_TTL_MS = 60 * 60 * 1000;

// Creates a one-time password reset link without sending email. Uses Better Auth's own
// verification storage, so the link is completed by authClient.resetPassword on /login.
// Any earlier unused reset links for the user stop working.
export async function createResetLink(userId: string) {
	const ctx = await auth.$context;
	await db.delete(verification).where(eq(verification.value, userId));
	const token = randomBytes(24).toString("hex");
	await ctx.internalAdapter.createVerificationValue({
		value: userId,
		identifier: `reset-password:${token}`,
		expiresAt: new Date(Date.now() + RESET_TTL_MS),
	});
	const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
	return `${base}/login?token=${token}`;
}
