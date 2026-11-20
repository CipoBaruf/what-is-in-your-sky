/**
 * FR-OPEN-1 (PLAN D-1174): the city the browser's time zone names, from
 * `zones.txt` (`scripts/build-zones.ts`). Pure but for `loadZoneCity`, which
 * imports the table as its own chunk; no permission, no request, no write.
 */

export interface ZoneCity {
  name: string;
  lat: number;
  lon: number;
}

export interface Zones {
  rows: Map<string, ZoneCity>;
  /** Alias → its target zone (`backward`). */
  aliases: Map<string, string>;
}

const lastPart = (zone: string): string => (zone.split('/').pop() ?? zone).replace(/_/g, ' ');

/** Reads `zones.txt`: `Zone<TAB>Δlat<TAB>Δlon[<TAB>Name]` in 0.01° from the row before, `=Alias<TAB>Zone`. Throws on a malformed line. */
export function parseZones(text: string): Zones {
  const rows = new Map<string, ZoneCity>();
  const aliases = new Map<string, string>();
  let a = 0;
  let o = 0;
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (line.startsWith('=')) {
      const target = f[1];
      if (!target || f[0] === '=') throw new Error(`zones: bad line "${line}"`);
      aliases.set((f[0] ?? '').slice(1), target);
      continue;
    }
    const [zone, dLat, dLon, name] = f;
    a += Number(dLat);
    o += Number(dLon);
    if (!zone || !Number.isFinite(a) || !Number.isFinite(o)) throw new Error(`zones: bad line "${line}"`);
    rows.set(zone, { name: name ?? lastPart(zone), lat: a / 100, lon: o / 100 });
  }
  return { rows, aliases };
}

/** The zone's city, or `null` for no zone, `UTC`, an `Etc/` zone or a name not in the table; an alias resolves once. */
export function zoneCity(zone: string | null | undefined, zones: Zones): ZoneCity | null {
  if (!zone || zone === 'UTC' || zone.startsWith('Etc/')) return null;
  return zones.rows.get(zone) ?? zones.rows.get(zones.aliases.get(zone) ?? '') ?? null;
}

/** The browser's zone looked up in the table, which this imports as its own chunk. */
export async function loadZoneCity(zone: string | undefined = Intl.DateTimeFormat().resolvedOptions().timeZone): Promise<ZoneCity | null> {
  const { default: text } = await import('./zones.txt?raw');
  return zoneCity(zone, parseZones(text));
}
