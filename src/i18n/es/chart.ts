import type { ChartOrientation, ChartView } from '../../model';
import type { chart as EnChart } from '../en/chart';

/** FR-I18N-2 (D-199 (2)): the `chart` lane's own section of the Spanish catalog, typed against `en/chart.ts`'s shape. */
export const chart: typeof EnChart = {
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
    legend: {
      label: 'Leyenda',
      state: { live: 'arriba', ahead: 'pronto', linger: 'pasó' },
      sun: (p) => `Sol · az ${p.azimuth} · alt ${p.altitude}`,
      moon: (p) => `${p.glyph} Luna · az ${p.azimuth} · alt ${p.altitude}`,
    },
    domeGroup: 'Domo celeste',
    domeHint: 'Arrastrar el domo, o usar las flechas del teclado, para mirar alrededor.',
    readout: (p) => `Hacia ${p.point} (${p.azimuth}) · inclinación ${p.tilt}`,
    liveLabel: 'Todo el cielo en el instante mostrado',
  },
};
