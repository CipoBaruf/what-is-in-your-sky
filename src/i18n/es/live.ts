import type { UpEvent } from '../../lib/contextLine';
import type { Landmark } from '../../lib/landmark';
import { offsetSpan } from '../../lib/playback';
import type { MoonPhaseName } from '../../model';
import type { live as EnLive } from '../en/live';

/** R123 para R127 (FR-SKY-11): la palabra de dirección de la línea del punto de referencia. */
const landmarkWord: Record<Landmark['word'], string> = { above: 'sobre', below: 'bajo', beside: 'junto a' };

/** Las ocho fases (D-103): la misma grafía que `es/ui.ts` usa para `moon.phase`, duplicada porque el lane `live` es dueño único de este archivo. */
const moonPhase = {
  new: 'nueva',
  waxingCrescent: 'creciente',
  firstQuarter: 'cuarto creciente',
  waxingGibbous: 'gibosa creciente',
  full: 'llena',
  waningGibbous: 'gibosa menguante',
  lastQuarter: 'cuarto menguante',
  waningCrescent: 'menguante',
} satisfies Record<MoonPhaseName, string>;

/** R143 (FR-TONIGHT-7): qué hace después un pase que está arriba; las mismas palabras que la puerta de satélites (`es/home.ts`). */
const upVerb: Record<UpEvent, string> = { peak: 'culmina', horizon: 'se pone', shadow: 'a la sombra', twilight: 'se apaga' };

