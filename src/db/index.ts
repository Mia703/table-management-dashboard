import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
export const db = drizzle(process.env.DATABASE_URL!, { schema });
// The HTTP driver above can't run multi-statement transactions, so multi-step writes use a
// short-lived WebSocket pool (Node 22+ provides WebSocket) that is closed after each call.
const poolDb = (pool: Pool) => drizzlePool(pool, { schema });
export type Tx = Parameters<
	Parameters<ReturnType<typeof poolDb>["transaction"]>[0]
>[0];
export async function transaction<T>(fn: (tx: Tx) => Promise<T>) {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
	try {
		return await poolDb(pool).transaction(fn);
	} finally {
		await pool.end();
	}
}
