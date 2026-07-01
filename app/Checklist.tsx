"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";

export type ClientItem = {
  id: number;
  phaseKey: string;
  location: string;
  phaseSubtitle: string;
  section: string;
  item: string;
  notes: string | null;
  starred: boolean;
  done: boolean;
  worn: boolean;
  bag: string | null;
};

const PHASE_COLORS: Record<string, string> = {
  "las-vegas": "var(--las-vegas)",
  china: "var(--china)",
  other: "var(--text-faint)",
};

// Where the global "+ Add item" button drops new items.
const QUICK_ADD = {
  phaseKey: "other",
  location: "Other",
  phaseSubtitle: "Items you added",
  section: "Added items",
};

const DELETE_GRACE_MS = 5000;

type AddTarget = {
  phaseKey: string;
  location: string;
  phaseSubtitle: string;
  section: string;
};

type ServerRow = {
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
};

function rowToClient(r: ServerRow): ClientItem {
  return {
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
  };
}

// Bags / containers an item can be stowed in, each with its own colour so the
// item's left accent (and badge) match the bag.
const BAGS = ["Backpack", "Carry-on", "Checked bag", "Garment case", "Personal item"];
const BAG_COLORS: Record<string, string> = {
  Backpack: "#38bdf8", // sky blue
  "Carry-on": "#fb7185", // rose
  "Checked bag": "#c084fc", // violet
  "Garment case": "#facc15", // gold
  "Personal item": "#5eead4", // teal
};
const bagColor = (bag: string | null) =>
  (bag && BAG_COLORS[bag]) || "#38bdf8";
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// An item is "handled" if it's packed, being worn, or stowed in a bag — any of
// those means it's accounted for, so all count toward progress.
const isHandled = (i: ClientItem) => i.done || i.worn || !!i.bag;

type Grouped = {
  phaseKey: string;
  location: string;
  phaseSubtitle: string;
  total: number;
  handled: number;
  sections: { section: string; items: ClientItem[] }[];
}[];