/** FR-I18N-2 (D-199 (2)): the `live` lane's own section of the Spanish catalog, typed against `en/live.ts`'s shape. */
export const live: typeof EnLive = {
  live: {
    open: 'Cielo en vivo',
    openShort: 'vivo',
    loading: 'Cargando el cielo en vivo…',
    noPlace: 'El cielo en vivo necesita un lugar.',
    setPlace: 'elegir un lugar',
    loadingElements: 'Cargando los elementos orbitales…',
    failedInstead: 'Mientras tanto no hay un cielo guardado para dibujar.',
    strip: 'Condiciones del cielo',
    skyLabel: 'Cielo',
    cloudLabel: 'Nubes',
    countLabel: 'Arriba',
    moonLabel: 'Luna',
    sky: { day: 'de día', 'bright-twilight': 'crepúsculo claro', dark: 'oscuro' },
    /** R85 (FR-COMP-7): `S/d` se lee "sin datos"; desde R145, el de la línea de contexto (`context.cloudWord`). */
    cloudSpoken: { clear: 'limpio', partly: 'nuboso', obscured: 'tapado', unknown: 'sin datos' },
    pending: '…',
    moon: (p) => `${moonPhase[p.phase]}, ${p.illumination} % iluminada`,
    /**
     * R77 (FR-WATCH-1, FR-WATCH-2): "fijado" es el estado; `[ ir al vivo ]` cabía en la fila compacta de 36 celdas
     * junto a `[ ] Ocultos Compartir` (V20-8), donde "volver al vivo" se pasaba por cuatro. R145 (FR-TONIGHT-6): la
     * fila compacta ya no está, y `[ fijar ]` y `[ vivo ]` se fueron con ella.
     */
    state: { live: 'en vivo', held: 'fijado' },
    scrubWide: 'recorrer la noche',
    backToLive: 'ir al vivo',
    /** R101 (FR-JUMP-1): `[ ver este pase ]`, que fija la página en la salida del pase que nombra el titular. */
    seeThisPass: 'ver este pase',
    seeThisPassName: (name) => `Ver este pase: ${name}, fijado en su salida`,
    heldOffset: (p) => `${p.sign}${offsetSpan(p)}`,
    share: 'Compartir este cielo',
    shareMoment: 'Compartir este momento',
    shareTitle: 'El cielo ahora mismo',
    shareText: (place) => `Todo el cielo sobre ${place}, en vivo.`,
    stripe: 'Franja de tiempo: cuatro de las próximas 24 horas',
    overview: 'Vista de la noche',
    playback: 'Reproducción',
    play: 'Reproducir',
    pause: 'Pausa',
    speedGroup: 'Velocidad de reproducción',
    speed: (factor) => `${String(factor)}×`,
    hiddenToggle: 'Objetos ocultos',
    hiddenReason: { low: 'muy bajo', shadow: 'en sombra', daylight: 'de día', faint: 'muy tenue' },
    hiddenLabel: (p) => `${p.name} · ${p.reason}`,
    /** R150 (FR-GYRO-10, D-949, D-951): el título sobre la lista de satélites al final de la hoja; la cuenta son las pasadas dibujadas. */
    satellites: (p) => `Satélites (${String(p.count)})`,
    more: (n) => `+${String(n)} más`,
    /**
     * R48 (FR-TRAJ-5): "sale" (the pass rises) and not "salida" — the six
     * buttons must stay within their row with their gaps (FR-COMP-4), and
     * "salida" is two cells too many; "pasada", the word the accessible names
     * use, is four. R70 (FR-SPAN-3): the ±10 min pair gives way to the two
     * chunk buttons, whose "4h" is the same two characters in both languages.
     */
    stepping: 'Mover el instante mostrado',
    step: { prevRise: '|◀ sale', backChunk: '◀ 4h', back1: '−1m', forward1: '+1m', forwardChunk: '4h ▶', nextRise: 'sale ▶|' },
    stepName: {
      prevRise: 'Pasada anterior',
      backChunk: 'Cuatro horas atrás',
      back1: 'Un minuto atrás',
      forward1: 'Un minuto adelante',
      forwardChunk: 'Cuatro horas adelante',
      nextRise: 'Pasada siguiente',
    },
    playShort: '▶',
    pauseShort: '‖',
    hiddenShort: 'Ocultos',
    shareShort: 'Compartir',
    starsToggle: 'estrellas',
    starsToggleName: 'Estrellas bajo los arcos',
    landmarkLine: (p) => `pasa ${p.degrees} ${landmarkWord[p.word]} ${p.star}, en ${p.constellation}`,
    landmarkThrough: (p) => `pasa por ${p.constellation}`,
    /**
     * R143 (FR-TONIGHT-4): `▶ [ noche ] [ próximo ] [ ahora ]`, 33 celdas con `▶` o `‖`, lo que caben 360 px ("esta
     * noche" en el botón serían 38).
     */
    taps: 'Saltar en el tiempo',
    tap: { tonight: 'noche', next: 'próximo', now: 'ahora' },
    /** R143 (FR-TONIGHT-7): `ahora`; `en 6 h 12 min`, `hace 12 min`; `esta noche · en 6 h 12 min`; `sáb · en 20 h 00 min`; `en <1 min`. */
    chip: (c) => {
      if (c.kind === 'now') return 'ahora';
      const offset = c.kind === 'ahead' ? `en ${offsetSpan(c, true)}` : `hace ${offsetSpan(c, true)}`;
      const day = c.tonight ? 'esta noche' : c.weekday;
      return day === null || day === '' ? offset : `${day} · ${offset}`;
    },
    shownTime: 'Hora mostrada',
    /**
     * R143 (FR-TONIGHT-7): la línea de contexto en 36 celdas. `S/d` y no "Sin datos": con "Crepúsculo" y la hora
     * del próximo pase la línea larga es `Crepúsculo · S/d · próximo 21:47`, 32; "Sin datos" la llevaba a 38. Se lee
     * "sin datos" (`cloudSpoken`).
     */
    context: {
      separator: ' · ',
      up: (p) => `${upVerb[p.event]} ${p.point} ${p.countdown}`,
      sky: (p) => `${p.sky} · ${p.cloud} · próximo ${p.next}`,
      skyWord: { day: 'Día', 'bright-twilight': 'Crepúsculo', dark: 'Oscuro' },
      cloudWord: { clear: 'Limpio', partly: 'Nuboso', obscured: 'Tapado', unknown: 'S/d' },
      noneSpan: 'Ningún pase visible en 24 h',
      noneTonight: 'Ningún pase visible esta noche',
    },
    /**
     * R146 (FR-FULL-10, FR-FULL-8): la tarjeta sobre el cielo. `Tiangong · 21:47 · en 4 h 12 min` a `--small`;
     * `Ningún pase visible en las próximas 24 h.` son 41 caracteres, también a `--small` (35,9 celdas, D-930).
     */
    opening: {
      nothingUp: 'Nada visible ahora.',
      noPass: 'Ningún pase visible en las próximas 24 h.',
      separator: ' · ',
      passWhen: (p) => `${p.time} · ${p.chip}`,
      seeNext: 'ver próximo pase',
      seeNow: 'ver ahora',
      seeSkyNow: 'ver el cielo ahora',
    },
  },
};
