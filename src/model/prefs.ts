/** US-5 AC2: the pass list order. `chronological` is the default; `best` ranks by brightness × elevation (`lib/passSort.ts`). Persisted in `wiys:prefs:v1`. */
export type PassSort = 'chronological' | 'best';
/** US-6 AC3/AC5 (R13): which sky chart view is shown, the 2D polar chart (default for now, D-68) or the ASCII dome (R15). Persisted in `wiys:prefs:v1`. */
export type ChartView = 'dome' | 'polar';
/** FR-GUIDE-4 (R13): the polar chart's convention, `looking-up` (east on the left, the default) or `map` (east on the right). Persisted in `wiys:prefs:v1`. */
export type ChartOrientation = 'looking-up' | 'map';
