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
    openFromNow: 'Ver el cielo en vivo',
    back: '← Volver',
    loading: 'Cargando el cielo en vivo…',
    noObserver: 'El cielo en vivo necesita desde dónde mirar: un nombre de lugar o unas coordenadas en la página de inicio.',
    noElements: 'Todavía no hay elementos orbitales, así que no hay nada que dibujar.',
    strip: 'Estado del cielo',
    timeLabel: 'Hora',
    skyLabel: 'Cielo',
    cloudLabel: 'Nubes',
    countLabel: 'Visibles',
    moonLabel: 'Luna',
    sky: { day: 'de día', 'bright-twilight': 'crepúsculo claro', dark: 'oscuro' },
    pending: '…',
    visible: (count) => (count === 1 ? '1 satélite' : `${String(count)} satélites`),
    moon: (p) => `${moonPhase[p.phase]}, ${p.illumination} % iluminada`,
    share: 'Compartir este cielo',
    shareTitle: 'El cielo ahora mismo',
    shareText: (place) => `Todo el cielo sobre ${place}, en vivo.`,
    stripe: 'Franja de tiempo: las próximas 24 horas',
    playback: 'Reproducción',
    play: 'Reproducir',
    pause: 'Pausa',
    now: 'Ahora',
    speedGroup: 'Velocidad de reproducción',
    speed: (factor) => `${String(factor)}×`,
    speedLabel: 'Velocidad',
    hiddenToggle: 'Objetos ocultos',
    hiddenReason: { low: 'muy bajo', shadow: 'en sombra', daylight: 'de día', faint: 'muy tenue' },
    hiddenLabel: (p) => `${p.name} · ${p.reason}`,
    follow: 'Seguir al teléfono',
    followRelative: 'Este teléfono no da un rumbo de brújula, así que la cúpula no puede girar con él.',
    followDenied: 'Se rechazó el acceso al movimiento, así que la cúpula no puede girar con el teléfono.',
    headingLabel: 'Rumbo',
    trueNorth: (p) => `norte verdadero, declinación ${p.declination}`,
  },
};
