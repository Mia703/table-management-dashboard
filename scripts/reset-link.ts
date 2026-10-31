// Emergency password recovery (e.g. the owner is locked out). Prints a one-time reset link.
// Usage: npm run reset-link -- someone@example.org
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { createResetLink } from "../src/lib/password-reset";

async function main() {
	const email = process.argv[2]?.trim().toLowerCase();
	if (!email) throw Error("Usage: npm run reset-link -- <email>");
	const [u] = await db.select().from(user).where(eq(user.email, email));
	if (!u) throw Error(`No account found for ${email}`);
	console.log(`Reset link for ${u.name} (expires in 1 hour, works once):`);
	console.log(await createResetLink(u.id));
}
main().catch((e) => {
	console.error(e instanceof Error ? e.message : e);
	process.exit(1);
});
