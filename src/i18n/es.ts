import type { AgeParts } from '../lib/elementsAge';
import type { CompassPoint } from '../lib/compass';
import type { BrightnessBand, ElevationBand, GuideParams } from '../lib/phrases';
import type { ChartOrientation, ChartView, CloudState, MoonPhaseName, PassBoundaryReason, PassSort, SkyState } from '../model';
import type { Messages } from './messages';

/**
 * FR-I18N-2: the Spanish catalog, typed as `Messages`, so a key missing here
 * is a `tsc -b` failure and never a runtime fallback to English (D-69).
 *
 * FR-I18N-3: neutral and impersonal. No `tú`, no `vos`, no `usted`, and no
 * imperative aimed at the reader — instructions are infinitives ("Arrastrar
 * el domo"), impersonal ("Se puede probar otra grafía") or descriptions of
 * the sky ("Aparece bajo en el oeste-suroeste a las 21:14"). `messages.test.ts`
 * fails on any of the banned forms. Never translated (FR-I18N-6): satellite
 * names, provider names, and the place names geocoding returns.
 */
const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const compass = {
  N: 'norte',
  NNE: 'norte-noreste',
  NE: 'noreste',
  ENE: 'este-noreste',
  E: 'este',
  ESE: 'este-sureste',
  SE: 'sureste',
  SSE: 'sur-sureste',
  S: 'sur',
  SSW: 'sur-suroeste',
  SW: 'suroeste',
  WSW: 'oeste-suroeste',
  W: 'oeste',
  WNW: 'oeste-noroeste',
  NW: 'noroeste',
  NNW: 'norte-noroeste',
} satisfies Record<CompassPoint, string>;

const elevationWord = { low: 'bajo', mid: 'a media altura', high: 'alto', overhead: 'casi en el cenit' } satisfies Record<ElevationBand, string>;
const elevationPhrase = { low: 'bajo en el cielo', mid: 'a media altura', high: 'alto en el cielo', overhead: 'casi en el cenit' } satisfies Record<ElevationBand, string>;

const brightness = {
  venus: 'más brillante que Venus',
  'any-star': 'más brillante que cualquier estrella',
  'bright-star': 'como una estrella brillante',
  'average-star': 'como una estrella común',
  faint: 'tenue, necesita cielo oscuro',
} satisfies Record<BrightnessBand, string>;

const startReason = {
  horizon: 'aparece',
  shadow: 'sale de la sombra de la Tierra',
  twilight: 'se hace visible al oscurecer el cielo',
} satisfies Record<PassBoundaryReason, string>;

const sentenceStart = {
  horizon: 'Aparece',
  shadow: 'Sale de la sombra de la Tierra',
  twilight: 'Se hace visible al oscurecer el cielo,',
} satisfies Record<PassBoundaryReason, string>;

const endReason = {
  horizon: 'baja por debajo del horizonte',
  shadow: 'desaparece en la sombra de la Tierra',
  twilight: 'se desvanece en el cielo que aclara',
} satisfies Record<PassBoundaryReason, string>;

const coordsInstead = 'ingresar coordenadas';

const cloudState = { clear: 'Despejado', partly: 'Parcialmente nublado', obscured: 'Probablemente cubierto', unknown: 'Clima desconocido' } satisfies Record<CloudState, string>;

/** Las ocho fases de FR-MOON-1. Los nombres tradicionales en español: los cuartos cuentan un cuarto del ciclo, no del disco. */
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

