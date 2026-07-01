import { NextRequest, NextResponse } from "next/server";
import { updateItemFlags, deleteItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = (body ?? {}) as Record<string, unknown>;
  const flags: {
    done?: boolean;
    worn?: boolean;
    bag?: string | null;
    item?: string;
    notes?: string | null;
  } = {};
  if (typeof obj.done === "boolean") flags.done = obj.done;
  if (typeof obj.worn === "boolean") flags.worn = obj.worn;
  if ("bag" in obj) {
    const bag = obj.bag;
    if (bag !== null && typeof bag !== "string") {
      return NextResponse.json(
        { error: "`bag` must be a string or null" },
        { status: 400 }
      );
    }
    // Treat empty/whitespace as clearing the bag.
    flags.bag = typeof bag === "string" && bag.trim() === "" ? null : bag;
  }
  if ("item" in obj) {
    if (typeof obj.item !== "string" || obj.item.trim() === "") {
      return NextResponse.json(
        { error: "`item` must be a non-empty string" },
        { status: 400 }
      );
    }
    flags.item = obj.item.trim();
  }
  if ("notes" in obj) {
    const notes = obj.notes;
    if (notes !== null && typeof notes !== "string") {
      return NextResponse.json(
        { error: "`notes` must be a string or null" },
        { status: 400 }
      );
    }
    flags.notes =
      typeof notes === "string" && notes.trim() === ""
        ? null
        : typeof notes === "string"
          ? notes.trim()
          : null;
  }

  if (Object.keys(flags).length === 0) {
    return NextResponse.json(
      { error: "Body must include `done`, `worn`, `bag`, `item`, and/or `notes`" },
      { status: 400 }
    );
  }

  const updated = await updateItemFlags(itemId, flags);
  if (!updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const deleted = await deleteItem(itemId);
  if (!deleted) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
