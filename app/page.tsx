import { getAllItems } from "@/lib/db";
import { TRIP_TITLE, TRIP_SUBTITLE } from "@/lib/seed-data";
import Checklist, { type ClientItem } from "./Checklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const items: ClientItem[] = (await getAllItems()).map((r) => ({
    id: r.id,
    phaseKey: r.phase_key,
    location: r.location,
    phaseSubtitle: r.phase_subtitle,
    section: r.section,
    item: r.item,
    notes: r.notes,
    starred: r.starred === 1,
    done: r.done === 1,
    worn: r.worn === 1,
    bag: r.bag,
  }));

  return (
    <main className="wrap">
      <Checklist
        initialItems={items}
        title={TRIP_TITLE}
        subtitle={TRIP_SUBTITLE}
      />
    </main>
  );
}
