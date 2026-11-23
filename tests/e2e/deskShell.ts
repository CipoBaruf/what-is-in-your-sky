/**
 * R186 (FR-WIDE-1, FR-WIDE-5; D-1098): the desk shell's measures and its view row, shared by `sky-layout.spec.ts` and
 * `globe.spec.ts`. The box and the rail by their bounding boxes, the rail's rows in DOM order, the corners per view.
 */
import { expect, type Locator } from '@playwright/test';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const box = async (locator: Locator): Promise<Box> => {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`no box for ${String(locator)}`);
  return found;
};

const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;

/** R186: the shell's measure on one page — the box, the rail, and the rows the rail holds in DOM order. */
export interface Shell {
  box: Box;
  rail: Box;
  order: string[];
}

/** R216 (FR-NOW-1, D-1239): `SLOT_ORDER`, one order on every page; the list-first order is gone. */
export const SHELL_ORDER = ['strip', 'view', 'time', 'turn', 'layers', 'upNow', 'upFrom'];
export const SHELL_DESKS = [
  { width: 1024, height: 640 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;
export const DESK_VIEWS = ['globe', 'window', 'dome'] as const;
export type DeskView = (typeof DESK_VIEWS)[number];
export const DESK_LABELS = { en: ['Globe', 'Window', 'Dome'], es: ['Globo', 'Ventana', 'Domo'] } as const;

const round = (b: Box): Box => ({ x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) });

export async function shellOf(layout: Locator): Promise<Shell> {
  const order = await layout.locator('[data-rail] > [data-slot]').evaluateAll((els) => els.map((el) => el.getAttribute('data-slot') ?? ''));
  return { box: round(await box(layout.locator('[data-slot="drawing"]'))), rail: round(await box(layout.locator('[data-rail]'))), order };
}

export async function chooseDeskView(layout: Locator, locale: 'en' | 'es', view: DeskView): Promise<void> {
  const label = DESK_LABELS[locale][DESK_VIEWS.indexOf(view)] ?? '';
  // R206 (FR-CTRL-2): an option's name is its word, pressed or not.
  await layout.locator('[data-slot="view"]').getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: label, exact: true }).click();
  await expect(layout.locator(view === 'globe' ? '[data-globe]' : `[data-drawing="${view}"]`).first()).toBeAttached({ timeout: 30_000 });
}

/** FR-WIDE-5: the readout top-left and the hint bottom-left; FR-CTRL-9: the zoom under the box at its left on the views that zoom, none on the dome. */
export async function expectCorners(layout: Locator, view: DeskView): Promise<void> {
  const drawing = await box(layout.locator('[data-slot="drawing"]'));
  const zoom = layout.locator('[data-zoom-row]');
  if (view === 'dome') await expect(zoom.getByRole('button')).toHaveCount(0);
  else {
    // The three keys on the window (R214) and the globe (R217).
    await expect(zoom.getByRole('button')).toHaveCount(3);
    const at = await box(zoom);
    expect(Math.abs(at.x - drawing.x), `${view}: zoom at the left`).toBeLessThanOrEqual(1);
    expect(Math.abs(at.y - drawing.y - drawing.height), `${view}: zoom under the box`).toBeLessThanOrEqual(1);
  }
  const readout = layout.locator('[data-corner="readout"]');
  if (await readout.isVisible()) {
    const at = await box(readout);
    expect(Math.abs(at.x - drawing.x), `${view}: readout at the left`).toBeLessThanOrEqual(1);
    expect(Math.abs(at.y - drawing.y), `${view}: readout at the top`).toBeLessThanOrEqual(1);
  }
  const hint = layout.locator('[data-corner="hint"]');
  if ((await hint.count()) > 0) {
    const at = await box(hint);
    expect(Math.abs(at.x - drawing.x), `${view}: hint at the left`).toBeLessThanOrEqual(1);
    expect(at.y + at.height, `${view}: hint at the foot`).toBeGreaterThan(drawing.y + drawing.height - 2);
  }
}
