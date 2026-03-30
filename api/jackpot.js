import { getDb, ensureTables } from './db.js';

const JACKPOT_SEED = 5000;
const GROWTH_PER_MINUTE = 10; // 10 pts per minute passively

async function ensureJackpotTable() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS jackpot (
      id INT PRIMARY KEY DEFAULT 1,
      amount BIGINT NOT NULL DEFAULT ${JACKPOT_SEED},
      last_won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_growth_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    INSERT INTO jackpot (id, amount, last_won_at, last_growth_at)
    VALUES (1, ${JACKPOT_SEED}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `;
  // Add columns if they don't exist (safe migration)
  await db`
    ALTER TABLE jackpot ADD COLUMN IF NOT EXISTS last_won_at TIMESTAMPTZ DEFAULT NOW()
  `;
  await db`
    ALTER TABLE jackpot ADD COLUMN IF NOT EXISTS last_growth_at TIMESTAMPTZ DEFAULT NOW()
  `;
}

// Apply passive time-based growth since last check
async function applyTimeGrowth(db) {
  const rows = await db`SELECT amount, last_growth_at FROM jackpot WHERE id = 1`;
  if (!rows[0]) return;

  const lastGrowth = new Date(rows[0].last_growth_at);
  const now = new Date();
  const minutesElapsed = (now - lastGrowth) / 60000;

  if (minutesElapsed >= 1) {
    const growth = Math.floor(minutesElapsed * GROWTH_PER_MINUTE);
    if (growth > 0) {
      await db`
        UPDATE jackpot
        SET amount = amount + ${growth}, last_growth_at = NOW()
        WHERE id = 1
      `;
    }
  }
}

export default async function handler(req, res) {
  try {
    await ensureTables();
    await ensureJackpotTable();
    const db = getDb();

    if (req.method === 'GET') {
      await applyTimeGrowth(db);
      const rows = await db`SELECT amount, last_won_at FROM jackpot WHERE id = 1`;
      const row = rows[0];
      return res.json({
        jackpot: row?.amount ?? JACKPOT_SEED,
        lastWonAt: row?.last_won_at ?? null,
      });

    } else if (req.method === 'POST') {
      const { action, amount } = req.body || {};

      if (action === 'contribute' && typeof amount === 'number' && amount > 0) {
        await db`UPDATE jackpot SET amount = amount + ${Math.floor(amount)} WHERE id = 1`;
        const rows = await db`SELECT amount FROM jackpot WHERE id = 1`;
        return res.json({ jackpot: rows[0]?.amount ?? JACKPOT_SEED });

      } else if (action === 'win') {
        // Apply any pending growth first
        await applyTimeGrowth(db);
        // Get current value, then reset
        const rows = await db`SELECT amount FROM jackpot WHERE id = 1`;
        const won = rows[0]?.amount ?? JACKPOT_SEED;
        await db`
          UPDATE jackpot
          SET amount = ${JACKPOT_SEED}, last_won_at = NOW(), last_growth_at = NOW()
          WHERE id = 1
        `;
        return res.json({ won, jackpot: JACKPOT_SEED });

      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Jackpot error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}
