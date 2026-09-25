import { describe, expect, it } from 'vitest';
import type { AgeParts } from '../lib/elementsAge';
import type { MoonFacts, MoonGlareFacts, MoonLoreParams } from '../lib/moonPhrases';
import type { GuideParams } from '../lib/phrases';
import type { Locale } from '../model';
import { en } from './en';
import { es } from './es';
import type { CountdownPhase, Messages } from './messages';
import { LOCALES } from './locale';
import { CATALOGS } from './useT';

/**
 * FR-I18N-2 / FR-I18N-3 (PLAN §9.1 "Messages"). What the types cannot check:
 * that every message actually renders in both languages, that none is empty,
 * and that the Spanish copy stays neutral and impersonal. That a key is
 * *present* is `tsc -b`'s job — the `@ts-expect-error` fixture below is the
 * proof, and it fails the build, not this file.
 */

/** A parameter set every parameterised message is rendered with, so none can throw or come out empty. */
const AGE: AgeParts = { days: 2, hours: 4, minutes: 0 };
const GUIDE: GuideParams = {
  startReason: 'horizon',
  startBand: 'low',
  startDir: 'WSW',
  startTime: '21:14:32 GMT-3',
  peakDegrees: '62°',
  peakBand: 'high',
  peakDir: 'S',
  peakTime: '21:17:50 GMT-3',
  endReason: 'shadow',
  endDir: 'ENE',
  endTime: '21:20:05 GMT-3',
  brightness: 'any-star',
  magnitude: '−1.8',
  twilight: true,
};
const PHASES: CountdownPhase[] = ['before', 'to-peak', 'to-end', 'over'];
const MOON: MoonFacts = { phase: 'waningGibbous', illumination: '74', up: true, direction: 'SSW', azimuth: '190°', elevation: '60°' };
const MOON_GLARE: MoonGlareFacts = { illumination: '74', separation: '8°', minAltitude: '0°', minIllumination: '50', maxSeparation: '30°' };
const MOON_LORE: MoonLoreParams = { sign: 'Taurus', fullMoonName: null, line: 'The bull carries Aldebaran.', hemisphereNote: null };

