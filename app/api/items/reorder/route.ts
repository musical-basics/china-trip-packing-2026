import { NextRequest, NextResponse } from "next/server";
import { reorderItems } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n))) {
    return NextResponse.json(
      { error: "`ids` must be an array of integers (the new order)" },
      { status: 400 }
    );
  }

  await reorderItems(ids as number[]);
  return NextResponse.json({ ok: true });
}