export const es: Messages = {
  app: {
    title: 'Qué hay en el cielo ahora mismo',
    tagline: 'Pases de satélites visibles a simple vista para la próxima noche: cuáles, cuándo y hacia dónde mirar.',
    language: 'Idioma',
    theme: 'Tema',
    themes: { dark: 'Oscuro', night: 'Nocturno' },
  },

  banner: { info: 'Nota', warning: 'Aviso' },

  compass,

  location: {
    heading: 'Ubicación',
    placeLabel: 'Nombre del lugar',
    placePlaceholder: 'p. ej. Cipolletti',
    placeList: 'Lugares coincidentes',
    searching: (query) => `Búsqueda de “${query}”…`,
    noMatch: (query) => ({ before: `Ningún lugar coincide con “${query}”. Se puede probar otra grafía, o `, link: coordsInstead, after: '.' }),
    searchFailed: (message) => ({ before: `No se pudo buscar lugares (${message}). Se puede reintentar, o `, link: coordsInstead, after: '.' }),
    placeCentre: (p) => `Centro de ${p.place} (${p.coords}).`,
    coordsLabel: 'Coordenadas (lat, lon)',
    coordsPlaceholder: '-38.93, -67.99',
    altitudeLabel: 'Altitud (m)',
    coordsHint: 'Latitud y longitud en grados decimales, p. ej. -38.93, -67.99 o 38.93 S, 67.99 W',
    suffixOnBoth: 'N/S/E/W en ambos valores, o en ninguno',
    signOrSuffix: 'Signo o N/S/E/W, no ambos',
    oneOfEach: 'Hace falta una latitud (N o S) y una longitud (E o W)',
    latitudeRange: (p) => `La latitud tiene que estar entre ${String(p.min)} y ${String(p.max)}`,
    longitudeRange: (p) => `La longitud tiene que estar entre ${String(p.min)} y ${String(p.max)}`,
    altitudeNumber: 'La altitud tiene que ser un número de metros, p. ej. 270',
    altitudeRange: (p) => `La altitud tiene que estar entre ${String(p.min)} y ${String(p.max)} m`,
    useMyLocation: 'Usar mi ubicación',
    locating: 'Buscando la ubicación…',
    permissionDenied: 'Se denegó el permiso de ubicación. Queda la opción de un nombre de lugar o de coordenadas.',
    positionUnavailable: 'El dispositivo no pudo determinar la ubicación. Queda la opción de un nombre de lugar o de coordenadas.',
    positionTimeout: 'La búsqueda de la ubicación tardó demasiado. Se puede reintentar, o dar un nombre de lugar o coordenadas.',
    accuracy: (km) => `unos ${km} km`,
    active: (p) =>
      `Ubicación: ${p.coords}${p.fromDevice ? ' según el dispositivo' : ''}${p.altitude === null ? '' : ` a ${p.altitude} m`}${p.accuracy === null ? '' : ` (con una precisión de ${p.accuracy})`}.`,
    savedHere: 'Guardada solo en este navegador.',
    clearSaved: 'Borrar la ubicación guardada',
    precisionNote: 'La precisión es a nivel de ciudad: un pase se ve igual desde cualquier punto a unos pocos kilómetros, así que no se resuelve ninguna dirección postal.',
  },

  now: {
    heading: 'Ahora mismo',
    noObserver: 'Con un nombre de lugar o coordenadas aparece lo que cruza el cielo en este momento.',
    checking: 'Revisando el cielo…',
    error: (message) => `No se pudo revisar el cielo: ${message}`,
    visible: (count) => (count === 1 ? '1 satélite visible ahora mismo' : `${String(count)} satélites visibles ahora mismo`),
    noDarkness: 'Esta noche no hay oscuridad en esta latitud: el sol nunca baja lo suficiente para ver satélites.',
    daylight: (p) => `Hay luz de día: el sol está ${p.sunDegrees} ${p.above ? 'sobre' : 'bajo'} el horizonte. Los satélites no se ven hasta que el cielo esté oscuro.`,
    nothingUp: (minElevation) => `Nada visible ahora mismo: ningún satélite del catálogo está por encima de ${minElevation}.`,
    allInShadow: (count) =>
      count === 1
        ? 'Nada visible ahora mismo: hay 1 satélite arriba, pero en la sombra de la Tierra.'
        : `Nada visible ahora mismo: hay ${String(count)} satélites arriba, pero todos en la sombra de la Tierra.`,
    elevation: (degrees) => `${degrees} de altura`,
    remaining: (p) => `${{ horizon: 'se pone en', shadow: 'entra en la sombra de la Tierra en', twilight: 'se desvanece en el cielo que aclara en' }[p.reason]} ${p.countdown}`,
    remainingUnknown: 'visible por un rato más',
    clouds: 'Nubes ahora:',
    asOf: (time) => `a las ${time}`,
  },

  moon: {
    phase: moonPhase,
    line: (p) => `Luna: ${moonPhase[p.phase]}, ${p.illumination} % iluminada, ${p.up ? `${p.direction} ${p.azimuth}, ${p.elevation} de altura` : 'bajo el horizonte'}.`,
    glare: {
      label: 'resplandor lunar',
      sentence: 'La Luna está brillante y cerca del recorrido.',
      tooltip: (p) =>
        `La Luna está iluminada al ${p.illumination} % y a ${p.separation} del máximo del pase. Un pase queda marcado cuando la Luna está sobre el horizonte en el máximo, iluminada al menos al ${p.minIllumination} % y a menos de ${p.maxSeparation}.`,
    },
    lore: {
      heading: 'La Luna esta noche',
      tradition: 'tradición',
      line: (p) => `La Luna está en ${p.sign}${p.fullMoonName === null ? '' : ` y la luna llena de este mes se conoce como ${p.fullMoonName}`}. ${p.line}`,
    },
  },

  passes: {
    heading: 'Próximos pases',
    noObserver: 'Con un nombre de lugar o coordenadas aparecen los pases visibles.',
    loadingElements: 'Cargando los elementos orbitales de CelesTrak…',
    elementsError: (message) => `No se pudieron cargar los elementos orbitales: ${message}`,
    noElements: 'Ningún objeto del catálogo tiene elementos orbitales en este momento.',
    computing: 'Calculando los pases…',
    computingProgress: (p) => `Calculando los pases… ${String(p.done)} de ${String(p.total)}, ${String(p.found)} visibles hasta ahora`,
    passesError: (message) => `No se pudieron calcular los pases: ${message}`,
    unknownError: 'error desconocido',
    noDarkness: (p) => `Esta noche no hay oscuridad en esta latitud: el sol nunca baja lo suficiente en las próximas ${String(p.hours)} h desde ${p.place}.`,
    none: (p) => `Ningún pase visible en las próximas ${String(p.hours)} h desde ${p.place}.`,
    found: (p) => `${String(p.count)} pases visibles en las próximas ${String(p.hours)} h desde ${p.place}`,
    sortGroup: 'Ordenar los pases',
    sortPrefix: 'Orden:',
    sort: { chronological: 'Los más próximos', best: 'Los mejores' } satisfies Record<PassSort, string>,
    heroKicker: (p) => (p.iss ? 'Próximo pase de la ISS' : `Próximo pase de ${p.name}`),
    twilightLabel: 'cielo todavía claro',
    openGuide: 'Abrir la guía →',
    fields: {
      start: 'Inicio',
      maxElevation: 'Elevación máxima',
      peakDirection: 'Dirección del máximo',
      duration: 'Duración',
      magnitude: 'Magnitud',
      clouds: 'Nubes',
    },
    stamp: (p) => `${p.date} ${p.time}`,
    direction: (p) => `${p.point} (${p.degrees})`,
    magnitudeWithBand: (p) => `${p.magnitude}, ${brightness[p.band]}`,
  },

  countdown: {
    headline: (p) => {
      switch (p.phase) {
        case 'before':
          return `${{ horizon: 'Aparece en', shadow: 'Sale de la sombra en', twilight: 'Visible en' }[p.reason]} ${p.clock}`;
        case 'to-peak':
          return `Máximo en ${p.clock}`;
        case 'to-end':
          return `${{ horizon: 'Se pone en', shadow: 'Entra en la sombra en', twilight: 'Se desvanece en' }[p.reason]} ${p.clock}`;
        case 'over':
          return `Terminó hace ${p.clock}`;
      }
    },
    steps: 'Horas de salida, máximo y fin',
    rise: 'salida',
    peak: 'máximo',
    set: 'fin',
  },

  guide: {
    back: '← Volver a la lista',
    close: 'Cerrar la guía',
    panelLabel: (p: { name: string }) => `Guía: ${p.name}`,
    sentence: (p: GuideParams) => {
      const start = `${sentenceStart[p.startReason]} ${elevationWord[p.startBand]} en el ${compass[p.startDir]} a las ${p.startTime}`;
      const peak = `sube a ${p.peakDegrees} (${elevationPhrase[p.peakBand]}) en el ${compass[p.peakDir]} a las ${p.peakTime}`;
      const end = `${endReason[p.endReason]} en el ${compass[p.endDir]} a las ${p.endTime}`;
      const bright = `${capitalise(brightness[p.brightness])} (magnitud ${p.magnitude}).`;
      const twilight = p.twilight ? ' El cielo todavía estará claro, así que puede costar verlo.' : '';
      return `${start}, ${peak}, ${end}. ${bright}${twilight}`;
    },
    startReason,
    endReason,
    numbers: {
      caption: 'Salida, máximo y fin',
      point: 'Punto',
      time: 'Hora',
      azimuth: 'Acimut',
      elevation: 'Elevación',
      range: 'Distancia',
      start: 'Salida',
      peak: 'Máximo',
      end: 'Fin',
      duration: 'Duración',
      magnitude: 'Magnitud',
      rangeAtPeak: 'Distancia en el máximo',
      startsWhen: 'Empieza cuando',
      endsWhen: 'Termina cuando',
      sunAtPeak: 'Sol en el máximo',
      sunWithLabel: (p) => `${p.degrees}${p.twilight ? ' (cielo todavía claro)' : ''}`,
    },
    azimuth: (p) => `${p.point} ${p.degrees}`,
  },

  chart: {
    viewGroup: 'Vista del gráfico',
    viewPrefix: 'Vista:',
    view: { dome: 'Domo', polar: 'Polar' } satisfies Record<ChartView, string>,
    loadingDome: 'Cargando el domo celeste…',
    noPass: 'Ningún pase para dibujar.',
    orientationGroup: 'Orientación del gráfico',
    orientation: { 'looking-up': 'Vista al cielo', map: 'Mapa' } satisfies Record<ChartOrientation, string>,
    orientationNote: {
      'looking-up': 'Vista al cielo: el este a la izquierda, como al mirar de espaldas al suelo.',
      map: 'Mapa: el este a la derecha, como en un mapa.',
    } satisfies Record<ChartOrientation, string>,
    passLabel: (p) => `${p.name} ${p.time}`,
    peakLabel: (degrees) => `máx ${degrees}`,
    sunLabel: 'Sol',
    moonLabel: (glyph) => `${glyph} Luna`,
    domeGroup: 'Domo celeste',
    domeHint: 'Arrastrar el domo, o usar las flechas del teclado, para mirar alrededor.',
    readout: (p) => `Hacia ${p.point} (${p.azimuth}) · inclinación ${p.tilt}`,
    liveLabel: 'Todo el cielo en el instante mostrado',
  },

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
    sky: { day: 'de día', 'bright-twilight': 'crepúsculo claro', dark: 'oscuro' } satisfies Record<SkyState, string>,
    pending: '…',
    visible: (count) => (count === 1 ? '1 satélite' : `${String(count)} satélites`),
    moon: (p) => `${moonPhase[p.phase]}, ${p.illumination} % iluminada`,
    share: 'Compartir este cielo',
    shareTitle: 'El cielo ahora mismo',
    shareText: (place) => `Todo el cielo sobre ${place}, en vivo.`,
  },

  share: {
    pass: 'Compartir este paso',
    title: (p) => `${p.name} en tu cielo`,
    copied: 'Enlace copiado',
    copyFailed: 'No se pudo copiar el enlace. Acá está:',
    nearest: (p) => `El paso de ${p.name} para el que se hizo este enlace (${p.time}) ya no está en la ventana. Este es el paso de ${p.name} más cercano.`,
    missing: (p) => `El paso de ${p.name} para el que se hizo este enlace (${p.time}) ya no está en la ventana, y no hay ningún otro paso de ${p.name} en ella.`,
  },

  weather: {
    state: cloudState,
    badge: (p) => (p.percent === null ? cloudState[p.state] : `${cloudState[p.state]}, ${p.percent} % de nubes`),
    momentNow: 'ahora mismo',
    momentPeak: 'en el máximo del pase',
    tooltipHead: (p) => (p.percent === null ? `Sin pronóstico de nubes ${p.moment}.` : `${p.percent} % de nubosidad efectiva ${p.moment}.`),
    thresholds: (p) =>
      `Despejado por debajo del ${p.clear} %, parcialmente nublado entre el ${p.clear} y el ${p.obscured} %, probablemente cubierto por encima del ${p.obscured} % de nubosidad efectiva (las nubes bajas y medias pesan más que las altas).`,
    source: (p) => `Pronóstico de ${p.provider}, obtenido ${p.fetched}.`,
    noForecast: 'No hay pronóstico disponible.',
  },

  elements: {
    region: 'Elementos orbitales',
    age: (p: AgeParts) => {
      if (p.days > 0) return p.hours > 0 ? `${String(p.days)} d ${String(p.hours)} h` : `${String(p.days)} d`;
      if (p.hours > 0) return p.minutes > 0 ? `${String(p.hours)} h ${String(p.minutes)} min` : `${String(p.hours)} h`;
      return p.minutes > 0 ? `${String(p.minutes)} min` : 'menos de un minuto';
    },
    none: (checked) => `Ningún elemento orbital en uso. Última consulta a CelesTrak ${checked}.`,
    newest: (p) => `Elementos orbitales: época más reciente de hace ${p.age} (${p.epoch}), confirmados con CelesTrak ${p.checked}.`,
    stale: (fetched) =>
      `No se pudo contactar a CelesTrak, así que están en uso los elementos obtenidos ${fetched}. Se actualizan en cuanto vuelva la conexión; hasta entonces los pases pueden desviarse algunos minutos.`,
    oldEpoch: (p) =>
      `Los elementos orbitales son de hace ${p.age}. Las predicciones pierden precisión después de ${String(p.days)} días, y la ISS en particular cambia de órbita a menudo: las horas pueden desviarse algunos minutos.`,
    notCached: 'Los elementos no se pudieron guardar en este navegador, así que quedan en memoria solo para esta sesión y se van a pedir de nuevo la próxima vez.',
    unavailable: (p) => `Sin elementos actuales de CelesTrak para ${String(p.count)} objeto${p.count === 1 ? '' : 's'} del catálogo: ${p.names}. Quedan fuera de la lista.`,
  },

  footer: {
    celestrak: { before: 'Elementos orbitales de ', link: 'CelesTrak', after: '.' },
    openMeteo: { before: 'Datos meteorológicos de ', link: 'Open-Meteo.com', after: ' (CC BY 4.0).' },
    geonames: { before: 'Búsqueda de lugares por la geocodificación de Open-Meteo, con datos de ', link: 'GeoNames', after: ' (CC BY 4.0).' },
    privacy: 'Sin analítica ni rastreo: la ubicación se guarda solo en este navegador.',
    credit: { before: 'Hecho por ', link: 'Ezequiel Baruf', after: '.' },
    short: {
      sources: 'Datos:',
      licence: '(CC BY 4.0)',
      privacy: 'Sin rastreo',
    },
  },
};