/** Every message of a catalog, rendered: plain strings as they are, functions over the fixture parameters. */
function render(t: Messages): string[] {
  const linked = [t.footer.celestrak, t.footer.openMeteo, t.footer.geonames, t.footer.chart, t.location.noMatch('Cipolletti'), t.location.searchFailed, t.location.searchOffline];
  return [
    t.app.title,
    t.app.tagline,
    t.app.language,
    t.app.theme,
    ...Object.values(t.app.themes),
    t.banner.info,
    t.banner.warning,
    ...Object.values(t.compass),
    t.location.heading,
    t.location.placeLabel,
    t.location.placePlaceholder,
    t.location.placeList,
    t.location.searching('Cipolletti'),
    t.location.placeCentre({ place: 'Cipolletti, Río Negro, Argentina', coords: '−38.93, −67.99' }),
    t.location.coordsLabel,
    t.location.coordsPlaceholder,
    t.location.altitudeLabel,
    t.location.coordsHint,
    t.location.suffixOnBoth,
    t.location.signOrSuffix,
    t.location.oneOfEach,
    t.location.latitudeRange({ min: -90, max: 90 }),
    t.location.longitudeRange({ min: -180, max: 180 }),
    t.location.altitudeNumber,
    t.location.altitudeRange({ min: -500, max: 9000 }),
    t.location.useMyLocation,
    t.location.locating,
    t.location.permissionDenied,
    t.location.positionUnavailable,
    t.location.positionTimeout,
    t.location.accuracy('1.5'),
    t.location.active({ coords: '−38.93, −67.99', fromDevice: true, altitude: '270', accuracy: t.location.accuracy('2') }),
    t.location.active({ coords: '−38.93, −67.99', fromDevice: false, altitude: null, accuracy: null }),
    t.location.savedHere,
    t.location.clearSaved,
    t.location.precisionNote,
    // R81 (FR-FIRST-3, FR-FIRST-9, FR-FIRST-11, FR-SAT-4): the populated home's own lines.
    t.home.where.centre('Cipolletti'),
    t.home.where.coords,
    t.home.where.device('40'),
    t.home.where.device(null),
    ...Object.values(t.home.conditions),
    t.home.darkWindow({ from: '20:14', to: '05:31' }),
    t.home.darkUntil('05:31'),
    t.home.noDarkWindow,
    t.home.moonRow({ phase: 'waxingCrescent', illumination: '18', point: 'NE' }),
    t.home.moonRow({ phase: 'full', illumination: '100', point: null }),
    t.home.upNow({ name: 'ISS (Zarya)', left: '3:12', more: 2 }),
    t.home.upNow({ name: 'ISS (Zarya)', left: null, more: 0 }),
    t.nextEvent.region,
    ...(['rise', 'peak', 'end'] as const).flatMap((kind) => (['horizon', 'shadow', 'twilight'] as const).map((reason) => t.nextEvent.label({ kind, reason, countdown: '3:45:07' }))),
    t.nextEvent.label({ kind: 'rise', reason: 'horizon', countdown: '12:34', first: true }),
    t.nextEvent.path({ start: { point: 'NW', altitude: 'low' }, peak: { point: 'N', altitude: 68 }, end: { point: 'SE', altitude: null } }),
    t.nextEvent.path({ start: { point: 'SW', altitude: 46 }, peak: { point: 'S', altitude: 46 }, end: { point: 'E', altitude: 22 } }),
    t.nextEvent.named({ name: 'ISS (Zarya)', path: 'NW low → 68° N → SE' }),
    t.nextEvent.withDuration({ path: 'NW low → 68° N → SE', minutes: 6 }),
    t.nextEvent.brightness({ band: 'venus', magnitude: '−3.4' }),
    t.nextEvent.openLive,
    t.nextEvent.pending,
    t.nextEvent.none({ reason: 'no-passes', hours: 72 }),
    t.nextEvent.none({ reason: 'no-darkness', hours: 72 }),
    t.nextEvent.none({ reason: 'no-elements', hours: 72 }),
    t.location.summaryChange,
    ...Object.values(t.moon.phase),
    t.moon.line(MOON),
    t.moon.line({ ...MOON, up: false, phase: 'new' }),
    t.moon.atPeak(MOON),
    t.moon.glare.label,
    t.moon.glare.sentence,
    t.moon.glare.tooltip(MOON_GLARE),
    t.moon.lore.heading,
    t.moon.lore.tradition,
    t.moon.lore.line(MOON_LORE),
    t.moon.lore.line({ ...MOON_LORE, fullMoonName: 'Harvest Moon' }),
    t.passes.heading,
    t.passes.noObserver,
    t.passes.loadingElements,
    t.passes.noElements,
    t.passes.computing,
    t.passes.computingProgress({ done: 4, total: 31, found: 2 }),
    t.passes.noDarkness({ hours: 24, place: 'Cipolletti' }),
    t.passes.none({ hours: 24, place: 'Cipolletti' }),
    t.passes.countLine({ count: 7, hours: 72 }),
    t.passes.sortGroup,
    t.passes.sortPrefix,
    ...Object.values(t.passes.sort),
    t.passes.nextTag({ name: 'ISS (Zarya)', iss: true }),
    t.passes.nextTag({ name: 'CSS (Tianhe)', iss: false }),
    t.passes.cardDetail({ minutes: 6, altitude: '68°', point: 'N', brightness: { magnitude: '−3.4' } }),
    t.passes.cardDetail({ minutes: 4, altitude: '41°', point: 'NE', brightness: { band: 'bright-star' } }),
    t.passes.twilightLabel,
    t.passes.openGuide,
    ...Object.values(t.passes.fields),
    t.passes.stamp({ date: '2026-09-11', time: '21:14:32 GMT-3' }),
    t.passes.direction({ point: 'NE', degrees: '46°' }),
    t.passes.magnitudeWithBand({ magnitude: '−1.8', band: 'any-star' }),
    t.passes.nights.tonight,
    t.passes.nights.tomorrow,
    t.passes.nights.dated('2026-09-13'),
    t.passes.nights.count(1),
    t.passes.nights.count(4),
    t.passes.nights.empty,
    t.passes.nights.toggles,
    ...PHASES.flatMap((phase) => (['horizon', 'shadow', 'twilight'] as const).map((reason) => t.countdown.headline({ phase, reason, clock: '12:34' }))),
    t.countdown.steps,
    t.countdown.rise,
    t.countdown.peak,
    t.countdown.set,
    t.guide.back,
    t.guide.sentence(GUIDE),
    t.guide.sentence({ ...GUIDE, startReason: 'twilight', endReason: 'horizon', twilight: false, startBand: 'overhead', peakBand: 'mid', brightness: 'faint' }),
    t.guide.sentence({ ...GUIDE, startReason: 'shadow', endReason: 'twilight', brightness: 'venus', startBand: 'mid', peakBand: 'overhead' }),
    t.guide.sentence({ ...GUIDE, brightness: 'bright-star', startBand: 'high', peakBand: 'low' }),
    t.guide.sentence({ ...GUIDE, brightness: 'average-star' }),
    ...Object.values(t.guide.startReason),
    ...Object.values(t.guide.endReason),
    ...Object.values(t.guide.numbers).filter((value): value is string => typeof value === 'string'),
    t.guide.numbers.sunWithLabel({ degrees: '−12.0°', twilight: true }),
    t.guide.numbers.sunWithLabel({ degrees: '+2.4°', twilight: false }),
    t.guide.azimuth({ point: 'ENE', degrees: '67°' }),
    t.chart.viewGroup,
    t.chart.viewPrefix,
    ...Object.values(t.chart.view),
    t.chart.loadingDome,
    t.chart.noPass,
    t.chart.orientationGroup,
    ...Object.values(t.chart.orientation),
    ...Object.values(t.chart.orientationNote),
    t.chart.legend.label,
    ...Object.values(t.chart.legend.state),
    t.chart.legend.sun({ azimuth: '285°', altitude: '−8.0°' }),
    t.chart.legend.moon({ glyph: '◕', azimuth: '120°', altitude: '+31.2°' }),
    t.chart.legend.moonLit({ glyph: '◕', phase: t.moon.phase.waxingGibbous, illumination: '72', azimuth: '120°', altitude: '+31.2°' }),
    t.chart.domeGroup,
    t.chart.domeHint,
    t.chart.readout({ point: 'SSW', azimuth: '203°', tilt: '25°' }),
    t.chart.liveLabel,
    t.live.open,
    t.live.openFromNow,
    t.live.back,
    t.live.loading,
    t.live.noPlace,
    t.live.setPlace,
    t.live.loadingElements,
    t.live.failedInstead,
    ...(['offline', 'rate-limited', 'server', 'bad-data', 'timeout', 'unknown'] as const).map((kind) => t.failure[kind](t.failure.what.elements)),
    t.failure.retry,
    t.failure.details,
    t.failure.detailLabel,
    ...Object.values(t.failure.what).flatMap((what) => [t.failure.server(what), t.failure.offline(what)]),
    ...Object.values(t.failure.instead),
    ...Object.values(t.boundary),
    t.settings.installLabel,
    t.live.strip,
    t.live.timeLabel,
    t.live.skyLabel,
    t.live.cloudLabel,
    t.live.countLabel,
    t.live.moonLabel,
    ...Object.values(t.live.sky),
    t.live.pending,
    t.live.countSpoken,
    ...Object.values(t.live.skyShort),
    ...Object.values(t.live.cloudWord),
    t.live.upCount(1),
    t.live.upCount(12),
    t.live.moon(MOON),
    ...Object.values(t.live.state),
    t.live.scrub,
    t.live.scrubWide,
    t.live.backToLive,
    t.live.heldOffset({ sign: '+', hours: 0, minutes: 33 }),
    t.live.heldOffset({ sign: '−', hours: 2, minutes: 5 }),
    t.live.overviewStart,
    t.live.overviewEnd,
    t.live.share,
    t.live.shareMoment,
    t.live.shareTitle,
    t.live.shareText('Cipolletti'),
    ...Object.values(t.weather.state),
    t.weather.badge({ state: 'clear', percent: '12' }),
    t.weather.badge({ state: 'unknown', percent: null }),
    t.weather.momentNow,
    t.weather.momentPeak,
    t.weather.tooltipHead({ percent: '12', moment: t.weather.momentPeak }),
    t.weather.tooltipHead({ percent: null, moment: t.weather.momentNow }),
    t.weather.thresholds({ clear: '30', obscured: '70' }),
    t.weather.source({ provider: 'Open-Meteo', fetched: '2026-09-11 21:14:32 GMT-3' }),
    t.weather.noForecast,
    t.elements.region,
    t.elements.age(AGE),
    t.elements.age({ days: 0, hours: 0, minutes: 0 }),
    t.elements.age({ days: 0, hours: 3, minutes: 12 }),
    t.elements.line('9 d 4 h'),
    t.elements.lineNone,
    t.elements.details,
    t.elements.none('2026-09-11 21:14:32 GMT-3'),
    t.elements.newest({ age: '2 d 4 h', epoch: '2026-09-09 17:00:00 GMT-3', checked: '2026-09-11 21:14:32 GMT-3' }),
    t.elements.stale('2026-09-11 19:00:00 GMT-3'),
    t.elements.oldEpoch({ age: '6 d', days: 5 }),
    t.elements.notCached,
    t.elements.unavailable({ count: 1, names: 'CSS (Tianhe)' }),
    t.elements.unavailable({ count: 3, names: 'A, B and C' }),
    t.readiness.ready('2026-09-14 21:14'),
    t.readiness.stored('2026-09-11 21:14'),
    t.readiness.notReady(t.readiness.gaps.forecast),
    ...Object.values(t.readiness.gaps),
    t.footer.privacy,
    ...Object.values(t.footer.short),
    // R102 (D-657): a sentence may carry a second link; its `middle` and `link2` are words too.
    ...linked.flatMap((text) => [text.before, text.link, ...(text.middle !== undefined ? [text.middle] : []), ...(text.link2 !== undefined ? [text.link2] : []), text.after]),
  ];
}

