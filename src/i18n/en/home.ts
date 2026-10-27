import type { CompassPoint } from '../../lib/compass';
import type { CloudState, PassBoundaryReason } from '../../model';

/**
 * R130 (FR-FLOW-1, FR-FLOW-2; D-843, D-844): the home's three doors and the
 * folded Where line. Every compact line is within 34 cells (FR-COMP-4,
 * `tests/styles/doorRows.test.ts`), so the cloud word here is the door's own
 * short one and not `weather.state`'s ("Likely obscured" would not fit after
 * the dark window).
 */
const cloudWord = { clear: 'Clear', partly: 'Partly cloudy', obscured: 'Cloudy', unknown: 'No forecast' } satisfies Record<CloudState, string>;

const landmarkWord = { above: 'above', below: 'below', beside: 'beside' } as const;

export const home = {
  doors: {
    /** Names the row of doors for assistive technology. */
    region: 'Where to look',
    satellites: {
      title: 'Satellites',
      /** `Next 05:48 · in 48:04`: the next rise, its clock time and the countdown to it. */
      next: (p: { time: string; countdown: string }) => `Next ${p.time} · in ${p.countdown}`,
      /** `Up now · peaks in 0:08` while a pass is up, then its end by the end's reason — shorter than the block's label, for 34 cells. */
      up: (p: { kind: 'peak' | 'end'; reason: PassBoundaryReason; countdown: string }) =>
        `Up now · ${p.kind === 'peak' ? 'peaks' : { horizon: 'sets', shadow: 'into shadow', twilight: 'fades' }[p.reason]} in ${p.countdown}`,
      /** `Tiangong · NE 11° → ENE`: the pass, where it peaks and how high, and where it goes. */
      path: (p: { name: string; peakPoint: CompassPoint; peakDeg: number; endPoint: CompassPoint }) => `${p.name} · ${p.peakPoint} ${String(p.peakDeg)}° → ${p.endPoint}`,
      none: (hours: number) => `No visible pass in ${String(hours)} h`,
      pending: 'Looking for the next pass…',
    },
    stars: {
      title: 'Stars',
      /** `cloud` is null with no zone yet: the stamp says UTC (F-27), and with no forecast there is no word to give. */
      dark: (p: { from: string; to: string; cloud: CloudState | null }) => `Dark ${p.from} → ${p.to}${p.cloud === null ? '' : ` · ${cloudWord[p.cloud]}`}`,
      noDark: (cloud: CloudState) => `No full dark · ${cloudWord[cloud]}`,
      brightest: (p: { name: string; point: CompassPoint }) => `Brightest now: ${p.name}, ${p.point}`,
      from: (time: string) => `Stars from ${time}`,
      /** The Sun up and no dark band tonight to wait for (a polar summer). */
      noNight: 'No dark sky tonight',
      /** Wide's third line: the Moon's lit part and its next set, or its next rise while it is down. */
      moon: (p: { pct: string; event: 'sets' | 'rises'; time: string }) => `Moon ${p.pct} % · ${p.event} ${p.time}`,
    },
    both: {
      title: 'Both · live sky',
      /** `1 up now, beside Mintaka`: the passes up now and the highlighted pass's landmark star. */
      up: (p: { count: number; star: { name: string; word: keyof typeof landmarkWord } | null }) => `${String(p.count)} up now${p.star === null ? '' : `, ${landmarkWord[p.star.word]} ${p.star.name}`}`,
      nothingNext: (time: string) => `Nothing up now · next ${time}`,
      nothing: 'Nothing up now',
      /** Wide's third line. */
      hint: 'Stars under the arcs, drag to look',
    },
  },
  /** FR-FLOW-2 (D-844): the compact Where's second line, when nothing is wrong. */
  whereFold: {
    ready: (age: string) => `Ready offline · elements ${age} old`,
    /** Before the readiness line has an answer, or with no elements loaded yet: the age alone, or nothing. */
    elements: (age: string) => `Elements ${age} old`,
  },
};
