import type { sheet as EnSheet } from '../en/sheet';

/** FR-I18N-2 (D-199 (2)): el botón de controles del vivo compacto, la hoja que abre (R147, FR-FULL-8; su `×` es `Close`, R224); `[ seguir ]` a su lado (R157, FR-PHONE-3). */
export const sheet: typeof EnSheet = {
  sheet: {
    controls: 'controles',
    follow: 'seguir',
    name: 'Controles del cielo',
    followAsk: {
      question: '¿Usar el teléfono para mirar el cielo?',
      allow: 'permitir',
      notNow: 'ahora no',
    },
  },
};
