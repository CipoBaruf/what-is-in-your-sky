import type { sheet as EnSheet } from '../en/sheet';

/** FR-I18N-2 (D-199 (2)): el botón de controles del vivo compacto, la hoja que abre y su `×`, "Cerrar controles" (R147, FR-FULL-8; R150, FR-GYRO-8); `[ seguir ]` a su lado (R157, FR-PHONE-3). */
export const sheet: typeof EnSheet = {
  sheet: {
    controls: 'controles',
    follow: 'seguir',
    name: 'Controles del cielo',
    close: 'Cerrar controles',
    followAsk: {
      question: '¿Usar el teléfono para mirar el cielo?',
      allow: 'permitir',
      notNow: 'ahora no',
    },
  },
};
