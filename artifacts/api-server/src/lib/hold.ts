import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type DbConn = typeof db;
type TxConn = Parameters<Parameters<DbConn["transaction"]>[0]>[0];
type Conn = DbConn | TxConn;

/**
 * Release a previously held amount back to a seller's main balance.
 * Strictly per-order: callers pass `heldAmount` from the order row
 * (`orders.held_amount`). Legacy locks have heldAmount = 0, so nothing
 * is released and the seller's balance is untouched (their funds were
 * never moved into heldBalance for that order). Always run inside a
 * transaction.
 */
export async function releaseHold(
  userId: number,
  heldAmount: number,
  conn: Conn,
): Promise<void> {
  if (heldAmount <= 0) return;
  await conn.update(usersTable).set({
    heldBalance: sql`GREATEST(${usersTable.heldBalance} - ${heldAmount}, 0)`,
    balance: sql`${usersTable.balance} + ${heldAmount}`,
  }).where(eq(usersTable.id, userId));
}
