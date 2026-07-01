// Watches the local SQLite database and auto-commits + pushes it to GitHub a
// few seconds after each change, so your checklist data stays backed up
// "after every change". Run it in a terminal alongside the app:
//
//   npm run sync:db
//
// It only ever commits data/packing.db (never your code), debounces rapid
// edits, and is safe to leave running. Ctrl+C to stop.
import Database from "better-sqlite3";
import { watch } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "packing.db");
const DEBOUNCE_MS = 4000;

let timer = null;
let syncing = false;

function stamp() {
  // Avoid Date in module scope concerns — fine here, this is a plain script.
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function sync() {
  if (syncing) {
    schedule();
    return;
  }
  syncing = true;
  try {
    // Merge the WAL into the main db file so the committed snapshot is complete.
    try {
      const db = new Database(DB_PATH);
      db.pragma("busy_timeout = 4000");
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.close();
    } catch {
      /* db momentarily locked — try again on the next change */
    }

    const { stdout } = await run("git", [
      "status",
      "--porcelain",
      "--",
      "data/packing.db",
    ]);
    if (!stdout.trim()) {
      syncing = false;
      return; // nothing changed
    }

    await run("git", ["commit", "-m", `chore: sync packing.db (${stamp()})`, "--", "data/packing.db"]);
    await run("git", ["push", "origin", "HEAD"]);
    console.log(`[${stamp()}] pushed packing.db`);
  } catch (err) {
    console.error(`[${stamp()}] sync failed:`, err.stderr || err.message);
  } finally {
    syncing = false;
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(sync, DEBOUNCE_MS);
}

watch(DATA_DIR, (_event, file) => {
  if (file && file.startsWith("packing.db")) schedule();
});

console.log(
  `Auto-syncing ${DB_PATH}\nCommits + pushes the database ~${DEBOUNCE_MS / 1000}s after each change. Ctrl+C to stop.`
);
schedule(); // capture anything already pending on startup
