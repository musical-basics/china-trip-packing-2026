// Wipes the local SQLite database so it gets re-seeded from lib/seed-data.ts
// the next time the server starts. Use this if you change the seed data and
// want to start fresh.  Run with:  npm run reseed
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const files = ["packing.db", "packing.db-shm", "packing.db-wal"];
let removed = 0;
for (const f of files) {
  const p = join(process.cwd(), "data", f);
  if (existsSync(p)) {
    rmSync(p);
    removed++;
  }
}

console.log(
  removed > 0
    ? `Removed ${removed} database file(s). It will be re-seeded on next \`npm run dev\`.`
    : "No database files found — nothing to remove."
);
