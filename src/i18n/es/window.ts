import type { windowMessages as EnWindow } from '../en/window';

/** FR-I18N-2 (D-199 (2)): la sección del lane `window` en el catálogo español. R47: las palabras de la ventana al cielo; R56 (FR-FOL-5): los dos avisos de apuntar al suelo; R73 (FR-FSC-11): el consejo de girar el teléfono. */
export const windowMessages: typeof EnWindow = {
  window: {
    waiting: 'Esperando los sensores del teléfono…',
    denied: 'Se rechazó el acceso al movimiento, así que la cúpula sigue siendo la vista. Para que te lo vuelva a preguntar, recargá la página: Safari pregunta una vez por carga.',
    relative: 'Este dispositivo no informa hacia dónde apunta.',
    hint: 'Levantá el teléfono: la ventana muestra el cielo al que apunta.',
    readout: (p) => `Mirando al ${p.point} (${p.azimuth}) · ${p.altitude} de altura`,
    trueNorth: (p) => `norte verdadero, declinación ${p.declination}`,
    ground: 'Apuntando al suelo — levantá el teléfono.',
    buried: 'Estás apuntando al suelo — levantá el teléfono.',
    turnAdvice: 'Gira el teléfono de lado para ver más cielo.',
    emptyField: (p) =>
      `Nada en esta parte del cielo. ${p.name} está ${p.angle} a la ${{ left: 'izquierda', right: 'derecha' }[p.side]}, ${{ rise: 'sale', peak: 'culmina', end: 'se pone' }[p.kind]} en ${p.countdown}.`,
    emptySky: 'Nada en esta parte del cielo, y ningún pase hacia el que girar.',
    gutterLabel: 'Hacia dónde girar',
    gutterMark: (p) => (p.place === 'in' ? `${p.key} ${p.name}: a la vista` : `${p.key} ${p.name}: ${p.angle} a la ${{ left: 'izquierda', right: 'derecha' }[p.place]}`),
  },
};
