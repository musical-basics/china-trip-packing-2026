// Source of truth for the initial checklist, transcribed from Lionel's
// hand-written "carry items" packing list for the Las Vegas + China trip
// (6/11–7/30). Two phases: shared carry items (Las Vegas & China) and the
// extra items that are China-only.
// This seeds the SQLite database on first run. After that, the DB owns the state.

export type SeedItem = {
  item: string;
  notes?: string;
  starred?: boolean;
};

export type SeedSection = {
  section: string;
  items: SeedItem[];
};

export type SeedPhase = {
  // Stable key used for ordering / colour-coding in the UI.
  key: "las-vegas" | "china";
  location: string;
  subtitle: string;
  sections: SeedSection[];
};

export const TRIP_TITLE = "Las Vegas + China Trip";
export const TRIP_SUBTITLE = "Carry items · 6/11 – 7/30";

export const SEED_DATA: SeedPhase[] = [
  {
    key: "las-vegas",
    location: "Las Vegas & China",
    subtitle: "Carry items for the whole trip (6/11–7/30)",
    sections: [
      {
        section: "Clothing (Las Vegas & China)",
        items: [
          { item: "10x T-shirt" },
          { item: "10x Underwear" },
          { item: "2x shorts" },
          { item: "10x pair socks" },
          { item: "Slippers" },
          { item: "Long pants", notes: "Wear on the flight" },
          { item: "Sweater shirt", notes: "Wear on the flight" },
        ],
      },
      {
        section: "Hygiene (Las Vegas & China)",
        items: [{ item: "Hygiene kit" }],
      },
      {
        section: "Music (Las Vegas & China)",
        items: [
          { item: "iPad + charger" },
          { item: "Tripod" },
          { item: "Headphone, earphone & AirPods" },
          { item: "Mac Studio + power cable + HDMI cable" },
          { item: "MacBook Pro + charger" },
          { item: "Mouse & keyboard (for Mac Studio)" },
          { item: "USB extender (2)" },
        ],
      },
      {
        section: "Travel (Las Vegas & China)",
        items: [
          { item: "Passport", notes: "Don't forget!", starred: true },
          { item: "iPhone + charger" },
          { item: "Christian book" },
          { item: "Headphone + converter" },
          { item: "Travel pillow" },
          { item: "Chinese phone + charger" },
        ],
      },
      {
        section: "For staying (Las Vegas & China)",
        items: [
          { item: "White shirts & cap (for sun)" },
          { item: "Tiger Balm" },
        ],
      },
    ],
  },
  {
    key: "china",
    location: "China",
    subtitle: "Extra items to bring for China",
    sections: [
      {
        section: "China extras",
        items: [
          { item: "Power converter (2)" },
          { item: "USB print cable" },
          { item: "Portable pedal" },
          { item: "Portable keyboard" },
        ],
      },
    ],
  },
];
