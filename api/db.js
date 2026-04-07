import { neon } from '@neondatabase/serverless';

let sql;

export function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

export async function ensureTables() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS wagers (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      total_wagered BIGINT NOT NULL DEFAULT 0,
      total_won BIGINT NOT NULL DEFAULT 0,
      total_spins INT NOT NULL DEFAULT 0,
      last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wagers_username ON wagers (username)
  `;
  await db`
    CREATE TABLE IF NOT EXISTS coinflip_bets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL,
      bet_amount INT NOT NULL,
      pot INT NOT NULL,
      choice TEXT NOT NULL,
      streak INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS payout_log (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      amount INT NOT NULL,
      game TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS bets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL,
      amount INT NOT NULL,
      game TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_bets_username_status ON bets (username, status)
  `;
}