describe.each([...LOCALES])('the %s catalog', (locale: Locale) => {
  const rendered = render(CATALOGS[locale]);

  it('renders every message from the fixture parameters', () => {
    expect(rendered.length).toBeGreaterThan(140);
    for (const message of rendered) expect(typeof message).toBe('string');
  });

  it('has no empty message and no leftover placeholder', () => {
    for (const message of rendered) {
      expect(message.trim()).not.toBe('');
      expect(message).not.toMatch(/undefined|\[object|\{\{/);
    }
  });
});

/**
 * TASKS R27: the readiness line has to fit one row at 390 px in both languages.
 * The page frame keeps two cells of padding each side and a cell is 9.6 px at
 * the 16 px base (D-71), so a 390 px phone gives (390 − 4 × 9.6) / 9.6 = 36.6
 * characters. The e2e measures the rendered box; this pins the copy itself, at
 * the point where a translator would grow it (D-145).
 */
describe('the readiness line fits one row at 390 px (FR-OFF-4)', () => {
  const CELLS_AT_390 = 36;
  it.each([...LOCALES])('%s', (locale: Locale) => {
    expect(CATALOGS[locale].readiness.ready('2026-09-14 21:14').length).toBeLessThanOrEqual(CELLS_AT_390);
    expect(CATALOGS[locale].readiness.stored('2026-09-11 21:14').length).toBeLessThanOrEqual(CELLS_AT_390);
  });
});

describe('the Spanish catalog (FR-I18N-3)', () => {
  const rendered = render(es);

  /** The forms that address the reader: the three pronouns, the possessive, and the imperatives the copy could slip into. */
  const BANNED = [
    'tú',
    'vos',
    'usted',
    'ustedes',
    'tu',
    'tus',
    'mira',
    'mirá',
    'busca',
    'buscá',
    'ingresa',
    'ingresá',
    'elige',
    'elegí',
    'escribe',
    'escribí',
    'prueba',
    'probá',
    'usa',
    'usá',
    'toca',
    'tocá',
    'arrastra',
    'arrastrá',
    'vuelve',
    'volvé',
    'presiona',
    'presioná',
    'selecciona',
    'seleccioná',
    'intenta',
    'intentá',
    'haz',
    'hacé',
    'pon',
    'poné',
    'fíjate',
    'fijate',
  ];

  it('never addresses the reader', () => {
    for (const message of rendered) {
      for (const word of BANNED) {
        expect(message).not.toMatch(new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu'));
      }
    }
  });

  it('is actually Spanish, not English left in place', () => {
    const english = new Set(render(en));
    // The strings that are the same in both languages by design: names, symbols and coordinates (FR-I18N-4, FR-I18N-6).
    const shared = new Set([
      en.location.coordsPlaceholder,
      en.settings.installLabel, // "App" in both (FR-SET-1 as amended v2.1)
      en.chart.view.polar,
      en.live.pending, // an ellipsis is an ellipsis (R32)
      en.footer.celestrak.link,
      en.footer.openMeteo.link,
      en.footer.geonames.link,
      en.footer.chart.link, // R102 (FR-SHOW-8): the library and its author are names (FR-I18N-6)
      en.footer.chart.link2,
      en.footer.short.licence,
      en.passes.stamp({ date: '2026-09-11', time: '21:14:32 GMT-3' }),
      en.passes.direction({ point: 'NE', degrees: '46°' }),
      en.guide.azimuth({ point: 'ENE', degrees: '67°' }),
      en.guide.numbers.sunWithLabel({ degrees: '+2.4°', twilight: false }), // just the number when the sky is dark
      en.elements.age(AGE),
      en.elements.age({ days: 0, hours: 3, minutes: 12 }),
      // R81: a clock span, a name with its count, and the path — times, names, compass points and degrees.
      en.home.darkWindow({ from: '20:14', to: '05:31' }),
      en.home.upNow({ name: 'ISS (Zarya)', left: null, more: 0 }),
      en.nextEvent.path({ start: { point: 'SW', altitude: 46 }, peak: { point: 'S', altitude: 46 }, end: { point: 'E', altitude: 22 } }),
      en.nextEvent.named({ name: 'ISS (Zarya)', path: 'NW low → 68° N → SE' }),
      en.nextEvent.withDuration({ path: 'NW low → 68° N → SE', minutes: 6 }),
      // R77: the held offset (numbers and `min`/`h`, the same abbreviations in both), and the overview's `+24 h`.
      en.live.heldOffset({ sign: '+', hours: 0, minutes: 33 }),
      en.live.heldOffset({ sign: '−', hours: 2, minutes: 5 }),
      en.live.overviewEnd,
      '.',
      ' (CC BY 4.0).',
    ]);
    for (const message of rendered) {
      if (shared.has(message)) continue;
      expect(english.has(message), `Spanish message left in English: “${message}”`).toBe(false);
    }
  });
});

describe('the two catalogs (FR-I18N-2)', () => {
  /**
   * The fixture the requirement asks for: a catalog with one key taken out
   * does not typecheck. The `@ts-expect-error` is the assertion — if
   * `Messages` ever stopped demanding `app.language`, the directive would be
   * unused and `tsc -b` would fail on this line instead. There is no runtime
   * check to write, and no fallback path to test, which is the point.
   */
  it('cannot be missing a key: the type is the check', () => {
    const { language: _dropped, ...appWithoutLanguage } = es.app;
    // @ts-expect-error — `app.language` is missing, so this object is not a `Messages`.
    const incomplete: Messages = { ...es, app: appWithoutLanguage };
    expect(incomplete.app.title).toBe(es.app.title);
  });

  it('agree on their shape: every key of `en` is a key of `es`, of the same kind', () => {
    const shape = (value: unknown, path: string): string[] =>
      typeof value === 'object' && value !== null ? Object.entries(value).flatMap(([key, child]) => shape(child, `${path}.${key}`)) : [`${path}:${typeof value}`];
    expect(shape(es, '')).toEqual(shape(en, ''));
  });

  /**
   * D-199 (2): the split moved every key from one file into four, by hand.
   * The committed snapshot is the flattened key set the split produced,
   * checked against the pre-split catalog before it was committed — a key a
   * later edit moves, adds or renames changes this snapshot, which is the
   * point (`npx vitest run --update` after a deliberate change).
   */
  it('keeps the same flattened key set the single-file catalog had (the per-lane split, D-199)', () => {
    const flatten = (value: unknown, path: string): string[] =>
      typeof value === 'object' && value !== null ? Object.entries(value).flatMap(([key, child]) => flatten(child, `${path}.${key}`)) : [`${path}:${typeof value}`];
    expect(flatten(en, '').sort()).toMatchSnapshot();
  });
});
