/**
 * Number formatting shared by the pass card and the detail screen (R6 moved
 * these out of `PassCard.tsx`). Pure; no clock, no React (PLAN §3).
 */

/** Whole degrees with the degree sign: "53°". */
export const degrees = (n: number): string => `${String(Math.round(n))}°`;

/** "4 min 32 s", "48 s". */
export function formatDuration(durationS: number): string {
  const total = Math.round(durationS);
  const min = Math.floor(total / 60);
  const s = total % 60;
  return min > 0 ? `${String(min)} min ${String(s)} s` : `${String(s)} s`;
}

/** Signed, one decimal, real minus sign: "+1.2", "−0.3", "+0.0". */
export function formatMagnitude(mag: number): string {
  const rounded = Math.round(mag * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return '+0.0';
  return rounded < 0 ? `−${Math.abs(rounded).toFixed(1)}` : `+${rounded.toFixed(1)}`;
}

/** Whole kilometres with a space every three digits: "1 505 km". */
export function formatRange(rangeKm: number): string {
  const digits = String(Math.round(rangeKm));
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`;
}

/**
 * A duration as a clock: "m:ss" under an hour, "h:mm:ss" above. Negative
 * inputs are treated as zero; the caller decides how to word the past.
 */
export function formatClockDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h)}:${mm}:${ss}` : `${String(m)}:${ss}`;
}
