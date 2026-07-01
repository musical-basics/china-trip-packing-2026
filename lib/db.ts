import { createClient, type Client, type Row } from "@libsql/client";
import { SEED_DATA } from "./seed-data";

export type ItemRow = {
  id: number;
  phase_key: string;
  location: string;
  phase_subtitle: string;
  section: string;
  item: string;
  notes: string | null;
  starred: 0 | 1;
  done: 0 | 1;
  worn: 0 | 1;
  bag: string | null;
  sort_order: number;
  updated_at: string;
};

// Local dev uses a file DB; production (Vercel) points at Turso via env vars.
const url = process.env.TURSO_DATABASE_URL ?? "file:./data/packing.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

// Reuse the client and the one-time init across hot reloads / invocations.
const globalForDb = globalThis as unknown as {
  __packingClient?: Client;
  __packingInit?: Promise<void>;
};

function getClient(): Client {
  if (!globalForDb.__packingClient) {
    globalForDb.__packingClient = createClient({ url, authToken });
  }
  return globalForDb.__packingClient;
}

// Turn a libSQL Row into a plain, JSON-safe ItemRow object.
function mapRow(r: Row): ItemRow {
  return {
    id: Number(r.id),
    phase_key: String(r.phase_key),
    location: String(r.location),
    phase_subtitle: String(r.phase_subtitle),
    section: String(r.section),
    item: String(r.item),
    notes: r.notes === null ? null : String(r.notes),
    starred: Number(r.starred) === 1 ? 1 : 0,
    done: Number(r.done) === 1 ? 1 : 0,
    worn: Number(r.worn) === 1 ? 1 : 0,
    bag: r.bag === null ? null : String(r.bag),
    sort_order: Number(r.sort_order),
    updated_at: String(r.updated_at),
  };
}

