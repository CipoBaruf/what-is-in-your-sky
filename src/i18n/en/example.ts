/**
 * R202 (FR-OPEN-8, D-1181, D-1209): the example first run's words — the line on the other pages and the
 * card's look line. R215 (D-1238): the pages' line and its control went to the header's place line.
 */
export const example = {
  example: {
    label: (city: string) => `Example: ${city}, from your time zone`,
    /** FR-OPEN-12: `minutes` is whole and at least 1, the caller's (D-1209). */
    looks: (minutes: number) => `A steady moving dot, no blinking, crosses in about ${String(minutes)} min.`,
  },
};
