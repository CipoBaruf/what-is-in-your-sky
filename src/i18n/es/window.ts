import type { windowMessages as EnWindow } from '../en/window';

/** FR-I18N-2 (D-199 (2)): la sección del lane `window` en el catálogo español. R47: las palabras de la ventana al cielo; R56 (FR-FOL-5): los dos avisos de apuntar al suelo; R73 (FR-FSC-11): el consejo de girar el teléfono. */
export const windowMessages: typeof EnWindow = {
  window: {
    waiting: 'Esperando los sensores del teléfono…',
    denied: 'Se rechazó el acceso al movimiento, así que la cúpula sigue siendo la vista.',
    relative: 'Este teléfono no da un rumbo de brújula, así que la ventana no puede encontrar el norte.',
    hint: 'Levantá el teléfono: la ventana muestra el cielo al que apunta.',
    readout: (p) => `Mirando al ${p.point} (${p.azimuth}) · ${p.altitude} de altura`,
    trueNorth: (p) => `norte verdadero, declinación ${p.declination}`,
    ground: 'Apuntando al suelo — levantá el teléfono.',
    buried: 'Estás apuntando al suelo — levantá el teléfono.',
    turnAdvice: 'Gira el teléfono de lado para ver más cielo.',
  },
};
