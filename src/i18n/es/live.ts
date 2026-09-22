import type { MoonPhaseName } from '../../model';
import type { live as EnLive } from '../en/live';

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

/** FR-I18N-2 (D-199 (2)): the `live` lane's own section of the Spanish catalog, typed against `en/live.ts`'s shape. */
export const live: typeof EnLive = {
  live: {
    open: 'Cielo en vivo',
    openShort: 'vivo',
    openFromNow: 'Ver el cielo en vivo',
    back: '← Volver',
    backShort: '←',
    backName: 'Volver',
    loading: 'Cargando el cielo en vivo…',
    noObserver: 'El cielo en vivo necesita desde dónde mirar: un nombre de lugar o unas coordenadas en la página de inicio.',
    noElements: 'Todavía no hay elementos orbitales, así que no hay nada que dibujar.',
    strip: 'Condiciones del cielo',
    timeLabel: 'Hora',
    skyLabel: 'Cielo',
    cloudLabel: 'Nubes',
    countLabel: 'Arriba',
    countSpoken: 'Satélites',
    moonLabel: 'Luna',
    sky: { day: 'de día', 'bright-twilight': 'crepúsculo claro', dark: 'oscuro' },
    /**
     * R77 (FR-WATCH-3, FR-COMP-4): la línea compacta en 36 celdas con sus palabras más largas —
     * `21:14:32 crepúsculo limpio 12 arriba` son 36. "Limpio" y "tapado" y no "despejado" y "cubierto":
     * con "crepúsculo" al lado, esas dos se pasaban por tres celdas. Sin pronóstico, `s/d` (FR-WX-5).
     */
    skyShort: { day: 'día', 'bright-twilight': 'crepúsculo', dark: 'oscuro' },
    cloudWord: { clear: 'limpio', partly: 'nuboso', obscured: 'tapado', unknown: 's/d' },
    /** R85 (FR-COMP-7): `s/d` se lee "sin datos". */
    cloudSpoken: { clear: 'limpio', partly: 'nuboso', obscured: 'tapado', unknown: 'sin datos' },
    upCount: (count) => `${String(count)} arriba`,
    pending: '…',
    moon: (p) => `${moonPhase[p.phase]}, ${p.illumination} % iluminada`,
    /**
     * R77 (FR-WATCH-1, FR-WATCH-2): "fijado" y "fijar" son la misma palabra, el estado y la acción que lo
     * pone; `[ ir al vivo ]` cabe en la fila compacta de 36 celdas junto a `[ ] Ocultos Compartir` (V20-8),
     * donde "volver al vivo" se pasaba por cuatro.
     */
    state: { live: 'en vivo', held: 'fijado' },
    scrub: 'fijar',
    scrubWide: 'recorrer la noche',
    backToLive: 'ir al vivo',
    /**
     * R85 (FR-COMP-7, D-549): con `[ Compartir ]` otra vez entre corchetes, la fila compacta del estado fijado es
     * `[ vivo ] [ ] Ocultos [ Compartir ]`, 34 celdas; `[ ir al vivo ]` la llevaba a 41. El nombre accesible sigue
     * siendo "ir al vivo", que contiene la palabra.
     */
    backToLiveShort: 'vivo',
    heldOffset: (p) => (p.hours === 0 ? `${p.sign}${String(p.minutes)} min` : `${p.sign}${String(p.hours)} h ${String(p.minutes).padStart(2, '0')} min`),
    overviewStart: 'ahora',
    overviewEnd: '+24 h',
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
    /**
     * R71 (FR-LEG-7): el control de la leyenda en la fila de acciones; la cuenta son las pasadas dibujadas (D-388).
     * R85 (FR-COMP-7, D-549): `[ ver 3 ]` y no `[ lista (3) ]` — con `[ Compartir ]` entre corchetes la fila en
     * vivo es `[ fijar ] [ ver 3 ] [ Compartir ]`, 33 celdas (34 con una cuenta de dos cifras); con "lista (3)"
     * eran 37, y "lista 3" todavía 35.
     */
    list: (p) => `ver ${String(p.count)}`,
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
  },
};
