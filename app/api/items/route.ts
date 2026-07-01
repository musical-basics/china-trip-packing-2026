import { NextRequest, NextResponse } from "next/server";
import { getAllItems, addItem } from "@/lib/db";

// better-sqlite3 is a native module — force the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getAllItems();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const phase_key = str(obj.phase_key);
  const location = str(obj.location);
  const phase_subtitle = str(obj.phase_subtitle);
  const section = str(obj.section);
  if (!phase_key || !location || !section) {
    return NextResponse.json(
      { error: "phase_key, location, and section are required" },
      { status: 400 }
    );
  }

  // The description is optional — a freshly-added item gets a placeholder the
  // user then edits inline.
  const item = str(obj.item) || "New item";

  const created = await addItem({
    phase_key,
    location,
    phase_subtitle,
    section,
    item,
  });
  return NextResponse.json({ item: created }, { status: 201 });
}
