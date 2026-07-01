import { NextResponse } from "next/server";
import { getAllItems, resetAll } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await resetAll();
  return NextResponse.json({ items: await getAllItems() });
}
