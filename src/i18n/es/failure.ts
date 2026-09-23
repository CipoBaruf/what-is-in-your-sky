import type { failure as EnFailure } from '../en/failure';

/**
 * R89 (FR-FAIL-1, FR-FAIL-2): las oraciones de la línea de falla, tipadas contra
 * `en/failure.ts`. `what` es una frase verbal en infinitivo ("cargar los
 * elementos orbitales"), así "No se pudo …" concuerda con cualquier objeto.
 */
export const failure: typeof EnFailure = {
  failure: {
    offline: (what) => `No se pudo ${what}: este dispositivo está sin conexión.`,
    'rate-limited': (what) => `No se pudo ${what}: el servicio recibe demasiadas consultas. Se puede reintentar en un minuto.`,
    server: (what) => `No se pudo ${what}: el servicio tiene problemas.`,
    'bad-data': (what) => `No se pudo ${what}: la respuesta que llegó no se puede usar.`,
    timeout: (what) => `No se pudo ${what}: el servicio tardó demasiado en responder.`,
    unknown: (what) => `No se pudo ${what}.`,
    retry: 'reintentar',
    details: 'detalles',
    detailLabel: 'Qué falló, tal como se informó',
    what: {
      elements: 'cargar los elementos orbitales',
    },
  },
};
