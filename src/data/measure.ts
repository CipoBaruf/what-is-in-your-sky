/**
 * FR-MEAS-3 (D-1146): the sender. Everything it touches is injected, so a test drives every gate; it keeps nothing but a
 * set of the pairs already counted in this load, in memory. It cannot know whether the beacon arrived: a failed send is
 * silent by design (FR-MEAS-3), and an event dropped offline is never queued or retried.
 */
import { isMeasureEvent, type MeasureContext, type MeasureDetail, type MeasureName } from '../model/measure';

/** FR-ADDR-2: the public address; anywhere else nothing is sent unless a test forces it. */
export const MEASURE_ORIGIN = 'https://inyoursky.app';
/** FR-MEAS-3: the route on the page's own origin. */
export const MEASURE_PATH = '/e';

export interface MeasureEnv {
  /** `navigator.sendBeacon`, bound; undefined where the browser has none. */
  beacon: ((url: string, body: string) => boolean) | undefined;
  /** Read at send time: `navigator.onLine`. */
  online: () => boolean;
  origin: string;
  webdriver: boolean;
  /** `__WIYS_MEASURE__`: lifts the origin and `webdriver` gates, nothing else. */
  forced: boolean;
  /** When the send runs; the state module passes "after the next paint", a test leaves it synchronous. */
  defer?: (run: () => void) => void;
}

/** A name's detail argument: none for a name that takes none, otherwise one of its values or nothing (FR-MEAS-1). */
export type DetailArg<N extends MeasureName> = [MeasureDetail<N>] extends [never] ? [] : [detail?: MeasureDetail<N>];
export type Count = <N extends MeasureName>(name: N, ...detail: DetailArg<N>) => void;

/** D-1146: `count(name, detail?)` for one load, with that load's context. */
export function createMeasure(env: MeasureEnv, context: MeasureContext): Count {
  const sent = new Set<string>();
  const allowed = env.forced || (env.origin === MEASURE_ORIGIN && !env.webdriver);
  const defer = env.defer ?? ((run: () => void) => run());
  return (name: MeasureName, detail?: string) => {
    const pair = `${name}:${detail ?? ''}`;
    if (!allowed || sent.has(pair)) return;
    sent.add(pair); // V215-7: once per pair per load, sent or dropped
    const event = detail === undefined ? { name, ...context } : { name, detail, ...context };
    if (!isMeasureEvent(event)) return;
    defer(() => {
      try {
        if (env.beacon && env.online()) env.beacon(MEASURE_PATH, JSON.stringify(event));
      } catch {
        // FR-MEAS-3: a send that fails has no effect on the page.
      }
    });
  };
}