async function init(): Promise<void> {
  const db = getClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_key      TEXT    NOT NULL,
      location       TEXT    NOT NULL,
      phase_subtitle TEXT    NOT NULL,
      section        TEXT    NOT NULL,
      item           TEXT    NOT NULL,
      notes          TEXT,
      starred        INTEGER NOT NULL DEFAULT 0,
      done           INTEGER NOT NULL DEFAULT 0,
      worn           INTEGER NOT NULL DEFAULT 0,
      bag            TEXT,
      sort_order     INTEGER NOT NULL,
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Additive migrations so an existing table picks up newer columns.
  const info = await db.execute("PRAGMA table_info(items)");
  const cols = new Set(info.rows.map((r) => String(r.name)));
  if (!cols.has("worn")) {
    await db.execute("ALTER TABLE items ADD COLUMN worn INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("bag")) {
    await db.execute("ALTER TABLE items ADD COLUMN bag TEXT");
  }

  const countRes = await db.execute("SELECT COUNT(*) AS count FROM items");
  if (Number(countRes.rows[0].count) > 0) return;

  // Seed from the spreadsheet-derived data on first run.
  const inserts = [];
  let order = 0;
  for (const phase of SEED_DATA) {
    for (const section of phase.sections) {
      for (const entry of section.items) {
        inserts.push({
          sql: `INSERT INTO items (phase_key, location, phase_subtitle, section, item, notes, starred, done, worn, bag, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?)`,
          args: [
            phase.key,
            phase.location,
            phase.subtitle,
            section.section,
            entry.item,
            entry.notes ?? null,
            entry.starred ? 1 : 0,
            order++,
          ],
        });
      }
    }
  }
  if (inserts.length > 0) await db.batch(inserts, "write");
}

function ready(): Promise<void> {
  if (!globalForDb.__packingInit) globalForDb.__packingInit = init();
  return globalForDb.__packingInit;
}

export async function getAllItems(): Promise<ItemRow[]> {
  await ready();
  const res = await getClient().execute(
    "SELECT * FROM items ORDER BY sort_order ASC"
  );
  return res.rows.map(mapRow);
}

async function getItem(id: number): Promise<ItemRow | undefined> {
  const res = await getClient().execute({
    sql: "SELECT * FROM items WHERE id = ?",
    args: [id],
  });
  return res.rows.length ? mapRow(res.rows[0]) : undefined;
}

export async function setItemDone(
  id: number,
  done: boolean
): Promise<ItemRow | undefined> {
  return updateItemFlags(id, { done });
}

export async function setItemWorn(
  id: number,
  worn: boolean
): Promise<ItemRow | undefined> {
  return updateItemFlags(id, { worn });
}

export async function updateItemFlags(
  id: number,
  flags: {
    done?: boolean;
    worn?: boolean;
    bag?: string | null;
    item?: string;
    notes?: string | null;
  }
): Promise<ItemRow | undefined> {
  await ready();
  const db = getClient();
  const sets: string[] = [];
  const args: (number | string | null)[] = [];
  if (typeof flags.done === "boolean") {
    sets.push("done = ?");
    args.push(flags.done ? 1 : 0);
  }
  if (typeof flags.worn === "boolean") {
    sets.push("worn = ?");
    args.push(flags.worn ? 1 : 0);
  }
  if (flags.bag !== undefined) {
    sets.push("bag = ?");
    args.push(flags.bag);
  }
  if (typeof flags.item === "string") {
    sets.push("item = ?");
    args.push(flags.item);
  }
  if (flags.notes !== undefined) {
    sets.push("notes = ?");
    args.push(flags.notes);
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    args.push(id);
    await db.execute({
      sql: `UPDATE items SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });
  }
  return getItem(id);
}

export async function deleteItem(id: number): Promise<boolean> {
  await ready();
  const res = await getClient().execute({
    sql: "DELETE FROM items WHERE id = ?",
    args: [id],
  });
  return res.rowsAffected > 0;
}

export async function addItem(data: {
  phase_key: string;
  location: string;
  phase_subtitle: string;
  section: string;
  item: string;
  notes?: string | null;
}): Promise<ItemRow> {
  await ready();
  const db = getClient();
  const tx = await db.transaction("write");
  let newId: number;
  try {
    // Place at the end of its section; append to the very end if the section
    // doesn't exist yet.
    const sectionMax = await tx.execute({
      sql: "SELECT MAX(sort_order) AS m FROM items WHERE phase_key = ? AND section = ?",
      args: [data.phase_key, data.section],
    });
    const globalMax = await tx.execute("SELECT MAX(sort_order) AS m FROM items");
    const sm = sectionMax.rows[0].m;
    const gm = globalMax.rows[0].m;

    let order: number;
    if (sm === null) {
      order = (gm === null ? -1 : Number(gm)) + 1;
    } else {
      order = Number(sm) + 1;
      await tx.execute({
        sql: "UPDATE items SET sort_order = sort_order + 1 WHERE sort_order >= ?",
        args: [order],
      });
    }

    const ins = await tx.execute({
      sql: `INSERT INTO items (phase_key, location, phase_subtitle, section, item, notes, starred, done, worn, bag, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, ?)`,
      args: [
        data.phase_key,
        data.location,
        data.phase_subtitle,
        data.section,
        data.item,
        data.notes ?? null,
        order,
      ],
    });
    newId = Number(ins.lastInsertRowid);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  const row = await getItem(newId);
  if (!row) throw new Error("Failed to read inserted item");
  return row;
}

// Rewrite sort_order to match the given id order (position = sort_order).
export async function reorderItems(ids: number[]): Promise<void> {
  await ready();
  if (ids.length === 0) return;
  await getClient().batch(
    ids.map((id, index) => ({
      sql: "UPDATE items SET sort_order = ? WHERE id = ?",
      args: [index, id],
    })),
    "write"
  );
}

export async function resetAll(): Promise<void> {
  await ready();
  await getClient().execute(
    "UPDATE items SET done = 0, worn = 0, bag = NULL, updated_at = datetime('now')"
  );
}
