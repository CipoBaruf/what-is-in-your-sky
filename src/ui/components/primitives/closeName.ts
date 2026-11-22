import { createContext } from 'react';

/**
 * R209 (FR-CTRL-12; D-703, D-1257): the name a `Close` takes where its host gives none. A primitive carries no
 * copy, so `I18nProvider` puts the active catalog's word here ("Close", "Cerrar").
 */
export const CloseNameContext = createContext<string | undefined>(undefined);