function group(items: ClientItem[]): Grouped {
  const phases: Grouped = [];
  for (const it of items) {
    let phase = phases.find((p) => p.phaseKey === it.phaseKey);
    if (!phase) {
      phase = {
        phaseKey: it.phaseKey,
        location: it.location,
        phaseSubtitle: it.phaseSubtitle,
        total: 0,
        handled: 0,
        sections: [],
      };
      phases.push(phase);
    }
    phase.total += 1;
    if (isHandled(it)) phase.handled += 1;

    let section = phase.sections.find((s) => s.section === it.section);
    if (!section) {
      section = { section: it.section, items: [] };
      phase.sections.push(section);
    }
    section.items.push(it);
  }
  return phases;
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Pencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pencil">
      <path
        d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17l-1 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Trash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="trash">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Grip() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="grip">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export default function Checklist({
  initialItems,
  title,
  subtitle,
}: {
  initialItems: ClientItem[];
  title: string;
  subtitle: string;
}) {
  const [items, setItems] = useState<ClientItem[]>(initialItems);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [toast, setToast] = useState<{ item: ClientItem } | null>(null);
  const pendingDelete = useRef<{
    item: ClientItem;
    index: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const grouped = useMemo(() => group(items), [items]);
  const total = items.length;
  const handledCount = items.filter(isHandled).length;
  const allDone = total > 0 && handledCount === total;

  // Optimistically apply a flag change, PATCH it, and roll back on failure.
  async function patchItem(
    target: ClientItem,
    flags: {
      done?: boolean;
      worn?: boolean;
      bag?: string | null;
      item?: string;
      notes?: string | null;
    }
  ) {
    const prevSnapshot = {
      done: target.done,
      worn: target.worn,
      bag: target.bag,
      item: target.item,
      notes: target.notes,
    };

    setItems((prev) =>
      prev.map((i) => (i.id === target.id ? { ...i, ...flags } : i))
    );
    setSaving((prev) => new Set(prev).add(target.id));
    setError(null);

    try {
      const res = await fetch(`/api/items/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flags),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === target.id ? { ...i, ...prevSnapshot } : i))
      );
      setError("Couldn't sync that change to the database. Try again.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
    }
  }

  const togglePacked = (it: ClientItem) => patchItem(it, { done: !it.done });
  const toggleWorn = (it: ClientItem) => patchItem(it, { worn: !it.worn });
  const setBag = (it: ClientItem, bag: string | null) => patchItem(it, { bag });

  function startEdit(it: ClientItem) {
    setEditingId(it.id);
    setEditText(it.item);
    setEditNotes(it.notes ?? "");
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(it: ClientItem) {
    const text = editText.trim();
    if (text === "") return; // don't allow an empty description
    const notes = editNotes.trim();
    setEditingId(null);
    if (text === it.item && (notes || null) === (it.notes || null)) return; // no change
    await patchItem(it, { item: text, notes: notes === "" ? null : notes });
  }

  // Actually delete on the server, restoring the row if the request fails.
  function serverDelete(item: ClientItem, index: number) {
    fetch(`/api/items/${item.id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok && res.status !== 404) throw new Error();
      })
      .catch(() => {
        setItems((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, item);
          return next;
        });
        setError("Couldn't delete that item — it's back in the list.");
      });
  }

  // Commit whatever delete is currently pending its grace period, right now.
  function flushPendingDelete() {
    const p = pendingDelete.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingDelete.current = null;
    serverDelete(p.item, p.index);
  }

  // Remove from the UI immediately but defer the DB delete, so Undo is lossless.
  function requestDelete(it: ClientItem) {
    flushPendingDelete(); // only one item sits in the grace window at a time
    const index = items.findIndex((i) => i.id === it.id);
    setItems((prev) => prev.filter((i) => i.id !== it.id));
    if (editingId === it.id) setEditingId(null);
    setError(null);
    const timer = setTimeout(() => {
      const p = pendingDelete.current;
      if (p && p.item.id === it.id) {
        pendingDelete.current = null;
        setToast(null);
        serverDelete(p.item, p.index);
      }
    }, DELETE_GRACE_MS);
    pendingDelete.current = { item: it, index, timer };
    setToast({ item: it });
  }

  function undoDelete() {
    const p = pendingDelete.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingDelete.current = null;
    setItems((prev) => {
      const next = [...prev];
      next.splice(Math.min(p.index, next.length), 0, p.item);
      return next;
    });
    setToast(null);
  }

  // Create a new item in the given section, then drop straight into edit mode.
  async function addNewItem(target: AddTarget) {
    setError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase_key: target.phaseKey,
          location: target.location,
          phase_subtitle: target.phaseSubtitle,
          section: target.section,
          item: "New item",
        }),
      });
      if (!res.ok) throw new Error();
      const { item } = await res.json();
      const ci = rowToClient(item as ServerRow);
      // Insert after the last item already in this section (matches the server).
      setItems((prev) => {
        let lastIdx = -1;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].phaseKey === ci.phaseKey && prev[i].section === ci.section)
            lastIdx = i;
        }
        if (lastIdx === -1) return [...prev, ci];
        return [...prev.slice(0, lastIdx + 1), ci, ...prev.slice(lastIdx + 1)];
      });
      startEdit(ci);
    } catch {
      setError("Couldn't add an item. Try again.");
    }
  }

  async function refetchItems() {
    try {
      const { items: rows } = await (await fetch("/api/items")).json();
      setItems((rows as ServerRow[]).map(rowToClient));
    } catch {
      /* leave current state if the refetch fails */
    }
  }

  // Persist the full new order (position = sort_order); resync from server on failure.
  async function persistOrder(ordered: ClientItem[]) {
    try {
      const res = await fetch("/api/items/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ordered.map((i) => i.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Couldn't save the new order.");
      refetchItems();
    }
  }

  function onDrop(targetId: number) {
    const fromId = dragId;
    setDragId(null);
    setDragOverId(null);
    if (fromId === null || fromId === targetId) return;

    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === fromId);
      const to = prev.findIndex((i) => i.id === targetId);
      if (from < 0 || to < 0) return prev;
      // Only reorder within the same section.
      if (
        prev[from].section !== prev[to].section ||
        prev[from].phaseKey !== prev[to].phaseKey
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      const newTo = next.findIndex((i) => i.id === targetId);
      const insertAt = from < to ? newTo + 1 : newTo; // drop below when dragging down
      next.splice(insertAt, 0, moved);
      persistOrder(next);
      return next;
    });
  }

  // Same-section, different-item rows are valid drop targets.
  function canDropOn(target: ClientItem): boolean {
    if (dragId === null || dragId === target.id) return false;
    const dragged = items.find((i) => i.id === dragId);
    return (
      !!dragged &&
      dragged.section === target.section &&
      dragged.phaseKey === target.phaseKey
    );
  }

  async function resetAll() {
    if (!confirm("Uncheck every item (packed and worn) and start over?")) return;
    const snapshot = items;
    setItems((prev) =>
      prev.map((i) => ({ ...i, done: false, worn: false, bag: null }))
    );
    setError(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(snapshot);
      setError("Couldn't reset. Try again.");
    }
  }

  return (
    <>
      <header className="header">
        <h1 className="title">{title}</h1>
        <p className="subtitle">{subtitle}</p>
        <div className="overall">
          <Bar done={handledCount} total={total} />
          <span className="count">
            {handledCount}/{total}
          </span>
          <button
            className="add-top-btn"
            onClick={() => addNewItem(QUICK_ADD)}
            type="button"
            title="Add a new item"
          >
            + Add item
          </button>
          <button className="reset-btn" onClick={resetAll} type="button">
            Reset
          </button>
        </div>
        <p className="legend">
          <span className="legend-item"><span className="legend-swatch packed" /> packed</span>
          <span className="legend-item"><span className="legend-swatch worn" /> worn</span>
          {BAGS.filter((b) => items.some((i) => i.bag === b)).map((b) => (
            <span className="legend-item" key={b}>
              <span className="legend-swatch" style={{ background: bagColor(b) }} /> {b}
            </span>
          ))}
        </p>
      </header>

      {error && <div className="error" role="alert">{error}</div>}

      {allDone && (
        <div className="celebrate">🎉 Everything's handled — you're all packed and ready!</div>
      )}

      {grouped.map((phase) => (
        <section className="phase" key={phase.phaseKey}>
          <div className="phase-head">
            <span
              className="phase-dot"
              style={{ background: PHASE_COLORS[phase.phaseKey] ?? "var(--accent)" }}
            />
            <h2 className="phase-title">{phase.location}</h2>
            <span className="phase-count">
              {phase.handled}/{phase.total}
            </span>
          </div>
          <p className="phase-subtitle">{phase.phaseSubtitle}</p>

          {phase.sections.map((section) => (
            <div className="section" key={section.section}>
              <h3 className="section-title">{section.section}</h3>
              <div className="card">
                {section.items.map((it) => {
                  const editing = editingId === it.id;
                  return (
                    <div
                      key={it.id}
                      className={
                        "item" +
                        (it.done ? " is-done" : "") +
                        (it.worn ? " is-worn" : "") +
                        (it.bag ? " is-bagged" : "") +
                        (editing ? " is-editing" : "") +
                        (dragId === it.id ? " dragging" : "") +
                        (dragOverId === it.id ? " drag-over" : "") +
                        (saving.has(it.id) ? " pending-saving" : "")
                      }
                      style={
                        it.bag
                          ? ({ "--row-accent": bagColor(it.bag) } as CSSProperties)
                          : undefined
                      }
                      onDragOver={(e) => {
                        if (canDropOn(it)) {
                          e.preventDefault();
                          if (dragOverId !== it.id) setDragOverId(it.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverId === it.id) setDragOverId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDrop(it.id);
                      }}
                    >
                      {editing ? (
                        <div className="item-edit">
                          <input
                            className="edit-input"
                            value={editText}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(it);
                              else if (e.key === "Escape") cancelEdit();
                            }}
                            placeholder="Item description"
                            aria-label="Item description"
                          />
                          <input
                            className="edit-notes-input"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(it);
                              else if (e.key === "Escape") cancelEdit();
                            }}
                            placeholder="Note (optional)"
                            aria-label="Note"
                          />
                          <div className="edit-actions">
                            <button type="button" className="edit-save" onClick={() => saveEdit(it)}>
                              Save
                            </button>
                            <button type="button" className="edit-cancel" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span
                            className="drag-handle"
                            draggable
                            onDragStart={(e) => {
                              const row = (e.currentTarget as HTMLElement).closest(
                                ".item"
                              );
                              if (row)
                                e.dataTransfer.setDragImage(row as Element, 18, 18);
                              e.dataTransfer.effectAllowed = "move";
                              setDragId(it.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDragOverId(null);
                            }}
                            title="Drag to reorder"
                            aria-label="Drag to reorder"
                          >
                            <Grip />
                          </span>
                          <button
                            type="button"
                            className="checkbox-btn"
                            onClick={() => togglePacked(it)}
                            aria-pressed={it.done}
                            aria-label={`Mark "${it.item}" as packed`}
                            title="Packed"
                          >
                            <span className="checkbox">
                              <Check />
                            </span>
                          </button>

                          <div
                            className="item-body"
                            onClick={() => togglePacked(it)}
                            role="button"
                            tabIndex={-1}
                          >
                            <span className="item-text">
                              {it.item}
                              {it.starred && <span className="star" title="Don't forget!">★</span>}
                              {it.bag && (
                                <span
                                  className="bag-badge"
                                  title={`Stowed in ${it.bag}`}
                                  style={{
                                    color: bagColor(it.bag),
                                    backgroundColor: tint(bagColor(it.bag), 0.18),
                                  }}
                                >
                                  🎒 {it.bag}
                                </span>
                              )}
                            </span>
                            {it.notes && <span className="item-note">{it.notes}</span>}
                          </div>

                          <div className="item-controls">
                            <button
                              type="button"
                              className={"worn-btn" + (it.worn ? " is-worn" : "")}
                              onClick={() => toggleWorn(it)}
                              aria-pressed={it.worn}
                              title={it.worn ? "Wearing this" : "Mark as worn (wearing it, not packing it)"}
                            >
                              {it.worn ? "Worn" : "Wear"}
                            </button>

                            <select
                              className={"bag-select" + (it.bag ? " has-bag" : "")}
                              style={
                                it.bag
                                  ? {
                                      color: bagColor(it.bag),
                                      borderColor: bagColor(it.bag),
                                      backgroundColor: tint(bagColor(it.bag), 0.12),
                                    }
                                  : undefined
                              }
                              value={it.bag ?? ""}
                              onChange={(e) => setBag(it, e.target.value || null)}
                              title="Which bag is this in?"
                              aria-label={`Bag for ${it.item}`}
                            >
                              <option value="">Bag…</option>
                              {BAGS.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className="edit-btn"
                              onClick={() => startEdit(it)}
                              title="Edit description"
                              aria-label={`Edit "${it.item}"`}
                            >
                              <Pencil />
                            </button>

                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() => requestDelete(it)}
                              title="Delete item"
                              aria-label={`Delete "${it.item}"`}
                            >
                              <Trash />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="add-section-btn"
                onClick={() =>
                  addNewItem({
                    phaseKey: phase.phaseKey,
                    location: phase.location,
                    phaseSubtitle: phase.phaseSubtitle,
                    section: section.section,
                  })
                }
              >
                + Add item
              </button>
            </div>
          ))}
        </section>
      ))}

      <p className="sync-hint">
        Changes save instantly to a local SQLite database (data/packing.db).
      </p>

      {toast && (
        <div className="toast" role="status">
          <span className="toast-text">
            Deleted “{toast.item.item}”
          </span>
          <button type="button" className="toast-undo" onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
    </>
  );
}
