import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { invitations } from "@/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg", schema }),
	emailAndPassword: {
		enabled: true,
		disableSignUp: false,
		minPasswordLength: 12,
		// No email service: reset links are created by an owner/manager (see
		// createResetLink in src/lib/password-reset.ts) and shared privately.
		// Leaving sendResetPassword unset keeps the public reset request disabled.
		resetPasswordTokenExpiresIn: 60 * 60,
		revokeSessionsOnPasswordReset: true,
	},
	// Login attempt limits are kept in the database so they hold across serverless
	// instances (Better Auth's default is per-instance memory). Active in production.
	rateLimit: { storage: "database" },
	// Reset tokens are stored hashed so a database leak can't be used to reset passwords.
	verification: { storeIdentifier: "hashed" },
	databaseHooks: {
		user: {
			create: {
				// Invite-only sign-up: the bootstrap admin, or an email with an open invitation.
				before: async (user) => {
					const email = user.email.toLowerCase();
					if (email === process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase())
						return;
					const [inv] = await db
						.select({ id: invitations.id })
						.from(invitations)
						.where(
							and(
								eq(invitations.email, email),
								isNull(invitations.acceptedAt),
								gt(invitations.expiresAt, new Date()),
							),
						)
						.limit(1);
					if (!inv)
						throw new APIError("FORBIDDEN", {
							message:
								"Accounts can only be created from a valid staff invitation link.",
						});
				},
			},
		},
	},
	trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
});
